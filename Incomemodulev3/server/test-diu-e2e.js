#!/usr/bin/env node
/**
 * test-diu-e2e.js — walk the DIU write path and stop where it actually breaks.
 *
 * Deliberately runs through the proxy (http://localhost:4318) rather than
 * calling Investran directly, so this tests the same code path the app uses.
 * A test that bypasses the proxy would pass while the app still fails.
 *
 * Sequence:
 *   0. proxy health
 *   1. import domains        ← the known blocker
 *   2. POST /file            upload the workbook
 *   3. POST /jobs            create the import job
 *   4. POST /jobs/:id/validate + poll
 *   5. report — does NOT load. Loading writes to the tenant, so that stays
 *      a separate, deliberate step.
 *
 * Usage:
 *   node test-diu-e2e.js ~/Downloads/investran-diu-FER12345-2026-08-25.xlsx
 *
 * Get that file from the app: Accounting → DIU template preview → Download.
 * Testing the real artifact beats testing a synthetic one.
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const PROXY = (process.env.TEST_PROXY_URL || 'http://localhost:4318').replace(/\/$/, '');
const FILE  = process.argv[2];

const line = (c) => console.log('  ' + (c || '─').repeat(74));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(method, url, opts){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(url, Object.assign({ method, signal: ctrl.signal }, opts || {}));
    const txt = await res.text();
    let json = null; try { json = JSON.parse(txt); } catch(_){}
    return { status: res.status, json, txt };
  } catch(err){
    return { status: -1, txt: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally { clearTimeout(t); }
}

function fail(step, detail){
  line('═');
  console.log('\n  ✗ STOPPED AT: ' + step + '\n');
  if(detail) console.log('    ' + String(detail).split('\n').join('\n    '));
  console.log('');
  process.exit(1);
}

(async () => {
  console.log('\n  DIU end-to-end test');
  console.log('  proxy :', PROXY);
  console.log('  file  :', FILE || '(none supplied)');
  line();

  // ─── 0 · Is the proxy up and configured? ─────────────────────────────
  console.log('\n  0 · Proxy health');
  const h = await call('GET', PROXY + '/healthz');
  if(h.status !== 200){
    fail('proxy health', 'HTTP ' + h.status + ' — is the proxy running?\n' +
      'Start it with:  cd server && npm start');
  }
  const health = h.json || {};
  console.log('      tenant    : ' + ((health.tenant && health.tenant.database) || '?'));
  console.log('      DIU root  : ' + (health.diuRoot || '?'));
  console.log('      token     : ' + (health.tokenDaysLeft != null ? health.tokenDaysLeft + ' days left' : 'unknown'));
  if(health.tokenDaysLeft != null && health.tokenDaysLeft < 0){
    fail('token expired', 'Run set-token.js with a fresh JWT.');
  }
  if(!health.investranConfigured){
    fail('proxy not configured', 'INVESTRAN_BEARER_TOKEN is blank in server/.env');
  }

  // ─── 1 · Import domains — the blocker ────────────────────────────────
  console.log('\n  1 · Import domains');
  const dImp = await call('GET', PROXY + '/api/diu/domains?import=true');
  const dAll = await call('GET', PROXY + '/api/diu/domains?import=false');
  const listOf = r => {
    const d = r.json && r.json.domains;
    return Array.isArray(d) ? d : (d && (d.value || d.data)) || [];
  };
  const importable = listOf(dImp);
  const allDomains = listOf(dAll);
  console.log('      import=true  → ' + importable.length + ' domain(s)');
  console.log('      import=false → ' + allDomains.length + ' domain(s)');

  // An empty import=true list is NOT a blocker. FIS's own working example
  // passes DomainId -1 (Investran Global) directly, so the earlier hard stop
  // here was wrong — it refused to try something that works.
  let domainId = process.env.DIU_DOMAIN_ID != null ? +process.env.DIU_DOMAIN_ID
               : (importable.length
                   ? (importable[0].Id != null ? importable[0].Id : importable[0].id)
                   : -1);
  const named = allDomains.find(d => String(d.Id != null ? d.Id : d.id) === String(domainId));
  console.log('      → using DomainId ' + domainId +
    (named ? ' · ' + (named.Name || named.name) : '') +
    (importable.length ? '' : '  (import list empty — using the documented default)'));

  // A DIU template defines the column mapping. Without one the job has
  // nothing to map the workbook against, so make the omission explicit
  // rather than letting it fail deep in validation.
  // .env carries INVESTRAN_DIU_TEMPLATE_ID (the proxy's name for it); allow
  // DIU_TEMPLATE_ID as a per-run override.
  const templateId = process.env.DIU_TEMPLATE_ID ? +process.env.DIU_TEMPLATE_ID
                   : process.env.INVESTRAN_DIU_TEMPLATE_ID ? +process.env.INVESTRAN_DIU_TEMPLATE_ID
                   : null;
  if(!templateId){
    console.log('\n  ⚠ No DIU_TEMPLATE_ID set. The documented flow creates jobs from a');
    console.log('    template, which is what maps our columns to Transaction fields.');
    console.log('    Set it once the template exists in Investran:');
    console.log('        DIU_TEMPLATE_ID=302 node test-diu-e2e.js <file.xlsx>');
  } else {
    console.log('      → template ' + templateId);
  }

  // ─── 2 · Upload the workbook ─────────────────────────────────────────
  if(!FILE){
    fail('no file supplied',
      'Domains are fine — the blocker is cleared. Now supply a workbook:\n\n' +
      '  In the app:  Accounting → DIU template preview → Download .xlsx\n' +
      '  Then:        node test-diu-e2e.js ~/Downloads/<that-file>.xlsx');
  }
  const abs = path.resolve(FILE.replace(/^~/, process.env.HOME || '~'));
  if(!fs.existsSync(abs)) fail('file not found', abs);
  const buf = fs.readFileSync(abs);
  console.log('\n  2 · Upload · ' + path.basename(abs) + ' (' + Math.round(buf.length/1024) + ' KB)');

  const fd = new FormData();
  fd.append('file', new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), path.basename(abs));
  // The proxy waits for the virus scan to reach Trusted before returning —
  // a job created against an unscanned file is rejected.
  const up = await call('POST', PROXY + '/api/diu/file', { body: fd });
  if(up.status < 200 || up.status >= 300 || !up.json || !up.json.ok){
    fail('file upload', 'HTTP ' + up.status + '\n' + String(up.txt).slice(0, 500));
  }
  const fileId = up.json.fileId;
  console.log('      ✓ fileId ' + fileId + ' · scan ' + (up.json.scanStatus || '?'));

  // ─── 3 · Create the job ──────────────────────────────────────────────
  console.log('\n  3 · Create import job');
  const jobBody = {
    fileId,
    domainId,
    state: 'InProcess',
    name: 'PCS-LoanModule-TEST-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'')
  };
  if(templateId) jobBody.templateId = templateId;
  const job = await call('POST', PROXY + '/api/diu/jobs', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobBody)
  });
  if(job.status < 200 || job.status >= 300 || !job.json || !job.json.ok){
    fail('job creation', 'HTTP ' + job.status + '\n' + String(up.txt && job.txt || job.txt).slice(0, 700));
  }
  const jobId = job.json.jobId;
  console.log('      ✓ jobId ' + jobId);

  // ─── 4 · Validate ────────────────────────────────────────────────────
  console.log('\n  4 · Validate (async — polling)');
  const val = await call('POST', PROXY + '/api/diu/jobs/' + jobId + '/validate', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if(val.status < 200 || val.status >= 300 || !val.json || !val.json.ok){
    fail('validate', 'HTTP ' + val.status + '\n' + String(val.txt).slice(0, 700));
  }
  const processId = val.json.processId;
  console.log('      processId ' + processId);

  // ProcessStatus, surfaced by the proxy as .status with a .done flag.
  let state = null, ok = false;
  for(let i = 0; i < 60; i++){
    await sleep(i < 5 ? 1000 : 2500);
    const st = await call('GET', PROXY + '/api/diu/processes/' + processId);
    state = (st.json && st.json.status) || null;
    ok    = !!(st.json && st.json.succeeded);
    process.stdout.write('.');
    if(st.json && st.json.done) break;
  }
  console.log('\n      ProcessStatus: ' + state + (ok ? '  ✓' : ''));
  if(!ok) console.log('      (validation did not succeed — feedback below should say why)');

  // ─── 5 · Feedback ────────────────────────────────────────────────────
  console.log('\n  5 · Validation feedback');
  const fb = await call('GET', PROXY + '/api/diu/processes/' + processId + '/feedback');
  fs.writeFileSync(__dirname + '/diu-validation-' + processId + '.json',
    JSON.stringify(fb.json || fb.txt, null, 2));
  const rows = (fb.json && (fb.json.feedback || fb.json.rows || fb.json.data)) || fb.json;
  if(Array.isArray(rows) && rows.length){
    console.log('      ' + rows.length + ' message(s):\n');
    rows.slice(0, 25).forEach(r => {
      const sev = r.Severity || r.severity || r.Type || '';
      const msg = r.Message || r.message || r.Description || JSON.stringify(r);
      const row = r.RowNumber != null ? ' [row ' + r.RowNumber + ']' : '';
      console.log('        ' + String(sev).padEnd(9) + row + ' ' + String(msg).slice(0, 150));
    });
    if(rows.length > 25) console.log('        … ' + (rows.length - 25) + ' more');
  } else {
    console.log('      (no messages — see the saved JSON)');
  }

  line('═');
  console.log('\n  Reached validation. Nothing was loaded into Investran.');
  console.log('  Full feedback saved to diu-validation-' + processId + '.json\n');
  console.log('  To actually post (writes to the tenant):');
  console.log('    curl -X POST ' + PROXY + '/api/diu/jobs/' + jobId + '/load \\');
  console.log('         -H "Content-Type: application/json" -d "{}"\n');
})();
