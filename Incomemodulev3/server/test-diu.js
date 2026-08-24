#!/usr/bin/env node
/**
 * test-diu.js — exercise the DIU endpoints through the local proxy.
 *
 * Runs the read-only discovery calls first (safe — no writes), which is
 * enough to prove auth, tenant routing and the uuid header all work.
 * Only touches write endpoints if you pass --write.
 *
 * Usage:
 *   node test-diu.js            read-only probes
 *   node test-diu.js --write    also create + delete a throwaway job
 */

const PROXY = process.env.PROXY_URL || 'http://localhost:4318';
const DO_WRITE = process.argv.includes('--write');

async function call(method, path, body){
  const res = await fetch(PROXY + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch(_){ data = { raw: txt.slice(0,300) }; }
  return { status: res.status, data };
}

function show(title, r){
  const ok = r.data && r.data.ok;
  const mark = ok ? '✓' : '✗';
  console.log('\n  ' + mark + ' ' + title + '   (HTTP ' + r.status + ')');
  const payload = ok ? (r.data.domains || r.data.entities || r.data.metadata
                     || r.data.job || r.data.summary || r.data.process || r.data)
                     : (r.data.error || r.data);
  const s = JSON.stringify(payload, null, 2);
  console.log('    ' + (s.length > 900 ? s.slice(0, 900) + '\n    …truncated' : s).replace(/\n/g, '\n    '));
  return ok;
}

(async () => {
  console.log('\n  DIU endpoint test  ·  proxy ' + PROXY);
  console.log('  ' + '─'.repeat(70));

  // 0 · proxy health — confirms config before we touch Investran
  const h = await call('GET', '/healthz');
  console.log('\n  Proxy config:');
  console.log('    base      ', h.data.investranBase);
  console.log('    diuRoot   ', h.data.diuRoot);
  console.log('    authMode  ', h.data.authMode);
  console.log('    token     ', h.data.tokenDaysLeft + ' days left');
  console.log('    tenant    ', h.data.tenant && h.data.tenant.database);

  // 1 · domains — the cheapest real call. If this returns, then the token,
  //     the uuid header and tenant routing are ALL working.
  const domains = await call('GET', '/api/diu/domains');
  const domainsOk = show('GET /api/diu/domains', domains);

  // 2 · entities — list of importable entity types
  const entities = await call('GET', '/api/diu/entities');
  show('GET /api/diu/entities', entities);

  // 3 · metadata for a GL-ish entity, if we can spot one in the list
  if(entities.data && entities.data.ok){
    const list = entities.data.entities;
    const names = Array.isArray(list) ? list
                : (list && Array.isArray(list.value) ? list.value : []);
    const flat = names.map(n => (typeof n === 'string' ? n : (n && (n.Name || n.name)))).filter(Boolean);
    const glLike = flat.find(n => /journal|gl|ledger|transaction/i.test(n));
    if(glLike){
      console.log('\n  Found a GL-like entity: "' + glLike + '"');
      const meta = await call('GET', '/api/diu/metadata?entityName=' + encodeURIComponent(glLike));
      show('GET /api/diu/metadata?entityName=' + glLike, meta);
    } else if(flat.length){
      console.log('\n  Entity names available: ' + flat.slice(0, 40).join(', '));
    }
  }

  if(!DO_WRITE){
    console.log('\n  ' + '─'.repeat(70));
    console.log('\n  Read-only probes done.' +
      (domainsOk ? '  Auth + tenant routing + uuid header all working.' : ''));
    console.log('  Re-run with --write to create and delete a throwaway job.\n');
    return;
  }

  // 4 · write path — create a job with no file, then delete it. Harmless,
  //     but it proves the POST contract and the DomainId resolution.
  console.log('\n  ' + '─'.repeat(70));
  console.log('\n  Write test (creates then deletes a throwaway job)');
  const created = await call('POST', '/api/diu/jobs', {
    name: 'PCS-connectivity-test-' + Date.now(),
    fileId: 0,
    domainId: -1
  });
  const createdOk = show('POST /api/diu/jobs', created);
  if(createdOk && created.data.jobId != null){
    const del = await call('DELETE', '/api/diu/jobs/' + created.data.jobId);
    show('DELETE /api/diu/jobs/' + created.data.jobId, del);
  }
  console.log('');
})();
