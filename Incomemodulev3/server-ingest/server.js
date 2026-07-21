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

// ═════════════════════════════════════════════════════════════════════
// Borrower Financials extraction
// ═════════════════════════════════════════════════════════════════════
// POST /api/extract/borrower-financials
//   multipart file (PDF) + optional deal_hint + optional period_hint
//
// Returns structured JSON: balance sheet, income statement, cash flow,
// per-field confidence. Client computes covenant KPIs from these fields.

function buildFinancialsExtractionPrompt(dealHint, periodHint){
  return `You are extracting a borrower's financial statements from a private-credit lending report (quarterly / annual / management accounts).

Return ONLY a JSON object matching this schema — no prose, no markdown:

{
  "borrower_name": "borrower / issuer name as it appears (string) or null",
  "as_of_date": "YYYY-MM-DD — the period END date (e.g. 2026-03-31 for Q1 2026)",
  "period_type": "monthly" | "quarterly" | "semi_annual" | "annual" | "ttm" | "ytd" | "custom",
  "currency": "3-letter ISO code (USD/EUR/GBP/etc)" or null,
  "fiscal_year_end": "YYYY-MM-DD if stated, else null",
  "reporter_note": "e.g. 'unaudited management accounts', 'audited by KPMG', etc.",

  "balance_sheet": {
    "total_assets": <number>,
    "current_assets": <number>,
    "cash": <number>,
    "accounts_receivable": <number>,
    "inventory": <number>,
    "fixed_assets": <number>,
    "total_liabilities": <number>,
    "current_liabilities": <number>,
    "accounts_payable": <number>,
    "short_term_debt": <number>,
    "long_term_debt": <number>,
    "total_debt": <number>,
    "total_equity": <number>
  },

  "income_statement": {
    "revenue": <number>,
    "cogs": <number>,
    "gross_profit": <number>,
    "operating_expenses": <number>,
    "ebitda": <number>,
    "depreciation_amort": <number>,
    "ebit": <number>,
    "interest_expense": <number>,
    "tax_expense": <number>,
    "net_income": <number>
  },

  "cash_flow": {
    "operating_cash_flow": <number>,
    "capex": <number>,
    "free_cash_flow": <number>,
    "principal_payments": <number>
  },

  "notes": "one-sentence summary of period performance, e.g. 'Q1 revenue up 8% YoY, EBITDA margin compressed 200bps'",
  "confidence": <overall 0..1>,
  "field_confidence": { "balance_sheet.total_assets": 0.95, ... },
  "source_pages": [1,2]
}

Rules:
- All monetary amounts as raw numbers, no commas, no currency symbols, no scaling (i.e. $2.5M → 2500000)
- If reported in thousands or millions, convert to raw units — do NOT preserve K/M abbreviations
- For any field not present in the document, use null and set field_confidence to 0
- Confidence per field is your honest estimate of extraction accuracy
- If EBITDA is not explicitly reported, compute it from Net Income + Interest + Tax + Depreciation & Amortization and note that in "notes"
${dealHint    ? `\nContext hint — the user pre-selected this deal / borrower: "${dealHint}". Bias interpretation accordingly.` : ''}
${periodHint  ? `\nContext hint — the user thinks this is a "${periodHint}" report.` : ''}`;
}

function mockFinancialsExtraction(dealHint){
  return {
    borrower_name: dealHint || 'Mock Borrower Inc.',
    as_of_date: new Date().toISOString().slice(0,10),
    period_type: 'quarterly',
    currency: 'USD',
    fiscal_year_end: null,
    reporter_note: 'MOCK — set ANTHROPIC_API_KEY on server-ingest for real extraction',
    balance_sheet: {
      total_assets: 250_000_000, current_assets: 80_000_000, cash: 25_000_000,
      accounts_receivable: 35_000_000, inventory: 20_000_000, fixed_assets: 170_000_000,
      total_liabilities: 180_000_000, current_liabilities: 40_000_000,
      accounts_payable: 25_000_000, short_term_debt: 15_000_000, long_term_debt: 120_000_000,
      total_debt: 135_000_000, total_equity: 70_000_000
    },
    income_statement: {
      revenue: 50_000_000, cogs: 32_000_000, gross_profit: 18_000_000,
      operating_expenses: 12_000_000, ebitda: 8_000_000, depreciation_amort: 2_000_000,
      ebit: 6_000_000, interest_expense: 3_200_000, tax_expense: 700_000, net_income: 2_100_000
    },
    cash_flow: {
      operating_cash_flow: 6_500_000, capex: 3_000_000, free_cash_flow: 3_500_000,
      principal_payments: 2_500_000
    },
    notes: 'Mock extraction — computed DSCR ≈ 1.40x, ICR ≈ 2.50x, leverage ≈ 4.22x',
    confidence: 0.5,
    field_confidence: { 'income_statement.ebitda': 0.5, 'balance_sheet.total_debt': 0.5 },
    source_pages: [1]
  };
}

app.post('/api/extract/borrower-financials', upload.single('file'), async (req, res) => {
  const start = Date.now();
  try {
    if(!req.file){ return res.status(400).json({ ok:false, reason:'file (PDF) required' }); }
    const dealHint   = req.body.deal_hint || req.body.dealHint || null;
    const periodHint = req.body.period_hint || req.body.periodHint || null;

    if(LOG_VERBOSE){
      console.log('[extract:financials]', { file: req.file.originalname, size: req.file.size, dealHint, periodHint });
    }

    if(!AI_CONFIGURED){
      return res.json({
        ok:true, mock:true, elapsed_ms: Date.now() - start,
        model: 'mock-extraction',
        extraction: mockFinancialsExtraction(dealHint),
        tokens: { input:0, output:0 }
      });
    }

    const b64 = req.file.buffer.toString('base64');
    const body = {
      model: ANTHROPIC_MODEL,
      // Financials are field-heavy; give the model more headroom than notices
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: buildFinancialsExtractionPrompt(dealHint, periodHint) }
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
      console.error('[extract:financials] Anthropic error:', r.status, err);
      return res.status(r.status).json({ ok:false, reason:'anthropic api: ' + err.slice(0,300) });
    }
    const data = await r.json();
    const textOut = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    let cleaned = textOut.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    let extraction;
    try { extraction = JSON.parse(cleaned); }
    catch(parseErr){
      const first = cleaned.indexOf('{');
      const last  = cleaned.lastIndexOf('}');
      if(first >= 0 && last > first){
        try { extraction = JSON.parse(cleaned.slice(first, last+1)); }
        catch(e){ return res.status(500).json({ ok:false, reason:'unparseable JSON: ' + textOut.slice(0,300) }); }
      } else {
        return res.status(500).json({ ok:false, reason:'no JSON in model output: ' + textOut.slice(0,200) });
      }
    }
    return res.json({
      ok: true, extraction,
      model: ANTHROPIC_MODEL,
      tokens: data.usage || {},
      elapsed_ms: Date.now() - start
    });
  } catch(err){
    console.error('[extract:financials] threw:', err);
    return res.status(500).json({ ok:false, reason: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════
// Credit Agreement extraction (Phase 2)
// ═════════════════════════════════════════════════════════════════════
// POST /api/extract/credit-agreement
//   multipart file (PDF) + optional borrower_hint
//
// Returns parties, facility, interest, amort, fees, covenants, prepay
// triggers, EoD. Client uses this to populate the Builder Stage 0 for a
// brand-new deal via "Create Deal from CA".

function buildCreditAgreementPrompt(borrowerHint){
  return `You are extracting the salient economic and legal terms from a private-credit Credit Agreement (also called a facility agreement, loan agreement, term loan agreement).

Return ONLY a JSON object matching this schema — no prose, no markdown, no code fences:

{
  "borrower_name":        "borrower / issuer legal name" or null,
  "borrower_entity":      "borrower legal form + jurisdiction (e.g. 'Acme Holdings LLC (Delaware)')" or null,
  "lead_arranger":        "lead arranger / mandated lead arranger" or null,
  "administrative_agent": "administrative agent" or null,
  "lenders":     [ { "name": "…", "commitment": <number>, "share_pct": <0..100> } ],
  "guarantors":  [ { "name": "…", "type": "parent" | "subsidiary" | "other" } ],

  "facility_name": "facility name as shown (e.g. 'Term Loan B Facility')" or null,
  "facility_type": "term_loan_a" | "term_loan_b" | "revolver" | "delayed_draw_tl" | "bridge" | "second_lien" | "other",
  "principal":     <total facility principal, raw number>,
  "currency":      "3-letter ISO (USD/EUR/GBP/…)",
  "effective_date":"YYYY-MM-DD (closing date)",
  "maturity_date": "YYYY-MM-DD",
  "purpose":       "one-line use of proceeds",

  "base_rate":       "SOFR" | "SONIA" | "EURIBOR" | "TERM_SOFR" | "FIXED" | "PRIME",
  "base_rate_tenor": "1M" | "3M" | "6M" or null,
  "margin_bps":      <initial / lowest margin in basis points>,
  "margin_ratchet":  [ { "test": "leverage <= 4.0x", "leverage_lte": 4.0, "margin_bps": 375 }, … ],
  "day_count":       "30/360" | "ACT/365" | "ACT/360",
  "rate_floor_bps":  <bps or null>,

  "amort_type":     "bullet" | "straight_line" | "custom" | "none",
  "amort_schedule": [ { "date": "YYYY-MM-DD", "amount_pct": <0..100> } ]  // omit for bullet/none

  "fees": [
    { "name": "Arrangement Fee", "mode": "flat" | "rate_of_principal" | "rate_of_commitment",
      "amount": <number> or null, "bps": <number> or null,
      "frequency": "one_time" | "monthly" | "quarterly" | "semi_annual" | "annual",
      "treatment": "eir_amortised" | "immediate_income" | "capitalised" }
  ],

  "covenants": [
    { "name": "Total Leverage Ratio", "kpi_metric": "leverageRatio" | "netLeverageRatio" | "interestCoverage" | "dscr" | "fccr" | "minLiquidity" | "esgScore" | "none",
      "direction": "min" | "max" | "gte" | "lte",
      "threshold": <number>,
      "step_downs": [ { "effective": "YYYY-MM-DD", "threshold": <number> } ],
      "test_frequency": "quarterly" | "semi_annual" | "annual",
      "consequences": [ "margin_stepup:+50bps", "SICR", "mandatoryPrepayment", "waiver_required" ]
    }
  ],

  "prepay_triggers": [
    { "type": "change_of_control" | "asset_sale" | "insurance_proceeds" | "debt_incurrence" | "excess_cash_flow" | "ipo" | "other",
      "threshold_pct": <sweep %>, "description": "one-line" }
  ],

  "events_of_default": [
    "Payment default (grace period 3 business days)",
    "Cross-default > $10M",
    …
  ],

  "governing_law": "e.g. 'New York'" or null,

  "notes": "one-sentence summary, e.g. 'Term Loan B, 5-year bullet, SOFR+375bps stepping to +300bps at 4.0x leverage, 3 maintenance covenants'",
  "confidence": <overall 0..1>,
  "field_confidence": { "principal": 0.98, "margin_bps": 0.95, "covenants": 0.9, … },
  "source_pages": [1, 5, 12]
}

Rules:
- Numbers as raw values (principal in units, not millions).
- Dates in YYYY-MM-DD.
- If a covenant is defined but its KPI does not map to the enum, use "none" for kpi_metric and describe the metric in the covenant name.
- If step-downs / step-ups are described in prose (e.g. "steps to 4.5x on the second anniversary"), decode them into concrete rows with the effective date.
- Omit fields you cannot verify. Set field_confidence accordingly.
- Do NOT fabricate covenant thresholds or margin schedules — leave null with confidence 0 if not clearly stated.
${borrowerHint ? `\nContext hint — the user thinks this is for borrower "${borrowerHint}".` : ''}`;
}

function mockCreditAgreementExtraction(borrowerHint){
  return {
    borrower_name: borrowerHint || 'Mock Term Loan Borrower Corp',
    borrower_entity: (borrowerHint || 'Mock Borrower') + ' LLC (Delaware)',
    lead_arranger: 'Mock Bank & Trust',
    administrative_agent: 'Mock Agency Services LLC',
    lenders: [ { name: 'Mock Fund I LP', commitment: 100_000_000, share_pct: 100 } ],
    guarantors: [ { name: (borrowerHint || 'Mock') + ' Holdings LP', type: 'parent' } ],
    facility_name: 'Term Loan B Facility',
    facility_type: 'term_loan_b',
    principal: 100_000_000,
    currency: 'USD',
    effective_date: '2026-01-15',
    maturity_date: '2031-01-15',
    purpose: 'General corporate purposes and refinancing of existing indebtedness',
    base_rate: 'TERM_SOFR', base_rate_tenor: '3M',
    margin_bps: 375,
    margin_ratchet: [
      { test: 'leverage > 4.5x', leverage_gt: 4.5, margin_bps: 400 },
      { test: 'leverage <= 4.5x', leverage_lte: 4.5, margin_bps: 375 },
      { test: 'leverage <= 4.0x', leverage_lte: 4.0, margin_bps: 350 }
    ],
    day_count: 'ACT/360',
    rate_floor_bps: 0,
    amort_type: 'bullet',
    fees: [
      { name: 'Arrangement Fee', mode: 'rate_of_principal', bps: 200, frequency: 'one_time', treatment: 'eir_amortised' },
      { name: 'Agency Fee',      mode: 'flat', amount: 50_000, frequency: 'annual', treatment: 'immediate_income' }
    ],
    covenants: [
      { name: 'Total Leverage Ratio', kpi_metric: 'leverageRatio', direction: 'max', threshold: 5.0,
        step_downs: [ { effective: '2028-01-15', threshold: 4.5 } ], test_frequency: 'quarterly',
        consequences: ['margin_stepup:+50bps'] },
      { name: 'Interest Coverage Ratio', kpi_metric: 'interestCoverage', direction: 'min', threshold: 2.5,
        step_downs: [], test_frequency: 'quarterly', consequences: [] },
      { name: 'Minimum Liquidity', kpi_metric: 'minLiquidity', direction: 'min', threshold: 5_000_000,
        step_downs: [], test_frequency: 'quarterly', consequences: [] }
    ],
    prepay_triggers: [
      { type: 'change_of_control', threshold_pct: 100, description: '100% of Loans + accrued interest' },
      { type: 'asset_sale',        threshold_pct: 100, description: 'Net proceeds > $5M subject to 12-month reinvestment' },
      { type: 'excess_cash_flow',  threshold_pct: 50,  description: '50% sweep, stepping to 25% at ≤ 3.5x leverage, 0% at ≤ 3.0x' }
    ],
    events_of_default: [
      'Payment default (3 business day grace)',
      'Financial covenant breach (30 day cure)',
      'Cross-default to indebtedness > $10M',
      'Insolvency / bankruptcy',
      'Change of control (without lender consent)',
      'Material adverse change'
    ],
    governing_law: 'New York',
    notes: 'Mock CA extraction — Term Loan B, 5-year bullet, SOFR+375bps with 2 step-downs. Set ANTHROPIC_API_KEY on server-ingest for real extraction.',
    confidence: 0.5,
    field_confidence: { principal: 0.5, covenants: 0.5, margin_bps: 0.5 },
    source_pages: [1]
  };
}

app.post('/api/extract/credit-agreement', upload.single('file'), async (req, res) => {
  const start = Date.now();
  try {
    if(!req.file){ return res.status(400).json({ ok:false, reason:'file (PDF) required' }); }
    const borrowerHint = req.body.borrower_hint || req.body.borrowerHint || null;

    if(LOG_VERBOSE){
      console.log('[extract:ca]', { file: req.file.originalname, size: req.file.size, borrowerHint });
    }

    if(!AI_CONFIGURED){
      return res.json({
        ok:true, mock:true, elapsed_ms: Date.now() - start,
        model: 'mock-extraction',
        extraction: mockCreditAgreementExtraction(borrowerHint),
        tokens: { input:0, output:0 }
      });
    }

    const b64 = req.file.buffer.toString('base64');
    const body = {
      model: ANTHROPIC_MODEL,
      // CAs are the largest / densest document — give the model the most headroom
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: buildCreditAgreementPrompt(borrowerHint) }
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
      console.error('[extract:ca] Anthropic error:', r.status, err);
      return res.status(r.status).json({ ok:false, reason:'anthropic api: ' + err.slice(0,300) });
    }
    const data = await r.json();
    const textOut = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    let cleaned = textOut.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    let extraction;
    try { extraction = JSON.parse(cleaned); }
    catch(parseErr){
      const first = cleaned.indexOf('{');
      const last  = cleaned.lastIndexOf('}');
      if(first >= 0 && last > first){
        try { extraction = JSON.parse(cleaned.slice(first, last+1)); }
        catch(e){ return res.status(500).json({ ok:false, reason:'unparseable JSON: ' + textOut.slice(0,300) }); }
      } else {
        return res.status(500).json({ ok:false, reason:'no JSON in model output: ' + textOut.slice(0,200) });
      }
    }
    return res.json({
      ok: true, extraction,
      model: ANTHROPIC_MODEL,
      tokens: data.usage || {},
      elapsed_ms: Date.now() - start
    });
  } catch(err){
    console.error('[extract:ca] threw:', err);
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
  console.log('  Endpoints:       ', 'notice · borrower-financials · credit-agreement');
  console.log('════════════════════════════════════════════');
});
