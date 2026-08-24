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
const { randomUUID } = require('crypto');

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

// DIU route prefix appended to BASE_URL. Investran serves this as
// `/api/DataImport/` — note the capital D and I. Several tenants front the
// API with a case-sensitive gateway, so a lowercase '/dataimport' 404s.
// Configurable because some deployments add a version segment
// (e.g. '/DataImport/v1'). Leading slash enforced, trailing slash stripped.
const DIU_PATH = ('/' + (process.env.INVESTRAN_DIU_PATH || '/DataImport')
  .replace(/^\/+/, '').replace(/\/+$/, ''));

// Report Wizard module. Per FIS's own API guide the modern PCS REST surface
// lives at <base>/ReportWizard/v1 with:
//   POST executions              → start a saved report
//   GET  executions/{id}/status  → pending | running | succeeded | error
//   GET  executions/{id}/result  → rows once succeeded
//   GET  lookups/{fieldId}       → lookup values (may serve reference data
//                                  directly, without needing a report)
// Same /api/<Module>/v1 shape as DataImport, so this is very likely correct —
// but it is NOT yet verified against the tenant. probe-modules.js checks it.
const RW_PATH = ('/' + (process.env.INVESTRAN_RW_PATH || '/ReportWizard/v1')
  .replace(/^\/+/, '').replace(/\/+$/, ''));

// ──────── Auth mode: static bearer JWT (FIS-issued) ─────────────────
// Some Investran tenants don't expose a client-credentials OAuth endpoint.
// Instead FIS issues a long-lived RS256 JWT (aud=investran-web-api, iss=
// login<N>.fisglobal.com/idp/Investran<ENV>) that the caller presents
// directly. That token also carries the tenant routing values Investran
// needs on every request:
//   Database    → which tenant DB to hit  (e.g. goldenliveuat)
//   Server      → backend instance         (e.g. v8wbsinvsq07l1)
//   accessToken → nested session token, sent as its own header
//
// If INVESTRAN_BEARER_TOKEN is set we use it verbatim and skip OAuth
// entirely. Otherwise we fall back to the client-credentials flow.
const BEARER_TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();
// These three can be supplied explicitly; when blank we read them from the
// JWT payload so operators only have to paste one value.
let TENANT_DATABASE     = (process.env.INVESTRAN_DATABASE || '').trim();
let TENANT_SERVER       = (process.env.INVESTRAN_SERVER || '').trim();
let TENANT_ACCESS_TOKEN = (process.env.INVESTRAN_ACCESS_TOKEN || '').trim();
// Header names vary by Investran build — override if your tenant differs.
const HDR_DATABASE     = process.env.INVESTRAN_HEADER_DATABASE     || 'X-Investran-Database';
const HDR_SERVER       = process.env.INVESTRAN_HEADER_SERVER       || 'X-Investran-Server';
const HDR_ACCESS_TOKEN = process.env.INVESTRAN_HEADER_ACCESSTOKEN  || 'X-Investran-AccessToken';

// Decode a JWT payload without verifying (we're not the audience — we just
// need the routing claims and the expiry for health reporting).
function decodeJwtPayload(tok){
  try {
    const part = String(tok).split('.')[1];
    if(!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(pad, 'base64').toString('utf8'));
  } catch(_){ return null; }
}

const BEARER_CLAIMS = BEARER_TOKEN ? decodeJwtPayload(BEARER_TOKEN) : null;
if(BEARER_CLAIMS){
  // Fill any routing value the operator didn't set explicitly.
  if(!TENANT_DATABASE     && BEARER_CLAIMS.Database)    TENANT_DATABASE     = BEARER_CLAIMS.Database;
  if(!TENANT_SERVER       && BEARER_CLAIMS.Server)      TENANT_SERVER       = BEARER_CLAIMS.Server;
  if(!TENANT_ACCESS_TOKEN && BEARER_CLAIMS.accessToken) TENANT_ACCESS_TOKEN = BEARER_CLAIMS.accessToken;
}

function bearerExpiryInfo(){
  if(!BEARER_CLAIMS || !BEARER_CLAIMS.exp) return { known: false };
  const expMs = BEARER_CLAIMS.exp * 1000;
  const msLeft = expMs - Date.now();
  return {
    known: true,
    expiresAt: new Date(expMs).toISOString(),
    daysLeft: Math.floor(msLeft / 86_400_000),
    expired: msLeft <= 0
  };
}

const AUTH_MODE = BEARER_TOKEN ? 'bearer' : (CLIENT_ID && CLIENT_SECRET ? 'oauth' : 'none');

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
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Trace-Id']
}));

// ──────── OAuth token cache ─────────────────────────────────────────
// Cache the access token + expiry. Refresh ~30s before expiry.
let _token = null;
let _tokenExpiresAt = 0;

async function getAccessToken(){
  const now = Date.now();
  // Static-bearer mode — no token endpoint involved. Warn (don't throw) when
  // the JWT is past its exp so the operator sees a clear reason for the 401
  // Investran will return.
  if(BEARER_TOKEN){
    const info = bearerExpiryInfo();
    if(info.known && info.expired){
      throw new Error('INVESTRAN_BEARER_TOKEN expired on ' + info.expiresAt +
                      ' — request a fresh token from your FIS administrator.');
    }
    if(info.known && info.daysLeft <= 3){
      console.warn('[auth] ⚠ bearer token expires in ' + info.daysLeft + ' day(s) — ' + info.expiresAt);
    }
    return BEARER_TOKEN;
  }
  if(_token && _tokenExpiresAt > now + 30_000) return _token;
  if(!CLIENT_ID || !CLIENT_SECRET){
    throw new Error('Investran auth not configured — set INVESTRAN_BEARER_TOKEN, or INVESTRAN_CLIENT_ID + INVESTRAN_CLIENT_SECRET, in .env');
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
// Tenant routing headers. Investran resolves the target database + backend
// instance from these; without them a technically-valid token still lands on
// the wrong tenant (or 400s). Only emitted when we actually have values.
function tenantHeaders(){
  const h = {};
  if(TENANT_DATABASE)     h[HDR_DATABASE]     = TENANT_DATABASE;
  if(TENANT_SERVER)       h[HDR_SERVER]       = TENANT_SERVER;
  if(TENANT_ACCESS_TOKEN) h[HDR_ACCESS_TOKEN] = TENANT_ACCESS_TOKEN;
  // Every DIU endpoint declares a REQUIRED `uuid` header. The spec says:
  // "Included for Code Connect compatability. The API will ignore this
  // value." — so the content is irrelevant but its presence is not; omit it
  // and the request is rejected before it reaches the handler. Must match
  // the canonical 8-4-4-4-12 pattern. Fresh per request so it doubles as a
  // correlation id in Investran's logs.
  h['uuid'] = randomUUID();
  return h;
}

async function forwardJSON(method, path, body){
  if(!BASE_URL) throw new Error('INVESTRAN_BASE_URL not configured');
  const token = await getAccessToken();
  const url = BASE_URL + path;
  if(LOG_VERBOSE) console.log('[fwd]', method, url, '· db=' + (TENANT_DATABASE || 'n/a'));
  const res = await fetch(url, {
    method,
    headers: Object.assign({
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }, tenantHeaders()),
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
    headers: Object.assign({ 'Authorization': 'Bearer ' + token }, fd.getHeaders(), tenantHeaders()),
    body: fd
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch(_){ data = { raw: txt }; }
  return { status: res.status, ok: res.ok, data };
}

// ──────── Routes ───────────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  const exp = bearerExpiryInfo();
  res.json({
    ok: true,
    proxy: 'investran-diu-proxy',
    // True when we have a base URL AND some usable credential.
    investranConfigured: !!(BASE_URL && (BEARER_TOKEN || (CLIENT_ID && CLIENT_SECRET))),
    investranBase: BASE_URL || null,
    // Full DIU root the proxy will actually call — makes a 404 from a wrong
    // path/casing obvious in the health payload instead of at post time.
    diuRoot: BASE_URL ? (BASE_URL + DIU_PATH) : null,
    rwRoot:  BASE_URL ? (BASE_URL + RW_PATH)  : null,
    allowedOrigins: ALLOWED_ORIGINS,
    authMode: AUTH_MODE,                        // 'bearer' | 'oauth' | 'none'
    tokenCached: AUTH_MODE === 'bearer' ? true : !!_token,
    // Bearer-mode diagnostics — surfaced on the DIU chip in the app so the
    // user gets a warning before the token silently expires.
    tokenExpiresAt:  exp.known ? exp.expiresAt : null,
    tokenDaysLeft:   exp.known ? exp.daysLeft  : null,
    tokenExpired:    exp.known ? exp.expired   : false,
    // Tenant routing (never echoes the secrets themselves)
    tenant: {
      database:        TENANT_DATABASE || null,
      server:          TENANT_SERVER || null,
      accessTokenSet:  !!TENANT_ACCESS_TOKEN,
      audience:        (BEARER_CLAIMS && BEARER_CLAIMS.aud) || null,
      issuer:          (BEARER_CLAIMS && BEARER_CLAIMS.iss) || null,
      subject:         (BEARER_CLAIMS && BEARER_CLAIMS.sub) || null
    },
    defaultTemplate: DEFAULT_TEMPLATE
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DIU endpoints — built against the published OpenAPI spec
//   GET <base>/swagger/v1/swagger.json  ·  "Investran: Data Import 1.0.0"
//
// Real lifecycle (differs from the earlier guessed implementation):
//   1. POST /file                        → upload workbook, returns FileDto{Id}
//   2. POST /data-import-job             → create job referencing that File
//      (or /data-import-job-from-template when a TemplateId is supplied)
//   3. POST /process-information/validate  {DataImportJobId, ScheduleTime}
//   4. POST /process-information/load      {DataImportJobId, ScheduleTime}
//   5. GET  /process-information/{id}/summary | /feedback
//
// There is NO commit step — load is terminal. Field names are PascalCase.
// Discovery: GET /domain, GET /entities, GET /data-import-job/metadata.
// ═══════════════════════════════════════════════════════════════════════

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

// ── 1 · Upload the workbook ───────────────────────────────────────────
// POST /file is standalone — the file is uploaded FIRST, then referenced
// by Id when the job is created. (The old code had this backwards, posting
// to /jobs/:id/files after job creation.)
app.post('/api/diu/file', upload.single('file'), async (req, res) => {
  try {
    if(!req.file) return res.status(400).json({ ok:false, error: 'multipart field "file" required' });
    const r = await forwardMultipart(DIU_PATH + '/file',
      req.file.buffer, req.file.originalname || 'upload.xlsx', req.file.mimetype);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    const fileId = r.data && (r.data.Id != null ? r.data.Id : r.data.id);
    res.json({ ok:true, fileId, file: r.data, sizeBytes: req.file.size });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ── 2 · Create the import job ─────────────────────────────────────────
// Body per ExcelDataImportJobDto. Accepts either a plain job (DomainId +
// File) or a template-derived one (TemplateId), routing to the correct
// endpoint automatically.
app.post('/api/diu/jobs', async (req, res) => {
  try {
    const b = req.body || {};
    if(b.fileId == null && !b.File){
      return res.status(400).json({ ok:false, error: 'fileId is required — upload via POST /api/diu/file first' });
    }
    const jobDto = {
      Name:       b.name || ('PCS-LoanModule-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'')),
      File:       b.File || { Id: b.fileId },
      DomainId:   b.domainId != null ? b.domainId : -1,
      FileOptions: b.fileOptions || { SkippedRows: 0 },
      ImportJobOptions: b.importJobOptions || {
        SkipOnError:            false,
        AllowUpdates:           true,
        AddNewLookupValues:     false,
        IgnoreEmptyFields:      true,
        IgnoreCriticalWarnings: false
      }
    };
    if(b.contactId != null) jobDto.ContactId = b.contactId;
    if(Array.isArray(b.fileSheets)) jobDto.FileSheets = b.fileSheets;

    // Template-derived jobs use a different endpoint + carry TemplateId.
    let path = DIU_PATH + '/data-import-job';
    if(b.templateId != null){
      jobDto.TemplateId = b.templateId;
      path = DIU_PATH + '/data-import-job-from-template';
    }

    const r = await forwardJSON('POST', path, jobDto);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    const jobId = r.data && (r.data.Id != null ? r.data.Id : r.data.id);
    res.json({ ok:true, jobId, job: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ── 3 · Validate ──────────────────────────────────────────────────────
// Schedules a validation process. Returns a processId to poll, NOT a
// synchronous pass/fail — the old implementation assumed the latter.
app.post('/api/diu/jobs/:id/validate', async (req, res) => {
  try {
    const body = {
      DataImportJobId: parseInt(req.params.id, 10),
      ScheduleTime:    (req.body && req.body.scheduleTime) || new Date().toISOString()
    };
    const r = await forwardJSON('POST', DIU_PATH + '/process-information/validate', body);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    const processId = r.data && (r.data.Id != null ? r.data.Id : r.data.ProcessId);
    res.json({ ok:true, processId, process: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ── 4 · Load (terminal — this is the post) ────────────────────────────
app.post('/api/diu/jobs/:id/load', async (req, res) => {
  try {
    const body = {
      DataImportJobId: parseInt(req.params.id, 10),
      ScheduleTime:    (req.body && req.body.scheduleTime) || new Date().toISOString()
    };
    const r = await forwardJSON('POST', DIU_PATH + '/process-information/load', body);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    const processId = r.data && (r.data.Id != null ? r.data.Id : r.data.ProcessId);
    res.json({ ok:true, processId, process: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ── 5 · Process status / feedback / summary ───────────────────────────
app.get('/api/diu/processes/:processId', async (req, res) => {
  try {
    const r = await forwardJSON('GET', DIU_PATH + '/process-information/' + req.params.processId, null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, process: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/diu/processes/:processId/feedback', async (req, res) => {
  try {
    const q = [];
    if(req.query.pageNumber) q.push('pageNumber=' + encodeURIComponent(req.query.pageNumber));
    if(req.query.pageSize)   q.push('pageSize='   + encodeURIComponent(req.query.pageSize));
    const path = DIU_PATH + '/process-information/' + req.params.processId + '/feedback'
               + (q.length ? '?' + q.join('&') : '');
    const r = await forwardJSON('GET', path, null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, feedback: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/diu/processes/:processId/summary', async (req, res) => {
  try {
    const r = await forwardJSON('GET', DIU_PATH + '/process-information/' + req.params.processId + '/summary', null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, summary: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.put('/api/diu/processes/:processId/cancel', async (req, res) => {
  try {
    const r = await forwardJSON('PUT', DIU_PATH + '/process-information/' + req.params.processId + '/cancel', {});
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, process: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ── 6 · Job read / delete + processes list ────────────────────────────
app.get('/api/diu/jobs/:id', async (req, res) => {
  try {
    const r = await forwardJSON('GET', DIU_PATH + '/data-import-job/' + req.params.id, null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, job: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/diu/jobs/:id/processes', async (req, res) => {
  try {
    const r = await forwardJSON('GET', DIU_PATH + '/data-import-job/' + req.params.id + '/processes', null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, processes: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.delete('/api/diu/jobs/:id', async (req, res) => {
  try {
    const r = await forwardJSON('DELETE', DIU_PATH + '/data-import-job/' + req.params.id, null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ── 7 · Discovery — domains, entities, field metadata ─────────────────
// Needed to resolve DomainId and validate the workbook shape before upload.
app.get('/api/diu/domains', async (req, res) => {
  try {
    // Default to import=true — we only care about domains we can import into.
    const imp = req.query.import === 'false' ? 'false' : 'true';
    const r = await forwardJSON('GET', DIU_PATH + '/domain?import=' + imp, null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, domains: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/diu/entities', async (req, res) => {
  try {
    const r = await forwardJSON('GET', DIU_PATH + '/entities', null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, entities: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/diu/metadata', async (req, res) => {
  try {
    const name = req.query.entityName;
    if(!name) return res.status(400).json({ ok:false, error: 'entityName query parameter is required' });
    const r = await forwardJSON('GET', DIU_PATH + '/data-import-job/metadata?entityName=' + encodeURIComponent(name), null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, metadata: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// Report Wizard (PCS API) — reference-data extraction
// ═══════════════════════════════════════════════════════════════════════
// Used by the PCS Sync page to pull Investran master data so DIU lookups
// resolve. Two access paths:
//   · /lookups/{fieldId}  — direct lookup values, no report needed
//   · executions          — run a saved RW report, poll, fetch result
// ═══════════════════════════════════════════════════════════════════════

// Direct lookup values by Investran FieldID (e.g. 15010 = GL Account).
// If this works we may not need RW reports for the simple lookups at all.
app.get('/api/rw/lookups/:fieldId', async (req, res) => {
  try {
    const q = req.query.nameContains
      ? '?nameContains=' + encodeURIComponent(req.query.nameContains) : '';
    const r = await forwardJSON('GET', RW_PATH + '/lookups/' + encodeURIComponent(req.params.fieldId) + q, null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    const rows = Array.isArray(r.data) ? r.data
               : (r.data && Array.isArray(r.data.data) ? r.data.data
               : (r.data && Array.isArray(r.data.value) ? r.data.value : []));
    res.json({ ok:true, fieldId: req.params.fieldId, rowCount: rows.length, rows, raw: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// List saved reports — so the UI can let a user pick which report backs
// each dataset once your team has built them.
app.get('/api/rw/reports', async (req, res) => {
  try {
    const r = await forwardJSON('GET', RW_PATH + '/reports', null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, reports: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/rw/reports/:id', async (req, res) => {
  try {
    const r = await forwardJSON('GET', RW_PATH + '/reports/' + req.params.id, null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, report: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// Start an execution. Body: { reportId, parameters?, outputFormat? }
app.post('/api/rw/executions', async (req, res) => {
  try {
    const b = req.body || {};
    if(b.reportId == null) return res.status(400).json({ ok:false, error: 'reportId is required' });
    const body = {
      reportId:     b.reportId,
      parameters:   b.parameters || [],
      outputFormat: b.outputFormat || 'application/json'
    };
    const r = await forwardJSON('POST', RW_PATH + '/executions', body);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    const execId = r.data && (r.data.id != null ? r.data.id : r.data.Id);
    res.json({ ok:true, executionId: execId, execution: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/rw/executions/:id/status', async (req, res) => {
  try {
    const r = await forwardJSON('GET', RW_PATH + '/executions/' + req.params.id + '/status', null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, status: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

app.get('/api/rw/executions/:id/result', async (req, res) => {
  try {
    const r = await forwardJSON('GET', RW_PATH + '/executions/' + req.params.id + '/result', null);
    if(!r.ok) return res.status(r.status).json({ ok:false, error: r.data });
    res.json({ ok:true, result: r.data });
  } catch(err) { res.status(500).json({ ok:false, error: err.message }); }
});

// Convenience: run a report and poll to completion in one call. Saves the
// client from implementing the poll loop. Bounded so a stuck report can't
// hang the request forever.
app.post('/api/rw/run', async (req, res) => {
  try {
    const b = req.body || {};
    if(b.reportId == null) return res.status(400).json({ ok:false, error: 'reportId is required' });
    const start = await forwardJSON('POST', RW_PATH + '/executions', {
      reportId: b.reportId,
      parameters: b.parameters || [],
      outputFormat: 'application/json'
    });
    if(!start.ok) return res.status(start.status).json({ ok:false, stage:'start', error: start.data });
    const execId = start.data && (start.data.id != null ? start.data.id : start.data.Id);
    if(execId == null) return res.status(502).json({ ok:false, stage:'start', error:'no execution id returned', raw:start.data });

    const maxWaitMs = Math.min(+b.maxWaitMs || 120000, 240000);
    const began = Date.now();
    let state = 'pending';
    while(Date.now() - began < maxWaitMs){
      await new Promise(r => setTimeout(r, 1500));
      const st = await forwardJSON('GET', RW_PATH + '/executions/' + execId + '/status', null);
      if(!st.ok) return res.status(st.status).json({ ok:false, stage:'status', executionId: execId, error: st.data });
      state = String((st.data && (st.data.status || st.data.Status)) || '').toLowerCase();
      if(state === 'succeeded' || state === 'error' || state === 'canceled') break;
    }
    if(state !== 'succeeded'){
      return res.status(202).json({ ok:false, stage:'poll', executionId: execId, state,
        error: state === 'error' ? 'report execution failed' : 'timed out waiting for completion' });
    }
    const out = await forwardJSON('GET', RW_PATH + '/executions/' + execId + '/result', null);
    if(!out.ok) return res.status(out.status).json({ ok:false, stage:'result', executionId: execId, error: out.data });
    res.json({ ok:true, executionId: execId, result: out.data, elapsedMs: Date.now() - began });
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
  console.log('  DIU root:          ', BASE_URL ? (BASE_URL + DIU_PATH) : '(not configured)');
  console.log('  Auth mode:         ', AUTH_MODE);
  if(AUTH_MODE === 'bearer'){
    const exp = bearerExpiryInfo();
    console.log('  Bearer token:       set' +
      (exp.known ? ('  · expires ' + exp.expiresAt + ' (' + exp.daysLeft + ' days left)') : ''));
    console.log('  Tenant database:   ', TENANT_DATABASE || '(not set)');
    console.log('  Tenant server:     ', TENANT_SERVER || '(not set)');
    console.log('  Session token:     ', TENANT_ACCESS_TOKEN ? 'set' : '(not set)');
    if(BEARER_CLAIMS){
      console.log('  Token audience:    ', BEARER_CLAIMS.aud || '—');
      console.log('  Token subject:     ', BEARER_CLAIMS.sub || '—');
    }
    if(exp.known && exp.expired){
      console.error('  ⛔ TOKEN HAS EXPIRED — every post will 401 until it is replaced.');
    } else if(exp.known && exp.daysLeft <= 7){
      console.warn('  ⚠  Token expires in ' + exp.daysLeft + ' day(s) — line up a replacement.');
    }
  } else {
    console.log('  OAuth creds set:   ', !!(CLIENT_ID && CLIENT_SECRET));
  }
  console.log('  Allowed origins:   ', ALLOWED_ORIGINS.join(', '));
  console.log('  Default template:  ', DEFAULT_TEMPLATE);
  console.log('  SMTP configured:   ', SMTP_CONFIGURED ? (SMTP_HOST + ':' + SMTP_PORT) : 'no — /api/notice/send disabled');
  console.log('  AI extract:        ', 'moved to server-ingest/ (default port 4319)');
  console.log('  Health check:      ', 'http://localhost:' + PORT + '/healthz');
  console.log('────────────────────────────────────────────');
  if(!BASE_URL || AUTH_MODE === 'none'){
    console.warn('⚠  Investran is not fully configured. Set INVESTRAN_BASE_URL plus either');
    console.warn('   INVESTRAN_BEARER_TOKEN (FIS-issued JWT) or INVESTRAN_CLIENT_ID +');
    console.warn('   INVESTRAN_CLIENT_SECRET (OAuth) in server/.env, then restart.');
  }
});
