# PortF → PCS Loan Module — feed contract

**Draft v0.1 · 12 Sep 2026 · for review**

Derived from `Loan info portF.xlsx` (sheets *Loan info* and *Tranch info*).

---

## 1 · Shape of the integration

| Decision | Value |
|---|---|
| Direction | PCS **pulls**. PortF exposes a read API; PCS polls. |
| Payload | **Full snapshot** per deal. Every fetch returns the complete current state. |
| Schedule | **Full forward schedule** to maturity, not just actuals to date. |
| GL granularity | **Tranche level.** Drawdown lots are carried for traceability but journals aggregate to the tranche. |
| Who owns what | PortF owns deal setup, events and cashflow *calculation*. PCS owns EIR, impairment, journals and GL posting. |

PCS never writes back. Deals arriving this way are stamped `source = external` and are read-only in the module.

---

## 2 · Endpoints PCS needs

### `GET /deals?changedSince={iso8601}`

Returns the deals PortF holds, so PCS knows what to fetch. Small payload — no schedules.

```json
{
  "generatedAt": "2026-09-12T14:22:05Z",
  "deals": [
    { "externalDealId": "SUF-0001",
      "name": "Suffolk",
      "lastChangedAt": "2026-09-12T06:00:00Z",
      "snapshotId": "SUF-0001-20260912-0600" }
  ]
}
```

### `GET /deals/{externalDealId}`

The full snapshot. Structure in section 3.

**Idempotency.** `snapshotId` must change whenever anything in the payload changes, and must **not** change otherwise. PCS uses it to skip re-importing unchanged deals and to warn when an accounting run is older than the latest snapshot.

---

## 3 · Snapshot payload

```json
{
  "snapshotId": "SUF-0001-20260912-0600",
  "generatedAt": "2026-09-12T06:00:00Z",
  "externalDealId": "SUF-0001",

  "facility": {
    "company": "Suffolk",
    "debtType": null,
    "currency": "GBP",
    "loanStartDate": "2025-11-04",
    "loanEndDate": "2062-04-01",
    "dayCountConvention": "ACT/365",
    "interestAccrues": "sameDay",
    "commitmentSchedule": [
      { "effectiveDate": "2025-11-04", "totalCommitment": 733000000.00 },
      { "effectiveDate": "2025-11-04", "totalCommitment": 805000000.00 }
    ]
  },

  "components": [
    {
      "externalComponentId": "SUF-0001-CF",
      "scope": "facility",
      "name": "Commitment Fee",
      "postingType": "fee",
      "calculationBasis": "unfundedBalance",
      "rateStructure": "fixed",
      "rate": 0.0045,
      "accrualFrequency": "semiAnnual",
      "accrualAnchor": "anniversary",
      "settlementFrequency": "semiAnnual",
      "settlementType": "cash",
      "firstSettlementDate": "2026-04-01",
      "drawdownScope": "all"
    },
    {
      "externalComponentId": "SUF-0001-T1-FIX",
      "scope": "tranche",
      "externalTrancheId": "SUF-0001-T1",
      "name": "20 Year Fixed",
      "postingType": "interest",
      "calculationBasis": "principalBalance",
      "rateStructure": "fixed",
      "rate": 0.0702,
      "accrualFrequency": "semiAnnual",
      "accrualAnchor": "anniversary",
      "settlementFrequency": "semiAnnual",
      "settlementType": "cash",
      "firstSettlementDate": "2027-04-01",
      "drawdownScope": "all"
    },
    {
      "externalComponentId": "SUF-0001-T1-SON",
      "scope": "tranche",
      "externalTrancheId": "SUF-0001-T1",
      "name": "Monthly SONIA",
      "postingType": "interest",
      "calculationBasis": "principalBalance",
      "rateStructure": "floating",
      "index": "SONIA",
      "rate": null,
      "accrualFrequency": "monthly",
      "accrualAnchor": "anniversary",
      "settlementFrequency": "monthly",
      "settlementType": "cash",
      "firstSettlementDate": "2026-08-01",
      "drawdownScope": "all"
    }
  ],

  "tranches": [
    {
      "externalTrancheId": "SUF-0001-T1",
      "name": "Tranche A",
      "currency": "GBP",
      "commitment": 589000000.00,
      "startDate": "2026-01-04"
    }
  ],

  "events": [
    { "externalEventId": "SUF-0001-E1", "externalTrancheId": "SUF-0001-T1",
      "eventType": "initialPurchase", "eventDate": "2026-07-31", "amount": 23000000.00 },
    { "externalEventId": "SUF-0001-E2", "externalTrancheId": "SUF-0001-T1",
      "eventType": "drawdown", "eventDate": "2026-08-31", "amount": 256000000.00,
      "drawdownLotId": "SUF-0001-T1-L2" }
  ],

  "cashflows": [
    {
      "date": "2026-09-01",
      "externalTrancheId": "SUF-0001-T1",
      "externalComponentId": "SUF-0001-T1-SON",
      "drawdownLotId": "SUF-0001-T1-L1",
      "daysCovered": 1,
      "basisBalance": 23000000.00,
      "rate": 0.0571,
      "amount": 3598.02,
      "cashSettled": 0.00
    }
  ]
}
```

---

## 4 · Conventions

**Long format, one row per (date × tranche × component × drawdown lot).** The spreadsheet lays components out side by side — `Rate | Amount | Total Cash Interest | Rate | Amount | Total Cash Fee`. That works for two components and breaks at five: there is no column position for the third interest leg, and a consumer cannot tell which Rate belongs to which component. One row per combination removes the ambiguity and makes the payload the same shape regardless of how many components a tranche carries.

**Rates as decimals.** `0.0571`, never `5.71`. Matches how PCS stores every other rate; mixing the two conventions is a silent 100× error.

**Dates as ISO 8601**, `YYYY-MM-DD`. Timestamps in UTC with a `Z`.

**Amounts as numbers, 2 decimal places**, in the stated currency. Currency is explicit at facility and tranche level — never inferred from a symbol.

**`daysCovered`** is required. The sample rolls weekends into the Friday row — 2026-08-07 carries £10,797, about three days of accrual. Without this field PCS cannot tell a 3-day row from a 1-day row, and daily reconciliation becomes guesswork.

**Stable ids across snapshots.** `externalDealId`, `externalTrancheId`, `externalComponentId`, `drawdownLotId` and `externalEventId` must identify the same thing in every snapshot. If ids are regenerated each run, PCS cannot tell a changed row from a new one and the reconciliation view is worthless.

---

## 5 · Enumerations

| Field | Values |
|---|---|
| `postingType` | `interest`, `fee`, `principal` |
| `calculationBasis` | `principalBalance`, `unfundedBalance`, `commitment`, `faceValue` |
| `rateStructure` | `fixed`, `floating` |
| `accrualFrequency` | `daily`, `weekly`, `monthly`, `quarterly`, `semiAnnual`, `annual`, `atMaturity` |
| `accrualAnchor` | `anniversary`, `calendar` |
| `settlementFrequency` | as `accrualFrequency`, plus `oneOff` |
| `settlementType` | `cash`, `capitalised`, `pik` |
| `drawdownScope` | `all`, or an array of `drawdownLotId` |
| `eventType` | `initialPurchase`, `drawdown`, `principalPayment`, `interestPayment`, `feePayment`, `rateReset`, `amendment`, `prepayment`, `writeOff`, `recovery` |
| `dayCountConvention` | `ACT/360`, `ACT/365`, `ACT/ACT`, `30/360`, `30E/360` |
| `interestAccrues` | `sameDay`, `nextDay` |

Any value outside these lists is rejected at import with the offending row identified, rather than being coerced to a default. A silently defaulted day count is a wrong number that looks right.

---

## 6 · Validation PCS will apply on import

Rejected outright:

- Unknown enum value in any field above
- `cashflows` row referencing a `externalTrancheId` or `externalComponentId` not present in the snapshot
- Missing `daysCovered`, `rate` or `amount` on a cashflow row
- `snapshotId` already imported with different content

Accepted with a warning surfaced in the UI:

- Cashflow rows beyond `loanEndDate`
- A component with no cashflow rows
- Commitment schedule that does not reconcile to the opening unfunded balance — **see the open question below**

---

## 7 · Open questions for PortF

**1 · Commitment versus unfunded balance.** On the *Loan info* sheet the commitment rows total roughly £4.4bn, while the cashflow table's opening Unfunded Balance is £32,277,978,800. Those do not reconcile. Is the sample illustrative, or is the unfunded balance drawn from a wider population than the commitment schedule? PCS needs to know which is authoritative before validation is written around it.

**2 · Tranche name.** On the *Tranch info* sheet the `Tranche Name` cell contains a date (`2026-01-04`) rather than a name. Assumed to be a sample artefact — please confirm the field carries a human-readable name.

**3 · Day Count Convention and Debt Type are blank** in both sheets. Are they always populated in production? Day count in particular cannot be defaulted safely.

**4 · Multi-component rate columns.** In the sample only one rate series appears populated even though the tranche defines two interest components. Confirm that production emits a distinct rate and amount per component.

**5 · Poll frequency and volume.** How often does PortF expect PCS to poll, and how many deals and cashflow rows should we size for? A 36-year daily schedule across several tranches and components runs to hundreds of thousands of rows per deal.

**6 · Restatements.** If PortF restates a prior period, does the snapshot simply contain the corrected figures, or is there an explicit restatement marker? This matters for the accounting: a restated prior period may need a reversal rather than a fresh posting.

---

## 8 · What PCS does with it

Read-only in the module — Deal Setup, Tranches, Fees, Covenants and Lifecycle Events all display the received data and cannot be edited. The Cashflow tab shows the received schedule rather than a computed one.

PCS then performs, on top of the feed:

- Effective interest rate, including fee and cost amortisation over expected life
- Impairment — IFRS 9 three-stage ECL, CECL or incurred loss per the deal's framework
- Journal generation under the chosen framework
- Legal-entity ownership split
- Posting to Investran via DIU

A banner states the source and the snapshot timestamp on every affected screen, and the Accounting tab warns when the last run predates the latest snapshot.
