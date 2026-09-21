# PCS Loan Module — data requirements

**For:** PortF
**Template version:** v0.5
**Supersedes:** v0.4, which remains valid for everything not listed here.
**Accompanying file:** `PCS Loan Import — Template v0.5.xlsx`, plus two worked
examples.

---

## Purpose

PCS receives the loan from PortF, performs the accounting, and posts the
resulting journals to Investran. PortF calculates the cash flows; PCS does not
recalculate them.

This document lists everything PCS needs to do that, in one place. It has two
parts:

- **Part A** — items outstanding from v0.4. Needed so that amounts can be
  attributed to the right period, tranche and component.
- **Part B** — new in v0.5. Needed to calculate an effective interest rate.

Anything already supplied and working is not repeated here.

---

# Part A — outstanding from v0.4

### A1. Period Start and Period End on every cashflow row

Both dates, on every row, without exception.

A single date does not say what an amount covers. On the current Suffolk file,
210 rows cannot be tied to a calendar period because only one date is present,
and one row implies a period roughly thirty times longer than its dates suggest.
Interest that cannot be placed in a period cannot be accrued, reported, or
posted to a ledger date.

### A2. One row per component

A single amount covering a fixed and a floating component cannot be split
between them after the fact. Affects 189 rows on the current Suffolk file.

PCS will not apportion a combined amount by estimate. Each component needs its
own row with its own amount.

### A3. Compounding conventions on floating components

For every component referencing a compounded risk-free rate (SONIA, SOFR, €STR):

- **Lookback** — business days
- **Lockout** — business days
- **Observation shift** — business days
- Whether daily SONIA is compounded directly, or the published Compounded Index
  is used

A compounded rate cannot be reproduced without these. They are blank on every
component supplied to date. Where a convention genuinely does not apply, `0` is
a complete answer; a blank cell is read as "not stated".

### A4. Deal and tranche GUIDs

A stable identifier that survives a rename. These exist in PortF; they are not
currently in the export. Names are labels, not keys — a renamed tranche
currently arrives as a new one.

### A5. Rounding rule

Stated once per feed: rounded per period or carried, half-up or bankers'.

### A6. Date format

Stated once per sender. `08/04/2024` is ambiguous between April and August, and
PCS will not guess — a file with ambiguous dates is rejected rather than
imported with a silent interpretation. ISO (`2024-04-08`) removes the question
entirely and is preferred.

### A7. What `Base Value` means on a floating component

A one-sentence answer, not a column.

On a fixed component `Base Value` is unambiguous — it is the coupon. On a
floating component it could reasonably mean either the **margin over the
benchmark**, or the **all-in rate** at the time of the file. PCS currently reads
it as all-in and applies no margin on top.

If it is in fact the margin, every floating rate PCS derives is understated by
the level of the benchmark — roughly 400 basis points at present. The two
readings are not close, and neither is obviously wrong from the file alone.

Please confirm which it is. If it is the margin, PCS will read it that way and
add the published benchmark.

### A8. Every movement

Every initial purchase, drawdown, principal payment and capitalisation, on the
`Movements` sheet.

Balances are derived cumulatively from these. A movement that never arrives
corrupts the balance from that date forward, and every subsequent period is then
measured against a wrong number. The `Balance checkpoints` sheet is the safety
net that catches this — quarterly checkpoints are strongly preferred.

---

# Part B — new in v0.5: effective interest rate

## Why these are needed

The effective interest rate is the rate that discounts everything received back
to what was actually paid. The contractual coupon is one input among several.

PortF already supplies the dated cash flows — the largest part of the
calculation. What is missing is the other side: what was actually paid to
acquire the loan, and which fees form part of the return rather than payment for
a service.

Without them, a loan acquired at a discount reports the same yield as one
acquired at par, and an arrangement fee is recognised at the wrong time and in
the wrong amount.

## B1. Consideration paid — `Tranches` sheet

| Column | Type | Example |
|---|---|---|
| `Consideration Paid` | amount | `98,000,000` |
| `Consideration Date` | date | `2024-03-15` |

The amount that actually left the lender to acquire the tranche, and when.

Face £100m acquired for £98m means £2m of additional yield earned across the
life of the loan, not a gain on day one. Without this field PCS must assume par,
and the discount never accretes.

Where a tranche is drawn in stages rather than purchased outright, state the
consideration for the initial advance. Later drawdowns are already covered by
the `Movements` sheet.

**This is the most important field in this document.**

## B2. Fee classification — `Components` sheet

| Column | Type | Values |
|---|---|---|
| `Yield Integral` | enum | `Yes` / `No` |

Required on every row where `Posting Type` is `fee`.

- **`Yes`** — an arrangement or origination fee: compensation for putting the
  loan on the books. It forms part of the lender's return and is spread across
  the life of the loan.
- **`No`** — an agency, administration or similar fee: payment for performing a
  service. It is recognised as the service is performed.

The same cash produces a different reported yield and a different income profile
depending on this answer. PCS could infer it from the fee's name, but a fee
named "arrangement and agency fee" is genuinely ambiguous, and an inference that
changes a reported yield should not be made silently.

Fee **amounts** are already supplied under v0.4 and need no change.

## B3. Direct transaction costs — `Tranches` sheet

| Column | Type | Example |
|---|---|---|
| `Transaction Costs` | amount | `350,000` |

Incremental costs paid to acquire or originate the loan that would not have been
incurred otherwise — external legal fees, due diligence, arranger costs.

These reduce the initial carrying amount and therefore raise the effective
yield. A stated `0` is a complete answer. A blank cell is not, and is recorded
as not stated.

## B4. Expected redemption — `Tranches` sheet

| Column | Type | Example |
|---|---|---|
| `Expected Redemption Date` | date | `2031-06-30` |

The date PortF's model expects the tranche to be repaid, where this differs from
contractual maturity.

The effective interest rate is spread over the **expected** life, not the
contractual life, where early repayment is expected. Suffolk's contractual
maturity is 2063; if the working assumption is redemption in the early 2030s,
the two produce materially different yields.

**Blank is an acceptable answer** and means "no expectation modelled — use
contractual maturity". PCS records which of the two it used.

## B5. Credit-impaired at acquisition — `Tranches` sheet

| Column | Type | Values |
|---|---|---|
| `Credit Impaired at Acquisition` | enum | `Yes` / `No` |

Whether the tranche was already credit-impaired at the point it was acquired or
originated — a distressed purchase, a loan already in default, a restructuring
taken on at a deep discount.

This is not a variation on the normal calculation. An asset that was
credit-impaired when acquired takes a **credit-adjusted** effective interest
rate, with lifetime expected credit losses built into the yield from the outset
rather than carried as a separate allowance. Applying the ordinary method to
such an asset overstates interest income for the whole of its life, and the
error does not self-correct.

`No` is the answer for the overwhelming majority of loans and is a complete
answer. It is asked on every tranche rather than inferred, because a loan
acquired at 65 might be distressed or might simply be long-dated and
out-of-the-money, and the file does not distinguish them.

Where the answer is `Yes`, PCS will also need the lifetime credit loss expected
at acquisition. We will come back on the format for that separately rather than
hold up the rest of this request.

---

## Template changes in v0.5

Five columns added to `Tranches`:

```
Tranche ID | Tranche GUID | Tranche Name | Currency | Face Value | Commitment |
Consideration Paid | Consideration Date | Transaction Costs |
Expected Redemption Date | Credit Impaired at Acquisition
```

One column added to `Components`:

```
… | Lookback | Lockout | Obs Shift | First Settlement Date | Fee Types | Yield Integral
```

Two columns added to `Lookup values`:

| Field | Permitted values |
|---|---|
| `Yield Integral` | `Yes`, `No` |
| `Credit Impaired at Acquisition` | `Yes`, `No` |

No other sheet changes. Column order is not significant — headers are matched by
label, so columns may sit anywhere on their sheet.

The v0.5 template also corrects three errors carried in the previous file:
`ACT/365` was missing from the day-count list, `Monthly` was misspelt in the
frequency list, and the arrangement fee was spelt differently in two places.

---

## What is not being asked for

To keep the scope clear:

- **Not** asking PortF to calculate an effective interest rate. PCS does that,
  and the accounting policy choices that go with it — including whether the
  rate is revised at each reset on a floating tranche — are ours to make.
- **Not** asking for carrying values, amortisation schedules or any derived
  figure. PCS derives those from what you send.
- **Not** asking for balances. PCS derives these from the movements, and the
  balance checkpoints confirm them.
- **Not** asking for anything retrospective. These fields are needed on new
  files; whether to reissue existing deals is a separate conversation.

---

## How incomplete files are handled

A file that omits any of the above still imports. Nothing is rejected for
missing an optional field, and nothing is silently filled in.

Every value PCS uses is recorded as either **stated** — supplied by PortF, and
therefore reconcilable against your figures — or **assumed**, meaning PCS
applied a default and has flagged the result as not independently supported.

The practical consequence: a deal supplied without Part B imports cleanly, and
its effective interest rate equals its contractual coupon. That is the correct
answer for a loan acquired at par with no fees, and PCS will say so rather than
presenting it as a calculated yield.
