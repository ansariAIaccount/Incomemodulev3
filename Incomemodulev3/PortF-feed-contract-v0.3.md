# PortF → PCS Loan Module — feed contract

**v0.3 · 16 September 2026**
Supersedes v0.2. Realigned to the agreed Excel template *PCS Loan Import New Deal.xlsx*.

---

## 0 · The governing principle

There are two ways a deal reaches PCS — an Excel workbook and this API — and **they must
describe the same deal with the same words.** Every field below has a counterpart in the
workbook, carries the same meaning, and draws from the same vocabulary.

That is not tidiness. If the two routes disagree about what a tranche is called or which
values are legal, a deal started from a workbook and later maintained over the API resolves
to two different records in PCS and its accounting history splits in half — silently,
because both halves look valid.

Three rules follow, and everything else in this document is a consequence of them.

| | |
|---|---|
| **One vocabulary** | The workbook's *Lookup values* tab is the single source of legal values. The API accepts the same strings, and nothing else. |
| **One identity** | A deal, tranche, component and drawdown lot are identified by an id that never changes — not by a name, which users rename. |
| **Nothing inferred** | Anything PCS would otherwise have to guess is stated explicitly. Where it is not, PCS reports the inference rather than hiding it. |

---

## 1 · Shape

| Decision | Value |
|---|---|
| Direction | PCS **pulls**. PortF exposes a read API; PCS polls. |
| Payload | **Full snapshot** per deal — the complete current state every time. |
| Schedule | **Full forward schedule** to maturity, not just actuals to date. |
| GL granularity | **Tranche level.** Drawdown lots are carried for traceability; journals aggregate to the tranche. |
| Restatements | No marker. PCS diffs each snapshot against the last. |
| Who owns what | PortF owns setup, events and cashflow *calculation*. PCS owns EIR, impairment, journals and posting to Investran. |

PCS never writes back. Deals arriving this way are `source = external` and read-only in the module.

---

## 2 · Endpoints

### `GET /deals?changedSince={iso8601}`

```json
{
  "generatedAt": "2026-09-16T06:00:00Z",
  "deals": [
    { "externalDealId": "9f2c1b44-0e77-4b1a-9c33-aa5512d0f001",
      "dealCode": "SP032",
      "name": "Suffolk",
      "lastChangedAt": "2026-09-15T06:00:00Z",
      "snapshotId": "SP032-20260915-0600",
      "contentHash": "sha256:9f2c…" }
  ]
}
```

`contentHash` lets PCS skip the fetch when nothing has changed. Snapshots are large and deals
change rarely, so most polls should be no-ops.

### `GET /deals/{externalDealId}`

The full snapshot — section 4.

**Idempotency.** `snapshotId` and `contentHash` must change when anything in the payload
changes, and must not change otherwise.

---

## 3 · Identity

| Field | Source | Rule |
|---|---|---|
| `externalDealId` | PortF deal GUID | Immutable. Survives a rename of the deal. |
| `externalTrancheId` | PortF tranche GUID | Immutable. Survives a rename of the tranche. |
| `externalComponentId` | PortF | Stable per component. |
| `drawdownLotId` | PortF | Stable per lot. |
| `externalEventId` | PortF | Stable per event. |

`dealCode` (SP032) and all `name` fields are **display only**. PCS never keys on them.

This is load-bearing. Restatements carry no marker, so PCS detects a corrected prior period by
diffing snapshots on these ids. If an id is regenerated between runs, every snapshot reads as a
wholesale replacement and a restatement becomes indistinguishable from new business.

> The workbook currently identifies tranches by worksheet name, because the GUIDs are not
> exported. That is the single most important gap to close — see the Excel specification, §7.

---

## 4 · Snapshot payload

Field names mirror the workbook labels. The workbook cell each one corresponds to is named in
the Excel specification so the two can be checked against each other.

```json
{
  "snapshotId": "SP032-20260915-0600",
  "contentHash": "sha256:9f2c…",
  "generatedAt": "2026-09-15T06:00:00Z",
  "externalDealId": "9f2c1b44-0e77-4b1a-9c33-aa5512d0f001",

  "deal": {
    "dealName": "Suffolk",
    "dealCode": "SP032",
    "dealStructure": "Corporate term loan",
    "counterparty": "Sizewell C Limited",
    "agentName": "NWF",
    "currency": "GBP",
    "accountingFramework": "IFRS",
    "signingDate": "2025-11-04",
    "settlementDate": "2025-11-04",
    "maturityDate": "2063-03-01"
  },

  "facility": {
    "facilityName": "HMG Term Facility",
    "totalCommitment": 36600000000.00,
    "maximumFacilityAmount": 32277978800.00,
    "availabilityEnd": "2043-03-01",
    "dayCountConvention": "ACT/360",
    "holidayCalendar": "UK Bank",
    "repaymentType": "Bullet at maturity",
    "facilityType": "Term Loan",
    "interestAccrualPeriodDefault": "Monthly"
  },

  "facilityFees": [
    {
      "externalComponentId": "b41e…",
      "name": "Commitment",
      "feeType": "commitment",
      "postingType": "Fee",
      "appliesTo": "Facility-wide",
      "rate": 0.00446691,
      "base": "Commitment",
      "frequency": "Semi",
      "paymentDate": "2026-01-04",
      "revenueTreatment": "IFRS 9 - capitalised into EIR"
    }
  ],

  "tranches": [
    {
      "externalTrancheId": "7d4e…",
      "trancheName": "SP032 — 01042026",
      "currency": "GBP",
      "initialDrawdownDate": "2026-04-01",
      "faceValue": 589000000.00,
      "initialDrawdown": 23000000.00,

      "interestComponents": [
        {
          "externalComponentId": "a17c…",
          "interestName": "Monthly SONIA",
          "interestType": "SONIA",
          "baseValue": null,
          "accrualFrequency": "Monthly",
          "terms": "3M",
          "settlementType": "Cash",
          "firstSettlementDate": "2026-08-01",
          "lookback": 5,
          "lockout": 0,
          "observationShift": 0,
          "spreadBandStartDate": "2026-04-01",
          "spreadBandEndDate": "2026-07-04",
          "marginRatchet": null,
          "esgAdjustmentBps": 0,
          "rateFloorBps": 0,
          "rateCapBps": 0
        }
      ],

      "trancheFees": [
        {
          "externalComponentId": "c55a…",
          "name": "Arrangement Fee",
          "feeType": "arrangement",
          "appliesTo": "Tranche",
          "rate": 0.0135,
          "base": "Tranche face",
          "frequency": "One-off",
          "paymentDate": "2025-04-11",
          "revenueTreatment": "IFRS 9 - capitalised into EIR"
        }
      ]
    }
  ],

  "events": [
    { "externalEventId": "e1…", "externalTrancheId": "7d4e…",
      "eventType": "initialPurchase", "eventDate": "2026-07-31",
      "amount": 23000000.00, "drawdownLotId": "lot-1…" }
  ],

  "cashflows": [
    {
      "date": "2026-09-01",
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-02",
      "daysCovered": 1,
      "externalTrancheId": "7d4e…",
      "externalComponentId": "a17c…",
      "drawdownLotId": "lot-1…",
      "postingType": "Interest",
      "settlementType": "Cash",
      "balanceBasis": "Principal Balance",
      "basisBalance": 23000000.00,
      "rate": 0.05712345,
      "amount": 3598.02,
      "cashSettled": 0.00
    }
  ]
}
```

---

## 5 · Cashflows — the one structural difference from the workbook

The workbook lays cashflows out in a grid: four sections (PIK interest, PIK fee, cash
interest, cash fee), each holding four Rate/Amount pairs, one per balance basis. That works on
a spreadsheet and does not survive contact with a fifth component.

**The API sends one row per (date × tranche × component × drawdown lot) instead**, with
`postingType`, `settlementType` and `balanceBasis` as fields rather than as grid position.

The two carry identical information, and PCS turns the grid into these rows on import. The
long form is preferred because it removes the workbook's one remaining ambiguity: in the
current sample, a single Rate/Amount pair is labelled *"20 Year Fixed, Monthly SONIA"* — two
components sharing one figure, with nothing to say how it splits. The API has no way to
express that, which is the point.

### Required on every row

| Field | Why it is not optional |
|---|---|
| `externalComponentId` | Which component this posts to. A row that cannot name its component cannot be reported or reconciled per component. |
| `postingType` | `Interest` or `Fee` — drives the GL account. |
| `settlementType` | `Cash`, `Capitalized` or `PIK` — drives whether it is paid, capitalised or accrued in kind. |
| `daysCovered` | **Or** `periodStart` and `periodEnd`. See below. |
| `amount` | What PCS posts. Taken as given; never recalculated. |

### Days covered

The workbook does not state it, and the two sheet types disagree about what the row date means
— on tranche sheets it is the period start, on the facility sheet the period end. PCS resolves
this by testing both readings against the days the figures themselves imply, which works but
is an inference.

**State it.** Either `daysCovered`, or `periodStart` and `periodEnd`, on every row. It costs
one field and removes a whole class of reconciliation doubt.

### Rates

Decimals, full precision — `0.00446691`, never `0.0045` and never `0.45`. Four decimal places
distorts a recalculated 45bp fee by about 0.74%. A value above 1 is rejected as a percentage
entered where a decimal belongs.

### Flat fees

A fee with an amount but no rate (the workbook's *Flat PIK Fee* / *Flat Cash Fee* columns)
sends `rate: null` and `amount` populated. `balanceBasis` is omitted.

---

## 6 · Vocabulary

**Identical to the workbook's *Lookup values* tab.** PCS validates against the values the
workbook declares, so anything legal there is legal here and nothing else is.

| Field | Accepted values |
|---|---|
| `dealStructure` | Corporate term loan · Construction/mezzanine finance · Revolving borrowing base · Bilateral facility · Other |
| `currency` | USD · EUR · GBP · AUD · CAD · CHF · JPY · NZD · SGD · HKD |
| `accountingFramework` | IFRS · US GAAP (CECL) · Canadian ASPE · AASB (Australian) |
| `dayCountConvention` | ACT/360 · **ACT/365** · ACT/ACT · 30/360 · 30E/360 |
| `holidayCalendar` | None · US Federal · UK Bank · TARGET (EUR) · Australian Notional |
| `repaymentType` | Bullet at maturity · Periodic (amortising) |
| `facilityType` | Term Loan · Revolving Credit Facility · Delayed-Draw Term Loan · Revolving Borrowing Base (livestock/commodities) |
| `interestAccrualPeriodDefault` | Weekly · Monthly · Quarterly · Semi-annual · Annual · At maturity (bullet) |
| `feeType` | arrangement · commitment · utilisation · agency · other · origination · management · performance |
| `base` | Commitment · Funded · Unfunded · Tranche face |
| `frequency` | One-off · Monthly · Quarterly · Semi · Annual |
| `revenueTreatment` | IFRS 9 - capitalised into EIR · IFRS 15 - recognised over time · IFRS 15 - recognised point-in-time |
| `interestType` | SOFR · SONIA · TermSOFR · ESTR · EURIBOR · FIXED |
| `accrualFrequency` | Facility default · Weekly · Monthly · Quarterly · Semi-annual · Annual · At maturity |
| `terms` | 1M · 3M · 6M · 12M · O/N |
| `settlementType` | Cash · Capitalized · PIK |
| `postingType` | Interest · Fee · Principal |
| `balanceBasis` | Principal Balance · Unfunded Balance · Principal + Capitalised · Unfunded (Net of capitalisations) |
| `eventType` | initialPurchase · drawdown · principalPayment · interestPayment · feePayment · rateReset · consolidation · amendment · prepayment · writeOff · recovery |

**Two corrections needed in the lookup tab**, applied here already:

- **ACT/365 is missing.** The tab lists ACT/360 twice (E5 and E6) and has no ACT/365. Without
  it no SONIA or other GBP deal can state its day count. Shown in bold above.
- **"Montly"** is a misspelling of Monthly. Both spellings are accepted for now.

A third defect is data rather than vocabulary: Tranche 2 names its fee *"Arrangeement Fee"* in
the fee block and *"Arrangement Fee"* in the cashflow header, so the two do not join.

---

## 7 · Formats

| Data | Format |
|---|---|
| Dates | ISO 8601 `YYYY-MM-DD`. Timestamps UTC with `Z`. |
| Amounts | Numbers, 2 dp, in the stated currency. Never formatted strings. |
| Rates | Decimals at full precision. Never percentages. |
| Absent | `null`. Never `""`, `0` or `"-"` for a value that is genuinely unknown — zero is an assertion. |
| Currency | Explicit at deal and tranche level. Never inferred from a symbol. |

---

## 8 · Validation

**Rejected — the snapshot is not imported:**

- Any value outside section 6.
- A blank `currency`, `accountingFramework`, `dayCountConvention`, `dealStructure` or
  `interestType`. These change computed amounts; a default would silently mis-state the file.
- Any rate greater than 1.
- A fixed-rate component with no `baseValue`.
- A cashflow row whose `externalComponentId` is not declared in the snapshot.
- A missing `settlementDate` or `maturityDate`.
- Duplicate `externalTrancheId` within a deal.

**Accepted with a warning:**

- A blank `base`, `frequency`, `feeType` or `holidayCalendar` — descriptive, and the amounts
  still post correctly.
- `daysCovered` absent, so PCS infers it.
- `totalCommitment` and `maximumFacilityAmount` inconsistent with each other.
- A component PCS does not yet handle, imported but not driving any calculation.

The asymmetry is deliberate. Blank blocks the import only where a missing value would change a
**number**. Everything else is reported and imported, because rejecting a whole deal over a
descriptive field helps nobody.

---

## 9 · Volume

A 40-year daily schedule is roughly 30,000 rows per tranche; fifty tranches is 1.5 million.

- PCS compares `contentHash` first and skips unchanged deals entirely.
- One current snapshot is stored in full, plus a **row-level change log** — not full history,
  which would run to ~95 million rows per deal per year.
- Any change to a period already posted to Investran is flagged before accounting re-runs.

The Excel route has a 500,000-row ceiling because it parses in a browser. **The API has no such
limit** and is the right route for large deals.

---

## 10 · Open items

**For PortF**

1. **Export the GUIDs.** Confirmed to exist; not yet in the workbook. Until they are, the two
   routes disagree about identity — section 3.
2. **State `daysCovered`**, or period start and end — section 5.
3. **One Rate/Amount pair per component.** The combined *"20 Year Fixed, Monthly SONIA"* line
   cannot be split.
4. **Correct the lookup tab** — ACT/365, "Montly", and the "Arrangeement Fee" mismatch.
5. **Consolidation events.** The sample structure converts a 6-month floating facility into a
   20-year loan at a negotiated rate. There is no way to express that. It needs an explicit
   event carrying effective date, lots consolidated, new rate, new structure and new term.
6. **Level-payment schedules must be decomposed** — the interest element separately from the
   principal element. A blended figure cannot be posted, because the ledger needs interest and
   principal in different accounts.
7. **Covenants** are absent entirely. Without them an external deal cannot take part in
   covenant monitoring or margin step-ups.
8. **Total Commitment (£36.6bn) exceeds the opening unfunded balance (£32.28bn)** in the
   sample. One of the two is wrong, or the fee accrues on a narrower base — it matters because
   it is the figure ECL is measured against.

**For FIS**

- **Restatement posting** — reverse-and-repost, or delta-post, when a restated period has
  already reached Investran. Recommendation: reverse and re-post, for the audit trail.
- **EAD basis** — confirm the credit conversion factor applies to the committed amount only.
- **Consolidation treatment** — modification with a 10% test and possible derecognition, or an
  embedded contractual term? This gates the engine work and should be settled with the audit
  position first.

---

## 11 · What PCS does with the feed

Read-only in the module. Deal Setup, Tranches, Fees and Lifecycle Events display what was
received; the Cashflow tab shows the received schedule rather than a computed one.

PCS then performs: effective interest rate (re-estimated at resets, re-struck at
consolidation), impairment under the deal's framework, journal generation, legal-entity split,
and posting to Investran via DIU.

A banner states the source and snapshot timestamp on every affected screen. The Accounting tab
warns when the last run predates the current snapshot, and flags any restated period already
posted.
