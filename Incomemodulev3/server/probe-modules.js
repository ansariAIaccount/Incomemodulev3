#!/usr/bin/env node
/**
 * probe-modules.js — find the sibling API modules alongside DataImport.
 *
 * We now know the pattern is:  <host>/api/<Module>/v1/swagger/v1/swagger.json
 * (proved by DataImport). Before we can POST a GL batch we need to READ
 * Investran's master data so our values resolve — GL accounts, legal
 * entities, transaction types, currencies, deals, positions.
 *
 * Those live behind a lookups/reference API, not DataImport. This probes
 * likely module names for a Swagger doc, and reports the endpoint count
 * for any that answer.
 *
 * Usage:  node probe-modules.js
 */

require('dotenv').config();

const BASE  = (process.env.INVESTRAN_BASE_URL || '').replace(/\/$/, '');
const TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();
if(!BASE || !TOKEN){ console.error('Set INVESTRAN_BASE_URL and INVESTRAN_BEARER_TOKEN'); process.exit(1); }

const { randomUUID } = require('crypto');
function claims(){
  try {
    const p = TOKEN.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64').toString('utf8'));
  } catch(_){ return {}; }
}
const C = claims();

function headers(){
  return {
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + TOKEN,
    'uuid': randomUUID(),
    'X-Investran-Database':    C.Database    || '',
    'X-Investran-Server':      C.Server      || '',
    'X-Investran-AccessToken': C.accessToken || ''
  };
}

// Module names to try. DataImport is included as the known-good control.
const MODULES = [
  'DataImport',          // control — must succeed
  'ReferenceData',
  'ReferenceDataV2',
  'CRM',
  'Accounting',
  'ReportWizard',
  'QueryManager',
  'ReportManager',
  'Lookup',
  'Lookups',
  'MetaData',
  'Metadata',
  'Common',
  'Core',
  'Security',
  'Entity',
  'Entities',
  'GeneralLedger',
  'GL',
  'AllocationRuleManager',
  'ActiveTemplateManager',
  'PCS'
];

const VERSIONS = ['v1', 'v2'];

async function tryGet(url){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers: headers(), signal: ctrl.signal });
    const txt = await res.text();
    return { status: res.status, txt };
  } catch(err){
    return { status: -1, txt: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally { clearTimeout(t); }
}

(async () => {
  console.log('\n  Probing Investran API modules');
  console.log('  base :', BASE);
  console.log('  ' + '─'.repeat(72) + '\n');

  const found = [];

  for(const mod of MODULES){
    for(const v of VERSIONS){
      const specUrl = BASE + '/' + mod + '/' + v + '/swagger/' + v + '/swagger.json';
      const r = await tryGet(specUrl);
      if(r.status === 200){
        let spec = null;
        try { spec = JSON.parse(r.txt); } catch(_){}
        if(spec && spec.paths){
          const n = Object.keys(spec.paths).length;
          const title = (spec.info && spec.info.title) || mod;
          console.log('  ✓ ' + (mod + '/' + v).padEnd(28) + n + ' paths   — ' + title);
          found.push({ mod, v, n, title, spec, specUrl });
          // Surface anything that looks like a lookup / master-data route
          const interesting = Object.keys(spec.paths).filter(p =>
            /lookup|account|entit|deal|position|security|currency|transaction-type|domain/i.test(p));
          if(interesting.length){
            interesting.slice(0, 12).forEach(p => console.log('        · ' + p));
            if(interesting.length > 12) console.log('        · … ' + (interesting.length - 12) + ' more');
          }
          break;   // found this module; skip other versions
        }
      }
    }
    process.stdout.write('.');
  }

  console.log('\n\n  ' + '─'.repeat(72));
  if(found.length){
    console.log('\n  Modules discovered:\n');
    found.forEach(f => console.log('    ' + (f.mod + '/' + f.v).padEnd(26) + String(f.n).padStart(4) + ' paths   ' + f.title));
    // Save every spec for reference
    const fs = require('fs');
    found.forEach(f => {
      const name = 'swagger-' + f.mod.toLowerCase() + '.json';
      fs.writeFileSync(__dirname + '/' + name, JSON.stringify(f.spec, null, 2));
    });
    console.log('\n  Specs saved as swagger-<module>.json\n');
  } else {
    console.log('\n  No modules found beyond DataImport.\n');
  }
})();
