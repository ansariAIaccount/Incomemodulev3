# PortF → PCS feed contract v0.5 — effective interest rate

**Status:** draft for PortF review
**Extends:** v0.4 (flat amounts). Nothing in v0.4 changes.
**Adds:** the inputs needed to calculate an effective interest rate.

---

## Why this exists

v0.4 settled how PortF describes *what happened* — movements, amounts, periods.
That is enough for PCS to post the cash and the accruals, and it works today.

It is not enough to calculate an effective interest rate, and PCS is the party
that has to produce one. This addendum asks for the five things still missing.

It is deliberately separate from the outstanding v0.4 request for lookback,
lockout and observation shift. Those are needed to **verify PortF's floating-rate
arithmetic**. The fields below are needed to **do the accounting at all**. They
are different asks with different consequences and should not be traded off
against each other.

---

## What an EIR needs

The effective interest rate is the rate that discounts everything received back
to what was actually paid. The coupon is one input among several.

Three ingredients:

1. **What was paid** — the amount that actually left the lender, net of fees
   received and costs paid at origination.
2. **What comes back, and when** — dated cash flows to the expected end of the
   loan.
3. **The rate connecting them** — solved, not quoted.

PortF already supplies ingredient 2 in full. This addendum covers ingredient 1.
Ingredient 3 is PCS's job.

A loan bought at par, with no fees and no costs, has an EIR equal to its coupon.
That is the answer PCS reports for every externally-loaded deal today — not
because it is true, but because ingredient 1 never arrives.

---

## The five fields

### 1. Consideration paid — `Tranches` sheet

| Column | Type | Example | Required |
|---|---|---|---|
| `Consideration Paid` | amount | `98,000,000` | Yes |
| `Consideration Date` | date | `2024-03-15` | Yes |

The amount that actually left the lender to acquire the tranche, and when.

Face £100m acquired for £98m means £2m of yield earned across the life of the
loan. Without this field PCS assumes par, the discount never accretes, and the
reported yield is understated for the whole term. This is the single most
important field in this document.

Where a tranche is drawn in stages rather than purchased, state the
consideration for the initial advance; subsequent drawdowns are already covered
by the `Movements` sheet.

### 2. Fee amounts — `Components` sheet

Already present in v0.4 as flat amounts. Nothing new to produce. Listed here
only because these amounts are an EIR input, not merely a cashflow to post.

### 3. Fee classification — `Components` sheet

| Column | Type | Values | Required |
|---|---|---|---|
| `Yield Integral` | enum | `Yes` / `No` | Yes, for every fee row |

Whether the fee is compensation for originating the loan, or payment for
providing a service.

- **`Yes`** — an arrangement or origination fee. It is an integral part of the
  lender's return and is folded into the effective interest rate, then released
  across the life of the loan.
- **`No`** — an agency, administration or similar fee. It is revenue for a
  service and is recognised when that service is performed.

The same cash produces a different reported yield and a different income profile
depending on this answer. PCS could infer it from the fee's name. It will not:
guessing which fees change the reported yield is not a defensible basis for an
accounting figure, and a wrong guess is invisible in the output.

### 4. Direct transaction costs — `Tranches` sheet

| Column | Type | Example | Required |
|---|---|---|---|
| `Transaction Costs` | amount | `350,000` | Yes (`0` is a valid answer) |

Incremental costs paid to acquire or originate the loan that would not have been
incurred otherwise — external legal fees, due diligence, arranger costs.

These reduce the initial carrying amount and therefore raise the effective yield.
They are currently absent from the feed entirely. A stated `0` is a complete
answer; a blank cell is not, and will be recorded as unstated.

### 5. Expected redemption — `Tranches` sheet

| Column | Type | Example | Required |
|---|---|---|---|
| `Expected Redemption Date` | date | `2031-06-30` | Optional — see below |

The date PortF's own model expects the tranche to be repaid, if it differs from
contractual maturity.

An EIR is spread over the **expected** life, not the contractual life, where
early repayment is expected. On the Suffolk file the contractual maturity is
2063; if PortF's model assumes redemption in the early 2030s, the two produce
materially different yields.

**Blank is an acceptable answer** and means "no expectation modelled — use
contractual maturity". PCS records that this was stated rather than assumed.

---

## Additions to `Lookup values`

| Field | Permitted values |
|---|---|
| `Yield Integral` | `Yes`, `No` |

No other vocabulary changes.

---

## What is *not* being asked for

To keep the scope unambiguous:

- Not asking PortF to calculate an EIR. PCS does that.
- Not asking for a revised amortisation schedule, carrying value, or any
  derived figure. PCS derives those.
- Not asking for anything retrospective. These fields are needed on new files;
  a backfill of existing deals is a separate conversation.

---

## One further question, for comparison only

Where a tranche is floating-rate, does PortF **revise** its effective interest
rate at each reset, or hold the rate set at initial recognition?

Both are defensible and the standard permits periodic re-estimation for floating
instruments. PCS does not need the answer to produce its own figure — it needs
it to know whether a difference against PortF's yield is a genuine discrepancy
or simply two defensible policies. A one-line answer in an email is sufficient;
no column required.

---

## What PCS does with each field

| Field | Effect on the accounting |
|---|---|
| `Consideration Paid` | Sets the initial carrying amount. Discount or premium accretes to par over the expected life. |
| `Consideration Date` | Anchors day one of the accretion. |
| Fee amounts + `Yield Integral = Yes` | Folded into the EIR; released across the life as the gap between effective yield and contractual coupon. |
| Fee amounts + `Yield Integral = No` | Recognised as fee revenue when the service is performed. |
| `Transaction Costs` | Deducted from the initial carrying amount; raises the effective yield. |
| `Expected Redemption Date` | Sets the period across which the EIR is spread. |

---

## Acceptance status per field

Consistent with v0.4's per-row status, every EIR input is recorded with its
provenance:

| Status | Meaning |
|---|---|
| `stated` | Supplied by PortF. Used in the calculation and reconcilable against their figures. |
| `assumed` | Not supplied. PCS has used a default — par consideration, zero costs, contractual maturity — and the resulting EIR is flagged on screen as not independently supported. |

A file that omits every field in this document still imports. Its EIR simply
equals the contractual coupon, and PCS says so rather than presenting the coupon
as a calculated yield.

---

## Open on the PCS side

These are ours, not PortF's, and are listed so the dependency runs both ways:

1. The EIR solver currently builds a synthetic cashflow vector — one coupon a
   year plus a balloon at maturity — instead of using the dated schedule PortF
   already sends. Fixing this is the largest single improvement available and
   requires nothing from PortF.
2. Fee amounts arriving in v0.4's flat-amount shape do not currently reach the
   EIR calculation, because the importer emits them as percentages.
3. Deferred fee income is released on a straight-line basis rather than by the
   effective interest method.
4. External deals are imported without an amortisation method set, so no EIR
   solve runs at all.

Items 1–4 are scheduled independently of this request. Delivering them without
the fields above still leaves EIR equal to the coupon, because at par with no
fees that is the correct answer. **The PCS work makes the figure trustworthy;
these fields make it meaningful.** Neither half is sufficient on its own.
