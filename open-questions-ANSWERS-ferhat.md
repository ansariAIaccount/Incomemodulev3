---
type: open-questions-answers
id: OPEN-QUESTIONS-ANSWERS-FERHAT
answers: Q-001..Q-005, Q-009 (open); Q-010..Q-123 (confirm/reject pass)
date: 2026-10-18
author: Ferhat Ansari (V4 author)
---

# Answers — Ferhat

Answers to the questions addressed to me in `open-questions.md`, plus the
confirm/reject pass on the questions answered under delegation on 2026-10-17.

**Nothing in the V4 repository was changed to produce this.** Where an answer
names a fix, it is a decision, not a commit.

**How to read the two parts.** Part A is me answering a question nobody had
answered. Part B is me reviewing someone else's answer. They carry different
weight and I have marked which is which rather than blending them.

---

## Part A · The six open questions

### Q-001 · Seed script needs Supabase-style grants — **CONFIRMED, my defect**

You are right, and the kit is wrong. Verified:

- `00-auth-shim.sql` creates `service_role` with `bypassrls` (L64-67) and
  grants it `usage` on schema `auth` (L73), `execute` on `auth.uid()` /
  `auth.role()` (L140) and `select` on `auth.users` (L141).
- It grants **nothing on `public`** — and could not, because the shim runs
  before `schema.sql` and those tables do not exist yet.
- `schema.sql` contains **zero** `GRANT` statements (checked: `grep -c
  '^grant' schema.sql` → 0).
- `bypassrls` bypasses row-level security. It does **not** bypass table-level
  privileges. So `set local role service_role` followed by `insert into
  public.gl_accounts` is `permission denied`, every time.

So the seed cannot run as written on a plain Postgres restore. Your local
workaround was necessary.

**Two things to know before fixing it.** First, the role switch was never
needed for the restore. A table's **owner** is exempt from RLS unless the table
carries `FORCE ROW LEVEL SECURITY`, and none of the 80 do. Restoring as the
owner — which is what `psql "$DST" -f seed-reference.sql` does — would have
worked with no role switch at all. The `set local role service_role` line is
a Supabase habit I carried over without checking, and it is the whole cause of
this question.

Second, the grants are needed anyway, for a different reason: PostgREST
authenticates as `anon` / `authenticated` and those roles need table
privileges to serve the app at all. So this is not only a seed problem.

**Decision.** Both, in this order:

1. Append a grants block to the **end** of `schema.sql` (after the tables
   exist), mirroring what Supabase provisions:

   ```sql
   grant usage on schema public to anon, authenticated, service_role;
   grant all on all tables    in schema public to anon, authenticated, service_role;
   grant all on all sequences in schema public to anon, authenticated, service_role;
   grant all on all functions in schema public to anon, authenticated, service_role;
   alter default privileges in schema public
     grant all on tables to anon, authenticated, service_role;
   ```

   RLS, not the grant, is what restricts `anon` — which is exactly why the
   policy audit in `db/README.md` §2 matters and is not optional.

2. Make the `set local role service_role` line in `seed-reference.sql`
   **optional and commented**, with a note that restoring as the owner is the
   normal path. Keep it available for seeding an already-live database where
   the operator is not the owner.

Priority: do (1) before anyone restores again; it is five lines. Not urgent
beyond that — nothing in P1 or P2 depends on a restored database.

---

### Q-002 · Auth shim must be re-run after schema.sql — **CONFIRMED, my defect, documentation**

Also right. Verified at `00-auth-shim.sql` §5 (L143-162): the trigger is
created only if `public.handle_new_user()` already exists —

```
if exists (select 1 from pg_proc p join pg_namespace n ... 
           where n.nspname='public' and p.proname='handle_new_user') then
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created ...
else
  raise notice 'public.handle_new_user() not found — run this AFTER schema.sql,
                or create the trigger by hand.';
end if;
```

and `handle_new_user()` is defined in `schema.sql` (L318), which runs
**after** the shim. So on a first run the guard always takes the `else`
branch and no trigger is created.

One thing in the kit's favour: it fails **loudly**. The `raise notice` says
exactly what to do. That is why you hit it and worked around it rather than
getting a silent half-configured database. But the README says three steps and
means four, so the defect is real.

**Decision: split the file, don't document the wart.** Telling people to run
the same script twice invites running it twice in the wrong order. Instead:

- `00-auth-shim.sql` keeps roles, `auth.users`, `auth.uid()`, `auth.role()` —
  everything `schema.sql` depends on.
- A new `02-auth-trigger.sql` carries §5 alone, runs **after** `schema.sql`,
  and `raise exception` (not notice) if the function is still missing, because
  at that point it is a genuine error.
- The README and HANDOVER §5a both become four steps.

Why a separate file rather than appending to `schema.sql`: the trigger lives
on `auth.users`, in the `auth` schema, which `generate-schema.sql` cannot see.
It is already listed under *What the generators do not capture*. Putting it
inside a generated file would be lost on the next regeneration.

---

### Q-003 · Three demo PDFs are missing from the repo — **CONFIRMED; they exist, they were never committed**

They are not lost. All three are in my Cowork working folder and have been
since they were produced:

| File | Size | Also as |
|---|---|---|
| `PCS-Demo-Script-Hamilton-Smokey.pdf` | 288 kB | `.md` 29 kB |
| `PCS-Demo-Script-POCI-Three-Scenarios.pdf` | 58 kB | `.md` 10 kB |
| `PCS-IFRS-Demo-Answers.pdf` | 374 kB | `.md` 79 kB |

The gap is purely that the Cowork folder is not the repository and nothing
copied them across. Several related files are in the same position —
`PCS-Demo-Script-POCI.pdf` (the earlier single-scenario script, superseded by
the three-scenario one), `PCS-Demo-Script-Coupon-vs-EIR.pdf`,
`PCS-Release-Notes-2026-10-14.pdf`, `EIR-Marley-calculation-reference.pdf`,
`ECL-Smokey-calculation-reference.pdf`.

**Decision: commit the markdown sources, and generate the PDFs from them.**
Not the PDFs as primary artefacts. We have just been bitten by exactly that:
`HANDOVER.pdf` and `SCHEMA-REFERENCE.pdf` sat four days stale next to updated
markdown and contradicted it, and regenerating them surfaced a layout fault
that had been silently truncating enum values off the right edge of the page.
`Handover Docs/build-pdfs.sh` now rebuilds those two with a layout check; the
demo scripts should join it rather than being committed as binaries that drift.

Unblocking you meanwhile: **the markdown sources are authoritative** and the
P1 cross-check should use them. The PDFs add typesetting, not content.

Note for the cross-check: `PCS-Demo-Script-POCI.pdf` and
`PCS-Demo-Script-POCI-Three-Scenarios.pdf` are different documents, not two
renderings of one. The three-scenario script supersedes the other. Use the
three-scenario one.

---

### Q-004 · auFederal — **CONFIRMED; and the answer to your "also ask" is yes**

Three separate faults here, all mine, all from the 2026-10-14 calendar rework.

**1. The five AU presets carry a code that no longer exists.** Verified
against the database: `build_definition.facility.holiday` is `'auFederal'` in
all five of `murraydarling-mining-au`, `northbridge-property-au`,
`pilbara-aasb-au`, `riverina-agribusiness-au`, `tasman-renewables-sll-au`. The
other twelve presets use `usFederal`, `ukBank` or `target` and are fine.

**2. Your "also ask" — does saving one of the five fail the foreign key? Yes.**
`facilities.holiday_calendar` is `text default 'none' not null`
(`db/schema.sql#L1668`) with `facilities_holiday_calendar_fk` onto
`holiday_calendars(code)`. `holiday_calendars` has exactly 7 rows and
`auFederal` is not among them. An insert naming it is rejected. You do not
need to test it against a database; the constraint and the row set are both
confirmed, and the conclusion follows from them.

There is a second, independent block behind it: `materialize_preset()` casts
the preset's holiday value to `::holiday_calendar`, the enum retired on
2026-10-14 (`db/schema.sql#L477`). Even after the five presets are corrected,
a preset naming `nlNational` or `luNational` fails at that cast, because those
were never enum members. Both need fixing or the AU presets stay unloadable.

**3. The save-side allow-list defect you recorded on 2026-10-17 is real, and
it is worse than the preset problem.** Verified:

- The dropdown `#b-holiday` offers `none`, `usFederal`, `ukBank`, `target`,
  `nlNational`, `luNational`, `auNational`.
- `ENUMS.holiday.allowed` is `['none','usFederal','ukBank','target','auFederal']`
  (`loan-module-v4-builder.html#L13824`) — the retired enum, unchanged.
- `safeEnum()` falls back to the default on an unrecognised value with only a
  `console.warn` (`#L13890-L13901`), and the result goes straight to
  `holiday_calendar` on save (`#L14042`).

So **the Dutch and Luxembourg calendars have never once saved.** A user picks
Netherlands, the UI shows Netherlands, the deal is written with `none`, and
every payment date rolls on weekends only. Alex asked for the Dutch calendar
specifically; it has been silently inert since the day I added it. The same is
true of `auNational`, which is where the seven AU deals were repointed.

That is my error and it is the same shape as the `TAB_IDS` one from the same
week: I updated the dropdown, the engine and the database, and missed the
fourth registration point.

**Decisions.**

- The allow-list is a **persistence defect that silently loses user input**, so
  under D-006 the port **builds it correctly** — it persists the calendar the
  user chose. That matches what the 2026-10-17 note already proposed
  (F-BUILDER-006, F-BUILDER-033). Confirmed.
- In V4 itself, the allow-list should be corrected to the seven live codes and
  `auFederal` removed. This is worth doing even though V4 is being replaced,
  because V4 is the parity oracle: every golden file produced from a deal with
  a Dutch, Luxembourg or Australian calendar currently encodes the wrong
  answer. **Fix this before the P2 golden files are cut**, or the port will
  faithfully replicate a no-holiday schedule.
- The five presets get `jsonb_set` to `auNational`, and
  `materialize_preset()`'s `::holiday_calendar` becomes `::text`.
- Standing check, which should return no rows and currently returns five:

  ```sql
  select preset_key from preset_catalog
   where (build_definition #>> '{facility,holiday}')
         not in (select code from holiday_calendars);
  ```

The behavioural-change note in `HANDOVER.md` §11 covers the seven live AU
deals being repointed from `auFederal` to `auNational`, which moves their
payment dates. That part is already documented and stands.

---

### Q-005 · Holiday data ends in 2035 — **CONFIRMED, with the number you need**

`holiday_dates` holds 611 rows spanning **2024-01-01 to 2035-12-26** — twelve
years, six calendars (usFederal 132, luNational 131, nlNational 96, ukBank 96,
auNational 84, target 72).

The part that makes this more than a future problem: **nine deals already
mature after the last seeded date**, the latest on **2063-03-01**.

| Deal | Maturity | Calendar |
|---|---|---|
| `KST-2026-009` | 2036-04-01 | ukBank |
| `SPMARLEY010` | 2061-08-31 | (no facility row) |
| `SP010` | 2061-08-31 | (no facility row) |
| `SL010` | 2061-09-01 | ukBank |
| `Suffolk_Deal` | 2062-04-01 | ukBank |
| `SP032` | 2063-02-28 | (no facility row) |
| `SP032N` | 2063-03-01 | (no facility row) |
| `SPMARIJA0002` | 2063-03-01 | (no facility row) |
| `SPMARIJA0007` | 2063-03-01 | (no facility row) |

Your phrasing — "schedules past 2035 treat every weekday as a business day" —
is exactly right. What I want to add is **why nobody noticed**: the engine's
`_UNKNOWN_CALENDARS` warn-once fires when a calendar *code* is unknown. These
codes are perfectly well known; they simply have no rows in range. So the
failure is not merely silent, it is silent *past a warning that was built to
catch this class of problem* and does not.

**Decisions.**

1. **Extend the table.** The four derivable calendars (`usFederal`, `ukBank`,
   `target`, `auNational`) can be generated from `_easter_sunday`, `_nth_dow`,
   `_last_dow`, `_us_obs` and `_wknd_fwd`, which are already in `schema.sql`.
   `nlNational` and `luNational` are mostly derivable too (Easter-relative plus
   fixed dates). Extending to 2075 is a generation run, not research.
2. **Add a coverage warning**, which is the real fix. Warn when a calendar
   resolves but its date range does not cover the schedule horizon — a
   per-deal check at run time, not warn-once per calendar. Without this, the
   table will silently run out again in 2075.
3. **State the policy for dates past any horizon.** A 2063 maturity is 37
   years out; weekend-only rolling may well be the right answer that far into a
   projection. I am not against it. I am against it being an accident. It gets
   written down either way.

Note the five deals with no facility row resolve no calendar at all, which is
a separate gap worth a look when the facility import is fixed (#19).

For P2: a golden file taken from any of these nine deals currently encodes
weekend-only rolling past 2035. That is V4's behaviour and replicating it is
correct under D-006 — but it should be a *recorded* decision on those
fixtures, not an unexamined one.

---

### Q-009 · Time-zone dependence — **CONFIRMED AND MORE SEVERE THAN STATED. Investigated and reproduced.**

This is the most serious item in Part A. It is not "check whether any output
changes with the browser time zone". **Every date is wrong by one day in every
time zone west of Greenwich**, which includes all of the Americas.

**The mechanism.** `loan-module-engine.js#L7`:

```js
function toISO(d){ const z=new Date(d); z.setHours(12,0,0,0); return z.toISOString().slice(0,10); }
```

`setHours` is a **local-time** setter. `new Date('2026-03-15')` is UTC
midnight. In a UTC-negative zone that instant is already the *previous*
calendar day locally, so `setHours(12,...)` pins noon on 14 March, and
`toISOString()` returns `2026-03-14`.

The noon normalisation is the standard defence against this, and it works —
but only for offsets from UTC+0 to UTC+11. It does nothing for negative
offsets, where the date has already rolled back before `setHours` is called.

**Reproduced** with V4's own helpers, copied verbatim, on node:

| TZ | `toISO(new Date('2026-03-15'))` | `'2026-01-01'` | `'2026-12-31'` |
|---|---|---|---|
| UTC | 2026-03-15 ✓ | 2026-01-01 ✓ | 2026-12-31 ✓ |
| Europe/London | 2026-03-15 ✓ | 2026-01-01 ✓ | 2026-12-31 ✓ |
| Europe/Amsterdam | 2026-03-15 ✓ | 2026-01-01 ✓ | 2026-12-31 ✓ |
| Australia/Sydney | 2026-03-15 ✓ | 2026-01-01 ✓ | 2026-12-31 ✓ |
| **America/New_York** | **2026-03-14** ✗ | **2025-12-31** ✗ | **2026-12-30** ✗ |
| **America/Los_Angeles** | **2026-03-14** ✗ | **2025-12-31** ✗ | **2026-12-30** ✗ |

Note the second column: in New York, **1 January 2026 is reported as 31
December 2025**. A year-end accrual lands in the prior period.

It compounds through the date helpers. `addDays` is UTC-safe on its own
(millisecond arithmetic), but everything is read back through `toISO`, so
`2026-03-01` plus three days reads as `2026-03-04` at UTC and `2026-03-03` in
New York.

Separately and independently of time zone, `addMonths` uses `setMonth`, which
overflows: `2026-01-31` plus one month is **2026-03-03**, not 28 February.
That is the same `setMonth` overflow already noted in Q-020 for reporting
cadence, and it is in the engine's core date stepping, not just the reporting
panel.

**Answers to the three things Q-009 asks.**

- *Does any output change with the browser time zone?* Yes. Every schedule
  date, every journal effective date, every period boundary, in every
  UTC-negative zone.
- *Is it a V4 defect candidate?* It is a V4 defect, not a candidate. I am not
  hedging it.
- *Does pinning `TZ=UTC` for the P2 oracle suffice?* **For parity, yes, and it
  is the right call.** UTC is V4's correct behaviour; the other zones are the
  bug. Do not build golden files in any other zone.

**Decisions.**

1. The P2 oracle pins `TZ=UTC`. Confirmed — this was already the plan and it
   is correct.
2. The port uses date-only arithmetic with no zone or clock input (D-007), so
   it is structurally immune. Confirmed.
3. **The port must not replicate the negative-offset behaviour.** This is a
   departure from V4 and I am making it deliberately, on the same ground as
   Q-015 and Q-026: a date that silently differs by one day depending on who
   opened the browser is not behaviour worth preserving. Add it to D-006's
   list of recorded departures.
4. **Raise it against V4 as a live defect, not just a port note.** Any US user
   running V4 today gets dates one day early. If anyone has run an accounting
   period from a US browser, those journal dates are wrong. Worth checking who
   has, before the question of restating comes up.
5. `addMonths` month-end overflow is a second defect in the same helper block
   and should be listed with it.

The related questions (Q-034 `computeEIR` wall clock, Q-044 amortisation
profile shift, Q-070 forecast ladder, Q-089 reversing-entry date, Q-108 feed
date arithmetic) are all **the same root cause** and should be one fix, not
six. Q-089's observation that "V4 users in UTC-negative zones saw the
same-day date" is this defect seen from the journal side; it confirms the
finding independently.

---

## Part B · Confirm/reject on the delegated answers (Q-010..Q-123)

### How I reviewed this, and what that is worth

Be clear about the limits. There are 114 of these. I did **not** re-run 114
probes. What I did:

- Read every question and answer.
- Checked the **policy frame** — whether the D-006 classification applied to
  each is the right one. That is the part that is actually my call.
- **Independently verified** the ones where I have first-hand knowledge from
  building or fixing the thing in question, and the ones where a wrong premise
  would change a decision. Those are called out individually below.
- Left the probe arithmetic unverified where I had no independent handle on
  it.

So: a confirmation below means *the classification is right and I found no
reason to doubt the premise*. It does not mean I re-derived the number.
Where I did verify, I say so.

**The work itself is good.** Specific line numbers, probes pinned to
`TZ=UTC`, reproducible figures, explicit "(not executed)" and "by reading"
markers where something was inferred rather than run, and figures withdrawn
when they did not reproduce (Q-041's 0.0905). That is the standard I would
want. My corrections below are narrow, and three of them are to my own work,
not to the analysis.

### The policy frame: **CONFIRMED**

D-006 as applied throughout — *calculation and posting output: replicate for
parity, fix as separate L3 stories; presentation, import/export and
persistence-that-loses-input: build correctly; security: never replicate* — is
right, and it is applied consistently across all 114. I confirm it as the
default and I am not relitigating it question by question.

The three deliberate departures (Q-015 silent `USD`, Q-026 allocations over
100%, and now Q-009 negative-offset dates) are each justified by D-006's own
wording. Confirmed as departures, with Q-009 added to the list.

### Corrections and upgrades

Six items need more than a plain confirm.

---

#### Q-012 · **REJECT the premise — I can describe #16, #18 and #39**

The answer says "No description exists in V4 … Because nobody can say what
they are, no parity test depends on them," and classifies them as
presentation by inference from where HANDOVER files them.

The conclusion is right. The premise is not. Those numbers are **my task
tracker's numbering**, which is why no code comment matches them — they were
never meant to be found in the source. The mapping is:

| # | What it is | State |
|---|---|---|
| **16** | Carrying value + Unaccreted columns on the Cashflow tab | Partly superseded. `Gross`/`Net carrying amount` shipped (my #55) and `Unaccreted` exists as `carrying_vs_balance` in `cashflow_column_config`. What remains is narrower than the title suggests. |
| **18** | Remove the duplicate tranche-level PIK checkbox | Partly superseded. The underlying two-places overlap was resolved (my #17); the leftover is the redundant control still on screen. |
| **39** | Period-by-period ECL table inside the ECL Calculation Trace panel | Still open. Partly addressed by the per-row ECL derivation added 2026-10-16 (my #81), which gives the arithmetic for one row; the period-by-period table does not exist. |

All three are **presentation**, so the delegated classification holds and
nothing downstream changes. But Q-012 can be **closed**, not carried as an
unknown, and the feature miner can attach each to its feature now rather than
waiting for one to surface.

I should have put these descriptions in HANDOVER §11 instead of bare numbers.
That is a documentation failure on my side and it cost someone a question.

---

#### Q-004 (in Part B's scope via the 2026-10-17 note) · **CONFIRMED** — see Part A

The holiday allow-list finding recorded on 2026-10-17 is verified and correct.
The proposed handling (persist the user's choice, F-BUILDER-006 /
F-BUILDER-033) is right. Added above: fix it in V4 **before** P2 golden files
are cut, because V4 is the oracle and it is currently encoding the wrong
schedule for three calendars.

---

#### Q-037 · **CONFIRM WITH A CAVEAT — re-check the premise against the pin**

The answer is fine. But the detail cites the builder's save vocabulary and
aliasing (`#L13869-L13872`, `#L14397`) reading the column back raw (`#L15150`),
and that area was **changed**: the `eir_method` save/validator vocabulary
mismatch was a defect I fixed (my #12, *"eir_method could never be saved — UI
vocabulary vs validator vocabulary"*). Depending on which commit the pin sits
on, the premise may describe the pre-fix state.

Not a rejection — the routing conclusion (any unrecognised method including
`'default'` falls through to method 2) is about `computeEIRUSGAAP()`, which I
did not touch. But **whoever owns the pin should confirm which side of #12 it
is on** before this becomes a golden file. Same caution for Q-011, which sits
near work from my #59 (SOFR/ESTR/BBSW ignoring fixings).

---

#### Q-088, Q-090, Q-093(a), Q-097(a) · **CONFIRMED individually — and they are one finding, not four**

All four touch whether a journal batch balances. Taken together they are more
significant than any one of them:

- **Q-088**: a negative hedge effective portion throws `ReferenceError` and the
  caller gets **no journals at all** — not a wrong batch, no batch.
- **Q-090**: a de-designation with auto-reversal on leaves the run **out of
  balance by the reclass amount** (DR 2,044,320.95 against CR 1,987,160.48).
- **Q-093(a)**: the write-off posts allowance-used, residual and the full asset
  credit without checking the first two sum to the third.
- **Q-097(a)**: `generateDIU` performs no debit-equals-credit check.

**I started to write that nothing validates this, and that is wrong.** I
checked, and the control does exist:

- `postJEsToInvestran` has a pre-flight check — *"every jeIndex group must net
  to zero"* (`#L19035-L19044`) — and shows the result in the totals line
  (`#L19092`): `✗ N unbalanced`.
- `saveAccountingRun` computes `balanced` and **persists it** on
  `accounting_runs.balanced` (`#L10215-L10237`).
- The test harness asserts `balanced` on E1–E5 and others
  (`tests/engine-harness.js#L62`).

So Q-097(a) is accurate about the **engine**, and the builder does catch it.
Q-090's out-of-balance batch **would** show `✗ 1 unbalanced` on screen.

What is actually wrong is narrower and worth stating precisely:

1. **The simulated DIU pipeline contradicts the check it just ran.** The
   validate step's detail string is
   `` `✓ All ${jeCount} JEs balance · ✓ Accounts mapped · …` `` (`#L19099`) —
   a hardcoded success, emitted regardless of `unbalanced.length`. The totals
   line says `✗ 1 unbalanced` and the pipeline below it narrates
   `✓ All 12 JEs balance` and proceeds to "commit". This is the mock/demo
   path, not a real push, so today it is a cosmetic lie rather than a control
   failure — but it is exactly the wrong thing to carry into a real
   integration, and it is the thing I would fix first of the four.
2. **The harness asserts balance on E1–E5, which do not include a
   de-designated hedge.** That is why Q-090 was never caught. A balance
   assertion on every fixture, not five, is cheap and would have caught it.
3. The engine not self-checking is defensible — it is the builder's job — as
   long as (1) and (2) hold.

**Decisions.** Replicate all four for parity, as proposed — confirmed. But
treat them as **one cross-cutting item**, not four unrelated L3 stories, and
raise the priority of Q-088 above the rest: losing the entire batch to a
`ReferenceError` on any falling hedge value with a non-zero effectiveness
ratio is a crash, not a mis-posting. Add a `balanced` assertion to every
harness fixture now; it is a one-line change to the existing helper and it
protects the P2 goldens.

---

#### Q-042 + Q-005 · **CONFIRMED, with context the answer could not have**

Q-042 (in-code `HOLIDAY_CALENDARS` fallback has gaps: no US holidays 2021-23,
only 1 January for 2027-31, UK and TARGET 2024-26 only) is correct, and the
proposed handling — port the fallback verbatim, pass an immutable snapshot per
run — is right. Confirmed.

Context: since 2026-10-14 calendars come from the **database**, and the
in-code fallback only applies when the database is unreachable. So its gaps
are much less likely to be hit than they look. But that cuts both ways: a
deal that silently falls back now gets *worse* coverage than the 2035 cliff in
Q-005, with no warning either. The coverage warning I ask for in Q-005 should
cover the fallback path too — one check, both sources.

---

#### Q-101, Q-110, Q-016, Q-021, Q-023, Q-031, Q-006 · **not mine to confirm**

These are addressed to User / product owner / security approver, not to me.
Q-016 in particular (who may write funds, and the C18-C20 security minors)
needs a **named human approval** on D-008; my confirming it would not be that,
and the answer says so itself. I have no objection to any of them on technical
grounds — the funds default (shared reference data, soft delete, creator may
edit only while unallocated) matches how the V4 UI already behaves — but they
need their own sign-off and should not be closed on my say-so.

---

### Everything else: **CONFIRMED**

The remaining ~100 (Q-010, Q-011, Q-013..Q-015, Q-017..Q-020, Q-022,
Q-024..Q-036, Q-038..Q-041, Q-043..Q-087, Q-089, Q-091..Q-100, Q-102..Q-109,
Q-111..Q-123) are confirmed as answered, on the basis set out above:
the D-006 classification is right in each case and I found no premise I had
reason to doubt.

Three I want to single out as *correct and well judged*, because they were the
easiest to get wrong:

- **Q-035** (which EIR is authoritative) — yes. `computeEIR()` is a display
  helper and should be labelled indicative; **every figure that feeds
  accounting uses the schedule's solved EIR**. That is what I built and the
  answer states it exactly.
- **Q-067** (sum order is the parity contract) — correct and easy to miss. A
  left fold from 0 in window order is not an implementation detail; reordering
  or parallelising it changes results. Do not let anyone "optimise" it.
- **Q-007** (replicate or fix, closed) — the split by *where the defect lives*
  rather than by severity is the right axis, and it is applied consistently.

---

## What I would do first

Ordered by cost of leaving it alone, not by effort:

1. **Q-004 allow-list, in V4.** Three holiday calendars have never saved. Fix
   before P2 golden files are cut, or the port inherits a no-holiday schedule
   as its definition of correct.
2. **Q-009.** Confirm nobody has run an accounting period from a US browser.
   If they have, those journal dates are a day early and it is a restatement
   question, not a port question.
3. **Q-088 + harness balance assertion.** A crash that loses the whole batch,
   and a five-fixture control that should be universal. Both small.
4. **Q-001 grants.** Five lines; unblocks every future restore.
5. **Q-002 file split, Q-003 commit the markdown sources.** Housekeeping, but
   both are currently costing other people time.
6. **Q-005 calendar extension + coverage warning.** Not urgent; the warning
   matters more than the dates.

Q-012 needs nothing — it is closed by the table above.

---

## Provenance

| Step | Actor | Date | Result |
|------|-------|------|--------|
| answer | Ferhat Ansari (V4 author) | 2026-10-18 | Q-001..Q-005, Q-009 answered from the V4 source and the live database; Q-004 FK question answered definitively; Q-009 reproduced across six time zones |
| review | Ferhat Ansari (V4 author) | 2026-10-18 | Q-010..Q-123 confirm/reject pass: policy frame confirmed; Q-012 premise rejected and closed; Q-037 premise flagged against the pin; Q-088/Q-090/Q-093/Q-097 consolidated into one finding with the balance-control correction; Q-042 linked to Q-005; questions addressed to User/security left unconfirmed |
