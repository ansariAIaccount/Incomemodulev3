#!/usr/bin/env node
/**
 * fetch-swagger.js — pull the DIU OpenAPI document and summarise it.
 *
 * Swagger UI lives at:
 *   https://investran-uat-us-live.fisglobal.com/api/DataImport/v1/swagger/index.html
 *
 * The UI is just a viewer; the machine-readable spec sits nearby. This tries
 * the conventional locations, then prints every path, method, parameter and
 * request-body schema so we can build the proxy against the real contract
 * instead of guessing resource names.
 *
 * Saves the raw spec to swagger-diu.json for reference.
 *
 * Usage:  node fetch-swagger.js
 */

require('dotenv').config();

const DIU_BASE = process.env.INVESTRAN_DIU_BASE
  || 'https://investran-uat-us-live.fisglobal.com/api/DataImport/v1';
const TOKEN = (process.env.INVESTRAN_BEARER_TOKEN || '').trim();

function claims(){
  try {
    const p = TOKEN.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64').toString('utf8'));
  } catch(_){ return {}; }
}
const C = claims();

const HEADERS = {
  'Accept': 'application/json',
  'Authorization': 'Bearer ' + TOKEN,
  'X-Investran-Database':    C.Database    || '',
  'X-Investran-Server':      C.Server      || '',
  'X-Investran-AccessToken': C.accessToken || ''
};

// Conventional spec locations relative to a Swagger UI mount point.
const CANDIDATES = [
  DIU_BASE + '/swagger/v1/swagger.json',
  DIU_BASE + '/swagger/swagger.json',
  DIU_BASE + '/swagger/v1/swagger.yaml',
  DIU_BASE + '/swagger.json',
  DIU_BASE + '/openapi.json',
  DIU_BASE + '/swagger/docs/v1',
  DIU_BASE + '/swagger/index.html'   // last resort: scrape the URL out of the HTML
];

async function get(url){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    const txt = await res.text();
    return { status: res.status, txt, ct: res.headers.get('content-type') || '' };
  } finally { clearTimeout(t); }
}

function summarise(spec){
  const title = (spec.info && spec.info.title) || '(untitled)';
  const version = (spec.info && spec.info.version) || '';
  console.log('\n  ' + '═'.repeat(74));
  console.log('  ' + title + '  ' + version);
  if(spec.servers && spec.servers.length){
    console.log('  servers: ' + spec.servers.map(s => s.url).join(', '));
  } else if(spec.basePath){
    console.log('  basePath: ' + spec.basePath);
  }
  console.log('  ' + '═'.repeat(74));

  const paths = spec.paths || {};
  const keys = Object.keys(paths).sort();
  console.log('\n  ' + keys.length + ' paths\n');

  // Resolve a $ref into the components/definitions dictionary.
  const resolve = (ref) => {
    if(!ref || typeof ref !== 'string') return null;
    const parts = ref.replace(/^#\//, '').split('/');
    let node = spec;
    for(const p of parts){ node = node && node[p]; }
    return node;
  };

  const schemaBrief = (schema, depth) => {
    if(!schema) return '';
    if(schema.$ref){
      const r = resolve(schema.$ref);
      const name = schema.$ref.split('/').pop();
      if(depth > 1) return name;
      return name + (r ? ' ' + schemaBrief(r, depth + 1) : '');
    }
    if(schema.type === 'array') return '[' + schemaBrief(schema.items, depth + 1) + ']';
    if(schema.properties){
      const props = Object.entries(schema.properties).slice(0, 14).map(([k, v]) => {
        const t = v.$ref ? v.$ref.split('/').pop() : (v.type || '?');
        const req = (schema.required || []).includes(k) ? '*' : '';
        return k + req + ':' + t;
      });
      const more = Object.keys(schema.properties).length > 14 ? ', …' : '';
      return '{ ' + props.join(', ') + more + ' }';
    }
    return schema.type || '';
  };

  for(const p of keys){
    const ops = paths[p];
    for(const method of ['get','post','put','patch','delete']){
      const op = ops[method];
      if(!op) continue;
      console.log('  ' + method.toUpperCase().padEnd(7) + p);
      if(op.summary) console.log('          ' + op.summary);

      const params = (op.parameters || []).concat(ops.parameters || []);
      if(params.length){
        params.forEach(pr => {
          const d = pr.$ref ? resolve(pr.$ref) : pr;
          if(!d) return;
          const t = (d.schema && (d.schema.type || (d.schema.$ref || '').split('/').pop())) || d.type || '?';
          console.log('          · ' + (d.in || '?').padEnd(6) + (d.name || '') +
                      (d.required ? '*' : '') + ' : ' + t);
        });
      }

      const rb = op.requestBody;
      if(rb){
        const content = rb.content || {};
        for(const [mime, def] of Object.entries(content)){
          console.log('          body [' + mime + ']' + (rb.required ? ' *required' : ''));
          const b = schemaBrief(def.schema, 0);
          if(b) console.log('               ' + b);
        }
      }

      const resp = op.responses || {};
      const codes = Object.keys(resp).slice(0, 6);
      if(codes.length) console.log('          → ' + codes.join(', '));
      console.log('');
    }
  }
}

(async () => {
  console.log('\n  Fetching DIU OpenAPI spec');
  console.log('  base :', DIU_BASE);
  console.log('  ' + '─'.repeat(74) + '\n');

  for(const url of CANDIDATES){
    let r;
    try { r = await get(url); }
    catch(err){ console.log('  ✗ ' + url + '  · ' + err.message.slice(0,60)); continue; }

    console.log('  ' + String(r.status).padEnd(5) + url);

    if(r.status !== 200) continue;

    // If we landed on the HTML viewer, dig the spec URL out of it.
    if(r.ct.includes('html') || r.txt.trim().startsWith('<')){
      const m = r.txt.match(/url\s*:\s*["']([^"']+)["']/)
             || r.txt.match(/["']([^"']*swagger[^"']*\.json)["']/);
      if(m){
        const specUrl = m[1].startsWith('http') ? m[1]
          : new URL(m[1], url).toString();
        console.log('        ↳ HTML viewer references: ' + specUrl);
        try {
          const r2 = await get(specUrl);
          if(r2.status === 200){
            const spec = JSON.parse(r2.txt);
            require('fs').writeFileSync(__dirname + '/swagger-diu.json', r2.txt);
            console.log('        ✓ spec retrieved · saved to swagger-diu.json');
            summarise(spec);
            return;
          }
        } catch(e){ console.log('        ✗ could not parse referenced spec: ' + e.message); }
      } else {
        console.log('        (HTML, no spec URL found inside)');
      }
      continue;
    }

    try {
      const spec = JSON.parse(r.txt);
      require('fs').writeFileSync(__dirname + '/swagger-diu.json', r.txt);
      console.log('        ✓ spec retrieved · saved to swagger-diu.json');
      summarise(spec);
      return;
    } catch(_){
      console.log('        (200 but not JSON — first 200 chars:)');
      console.log('        ' + r.txt.slice(0, 200).replace(/\s+/g,' '));
    }
  }

  console.log('\n  Could not retrieve the spec automatically.');
  console.log('  Open the Swagger UI in a browser, then either:');
  console.log('    • use its "/swagger.json" link and save the file here as swagger-diu.json, or');
  console.log('    • paste the endpoint list into chat.\n');
})();
