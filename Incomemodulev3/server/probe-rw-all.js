#!/usr/bin/env node
/**
 * probe-rw-all.js — run every mapped RW report and print its column list.
 *
 * Purpose is deliberately narrow: find out what each report actually
 * returns so the dataset→column mapping can be set correctly the first
 * time, rather than syncing blind and repairing afterwards.
 *
 * Prints columns + row count + one sample row per report. Full payloads
 * go to rw-result-<id>.json in case something needs a closer look.
 *
 * Usage:
 *   node probe-rw-all.js              # all reports below
 *   node probe-rw-all.js 36988 36989  # just these
 */

require('dotenv').config();
const fs = require('fs');
const { randomUUID } = require('crypto');

const BASE  = (process.env.INVESTRAN_BASE_URL || '').replace(/\/$/, '');
const TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();
const RW    = BASE + (process.env.INVESTRAN_RW_PATH || '/ReportWizard/v1');

if(!BASE || !TOKEN){
  console.error('Set INVESTRAN_BASE_URL and INVESTRAN_BEARER_TOKEN in server/.env');
  process.exit(1);
}

// Book 188 · Loan_Module. 36987 (GL Accounts) is already verified and mapped,
// so it's excluded — add it back as an argument if you want to re-check.
const REPORTS = [
  { id: 36988, label: 'Transaction Types' },
  { id: 36989, label: 'Legal Entities' },
  { id: 36990, label: 'Domains' },
  { id: 36991, label: 'Legal Entity Groups' },
  { id: 36992, label: 'Currencies' },
  { id: 36993, label: 'Batch Types' },
  { id: 36994, label: 'Batch Statuses' },
  { id: 36995, label: 'Journal Entry Types' },
  { id: 36996, label: 'Deals' },
  { id: 36997, label: 'Positions and Securities' },
  { id: 36998, label: 'Allocation Rules' }
];

function claims(){
  try {
    const p = TOKEN.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64').toString('utf8'));
  } catch(_){ return {}; }
}
const C = claims();

function headers(json){
  const h = {
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + TOKEN,
    'uuid': randomUUID(),
    'X-Investran-Database':    C.Database    || '',
    'X-Investran-Server':      C.Server      || '',
    'X-Investran-AccessToken': C.accessToken || ''
  };
  if(json) h['Content-Type'] = 'application/json';
  return h;
}

async function call(method, url, body){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      method, headers: headers(!!body),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const txt = await res.text();
    let json = null; try { json = JSON.parse(txt); } catch(_){}
    return { status: res.status, json, txt };
  } catch(err){
    return { status: -1, txt: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally { clearTimeout(t); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runReport(id){
  const start = await call('POST', RW + '/executions', { reportId: +id });
  if(start.status < 200 || start.status >= 300){
    return { error: 'start HTTP ' + start.status + ' — ' + String(start.txt).slice(0,160).replace(/\s+/g,' ') };
  }
  const execId = start.json && (start.json.id != null ? start.json.id : start.json.Id);
  if(execId == null) return { error: 'no execution id: ' + JSON.stringify(start.json).slice(0,160) };

  let state = null;
  for(let i = 0; i < 60; i++){
    await sleep(i < 4 ? 1000 : 2500);
    const s = await call('GET', RW + '/executions/' + execId + '/status');
    state = (s.json && (s.json.status || s.json.Status)) || String(s.status);
    if(/succe|complet/i.test(String(state))) break;
    if(/fail|error|cancel/i.test(String(state))) return { error: 'execution ' + state };
  }
  if(!/succe|complet/i.test(String(state))) return { error: 'timed out, last state: ' + state };

  const r = await call('GET', RW + '/executions/' + execId + '/result');
  if(r.status < 200 || r.status >= 300) return { error: 'result HTTP ' + r.status };
  return { result: r.json, execId };
}

function shape(result){
  let cols = result.columns || result.Columns || null;
  let data = result.data    || result.Data    || result.rows || null;
  if(!cols && Array.isArray(result) && result.length && typeof result[0] === 'object'){
    cols = Object.keys(result[0]); data = result;
  }
  if(!cols && result.result){ cols = result.result.columns; data = result.result.data; }
  const names = (cols || []).map(c =>
    typeof c === 'string' ? c : (c.columnName || c.ColumnName || c.name || '?'));
  return { names, data: data || [] };
}

(async () => {
  const want = process.argv.slice(2).map(Number).filter(Boolean);
  const list = want.length ? REPORTS.filter(r => want.includes(r.id))
                             .concat(want.filter(id => !REPORTS.some(r => r.id === id))
                                         .map(id => ({ id, label: 'ad-hoc' })))
                           : REPORTS;

  console.log('\n  Probing ' + list.length + ' Report Wizard reports on ' + (C.Database || '?'));
  if(C.exp){
    const days = Math.round((C.exp * 1000 - Date.now()) / 86400000);
    if(days < 0){ console.log('\n  ✗ Token expired — run set-token.js.\n'); process.exit(1); }
    console.log('  Token valid for ' + days + ' more days');
  }
  console.log('  ' + '═'.repeat(74));

  const summary = [];

  for(const rep of list){
    process.stdout.write('\n  ' + rep.id + '  ' + rep.label + '\n  ' + '─'.repeat(74) + '\n  running');
    const out = await runReport(rep.id);
    if(out.error){
      console.log('\r  ✗ ' + out.error + '                    ');
      summary.push({ ...rep, error: out.error });
      continue;
    }
    fs.writeFileSync(__dirname + '/rw-result-' + rep.id + '.json', JSON.stringify(out.result, null, 2));
    const { names, data } = shape(out.result);
    console.log('\r  ' + names.length + ' columns · ' + data.length + ' rows        ');
    names.forEach((n,i) => console.log('      ' + String(i).padStart(2) + '  ' + n));

    if(data.length){
      const row = data[0];
      const vals = Array.isArray(row) ? row : names.map(n => row[n]);
      console.log('      ' + '·'.repeat(50));
      console.log('      sample: ' + vals.map(v => {
        const s = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
        return String(s == null ? '' : s).slice(0,20);
      }).join(' | ').slice(0, 200));
    }
    summary.push({ ...rep, cols: names.length, rows: data.length, names });
  }

  console.log('\n\n  ' + '═'.repeat(74));
  console.log('\n  Summary\n');
  summary.forEach(s => {
    console.log('    ' + String(s.id).padEnd(8) + s.label.padEnd(28) +
      (s.error ? '✗ ' + s.error.slice(0,30) : String(s.rows).padStart(6) + ' rows  ' + s.cols + ' cols'));
  });
  console.log('\n  Payloads saved as rw-result-<id>.json');
  console.log('  Send me this output and I\'ll set the column mappings.\n');
})();
