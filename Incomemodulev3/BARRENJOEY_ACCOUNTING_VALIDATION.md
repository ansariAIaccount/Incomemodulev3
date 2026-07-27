# Barrenjoey — Accounting Validation Report

**Purpose:** Independent first-principles calculation of expected accounting outputs for both deals, to validate the app's `Run Accounting` results.

**Method:** Compute each figure from the DB-persisted inputs using the term-sheet mechanics. Compare against the app's Evidence Pack / JE Trace / Cashflow output.

---

## Deal 1 — Barrenjoey RE Mezzanine

### Confirmed DB inputs

| Field | Value |
|---|---|
| Settlement | **2026-04-30** |
| Maturity | **2028-11-30** |
| Days to maturity | **945 days** (= 2.589 years on ACT/365) |
| Facility commitment | **$28,000,000** |
| Day basis | **ACT/365** |
| Tranche A face | $26,000,000 · PIK ✓ · monthly cap · FIXED 16.5% · cash-serviced 6% from Y2, cap $3,060,000 |
| Tranche B face | $2,060,000 · PIK ✓ · monthly cap · FIXED 16.5% · no cash servicing |
| Total face (both tranches) | $28,060,000 |

### Expected outputs

#### EIR panel

- **Coupon (face-weighted across both tranches):** both tranches are 16.5%, so blended = **16.5000%**
- **Effective yield:** likely **null** — both tranches have `amort.method = 'none'` (default), so the engine returns coupon only. Display should read `"16.5000% (coupon, no amort)"` OR the face-weighted aggregation string.
- **Note text:** `"Fixed coupon 16.5000%"` or similar
- **Nominal 16.5% p.a. compounded monthly → EAR = (1 + 0.165/12)^12 − 1 = 17.815%** — this is what the *effective* rate would be if the engine chose to surface it; useful benchmark

#### Daily interest accrual (once drawn)

For every $1m of principal:
- **Daily accrual: $1,000,000 × 16.5% / 365 = $452.05 per day per $1m drawn**
- Per $10m: **$4,520.55/day**
- Per $28m fully drawn: **$12,657.53/day**

#### First month accrual (if $10m drawn at close)

- 31 days from 2026-04-30 → 2026-05-31
- Accrual: $10,000,000 × 16.5% × 31/365 = **$140,136.99**
- **JEs at 2026-05-31:**
  - Dr Interest Receivable $140,136.99 / Cr Interest Income $140,136.99
  - Dr Loan Receivable $140,136.99 / Cr Interest Receivable $140,136.99 *(capitalisation)*
- New Loan A balance after capitalisation: **$10,140,136.99**

#### Y1 capitalised coupon (assuming $10m drawn on close, no other draws)

- $10m × (1 + 0.165/12)^12 = $10m × 1.178141 = **$11,781,410**
- **Capitalised coupon Y1: $1,781,410**

#### Full-life capitalised coupon (illustrative — Tranche A only, drawn $10m at close, no cash servicing yet)

- 31 months monthly comp: $10m × (1 + 0.165/12)^31 = **$14,839,000** at maturity
- Capitalised coupon over life: **~$4,839,000** (before Investor A's cash servicing carve-out)

#### Investor A cash-servicing schedule

- Nominal annual: $26,000,000 × 6% = **$1,560,000**
- Payment date: 2 weeks before each anniversary of first utilisation
- Start: Year 2 → **2028-04-16** (14 days before 2028-04-30 anniversary)
- **1 payment before maturity (2028-11-30): $1,560,000 on 2028-04-16**
  - Cumulative cash-serviced at maturity: $1.56m (well under $3.06m cap)
- Waterfall input at exit: capitalised coupon balance is **net of** this $1.56m already paid in cash

#### Fees at close

| Fee | Amount | Recipient | IFRS treatment |
|---|---|---|---|
| Upfront fee (2% × commitment) | $28m × 2% = **$560,000** | Investor A | ASC310-20-pointInTime (or EIR — check app) |
| Barrenjoey origination fee (1.25%) | $28m × 1.25% = **$350,000** | Barrenjoey | ASC310-20-EIR (deferred, amortised) |
| Barrenjoey management fee (50 bps p.a.) | on drawn balance, annual | Barrenjoey | ASC606-overTime |
| Barrenjoey performance fee (20% over 16% IRR) | contingent on exit | Barrenjoey | One-off at maturity |
| Investor B tiered exit fees (20/22.5/20 IRR hurdles) | waterfall | Investor B | One-off at maturity |

#### Base management fee — Barrenjoey (50 bps on drawn)

- If average drawn = $15m over Y1: **$15m × 0.005 = $75,000/year**
- Monthly: ~$6,250 recognised over time (ASC 606)

#### Expected JEs at close (2026-04-30) — sample $10m Tranche A + $2.06m Tranche B drawn

```
Dr  Loan Receivable — Investor A            $10,000,000
Dr  Loan Receivable — Investor B             $2,060,000
Cr    Cash                                  $12,060,000
                                           (initial funding)

Dr  Cash                                       $560,000
Cr    Fee Income (or Deferred Fee if EIR)     $560,000
                                           (Investor A upfront fee 2% × $28m)

Dr  Cash                                       $350,000
Cr    Deferred Fee — Barrenjoey                $350,000
                                           (Origination fee — EIR-deferred)
```

### Validation checklist for RE Mezz

- [ ] EIR panel shows 16.5000% coupon (or face-weighted note)
- [ ] JE Trace has drawdown JEs summing to sample-draw amount
- [ ] JE Trace has upfront fee JE of $560,000 dated 2026-04-30
- [ ] First-month interest accrual = $140,136.99 per $10m drawn (or pro-rata to actual draw)
- [ ] Capitalisation JE runs on the last day of each month
- [ ] Balance sheet at Y1 shows Loan A balance = $10m + accumulated capitalised coupon
- [ ] Cashflow schedule shows 1 cash-servicing payment on 2028-04-16 of $1,560,000
- [ ] Investor A + Investor B Loan Receivable accounts stay separate (not merged)

---

## Deal 2 — Barrenjoey FirstAg Livestock

### Confirmed DB inputs

| Field | Value |
|---|---|
| Settlement | **2026-03-25** |
| Maturity | **2027-03-24** |
| Days | **364 days** |
| Facility limit | **$40,000,000** |
| Day basis | **ACT/365** |
| Facility type | **revolvingBorrowingBase** |
| Tranche | $40m face · $0 drawn initially · **$12m drawn on 2026-04-01** |
| Base index | **BBSY 4.35%** |
| Margin | **700 bps** |
| All-in rate | **11.35% p.a.** |
| Interest tenor | **7 days** (weekly) |
| Establishment fee | $400,000 · deducted from first utilisation ✓ |
| Undrawn fee | 280 bps (= 40% × 700) · ramp: $30m limit for first 4 months or until drawn > $30m |

### Expected outputs

#### EIR panel

- **Coupon:** 11.3500% (base 4.35% + margin 7.00%) — Floating type
- **Effective yield:** likely **null** — amort.method = 'none' by default; engine returns coupon only
- **Rate breakdown:** `"Floating 4.3500% + spread 7.0000% = 11.3500%"`
- **Note:** with the $400k establishment fee deferred over 364 days via EIR, the *true* EIR would be **~14.7%**:
  - Discount: net cash advanced = $12m − $400k = $11.6m
  - Cashflows: annual coupon $1,362k + $12m principal at maturity
  - IRR solving $11.6m = $1,362k + $12m at 1 year → **(1,362 + 12,000) / 11,600 − 1 ≈ 15.19%**
  - The engine won't show this unless `amort.method = 'effectiveInterestPrice'` is set on the instrument

#### Daily interest accrual (on $12m drawn)

- **Daily: $12m × 11.35% / 365 = $3,731.51/day**
- **Weekly: $26,120.55**
- **Monthly (30 days): $111,945.21**

#### Interest per 7-day period (verified via `PCS.reconcileInterest`)

- Principal: $12,000,000
- Rate: 11.35% ACT/365
- Period: 7 days
- **Period interest: $12,000,000 × 11.35% × 7 / 365 = $26,120.55**

#### JEs — close (2026-03-25)

Establishment fee deducted from first utilisation — so no fee JE at close. Fee is recognised on 2026-04-01 when the first draw settles.

#### JEs — first draw (2026-04-01)

```
Dr  Loan Receivable                          $12,000,000
Cr    Cash                                    $11,600,000
Cr    Deferred Fee (establishment)              $400,000
                                           (net cash to borrower = $11.6m)
```

Alternative if the engine posts fee immediately to P&L (not EIR-deferred):
```
Dr  Loan Receivable                          $12,000,000
Cr    Cash                                    $11,600,000
Cr    Fee Income                                $400,000
```

#### Weekly interest accrual (first week 2026-04-01 → 2026-04-08)

```
Dr  Interest Receivable                          $26,120.55
Cr    Interest Income                            $26,120.55

Dr  Deferred Fee (amortise)                       $7,692.31
Cr    Interest Income                             $7,692.31
                                           (fee × 7/364 days)
```

#### Monthly interest payment (paid on last day of each month)

If May 2026 (30 days at 11.35% on $12m):
- Interest paid: **$111,945.21**
```
Dr  Cash                                        $111,945.21
Cr    Interest Receivable                       $111,945.21
```

#### Undrawn fee — ramp period (Apr–Jul 2026, ~4 months)

- Undrawn calculation: **ramp limit $30m − drawn $12m = $18m**
- Monthly fee: **$18m × 280 bps × 30/365 = $41,424.66/month**
- Total 4-month ramp: **~$165,698**

```
Dr  Undrawn Fee Expense                          $41,424.66
Cr    Cash                                       $41,424.66
                                           (paid monthly in arrears)
```

#### Undrawn fee — post-ramp (Aug 2026 onwards)

- Undrawn: **$40m − $12m = $28m**
- Monthly fee: **$28m × 280 bps × 30/365 = $64,438.36/month**
- Remaining ~8 months of the year: ~$515,507 in undrawn fees

#### Full-year cashflow summary (assuming $12m stays drawn all year, no additional draws/repayments)

| Item | Amount |
|---|---|
| Interest income | $12m × 11.35% × 364/365 = **$1,358,268** |
| Establishment fee amortised into interest income | **$400,000** |
| Undrawn fee income (4mo ramp + 8mo full) | ~$165,698 + ~$515,507 = **~$681,205** |
| **Total revenue to Barrenjoey First Ag Credit Fund** | **~$2,439,473** |
| Return on drawn capital ($12m) | **~20.3%** — reflects establishment fee + undrawn fee yield uplift |

#### Utilisation covenant

- Utilisations outstanding: 1 (the $12m draw)
- Threshold: 26
- **Compliant with 25 utilisations of headroom**

#### Livestock aging covenants

- **Contracted aging:** max days on feed among contracted rows. Sample data:
  - Feedlot contracted @ Location 4: 60 days
  - Feedlot contracted @ Location 5: 45 days
  - Max = **60 days** vs threshold **180** (target 150 + 30 grace) → **compliant** (120d headroom)
- **Uncontracted aging:** max days among uncontracted:
  - Backgrounding @ Location 10: 30 days
  - Backgrounding @ Location 11: 55 days
  - Max = **55 days** vs threshold **90** → **compliant** (35d headroom)

### Validation checklist for FirstAg

- [ ] EIR panel shows 11.3500% coupon with rate breakdown "Floating 4.3500% + spread 7.0000%"
- [ ] JE Trace has $12m drawdown JE dated 2026-04-01
- [ ] JE Trace has establishment fee JE ($400k, either at close or netted against draw)
- [ ] Weekly interest accrual = $26,120.55 (visible in cashflow schedule)
- [ ] Monthly interest payment ~$112k in a full-month period
- [ ] Undrawn fee accrual $41,424/month during ramp, $64,438/month post-ramp
- [ ] Watchlist: utilisation count = 1 (compliant vs 26)
- [ ] Watchlist: livestock aging covenants show compliant with headroom values above
- [ ] Borrowing base modal cashflow simulator: Outstanding $12m, Utilisation 30%, all-in 11.35%

---

## What to compare against in the app

For each deal, run **Stage 2 → Accounting → Run accounting** and check:

| App location | Check against |
|---|---|
| **EIR panel** (top of Stage 2) | RE Mezz: 16.5000%. FirstAg: 11.3500%. |
| **JE Trace** subtab | Line-by-line JEs against the samples above |
| **Evidence Pack** subtab | Modification history table renders (was crashing before recent fix) |
| **Stage 1 → Cashflow tab** | Interest accrual per day/week/month matches the per-$1m factors above |
| **Borrowing base modal → Cashflow simulator** (FirstAg only) | Outstanding $12m, Interest/7d = $26,120.55, Interest/30d = $111,945.21 |
| **Dashboard KPIs** | Utilisation %, covenant status, LVR/LTC/RLVR for RE Mezz |
| **Watchlist** | Both deals appear with correct covenant compliance status |

---

## Known caveats

1. **EIR won't reflect fee-driven uplift** unless the instrument's amort method is explicitly set to `effectiveInterestPrice` in Stage 2 Treatment panel. Currently both deals will show coupon-only EIR. This is IFRS 9 compliant when purchase price = par and there are no significant origination fees on the borrower side — but Barrenjoey's establishment fee ($400k) and Barrenjoey's origination fee ($350k) *should* fold into EIR under IFRS 9 §B5.4.1. The engine's ASC310-20-EIR tag on those fees defers them, but the display may still show coupon-only until Treatment→EIR method is switched.

2. **Cash-servicing schedule** for Investor A is projected by `PCS.projectCouponServicingSchedule` and pre-fills the Waterfall coupon input — but doesn't currently generate journal entries on the servicing payment dates. To fully account for it, the demo needs one additional JE on 2028-04-16:
   ```
   Dr  Loan Receivable — Investor A capitalised coupon      $1,560,000
   Cr    Loan Receivable — Investor A (principal side)      $1,560,000
   Dr  Cash                                                  $1,560,000
   Cr    Loan Receivable — Investor A                        $1,560,000
   ```
   Net effect: cash coupon serviced from principal balance, reducing the capitalised coupon that will otherwise flow through the waterfall at exit.

3. **BBSY rate is a snapshot** (4.35%) — real production would ingest daily fixings via `rfr.fixings`. The engine supports this (`computeCompoundedRFR`), but for the demo the single baseRate is used.

4. **RE Mezz drawdowns** in the sample deal are illustrative — $8m Apr + $6m Aug + $6m Dec + $5m May 2027. Actual accounting will accrue interest from each draw date on the incremental balance. The full life capitalised coupon depends on the exact draw schedule.
