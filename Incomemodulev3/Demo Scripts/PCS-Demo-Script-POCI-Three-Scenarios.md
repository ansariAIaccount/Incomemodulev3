# POCI — Three Recovery Scenarios

### Demo script · PCS Loan Module V4 · IFRS 9 §5.5.13–14, §B5.4.7

*Figures regenerated 20 October 2026 against the engine, after the
credit-adjusted EIR solve was corrected. Every number below is engine output,
not an independent calculation. See “What changed on 20 October” at the end.*

---

## Before you start — read this

**One thing is still broken, and it is the last journal.** The engine's
maturity leg repays **face value** unconditionally. On Scenario 1 that is
right. On Scenarios 2 and 3 it is not — the app will post 100,000,000 when
only 78,000,000 or 60,000,000 is actually received, overstating the gain.

This is open issue **#71**. Run the demo through the **Cashflow** and
**Carrying value** views, where every figure below is now correct, and stop
short of the maturity journal unless you want to discuss the issue openly. If
a client asks, the honest answer is: *"the amortised-cost mechanics are right;
the final principal leg currently assumes full recovery and we're fixing it."*

**What is no longer broken:** until 20 October the credit-adjusted EIR was
solved on an annual cash-flow approximation that ignored coupon frequency, and
the carrying amount overshot the expected recovery by up to 3%. Both are fixed.
If you have an older copy of this script, discard it — its figures will not
match the screen.

---

## The set-up — identical in every respect but one

All three deals are the same purchase:

| | |
|---|---|
| Face value | **100,000,000 USD** |
| Consideration paid | **60,000,000 USD** on 1 Jan 2026 |
| Coupon | **8.00% fixed**, quarterly, cash, ACT/360, on **face** |
| Maturity | 31 Dec 2031 · bullet · 2,191 days |
| Classification | Amortised cost · credit-impaired at acquisition · **POCI** |

**One input differs: the recovery expected at acquisition.** That single number
sets the credit-adjusted EIR, and everything else follows from it. Keeping all
other terms identical is deliberate — anything a client sees differing between
the three screens is caused by the expected recovery and nothing else.

| Deal code | Expected recovery | Lifetime ECL at acquisition | Credit-adjusted EIR |
|---|---:|---:|---:|
| `DEMO-POCI` | 75,000,000 | 25,000,000 | **15.7803%** |
| `DEMO-POCI-MID` | 78,000,000 | 22,000,000 | **16.2241%** |
| `DEMO-POCI-PAR` | 60,000,000 | 40,000,000 | **13.3333%** |

**The coupon is 8.00% in all three. No EIR is anywhere near it.** That is the
first thing to say out loud, and it is the whole of POCI in one line: the
coupon tells you what the borrower pays; the EIR tells you what the investment
earns. They are different numbers answering different questions.

### The rate convention, before anyone asks

These are **nominal ACT/360 simple** rates — the basis the schedule accrues on,
so they are the rates that actually drive the carrying amount. A client who
takes the cash flows and runs an annual-effective IRR will get a higher number.
Both are right; they are different conventions. Have the equivalents ready:

| Deal | Nominal ACT/360 (shown) | Annual effective |
|---|---:|---:|
| `DEMO-POCI` | 15.7803% | 17.3464% |
| `DEMO-POCI-MID` | 16.2241% | 17.8754% |
| `DEMO-POCI-PAR` | 13.3333% | 14.4720% |

---

## Why the EIR is so far above the coupon

You pay 60m for a claim on 100m. The coupon is 8% **on the face**, so every
quarter you collect roughly 2.0m of cash on a 60m investment — about 13% a year
before any principal recovery at all. Add whatever principal comes back above
the 60m you paid and the return rises further. The credit-adjusted EIR is the
single rate that discounts the **expected** cash flows — contractual flows less
expected credit losses — back to the price paid (§B5.4.7).

Two consequences worth stating:

1. **No day-one allowance.** The losses are already in the price. A POCI asset
   opens at 60,000,000 with a nil allowance, where a Stage 1 asset bought at par
   would open with an allowance against it (§5.5.13).
2. **No stages.** POCI assets never enter the 1/2/3 staging model. If the screen
   shows "Stage 1" on these deals it is a display default, not a measurement —
   that is open issue **#72**.

---

## Scenario 3 first — `DEMO-POCI-PAR`

**Run this one first.** It is counter-intuitive and it makes the other two obvious.

*Expected recovery 60,000,000 — exactly what you paid.*

**Q1 2026:**

| | |
|---|---:|
| EIR income at 13.3333% | 2,000,000.00 |
| Cash coupon received | 2,000,000.00 |
| **Accretion** | **0.00** |
| Carrying value | 60,000,000.00 |

**Carrying value at each year end: 60,000,000.00 — the same figure, six times.**
Not approximately. Exactly.

**Say this:** *"There is no accretion here, and that is correct. Accretion is
the pull of the carrying amount towards what you expect to collect. If you
expect to collect exactly what you paid, there is nothing to pull towards. The
entire return on this deal is the coupon — 108.7m collected over six years on a
60m outlay, 1.81×."*

Then the point that lands: **the EIR is still 13.33%, not 8%.** And this one you
can check in your head on the spot:

> **13.3333% = 8.00% × 100,000,000 / 60,000,000**

The coupon is 8% of face; you only paid 60% of face; so the yield on what you
actually invested is the coupon grossed up by 100/60. The engine solves it
numerically and lands on exactly that. A client who books interest income at the
coupon rate on the carrying amount would recognise roughly 4.8m a year instead
of 8.1m.

**This deal is the single best integrity check in the pack.** Flat carrying, nil
accretion, and an EIR you can verify by mental arithmetic. If any of the three
is off, something is wrong upstream.

---

## Scenario 2 — `DEMO-POCI-MID`

*Expected recovery 78,000,000 — between the 60m paid and the 100m face.*

**Q1 2026:**

| | |
|---|---:|
| EIR income at 16.2241% | 2,442,432.33 |
| Cash coupon received | 2,000,000.00 |
| **Accretion** | **442,432.33** |
| Carrying value | 60,442,432.33 |

**Carrying value path, at each year end:**

| | | |
|---|---:|---:|
| 2026 | 61,911,008.89 | accreted to date 1,911,008.89 |
| 2027 | 64,163,617.56 | 4,163,617.56 |
| 2028 | 66,826,779.27 | 6,826,779.27 |
| 2029 | 69,958,099.74 | 9,958,099.74 |
| 2030 | 73,649,155.10 | 13,649,155.10 |
| **2031** | **78,000,000.00** | **18,000,000.00** |

**Say this:** *"Now there is something to pull towards. You paid 60m and expect
78m, so 18m of the return is principal recovery rather than coupon — and IFRS 9
makes you recognise it over the life, as interest income, not as a windfall at
the end. The carrying amount climbs from 60m to exactly 78m on the maturity
date. It cannot overshoot: the EIR was solved to land it there."*

**That last sentence is now literally true and worth proving.** Open the
**Unaccreted** and **Accreted to date** columns on the Cashflow tab side by
side.

While you are there, turn on the **EIR interest** column (V4.73). It shows the
figures quoted above directly — 2,442,432.33 for Q1, 10,022,120.00 for year 1 —
beside **Interest accrued**, which is the 8% coupon. The gap between the two
columns is the Accretion column, and that is the whole of POCI in one screen:
what the borrower pays, what the investment earns, and the difference accruing
as income. At any period, *discount still to take + discount already taken = the
day-one discount of 18,000,000*:

| | accreted to date | unaccreted | sum |
|---|---:|---:|---:|
| end 2026 | 1,911,008.89 | 16,088,991.11 | 18,000,000.00 |
| end 2029 | 9,958,099.74 | 8,041,900.26 | 18,000,000.00 |
| end 2031 | 18,000,000.00 | 0.00 | 18,000,000.00 |

**Year 1 totals:** EIR income 10,022,120.00 · cash coupon 8,111,111.11 ·
accretion 1,911,008.89.

---

## Scenario 1 — `DEMO-POCI`

*Expected recovery 75,000,000 at acquisition. The estimate is then revised
upward in 2028, and the borrower ultimately pays the full 100,000,000.*

This one is about what happens when reality beats the assumption — and it has
**two** favourable events, not one. The earlier version of this script only
described the second.

| | |
|---|---:|
| Credit-adjusted EIR | 15.7803% |
| Gross carrying value at maturity | 75,000,000.00 |

**Year 1:** EIR income 9,725,015.22 · cash coupon 8,111,111.11 · accretion
1,613,904.11.

**Gross carrying path:** 61,613,904.11 → 63,507,762.30 → 65,736,726.58 →
68,345,745.59 → 71,407,335.18 → **75,000,000.00**

### The 2028 revision — this is the part to demo

The deal carries a stored revision dated **1 January 2028**: lifetime expected
loss cut from 25,000,000 to 15,000,000. Watch the three columns across that
date:

| | gross carrying | ECL allowance | **net carrying** |
|---|---:|---:|---:|
| 31 Dec 2027 | 63,507,762.30 | 0.00 | 63,507,762.30 |
| **1 Jan 2028** | 63,513,378.23 | **(10,000,000.00)** | **73,513,378.23** |
| 31 Dec 2031 | 75,000,000.00 | (10,000,000.00) | 85,000,000.00 |

**Say this:** *"The allowance has gone negative, and net carrying is now higher
than gross. On any other asset that is impossible. Under §5.5.14 a favourable
change in expected cash flows on a POCI asset is recognised as an impairment
**gain** — and critically, it is recognised even though it takes the loss
allowance below nil, because the comparison is against the expected flows at
acquisition, not against zero."*

Two things to point at while that is on screen:

1. **The EIR did not move.** It is 15.7803% before the revision and 15.7803%
   after. The gross carrying path is identical either side. **The EIR is never
   revised for a POCI asset** — that is what "credit-adjusted" buys you
   (§B5.4.7). The revision lands entirely in the allowance.
2. **The gain is 10,000,000 in 2028**, not at maturity. If the borrower then
   pays the full 100,000,000 against a net carrying amount of 85,000,000, the
   remaining gain at maturity is **15,000,000** — not 25,000,000. The total
   favourable swing is 25,000,000; it arrives in two pieces, and the demo shows
   both.

**This is also the one scenario where the engine's maturity leg is right** — it
posts face, and face is what was received.

---

## The three side by side

| | Scenario 3 PAR | Scenario 2 MID | Scenario 1 POCI |
|---|---:|---:|---:|
| Paid | 60,000,000 | 60,000,000 | 60,000,000 |
| Expected at acquisition | 60,000,000 | 78,000,000 | 75,000,000 |
| Credit-adjusted EIR | 13.3333% | 16.2241% | 15.7803% |
| Coupon | 8.00% | 8.00% | 8.00% |
| Gross carrying, end 2026 | 60,000,000.00 | 61,911,008.89 | 61,613,904.11 |
| Gross carrying at maturity | 60,000,000.00 | 78,000,000.00 | 75,000,000.00 |
| Accretion over life | 0.00 | 18,000,000.00 | 15,000,000.00 |
| Total coupon over life | 48,688,888.89 | 48,688,888.89 | 48,688,888.89 |
| ECL allowance at maturity | — | — | (10,000,000.00) |
| **On expected recovery** | | | |
| Total collected | 108,688,888.89 | 126,688,888.89 | 123,688,888.89 |
| Multiple on cost | 1.81× | 2.11× | 2.06× |
| **If the borrower pays face** | | | |
| Total collected | — | — | 148,688,888.89 |
| Multiple on cost | — | — | 2.48× |

Note Scenario 1's EIR (15.78%) is **lower** than Scenario 2's (16.22%) despite
collecting far more cash. That is not a mistake and it is a good question to
invite: the EIR is set at acquisition from what you *expected*, and Scenario 1
expected 75m against Scenario 2's 78m. The extra arrives as a gain, not as
yield.

---

## Questions you will be asked

**"Why is interest income higher than the cash we received?"**
Because the discount is income. You bought at 60m something you expect to
collect more on; the difference accrues as interest over the life rather than
appearing as a gain at the end. Scenario 2 is the clearest: 10.0m of income in
2026 against 8.1m of cash.

**"Your EIR doesn't match my IRR."**
Check the convention before checking the arithmetic. The screen shows a nominal
ACT/360 simple rate because that is what the schedule accrues on. The annual
effective equivalents are in the table at the top — 17.88% for Scenario 2
against the 16.22% on screen.

**"What if the expected recovery changes mid-life?"**
Re-discount the revised expected flows at the **original** credit-adjusted EIR.
The change in carrying amount is an impairment gain or loss immediately. The EIR
itself never moves. Scenario 1 does exactly this on 1 Jan 2028.

**"Can the allowance go negative?"**
On a POCI asset, yes — and Scenario 1 shows it: (10,000,000) from 2028, with net
carrying above gross. A favourable revision is recognised as a gain even if
cumulative favourable changes exceed the losses expected at acquisition
(§5.5.14). On any non-POCI asset, no.

**"Why is there no allowance on day one?"**
Because the expected losses are already in the 60m you paid. Recognising an
allowance as well would count them twice (§5.5.13).

**"Is this Stage 3?"**
No. POCI sits outside the staging model entirely. If the screen shows a stage,
that is a display default — issue #72.

**"What happens to a POCI asset that cures completely?"**
It stays POCI for life. The classification is fixed at acquisition and never
changes, however the credit improves (§5.5.13).

---

## Checklist before you present

- [ ] All three deals load and show a **credit-adjusted EIR, not the coupon**
- [ ] `DEMO-POCI-PAR` shows **13.3333%** — check it: 8% × 100/60
- [ ] `DEMO-POCI-PAR` carrying is **60,000,000.00 flat**, nil accretion
- [ ] `DEMO-POCI-MID` carrying lands on **78,000,000.00 exactly** at maturity
- [ ] On MID, accreted-to-date + unaccreted = **18,000,000** at every period
- [ ] Day-one allowance is **nil** on all three
- [ ] Gross carrying amount opens at **60,000,000**, not 100,000,000
- [ ] On `DEMO-POCI`, the allowance goes to **(10,000,000)** on 1 Jan 2028 and
      the EIR does **not** move
- [ ] **Do not run to the maturity journal on MID or PAR** — issue #71
- [ ] Have the issue numbers to hand: #71 maturity leg, #72 stage label

---

## What changed on 20 October 2026

The previous version of this script carried figures computed independently of
the engine. They were the correct IFRS 9 answer; the engine did not reproduce
them. Checking the two against each other found a real defect, now fixed.

**The defect.** The POCI branch of the yield solve built its expected cash-flow
vector as one payment a year and never read the coupon frequency, so a
quarterly payer was solved as if it paid annually in arrears. It also discounted
at an annual effective rate while the schedule accrues daily and simple on
ACT/360 — two different conventions. The result was an EIR understated by about
100bp and, more seriously, a carrying amount that **did not converge on the
expected recovery**: `DEMO-POCI-MID` finished at 80,379,504.83 against a target
of 78,000,000, an overshoot of 3.05%.

**The fix.** The annual vector is now only a seed. It is refined against the
real daily walk until the carrying amount lands on the expected recovery, which
is the same treatment the ordinary `effectiveInterestPrice` path already had.
All three deals now converge to **0.00** drift. Both engine harnesses (25 + 25
cases) pass unchanged.

**Two documentation errors fixed at the same time**, independent of the engine:

- Scenario 1's 2028 ECL revision was in the deal data but not in the script. The
  gain is 10,000,000 in 2028 plus 15,000,000 at maturity, not 25,000,000 at
  maturity.
- The old side-by-side table mixed expected and actual recovery in one column
  for Scenario 1. They are now separate blocks.

Issues **#71** and **#72** are unchanged and still open.
