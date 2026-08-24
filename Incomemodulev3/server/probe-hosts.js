#!/usr/bin/env node
/**
 * probe-hosts.js — locate the DIU API now that we know a real Investran host.
 *
 * The MCP proxy talks to:
 *   https://investranweb-livedev-us.fiscloudservices.com/api/mcp
 *
 * That proves /api/ is a valid root on the fiscloudservices.com domain — our
 * earlier 404s were caused by probing the wrong HOST (fisglobal.com), not a
 * wrong path. This script:
 *
 *   1. Probes DIU paths on the known-good livedev host.
 *   2. Probes UAT-named siblings, since our token is scoped to goldenliveuat
 *      (Database claim) and livedev is a different environment.
 *
 * Reading results:
 *   404 → not there
 *   401 → route EXISTS, token rejected (wrong env for this token — still a win)
 *   200/400/405 → route EXISTS and reachable
 *
 * Usage:  node probe-hosts.js
 */

require('dotenv').config();

const TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();
if(!TOKEN){ console.error('INVESTRAN_BEARER_TOKEN not set'); process.exit(1); }

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

// Hosts: the proven one first, then UAT-named siblings following the same
// naming convention. Our token's Database claim is goldenliveuat, so a UAT
// host is the more likely home for it.
const HOSTS = [
  'https://investranweb-livedev-us.fiscloudservices.com',
  'https://investranweb-uat-us.fiscloudservices.com',
  'https://investranweb-liveuat-us.fiscloudservices.com',
  'https://investranweb-uat-live-us.fiscloudservices.com',
  'https://investranweb-golden-us.fiscloudservices.com',
  'https://investranweb-us.fiscloudservices.com'
];

// Paths under /api/ worth testing. 'mcp' is the known-good control — if it
// answers, the host is alive and our headers are being accepted.
const PATHS = [
  ['GET',  '/api/mcp'],                       // control
  ['GET',  '/api/swagger/v1/swagger.json'],
  ['GET',  '/api/DataImport'],
  ['POST', '/api/DataImport/jobs'],
  ['GET',  '/api/DataImport/domains'],
  ['GET',  '/api/DataImport/entities'],
  ['POST', '/api/dataimport/jobs'],
  ['GET',  '/api/lookups/30'],                // documented PCS-API shape
  ['GET',  '/api/ReferenceData'],
  ['GET',  '/api/ReportWizard']
];

function label(s){
  if(s === -1)  return 'ERR ';
  if(s === 404) return '404 ';
  if(s === 401) return '401  ◀ EXISTS, auth rejected';
  if(s === 403) return '403  ◀ EXISTS, forbidden';
  if(s === 405) return '405  ◀ EXISTS, wrong method';
  if(s === 400) return '400  ◀ EXISTS, bad payload';
  if(s >= 200 && s < 300) return String(s) + '  ◀ OK';
  return String(s) + '  ◀';
}

(async () => {
  console.log('\n  Probing Investran hosts on fiscloudservices.com');
  console.log('  token tenant :', C.Database || '(none)', '·', C.Server || '(none)');
  console.log('  ' + '─'.repeat(76));

  const hits = [];
  for(const host of HOSTS){
    console.log('\n  ' + host);
    let hostAlive = false;
    for(const [method, path] of PATHS){
      let status = -1, note = '';
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(host + path, {
          method,
          headers: HEADERS,
          body: method === 'POST'
            ? JSON.stringify({ Name: 'probe', DomainId: 1, EntityId: 1 })
            : undefined,
          redirect: 'manual',
          signal: ctrl.signal
        });
        clearTimeout(t);
        status = res.status;
        hostAlive = true;
        if(status !== 404){
          const ct = res.headers.get('content-type') || '';
          const txt = await res.text();
          const plain = ct.includes('json')
            ? txt.slice(0, 100)
            : txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
          if(plain) note = ' · ' + plain;
        }
      } catch(err){
        note = ' · ' + (err.name === 'AbortError' ? 'timeout'
              : /ENOTFOUND|EAI_AGAIN/.test(err.message) ? 'DNS: host does not exist'
              : err.message.slice(0, 50));
      }
      if(status !== 404){
        console.log('    ' + label(status).padEnd(30) + method.padEnd(5) + path + note);
        if(status > 0) hits.push({ host, method, path, status });
      }
      // If DNS failed on the control probe, skip the rest of this host.
      if(status === -1 && path === '/api/mcp' && /DNS/.test(note)) break;
    }
    if(!hostAlive) console.log('    (host unreachable)');
  }

  console.log('\n  ' + '─'.repeat(76));
  if(hits.length){
    console.log('\n  Reachable routes:\n');
    hits.forEach(h => console.log('    ' + String(h.status).padEnd(5) + h.method.padEnd(5) + h.host + h.path));
    console.log('');
  } else {
    console.log('\n  No non-404 routes found.\n');
  }
})();
