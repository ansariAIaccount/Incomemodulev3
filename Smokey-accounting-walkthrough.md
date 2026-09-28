# External Deal Smokey — every calculation PCS performs, and why

**Deal:** External Deal Smokey · `SPSmokey015` · `deals.deal_code = SPSMOKEY015`
**Counterparty:** Haventus (Ardersier) · Agent: M&G Trustee Company Limited
**Source:** PortF workbook `smokey.xlsx` (v0.4 sheet set, v0.5 columns present but unfilled)
**Module:** PCS Loan Module V4 · V4.9

---

## How this document was produced, and what that means for trusting it

Every figure below is computed **directly from `smokey.xlsx`** — the workbook that was imported — by walking the same sheets, in the same order, with the same rules the PCS code applies. The code paths were read line by line; the arithmetic was then executed independently against the source data.

It was **not** read out of a completed accounting run. The local app session was signed out when this was written, and Supabase RLS returns empty rows rather than an error to an unauthenticated client — so querying the stored run would have produced blanks that look like zeros. The workbook is the authority anyway: the snapshot is derived from it.

Consequence for how you read this: figures labelled **derived** are arithmetic on the source data and are reliable. Figures labelled **expected** are what the code specifies PCS will produce. Where the two differ, §7 says so explicitly, and that difference is the substance of this document.

---

## 1 · Summary — what happens, in order

| Step | What PCS does | Result on Smokey |
|---|---|---|
| 1 | Read terms from **Loan info** | 10-year GBP term loan, £50m commitment, ACT/360, bullet |
| 2 | Read tranche from **Tranches** | One tranche, T1, face £50,000,000 |
| 3 | Read components | 1 interest (C1) + 3 fees (F1 arrangement, F2 monitoring, F3 commitment) |
| 4 | Attribute fee amounts from **Cashflows** | F1 £750,000 · F2 £300,164.31 · F3 £674,480.15 |
| 5 | Classify each fee | F1 → **inside the EIR**; F2, F3 → IFRS 15 service fees |
| 6 | Build the balance from **Movements** | 17 drawdowns, 37 repayments, 39 PIK capitalisations |
| 7 | Check against **Balance checkpoints** | 27 checkpoints — **none reconcile fully** (§5) |
| 8 | Decide the EIR method | `effectiveInterestPrice` selected… |
| 9 | Solve the EIR | …but **never runs**. Status `coupon` (§4) |
| 10 | Release the £750,000 fee | Flat daily, £205.37/day over 3,652 days (§4.4) |
| 11 | Measure ECL daily | Stage 1, PD 0.5% × LGD 30% = 15 bps of balance (§6) |
| 12 | Journalise the feed | 87 rows → **348 JE lines** (§3) |
| 13 | Add principal movements | Drawdowns + repayments → 108 lines. **Capitalisations: none** (§7.1) |
| 14 | Add ECL per reporting date | 53 monthly movements → 106 lines (§6.3) |

### The headline

**Three things PCS calculates for this deal are wrong or absent, and all three are silent.** In order of size:

1. **£8,345,261.74 of PIK capitalisations are read, stored, mapped — and then used by nothing.** The derived balance closes at **−£8,345,261.74** instead of zero. (§7.1)
2. **No EIR is calculated**, because C1's Base Value cell is empty. The method is selected and then the solver's entry test fails. (§4.3)
3. **The £750,000 arrangement fee never reaches the general ledger**, even though it accretes into the carrying amount on screen. (§7.2)

And one thing that works exactly as designed: **the balance checkpoint sheet caught a real discrepancy**, which is the entire reason it exists. (§5)

---

## 2 · The inputs, sheet by sheet

### 2.1 Loan info → the instrument's frame

| Field | Value | Used for |
|---|---|---|
| Deal Structure | Corporate term loan | Maps to `corporate_term` |
| Currency | GBP | Reporting currency |
| Accounting Framework | IFRS | Selects the IFRS EIR path, not `computeEIRUSGAAP` |
| Signing Date | 2024-03-28 | **Display and export only** — never reaches an accrual |
| Settlement Date | 2024-03-28 | Day zero for everything |
| Maturity Date | 2034-03-28 | Horizon (no expected redemption stated) |
| Total Commitment | £50,000,000 | Fee bases, undrawn calculations |
| Availability End | 2027-03-28 | Commitment-fee window |
| Day Count | **ACT/360** | `daysPerYear = 360` in both the seed and the daily walk |
| Repayment Type | Bullet at maturity | No amortisation profile expanded |

Life of the deal: **3,652 days** (2024-03-28 → 2034-03-28).

Signing and settlement are the same date here, so the distinction doesn't bite — but it is load-bearing in general, and the code dates everything off settlement deliberately.

### 2.2 Tranches → the v0.5 EIR inputs are all placeholders

This is the first thing that changes the answer, and it is easy to miss because the sheet *looks* populated.

| Column | Cell contents | Parsed as |
|---|---|---|
| Face Value | `50000000` | 50,000,000 |
| Commitment | `50000000` | 50,000,000 |
| Consideration Paid | `<amount actually paid>` | **null** |
| Consideration Date | `<YYYY-MM-DD>` | **null** |
| Transaction Costs | `<costs, or 0>` | **null** |
| Expected Redemption Date | `<blank = contractual maturity>` | **null** |
| Credit Impaired at Acquisition | `<Yes/No>` | **null** |

The template's angle-bracket instructions were never replaced with values. `num()` returns null for non-numeric text and `yesNo()` returns null for anything that isn't a recognised yes/no, so every v0.5 field arrives unstated.

**This is the correct parse, not a bug.** The alternative — coercing `<costs, or 0>` to zero — would assert "costs were nil" on a file that said nothing. But it means:

- `purchasePrice` = **undefined** → PCS infers the carrying amount from actual drawdowns
- `transactionCosts` = **null** → nothing added to opening carrying
- `expectedRedemptionDate` = **null** → horizon is contractual maturity, 2034-03-28
- `creditImpairedAtAcquisition` = **null** → not treated as POCI, so no refusal

Of the three conditions that trigger an EIR solve (see `EIR-external-deals-reference.md` §1.2), **conditions 1 and 3 both fail here.** Only the fee condition survives.

### 2.3 Components → one interest line and three fees

| ID | Name | Type | Settles | Interest Type | Base Value | Frequency | Yield Integral |
|---|---|---|---|---|---|---|---|
| C1 | Interest | interest | cash | FIXED | **(empty)** | Quarterly | — |
| F1 | Arrangement fee | fee | cash | — | (empty) | **One-off** | **Yes** |
| F2 | Monitoring Fee | fee | cash | — | (empty) | Quarterly | **No** |
| F3 | Commitment Fee | fee | cash | — | (empty) | Quarterly | **(blank)** |

Four consequences, each traceable to one cell:

- **C1 Base Value is empty.** This is the single most consequential blank in the workbook. It becomes `couponRateNominal = 0`, which suppresses the EIR solve entirely (§4.3) and makes all 39 interest rows unverifiable (§3.3).
- **F1 Yield Integral = Yes** → `ifrs: 'IFRS9-EIR'`, and with frequency `One-off` → `oneOff`, it passes all three of the engine's pool gates. £750,000 enters `deferredEIRPool`.
- **F2 = No** → IFRS 15 point-in-time. Recognised as the service is performed, kept out of the yield. Correct.
- **F3 is blank.** PCS does **not** guess from the name "Commitment Fee". It records the fee, keeps it out of the yield, and the parser raises a warning naming the row. The Cashflow tab shows it as `service` because `ifrs` resolves to `IFRS15-pointInTime` — but `yieldIntegralStated` is false, so the underlying truth is "unstated", not "No". A reader who needs to know the difference should read the parser warning, not the chip.

### 2.4 Fee amounts come from the Cashflows sheet, not the Components sheet

Under v0.4/v0.5 the Components sheet carries a *rate* at most; for a flat fee it carries nothing. So the amount is summed from that component's own cashflow rows:

```
F1  1 row   →  £750,000.00
F2  40 rows →  £300,164.31
F3  7 rows  →  £674,480.15
            ─────────────
Total fees     £1,724,644.46
```

This is not recomputing PortF's schedule — it is reading the figure they already sent and attributing it to the fee it belongs to. Without this step the deferred-income pool would see a fee of zero, and no arrangement fee would ever enter the EIR.

A fee with a non-zero attributed amount gets `mode: 'fixAmount'` → `'fixed'` in the instrument, which is one of the two modes the engine's pool accepts.

### 2.5 Cashflows → 87 rows, all cash-settled

| Component | Posting | Settles | Rows | Total |
|---|---|---|---|---|
| C1 | interest | cash | 39 | £29,576,624.64 |
| F1 | fee | cash | 1 | £750,000.00 |
| F2 | fee | cash | 40 | £300,164.31 |
| F3 | fee | cash | 7 | £674,480.15 |
| **Total** | | | **87** | **£31,301,269.10** |

Span of `flow_date`: **2024-04-08 → 2034-03-28**. The feed covers the full contractual life, so the schedule is **not** truncated — the "accounting stops where the feed stops" mechanism does not engage on this deal.

Cash settled equals the accrual on every row (£31,301,269.10), because every row's Settlement Type is `cash`.

### 2.6 The Period Start column is corrupted — at the Excel level, before PCS sees it

Worth a section of its own, because it is invisible in the app and explains a diagnostic that otherwise looks wrong.

Reading the raw cells:

| Cell | Period Start | Type | Period End | Type |
|---|---|---|---|---|
| Row 9 | `2034-01-01` | **datetime** | `28/03/2034` | text |
| Row 11 | `2024-01-04` | **datetime** | `28/06/2024` | text |
| Row 13 | `2030-01-04` | **datetime** | `28/06/2030` | text |
| Row 15 | `2029-01-07` | **datetime** | `28/09/2029` | text |
| — | `2032-01-10` | **datetime** | `31/12/2032` | text |

The pattern is unmistakable. A period ending in March starts `01-01`; June → `01-04`; September → `01-07`; December → `01-10`. These were written as `01/01`, `01/04`, `01/07`, `01/10` — **1 January, 1 April, 1 July, 1 October in DD/MM** — and Excel read them as MM/DD, producing 1 Jan, 4 Jan, 7 Jan, 10 Jan.

Period **End** escaped the same fate for a revealing reason: `28/06/2024` has a first component greater than 12, so Excel could not read it as a month and left it as **text**. PCS's own date-convention scan then reads that text correctly as DD/MM.

**So PCS gets Period End right and Period Start wrong, and cannot detect the latter** — a genuine `datetime` cell carries no evidence that it was mis-parsed upstream.

What this costs:

- `daysCovered = dayDiff(periodStart, periodEnd)` is wrong on every accrual row. For the period truly covering 1 Apr → 28 Jun 2024 (88 days), PCS computes 4 Jan → 28 Jun = **176 days** — exactly double.
- `flow_date = periodEnd || periodStart`, so **JE effective dates are unaffected and correct.** The corruption does not move a single journal date.
- Any future day-count verification of the feed will fail on all 39 interest rows for this reason on top of the missing Base Value.

**Fix at source:** format the Period Start column as text, or as an unambiguous ISO date, before sending. The asymmetry — one column right, one wrong, in the same file — is what makes this class of error so persistent.

---

## 3 · Journalising the feed

### 3.1 The governing principle

For an imported deal, PortF calculates and PCS accounts. `generateDIUFromExternalFeed` posts **the received rows and nothing else** — no horizon, no period grid, no forecast. One row in, one JE pair out. The ledger therefore ends where the feed ends.

This replaced an earlier behaviour that journalised imported deals from PCS's own projection. On another deal that produced 901 journal entries running to 2063 from a feed of 27 rows covering one month — and not one interest journal fell inside the month that had actually been reported.

### 3.2 What each row produces

Every Smokey row accrues and settles the same amount, so every row yields **two** pairs — four lines:

**Interest rows (39):**

```
DR  Interest Receivable                 40100      amount
CR  Income - Daily Accrued Interest      23000      amount
DR  Interest Cash Receipt                10000      cash_settled
CR  Interest Receivable Clear            23000      cash_settled
```

**Fee rows (48):**

```
CR  Fee Income (PortF)                   40250      amount
DR  Fee Receivable                       23150      amount
DR  Fee Cash Receipt                     10000      cash_settled
CR  Fee Receivable Clear                 23150      cash_settled
```

| | |
|---|---|
| Rows posted | **87** |
| Rows skipped / unmapped | **0** |
| JE lines from the feed | **348** |
| Effective-date span | 2024-04-08 → 2034-03-28 |

Three rules in this generator are worth stating, because each was a way of quietly inventing a number:

1. **Cash is posted from `cash_settled`, never from the accrual.** An accrued amount is not evidence that it was paid. `cash_settled` arrives as a *numeric* column, not a boolean — treating it as truthy would have posted the full accrual as cash on any row that settled a penny.
2. **An unmapped posting type is reported, not skipped.** Silently dropping a row type would understate income while the run still reported success. Smokey has none, but the count is surfaced either way.
3. **Transaction-type labels are reused verbatim.** `applyInvestranGLMapping` routes on that text, so a clearer label here would silently change the GL account the entry lands in.

### 3.3 Why the Cashflow tab shows "39 unverified · 48 flat"

Not a defect — a statement about what the file supports. From `classifyRow`:

- **48 flat.** F1, F2 and F3 all have an empty Base Value, so `isFlatFee` is true. A flat amount with no rate is recorded by design and is not checkable. 1 + 40 + 7 = 48.
- **39 unverified.** The C1 rows have both period dates, so they pass that gate — but `hasRateTerms` requires either a non-empty Base Value or a non-FIXED interest type. C1 is FIXED with a blank Base Value, so PCS has no rate with which to recalculate the £29,576,624.64. It records the amount and declines to claim it checked it.

**To make those 39 rows verifiable, populate C1's Base Value.** That one cell would also switch the EIR on — see §4.3.

---

## 4 · The effective interest rate

### 4.1 Opening carrying amount

No consideration was stated, so the engine falls back to the actual funding. Smokey has no initial draw at settlement (the first drawdown is 2024-08-22, five months later) and does have future draws, so:

```
carryingValue (precedence rule 3: deferred-draw facility)    =          0.00
− deferredEIRPool (F1 arrangement fee, yield-integral)        =   −750,000.00
+ transactionCosts (not stated)                               =          0.00
                                                                ─────────────
eirOpeningCarrying                                            =   −750,000.00
```

A **negative** opening carrying amount. It is not nonsense — it is the correct representation of a fee received before any money went out — but it is an edge the solver is not designed for. `eirT0` guards against it (`eirOpeningCarrying > 0 ? … : purchasePrice || faceValue`), so the solve would have anchored on **£50,000,000** rather than on the amount actually invested. It never gets that far, for the reason in §4.3.

### 4.2 The method is selected

```
condition 1  consideration ≠ face       →  FALSE  (not stated)
condition 2  yield-integral fee ≠ 0     →  TRUE   (F1 = £750,000)
condition 3  transaction costs ≠ 0      →  FALSE  (not stated)
                                           ─────
amortization.method = 'effectiveInterestPrice'
```

### 4.3 …and then the solve never runs

The engine's entry test:

```js
if(!pociFlag && amort.method === 'effectiveInterestPrice'
   && instr.faceValue && couponRateNominal){    // ← fails here
```

`couponRateNominal` is derived as:

```js
let couponRateNominal = instr.coupon?.fixedRate ?? 0;
```

and `coupon.fixedRate` comes from C1's Base Value, which is **empty**. So `couponRateNominal = 0`, the test fails, and no yield is solved.

**The result on screen:**

| | |
|---|---|
| `effectiveYield` | `null` |
| `eirBasis.status` | `coupon` |
| `eirBasis.reason` | *"No effective yield was solved — the amortisation method is not set. The figure shown is the contractual coupon and must not be reported as an effective interest rate."* |

That reason is **factually wrong on this deal.** The method *was* set, to `effectiveInterestPrice`, by condition 2. The solve was suppressed by a missing coupon, which is a different problem with a different fix — and the message sends you looking in the wrong place.

This is a **third** suppression route, distinct from the two in `EIR-external-deals-reference.md` §9.1 and §9.2. Neither of those applies to Smokey: the coupon is FIXED (so §9.1's floating-type trap doesn't fire) and F1's frequency is `oneOff` (so §9.2's frequency gate doesn't fire). This one is simply a blank rate cell.

**One cell fixes it.** Populate C1 Base Value and the solve runs, the 39 interest rows become verifiable, and `eirBasis.status` becomes `calculated`.

### 4.4 What happens to the £750,000 instead

With no solved yield and a non-empty pool, the legacy flat fallback engages:

```
eirFlatFallback = deferredEIRPool / totalLifeDays
                = 750,000 / 3,652
                = £205.37 per day
```

Each day, `dailyEIRAccretion = min(205.37, pool − accreted so far)`, so the release cannot overshoot: the final day takes the residual and cumulative accretion lands exactly on £750,000 with no float drift.

**This is straight-line, not effective-interest.** IFRS 9 requires the fee to be amortised using the effective interest method. A flat release is an approximation that happens to be tolerable on a bullet with a stable balance, and is *not* tolerable here — Smokey's balance ramps from zero to £50m over 16 months and then amortises for seven years, so the correct accretion is heavily back-loaded relative to a flat line.

The fallback is documented in the engine as "better than nothing" for deals with no solved yield. On Smokey it is the **only** mechanism, because §4.3 suppressed the yield.

---

## 5 · The balance, and what the checkpoints caught

### 5.1 Building the balance from Movements

| Movement type | Rows | Total |
|---|---|---|
| Drawdown | 17 | £50,000,000.00 |
| PIK Capitalisation | 39 | £8,345,261.74 |
| Principal Payment | 37 | £58,345,261.74 |

**The feed reconciles exactly:** £50,000,000 drawn + £8,345,261.74 capitalised = £58,345,261.74 repaid. Closing balance **£0.00**. Peak **£52,117,000.23**.

That the feed ties to the penny across 93 movements over ten years is a strong signal the sender's own books are in order. It is also what makes §7.1 provable rather than arguable.

Drawdown schedule — note the shape, because it matters for the fee accretion argument in §4.4:

```
2024-08-22    2,974,038.00   cum   2,974,038.00
2024-09-16    6,192,301.00   cum   9,166,339.00
2024-10-16    3,309,245.00   cum  12,475,584.00
2024-11-18    4,697,046.00   cum  17,172,630.00
2024-12-17    4,416,428.00   cum  21,589,058.00
2025-01-21    1,767,911.00   cum  23,356,969.00
2025-02-17    2,548,234.00   cum  25,905,203.00
2025-03-17    3,486,409.00   cum  29,391,612.00
2025-04-17    2,912,701.00   cum  32,304,313.00
2025-05-16    2,909,670.00   cum  35,213,983.00
2025-06-17    3,030,042.00   cum  38,244,025.00
2025-07-17    1,804,519.00   cum  40,048,544.00
2025-08-18    1,435,758.00   cum  41,484,302.00
2025-09-17      753,022.00   cum  42,237,324.00
2025-10-20      130,328.00   cum  42,367,652.00
2025-11-20      365,169.00   cum  42,732,821.00
2025-12-19    7,267,179.00   cum  50,000,000.00   ← fully drawn
```

Fully drawn 2025-12-19, comfortably inside the 2027-03-28 availability end. First PIK capitalisation 2024-09-30; first repayment 2027-03-31.

### 5.2 The checkpoints — working exactly as intended

27 daily checkpoints, 2025-12-01 to 2025-12-27, every one stating **£50,000,000** in both the Principal Balance and Principal + Capitalised columns.

| Window | Stated P+C | Derived P+C | Difference |
|---|---|---|---|
| 2025-12-01 → 12-18 | 50,000,000.00 | 43,406,194.86 | **+6,593,805.14** |
| 2025-12-19 → 12-27 | 50,000,000.00 | 50,673,373.86 | **−673,373.86** |

Two separate discrepancies, and each names its own cause precisely:

**1 → 18 December: short by £6,593,805.14.** Of that, £7,267,179 is the drawdown the Movements sheet dates **19 December**. The checkpoints assert the facility was fully drawn from 1 December. Either the checkpoints were filled in with the closing figure for the whole month, or the final drawdown is mis-dated by up to 18 days. Those have different consequences — the second would misstate 18 days of interest on £7.3m — so it is worth resolving rather than assuming.

**19 → 27 December: over by £673,373.86.** Here the Principal Balance column reconciles to the penny at £50,000,000. But the **Principal + Capitalised** column also reads £50,000,000, while £673,373.86 of PIK had been capitalised by that date. That column appears to have been filled with the same number as the one beside it.

**This is the checkpoint sheet doing its only job.** Without it, a balance that drifts by £6.6m on a £50m facility corrupts every subsequent period's interest comparison, and nothing on screen says so. The sheet turns silent drift into a dated, quantified mismatch — and it found one on the first deal it was used on.

**Note the limits of what it proves.** These checkpoints cover 27 days out of 3,652 — 0.7% of the life, all inside one month. They confirm nothing about 2027–2034, which is where all 37 repayments fall.

---

## 6 · Expected credit losses

ECL is **PCS's own calculation**. PortF sends cashflows, movements and terms, and never a loss allowance. An imported deal's interest comes from the feed; its allowance comes from here.

### 6.1 Inputs

No treatment overrides are set on this deal, so the IFRS defaults apply:

| Field | Value | Meaning |
|---|---|---|
| `ifrs.ecLStage` | 1 | 12-month ECL |
| `ifrs.pdAnnual` | 0.005 | 0.5% annual PD |
| `ifrs.lgd` | 0.30 | 30% loss given default |
| Covenants | none on the feed | No SICR escalation possible |

**These are defaults, not Smokey's credit assessment.** Nobody has entered a PD or LGD for this borrower; the deal is carrying the engine's seed values. Any allowance below is therefore arithmetically correct and economically unsubstantiated. An empty Treatment panel produces a clean-looking run with no warning on screen.

### 6.2 Daily measurement

Stage 1 has no remaining-life term:

```
target = balance × pdAnnual × lgd
       = balance × 0.005 × 0.30
       = balance × 0.0015          (15 basis points)

dailyChange = target − allowance
allowance  += dailyChange
```

Target-seeking, not accumulating: the allowance moves to whatever the balance implies each day, so it rises with the drawdowns and falls as the loan amortises.

### 6.3 Posting — one entry per reporting date

Monthly grid by default (override with `window.__ECL_REPORTING_FREQ`). Movements of ≤ £0.005 produce no entry, so a flat allowance yields one entry when first raised and nothing after.

| | Derived |
|---|---|
| Reporting periods over the life | **120** |
| Periods with a movement > £0.005 | **53** |
| JE lines (one DR/CR pair each) | **106** |
| First entry | 2024-08-28 — provision **£4,461.06** |
| Peak allowance | **£75,000.00** (on £50m fully drawn) |
| Closing allowance | **£0.00** |
| Cumulative P&L charge | **−£0.01** |

**The roll-forward ties.** Sum of all 53 movements equals the closing allowance within one penny across 120 periods — the documented rounding drift, each period's delta being rounded to 2dp.

```
delta > 0   DR  Impairment Expense (ECL)            70100 → 470000
            CR  Loan Loss Allowance (Contra-Asset)  15500 → 145000

delta < 0   CR  Impairment Reversal (ECL)           70100 → 470000
            DR  Loan Loss Allowance Reversal        15500 → 145000
```

The splitter runs **before** the "Generate up until" filter. That ordering matters: the allowance has to be re-dated to a reporting date before rows after the cut-off are dropped, or a month-end close deletes the entry instead of keeping it.

### 6.4 The allowance is understated, because the balance is

ECL is measured on the balance PCS derives. Since that balance omits the PIK capitalisations (§7.1), so does the allowance:

| | Peak allowance |
|---|---|
| On the feed's true balance (£52,117,000.23) | £78,175.50 |
| On PCS's derived balance (£50,000,000.00) | **£75,000.00** |

£3,175.50 at peak. Small in absolute terms — but it is the same error as §7.1 expressed in a second place, and it will scale with any realistic PD.

---

## 7 · The three defects, with proof

### 7.1 £8,345,261.74 of PIK capitalisations are parsed, stored, mapped — and read by nothing

**The chain.** `externalSnapshotToBuilder` maps capitalisation events onto the tranche:

```js
pikCapitalisations: ev.filter(e => e.eventType === 'capitalisation')
              .map(e => ({ date: e.eventDate, amount: Math.abs(+e.amount || 0) })),
```

with this comment above it:

> *"Capitalised coupon raises the balance it then accrues on, so a PIK tranche whose capitalisations are dropped under-accrues for the rest of its life. They are carried here as drawdowns because that is how the Builder raises a balance."*

**They are not carried as drawdowns.** `pikCapitalisations` is written at that one line and appears **nowhere else in the codebase**. `builderToInstrument`'s `principalSchedule` consumes `t.drawdowns` and `t.repayments` only. The comment describes an intention the code does not implement — which is worse than no comment, because it reads as a reassurance.

**Proof by arithmetic.** Walking the same Movements sheet twice:

| | Peak balance | Closing balance |
|---|---|---|
| With capitalisations (the feed's truth) | £52,117,000.23 | **£0.00** |
| Without them (what PCS builds) | £50,000,000.00 | **−£8,345,261.74** |

The feed ties to zero. PCS's derived balance closes **£8,345,261.74 negative** — a loan that repays more principal than was ever advanced.

**It is not only a final-day artefact.** The understatement compounds from the first capitalisation in September 2024:

| Date | Feed truth | PCS derived | Understated by |
|---|---|---|---|
| 2025-12-31 | 50,930,280.41 | 50,000,000.00 | 930,280.41 |
| 2026-12-31 | 52,117,000.23 | 50,000,000.00 | 2,117,000.23 |
| 2028-12-31 | 42,637,071.21 | 38,276,573.64 | 4,360,497.57 |
| 2030-12-31 | 32,964,474.92 | 26,864,877.88 | 6,099,597.04 |
| 2032-12-31 | 29,038,095.46 | 21,496,675.40 | 7,541,420.06 |
| 2033-12-31 | 26,849,305.92 | 18,653,610.61 | 8,195,695.31 |

**Downstream effects.** Everything measured on the balance inherits the error: the ECL allowance (§6.4), the carrying amount and the Cashflow tab's carrying columns, any balance-basis fee recomputation, and any future verification of the 39 interest rows — which were computed by PortF on the true balance and will never reconcile against a balance missing £8.3m.

**And separately: no journal.** `generateDIUFromExternalFeed` handles `capitalisation` posting types — but that reads the **Cashflows** sheet, which for Smokey contains only interest and fee rows. `emitPrincipalMovementsFromSchedule` handles only `draw` and `paydown`. The external-PIK replacement block is explicitly skipped on the feed path (`if(!_extCtx && …)`). So **all three** routes miss it, and £8,345,261.74 of capitalised income never reaches the ledger.

Why the batch still balances: PCS never raised the asset either, so there is no orphan debit — the money is simply absent from both sides. That is precisely why nothing complains.

### 7.2 The £750,000 arrangement fee accretes on screen and never reaches the ledger

`EIR Fee Accretion` and `EIR Fee Accretion Offset` (40100 / 40110) are emitted **only** inside `generateDIU`. The import path replaces that call outright:

```js
if(_extCtx){ M.acctJournals = fed.entries; }       // feed rows only
else       { M.acctJournals = generateDIU(...); }  // includes EIR accretion
```

Principal movements and ECL are then added back **by name**. EIR accretion is not.

**On Smokey:** £205.37/day × 3,652 days = £750,000 of accretion. It appears on the KPI strip as `EIR Accretion`, it is inside `carryingValue` on every schedule row, and the Cashflow tab's carrying columns are computed from it — with **no journal entry anywhere**.

So interest income in the ledger is understated by £750,000 over the life, and the carrying amount on screen cannot be tied to the carrying amount implied by the posted journals. Anyone reconciling the two will find a £750,000 difference with nothing to explain it.

This is the same shape as the ECL regression fixed in V4.5 — an allowance on the KPI card with nothing in the ledger. Fixed for ECL, still open for EIR accretion.

### 7.3 The "no EIR" message names the wrong cause

Covered in §4.3. `eirBasis.reason` says the amortisation method is not set; on Smokey it is set, and the solve was suppressed by a blank Base Value. `status: 'coupon'` also conflates two genuinely different situations — "correctly at par, nothing to amortise" and "inputs existed but the solve did not run" — so a caller keying off status alone cannot tell a right answer from a suppressed one.

---

## 8 · Journal entry totals

| Source | Lines | Notes |
|---|---|---|
| Feed rows (87 × 4) | **348** | 39 interest, 48 fee; accrual pair + cash pair each |
| Drawdowns (17 × 2) | **34** | via `emitPrincipalMovementsFromSchedule`, GL-mapped |
| Repayments (37 × 2) | **74** | ditto |
| ECL (53 × 2) | **106** | via `splitECLByReportingPeriod` |
| **Total expected** | **≈ 562** | |
| PIK capitalisations | **0** | should be 39 × 2 = 78 — §7.1 |
| EIR fee accretion | **0** | should be present — §7.2 |

GL mapping applied to all of them: 15000 → 141000 (loan asset), 10000 → 111000 (cash), 70100 → 470000 (impairment), 15500 → 145000 (allowance).

Run this to confirm on a live run:

```js
const t = {};
M.acctJournals.forEach(j => t[j.transactionType] = (t[j.transactionType]||0) + 1);
console.table(t);

M.acctJournals.filter(j => /PIK/i.test(j.transactionType)).length;              // expect 0 — §7.1
M.acctJournals.filter(j => /EIR Fee Accretion/.test(j.transactionType)).length; // expect 0 — §7.2
```

---

## 9 · What to fix, in order

**On the workbook — the sender:**

1. **Populate C1 Base Value.** One cell. Switches the EIR solve on, makes 39 interest rows verifiable, and removes the misleading "method not set" message.
2. **Fix the Period Start column.** Format as text or ISO before sending. Currently every accrual period length is wrong, some by 2×.
3. **Fill the v0.5 Tranches columns, or clear the placeholders.** Consideration Paid, Transaction Costs and POCI are angle-bracket instructions, so nothing about the acquisition reaches the EIR.
4. **Resolve the checkpoint discrepancy.** Either the checkpoints are month-end figures stamped across every day, or the 2025-12-19 drawdown of £7,267,179 is mis-dated. The second would misstate interest.
5. **Fix the Principal + Capitalised checkpoint column.** It currently duplicates Principal Balance and ignores £673,373.86 of PIK.

**In PCS — us:**

6. **Feed `pikCapitalisations` into `principalSchedule`** and emit the DR asset / CR PIK income pair on the feed path. This is the £8.3m item and everything downstream of the balance depends on it.
7. **Emit EIR fee accretion on the feed path**, the way ECL and principal movements already are.
8. **Correct the `eirBasis.reason` text** to distinguish "method not set" from "no coupon rate to solve against", and split `status: 'coupon'` into "at par, nothing to amortise" and "suppressed".
9. **Warn when the pool is non-empty but no yield was solved** — that combination means the fee is being released straight-line, which is not the effective interest method.
10. **Reject a negative opening carrying amount** rather than silently substituting face value.

---

## 10 · Verification recipe

Sign in, load External Deal Smokey, then:

```js
const inst = builderToInstrument();
const sch  = buildSchedule(inst);

// §4 — the EIR verdict
sch.eirBasis.status;            // expect 'coupon'
sch.eirBasis.reason;            // the misleading text — §7.3
inst.amortization.method;       // expect 'effectiveInterestPrice'  ← method IS set
inst.coupon.fixedRate;          // expect 0                         ← this is why
sch.deferredEIRPool;            // expect 750000

// §7.1 — the capitalisations
(B.tranches[0].pikCapitalisations || []).length;                   // expect 39
inst.principalSchedule.filter(e => /cap/i.test(e.type || '')).length; // expect 0  ← the bug
sch[sch.length-1].balance;      // expect ≈ −8,345,261.74           ← the proof

// §7.2 — the accretion that never posts
M.summary.totalEIRAccretion;                                            // expect ≈ 750000
M.acctJournals.filter(j => /EIR Fee Accretion/.test(j.transactionType)).length; // expect 0

// §6 — ECL
M.acctJournals.filter(j => /ECL|Impairment|Loan Loss/i.test(j.transactionType)).length; // expect 106
```

If `sch[sch.length-1].balance` is negative, §7.1 is confirmed on the live run. That single assertion is the cheapest regression test for this whole class of defect and is worth adding to the harness.

---

### Companion documents

- `EIR-external-deals-reference.md` — the EIR mechanism in general, and its known gaps
- `ECL-calculation-reference.md` — expected credit losses
- `DEPLOYMENT.md` — the eight deployable files
