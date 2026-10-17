# The Engine — Developer Guide

### `loan-module-engine.js` · 324 KB · 60 top-level functions · V4.67

This is the file that decides what the numbers are. Everything else in the
project displays, stores or transmits what this produces. If you read one file
before changing anything, read this one — and read this guide first, because
the file has three structural traps that will cost you a day each.

---

## 1 · The shape of it

Six entry points matter. Everything else is called by one of them.

| Function | Line ≈ | Takes | Returns |
|---|---|---|---|
| `buildSchedule(instr)` | 1183 | an instrument | one row **per calendar day**, settlement → maturity |
| `summarize(rows, from, to)` | 3420 | those rows | totals for a window |
| `generateDIU(instr, summary, opts)` | 4174 | instrument + summary | journal entries |
| `generateDIUFromExternalFeed(instr, rows, opts)` | 4987 | a PortF feed | journal entries from **received** data |
| `splitInterestJEsByCouponPeriod(journals, inst, schedule)` | 5266 | journals | journals, with aggregates expanded per period |
| `applyInvestranGLMapping(entries)` | 3930 | journals | journals with Investran GL accounts |

The normal path is **buildSchedule → summarize → generateDIU →
splitInterestJEsByCouponPeriod**. An external (PortF) deal substitutes
`generateDIUFromExternalFeed` for `generateDIU`.

### The daily row is the contract

`buildSchedule` returns one object per day with ~90 fields. That row object is
the interface between the engine and everything downstream — the cashflow
grid, the journals, the dashboard, the exports. **Adding a field to it is
cheap; changing the meaning of an existing one is not.** Four surfaces read
some of these independently.

Fields you will care about most:

```
date, balance, drawnBalance, carryingValue, netCarryingValue
dailyCash          cash interest accrued today, at the coupon rate
amortDaily         discount accretion / premium amortisation today
cumAmort           the same, life-to-date
eirYieldUsed       the EIR that produced amortDaily (null if none in force)
eirDcf             the day-count factor used with it
eclAllowance       allowance level today
dailyECLChange     movement today
eclTrace           the INPUTS behind today's allowance (see §4)
draw, paydown, prepayment, writeOff, recovery, loanSale, ...
```

---

## 2 · Three traps

### Trap 1 — indentation lies

`buildSchedule` spans **lines 1183–1983**, and several functions that *look*
top-level are declared inside it at column 0:

```js
computeCompoundedRFR     // looks top-level; is NOT
lookupMarginBps          // same
```

They close over `instr` and the loop's locals. You cannot call them from
outside, you cannot unit-test them directly, and moving one out of the
function will break it silently because it will stop seeing the variables it
depends on. Check the brace depth before you trust the indentation.

### Trap 2 — `window.M` is permanently undefined

The builder's `M` state object is closure-scoped inside an IIFE. From the
console, `window.M` is `undefined` and always will be. Debugging through
`window.M` is a dead end; use the engine's own exports (§5) or a breakpoint.

### Trap 3 — multi-tranche merging drops anything not summable

When `instr.tranches` is non-empty, `buildSchedule` recurses per tranche and
merges row-by-row. The merge copies `date`, `jsDate`, `dayOfWeek` and then
**sums the keys listed in `SUM_KEYS`** (~line 1188). A field you add to the
row will be **absent on merged rows** unless you add it to `SUM_KEYS`.

Object fields like `eclTrace` are deliberately *not* in `SUM_KEYS` — summing a
trace is meaningless. Readers must therefore tolerate it being missing on a
multi-tranche deal. That is why the row-detail panel checks for the trace and
explains its absence rather than rendering a blank table.

---

## 3 · Inside the daily loop

`buildSchedule`'s loop runs from settlement to maturity, one iteration per
calendar day, in this order. **The order is load-bearing** — each phase reads
balances the previous one left behind.

| # | Phase | What it does |
|---|---|---|
| 1 | **Events** | draws, paydowns, prepayments, write-offs, recoveries, cures, forbearance, capitalised costs, loan sales, D4E swaps |
| 2 | **Modification** (§5.4.3) | gain/loss, EIR reset on substantial mods |
| 3 | **Coupon rate for today** | fixed, floating, RFR compounding, bands |
| 4 | **Covenant step-up** | margin increase on breach |
| 5 | **Holiday skip** | zeroes the day-count factor on holidays when enabled |
| 6 | **Amortisation window** | gate: only accrete inside `[amortStart, amortEnd]` |
| 7 | **Day count factor** | ACT/360, ACT/365, 30/360 |
| 8 | **Daily cash accrual** | `dailyCash` |
| 9 | **Default interest / fee** | penalty accruals |
| 10 | **PIK accrual** | `dailyPik` |
| 11 | **ECL provisioning** (§5.5) | POCI branch, then the staged branch |
| 12 | **FX revaluation** | on the opening balance |
| 13 | **Hedge accounting** (§6) | |
| 14 | **Non-use fee** | on undrawn commitment |
| 15 | **Multi-fee accrual** | IFRS 9 / IFRS 15 aware |
| 16 | **EIR accretion of deferred fees** | legacy path, see below |
| 17 | **PIK capitalisation** | |
| 18 | **Floating reset** | re-solve the yield if policy says so |
| 19 | **Discount / premium amortisation** | `amortDaily`, `cumAmort` |

Two things worth knowing about this list:

**Phase 11 has two mutually exclusive branches.** POCI assets
(`instr.ifrs.poci`) carry the *movement in expected losses since acquisition* —
a negative allowance is a gain, and that is correct (§5.5.14). Everything else
goes through the staged PD × LGD model. POCI never enters the 1/2/3 model.

**Phase 16 is mostly legacy.** `dailyEIRAccretion` only runs when
`eirFlatFallback > 0`, which happens only when no effective yield could be
solved. On a normal deal the discount unwinds through phase 19 instead. These
are different GL lines (40100 vs the Discount Accretion pair), so do not merge
them.

---

## 4 · The pattern this codebase cares about

The recurring defect class here is **a value that is read, stored, displayed
and never consulted** — and its cousin, **a default that looks like a fact**.
Several of this week's fixes were exactly that:

- a holiday calendar offered in the UI that did not exist in the engine, so
  every Australian deal rolled against no holidays and looked fine doing it
- a column preference that could not distinguish "newly added" from
  "deliberately removed"
- a maturity date that could contradict its own extension history

The defence that works, and that you should follow:

> **Carry the inputs, do not re-derive them.**

`eclTrace` is the model. The ECL block builds a trace object from the same
locals the calculation uses, and the UI *renders* it. The UI does not
recalculate PD × LGD to explain the number — if it did, there would be two
implementations of one formula and the screen would go on explaining the old
one long after this block changed. The same applies to `eirYieldUsed` and
`eirDcf`, which exist so accretion can be explained downstream without
re-running the engine.

If you add a calculation, add its trace at the same time.

---

## 5 · Testing a change

There is a real harness. It is undocumented elsewhere and easy to miss.

```bash
cd Incomemodulev3/tests
node engine-harness.js        # 25 cases — schedule, JEs, ECL, frameworks, invariants
node regression-harness.js    # 25 cases — watchlist, regulatory, multi-fund scope
```

Both pass as of V4.67. `engine-loader.js` runs the browser-side engine inside a
Node `vm` with `window` deliberately absent, so the `typeof window !==
'undefined'` guards take the Node path. See **TESTING.md** for how to add a
case and what the harnesses do *not* cover.

Minimum bar for an engine change: both harnesses green, plus a re-run and diff
of the affected demo deals.

---

## 6 · Recipes

**Add a field to the daily row**

1. Compute it in the right loop phase (order matters — §3).
2. Add it to the row object at the push.
3. If it is numeric and should aggregate across tranches, add it to
   `SUM_KEYS` (~line 1188). If it is an object, do not — and make readers
   tolerate its absence.
4. Add a trace if it is derived (§4).

**Add a journal entry type**

1. Emit it in `generateDIU` (internal) or `generateDIUFromExternalFeed`.
2. Route it through `applyInvestranGLMapping` — this is the step that is
   easiest to forget, and skipping it leaves clone rows carrying the template's
   account. It is why per-period interest lines once posted to `23000`.
3. Add a pattern to `_GL_EVENT_PATTERNS` in the builder so the GL Mapping
   screen can configure it.
4. Confirm the batch still balances. `__applyGLEventConfig` has a guard that
   refuses an unbalancing suppression; nothing guards an unbalanced *emission*.

**Add a holiday calendar** — do not touch this file. Calendars are
configuration now: `public.holiday_calendars` / `holiday_dates`, surfaced on
the Holiday Calendars screen. The sets still in the engine are a fallback for
when there is no database connection.

**Change an ECL formula** — the branch is at phase 11. Update `eclTrace` in
the same edit, or the row-detail panel will confidently explain a formula that
no longer runs.

---

## 7 · Where the bodies are

Open defects that live in this file, as of V4.67:

- **#71** — the bullet maturity leg repays `face` unconditionally
  (`amount: face`). On a POCI asset whose expected recovery is below face, this
  overstates the gain. Affects `DEMO-POCI-MID` and `DEMO-POCI-PAR`.
- **#53** — two modifications fail the 10% test but are booked
  non-substantial. Note §B3.3.6: the 10% test applies to **liabilities only**,
  not assets. This is the single most common misreading in this domain.
- **#54** — repaid loans can leave residual carrying value and allowance.
- **#15** — external deals do not solve the EIR against the *received*
  cashflows.
- **#60** — all-in forecast curves: margin suppression needs review.

See **HANDOVER.md §11** for the full list including UI-side defects.
