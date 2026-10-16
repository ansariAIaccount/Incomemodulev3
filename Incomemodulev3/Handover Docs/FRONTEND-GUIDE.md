# The Front End — Developer Guide

### `loan-module-v4-builder.html` · 3.2 MB · 56,285 lines · V4.67

One HTML file. Markup, styles and about 2.5 MB of JavaScript in 17 inline
`<script>` blocks, the largest of which is **1.69 MB on its own**. No build
step, no bundler, no framework. Your editor will struggle; that is normal.

This guide exists because the file has no other map, and because the three
things that will waste your time are not discoverable by reading it top to
bottom.

---

## 1 · Why one file

It is deployed by copying files onto static hosting. No Node at serve time, no
CI, no asset pipeline. The cost is this file; the benefit is that deployment is
`cp` and the app runs from `file://` if it has to.

The decision is load-bearing enough that you should not casually reverse it. If
you do want to split it, the inline blocks are the natural seams — but read §2
first, because the scoping is what makes them non-obvious.

### What loads, in order

```
CDN   tailwindcss                  styling
CDN   xlsx 0.18.5 (SheetJS)        Excel import + export
      portf-excel-parser.js        reads the PortF feed workbook
CDN   jspdf 2.5.1                  notice PDFs
      loan-module-engine.js        ← the calculations
      loan-module-instruments.js   demo deal definitions
      loan-module-analytics.js     dashboard / regulatory aggregation
      demo-assistant-kb.js         offline assistant corpus
      demo-assistant-kb-ifrs.js    IFRS Q&A corpus (189 KB, 256 entries)
      demo-assistant-system-prompt.js
```

Order matters: the engine must be present before the builder's IIFEs run.

---

## 2 · Scoping — the thing that will catch you

The file is a series of **IIFEs**. A function declared in one is invisible to
the others. There is no module system to tell you this; you find out when a
call silently does nothing.

Three consequences you will meet:

**`window.M` is permanently `undefined`.** `M` is the engine-side state object
(schedule, summary, journals, run history), declared at line ~16111 inside a
closure. It is never exposed. Debugging via `window.M` is a dead end.

**`window.B` *is* exposed** (line ~40281, `window.B = B`) and is the builder's
form state. It is the one piece of app state you can inspect from the console.

**Cross-IIFE calls must go through `window`.** When something in one block
needs a function from another, the function is assigned to `window.__name`.
There are ~200 of these. Two failure modes, both of which happened this week:

- Calling `window.__thing()` when `__thing` was only ever declared locally —
  returns `undefined`, no error. *(`_resolveActiveDealDbId` was local; the fee
  IFRS write called `window.__resolveActiveDealDbId` and always failed the
  lookup until it was exposed.)*
- Defining `window.__thing = ...` *inside* a function, so it does not exist
  until that function first runs. If another block calls it on page load, it is
  not there yet. Define at top level.

---

## 3 · State

### `B` — the builder form (`window.B`)

What is on screen in Deal Setup / Facility / Tranches / Fees.

```js
B = {
  deal:     { name, dealId, workdayId, counterparty, le, currency,
              framework, signingDate, settle, maturity, originalMaturity,
              maturityExtensions: [...], agentName, source, ... },
  facility: { name, commitment, availEnd, dayBasis, holiday, repayment, type },
  tranches: [...],
  fees:     [...],
  treatmentOverrides: {...}
}
```

`B.deal.source === 'external'` means the deal came from PortF. That one flag
drives the read-only gate (§6).

### `M` — the engine run (closure-scoped, not on window)

```js
M = {
  instrumentId, schedule[], summary, acctJournals[],
  workdayBatch, workdayActuals, reconciliation,
  treatmentDefaults{}, treatmentDirty{},
  acctRunMeta, acctRunHistory[]
}
```

### `INSTRUMENTS` — demo deals, from `loan-module-instruments.js`

### `window.SB` — the Supabase layer

One object, ~70 methods, exported at the end of the database IIFE. Every read
and write goes through it. Add a method there and list it in the export block;
there is no other registration.

---

## 4 · The data flow

```
Deal Setup form
   │  syncDealForm()      reads the DOM into B
   ▼
recompute()
   │  computeCashflows()  builder's own preview (B only — no engine)
   ▼
builderToInstrument()     B  →  the engine's instrument shape
   │
   ▼
registerBuilderInstrument()
   │  buildSchedule → summarize → generateDIU
   ▼
M.schedule, M.summary, M.acctJournals
   │
   ├─ renderStage1Cashflows()   the enriched cashflow grid
   ├─ __renderInlineJETable()   the journal register
   ├─ renderDashboard()
   └─ pushToWorkday()           → DIU batch
```

**Two cashflow tables exist and they are not the same.** The Loan Builder's own
preview comes from `computeCashflows()` and knows nothing about carrying value
or ECL. The Stage 1 grid is the engine's schedule, enriched. `renderRowDetail`
is shared by both, which is why its newer panels check for data and render
nothing when absent — on the builder preview there is nothing to show.

---

## 5 · Navigation — four places, all required

Adding a screen means four registrations. Miss one and the failure is silent.

| What | Where |
|---|---|
| 1. `<section id="x" class="stage-tab-content">` | the markup |
| 2. sidebar button `data-v4-tab="x"` | the nav |
| 3. hidden `<button class="tab-btn" data-tab="x">` | the router's target |
| 4. **the id in `TAB_IDS`** (~line 37789) | `switchTab` |

`switchTab` begins:

```js
if(!TAB_IDS.includes(tabId)) tabId = 'stage-1';
```

`stage-1` is the Cashflow screen. **A tab missing from `TAB_IDS` silently opens
Cashflow** — built, wired, unreachable, no error. This happened with the
Holiday Calendars screen. It now logs a warning, but the four-step rule stands.

Lazy loading goes in both `switchTab` and `v4NavClick`.

---

## 6 · The external read-only gate

`__applyExternalReadOnly()` (~line 27140). On a PortF-sourced deal the whole
Loan Builder and Lifecycle Events page go read-only — **deny by default**:

```js
root.querySelectorAll('input, select, textarea').forEach(el => {
  if(el.dataset.extAlwaysEditable === '1') return;   // explicit opt-out
  ...
  el.disabled = true;
});
```

Buttons work the same way, with a `SAFE_IDS` allowlist. A blacklist was tried
and failed: 24 controls had escaped it, including *Save to DB* (which writes
PCS's version over the feed's) and *Reset*.

**Two rules when you touch this:**

1. **Any renderer that rebuilds DOM must re-apply the gate**, because the new
   nodes are enabled. `renderFees`, `renderTranches` and `__mxRender` all end
   with a `__applyExternalReadOnly()` call. Follow the pattern.
2. **An `extAlwaysEditable` field usually cannot be saved the normal way.** Save
   to DB is disabled on external deals, so a field you unlock will accept a
   change and lose it on reload — worse than being locked. It needs a targeted
   write. See `updateFeeIFRSTreatment` for the shape: one column, one row,
   reports failure honestly including when the update matches nothing.

The only field currently carved out is the fee IFRS treatment, because that is
the fund's accounting judgement rather than the feed's data.

---

## 7 · The configuration screens

Three screens follow one pattern: **GL Mapping**, **Cashflow Configuration**,
**Holiday Calendars**.

```
_xState = { ...rows, loaded:false }   module state
__xLoad(force)                        fetch; force=true bypasses the cache
__xRender()                           paint from state
__xSave…()                            write, then __xLoad(true), then re-render
```

Two things that bite:

- **`__xLoad()` without `force` renders from cache.** After a write you must
  pass `true`, or the screen repaints the state your write just invalidated and
  the change appears to snap back.
- **Refresh the runtime map too.** The engine reads `window.PCS_GL_EVENT_MAP`,
  not `_glcState`. Saving the screen without calling `__refreshGLEventMap()`
  leaves the edit saved and inert until the next page load.

---

## 8 · User preferences in `localStorage`

Cashflow column visibility is the worked example, and it carries a lesson.

```js
{ v: 2, visible: [...], known: [...] }
```

`known` records **what the user was shown**, not just what they chose. Without
it the reader cannot distinguish "this column shipped after you saved" from
"you unchecked this column" — both look like a key missing from the list. The
v1 format stored only `visible`, and the merge-in-new-columns logic silently
undid every uncheck.

If you store a preference as a subset, store the universe alongside it.

---

## 9 · Build and release

No bundler. `.githooks/pre-commit` does the work:

1. bumps `PCS_VERSION_MINOR`
2. rewrites the `?v=` cache-busters on every `<script src>`
3. regenerates `build-manifest.json` with SHA-256 prefixes

```bash
cd <repo root>               # NOT the app dir — the scripts live one level up
git commit …                 # hook bumps + regenerates
./deploy.sh /path/to/webroot # copies all 9 files, prints hashes
```

Deploy ships **nine files**. Copying some of them leaves the page looking
current — right version label, no errors — while behaving like an older build.
That is how two accounting fixes once went missing. `deploy.sh` checks all nine
exist before copying any.

In-app: a red banner names any file whose hash disagrees with the manifest, and
`await pcsVersion()` prints detail. Out of app: `./check-manifest.sh`, also
from the repo root.

---

## 10 · Working on it

**Verify before you reload.** You can parse-check every block without opening a
browser:

```bash
python3 - <<'PY'
import re,subprocess,os
p="loan-module-v4-builder.html"
h=re.sub(r'<!--.*?-->','',open(p,encoding='utf-8').read(),flags=re.S)  # strip comments FIRST
inline=[(a,b) for a,b in re.findall(r'<script\b([^>]*)>(.*?)</script>',h,re.S|re.I)
        if 'src=' not in a.lower()]
os.makedirs('/tmp/chk',exist_ok=True)
for i,(a,b) in enumerate(inline):
    f=f'/tmp/chk/s{i}.js'; open(f,'w').write(b)
    r=subprocess.run(['node','--check',f],capture_output=True,text=True)
    if r.returncode: print(f"BLOCK {i} FAILED\n{r.stderr[:600]}")
print(f"{len(inline)} blocks checked")
PY
```

Strip HTML comments first — one comment in this file contains the literal text
`<script>` and a naive regex matches it as a tag.

**This proves the page will load. It does not prove anything is wired.** Two
changes this week were correct in the file and invisible in the app. Open the
screen.

**Known untidiness:** duplicate element ids exist — `stage-2`, `dashboard`, and
ten `bench-*`. Pre-existing. `getElementById` silently returns the first, so
this is a live hazard if you add handlers to those.
