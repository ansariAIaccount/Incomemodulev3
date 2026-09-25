# PCS Loan Module — deployment spec

**Audience:** DevOps / release engineering
**Application:** PCS Loan Module V4 (static front-end, no build step)
**Source:** `Incomemodulev3/` in this repository
**Target example:** `<webroot>/pocs/pe-loan-integration/`

---

## 1. What gets deployed

**Eight files, all from `Incomemodulev3/`, all to the same directory.**
There is no bundler, no transpile, no `dist/`. What is in the repo is what
runs in the browser.

| # | File | Notes |
|---|---|---|
| 1 | `loan-module-engine.js` | Calculation engine — accrual, EIR, ECL, journals |
| 2 | `portf-excel-parser.js` | Import parser for the PortF workbook |
| 3 | `loan-module-instruments.js` | Seed deal presets |
| 4 | `loan-module-analytics.js` | Benchmarks / analytics |
| 5 | `demo-assistant-kb.js` | Assistant knowledge base |
| 6 | `demo-assistant-system-prompt.js` | Assistant prompt |
| 7 | `loan-module-v4-builder.html` | The application — entry point |
| 8 | `build-manifest.json` | Expected SHA-256 of files 1–7 |

**Do not deploy a subset.** The app is not self-contained in the HTML. A
partial deploy leaves the page looking completely normal — correct version
label, no console errors — while running older logic. This has already caused
two accounting fixes to be silently absent in a live environment, producing
wrong figures with nothing on screen indicating a problem.

Everything else in the repo (`*.md`, `.githooks/`, `deploy.sh`, `server/`) is
**not** deployed.

---

## 2. Order

Order matters because the HTML references the scripts by versioned URL
(`loan-module-engine.js?v=4.1`). Deploy so that a reference never points at
content that has not arrived yet.

```
Step 1   files 1–6   (the .js assets)
Step 2   file 7      (loan-module-v4-builder.html)
Step 3   file 8      (build-manifest.json)
```

- **Scripts first.** The new HTML requests `?v=<new>`; those bytes must already
  be on disk or the first user after the HTML lands gets a 404 or stale asset.
- **HTML second.** It is the entry point. Until it is replaced, users keep
  running the old app — which is a safe state.
- **Manifest last.** It is the verification target. Publishing it before the
  files it describes makes the self-check report failures that are merely
  in-flight.

**Preferred: make it atomic.** Deploy into a fresh directory and swap a symlink
(or equivalent) so no user ever sees a half-updated set:

```sh
rsync -a --delete Incomemodulev3/ /srv/releases/pcs-$(git rev-parse --short HEAD)/
ln -sfn /srv/releases/pcs-<sha> /srv/current     # atomic swap
```

With an atomic swap the three-step order above stops mattering, which is the
better outcome.

---

## 3. Cache headers — the important part

The single largest source of failed deployments here has been **browser
caching**, not the copy itself. Files were correct on the server while browsers
kept executing older copies.

Required:

| Path | `Cache-Control` | Reason |
|---|---|---|
| `loan-module-v4-builder.html` | `no-cache` | Entry point. Must revalidate every load or a deploy never takes effect. |
| `build-manifest.json` | `no-cache` | Verification target. A cached manifest validates against the wrong build. |
| `*.js` | `no-cache` **for now** | See below. |

The HTML now appends `?v=<version>` to every local script, and the version
increments on each commit, so in principle the `.js` files can be cached
aggressively (`public, max-age=31536000, immutable`). **Do not switch to that
until the commit hook is confirmed running and the version is observably
incrementing in production** — a long cache lifetime on an asset whose URL
stops changing is unrecoverable without a manual purge.

Also confirm any CDN or reverse proxy in front of this **varies on the query
string**. Some proxies strip or ignore `?v=`, which silently defeats the
cache-buster.

---

## 4. Verification

After deploying, load the app and run in the browser console:

```js
await pcsDeployed()
```

| Result | Meaning |
|---|---|
| `✅ All files deployed and running` | Done. |
| `❌ N file(s) NOT deployed` + names | Those files did not land. Re-copy them. |
| `⚠ This page is running cached code` | Files are correct; the browser cached them. Fixes itself on a hard reload; if it recurs, the cache headers above are not applied. |
| `⚠ Cannot verify` | `build-manifest.json` is missing from the server. |

A **red banner across the top of the page** appears automatically on load if
anything is stale — no command needed. It is visible before sign-in.

For per-file detail: `await pcsVersion()` prints every file with its hash on
the server, the hash expected, and current/STALE.

**Smoke test after any deploy:** sign in, open an imported (external) deal, run
accounting, and confirm the journals include `Loan Drawdown` and
`Impairment Expense (ECL)` rows. Their absence is the signature of a partial
deploy and is not otherwise visible.

---

## 5. Pipeline requirements

1. **Deploy all eight files as one unit.** Never file-by-file, never "only what
   changed" — the manifest and the HTML must always move together with the
   assets they describe.
2. **Deploy from a committed tree.** `build-manifest.json` is generated at
   commit time by `.githooks/pre-commit`. Deploying uncommitted edits produces
   a manifest that does not match the files, and the self-check reports STALE
   for files that are in fact newer.
3. **Ensure the commit hook runs in CI**, or generate the manifest in the
   pipeline. If neither happens the version stops incrementing, the `?v=`
   cache-buster stops changing, and stale-cache failures return. Hook install
   is per-clone:
   ```sh
   git config core.hooksPath .githooks
   ```
4. **Fail the pipeline if any of the eight files is missing** from the source
   tree rather than deploying a partial set. `deploy.sh` already does this —
   it verifies all eight exist before copying any.

---

## 6. Rollback

Redeploy the previous release directory (or flip the symlink back). The app
holds no client-side migrations, so rolling the files back rolls the behaviour
back.

**Caveat — data does not roll back.** Accounting runs written by a newer build
stay in Supabase. In particular, runs produced after the ECL and principal
fixes contain journal rows an older build would not have generated. Rolling
back the front end does not remove them, and an older build will display them
without complaint.

---

## 7. Known noise, not deployment failures

- `favicon.svg 404` — no favicon file is deployed. Cosmetic; add one or ignore.
- `cdn.tailwindcss.com should not be used in production` — Tailwind is loaded
  from CDN at runtime. A real (separate) production concern, not a deploy
  error.
- `[icon-shim] … still unmapped` — informational.

---

## 8. Quick reference

```sh
# From the repo root, after committing:
./deploy.sh /path/to/webroot/pocs/pe-loan-integration

# Verifies all 8 exist, copies them, prints each hash.
# Then in the browser console:
#   await pcsDeployed()
```

The authoritative list of files and their expected hashes is always
`Incomemodulev3/build-manifest.json` — read it rather than hardcoding hashes
anywhere, since they change with every commit.
