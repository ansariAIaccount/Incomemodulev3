# Report Wizard build spec — Investran reference data

**For:** whoever builds the RW jobs
**Purpose:** pull the master data our loan module needs to validate GL journal
entries before creating a DIU import job. Without it, imports fail on
unresolved lookups.

**Build 6 reports.** Each is independent. Reports 1–4 are required for a first
import; 5–6 are needed for correct deal/position attribution.

**Target tenant:** `goldenliveuat`

---

## Where these reports sit

Two APIs, opposite directions:

```
  Report Wizard  ──────────►  PCS Sync  ──►  income module DB
  (extract FROM Investran)                          │
                                                    │  validates lookups,
                                                    │  builds journal entries
                                                    ▼
  DIU  ◄───────────────────────────────────  GL submission
  (load INTO Investran)
```

**These reports are the left-hand arrow.** We execute them via the RW API, cache
the rows, and use them to resolve every lookup column before a GL batch is sent
back through DIU. If a report is missing, the corresponding DIU import fails on
unresolved lookups — which is why the required set is required.

---

## How we'll consume them

**We call the RW API directly** — no file drop needed:

```
POST …/api/ReportWizard/v1/executions              → execution id
GET  …/api/ReportWizard/v1/executions/{id}/status  → poll
GET  …/api/ReportWizard/v1/executions/{id}/result  → rows
```

**So the one thing we need back from you per report is its saved report id.**
We enter it against the dataset in our PCS Sync screen and it runs from there.

---

## Output format — applies to every report

- **Header row:** required, use the **exact** column names in each spec below —
  we map by name, so `AccountId` and `Account Id` are not interchangeable
- **Empty values:** leave blank, don't substitute `N/A` or `0`
- **Encoding:** UTF-8

If a listed column doesn't exist in your RW field tree, **leave it out and tell
us** rather than substituting something similar. A wrong value is worse than a
missing one — our sync flags absent columns, but it can't detect a column
that's present and wrong.

---

## Report 1 — GL Accounts   `REQUIRED`

Chart of accounts. Every journal line references one.

| Column | Source | Notes |
|---|---|---|
| `AccountId` | GL Account — FieldID **15010** | numeric id |
| `AccountCode` | GL Account | the code portion |
| `AccountName` | Account Short Description — FieldID **300075** | |
| `AccountType` | Account Type — FieldID **15020** | asset / liability / income / expense |
| `IsActive` | | true/false |
| `LegalEntityId` | | only if accounts are entity-scoped; blank if global |

**Metadata tree:** `Accounting|Other Attributes` · `Accounting|Other Misc. Items|GL Acct Config`

**Question we need answered:** are GL accounts global across the tenant, or
scoped per legal entity / domain?

---

## Report 2 — Transaction Types   `REQUIRED`

Investran's controlled vocabulary for transaction types, plus the default GL
account each maps to.

| Column | Source | Notes |
|---|---|---|
| `TransTypeId` | Trans Type — FieldID **1061** | |
| `TransTypeName` | Trans Type | |
| `DefaultAccountId` | Default Account — FieldID **2000112** | **important — see below** |
| `DefaultAccountCode` | | |
| `IsActive` | | |

**Metadata tree:** `Accounting|Other Attributes` · `Accounting|Other Misc. Items|Trans Type Config|Configuration`

**Why `DefaultAccountId` matters:** if Investran already maps transaction types
to default GL accounts, we can pre-populate our GL configuration screen from it
rather than asking every client to fill in a 24-row matrix by hand. Please
include this column even if you think it's empty — we want to know either way.

---

## Report 3 — Legal Entities   `REQUIRED`

| Column | Source | Notes |
|---|---|---|
| `LegalEntityId` | Legal Entity — FieldID **30** | |
| `LegalEntityName` | Legal Entity | |
| `DomainId` | Legal Entity Domain — FieldID **294** | |
| `DomainName` | Legal Entity Domain | |
| `CurrencyCode` | LE Currency — FieldID **34** | ISO code |
| `LegalEntityGroupId` | | if used |
| `IsActive` | | |

**Metadata tree:** `Entities|03 Legal Entities|General`

---

## Report 4 — Small lookups   `REQUIRED`

Four short lists. Combine into one report with a `LookupType` discriminator
column, or supply as four files — your call.

| `LookupType` | Source | FieldID |
|---|---|---|
| `Currency` | Transaction Currency | **1141** |
| `BatchType` | Batch Type | **30976** |
| `BatchStatus` | Batch Status | **30975** |
| `JEType` | Journal Entry Type | **4000001** |

| Column | Notes |
|---|---|
| `LookupType` | one of the four values above |
| `Id` | |
| `Name` | |
| `IsActive` | |

**Metadata tree:** all under `Accounting|Other Attributes` (Currency under `Accounting|Amount and Qty`)

**Why:** `BatchStatus` in particular — we send Draft / Approved / Posted and
need to confirm those are the strings Investran accepts.

---

## Report 5 — Deals   `NEEDED FOR ATTRIBUTION`

| Column | Source | FieldID |
|---|---|---|
| `DealId` | Deal Name | **12** |
| `DealName` | Deal Name | **12** |
| `DomainId` | Deal Domain | **295** |
| `DomainName` | Deal Domain | **295** |
| `CurrencyCode` | Deal Currency | **11048** |
| `IsActive` | | |

**Metadata tree:** `Entities|04 Deals|General`

**Why:** this is how a loan in our module ties to its Investran deal record.

---

## Report 6 — Positions and Securities   `NEEDED FOR ATTRIBUTION`

| Column | Source | FieldID |
|---|---|---|
| `PositionId` | Position | **851** |
| `PositionName` | Position | **851** |
| `SecurityId` | Security Name | **502** |
| `SecurityName` | Security Name | **502** |
| `IncomeSecurityId` | Income Security Name | **700** |
| `IncomeSecurityName` | Income Security Name | **700** |
| `IssuerId` | Issuer Name | **571** |
| `IssuerName` | Issuer Name | **571** |
| `IssuerDomainId` | Issuer Domain | **299** |
| `LegalEntityId` | | to link positions to entities |

**Metadata tree:** `Entities|05` · `Entities|09 Security Master|*`

Split into separate reports if the join is awkward — we can join on our side.

---

## Report 7 — Allocation Rules   `OPTIONAL`

Only if your deals use allocation rules; otherwise skip.

| Column | Source | FieldID |
|---|---|---|
| `AllocationRuleId` | Allocation Rule | **1179** |
| `AllocationRuleName` | Allocation Rule | **1179** |
| `IsActive` | | |

---

## Not from Report Wizard — separate ask

Job creation requires a `DomainId` with **import** rights. Currently:

```
GET /api/DataImport/v1/domain?import=true    → 0 domains
GET /api/DataImport/v1/domain?import=false   → 12 domains
```

Service account `C-E1074557` has no domain with import permission on
`goldenliveuat`. **This needs granting before any import can run** — it's
independent of the reports above and worth chasing in parallel.

---

## Refresh cadence

Tell us what's realistic per report. Our assumption:

| Report | Expected change frequency |
|---|---|
| 1 GL Accounts | rarely — monthly is fine |
| 2 Transaction Types | rarely |
| 3 Legal Entities | occasionally — weekly |
| 4 Small lookups | rarely |
| 5 Deals | often — daily |
| 6 Positions / Securities | often — daily |

---

## What to send back

For each report you finish:

| | |
|---|---|
| **Report id** | the saved RW report id — this is what we execute |
| **Report name** | as saved, so we can find it in the UI |
| **Delivered columns** | if any spec column had to be dropped, name it |

That's enough for us to wire it up. Send them one at a time as they're ready —
each dataset is independent, so Report 1 alone lets us start testing.

---

## Questions back to us

If anything here is ambiguous, the fastest resolution is a sample output from
Report 1 with 20 rows. That tells us the shape and we can adjust the rest of
the spec around it.

Contact: Ferhat Ansari
