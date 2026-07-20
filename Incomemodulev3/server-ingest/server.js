// ═════════════════════════════════════════════════════════════════════
// Document Ingestion Service — standalone microservice
// ═════════════════════════════════════════════════════════════════════
// Isolated from the Investran DIU proxy so that:
//   • Long-running LLM calls (5-30s) never block DIU JE posts
//   • Anthropic API key sits in its own env with its own blast radius
//   • Ingestion can scale independently (workers, queues, doc storage)
//   • Prompts + models iterate on their own deploy cadence
//   • Future ingestion features (email webhook, matching engine, exception
//     queue) all live in one focused service
//
// Endpoints:
//   GET  /healthz                        — health check
//   GET  /api/extract/status             — reports whether Anthropic is configured
//   POST /api/extract/notice             — extract structured fields from a notice PDF
//
// Planned (Phase 2+):
//   POST /api/extract/credit-agreement   — extract deal setup from a CA PDF
//   POST /api/extract/borrower-financials — parse financial statements
//   POST /api/ingest/email-webhook       — inbound email from SES/Postmark
//   POST /api/match/deal                 — deal-matching heuristics engine
//
// Env:
//   PORT / INGEST_PORT               — listen port (default 4319)
//   ALLOWED_ORIGINS                  — CORS whitelist (comma-separated, or *)
//   ANTHROPIC_API_KEY                — Claude API key (required for real extraction)
//   ANTHROPIC_MODEL                  — Claude model (default claude-opus-4-8)
//   LOG_VERBOSE                      — '1' to log request bodies
// ═════════════════════════════════════════════════════════════════════

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');

const PORT = parseInt(process.env.PORT || process.env.INGEST_PORT || '4319', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL   || 'claude-opus-4-8';
const AI_CONFIGURED     = !!ANTHROPIC_API_KEY;
const LOG_VERBOSE       = process.env.LOG_VERBOSE === '1';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ──────── CORS — permissive by default so the browser can reach it ────
app.use(cors({
  origin: (origin, cb) => {
    if(!origin) return cb(null, true);
    if(ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    if(ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Trace-Id']
}));

// ──────── Health check ───────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  res.json({
    ok: true, service: 'ingest', version: '1.0.0',
    aiConfigured: AI_CONFIGURED,
    model: AI_CONFIGURED ? ANTHROPIC_MODEL : null
  });
});

// ──────── AI status probe — the client uses this to show green/amber ──
app.get('/api/extract/status', (req, res) => {
  res.json({
    ok: true,
    aiConfigured: AI_CONFIGURED,
    model: AI_CONFIGURED ? ANTHROPIC_MODEL : null,
    fallback: AI_CONFIGURED ? null : 'mock-extraction (UI-testable without API key)'
  });
});

// ═════════════════════════════════════════════════════════════════════
// Extraction prompt + mock fallback
// ═════════════════════════════════════════════════════════════════════
function buildNoticeExtractionPrompt(dealHint, noticeTypeHint){
  return `You are extracting fields from a private-credit loan notice document (interest payment, principal paydown, fee notice, rate reset, or drawdown request).

Return ONLY a JSON object matching this schema — no prose, no markdown:

{
  "notice_type": "interest" | "principal" | "fee" | "rate_reset" | "drawdown" | "default" | "waiver" | "amendment" | "other",
  "reference": "the agent bank's reference / notice number (string) or null",
  "effective_date": "YYYY-MM-DD (payment / settlement date) or null",
  "notice_date": "YYYY-MM-DD (date the notice itself was issued) or null",
  "amount": <number> or null,
  "currency": "3-letter ISO code (USD/EUR/GBP/AUD/etc)" or null,
  "rate": <number as decimal, e.g. 0.0725 for 7.25%> or null,
  "borrower_hint": "borrower or issuer name as it appears in the notice, or null",
  "deal_hint": "loan/facility identifier from the notice (loan number, CUSIP, ISIN, etc.), or null",
  "period_start": "YYYY-MM-DD interest-period start, if applicable",
  "period_end":   "YYYY-MM-DD interest-period end, if applicable",
  "day_count":    "day-count convention if stated (ACT/360, ACT/365, 30/360)",
  "breakdown": { "any additional structured fields (fee splits, interest components, tranche allocations)": "value" },
  "notes":       "one-sentence free-text summary, e.g. 'Q2 interest payment on Term Loan B'",
  "confidence":  <overall confidence 0..1>,
  "field_confidence": { "reference": 0.9, "amount": 0.95, ... },
  "source_pages": [1,2]
}

Rules:
- All monetary amounts as raw numbers (no commas, no currency symbols)
- All dates as ISO YYYY-MM-DD
- If a field is not clearly present in the document, use null and set field_confidence to 0
- Confidence is your honest estimate of extraction accuracy per field
${dealHint      ? `\nContext hint — the user pre-selected this deal: "${dealHint}". Bias interpretation accordingly.` : ''}
${noticeTypeHint ? `\nContext hint — the user thinks this is a "${noticeTypeHint}" notice. Verify but don't blindly trust.` : ''}`;
}

function mockNoticeExtraction(dealHint){
  return {
    notice_type: 'interest',
    reference: 'MOCK-INT-' + Date.now().toString(36).toUpperCase(),
    effective_date: new Date().toISOString().slice(0,10),
    notice_date: new Date().toISOString().slice(0,10),
    amount: 125000.00,
    currency: 'USD',
    rate: 0.0725,
    borrower_hint: dealHint || 'Mock Borrower Inc.',
    deal_hint: dealHint || 'MOCK-DEAL',
    period_start: null,
    period_end: null,
    day_count: 'ACT/360',
    breakdown: { note: 'Mock extraction — set ANTHROPIC_API_KEY on the ingest server for real AI extraction.' },
    notes: 'Mock interest notice generated because ANTHROPIC_API_KEY is not configured on the ingestion service.',
    confidence: 0.5,
    field_confidence: { reference: 0.5, amount: 0.5, effective_date: 0.5 },
    source_pages: [1]
  };
}

// ──────── Extract endpoint ───────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }   // 25 MB per notice — plenty
});

app.post('/api/extract/notice', upload.single('file'), async (req, res) => {
  const start = Date.now();
  try {
    if(!req.file){ return res.status(400).json({ ok:false, reason:'file (PDF) required' }); }
    const dealHint       = req.body.deal_hint       || req.body.dealHint       || null;
    const noticeTypeHint = req.body.notice_type_hint || req.body.noticeTypeHint || null;

    if(LOG_VERBOSE){
      console.log('[extract]', {
        file: req.file.originalname, size: req.file.size,
        dealHint, noticeTypeHint
      });
    }

    // Mock path — server-side dev/demo without a real API key
    if(!AI_CONFIGURED){
      return res.json({
        ok: true, mock: true, elapsed_ms: Date.now() - start,
        model: 'mock-extraction',
        extraction: mockNoticeExtraction(dealHint),
        tokens: { input: 0, output: 0 }
      });
    }

    // Real Claude call — pass the PDF as a document block (Claude reads PDFs natively).
    const b64 = req.file.buffer.toString('base64');
    const body = {
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: buildNoticeExtractionPrompt(dealHint, noticeTypeHint) }
        ]
      }]
    };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if(!r.ok){
      const err = await r.text();
      console.error('[extract] Anthropic API error:', r.status, err);
      return res.status(r.status).json({ ok:false, reason:'anthropic api: ' + err.slice(0,300) });
    }
    const data = await r.json();
    const textOut = (data.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n')
      .trim();

    // Model may wrap the JSON in ```json fences — strip them defensively
    let cleaned = textOut.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    let extraction;
    try { extraction = JSON.parse(cleaned); }
    catch(parseErr){
      const first = cleaned.indexOf('{');
      const last  = cleaned.lastIndexOf('}');
      if(first >= 0 && last > first){
        try { extraction = JSON.parse(cleaned.slice(first, last+1)); }
        catch(e){ return res.status(500).json({ ok:false, reason:'model returned unparseable JSON: ' + textOut.slice(0,300) }); }
      } else {
        return res.status(500).json({ ok:false, reason:'model returned no JSON: ' + textOut.slice(0,200) });
      }
    }
    return res.json({
      ok: true,
      extraction,
      model: ANTHROPIC_MODEL,
      tokens: data.usage || {},
      elapsed_ms: Date.now() - start
    });
  } catch(err){
    console.error('[extract] threw:', err);
    return res.status(500).json({ ok:false, reason: err.message });
  }
});

// ──────── Boot ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('════════════════════════════════════════════');
  console.log('Document Ingestion Service listening on port', PORT);
  console.log('  AI extract:      ', AI_CONFIGURED ? ANTHROPIC_MODEL : 'mock mode (no ANTHROPIC_API_KEY)');
  console.log('  Allowed origins: ', ALLOWED_ORIGINS.join(', '));
  console.log('  Health check:    ', 'http://localhost:' + PORT + '/healthz');
  console.log('  Extract status:  ', 'http://localhost:' + PORT + '/api/extract/status');
  console.log('════════════════════════════════════════════');
});
