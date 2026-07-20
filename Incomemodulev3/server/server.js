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

// NOTE: AI document extraction has been split into a standalone service.
// See ../server-ingest/ (port 4319). This proxy focuses on Investran DIU +
// SMTP delivery; the ingestion service focuses on PDF → structured data.
// The client stores each service's URL separately in DB Settings.

// ──────── Boot ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('────────────────────────────────────────────');
  console.log('Investran DIU Proxy listening on port', PORT);
  console.log('  Investran base:    ', BASE_URL || '(not configured)');
  console.log('  Credentials set:   ', !!(CLIENT_ID && CLIENT_SECRET));
  console.log('  Allowed origins:   ', ALLOWED_ORIGINS.join(', '));
  console.log('  Default template:  ', DEFAULT_TEMPLATE);
  console.log('  SMTP configured:   ', SMTP_CONFIGURED ? (SMTP_HOST + ':' + SMTP_PORT) : 'no — /api/notice/send disabled');
  console.log('  AI extract:        ', 'moved to server-ingest/ (default port 4319)');
  console.log('  Health check:      ', 'http://localhost:' + PORT + '/healthz');
  console.log('────────────────────────────────────────────');
  if(!BASE_URL || !CLIENT_ID || !CLIENT_SECRET){
    console.warn('⚠  Some Investran settings are blank. Edit server/.env and restart.');
  }
});
