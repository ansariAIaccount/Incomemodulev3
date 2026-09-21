# Open questions for PortF

Two of these are one-line answers by email. The third is a data request, and
only applies if any tranche is credit-impaired. None of them need a meeting.

Every question here is something PCS consumes directly and cannot derive. Our
own accounting policy choices are not on this list — they are ours to make.

---

## 1. On a floating component, what does `Base Value` mean?

**Why we're asking.** On a fixed component it's unambiguous — it's the coupon.
On a floating component it could reasonably be either the **margin over the
benchmark**, or the **all-in rate** as at the date of the file.

PCS currently reads it as the all-in rate and adds no margin on top. If it is in
fact the margin, every floating rate we derive is understated by the level of the
benchmark — roughly 400 basis points at present.

**What we need:** "margin" or "all-in". One word.

---

## 2. How do you compound SONIA — daily, or from the published Compounded Index?

**Why we're asking.** The two give different answers, and combined with the
lookback / lockout / observation shift fields (already requested) this is the
last piece needed before we can reproduce a compounded rate at all.

**What we need:** "daily compounded" or "BoE Compounded Index".

---

## 3. For any tranche flagged `Credit Impaired at Acquisition = Yes`, what was
   the lifetime credit loss expected at the point of acquisition?

**Why we're asking.** A loan that was already credit-impaired when acquired
takes a credit-adjusted effective interest rate, with those expected losses
built into the yield from day one. It is a different calculation, not a
variation of the normal one, and applying the ordinary method to such an asset
overstates interest income for the whole of its life.

This only applies to tranches answering `Yes`, which we expect to be a small
number or none at all.

**What we need:** an amount per affected tranche, as at the acquisition date.
Format is open — we'll fit around whatever you already hold. If the answer is
"none of our tranches are credit-impaired at acquisition", that closes it.

---

## Also outstanding — from the v0.5 requirements document

Not questions, but still awaited, and listed here so everything sits in one
place:

| | Item | Sheet |
|---|---|---|
| A1 | Period Start **and** Period End on every cashflow row | Cashflows |
| A2 | One row per component — no combined fixed + floating lines | Cashflows |
| A3 | Lookback / lockout / observation shift on floating components | Components |
| A4 | Deal and tranche GUIDs | Loan info, Tranches |
| A5 | Rounding rule — per period or carried, half-up or bankers' | one line |
| A6 | Date format, stated once per sender (ISO preferred) | one line |
| A8 | Every movement, without exception | Movements |
| B1 | Consideration paid, and its date | Tranches |
| B3 | Yield Integral — Yes/No on every fee row | Components |
| B4 | Transaction costs (a stated `0` is a complete answer) | Tranches |
| B5 | Credit Impaired at Acquisition — Yes/No | Tranches |

Expected Redemption Date (B4 in the requirements doc) may be left blank; blank
means "use contractual maturity" and is a complete answer.
