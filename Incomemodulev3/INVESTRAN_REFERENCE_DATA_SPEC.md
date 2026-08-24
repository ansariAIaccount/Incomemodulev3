# Investran reference data — what to pull before creating a DIU job

**Purpose:** Every DIU `Transaction` column that has a paired `X` / `X Id` in
Investran's field map is a **lookup**. The importer resolves the value against
master data and **rejects the row if it doesn't match**. This spec lists exactly
what must be loaded, why, and what each Report Wizard job needs to return.

**Derived from:** live calls to
`GET /api/DataImport/v1/data-import-job/metadata?entityName=Transaction`
(105 fields) and Investran's lookup-field registry (791 lookup fields).

> ### ⚠ Provenance — read before trusting any number in this document
>
> Two different sources fed this spec, and they are **not** equally reliable:
>
> | Source | Environment | Trust |
> |---|---|---|
> | DIU REST API — field map, entity list, domain list | `investran-uat-us-live.fisglobal.com` → **goldenliveuat** | **Authoritative** |
> | Lookup FieldIDs (`15010`, `30`, `1061`, …) | schema-level, tenant-independent | **Authoritative** |
> | Row counts and sample values | An MCP gateway on `investranweb-livedev-us.fiscloudservices.com` → **livedev, NOT your UAT tenant** | **Indicative only** |
>
> The **structure** in this document — which datasets are needed, which DIU
> columns they feed, which FieldIDs to query — is correct for your tenant.
>
> The **volumes and example values** came from a different environment and
> should be re-measured against `goldenliveuat` once your RW jobs run. Do not
> size anything on them.

---

## How to read this

Each dataset below shows:

- **Feeds** — which DIU column(s) it validates
- **RW FieldID** — Investran's lookup field id, for building the RW job
- **Metadata tree** — where the field sits in the RW hierarchy
- **Required columns** — the minimum the report must return
- **Volume** — approximate row count on `goldenliveuat`

We need **both** the display name and the numeric Id for every lookup. DIU
accepts either, but holding both lets us send the Id (unambiguous) while
showing the name to users.

---

## Tier 1 — the import fails without these

### 1.1 · GL Accounts  ← highest priority

| | |
|---|---|
| **Feeds** | `Account`, `Account Id` |
| **RW FieldID** | `15010` (GL Account) |
| **Metadata tree** | `Accounting\|Other Attributes` |
| **Volume** | ~939 in a *livedev* tenant — **unknown for goldenliveuat**, measure when your RW job runs |
| **Observed format** | `{"id": <int>, "name": "<code> - <description>"}` — shape is likely consistent; the sample values were from livedev |

**Required columns**
- Account Id (numeric)
- Account code
- Account description / short description (FieldID `300075`, tree `Accounting|Other Misc. Items|GL Acct Config`)
- Account Type (FieldID `15020`, same tree)
- Active / inactive flag
- Legal Entity or Domain scope, if accounts are entity-scoped

**Why it's first:** every journal line carries an Account. It also **seeds the
General Ledger Mapping screen** — those DR/CR codes are currently our invented
defaults (`141000`, `421000`, …), not your chart. Once loaded, that screen
should populate from Investran and validate any code a user types.

---

### 1.2 · Transaction Types

| | |
|---|---|
| **Feeds** | `Transaction Type`, `Transaction Type ID` |
| **RW FieldID** | `1061` (Trans Type) |
| **Metadata tree** | `Accounting\|Other Attributes` |

**Required columns**
- Trans Type Id
- Trans Type name
- **Default Account** (FieldID `2000112`, tree `Accounting|Other Misc. Items|Trans Type Config|Configuration`)
- Active flag

**Note:** Investran already maps transaction types → default GL accounts via
Trans Type Config. Worth pulling — it may let us **derive** much of the GL
Configuration matrix instead of asking clients to fill it in by hand.

Our engine emits descriptive strings (`"Interest Cash Receipt"`,
`"Loan Drawdown — Cash"`). These almost certainly won't match Investran's
vocabulary, so this dataset drives a mapping layer.

---

### 1.3 · Legal Entities

| | |
|---|---|
| **Feeds** | `Legal Entity`, `Legal Entity Id`, `Legal Entity Domain`, `Legal Entity Domain Id`, and the `Transaction Legal Entity*` variants |
| **RW FieldID** | `30` (Legal Entity) · Domain `294` |
| **Metadata tree** | `Entities\|03 Legal Entities\|General` |
| **Volume** | ~4,890 in a *livedev* tenant — **unknown for goldenliveuat** |

**Required columns**
- Legal Entity Id
- Legal Entity name
- Legal Entity Domain + Domain Id
- LE Currency (FieldID `34`) and currency symbol (`95`)
- Legal Entity Group + Group Id, if used
- Active flag

**Also resolves:** the `LEID` gap in Loan Builder. There's currently no UI field
for it and it defaults to `0`; once this loads we can make it a picker.

---

### 1.4 · Currencies

| | |
|---|---|
| **Feeds** | `Transaction Currency`, `Transaction Currency ID` |
| **RW FieldID** | `1141` |
| **Metadata tree** | `Accounting\|Amount and Qty` |

**Required columns:** Currency Id, ISO code, name.

---

### 1.5 · Batch Type and Batch Status

| | |
|---|---|
| **Feeds** | `Batch Type`, `Batch Type Id`, `Batch Status` |
| **RW FieldID** | Batch Type `30976` (also `1065`) · Batch Status `30975` |
| **Metadata tree** | `Accounting\|Other Attributes` |

**Required columns:** Id, name, active flag.

**Why:** confirms the exact vocabulary Investran accepts for the Post-back
status picker. We currently send `Draft` / `Approved` / `Posted` — those are our
strings and need validating against this list.

---

### 1.6 · JE Types

| | |
|---|---|
| **Feeds** | `JE Type`, `JE Type Id` |
| **RW FieldID** | `4000001` (Journal Entry Type) |
| **Metadata tree** | `Accounting\|Other Attributes` |

**Required columns:** Id, name, active flag.

---

## Tier 2 — needed for correct attribution

Without these the import may succeed but the JEs won't be attributed to the
right deal or position.

| Dataset | Feeds | RW FieldID | Metadata tree |
|---|---|---|---|
| **Deals** | `Deal`, `Deal Id`, `Deal Domain`, `Deal Domain Id` | `12` · Domain `295` | `Entities\|04 Deals\|General` |
| **Positions** | `Position`, `Position Id`, `Position Security Identifier` | `851` | `Entities\|05` |
| **Securities** | `Security`, `Security Id` | `502` | `Entities\|09 Security Master\|Security` |
| **Income Securities** | `Income Security`, `Income Security Id`, `PIK Income Security*` | `700` | `Entities\|09 Security Master\|Income Security` |
| **Issuers** | `Issuer`, `Issuer Id`, `Issuer Domain`, `Issuer Domain Id` | `571` · Domain `299` | `Entities\|09 Security Master\|Issuer` |
| **Allocation Rules** | `Allocation Rule`, `Allocation Rule Id` | `1179` | `Accounting\|Other Attributes` |

For each: **Id + name + domain + active flag** at minimum.

**Deal matters most here** — it's how a loan in our module ties to the
corresponding Investran deal record. Also needed: Deal Currency (`11048`).

---

## Tier 3 — only if your deals use them

| Dataset | Feeds | RW FieldID |
|---|---|---|
| Investors | `Investor`, `Investor Account Id`, `Investor Domain*` | `10000` |
| Vehicles | `Vehicle`, `Vehicle Account Id`, `Vehicle Domain*` | `10010` |
| Pools | `Pool Number`, `Pool Number Id` | `1125` |
| Lots | `Lot`, `Lot Id` | `30765` |

Skip unless a deal actually populates these columns.

---

## Also required — but not from Report Wizard

**Import domains.** Job creation needs a `DomainId`, and this comes from the
DIU API, not RW:

```
GET /api/DataImport/v1/domain?import=true
```

Currently returns **0 domains** for service account `C-E1074557`, while
`?import=false` returns 12. **This is an open blocker** — the account has no
domain with import rights. Needs a permissions grant before any job can be
created.

---

## Suggested RW job structure

Rather than one report, build **one job per dataset**. Reasons:

- They refresh on different cadences — the chart of accounts changes rarely,
  deals and positions change often
- A failure in one doesn't block the others
- Row counts differ by orders of magnitude (939 accounts vs 4,890 entities)

Minimum viable set to attempt a first import: **1.1, 1.2, 1.3, 1.4** plus the
domain permission.

---

## Proposed tool page — "Investran reference data"

A new page under **Tools** showing what's loaded and how stale it is:

| Dataset | Rows | Last synced | Status |
|---|---|---|---|
| GL Accounts | 939 | 2026-08-24 14:02 | ✓ Current |
| Transaction Types | — | never | ⚠ Not loaded |
| Legal Entities | 4,890 | 2026-08-24 14:02 | ✓ Current |
| … | | | |

Behaviour:
- **Sync** per dataset and **Sync all**
- Click a row to browse the loaded values with a filter
- Staleness warning past a configurable age
- **Validate current deal** — check that this deal's values resolve against
  loaded reference data, *before* generating the DIU job. Turns a failed import
  into a caught error.
- Cache in Supabase so it survives reloads and is shared across users

---

## Sizing and data quality — unknown, by admission

Sample GL account values looked like `!!!amax - asdf1234`, `#Ateam - asdfasdf`
— clearly scratch data. **But those came from a livedev tenant, not from
`goldenliveuat`.** They say nothing about your UAT data quality.

Two things to establish when the first RW job runs:

1. **Actual row counts** on `goldenliveuat` — these drive paging, caching and
   whether the reference-data page needs virtualised lists.
2. **Whether the UAT chart of accounts is representative** — if it's scratch
   data too, the mapping screens can be wired but not meaningfully demoed.

---

## Open questions for your developers

1. Which RW reports already exist for these datasets, if any? Reusing beats rebuilding.
2. Can the RW API be called with the same bearer token, or does it need separate auth?
3. What's the RW API base URL? We only have `/api/DataImport/v1` confirmed.
4. Are GL accounts scoped per Legal Entity / Domain, or global across the tenant?
5. Refresh cadence — how often does each dataset realistically change?
