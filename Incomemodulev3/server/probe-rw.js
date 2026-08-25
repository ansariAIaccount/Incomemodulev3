#!/usr/bin/env node
/**
 * probe-rw.js — settle the Report Wizard contract and pull one report.
 *
 * Two sources disagree on RW's execution shape:
 *   A)  POST /executions            → GET /executions/{id}/status  → /result
 *   B)  POST /reports/{id}/queue    → GET /reports/jobs/{id}/status → /results
 *
 * Rather than pick one and debug it live, this fetches the tenant's swagger
 * and reads the real path list, then executes a report against whichever
 * shape actually exists.
 *
 * It prints the DELIVERED COLUMN NAMES, which is the thing we need in order
 * to map the report into our reference-data cache. The reports were built
 * "close to" the spec, not exactly, so we map to what's really there.
 *
 * Usage:
 *   node probe-rw.js            # swagger + report 36987 (GL Accounts)
 *   node probe-rw.js 36988      # a different report id
 */

require('dotenv').config();
const fs = require('fs');
const { randomUUID } = require('crypto');

const BASE   = (process.env.INVESTRAN_BASE_URL || '').replace(/\/$/, '');
const TOKEN  = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();
const RW     = BASE + (process.env.INVESTRAN_RW_PATH || '/ReportWizard/v1');
const REPORT = process.argv[2] || '36987';

if(!BASE || !TOKEN){
  console.error('Set INVESTRAN_BASE_URL and INVESTRAN_BEARER_TOKEN in server/.env');
  process.exit(1);
}

function claims(){
  try {
    const p = TOKEN.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64').toString('utf8'));
  } catch(_){ return {}; }
}
const C = claims();

function headers(extra){
  return Object.assign({
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + TOKEN,
    'uuid': randomUUID(),
    'X-Investran-Database':    C.Database    || '',
    'X-Investran-Server':      C.Server      || '',
    'X-Investran-AccessToken': C.accessToken || ''
  }, extra || {});
}

async function call(method, url, body){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, {
      method,
      headers: headers(body ? { 'Content-Type':'application/json' } : null),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const txt = await res.text();
    let json = null;
    try { json = JSON.parse(txt); } catch(_){}
    return { status: res.status, json, txt };
  } catch(err){
    return { status: -1, txt: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally { clearTimeout(t); }
}

const line = () => console.log('  ' + '─'.repeat(74));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('\n  Report Wizard probe');
  console.log('  base   :', BASE);
  console.log('  rw     :', RW);
  console.log('  report :', REPORT);
  console.log('  tenant :', C.Database || '(none in token)');
  if(C.exp){
    const days = Math.round((C.exp * 1000 - Date.now()) / 86400000);
    console.log('  token  : expires in ' + days + ' days');
    if(days < 0){ console.log('\n  ✗ Token has EXPIRED — run set-token.js with a fresh one.\n'); process.exit(1); }
  }
  line();

  // ─── 1. Does the module exist, and what does it expose? ──────────────────
  console.log('\n  1 · Fetching swagger…');
  let paths = null;
  for(const u of [RW + '/swagger/v1/swagger.json', RW + '/swagger/index.html']){
    const r = await call('GET', u);
    console.log('      ' + r.status + '  ' + u);
    if(r.status === 200 && r.json && r.json.paths){
      paths = Object.keys(r.json.paths);
      fs.writeFileSync(__dirname + '/swagger-reportwizard.json', JSON.stringify(r.json, null, 2));
      console.log('      ✓ ' + paths.length + ' paths — saved to swagger-reportwizard.json');
      break;
    }
  }

  if(paths){
    const rel = paths.filter(p => /execut|queue|job|result|status|report|lookup/i.test(p));
    console.log('\n      Execution-related paths:');
    rel.forEach(p => console.log('        · ' + p));
  } else {
    console.log('\n      ⚠ No swagger. The module may not be enabled, or sits at a');
    console.log('        different path. Trying the endpoints blind anyway.');
  }

  // ─── 2. Execute the report ───────────────────────────────────────────────
  // Ordered candidates. First one to return 2xx wins.
  const has = re => !paths || paths.some(p => re.test(p));
  const candidates = [];

  if(has(/executions/i)){
    candidates.push({
      name:   'executions',
      start:  () => call('POST', RW + '/executions', { reportId: +REPORT }),
      id:     j => j && (j.executionId || j.id || j.ExecutionId || j.Id),
      status: id => call('GET', RW + '/executions/' + id + '/status'),
      result: id => call('GET', RW + '/executions/' + id + '/result')
    });
  }
  if(has(/queue/i) || has(/jobs/i)){
    candidates.push({
      name:   'reports/{id}/queue',
      start:  () => call('POST', RW + '/reports/' + REPORT + '/queue', { outputFormat: 'json' }),
      id:     j => j && (j.jobId || j.JobId || j.id || j.Id),
      status: id => call('GET', RW + '/reports/jobs/' + id + '/status'),
      result: id => call('GET', RW + '/reports/jobs/' + id + '/results?format=json')
    });
  }
  candidates.push({
    name:   'reports/{id}/execute (sync)',
    start:  () => call('POST', RW + '/reports/' + REPORT + '/execute', { outputFormat: 'json' }),
    id:     () => null,          // sync — body IS the result
    sync:   true
  });

  console.log('\n  2 · Executing report ' + REPORT + '…');
  let result = null, usedShape = null;

  for(const c of candidates){
    console.log('\n      → trying ' + c.name);
    const started = await c.start();
    console.log('        start: HTTP ' + started.status);
    if(started.status < 200 || started.status >= 300){
      console.log('        ' + String(started.txt || '').slice(0, 220).replace(/\s+/g,' '));
      continue;
    }
    usedShape = c.name;

    if(c.sync){ result = started.json; break; }

    const id = c.id(started.json);
    if(!id){
      console.log('        started, but no id in response:');
      console.log('        ' + JSON.stringify(started.json).slice(0, 300));
      continue;
    }
    console.log('        id: ' + id + ' — polling…');

    let state = null;
    for(let i = 0; i < 60; i++){
      await sleep(i < 5 ? 1000 : 2500);
      const s = await c.status(id);
      state = s.json && (s.json.status || s.json.Status || s.json.state) || s.status;
      process.stdout.write('.');
      if(/succe|complet|finish|done/i.test(String(state))) break;
      if(/fail|error|cancel/i.test(String(state))){
        console.log('\n        ✗ ' + state + ': ' + JSON.stringify(s.json).slice(0,300));
        break;
      }
    }
    console.log('\n        status: ' + state);
    if(!/succe|complet|finish|done/i.test(String(state))) continue;

    const r = await c.result(id);
    console.log('        result: HTTP ' + r.status);
    if(r.status >= 200 && r.status < 300){ result = r.json; break; }
    console.log('        ' + String(r.txt||'').slice(0,220));
  }

  // ─── 3. What came back? ──────────────────────────────────────────────────
  line();
  if(!result){
    console.log('\n  ✗ No result. Nothing above returned usable data.');
    console.log('    Send me the output and I\'ll adapt to the real contract.\n');
    process.exit(1);
  }

  console.log('\n  3 · Result — via "' + usedShape + '"\n');
  fs.writeFileSync(__dirname + '/rw-result-' + REPORT + '.json', JSON.stringify(result, null, 2));

  // RW grids come back in several shapes; normalise enough to show columns.
  let cols = result.columns || result.Columns || null;
  let data = result.data    || result.Data    || result.rows || result.Rows || null;
  if(!cols && Array.isArray(result) && result.length && typeof result[0] === 'object'){
    cols = Object.keys(result[0]); data = result;   // array-of-objects form
  }
  if(!cols && result.result){ cols = result.result.columns; data = result.result.data; }

  if(cols){
    const names = cols.map(c => typeof c === 'string' ? c : (c.columnName || c.ColumnName || c.name || JSON.stringify(c)));
    console.log('      COLUMNS (' + names.length + '):');
    names.forEach((n,i) => console.log('        ' + String(i).padStart(2) + '  ' + n));
    console.log('\n      ROWS: ' + (Array.isArray(data) ? data.length : 'unknown'));
    if(Array.isArray(data) && data.length){
      console.log('\n      First 5 rows:');
      data.slice(0,5).forEach((row,i) => {
        const vals = Array.isArray(row) ? row : names.map(n => row[n]);
        console.log('        ' + i + '  ' + vals.map(v => {
          const s = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
          return String(s == null ? '' : s).slice(0,24);
        }).join(' | '));
      });
    }
  } else {
    console.log('      Unrecognised shape. Top-level keys: ' + Object.keys(result).join(', '));
    console.log('      ' + JSON.stringify(result).slice(0, 600));
  }

  console.log('\n      Full payload saved to rw-result-' + REPORT + '.json');
  console.log('\n  Send me the COLUMNS list and I\'ll map it into PCS Sync.\n');
})();
