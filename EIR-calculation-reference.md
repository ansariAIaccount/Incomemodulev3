# Effective interest rate — calculation reference

**Scope:** how PCS derives an effective interest rate, what it reads, what it
computes, and what it deliberately refuses to compute.

**Files:** `loan-module-engine.js` (the solve and the roll-forward),
`loan-module-v4-builder.html` (field collection and display),
`portf-excel-parser.js` (external feed).

---

## 1. The definition being implemented

The effective interest rate is the rate that discounts the expected future cash
flows back to the **amount actually invested** — not to face, and not from the
contractual coupon.

```
Opening carrying amount = consideration paid
                        − yield-integral fees received
                        + directly attributable transaction costs
```

The rate is then solved so that, rolling forward day by day at that rate, the
carrying amount lands on the **balance outstanding** at the end of the expected
life.

A loan bought at par, with no fees and no costs, has an EIR equal to its coupon.
That is the correct answer, not a fallback, and PCS labels it as such.

---

## 2. Input fields

### 2.1 Deal / facility level

| Field | Source | Used for |
|---|---|---|
| `settlementDate` | Deal Setup · `Settlement Date` | Start of accrual; anchor for resets and the day grid |
| `maturityDate` | Deal Setup · `Maturity Date` | Contractual horizon |
| `dayBasis` | Facility Setup · `Day Count Convention` | Sets `daysPerYear` and the daily factor |
| `faceValue` | Σ tranche face | Redemption amount; target balance |
| `commitment` | Facility Setup | Fee bases |
| `accountingFramework` | Deal Setup | Routes to the IFRS path or `computeEIRUSGAAP` |

### 2.2 Consideration and costs — new in v0.5

| Field | Source | Absent behaviour |
|---|---|---|
| `purchasePrice` | Σ tranche `Consideration Paid` | `undefined` — engine infers opening carrying from the initial draw (par) |
| `transactionCosts` | Σ tranche `Transaction Costs` | `null` → treated as 0 for arithmetic, but reported as *not stated* |
| `expectedRedemptionDate` | earliest tranche `Expected Redemption Date` | `null` → contractual maturity used |
| `creditImpairedAtAcquisition` | any tranche `Credit Impaired at Acquisition` | `null` → **not** read as "No" |

**Partial data rule.** If some tranches state a consideration and others do not,
**no facility-level price is produced at all**. Filling the silent tranches in at
face would invent a price and bury it inside a blended figure.

### 2.3 Coupon

| Field | Notes |
|---|---|
| `coupon.type` | `Fixed` \| `Floating` \| `SONIA` \| `CompoundedRFR`. Anything not `Fixed` is treated as floating |
| `coupon.fixedRate` | Decimal, e.g. `0.0725` |
| `coupon.spread` | Margin over benchmark, decimal |
| `coupon.floor` / `coupon.cap` | Applied to the all-in rate after margin |
| `marginSchedule[]` | `{from, to, marginBps}` — takes precedence over `coupon.spread` |
| `esgAdjustment` | `{from, deltaBps}` |
| `rfr.baseRate` | Observed benchmark level; the fallback when no fixings series exists |
| `rfr.tenor` | Drives the reset cadence (`6M` → six months) |
| `rfr.fixings[]` | `{date, rate}` as **decimals** |
| `rfr.lookbackDays`, `rfr.lockoutDays`, `rfr.observationShift`, `rfr.dailyCompounding` | Compounding conventions. `null` = not stated, which is **not** the same as `0` |
| `rfr.conventionsSource` | `stated` \| `assumed` \| absent |

### 2.4 Fees

| Field | Notes |
|---|---|
| `mode` | `flat` / `fixed` (a stated amount) or `percent` (rate × base) |
| `amount` | Used when mode is flat/fixed |
| `rate`, `base` | Used when mode is percent. Base ∈ commitment \| face \| drawn \| covered |
| `frequency` | Only `oneOff` fees enter the EIR |
| `ifrs` | `IFRS9-EIR` enters the yield; `IFRS15-*` does not |

For an external deal the fee **amount** is on the Cashflows sheet, not the
Components sheet, so it is summed per component at import.

### 2.5 Policy fields

| Field | Values | Where set |
|---|---|---|
| `amortization.method` | `none` \| `effectiveInterestPrice` \| `effectiveInterestFormula` \| `effectiveInterestIRR` \| `straightLine` | Derived at import; `none` means no solve runs |
| `eirFloatingPolicy` | `original` \| `revise` | Accounting Treatment page, stored on `treatment_overrides.eir_floating_policy` |
| `eirFloatingPolicySource` | `workspace policy` \| `deal override` | Derived |
| `eirMethod` | `method1` \| `method2` \| `method3` \| `override` | US GAAP only |
| `eirOverride` | decimal | Used when `eirMethod = override` |

**Workspace policy:** `window.__WORKSPACE_EIR_FLOATING_POLICY = 'revise'`.

---

## 3. Internal variables

| Variable | Definition |
|---|---|
| `daysPerYear` | 365 for ACT/365 and ACT/ACT, otherwise 360 |
| `totalDays` | `maturity − settle`, in days |
| `totalLifeDays` | `max(1, totalDays)` |
| `dcf` | Daily day-count factor; 0 on a skipped holiday |
| `balance` | Principal outstanding |
| `carryingValue` | Amortised cost carrying amount |
| `deferredEIRPool` | Σ one-off `IFRS9-EIR` fees |
| `txnCosts` | `instr.transactionCosts` or 0 |
| `eirOpeningCarrying` | Carrying amount after fees and costs — the solve target |
| `eirOpeningBalance` | Balance at t0, paired with the above |
| `couponRateNominal` | Indicative coupon for projection; for an RFR coupon = `rfr.baseRate + margin + ESG` |
| `horizonDays` | Days to expected redemption, else `totalDays` |
| `_deltaByDay` | ISO date → net principal movement **after** settlement |
| `_resetMonths` | Reset cadence from `rfr.tenor`, else accrual frequency, else 3 |
| `effectiveYield` | The solved rate at inception |
| `activeYield` | The rate in force today — differs from the above only under `revise` |
| `eirRevisions` | Count of resets that actually moved the rate |
| `eirFlatFallback` | Legacy straight-line fee release; **only** when no yield was solved |
| `eirRefusal` | Set when a solve was possible but deliberately declined (POCI) |

---

## 4. The calculation, step by step

### Step 1 — Opening carrying amount

```
carryingValue = purchasePrice            (else initial draw, else 0, else face)
carryingValue −= Σ one-off IFRS9-EIR fees
carryingValue += transactionCosts
eirOpeningCarrying = carryingValue
```

### Step 2 — Horizon

```
horizonDays = expectedRedemptionDate ∈ (settle, maturity]
                ? expectedRedemptionDate − settle
                : totalDays
```

### Step 3 — Seed the solve

Build an annual approximation and bisect:

```
coupon  = faceValue × couponRateNominal
cfs     = [{t:1..n, coupon}, {t:yearsToHorizon, face + stub coupon}]
seed    = solveYield(eirOpeningCarrying, cfs)
```

`solveYield` is a bisection over `[-0.99, 5.0]`, 200 iterations, returning `null`
if no sign change exists. **This is only a seed.**

### Step 4 — Refine against the actual balance path

```
runCarrying(y):
    cv  = eirOpeningCarrying
    bal = eirOpeningBalance
    for each day from settle to horizon:
        delta = principal movement that day      (draws +, repayments −)
        bal += delta ;  cv += delta
        cv  += (cv × y − bal × couponRateNominal) / daysPerYear
    return cv − bal                               ← root is 0
```

Secant iteration, up to 12 passes, tolerance 0.001. The target is
**carrying == balance outstanding**, not carrying == face, so an amortising
profile solves correctly.

### Step 5 — Daily roll-forward

For each day:

```
couponRate  = fixed rate, or compounded RFR + margin (+ESG), floored/capped
dailyCash   = balance × couponRate × dcf            ← contractual accrual
dailyAmort  = carryingValue × activeYield × dcf − dailyCash
carryingValue += dailyAmort
```

`dailyAmort` **is** the fee and discount release. It is not computed separately:
the gap between the yield on the carrying amount and the contractual coupon is
by definition the amortisation, and it grows as the carrying amount grows. This
is why the release is never a straight line.

### Step 6 — Reset re-estimation (policy `revise` only)

On each reset day, for a floating coupon:

```
activeYield = solveYield(carryingValue,
                         remaining coupons at today's rate on today's balance)
```

Anchored to the current carrying amount, so any approximation is corrected at
the next reset rather than compounding. Uses the periodic solve, not the daily
walk — a 39-year facility resetting twice a year would otherwise run an O(days)
walk ~78 times inside a secant loop.

---

## 5. Worked example — Harbour Point

£60m face, five years, fixed 7.25%, acquired for £59.1m, £600k arrangement fee
(yield-integral), £185k transaction costs.

| | |
|---|---|
| Face value | 60,000,000 |
| Consideration paid | 59,100,000 |
| Yield-integral fees | (600,000) |
| Transaction costs | 185,000 |
| **Opening carrying amount** | **58,685,000** |
| Contractual coupon | 7.2500% |
| **Effective interest rate** | **7.7787%** |
| Carrying value at maturity | 60,000,000 (gap £0.00) |
| Total accretion | 1,315,000 = 900,000 discount + 600,000 fee − 185,000 costs |

Release profile — year 1 **223,508**, year 4 **283,051**. Growing, not flat.

**Same loan amortising 20% a year:** EIR **8.0927%** — higher, because the same
discount and fee are earned over a smaller average balance.

**Same loan at par, no fees:** EIR **7.2500%**, exactly the coupon.

---

## 6. Output — `schedule.eirBasis`

| Field | Meaning |
|---|---|
| `status` | `calculated` \| `coupon` \| `refused` |
| `calculated` | Boolean — is this a solved rate? |
| `effectiveYield` | The rate, or `null` |
| `reason` | Plain-English explanation, shown on screen |
| `build.faceValue` … `build.openingCarrying` | The decomposition in §5 |
| `build.horizonUsed` | `expected redemption` or `contractual maturity` |
| `build.floatingPolicy` | e.g. *revised at each reset (workspace policy)* |
| `build.revisions` | How many resets moved the rate |
| `build.closingYield` | Rate in force at the end |

Rendered as a green / amber / red panel under the EIR on the Accounting tab.

---

## 7. US GAAP path — `computeEIRUSGAAP`

Separate calculator, four methods, selected by `eirMethod`. On a
$10m / 92.00 / 10% + 5% PIK deal:

| Method | Result |
|---|---|
| 1 — Custom Formula | 16.6798% |
| 2 — PRICE *(default)* | 17.5302% |
| 3 — Generic Formula | 17.2898% |
| 4 — Client Override | 14.9600% |

Inputs: `P` = face, `CV` = purchase price, `PMT` = `P × (cash rate + PIK rate)`,
`m` = years to maturity.

---

## 8. What is deliberately NOT computed

**Credit-impaired at acquisition (POCI).** Returns `status: 'refused'`. Such an
asset requires a credit-adjusted rate with lifetime expected losses embedded in
the yield from initial recognition. Applying the ordinary method would overstate
interest income for the life of the asset and the error would never
self-correct, so no rate is applied and the reason is displayed.

---

## 9. Known gaps

| Gap | Effect |
|---|---|
| **Modification gain/loss is an input, not a calculation** | IFRS 9 5.4.3 requires the revised cash flows to be discounted at the **original** EIR, with the difference to P&L. The engine adds whatever `gainLoss` figure is supplied. The original rate *is* correctly retained; it just is not used to derive the adjustment |
| **No purchase-price input for internally built deals** | A PCS-built deal has nowhere to enter a consideration, so its EIR can only ever equal its coupon |
| **Revolvers** | EIR assumes a determinable stream discounted to a carrying amount. On a revolver the balance moves at the borrower's discretion; treatment is undecided |
| **Staged drawdowns at a non-par price** | Consideration is stated for the initial advance only; later drawdowns are assumed at par |
| **POCI** | Refused rather than computed — needs the lifetime loss expected at acquisition |
| **`Base Value` ambiguity** | For a floating component, whether this is the margin or the all-in rate is unconfirmed by PortF. If it is the margin, derived floating rates are understated by the benchmark level |

---

## 10. Provenance principle

Every input is recorded as **stated** or **assumed**, and the distinction is
never collapsed:

- A blank consideration is not "acquired at par".
- A blank transaction cost is not `0`.
- A blank POCI flag is not "No".
- A blank lookback is not a zero-day lookback.

Where PCS has assumed, the screen says so.
