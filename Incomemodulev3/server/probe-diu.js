#!/usr/bin/env node
/**
 * probe-diu.js — discover the real Investran DIU endpoint surface.
 *
 * We got an IIS "404 - File or directory not found" from
 * <base>/DataImport/jobs, which means the request reached the server but
 * matched no route. Auth was never evaluated, so the token is likely fine.
 *
 * This walks a matrix of plausible paths and reports the status of each,
 * so we can see which ones exist. Interpretation:
 *
 *   404  → route does not exist (keep looking)
 *   401  → route EXISTS, auth rejected      ← very useful signal
 *   403  → route exists, not permitted      ← also useful
 *   400  → route exists, payload disagreed  ← we found it
 *   200  → route exists and accepted        ← we found it
 *
 * Anything that isn't 404 tells us the path is real.
 *
 * Usage:  node probe-diu.js
 */

require('dotenv').config();

const BASE = (process.env.INVESTRAN_BASE_URL || '').replace(/\/$/, '');
const TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();

if(!BASE)  { console.error('INVESTRAN_BASE_URL not set'); process.exit(1); }
if(!TOKEN) { console.error('INVESTRAN_BEARER_TOKEN not set'); process.exit(1); }

// Pull tenant routing out of the JWT so probes carry the same headers the
// proxy would send.
function claims(){
  try {
    const p = TOKEN.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64').toString('utf8'));
  } catch(_){ return {}; }
}
const C = claims();

const HEADERS = {
  'Authorization': 'Bearer ' + TOKEN,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Investran-Database':    C.Database    || '',
  'X-Investran-Server':      C.Server      || '',
  'X-Investran-AccessToken': C.accessToken || ''
};

// Root of the host, without the /api suffix — some surfaces sit above it.
const HOST_ROOT = BASE.replace(/\/api$/i, '');

// Candidate paths. Ordered roughly by likelihood.
const CANDIDATES = [
  // ── API-discovery documents: if any of these resolve we get the whole
  //    surface for free and stop guessing entirely.
  ['GET',  BASE + '/swagger/v1/swagger.json'],
  ['GET',  BASE + '/swagger/index.html'],
  ['GET',  HOST_ROOT + '/swagger/v1/swagger.json'],
  ['GET',  BASE + '/$metadata'],
  ['GET',  BASE + '/'],
  ['GET',  BASE + '/DataImport'],
  ['GET',  BASE + '/DataImport/'],

  // ── Version-segment variants on the job workflow
  ['POST', BASE + '/DataImport/jobs'],
  ['POST', BASE + '/DataImport/v1/jobs'],
  ['POST', BASE + '/DataImport/v2/jobs'],
  ['POST', BASE + '/v1/DataImport/jobs'],

  // ── "batches" instead of "jobs" (the client-side envelope comment
  //    referenced /api/DataImport/v1/batches)
  ['POST', BASE + '/DataImport/batches'],
  ['POST', BASE + '/DataImport/v1/batches'],

  // ── Casing variants, in case the gateway is case-sensitive the other way
  ['POST', BASE + '/dataimport/jobs'],
  ['POST', BASE + '/DATAIMPORT/jobs'],
  ['POST', BASE + '/dataImport/jobs'],

  // ── Other plausible resource names
  ['POST', BASE + '/DataImport/imports'],
  ['POST', BASE + '/DataImport/import'],
  ['POST', BASE + '/DataImport/job'],
  ['GET',  BASE + '/DataImport/templates'],
  ['GET',  BASE + '/DataImport/v1/templates'],

  // ── Is anything else under /api alive? Gives us a reachability baseline.
  ['GET',  BASE + '/ReferenceData'],
  ['GET',  BASE + '/ReportWizard'],
  ['GET',  BASE + '/health'],
  ['GET',  BASE + '/healthz']
];

function label(status){
  if(status === 404) return '404  not found';
  if(status === 401) return '401  EXISTS · auth rejected';
  if(status === 403) return '403  EXISTS · forbidden';
  if(status === 400) return '400  EXISTS · bad payload';
  if(status === 405) return '405  EXISTS · wrong method';
  if(status >= 200 && status < 300) return String(status) + '  OK';
  return String(status);
}

(async () => {
  console.log('\n  Probing Investran DIU surface');
  console.log('  base   :', BASE);
  console.log('  tenant :', C.Database || '(none)', '·', C.Server || '(none)');
  console.log('  ' + '─'.repeat(72) + '\n');

  const hits = [];

  for(const [method, url] of CANDIDATES){
    let status = 0, note = '';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        method,
        headers: HEADERS,
        body: method === 'POST' ? JSON.stringify({ name: 'probe', template: 'probe' }) : undefined,
        signal: ctrl.signal
      });
      clearTimeout(t);
      status = res.status;
      const ct = res.headers.get('content-type') || '';
      if(ct.includes('json')){
        const txt = await res.text();
        note = ' · json: ' + txt.slice(0, 120).replace(/\s+/g, ' ');
      } else if(status !== 404){
        const txt = await res.text();
        // Strip HTML noise, keep any human-readable message
        const plain = txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if(plain) note = ' · ' + plain.slice(0, 120);
      }
    } catch(err){
      status = -1;
      note = ' · ' + (err.name === 'AbortError' ? 'timeout' : err.message);
    }

    const shown = method.padEnd(5) + url.replace(BASE, '<base>').replace(HOST_ROOT, '<host>');
    const flag = (status !== 404 && status !== -1) ? ' ◀── ' : '     ';
    console.log('  ' + label(status).padEnd(30) + flag + shown + note);
    if(status !== 404 && status !== -1) hits.push({ method, url, status, note });
  }

  console.log('\n  ' + '─'.repeat(72));
  if(hits.length){
    console.log('\n  Routes that EXIST (anything not 404):\n');
    hits.forEach(h => console.log('    ' + String(h.status).padEnd(5) + h.method.padEnd(5) + h.url));
    console.log('\n  Set INVESTRAN_DIU_PATH in .env to the prefix of whichever');
    console.log('  of these is the DIU job/batch endpoint, then restart.\n');
  } else {
    console.log('\n  Every candidate 404\'d. The DIU API is likely at a different');
    console.log('  base path entirely, or is not enabled on this tenant.');
    console.log('  Ask FIS for the exact DIU endpoint URL + HTTP method.\n');
  }
})();
