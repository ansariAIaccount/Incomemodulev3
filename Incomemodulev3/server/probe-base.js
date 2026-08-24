#!/usr/bin/env node
/**
 * probe-base.js — find where the Investran API actually lives on this host.
 *
 * Context: every path under <host>/api/ returned an IIS 404, including the
 * /api/ root itself and known surfaces like ReferenceData and ReportWizard.
 * That means the base URL is wrong, not just the DIU sub-path.
 *
 * This probes application roots rather than DIU endpoints. We're looking for
 * ANY response that isn't a 404 — a 401/403 is a great result because it
 * means we've found a real application that's evaluating our token.
 *
 * Usage:  node probe-base.js
 */

require('dotenv').config();

const RAW   = (process.env.INVESTRAN_BASE_URL || '').replace(/\/$/, '');
const TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();
if(!RAW)   { console.error('INVESTRAN_BASE_URL not set'); process.exit(1); }
if(!TOKEN) { console.error('INVESTRAN_BEARER_TOKEN not set'); process.exit(1); }

// Strip any trailing /api so we can probe from the true host root.
const HOST = RAW.replace(/\/api$/i, '');

function claims(){
  try {
    const p = TOKEN.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64').toString('utf8'));
  } catch(_){ return {}; }
}
const C = claims();

const HEADERS = {
  'Authorization': 'Bearer ' + TOKEN,
  'Accept': 'application/json',
  'X-Investran-Database':    C.Database    || '',
  'X-Investran-Server':      C.Server      || '',
  'X-Investran-AccessToken': C.accessToken || ''
};

// Application roots to try. Investran is an ASP.NET app; FIS deployments
// commonly mount the web API under a named virtual directory rather than a
// bare /api.
const ROOTS = [
  '',
  '/api',
  '/api/v1',
  '/api/v2',
  '/webapi',
  '/WebApi',
  '/InvestranWebApi',
  '/Investran',
  '/InvestranAPI',
  '/InvestranWeb',
  '/InvestranWeb/api',
  '/Investran/api',
  '/services',
  '/Services',
  '/rest',
  '/odata',
  '/OData',
  '/api/odata',
  // Database-scoped variants — some tenants route by DB name in the path
  '/' + (C.Database || 'db'),
  '/' + (C.Database || 'db') + '/api',
  // Version-in-host-path patterns
  '/v1', '/v2'
];

// For each root, a couple of cheap discovery probes.
const LEAVES = ['', '/swagger/v1/swagger.json', '/$metadata', '/DataImport', '/ReferenceData'];

function label(s){
  if(s === -1)  return 'ERR  network';
  if(s === 404) return '404';
  if(s === 401) return '401  ◀── EXISTS, auth evaluated';
  if(s === 403) return '403  ◀── EXISTS, forbidden';
  if(s === 405) return '405  ◀── EXISTS, wrong method';
  if(s >= 200 && s < 300) return String(s) + '  ◀── OK';
  if(s >= 300 && s < 400) return String(s) + '  ◀── redirect';
  return String(s) + '  ◀──';
}

(async () => {
  console.log('\n  Hunting for the Investran API root');
  console.log('  host   :', HOST);
  console.log('  tenant :', C.Database || '(none)');
  console.log('  ' + '─'.repeat(74) + '\n');

  const hits = [];
  for(const root of ROOTS){
    for(const leaf of LEAVES){
      const url = HOST + root + leaf;
      let status = -1, note = '';
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(url, { method: 'GET', headers: HEADERS, redirect: 'manual', signal: ctrl.signal });
        clearTimeout(t);
        status = res.status;
        if(status !== 404){
          const loc = res.headers.get('location');
          if(loc) note = ' → ' + loc.slice(0, 90);
          else {
            const ct = res.headers.get('content-type') || '';
            const txt = await res.text();
            const plain = ct.includes('json') ? txt.slice(0,110)
                        : txt.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,110);
            if(plain) note = ' · ' + plain;
          }
        }
      } catch(err){
        note = ' · ' + (err.name === 'AbortError' ? 'timeout' : err.message.slice(0,60));
      }
      if(status !== 404){
        const shown = (root || '/') + (leaf || '');
        console.log('  ' + label(status).padEnd(34) + shown + note);
        hits.push({ url, status, note });
      }
    }
    process.stdout.write('.');
  }

  console.log('\n\n  ' + '─'.repeat(74));
  if(hits.length){
    console.log('\n  Live endpoints found:\n');
    hits.forEach(h => console.log('    ' + String(h.status).padEnd(5) + h.url));
    console.log('');
  } else {
    console.log('\n  Nothing responded on any root — every probe 404\'d.');
    console.log('  The API is behind a different hostname or a path we have not');
    console.log('  guessed. This needs the exact URL from FIS.\n');
  }
})();
