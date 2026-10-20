# POCI — verification card

**Four checks. Two minutes. Do them before the demo, not during it.**

---

## 0 · First, make sure you are running the fixed build

A hard reload is required — your tab has the old engine in memory, and the
browser may also have it cached.

**Hard reload:** `Cmd + Shift + R` (Mac) · `Ctrl + Shift + R` (Windows)

Then in the console (`Cmd+Opt+J`) run:

```js
pcsVersion()
```

It **prints a table and returns `{}`** — read the printed output, not the
return value. You want:

```
label         V4.69 · 2026.10.20
manifest      V4.69 · built 2026-10-20T...
loan-module-engine.js   ... 'current'
All 8 deployed files match the manifest.
```

The version badge on its own is not enough — the HTML carries the label, so
the page can say V4.69 while running a cached engine beside it. That is exactly
how two accounting fixes went missing before. If the table marks
`loan-module-engine.js` **STALE**, the fix has not reached your browser:
hard-reload again, and if it persists the files need deploying.

> Fixed in V4.69: the runtime list is now derived from the manifest, so it
> cannot drift from it again. Before V4.69 it checked 7 of 8 files and never
> hashed `demo-assistant-kb-ifrs.js`.

*If the page says V4.67:* you are on a deployed copy that has not been updated.
Run `./deploy.sh <webroot>` from the repo root, then reload. *If the URL is
`localhost:8080` or similar pointed at the repo*, a hard reload is all that is
needed — there is nothing to deploy.

---

## 1 · `DEMO-POCI-PAR` — the one you can check in your head

| Check | Expected |
|---|---|
| Credit-adjusted EIR | **13.3333%** |
| Carrying value, every year end | **60,000,000.00** — flat, exactly |
| Accretion | **0.00** |

**13.3333% = 8.00% × 100,000,000 / 60,000,000.** The coupon grossed up by what
you actually paid. If this deal is right, the solve is right.

---

## 2 · `DEMO-POCI-MID` — convergence

| Check | Expected |
|---|---|
| Credit-adjusted EIR | **16.2241%** |
| Carrying value at maturity (31 Dec 2031) | **78,000,000.00** — exactly, not 80.4m |
| Accretion over life | **18,000,000.00** |

This is the one that was broken: it used to finish at **80,379,504.83**, a 3.05%
overshoot. If you see anything near 80m you are still on the old engine — go
back to step 0.

**Identity check**, on the Cashflow tab with *Accreted to date* and *Unaccreted*
side by side — at **any** period the two must sum to 18,000,000:

| | accreted | unaccreted | sum |
|---|---:|---:|---:|
| end 2026 | 1,911,008.89 | 16,088,991.11 | 18,000,000.00 |
| end 2029 | 9,958,099.74 | 8,041,900.26 | 18,000,000.00 |

---

## 3 · `DEMO-POCI` — the 2028 revision

| Check | Expected |
|---|---|
| Credit-adjusted EIR | **15.7803%** |
| ECL allowance before 1 Jan 2028 | **0.00** |
| ECL allowance from 1 Jan 2028 | **(10,000,000.00)** — negative |
| Net carrying > gross carrying from that date | yes — 73,513,378.23 against 63,513,378.23 |
| EIR on either side of the revision | **unchanged at 15.7803%** |

The last row is the IFRS 9 point: a POCI asset's credit-adjusted rate is
**never** revised (§B5.4.7). The revision lands entirely in the allowance.

---

## 4 · All three — day one

| Check | Expected |
|---|---|
| Day-one ECL allowance | **nil** on all three |
| Gross carrying at 1 Jan 2026 | **60,000,000**, not 100,000,000 |
| EIR shown | the credit-adjusted rate, **never 8.00%** |

---

## Still open — do not demo these

- **#71** — the maturity leg repays **face**. Correct on `DEMO-POCI`, wrong on
  `MID` and `PAR`. **Stop before the maturity journal on those two.**
- **#72** — POCI deals still show "Stage 1". It is a display default, not a
  measurement. POCI has no stages.

---

## If a number disagrees

Tell me which deal, which figure, what the screen says. Do not adjust the
script to match the screen — the figures in it are engine output as of
20 October 2026 and all three deals converge to 0.00 drift. A disagreement
means either the build is stale (step 0) or something changed after that date,
and both are worth knowing about before a client sees it.
