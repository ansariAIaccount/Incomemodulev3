// ─────────────────────────────────────────────────────────────────────
// Investran DIU Proxy — V3 ↔ Investran Data Import Utility bridge.
//
// Why this exists:
//   - The V3 page runs in a browser. It can't talk to Investran directly
//     because of CORS + OAuth + multipart-upload constraints.
//   - This proxy holds the OAuth client secret, performs the handshake,
//     and forwards calls. The browser only sees same-origin endpoints
//     under /api/diu/* — no secrets, no CORS issues.
//
// Endpoints (mirror the simulator step IDs in V3's postJEsToInvestran):
//   GET  /healthz                              health check
//   POST /api/diu/jobs                         create DIU job
//   POST /api/diu/jobs/:id/files               upload XLSX (multipart)
//   POST /api/diu/jobs/:id/load                load process
//   POST /api/diu/jobs/:id/validate            validate
//   POST /api/diu/jobs/:id/commit              commit batch
//   GET  /api/diu/jobs/:id/processes           confirm
//
// Each endpoint validates input, refreshes the OAuth token if needed, and
// forwards to the configured INVESTRAN_BASE_URL with the bearer token added.
// ─────────────────────────────────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const FormData = require('form-data');

// PORT: cloud hosts (Render, Fly, Heroku, Railway) inject $PORT.
// Local dev uses PROXY_PORT from .env, or falls back to 4318.
const PORT = parseInt(process.env.PORT || process.env.PROXY_PORT || '4318', 10);
const BASE_URL = (process.env.INVESTRAN_BASE_URL || '').replace(/\/$/, '');
const CLIENT_ID = process.env.INVESTRAN_CLIENT_ID || '';
const CLIENT_SECRET = process.env.INVESTRAN_CLIENT_SECRET || '';
const OAUTH_SCOPE = process.env.INVESTRAN_OAUTH_SCOPE || 'dataimport.write';
const TOKEN_URL = process.env.INVESTRAN_TOKEN_URL || (BASE_URL + '/oauth/token');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const DEFAULT_TEMPLATE = process.env.DEFAULT_TEMPLATE || 'IFRS_Loan_GL_DIU_Template';
const LOG_VERBOSE = process.env.LOG_VERBOSE === '1';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ──────── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if(!origin) return cb(null, true);
    if(ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    if(ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  methods: ['GET','POST','PUT','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Trace-Id']
}));

// ──────── OAuth token cache ─────────────────────────────────────────
// Cache the access token + expiry. Refresh ~30s before expiry.
let _token = null;
let _tokenExpiresAt = 0;

async function getAccessToken(){
  const now = Date.now();
  if(_token && _tokenExpiresAt > now + 30_000) return _token;
  if(!CLIENT_ID || !CLIENT_SECRET){
    throw new Error('Investran credentials not configured — set INVESTRAN_CLIENT_ID and INVESTRAN_CLIENT_SECRET in .env');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: OAUTH_SCOPE
  });
  if(LOG_VERBOSE) console.log('[oauth] requesting token from', TOKEN_URL);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if(!res.ok){
    const txt = await res.text().catch(() => '');
    throw new Error('OAuth token request failed: HTTP ' + res.status + ' ' + txt.slice(0, 300));
  }
  const json = await res.json();
  _token = json.access_token;
  // Default to 1 hour if Investran doesn't return expires_in
  _tokenExpiresAt = now + (json.expires_in || 3600) * 1000;
  if(LOG_VERBOSE) console.log('[oauth] token acquired, expires in', Math.round((_tokenExpiresAt - now) / 1000), 's');
  return _token;
}

// ──────── Forwarder helpers ─────────────────────────────────────────
async function forwardJSON(method, path, body){
  if(!BASE_URL) throw new Error('INVESTRAN_BASE_URL not configured');
  const token = await getAccessToken();
  const url = BASE_URL + path;
  if(LOG_VERBOSE) console.log('[fwd]', method, url);
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch(_){ data = { raw: txt }; }
  return { status: res.status, ok: res.ok, data };
}

async function forwardMultipart(path, fileBuffer, fileName, mime){
  if(!BASE_URL) throw new Error('INVESTRAN_BASE_URL not configured');
  const token = await getAccessToken();
  const url = BASE_URL + path;
  const fd = new FormData();
  fd.append('file', fileBuffer, { filename: fileName, contentType: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if(LOG_VERBOSE) console.log('[fwd] PUT', url, '(multipart,', fileBuffer.length, 'bytes)');
  const res = await fetch(url, {
    method: 'PUT',
    headers: Object.assign({ 'Authorization': 'Bearer ' + token }, fd.getHeaders()),
    body: fd
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch(_){ data = { raw: txt }; }
  return { status: res.status, ok: res.ok, data };
}

// ──────── Routes ───────────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    proxy: 'investran-diu-proxy',
    investranConfigured: !!(BASE_URL && CLIENT_ID && CLIENT_SECRET),
    investranBase: BASE_URL || null,
    allowedOrigins: ALLOWED_ORIGINS,
    tokenCached: !!_token
  });
});

// 1. Create DIU import job
app.post('/api/diu/jobs', async (req, res) => {
  try {
    const body = {
      template: req.body.template || DEFAULT_TEMPLATE,
      name:     req.body.name || ('LoanModuleV3-' + Date.now()),
      metadata: req.body.metadata || {}
    };
    const r = await forwardJSON('POST', '/dataimport/jobs', body);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, jobId: r.data.jobId || r.data.id, raw: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// 2. Upload the filled DIU workbook (multipart)
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });
app.post('/api/diu/jobs/:id/files', upload.single('file'), async (req, res) => {
  try {
    if(!req.file) return res.status(400).json({ ok:false, error: 'multipart field "file" required' });
    const r = await forwardMultipart('/dataimport/jobs/' + req.params.id + '/files',
      req.file.buffer, req.file.originalname || 'upload.xlsx', req.file.mimetype);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, fileId: r.data.fileId || r.data.id, sizeBytes: req.file.size, raw: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// 3. Load — parse the uploaded file into Investran's staging tables
app.post('/api/diu/jobs/:id/load', async (req, res) => {
  try {
    const r = await forwardJSON('POST', '/dataimport/jobs/' + req.params.id + '/load', req.body || {});
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, processId: r.data.processId || r.data.id, raw: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// 4. Validate — chart of accounts + FK resolution
app.post('/api/diu/jobs/:id/validate', async (req, res) => {
  try {
    const r = await forwardJSON('POST', '/dataimport/jobs/' + req.params.id + '/validate', req.body || {});
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({
      ok: true,
      passed: r.data.passed !== false,
      errors: r.data.errors || [],
      warnings: r.data.warnings || [],
      raw: r.data
    });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// 5. Commit — push into sub-ledger
app.post('/api/diu/jobs/:id/commit', async (req, res) => {
  try {
    const r = await forwardJSON('POST', '/dataimport/jobs/' + req.params.id + '/commit', req.body || {});
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({
      ok: true,
      batchId: r.data.batchId || r.data.id,
      status: r.data.status || 'COMMITTED',
      rowsPosted: r.data.rowsPosted || r.data.rows || null,
      raw: r.data
    });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// 6. Confirm — fetch the resulting processes / feedback
app.get('/api/diu/jobs/:id/processes', async (req, res) => {
  try {
    const r = await forwardJSON('GET', '/dataimport/jobs/' + req.params.id + '/processes', null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, processes: r.data.processes || r.data || [], raw: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// Notice email delivery (Phase 2A)
// ═══════════════════════════════════════════════════════════════════════
// POST /api/notice/send — send a notice email via SMTP (nodemailer).
//
// Body: {
//   to: [{email, name}],  cc: [{email, name}],
//   subject: 'string',
//   body: 'plain text',   html: 'optional html body',
//   attachments: [{ filename, content: 'base64', contentType }]
// }
//
// Env for SMTP (all required to enable this endpoint):
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE ('true' for 465),
//   SMTP_USER, SMTP_PASS, SMTP_FROM (default From address)
//
// Reply: { ok:true, messageId, accepted:[...], rejected:[...] } on success,
//        { ok:false, reason } on failure.
// GET /api/notice/status returns { smtpConfigured: bool } so the client can
// pick smtp vs mailto fallback without probing.
const SMTP_HOST   = process.env.SMTP_HOST || '';
const SMTP_PORT   = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER   = process.env.SMTP_USER || '';
const SMTP_PASS   = process.env.SMTP_PASS || '';
const SMTP_FROM   = process.env.SMTP_FROM || SMTP_USER;
const SMTP_CONFIGURED = !!(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM);

// Lazy require so the app runs even when nodemailer isn't installed.
let _nodemailer = null;
function nm(){
  if(_nodemailer === null){
    try { _nodemailer = require('nodemailer'); }
    catch(err){ console.warn('[email] nodemailer not installed — install with `npm i nodemailer` inside server/'); _nodemailer = false; }
  }
  return _nodemailer;
}

let _transporter = null;
function transporter(){
  if(!_transporter && SMTP_CONFIGURED && nm()){
    _transporter = nm().createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return _transporter;
}

app.get('/api/notice/status', (req, res) => {
  res.json({
    ok: true,
    smtpConfigured: SMTP_CONFIGURED,
    smtpHost: SMTP_CONFIGURED ? SMTP_HOST : null,
    smtpFrom: SMTP_CONFIGURED ? SMTP_FROM : null
  });
});

app.post('/api/notice/send', async (req, res) => {
  try {
    const { to, cc, subject, body, html, attachments, from } = req.body || {};
    if(!Array.isArray(to) || !to.length) return res.status(400).json({ ok:false, reason:'to[] required' });
    if(!subject) return res.status(400).json({ ok:false, reason:'subject required' });
    if(!SMTP_CONFIGURED){
      return res.status(503).json({ ok:false, reason:'SMTP not configured — set SMTP_HOST/PORT/USER/PASS/FROM env vars, restart server' });
    }
    const t = transporter();
    if(!t) return res.status(500).json({ ok:false, reason:'nodemailer not available — run `npm i nodemailer` in server/' });

    // Format address for nodemailer: "Name <email>" if name provided
    const fmt = (r) => r.name ? '"' + String(r.name).replace(/"/g,'') + '" <' + r.email + '>' : r.email;
    // Decode base64 attachments — nodemailer accepts Buffer directly
    const nmAttachments = (Array.isArray(attachments) ? attachments : []).map(a => ({
      filename: a.filename || 'attachment',
      content: Buffer.from(a.content || '', 'base64'),
      contentType: a.contentType || 'application/octet-stream'
    }));

    const info = await t.sendMail({
      from: from || SMTP_FROM,
      to: to.map(fmt).join(', '),
      cc: Array.isArray(cc) && cc.length ? cc.map(fmt).join(', ') : undefined,
      subject,
      text: body || '',
      html: html || undefined,
      attachments: nmAttachments
    });
    res.json({
      ok: true, messageId: info.messageId,
      accepted: info.accepted || [], rejected: info.rejected || [],
      response: info.response
    });
  } catch(err){
    console.error('[email] send failed:', err);
    res.status(500).json({ ok:false, reason: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// AI Document Extraction — Phase 1 (ongoing notices workflow)
// ═══════════════════════════════════════════════════════════════════════
// POST /api/extract/notice
//   Body: multipart/form-data with
//     file: (PDF binary)
//     deal_hint: optional deal_code / borrower name to help matching
//     notice_type_hint: optional 'interest'|'principal'|'fee'|'rate_reset'|'drawdown'|'other'
//
//   Runs Claude vision on each page, returns extracted structured JSON:
//     {
//       ok: true,
//       extraction: { notice_type, reference, effective_date, amount, currency,
//                     rate, breakdown, borrower_hint, deal_hint, notes,
//                     confidence, source_pages, field_confidence: {...} }
//       model: 'claude-...',
//       tokens: { input, output },
//       elapsed_ms: N
//     }
//
// Falls back to a mock extraction (for UI testing) if ANTHROPIC_API_KEY not set.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL   || 'claude-opus-4-8';
const AI_CONFIGURED     = !!ANTHROPIC_API_KEY;

// Prompt template — one strict schema, one shot.
// The model must return ONLY the JSON object (no prose) so the endpoint can
// parse without stripping markdown fences etc.
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

// Deterministic mock so the UI/import loop can be tested without an API key
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
    breakdown: { note: 'Mock extraction — set ANTHROPIC_API_KEY on the server for real AI extraction.' },
    notes: 'Mock interest notice generated because ANTHROPIC_API_KEY is not configured on the server.',
    confidence: 0.5,
    field_confidence: { reference: 0.5, amount: 0.5, effective_date: 0.5 },
    source_pages: [1]
  };
}

// Multer memory storage for PDF upload (we don't persist server-side; we forward
// the bytes straight to Claude and let the client push the doc to Supabase Storage)
const extractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }   // 25 MB — plenty for notices
});

app.get('/api/extract/status', (req, res) => {
  res.json({
    ok: true,
    aiConfigured: AI_CONFIGURED,
    model: AI_CONFIGURED ? ANTHROPIC_MODEL : null,
    fallback: AI_CONFIGURED ? null : 'mock-extraction (UI-testable without API key)'
  });
});

app.post('/api/extract/notice', extractUpload.single('file'), async (req, res) => {
  const start = Date.now();
  try {
    if(!req.file){ return res.status(400).json({ ok:false, reason:'file (PDF) required' }); }
    const dealHint = req.body.deal_hint || req.body.dealHint || null;
    const noticeTypeHint = req.body.notice_type_hint || req.body.noticeTypeHint || null;

    // Mock path — server-side dev/demo without a real API key
    if(!AI_CONFIGURED){
      return res.json({
        ok: true, mock: true, elapsed_ms: 50,
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

    // Model can sometimes wrap the JSON in ```json fences — strip them
    let cleaned = textOut.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    let extraction;
    try { extraction = JSON.parse(cleaned); }
    catch(parseErr){
      // Last-ditch: find the first { and last } and try again
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

// ──────── Boot ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('────────────────────────────────────────────');
  console.log('Investran DIU Proxy listening on port', PORT);
  console.log('  Investran base:    ', BASE_URL || '(not configured)');
  console.log('  Credentials set:   ', !!(CLIENT_ID && CLIENT_SECRET));
  console.log('  Allowed origins:   ', ALLOWED_ORIGINS.join(', '));
  console.log('  Default template:  ', DEFAULT_TEMPLATE);
  console.log('  SMTP configured:   ', SMTP_CONFIGURED ? (SMTP_HOST + ':' + SMTP_PORT) : 'no — /api/notice/send disabled');
  console.log('  AI extract:        ', AI_CONFIGURED ? (ANTHROPIC_MODEL) : 'mock mode (no ANTHROPIC_API_KEY)');
  console.log('  Health check:      ', 'http://localhost:' + PORT + '/healthz');
  console.log('────────────────────────────────────────────');
  if(!BASE_URL || !CLIENT_ID || !CLIENT_SECRET){
    console.warn('⚠  Some Investran settings are blank. Edit server/.env and restart.');
  }
});
