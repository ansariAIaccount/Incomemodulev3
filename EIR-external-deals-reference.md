# Effective interest rate — how PCS calculates EIR for externally loaded deals

**Module:** PCS Loan Module V4 · V4.9
**Applies to:** deals imported from the PortF workbook (`deals.source = 'external'`)
**Framework:** IFRS 9 §5.4.1, §B5.4.1–B5.4.7, Appendix A "effective interest rate"
**Status:** describes the code as it stands at V4.9. Written from the source, not from design intent — where the two differ, the source wins and §9 says so.

---

## Part 1 · Summary

### 1.1 The one-paragraph version

For an imported deal PCS solves **one EIR for the whole facility**, by finding the yield that makes a day-by-day roll-forward of the carrying amount land exactly on the principal outstanding at the horizon. The rate is anchored to the **opening carrying amount** — consideration paid, *less* fees the workbook marks as yield-integral, *plus* stated transaction costs — not to the headline price. The solve runs only when the workbook stated something that makes the asset differ from par. When nothing was stated, PCS does not invent a rate: it reports the contractual coupon and labels it as the coupon.

### 1.2 What decides whether an EIR is calculated at all

Three conditions, evaluated in `builderToInstrument()`. If **none** holds, the amortisation method is set to `'none'` and no EIR is solved.

| # | Condition | Source field |
|---|---|---|
| 1 | Consideration paid differs from face by more than £0.005 | Tranches → `Consideration Paid` |
| 2 | Any fee is yield-integral with a non-zero amount or rate | Components → `Yield Integral` |
| 3 | Transaction costs are non-zero | Tranches → `Transaction Costs` |

This is deliberate. Hardcoding `effectiveInterestPrice` would have produced a "calculated" EIR on a par loan with no fees, which is the coupon wearing a different label.

### 1.3 The three answers PCS can give

Every run produces `schedule.eirBasis.status`, which is one of exactly three values. The Cashflow tab and the accounting run both read it rather than re-deriving a verdict.

| Status | Meaning | `effectiveYield` |
|---|---|---|
| `calculated` | A rate was solved against the roll-forward. | the solved rate |
| `coupon` | Nothing was stated that differs from par, **or** the method was never set. The figure on screen is the contractual coupon and must not be reported as an EIR. | `null` |
| `refused` | The asset is credit-impaired at acquisition and requires a credit-adjusted EIR, which PCS does not compute. No rate applied. | `null` |

`refused` is loud on purpose. Running the ordinary method on a POCI asset accretes the loss-compensating discount into income as though it were yield, overstates interest income for the whole life of the asset, and never self-corrects.

### 1.4 The four things you should know before relying on this

Stated up front rather than buried in §9, because each one changes what the number means.

1. **The EIR is solved against PCS's own projection, not against the cashflows PortF sent.** The received schedule drives the *journals*; the EIR is solved on a projected annual-coupon seed and a projected daily walk. On a deal where the feed and the projection disagree, the reported EIR belongs to the projection.
2. **EIR accretion is calculated but never posted for imported deals.** It appears on the KPI card and inside the carrying amount; there is no journal entry. See §6.3 — this is the most consequential gap in this document.
3. **A non-SONIA floating deal gets no EIR at all.** SOFR, Term SOFR, EURIBOR, BBSW and ESTR all map to coupon type `'Floating'`, whose nominal rate resolves to zero, which fails the solver's entry test silently. See §9.1.
4. **One EIR per facility, not per tranche.** Rates, faces, fees and costs are summed across tranches before the solve. A facility whose tranches carry genuinely different yields cannot express that.

---

## Part 2 · Details

### 2.1 Where each input comes from

Four hops: workbook cell → parser → snapshot JSON → builder object → instrument field read by the engine.

#### From the **Tranches** sheet

| Workbook column | Parser field | Instrument field | Used for |
|---|---|---|---|
| `Consideration Paid` | `considerationPaid` | `purchasePrice` | The anchor of the solve |
| `Consideration Date` | `considerationDate` | — | Audit trail only |
| `Transaction Costs` | `transactionCosts` | `transactionCosts` | Raises opening carrying |
| `Expected Redemption Date` | `expectedRedemptionDate` | `expectedRedemptionDate` | Horizon of the solve |
| `Credit Impaired at Acquisition` | `creditImpairedAtAcquisition` | `creditImpairedAtAcquisition` | Triggers `refused` |
| `Face Value` | `face` | `faceValue` (summed) | Redemption amount |

#### From the **Components** sheet

| Workbook column | Parser field | Effect |
|---|---|---|
| `Yield Integral` | `yieldIntegral` (tri-state) | Yes → fee enters the EIR; No → IFRS 15 service fee; blank → recorded, kept out of the yield |
| `Base Value` | `baseValue` | Contractual rate |
| `Interest Type` | `interestType` | Fixed vs floating |
| `Posting Type` | `postingType` | Separates fees from interest |
| `Settlement Frequency` | `settlementFrequency` | **Gates whether a yield-integral fee reaches the pool — see §9.2** |

#### Not from the workbook

| Field | Where it comes from | Default |
|---|---|---|
| `eirFloatingPolicy` | `treatment_overrides.eir_floating_policy`, else workspace policy | `'original'` |
| `eirFloatingPolicySource` | derived | `'workspace policy'` |

The floating policy is an accounting policy, not a property of the loan, so it is a setting rather than something inferred from the feed.

### 2.2 Blank is not zero

Every v0.5 field stays `null` when the cell is empty, and the parser is explicit about why:

- **Consideration.** Defaulting to face would assert "acquired at par" — a specific and consequential claim — on a file that said nothing, and the resulting yield would look as settled as one PCS was actually told.
- **Transaction costs.** A stated `0` and an unstated cost are different answers, and only one of them is reconcilable.
- **POCI.** An unanswered cell must not read as "No". The whole point of asking is that the two differ.
- **Yield Integral.** PCS must not decide it from the fee's name. "Arrangement and agency fee" is genuinely ambiguous, and an inference that moves a reported yield should never be silent. The parser raises a warning per unstated fee.

Two aggregation rules follow from this, both in `builderToInstrument()`:

- `_v5Consideration()` returns `undefined` unless **every** tranche states a consideration. A partial answer is no answer: summing the three tranches that stated one and ignoring the fourth produces a price that reconciles to nothing.
- `_v5Sum('transactionCosts')` returns `null` when no tranche stated costs, and the sum otherwise.
- `_v5EarliestRedemption()` takes the **earliest** date across tranches; `_v5Poci()` returns true if **any** tranche is flagged.

### 2.3 Building the opening carrying amount

In `buildSchedule()`, before the day loop. This is the figure the whole calculation hangs from.

```
carryingValue  =  initial draw (or purchasePrice where stated)
               −  Σ yield-integral fees           (deferredEIRPool)
               +  transactionCosts
─────────────────────────────────────────────────────────────────
                = eirOpeningCarrying
```

A fee received **lowers** the carrying amount and therefore **raises** the yield. A transaction cost **raises** the carrying amount and **lowers** the yield. IFRS 9 measures a financial asset initially at fair value plus directly attributable transaction costs, so both belong in the same number — and they are captured once, so the solver and the daily roll-forward can never be anchored to two different opening balances.

Worked, on the Harbour Point shape:

```
  59,100,000   consideration paid
−    600,000   arrangement fee (Yield Integral = Yes)
+    185,000   transaction costs
────────────
  58,685,000   opening carrying amount
```

A fee only enters `deferredEIRPool` if it passes **all three** tests in the engine:

```js
/EIR$/.test(f.ifrs)                          // classified IFRS9-EIR
&& (f.mode === 'flat' || f.mode === 'fixed')  // a stated amount, not a rate
&& f.frequency === 'oneOff'                   // ← see §9.2
```

…or the percent-of-base equivalent (`f.mode === 'percent' && f.frequency === 'oneOff'`), where the one-off amount is `base × rate` and `base` resolves to commitment, face, drawn, or covered amount.

### 2.4 The horizon

IFRS 9 spreads the yield over the period the instrument is **expected** to be held, not the contractual life. On long-dated facilities the two are not close — one test deal runs to 2063 on paper.

```
horizonDays = (expectedRedemptionDate is set, after settle, and ≤ maturity)
                ? days(settle → expectedRedemptionDate)
                : days(settle → maturityDate)
```

`eirBasis.build.horizonUsed` reports which was used, in those words: `'expected redemption'` or `'contractual maturity'`.

### 2.5 The solve, in two passes

**Pass 1 — the seed.** A closed-form IRR over projected annual coupons plus redemption, solved by bisection on 200 iterations over the bracket [−0.99, 5.0].

```
cashflows:  t = 1 … ⌊years⌋   →  faceValue × couponRateNominal
            t = years          →  faceValue + (stub × annual coupon)
seed = solveYield(eirOpeningCarrying, cashflows)   // falls back to the coupon
```

**Pass 2 — the refinement.** The seed is only a starting point, because annual coupons on a constant face are true of a bullet and of nothing else. The refinement walks the **actual principal schedule** day by day:

```
for each day from settle to horizon:
    delta     = net principal movement that day (draws − repayments)
    balance  += delta
    carrying += delta
    carrying += (carrying × y − balance × couponRateNominal) × (1 / daysPerYear)

gap(y) = carrying(horizon) − balance(horizon)
```

A secant search then drives `gap(y)` to zero: up to 12 iterations, tolerance £0.001, starting from `y₀ = seed` and `y₁ = seed × 1.001`, breaking early on a flat secant or a non-finite step.

**Why the target is `carrying == balance` and not `carrying == face`.** This is the single most important line in the calculation. The earlier version held the balance at face for the whole life and accrued a constant coupon on it. On an amortising loan the balance falls as principal is repaid, so both coupon and yield accrue on less and less, and the discount and fee are earned over a smaller average balance — which **raises** the effective rate. Holding face constant produced the same EIR for a bullet and for a loan repaying 20% a year, and left carrying value **£716,697 short** of the balance at maturity on a £60m five-year facility.

Day-zero funding is excluded from the walk (`if (e.date <= settleISO) continue`), because it is already inside `eirOpeningCarrying` and `eirOpeningBalance`. Re-applying it would count the initial draw twice and send the solve to a negative rate.

### 2.6 Day count

`daysPerYear` is taken from the tranche's stated basis and used consistently in both the seed and the walk, so the IRR solve and the daily accrual cannot disagree:

| Basis | daysPerYear |
|---|---|
| ACT/365, ACT/ACT | 365 |
| ACT/360, 30/360, everything else | 360 |

### 2.7 Floating-rate policy

IFRS 9 permits two treatments and both are used in the market. This is a policy choice, so PCS makes it a setting and reports which was applied.

| Policy | Behaviour | Citation |
|---|---|---|
| `original` *(default)* | The rate is set at initial recognition and held. Benchmark movements flow through interest income via the coupon, but the accretion yield does not change. | — |
| `revise` | The rate is re-estimated at each reset, anchored to the carrying amount at that date over the remaining expected life. | IFRS 9 §B5.4.5 |

Under `revise`, `_reestimateEIR(cv, balance, couponRate, daysLeft)` runs at each reset using the periodic closed form rather than the daily walk — a 39-year facility resetting twice a year would otherwise run an O(days) walk ~78 times inside a secant loop. Anchoring each estimate to the current carrying amount means any approximation is corrected at the next reset rather than compounding, and the final segment still solves to land on the balance outstanding.

`eirBasis.build.revisions` counts how many times the rate actually moved; `closingYield` is the rate in force at the end of the schedule.

### 2.8 What gets reported back

`schedule.eirBasis.build` — the full decomposition, so the figure can be taken apart rather than taken on trust:

| Field | Meaning |
|---|---|
| `faceValue` | Σ tranche face |
| `considerationPaid` | `purchasePrice`, or `null` if unstated |
| `yieldIntegralFees` | `deferredEIRPool` |
| `transactionCosts` | as stated |
| `openingCarrying` | the anchor |
| `contractualCoupon` | `couponRateNominal` |
| `expectedRedemption` / `horizonUsed` | which horizon |
| `floatingPolicy` | policy + whether deal override or workspace policy |
| `resetMonths`, `revisions`, `closingYield` | floating diagnostics |

---

## Part 3 · Detailed documentation

### 3.1 Call sequence

```
loadExternalDeal(dealId)
  └─ read external_snapshots where is_current = true
  └─ externalSnapshotToBuilder(snap)          → B.deal / B.facility / B.tranches / B.fees
       • fee.ifrs          = 'IFRS9-EIR' when Yield Integral = Yes
       • fee.yieldIntegral = tri-state (true / false / null)
       • fee.mode          = 'fixAmount' when a cash amount was received, else 'fixPct'
  └─ page external_cashflows by snapshot_id   → _externalDealCtx.cashflows

builderToInstrument()
  └─ purchasePrice   = _v5Consideration()        (undefined unless ALL tranches state it)
  └─ transactionCosts= _v5Sum('transactionCosts')
  └─ expectedRedemptionDate = _v5EarliestRedemption()
  └─ creditImpairedAtAcquisition = _v5Poci()
  └─ amortization    = { method: 'effectiveInterestPrice' } | { method: 'none' }
  └─ fees[].mode     : 'fixAmount' → 'fixed' ; 'fixPct' → 'percent'
  └─ coupon          = from FIRST interest component of FIRST tranche

buildSchedule(inst)
  └─ deferredEIRPool, carryingValue, eirOpeningCarrying, eirOpeningBalance
  └─ POCI check                                → eirRefusal
  └─ seed  = solveYield(...)
  └─ secant on runCarrying(y)                  → effectiveYield
  └─ daily loop: dailyEIRAccretion, carryingValue, activeYield
  └─ rows.eirBasis = { status, calculated, effectiveYield, build, reason }

runAccountingImpl()
  └─ external → generateDIUFromExternalFeed(inst, cashflows)   ← EIR accretion NOT emitted
  └─ + emitPrincipalMovementsFromSchedule()
  └─ + splitECLByReportingPeriod()
```

### 3.2 Field reference — every input to the EIR

| Instrument field | Type | Blank behaviour | Effect on EIR |
|---|---|---|---|
| `faceValue` | number | required | Redemption amount; Σ across tranches |
| `purchasePrice` | number \| undefined | engine infers from initial draw | Anchor. Differing from face is condition 1 |
| `transactionCosts` | number \| null | not added | Raises opening carrying → lowers EIR |
| `expectedRedemptionDate` | ISO \| null | contractual maturity used | Shortens horizon → usually raises EIR |
| `creditImpairedAtAcquisition` | bool \| null | treated as not impaired | `true` + `effectiveInterestPrice` → `refused` |
| `amortization.method` | enum | `'none'` | `'none'` ⇒ no solve, status `coupon` |
| `dayBasis` | enum | ACT/360 | 360 vs 365 in seed and walk |
| `coupon.type` | enum | Fixed | **Non-SONIA floating ⇒ no solve, §9.1** |
| `coupon.fixedRate` | decimal | 0 | `couponRateNominal` |
| `fees[].ifrs` | string | IFRS15-overTime | `/EIR$/` ⇒ enters pool |
| `fees[].mode` | enum | — | must be `fixed` or `percent` |
| `fees[].frequency` | enum | `oneOff` | **must be `oneOff`, §9.2** |
| `eirFloatingPolicy` | enum | `original` | Held vs revised at reset |
| `principalSchedule[]` | array | — | Drives the walk; wrong schedule ⇒ wrong EIR |

### 3.3 Amortisation methods

Only the first is reachable from an import; the rest are documented because a treatment override can select them.

| Method | Yield | `eirBasis.status` |
|---|---|---|
| `effectiveInterestPrice` | Solved: seed + secant on the daily walk | `calculated` |
| `effectiveInterestFormula` | `couponRateNominal + amortization.spread` | `calculated` |
| `effectiveInterestIRR` | `amortization.yieldOverride` | `calculated` |
| `straightLine` | none — `(face − price) / totalDays` per day | `coupon` |
| `none` | none | `coupon` |

### 3.4 Daily accretion of the deferred fee pool

Separate from the yield solve, and worth understanding as its own mechanism.

When a yield-integral fee exists **and** no effective yield was solved, the pool is released on a **flat daily** basis (`eirFlatFallback`) rather than on an effective-interest basis:

```
dailyEIRAccretion = min(eirFlatFallback, deferredEIRPool − cumulativeEIRAccreted)
carryingValue    += dailyEIRAccretion
```

The remaining-pool clamp means the accretion cannot overshoot: the final day takes whatever is left, so cumulative accretion lands exactly on the pool with no float drift.

When a yield **was** solved, the fee is inside the yield and the carrying amount accretes through the `carrying × y` term instead — the pool is not released separately, because doing both would double-count it.

### 3.5 Journals

| Concern | Transaction type | Internal account → Investran GL | Emitted on the import path? |
|---|---|---|---|
| EIR fee accretion | `EIR Fee Accretion (IFRS 9 §B5.4 EIR)` | 40100 | **No — §6.3** |
| EIR accretion offset | `EIR Fee Accretion Offset (…)` | 40110 | **No — §6.3** |
| Interest per feed row | `Income - Daily Accrued Interest` | 23000 | Yes |
| Drawdown | `Loan Drawdown` | 15000 → 141000 | Yes, via `emitPrincipalMovementsFromSchedule` |
| ECL movement | `Impairment Expense (ECL)` | 70100 → 470000 | Yes, via `splitECLByReportingPeriod` |

The framework tag on the accretion label follows the deal's framework — `IFRS 9 §B5.4 EIR`, `AASB 9 EIR`, or the US GAAP equivalent. **The label is load-bearing:** `applyInvestranGLMapping` routes on that text, so rewording it silently changes the GL account the entry lands in.

### 3.6 US GAAP is a different calculator

When `accountingFramework === 'USGAAP'`, `computeEIR` branches to `computeEIRUSGAAP` — the four-method Interest AT / Investran convention, not the IFRS bisection:

| Method | Formula |
|---|---|
| 1 — Main Street Capital custom | `(P/CV)^(1/m) − 1 + (I₁ + I₂)` |
| 2 — PRICE, iterative *(default)* | bisection over `(CV, [coupons…, face + last coupon])` |
| 3 — generic | `(PMT + (P−CV)/m) / ((CV+P)/2)` |
| 4 — client override | `instr.eirOverride` |

Priority when `eirMethod` is unset: override → method 2 → method 3 → method 1. `PMT` is `P × (I₁ + I₂)` — annual interest **including** PIK accrual, verified against the spec's test case (P = 10m, I₁ = 10%, I₂ = 5% → PMT = 1.5m, not the 1.0m cash).

### 3.7 Worked example — arithmetic only

Deliberately labelled. This is the arithmetic the code specifies; it has **not** been executed against the engine in this document's preparation, because the local session was signed out and Supabase RLS returns empty rows rather than an error to an unauthenticated client. Treat it as a specification of the expected answer, not as a test result. §10 says how to produce the verified version.

```
Facility            £60,000,000 face, single tranche, 5 years, ACT/365
Consideration paid  £59,100,000
Arrangement fee        £600,000   Yield Integral = Yes, one-off, cash received
Transaction costs      £185,000
Coupon                     8.00% fixed, bullet
Expected redemption   not stated  → horizon = contractual maturity

Opening carrying = 59,100,000 − 600,000 + 185,000 = 58,685,000
Condition 1 met (59.1m ≠ 60.0m) → amortization.method = effectiveInterestPrice

Seed:  solveYield(58,685,000, [4.8m ×5 years, +60m at t=5])
Walk:  carrying accretes at y, coupon accrues on balance 60m (bullet — no movements)
Root:  the y where carrying(5y) − balance(5y) = 0, i.e. carrying lands on 60,000,000

Expected: y > 8.00%, because £1,315,000 of discount-plus-net-fee
          is earned over the five years on top of the coupon.
```

A bullet is the easy case. On an amortising loan the same inputs give a **higher** EIR, because the discount is earned over a falling average balance — which is exactly what the pass-2 walk exists to capture and what the old face-held-constant version got wrong.

---

## Part 4 · §9 · Known gaps

Ordered by how much they can move a reported number. Each is a statement about the code as it is at V4.9, not a plan.

### 9.1 A non-SONIA floating deal produces no EIR, silently

`builderToInstrument` maps the coupon type to one of three values:

```js
type: firstIC.baseIndex === 'FIXED' ? 'Fixed'
    : (firstIC.baseIndex === 'SONIA' ? 'SONIA' : 'Floating')
```

so SOFR, Term SOFR, EURIBOR, BBSW, ESTR and TONA all arrive as `'Floating'`, with `fixedRate: 0`. The engine then resolves the nominal coupon as:

```js
let couponRateNominal = instr.coupon?.fixedRate ?? 0;                        // → 0
if(!couponRateNominal && (type === 'SONIA' || type === 'CompoundedRFR')){ … } // not entered
```

and the solver's entry test requires a truthy `couponRateNominal`:

```js
if(!pociFlag && amort.method === 'effectiveInterestPrice' && instr.faceValue && couponRateNominal){
```

**Consequence.** A SOFR facility with a stated consideration and a yield-integral fee sets `amortization.method = 'effectiveInterestPrice'`, then never solves. `effectiveYield` stays `null`, `eirBasis.status` falls through to `'coupon'`, and the reason reads *"the amortisation method is not set"* — which is untrue; it was set. The fee pool then releases flat daily (§3.4) instead of through the yield. Only SONIA is rescued by the special case.

### 9.2 A yield-integral fee with a stated settlement frequency never enters the pool

The import maps frequency from the workbook: `frequency: _extPick(_EXT_FEEFREQ, c.settlementFrequency, 'oneOff')`, where `atMaturity → oneOff` but `quarterly → quarterly`, `annual → annual`, and so on.

The engine's pool gate requires `f.frequency === 'oneOff'`.

Meanwhile the condition that *selects* the method only checks that a yield-integral fee has a non-zero amount or rate — **not** its frequency.

**Consequence.** An arrangement fee marked Yield Integral = Yes with Settlement Frequency = `quarterly` sets the method to `effectiveInterestPrice`, contributes **nothing** to `deferredEIRPool`, does not reduce the opening carrying amount, and never accretes. The solve then runs on an unadjusted carrying amount and returns approximately the coupon — while `eirBasis.status` says `calculated`. That combination is worse than a refusal, because it looks settled.

### 9.3 The EIR is solved against the projection, not the received cashflows

Both passes use projected cashflows: pass 1 builds synthetic annual coupons from `faceValue × couponRateNominal`; pass 2 accrues `balance × couponRateNominal` daily. Neither reads `_externalDealCtx.cashflows`.

For an imported deal the received schedule is the authority for the journals — `generateDIUFromExternalFeed` posts one JE pair per received row and nothing else — but it has no influence on the EIR. Where the feed's actual interest differs from `balance × couponRateNominal` (margin steps, floors biting, compounded RFR, day-count differences, mid-period resets), **the reported EIR belongs to the projection and the ledger belongs to the feed.** They are not reconciled, and nothing on screen says they differ.

This is tracked as the largest remaining EIR gap.

### 9.4 EIR accretion is calculated but never posted for imported deals

`EIR Fee Accretion` and its offset are emitted **only** inside `generateDIU` (`loan-module-engine.js`). The import path replaces that call entirely:

```js
if(_extCtx){ M.acctJournals = fed.entries; }      // feed rows only
else       { M.acctJournals = generateDIU(...); } // includes EIR accretion
```

Principal movements and ECL are then added back by name. EIR accretion is not.

**Consequence.** `summary.totalEIRAccretion` shows on the KPI strip and in the Stage 2 cards, and `carryingValue` in the schedule includes the accretion — but **no journal entry exists for it**. Interest income in the ledger is understated by the accretion, and the carrying amount on screen will not tie to the carrying amount implied by the posted journals.

This is the same failure shape as the ECL regression that was fixed in V4.5 — an allowance on the KPI card with nothing in the ledger — and it is still open for EIR.

### 9.5 One EIR per facility

Faces, rates, fees and costs are summed across tranches before the solve. Two consequences:

- A senior tranche at 6% and a mezzanine at 12% produce one blended rate that describes neither.
- The coupon **type**, spread, floor, cap and RFR conventions are taken from the **first interest component of the first tranche** only. A facility whose tranches float off different indices, or whose second tranche carries the floor, is mis-described.

`computeEIR` (the display/reference calculator) does compute a face-weighted per-tranche aggregate via `aggregateChildEIRs`. `buildSchedule` — which drives accounting — does not.

### 9.6 Other limitations

| # | Limitation |
|---|---|
| 1 | **Modification gain/loss is supplied, not derived.** IFRS 9 §5.4.3 requires remeasurement at the *original* EIR; PCS takes the figure as given. |
| 2 | **Secant convergence is not asserted.** 12 iterations to £0.001. On a pathological schedule it can exit on a flat secant and return the last estimate with no flag. |
| 3 | **POCI refusal is narrow.** It fires only when the method is `effectiveInterestPrice`. A POCI asset with `method: 'none'` reports `coupon` and no refusal. |
| 4 | **The flat-daily fee release (§3.4) is not effective-interest.** Correct only as a fallback; it becomes the *only* mechanism whenever §9.1 or §9.2 suppresses the solve. |
| 5 | **`eirBasis.status: 'coupon'` conflates two different situations** — "correctly at par, nothing to amortise" and "inputs existed but the solve did not run". The `reason` text distinguishes them, but the status does not, so a caller keying off status alone cannot tell a right answer from a suppressed one. |

---

## Part 5 · §10 · How to verify this on a live deal

Sign in, load an imported deal, then in the browser console:

```js
const inst = builderToInstrument();
const sch  = buildSchedule(inst);

// The verdict and its full build-up
console.table(sch.eirBasis.build);
sch.eirBasis.status;          // 'calculated' | 'coupon' | 'refused'
sch.eirBasis.reason;
sch.effectiveYield;

// The three gates that decide whether a solve happened
inst.amortization.method;     // 'effectiveInterestPrice' or 'none'
inst.coupon.type;             // 'Floating' here ⇒ §9.1 applies
sch.deferredEIRPool;          // 0 with a Yield-Integral fee present ⇒ §9.2

// Whether the accretion reached the ledger
M.acctJournals.filter(j => /EIR Fee Accretion/.test(j.transactionType)).length;  // §9.4
```

Read `sch.deferredEIRPool` against the fees the Cashflow tab marks `✓ EIR`. If the tab shows an EIR-integral fee and the pool is zero, you are looking at §9.2.

---

## Part 6 · Where the code lives

| Concern | File · function |
|---|---|
| Workbook → snapshot | `portf-excel-parser.js` · `readTranchesV04`, `readComponentsV04` |
| Snapshot → builder | `loan-module-v4-builder.html` · `externalSnapshotToBuilder` |
| Builder → instrument | `loan-module-v4-builder.html` · `builderToInstrument` |
| Opening carrying, pool | `loan-module-engine.js` · `buildSchedule` (fee loop) |
| The solve | `loan-module-engine.js` · `buildSchedule` → `runCarrying` + secant |
| Seed IRR | `loan-module-engine.js` · `solveYield` / `npv` |
| Reset re-estimation | `loan-module-engine.js` · `_reestimateEIR` |
| Verdict | `loan-module-engine.js` · `rows.eirBasis` |
| Display calculator | `loan-module-engine.js` · `computeEIR`, `computeEIRUSGAAP` |
| Journals (internal) | `loan-module-engine.js` · `generateDIU` |
| Journals (imported) | `loan-module-engine.js` · `generateDIUFromExternalFeed` |
| Run wiring | `loan-module-v4-builder.html` · `runAccountingImpl` |

Persistence: EIR inputs on `external_snapshots.tranches_jsonb` / `components_jsonb`; policy on `treatment_overrides`; daily accretion on `cashflow_schedules`; journals on `journal_entries`.

---

### Companion documents

- `ECL-calculation-reference.md` — expected credit losses
- `DEPLOYMENT.md` — the eight deployable files and cache headers
