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

  if(!importable.length){
    console.log('');
    allDomains.slice(0, 20).forEach(d =>
      console.log('        · ' + String(d.Id != null ? d.Id : d.id).padStart(5) + '  ' + (d.Name || d.name || '')));
    fail('no domain has import rights',
      'The service account can SEE ' + allDomains.length + ' domains but can import into none.\n' +
      'DIU job creation requires a DomainId from the import=true list, so nothing\n' +
      'can be posted until that grant is made. This is a permissions change on the\n' +
      'Investran side, not something the code can work around.\n\n' +
      'Ask for: import rights for service account C-E1074557 on whichever of the\n' +
      'domains above the loan GL should post into.');
  }

  const domainId = importable[0].Id != null ? importable[0].Id : importable[0].id;
  const domainNm = importable[0].Name || importable[0].name || '';
  console.log('      ✓ using domain ' + domainId + ' · ' + domainNm);

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
  const up = await call('POST', PROXY + '/api/diu/file', { body: fd });
  if(up.status < 200 || up.status >= 300 || !up.json || !up.json.ok){
    fail('file upload', 'HTTP ' + up.status + '\n' + String(up.txt).slice(0, 500));
  }
  const fileId = up.json.fileId;
  console.log('      ✓ fileId ' + fileId);

  // ─── 3 · Create the job ──────────────────────────────────────────────
  console.log('\n  3 · Create import job');
  const job = await call('POST', PROXY + '/api/diu/jobs', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileId,
      domainId,
      name: 'PCS-LoanModule-TEST-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'')
    })
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

  let state = null;
  for(let i = 0; i < 60; i++){
    await sleep(i < 5 ? 1000 : 2500);
    const st = await call('GET', PROXY + '/api/diu/processes/' + processId);
    const p = (st.json && (st.json.process || st.json)) || {};
    state = p.Status || p.status || p.State || p.state;
    process.stdout.write('.');
    if(/complet|succe|fail|error|cancel/i.test(String(state))) break;
  }
  console.log('\n      status: ' + state);

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
