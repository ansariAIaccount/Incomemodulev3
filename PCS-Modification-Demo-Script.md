# PCS Loan Module — Modification & Impairment Demo Script

**Version 4.36 · 8 October 2026**

Every figure in this script was read back from the database after a fresh
accounting run on V4.36. Nothing here is asserted or estimated. Where a number
disagrees with an earlier version of this script, the earlier number was wrong
— see *What changed and why* at the end.

**Read the "Before you present" section first.** Three of the seven deals carry
issues that a knowledgeable audience will spot, and you should decide how to
handle them before you are in the room.

---

## The deals

| # | Code | Shows | Run verified |
|---|---|---|---|
| 1 | `DEMO-MOD-S3` | Stage 3, amendment with a PIK year, margin step-up | ✔ 4.36 |
| 2 | `DEMO-DEFER-PIK` | Principal holiday, coupon splits to cash + PIK | ✔ 4.36 |
| 3 | `DEMO-FORGIVE-S3` | Principal forgiveness, extension, covenant reset | ✔ 4.36 |
| 4 | `DEMO-POCI` | Purchased credit-impaired, credit-adjusted EIR | ✔ 4.36 |
| 5 | `DEMO-FEES-EIR` | Fees integral to the EIR, deferred fee liability | ✔ 4.36 |
| 6 | `DEMO-HAIRCUT-SALE` | Restructuring, haircut, subsequent transfer | ✔ 4.36 |
| — | `SPMARLEY010` | External feed (PortF) | Run of 2 Oct — see note |

All seven are IFRS, all balanced, all out-by 0.00.

`SPMARLEY010` was **not** re-run on 4.36. It carries a single 0-basis-point
spread band, no PIK and no credit parameters, so none of the three fixes in
this release can move its numbers, and its existing run balances. If you want
it re-run for consistency, allow extra time — the external load path is slow.

---

## Before you present

### 1. Two modifications fail the 10% test but are booked non-substantial

This is the one to decide on. With date-banded margins now reaching the engine,
the derived present-value change on two deals exceeds the §5.4.3 threshold:

| Deal | Pre-mod carrying | Gain / (loss) | PV change | Booked as |
|---|---|---|---|---|
| `DEMO-MOD-S3` | 98,348,760 | **+14,700,847** | **+14.95%** | non-substantial |
| `DEMO-FORGIVE-S3` | 99,342,380 | **(13,122,033)** | **−13.21%** | non-substantial |
| `DEMO-HAIRCUT-SALE` | 99,362,705 | (4,442,708) | −4.47% | non-substantial ✔ |
| `DEMO-DEFER-PIK` | 80,000,000 | (907,632) | −1.13% | non-substantial ✔ |

The engine derives the percentage correctly and then honours the
`is_substantial = false` flag stored on the event, because a user declaration
outranks a derivation. So the Evidence Pack will show a derived ~15% beside a
"non-substantial" classification. If anyone in the room knows IFRS 9, they will
ask.

**Three options.** Pick one before the demo:

- **Re-price** deals 1 and 3 so the PV change sits under 10%. Keeps the
  existing narrative intact; needs a margin or tenor adjustment.
- **Set `is_substantial = true`** and present them as derecognitions. More
  faithful to the numbers, but changes the story and exercises a path that is
  less well tested.
- **Present it as the feature.** "The engine derived 14.95%, which fails the
  test; the deal was booked non-substantial by declaration, and PCS shows you
  the disagreement rather than hiding it." This is defensible and arguably the
  strongest version — but only if you say it first, before you are asked.

### 2. Repaid loans leave a residue

At the final schedule date the balance reaches zero but the carrying value and
the allowance do not:

| Deal | Closing balance | Closing carrying | Allowance residue |
|---|---|---|---|
| `DEMO-FORGIVE-S3` | 0 | **2,760,547** | 93,151 |
| `DEMO-HAIRCUT-SALE` | 0 | **68,284** | — |
| `DEMO-FEES-EIR` | 0 | 0 | **150,000** |
| `DEMO-POCI` | 0 | 0 | — ✔ |

Two causes: the modification adjustment is never amortised back to nil over the
remaining life, and the allowance is measured on the balance before the final
repayment is applied. `DEMO-POCI` closes clean, so this is not universal.

Avoid opening the final period on deals 3, 5 and 6. If asked, it is a known
presentation defect in the run-off, not a measurement error during the life.

### 3. Deal 1 does not fully repay

PIK grew the balance to **111,628,849** against a repayment schedule sized for
100,000,000, so **11,628,849** is still outstanding at maturity. Economically
that is exactly the point — the borrower owes more than it started with — but
do not describe the deal as fully amortising, and do not claim the total repaid
is unchanged.

---

# Deal 1 — Amendment, PIK year and margin step-up

**`DEMO-MOD-S3` · Atlas Industrial Holdings · USD 100,000,000**
**Settled 1 Jan 2024 · matures 31 Dec 2030 (extended from 31 Dec 2028)**

## The story

A seven-year facility at SOFR + 500. Eighteen months in the borrower hits a
liquidity wall. On 1 July 2025 the lender agrees: no cash interest for twelve
months — the whole coupon capitalises at 11% — and in exchange the margin rises
to SOFR + 700 for the remaining term, with maturity extended by two years.

This deal exists to show that a concession and a re-pricing can sit inside one
amendment, and that the net effect can be a **gain** to the lender.

## Screen 1 · Loan Builder — the two interest components

**Open:** Stage 0 · Loan Builder · Tranche A · Interest Components.

| Component | Base | Settlement | To 30 Jun 25 | PIK year | From 1 Jul 26 |
|---|---|---|---|---|---|
| Cash margin over SOFR | SOFR 4% | cash | +500 bps → **9%** | **−400 bps → 0%** | +700 bps → **11%** |
| PIK margin | 0% | capitalised | 0 bps → 0% | **+1100 bps → 11%** | 0 bps → 0% |

**Say:** the amendment is expressed entirely in the spread bands. During the
PIK year the cash margin goes *negative* against the base — minus 400 on a 4%
SOFR — which takes the cash coupon to zero. Nothing is paid in cash; the full
11% capitalises. Point at the settlement-type column: that one field is the
difference between interest the lender receives and interest the borrower owes.

**Teaching point:** this is a rate *timeline*, not a rate. Until V4.36 the
engine read only the base value and ran the whole seven years at 9%.

## Screen 2 · Run & JEs — the rate path

**Open:** Run & JEs → Run Accounting → Cashflow schedule.

```
2025-06-30    coupon  9.00%   PIK  0.00%    balance 100,000,000
2025-07-01    coupon  0.00%   PIK 11.00%    balance 100,030,556
2026-07-01    coupon 11.00%   PIK  0.00%    balance 111,628,849
```

**Say:** three distinct regimes, driven by dates in the loan agreement, with no
manual intervention. Total PIK capitalised over the amendment year:
**11,628,849**.

## Screen 3 · The modification build-up

**Open:** Evidence Pack · modification panel.

```
Pre-modification carrying amount (30 Jun 2025)        98,348,760
Original effective interest rate                           9.00%
Present value of revised cash flows at 9%            113,049,607
Modification GAIN                                     14,700,847
PV change                                                +14.95%
```

**Say:** the lender gave up a year of cash and received 200 basis points for
the remaining five years plus a year of 11% compounding. Discounted at the
original 9%, those more than offset: the restructuring *increased* the present
value of the asset.

**This is where you address the 10% test** — see "Before you present".

## Screen 4 · Impairment

**Open:** ECL Calculation Trace.

```
Stage 3 · PD 100% · LGD 40% · Q-factor 1.0
Allowance target     = exposure × 100% × 40%
Lifetime charge      44,651,540
Lifetime release     44,651,540
Net over the life            (0.02)   rounding
```

**Say:** Stage 3 with a certain default, so the allowance is 40% of exposure
from day one and moves only with exposure. It builds to 44,651,540 as PIK
inflates the balance and releases to nil as the loan runs off.

**Teaching point:** the allowance is driven by exposure, and the amendment
raised exposure. Nobody touched a credit parameter; the impairment moved
because the economics did.

## Screen 5 · Journal entries

**Open:** Accounting · Journal Entries · flat mode, sort by Transaction Type.

| Entry | Account | Amount |
|---|---|---|
| PIK Interest Capitalised | DR 141000 | 11,628,849 |
| PIK Interest Income | CR 421000 | 11,628,849 |
| Modification — Loan Asset Adjustment | DR 141000 | 14,700,847 |
| Modification Gain (IFRS 9) | CR 442000 | 14,700,847 |
| Impairment Expense (ECL) | DR 470000 | 44,651,540 |
| Loan Loss Allowance | CR 145000 | 44,651,540 |

**Say:** PIK is not a reclass out of a receivable — no receivable was ever
raised. It is income earned and an asset increased, which is why it posts DR
asset / CR income. 148 entries, debits equal credits, zero out-of-balance.

---

# Deal 2 — Payment deferral and a PIK split

**`DEMO-DEFER-PIK` · Northwind Logistics Group · USD 100,000,000**
**Settled 1 Jan 2025 · matures 31 Dec 2029**

## The story

A five-year amortising loan repaying 5,000,000 a quarter at a 10% cash coupon.
One year in, with 20,000,000 repaid, two concessions on 1 January 2026: no
principal for twelve months, and the 10% cash coupon splits into 6% cash plus
4% paid in kind.

Neither concession changes the rate. Both change *when* the lender sees the
money. This deal exists to show that timing alone moves the numbers.

## Screen 1 · The repayment schedule

**Open:** Stage 0 · Loan Builder · Tranche A · Paydowns.

```
2025-03-31   5,000,000          2027-03-31   6,666,667
2025-06-30   5,000,000          2027-06-30   6,666,667
2025-09-30   5,000,000              …
2025-12-31   5,000,000          2029-12-31   6,666,667
             ↑  nothing in 2026  ↑
```

**Say:** sixteen instalments, not twenty. 20,000,000 before the amendment,
nothing for a year, then 80,000,000 across twelve larger payments.

**Do not say** the total repaid is identical — it is not. PIK capitalises
8,223,619 into the balance, and the instalments were sized for the original
principal, so roughly 8,200,000 remains outstanding at maturity.

## Screen 2 · The two components

| Component | Base | Settlement | 2025 | From 2026 |
|---|---|---|---|---|
| Cash coupon | FIXED 6% | cash | +400 bps → **10%** | +0 bps → **6%** |
| PIK coupon | FIXED 0% | capitalised | 0 bps → 0% | +400 bps → **4%** |

**Say:** the all-in rate is 10% throughout. Nothing about the pricing changed.
Four points of it now accrue to principal instead of arriving as cash.

## Screen 3 · The modification build-up

```
Pre-modification carrying amount (1 Jan 2026)         80,000,000
Original effective interest rate                          10.00%
Present value of revised cash flows at 10%            79,092,137
Modification LOSS                                        907,632
PV change                                                 −1.13%
```

**Say:** a loss, and a small one. The lender still earns 10% on every dollar
outstanding, but capitalising four points at 4% while the required return is
10% destroys a little value, and deferring principal pushes cash further out.

**Teaching point:** a concession that *feels* generous is close to
value-neutral in present-value terms, and the only way to know is to do the
arithmetic. Comfortably inside the 10% threshold, so non-substantial treatment
is clearly right — unlike deal 1.

## Screen 4 · The balance path

**Open:** Cashflow tab · balance.

```
2025-12-31   80,000,000      (after four instalments)
2026-06-30   80,008,889      rising — PIK accruing, no principal due
2027-01-01   83,253,694      first annual capitalisation: 3,244,805
```

**Say:** on an 80,000,000 balance a year of 4% PIK adds **3,244,805**, taking
exposure to **83,244,805**. Not 4,000,000 on 100,000,000 — 20,000,000 had
already been repaid before the amendment.

**Note:** capitalisation falls on the settlement anniversary (1 January), not
the component's stated first settlement date of 31 December. A single day's PIK
capitalises on 1 Jan 2026 as an edge effect.

## Screen 5 · ECL — exposure at default

```
Stage 2 · lifetime ECL · PD 5% · LGD 40%
Lifetime charge      9,900,749
Lifetime release     9,900,749
```

**Say:** Stage 2, lifetime ECL, PD and LGD constant throughout. The allowance
grows purely because exposure grows. Deferring cash and capitalising interest
increases the amount at risk, and the impairment follows automatically.

**Teaching point:** this is the clearest illustration in the demo of why the
modules have to be joined up. A change made for liquidity reasons raises the
impairment charge without anyone touching a credit parameter.

---

# Deal 3 — Principal forgiveness, extension and covenant reset

**`DEMO-FORGIVE-S3` · Caledon Specialty Materials · USD 100,000,000**
**Settled 1 Jan 2024 · matures 31 Dec 2030 (extended from 31 Dec 2028)**

## The story

An 8.5% fixed-rate loan. On 1 January 2026 the lender writes off 15,000,000 of
principal outright, extends maturity by two years and resets the covenant
package for a fee.

## Screen 1 · Original Maturity Date

**Open:** Stage 0 · Deal Setup.

```
Original Maturity Date   31 Dec 2028
Maturity Date            31 Dec 2030     Extended from 31 Dec 2028 — 2 years
```

**Say:** an extension is a concession in its own right, often the most valuable
in the package. The ledger keeps both dates, so there is a record that this was
a 2028 loan.

## Screen 2 · The forgiveness

**Open:** Lifecycle Events · Write-off.

```
2026-01-01   writeOff   15,000,000   actual
```

**Say:** the balance steps from 100,000,000 to 85,000,000 on the amendment
date. Forgiveness is booked once, as part of the restructuring — not twice, as
both a write-off and a modification.

## Screen 3 · The modification

```
Pre-modification carrying amount (31 Dec 2025)        99,342,380
Modification LOSS                                     13,122,033
PV change                                                −13.21%
Maturity before / after                        2028-12-31 / 2030-12-31
```

**This also exceeds the 10% test** — see "Before you present".

## Screen 4 · Interest and impairment

```
Interest accrued over the life       53,886,458
  2024 (leap year)                    8,641,667
  2025                                8,618,056
  2026–2030 on 85,000,000             7,325,347 per year
Stage 3 · PD 100% · LGD 40%
Lifetime ECL charge                  40,000,000
Lifetime release                     39,906,849
```

**Say:** 8.5% ACT/360 on 100,000,000 for two years, then on 85,000,000 for
five. The allowance is exactly 40% of the opening exposure, as Stage 3 with a
certain default requires.

**Avoid the final period** — residual carrying of 2,760,547 and an allowance
residue of 93,151 remain after the balance reaches nil.

---

# Deal 4 — Purchased credit-impaired

**`DEMO-POCI` · Meridian Steelworks (in restructuring) · USD 100,000,000**
**Acquired 1 Jan 2026 · matures 31 Dec 2031**

## The story

A direct-lending fund buys a distressed loan with 100,000,000 of face value for
60,000,000, expecting 40,000,000 of lifetime credit losses.

## Screen 1 · Acquisition

```
Face value                   100,000,000
Consideration paid            60,000,000
Lifetime ECL at acquisition   40,000,000
Carrying value at 1 Jan 26    60,000,012
```

**Say:** carrying value opens at the price paid, not at face. Under §5.5.13 a
POCI asset carries **no day-one allowance** — the expected losses are already
in the purchase price, and provisioning them again would double-count.

## Screen 2 · Credit-adjusted EIR

**Open:** Evidence Pack · EIR trace.

**Say:** the discount rate is solved against cash flows **net of expected
credit losses** — that is what makes it credit-adjusted (§B5.4.7). It is fixed
at acquisition and never revised, even if expectations improve.

## Screen 3 · Subsequent changes

```
Day-one allowance                      none
Favourable change recognised      15,000,000  (gain)
Closing balance / carrying           0 / 0
```

**Say:** only *changes* in lifetime expected losses hit profit or loss. Here
expectations improved by 15,000,000 and that is a gain — and for POCI a gain is
permitted to take the allowance below nil, which is not true of any other
asset.

**Teaching point:** this deal closes clean — balance nil, carrying nil. Use it
as the control when the question of residual balances comes up on deals 3 and 6.

---

# Deal 5 — Fees integral to the effective interest rate

**`DEMO-FEES-EIR` · Pennine Infrastructure Partners · USD 100,000,000**
**Settled 1 Jan 2026 · matures 28 Feb 2031 · 8% fixed**

## The story

A 2,000,000 arrangement fee — 2% of commitment — received on 1 January 2026,
two months before the first drawdown on 1 March.

## Screen 1 · The fee before the asset exists

**Open:** Accounting · Journal Entries · 1 Jan 2026.

| Entry | Account | Amount |
|---|---|---|
| Deferred Fee — Cash Received | DR 111000 Cash | 2,000,000 |
| Deferred Fee Liability | CR 211000 | 2,000,000 |

**Say:** the fee is integral to the EIR under §B5.4.1, so it cannot go to
income on receipt. But there is no loan asset yet to net it against — the first
drawdown is two months away. It sits as a **liability** in the meantime.

**Teaching point:** this is the case most systems get wrong. They either take
the fee to income immediately or net it against an asset that does not exist.

## Screen 2 · Release on drawdown

**Open:** 1 Mar 2026.

| Entry | Account | Amount |
|---|---|---|
| Deferred Fee Liability | DR 211000 | 2,000,000 |
| Deferred Fee — Loan Asset Adjustment | CR 141000 | 2,000,000 |

**Say:** on first drawdown the liability is released against the loan asset.
Amortised cost opens at principal *less* the deferred fee, and accretes back to
par over the life through the effective interest rate. The fee reaches income —
but as yield, across five years, not as a lump on day one.

## Screen 3 · Impairment

```
Stage 1 · 12-month ECL · PD 0.5% · LGD 30%
Allowance = 100,000,000 × 0.5% × 30% = 150,000
```

**Say:** Stage 1, so twelve-month expected losses, not lifetime. A clean,
performing loan.

**Avoid the final period** — the 150,000 allowance is never released.

---

# Deal 6 — Restructuring, haircut and transfer

**`DEMO-HAIRCUT-SALE` · ABC Manufacturing · USD 100,000,000**
**Settled 1 Jan 2024 · matures 31 Dec 2030 (extended from 31 Dec 2028)**

## The story

A SOFR + 600 loan. On 1 January 2026 a restructuring: 15,000,000 haircut,
maturity extended two years, margin raised to SOFR + 850 to compensate. Later
the position is transferred.

## Screen 1 · The margin step

| Period | Band | All-in |
|---|---|---|
| To 31 Dec 2025 | SOFR 4% + 600 bps | **10.00%** |
| From 1 Jan 2026 | SOFR 4% + 850 bps | **12.50%** |

**Say:** the haircut and the re-pricing are one package. The lender takes a
15,000,000 loss of principal and is paid 250 basis points more on what remains.

## Screen 2 · The modification

```
Pre-modification carrying amount (31 Dec 2025)        99,362,705
Modification LOSS                                      4,442,708
PV change                                                 −4.47%
```

**Say:** comfortably inside the 10% threshold, so non-substantial: the carrying
amount is adjusted and the difference goes to profit or loss, with no
derecognition. Contrast with deal 1, where the derived figure is three times
this.

## Screen 3 · Interest over the life

```
Interest accrued    74,168,403
Coupon range        10.00% → 12.50%
```

**Say:** the step-up is visible in the schedule on the day it takes effect.

**Avoid the final period** — residual carrying of 68,284.

---

# What changed and why

This release fixed three defects, each of which had been silently producing
wrong numbers on every deal that used the affected feature.

### Date-banded spreads never reached the engine

The builder read each interest component's **base rate only**. Every dated
spread band was collected, stored, round-tripped through the database and then
discarded. The engine had a dated band lookup already, but consulted it on one
coupon type and only for externally imported deals.

Consequence: every deal ran at a flat rate for its whole life, and any PIK leg
written as a band on a zero base was switched off entirely. Deal 1 ran at 9%
for seven years instead of 9% → 0% → 11%; deal 2 at 6% instead of 10% → 6%;
deal 6 at 10% instead of 10% → 12.50%. No PIK capitalised anywhere.

### PIK capitalisation posted a one-legged journal

PIK was booked as a reclass with negative amounts, reversing an interest
receivable that is never raised for PIK. Deal 2's first corrected run came out
**8,223,619.16 out of balance — exactly its PIK total.** It now posts DR loan
asset / CR PIK interest income.

### Stored credit parameters were never loaded, then deleted

`treatment_overrides` is a one-to-one table, so the database driver returns it
as an object. The loader tested whether it was an *array* and nothing else — a
test that had been false for every row ever returned. Every stored override was
discarded on load, the engine saw no PD or LGD, and no impairment was computed.
The save path then wrote that nothing back as NULL, destroying the values.

Impairment appeared to work only in the session where a deal was first built,
while the values were still in memory and had never round-tripped.

A fourth defect was exposed while fixing the third: the ECL journal generator
seeded its running allowance from the balance on day one, so a Stage 3 deal's
entire opening allowance was never charged to profit or loss. Deal 1 showed
4,651,540 of expense against 44,651,540 of releases — a net credit of exactly
the 40,000,000 that was never charged.

### Figures that moved

| Deal | Was | Now |
|---|---|---|
| 1 coupon | 9% flat | 9% → 0% → 11% |
| 1 PIK capitalised | 0 | 11,628,849 |
| 1 modification | 12,022,928 | 14,700,847 gain |
| 1 ECL charge | 4,651,540 | 44,651,540 |
| 2 coupon | 6% flat | 10% → 6% |
| 2 PIK capitalised | 0 | 8,223,619 |
| 2 modification | 393,618 gain (asserted) | 907,632 loss (derived) |
| 3 interest | 47,422,917 | 53,886,458 |
| 6 coupon | 10% flat | 10% → 12.50% |
| 6 interest | 63,395,833 | 74,168,403 |

Deal 2's earlier figure of a 393,618 gain was never calculated — it was written
into the script as an assertion. The current figure is derived from the actual
revised cash flows discounted at the actual original EIR of 10%.

---

## Deal reference

| Deal | Code | ID |
|---|---|---|
| Stage 3 Modification | `DEMO-MOD-S3` | `e76df246-7a75-473a-b2c4-cfafc19c170e` |
| Payment Deferral and PIK Split | `DEMO-DEFER-PIK` | `fed30745-39b8-421d-a658-11b051473b7d` |
| Principal Forgiveness and Extension | `DEMO-FORGIVE-S3` | `d9db5e2d-ed68-472d-a056-f384d82e856e` |
| POCI Distressed Purchase | `DEMO-POCI` | `f0ef9565-8fdc-49ad-9dc4-6fe681903f2b` |
| Integral Fees and Deferred Fee | `DEMO-FEES-EIR` | `0a8f90f9-f7c4-4297-baeb-b1bbf0679a3e` |
| Restructuring, Haircut and Transfer | `DEMO-HAIRCUT-SALE` | `db489322-ef29-4fe2-9fdf-5f9163f385a8` |
| External Deal Marley | `SPMARLEY010` | `fde28c82-3d54-4bc2-a621-8e202d81754b` |
