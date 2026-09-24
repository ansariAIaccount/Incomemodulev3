/* ── Paste this whole file into the browser console on ANY build ───────────
 *
 * Answers "what is actually on the server?" without depending on a single
 * line of deployed app code. Use it when pcsDeployed() is not there yet —
 * which is precisely the case when the HTML carrying pcsDeployed() is the
 * thing that failed to deploy.
 *
 * Prints a table of every file: the hash on the server, the hash the build
 * expects, and current / STALE. Then names what to copy.
 *
 * Once the current HTML is deployed you do not need this — use:
 *     await pcsDeployed()
 * ────────────────────────────────────────────────────────────────────────── */
(async () => {
  const dir = location.pathname.replace(/[^/]*$/, '');
  const FILES = [
    'loan-module-v4-builder.html',
    'portf-excel-parser.js',
    'loan-module-engine.js',
    'loan-module-instruments.js',
    'loan-module-analytics.js',
    'demo-assistant-kb.js',
    'demo-assistant-system-prompt.js'
  ];

  const hash = async (name) => {
    try {
      const txt = await fetch(dir + name + '?v=' + Date.now(), { cache: 'no-store' })
        .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)));
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    } catch (e) { return 'MISSING (' + e.message + ')'; }
  };

  const manifest = await fetch(dir + 'build-manifest.json?v=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null).catch(() => null);

  const rows = {};
  const stale = [];
  for (const name of FILES) {
    const onServer = await hash(name);
    const expected = manifest && manifest.files && manifest.files[name];
    rows[name] = {
      onServer,
      expected: expected || '(no manifest)',
      status: !expected ? '?' : (onServer === expected ? 'current' : 'STALE')
    };
    if (expected && onServer !== expected) stale.push(name);
  }

  console.table(rows);
  console.log(manifest
    ? 'manifest ' + (manifest.version || '?') + ' · built ' + (manifest.generatedAt || '?')
    : 'build-manifest.json is NOT on the server — deploy it and the comparison becomes automatic.');

  if (stale.length) {
    console.error('%cDEPLOY THESE ' + stale.length + ' FILE(S):\n   · ' + stale.join('\n   · ') +
      '\n\nThen hard-reload (Cmd/Ctrl+Shift+R).', 'font-weight:600; font-size:13px');
  } else if (manifest) {
    console.log('%c✅  All ' + FILES.length + ' files current.',
      'color:#065F46; font-weight:600; font-size:13px');
  }
  return stale;
})();
