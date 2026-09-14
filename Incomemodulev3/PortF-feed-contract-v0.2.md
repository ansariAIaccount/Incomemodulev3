# PortF → PCS Loan Module — feed contract

**Draft v0.2 · 13 Sep 2026**

Supersedes v0.1. Incorporates PortF's answers to the six open questions.
Derived from `Loan info portF.xlsx` (sheets *Loan info* and *Tranch info*).

### What changed since v0.1

| # | Change | Driver |
|---|---|---|
| 1 | `committedAmount` and `maximumFacilityAmount` separated; components carry `basisReference` | Unfunded balance is measured against the £32.27bn maximum, not the £4.4bn committed today |
| 2 | `consolidation` added to `eventType`, with rate and structure | 6-month floating facility converts to a 20-year loan on negotiated terms |
| 3 | `calculationMethod` separated from `dayCountConvention` | Some fees are level-payment, which is not a day count |
| 4 | Stable ids promoted from convention to **mandatory** | No restatement marker — PCS must diff snapshots, which requires stable row identity |
| 5 | Storage model: hash-and-skip, single current snapshot + change log | ~260,000 rows per snapshot on a 40-year daily deal |

---

## 1 · Shape of the integration

| Decision | Value |
|---|---|
| Direction | PCS **pulls**. PortF exposes a read API; PCS polls. |
| Payload | **Full snapshot** per deal. Every fetch returns the complete current state. |
| Schedule | **Full forward schedule** to maturity, not just actuals to date. |
| GL granularity | **Tranche level.** Drawdown lots are carried for traceability but journals aggregate to the tranche. |
| Restatements | No marker. Corrected figures arrive silently; **PCS diffs against the prior snapshot.** |
| Volume | ~2 new deals/month. Worst case ~260,000 cashflow rows per snapshot (40y daily × 3 components × 6 drawdown lots). |
| Who owns what | PortF owns deal setup, events and cashflow *calculation*. PCS owns EIR, impairment, journals and GL posting. |

PCS never writes back. Deals arriving this way are stamped `source = external` and are read-only in the module.

---

## 2 · Endpoints PCS needs

### `GET /deals?changedSince={iso8601}`

```json
{
  "generatedAt": "2026-09-13T06:00:00Z",
  "deals": [
    { "externalDealId": "SUF-0001",
      "name": "Suffolk",
      "lastChangedAt": "2026-09-12T06:00:00Z",
      "snapshotId": "SUF-0001-20260912-0600",
      "contentHash": "sha256:9f2c…" }
  ]
}
```

`contentHash` lets PCS skip the fetch entirely when nothing has changed. Given deals change rarely and snapshots are large, most polls should be no-ops.

### `GET /deals/{externalDealId}`

The full snapshot — section 3.

**Idempotency.** `snapshotId` and `contentHash` must change when anything in the payload changes, and must **not** change otherwise.

---

## 3 · Snapshot payload

```json
{
  "snapshotId": "SUF-0001-20260912-0600",
  "contentHash": "sha256:9f2c…",
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

    "committedAmount": 4400000000.00,
    "maximumFacilityAmount": 32277978800.00,

    "commitmentSchedule": [
      { "effectiveDate": "2025-11-04", "amount": 733000000.00, "reference": "committed" },
      { "effectiveDate": "2025-11-04", "amount": 805000000.00, "reference": "committed" }
    ]
  },

  "components": [
    {
      "externalComponentId": "SUF-0001-CF",
      "scope": "facility",
      "name": "Commitment Fee",
      "postingType": "fee",
      "calculationMethod": "dayCount",
      "calculationBasis": "unfundedBalance",
      "basisReference": "maximum",
      "rateStructure": "fixed",
      "rate": 0.0045,
      "accrualFrequency": "semiAnnual",
      "accrualAnchor": "anniversary",
      "settlementFrequency": "semiAnnual",
      "settlementType": "cash",
      "firstSettlementDate": "2026-04-01",
      "drawdownScope": "all",
      "effectiveFrom": "2025-11-04",
      "effectiveTo": null
    },
    {
      "externalComponentId": "SUF-0001-T1-SON",
      "scope": "tranche",
      "externalTrancheId": "SUF-0001-T1",
      "name": "Monthly SONIA",
      "postingType": "interest",
      "calculationMethod": "dayCount",
      "calculationBasis": "principalBalance",
      "basisReference": "drawn",
      "rateStructure": "floating",
      "index": "SONIA",
      "compounding": "dailyInArrears",
      "rate": null,
      "accrualFrequency": "monthly",
      "accrualAnchor": "anniversary",
      "settlementFrequency": "monthly",
      "settlementType": "cash",
      "firstSettlementDate": "2026-08-01",
      "drawdownScope": "all",
      "effectiveFrom": "2026-01-04",
      "effectiveTo": "2026-07-04"
    },
    {
      "externalComponentId": "SUF-0001-T1-FIX",
      "scope": "tranche",
      "externalTrancheId": "SUF-0001-T1",
      "name": "20 Year Fixed",
      "postingType": "interest",
      "calculationMethod": "dayCount",
      "calculationBasis": "principalBalance",
      "basisReference": "drawn",
      "rateStructure": "fixed",
      "rate": 0.0702,
      "accrualFrequency": "semiAnnual",
      "accrualAnchor": "anniversary",
      "settlementFrequency": "semiAnnual",
      "settlementType": "cash",
      "firstSettlementDate": "2027-04-01",
      "drawdownScope": "all",
      "effectiveFrom": "2026-07-04",
      "effectiveTo": null
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
      "eventType": "initialPurchase", "eventDate": "2026-07-31",
      "amount": 23000000.00, "drawdownLotId": "SUF-0001-T1-L1" },

    { "externalEventId": "SUF-0001-E2", "externalTrancheId": "SUF-0001-T1",
      "eventType": "drawdown", "eventDate": "2026-08-31",
      "amount": 256000000.00, "drawdownLotId": "SUF-0001-T1-L2" },

    { "externalEventId": "SUF-0001-E9", "externalTrancheId": "SUF-0001-T1",
      "eventType": "consolidation", "eventDate": "2026-07-04",
      "consolidatedLotIds": ["SUF-0001-T1-L1","SUF-0001-T1-L2"],
      "newComponentId": "SUF-0001-T1-FIX",
      "newRateStructure": "fixed",
      "newRate": 0.0702,
      "newTermYears": 20,
      "amount": 279000000.00 }
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

## 4 · The two commitment levels

The facility carries two distinct amounts and they are **not** interchangeable:

- **`committedAmount`** — what the lender is contractually obliged to advance today. £4.4bn in the sample.
- **`maximumFacilityAmount`** — the ceiling the facility can grow to if the project needs further funding. £32.27bn in the sample.

Every component measuring against an unfunded balance must state which one via **`basisReference`**: `maximum`, `committed`, or `drawn`.

In the sample the commitment fee ticks on the **maximum**. Sense-check: 0.45% × £32.27bn × ½ ≈ £72m against the £58m first-period figure, consistent for a partial period. On the committed amount it would be under £10m.

> **PCS-side accounting note.** The same "unfunded" figure serves two purposes with two different correct answers. The commitment fee accrues on the maximum, but exposure at default for ECL should use only what the lender is obliged to advance — the accordion above `committedAmount` normally requires fresh credit approval and is therefore not an exposure. PCS holds both figures and applies the credit conversion factor to `committedAmount` only.

---

## 5 · Consolidation events

The sample structure runs daily SONIA for six months with monthly drawdowns, then consolidates into a single 20-year loan whose rate is **negotiated at the consolidation date** and may be fixed or floating.

This must arrive as an explicit `consolidation` event. PCS will not infer it from balances or components silently changing, because the accounting consequences are too significant to derive by guesswork:

- Two EIR regimes. The 20-year rate does not exist at inception, so no meaningful whole-life EIR can be struck then. The floating phase is re-estimated as rates reset (IFRS 9 B5.4.5, prospective, no catch-up); a second EIR is struck at consolidation.
- **Possible derecognition.** If consolidation were an embedded contractual term operating on a formula, it would simply be the contract performing. But the rate is *negotiated*, and the parties may choose fixed or floating — that is a renegotiation, which points to modification accounting, the 10% present-value test, and quite possibly derecognition with a fresh instrument. A 6-month floating facility becoming a 20-year loan is unlikely to fail the substantiality test.
- If the parties choose **floating**, periodic re-estimation continues for 20 years rather than a single fixed EIR.

Required fields on the event: `eventDate`, `consolidatedLotIds`, `newComponentId`, `newRateStructure`, `newRate`, `newTermYears`, `amount`.

Components carry `effectiveFrom` / `effectiveTo` so the pre- and post-consolidation legs can coexist in one snapshot without ambiguity about which applies on a given date.

---

## 6 · Conventions

**Long format, one row per (date × tranche × component × drawdown lot).** The spreadsheet lays components side by side — `Rate | Amount | Total Cash Interest | Rate | Amount | Total Cash Fee`. That works for two components and breaks at five: there is no column position for a third interest leg, and a consumer cannot tell which Rate belongs to which component.

**Rates as decimals.** `0.0571`, never `5.71`.

**Dates as ISO 8601**, `YYYY-MM-DD`. Timestamps UTC with a `Z`.

**Amounts as numbers, 2 decimal places**, in the stated currency. Currency explicit at facility and tranche level — never inferred from a symbol.

**`daysCovered` is required.** The sample rolls weekends into the Friday row — 2026-08-07 carries £10,797, about three days of accrual. Without it PCS cannot distinguish a 3-day row from a 1-day row.

**Stable ids — MANDATORY, not a convention.** `externalDealId`, `externalTrancheId`, `externalComponentId`, `drawdownLotId` and `externalEventId` must identify the same thing in every snapshot, and must survive a user renaming the object.

This is load-bearing now. Because restatements carry no marker, PCS detects them by diffing each snapshot against the last on a content hash keyed to those ids. If any id is regenerated per run, every snapshot appears to be a wholesale replacement, the diff is worthless, and PCS cannot tell a corrected prior period from a new one.

**Tranche names are free text and display-only.** Users may name them anything. PCS keys on `externalTrancheId` throughout.

---

## 7 · Enumerations

| Field | Values |
|---|---|
| `postingType` | `interest`, `fee`, `principal` |
| `calculationMethod` | `dayCount`, `levelPayment` |
| `calculationBasis` | `principalBalance`, `unfundedBalance`, `commitment`, `faceValue` |
| `basisReference` | `drawn`, `committed`, `maximum` |
| `rateStructure` | `fixed`, `floating` |
| `compounding` | `simple`, `dailyInArrears`, `compoundedInArrears` |
| `accrualFrequency` | `daily`, `weekly`, `monthly`, `quarterly`, `semiAnnual`, `annual`, `atMaturity` |
| `accrualAnchor` | `anniversary`, `calendar` |
| `settlementFrequency` | as `accrualFrequency`, plus `oneOff` |
| `settlementType` | `cash`, `capitalised`, `pik` |
| `drawdownScope` | `all`, or an array of `drawdownLotId` |
| `eventType` | `initialPurchase`, `drawdown`, `principalPayment`, `interestPayment`, `feePayment`, `rateReset`, **`consolidation`**, `amendment`, `prepayment`, `writeOff`, `recovery` |
| `dayCountConvention` | `ACT/360`, `ACT/365`, `ACT/ACT`, `30/360`, `30E/360` |
| `interestAccrues` | `sameDay`, `nextDay` |

`calculationMethod` is deliberately separate from `dayCountConvention`. Level payment is an annuity calculation, not a day count — forcing it into the day-count field would produce plausible-looking but wrong fee accruals.

Any value outside these lists is rejected at import with the offending row identified, never coerced to a default. A silently defaulted day count is a wrong number that looks right.

---

## 8 · Storage and diffing on the PCS side

Documented here so PortF understands why the id and hash requirements are firm.

A 40-year daily deal with three components and six drawdown lots is roughly **14,600 × 3 × 6 ≈ 260,000 rows per snapshot**. Retaining every poll would be ~95 million rows per deal per year.

PCS therefore:

1. Compares `contentHash` on the index call and **skips unchanged deals entirely** — most polls will be no-ops.
2. Stores **one current snapshot** per deal in full.
3. Stores a **row-level change log** — added, removed, amount-changed — rather than full historical snapshots.
4. Flags any change to a period already posted to the GL, for review before re-running accounting.

---

## 9 · Validation on import

Rejected outright:

- Unknown enum value in any field in section 7
- A cashflow row referencing an `externalTrancheId` or `externalComponentId` not in the snapshot
- Missing `daysCovered`, `rate` or `amount` on a cashflow row
- A component with `calculationBasis: unfundedBalance` and no `basisReference`
- `snapshotId` already imported with different content
- Overlapping `effectiveFrom`/`effectiveTo` for two components on the same tranche with the same `postingType`

Accepted with a warning shown in the UI:

- Cashflow rows beyond `loanEndDate`
- A component with no cashflow rows
- `committedAmount` greater than `maximumFacilityAmount`
- A consolidation event whose `consolidatedLotIds` do not cover every open lot on that tranche

---

## 10 · Remaining questions for PortF

**1 · Do ids survive a rename?** Tranche names are user-defined. If renaming a tranche regenerates `externalTrancheId`, PCS loses the link to prior snapshots, to accounting runs already posted, and to the GL. Ids must be immutable for the life of the object.

**2 · Are covenants in scope?** Neither sheet carries any. Without them, an external deal cannot participate in covenant monitoring, breach detection or margin step-ups — the Watchlist would simply be empty for these deals. Three options: PortF adds them to the feed, PCS allows covenants to stay locally editable as an exception to read-only, or external deals are accepted as out of scope for covenant monitoring.

**3 · The flow diagram** referenced for the consolidation structure did not survive the export — both drawing parts in the workbook are empty. Please send it separately.

**4 · Level-payment fees.** Which structures use them, and what inputs does PCS receive — a payment amount and a schedule, or the parameters to derive them?

---

## 11 · Decisions for FIS (not PortF)

**A · Restatement posting.** When a restated period has already been posted to Investran, does PCS reverse and re-post, or post only the delta? Recommendation: reverse and re-post — it leaves a cleaner audit trail and avoids compounding an error if a period is restated twice.

**B · EAD basis for ECL.** Confirm the credit conversion factor applies to `committedAmount` only, and that the accordion headroom up to `maximumFacilityAmount` is excluded from exposure.

**C · Consolidation treatment.** Is consolidation to be treated as a modification — 10% test, likely derecognition, fresh EIR — or as an embedded contractual term? This should be settled with the audit position before the engine work in piece 5 begins, because it determines whether PCS needs to derecognise and re-recognise at the consolidation date.

---

## 12 · What PCS does with the feed

Read-only in the module — Deal Setup, Tranches, Fees and Lifecycle Events display received data and cannot be edited. The Cashflow tab shows the received schedule rather than a computed one.

PCS then performs:

- Effective interest rate, including fee and cost amortisation over expected life, re-estimated at rate resets and re-struck at consolidation
- Impairment — IFRS 9 three-stage ECL, CECL or incurred loss per the deal's framework, with CCF applied to `committedAmount`
- Journal generation under the chosen framework
- Legal-entity ownership split
- Posting to Investran via DIU

A banner states the source and snapshot timestamp on every affected screen. The Accounting tab warns when the last run predates the current snapshot, and flags any restated period that has already been posted.
