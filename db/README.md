# Database — rebuild kit

**For standing the schema up on a PostgreSQL instance you control, with no
Supabase.**

Before this existed there was no route to a schema at all: zero `.sql` files
in the repo, no `supabase/migrations/` directory, and all 112 migrations
living only inside the hosted project's `supabase_migrations` table. Losing
access to that project meant losing the schema.

---

## What is here

| File | What it is |
|---|---|
| `00-auth-shim.sql` | **Run first.** Local `auth.users` + `auth.uid()` + the three roles |
| `schema.sql` | **Complete.** 195 kB — every object in `public`, verified against the source |
| `seed-reference.sql` | **Complete.** 143 kB — the ten reference tables, 865 rows |
| `generate-schema.sql` | Reads `pg_catalog`, re-emits `schema.sql` |
| `generate-seed.sql` | Re-emits `seed-reference.sql` |
| `verify-schema.py` | Proves `schema.sql` matches the database, column by column |
| `verify-seed.py` | Lints `seed-reference.sql` with no database needed |
| `verify-presets.py` | Hashes the 17 preset JSON documents against the database |

Both `.sql` files are checked in and current as at **16 October 2026**. Restore
them directly; the generators are for regenerating and **diffing** when the
schema changes, which a one-off dump cannot do.

### What is in `schema.sql`

Every count below was checked against the live database, not assumed:

| | |
|---|---|
| Extensions | 4 (the two Supabase-only ones commented, with the reason) |
| Enum types | 57 |
| Functions | 28 |
| Sequences | 3 explicit (the rest come from identity/serial defaults) |
| Tables | **80** |
| Primary keys | 80 |
| Unique constraints | 45 |
| Check constraints | 49 |
| Foreign keys | 139 |
| Indexes | 119 `create index` statements (244 total incl. constraint-backed) |
| Views | 7 |
| Triggers | 24 (23 row triggers + 1 deferrable constraint trigger) |
| RLS enabled | 80 / 80 tables |
| Policies | 236 |

### Verifying it

Two different questions, two different checks. Run both.

**Does the schema match the source, column for column?**

```bash
psql "$SRC" -At -c "
  select nm || ' ' || h from (
    select c.relname nm,
           md5(string_agg(a.attname||'|'||format_type(a.atttypid,a.atttypmod)
               ||'|'||coalesce(pg_get_expr(ad.adbin,ad.adrelid),'-')
               ||'|'||a.attnotnull::text, ',' order by a.attnum)) h
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    left join pg_attrdef ad on ad.adrelid=c.oid and ad.adnum=a.attnum
    where c.relkind='r' group by c.relname) x order by nm" > /tmp/db.fp
python3 verify-schema.py schema.sql /tmp/db.fp
#   80/80 tables match
```

This is the check that matters, and `psql -v ON_ERROR_STOP=1` is not a
substitute. That proves a file *parses*. A column declared `numeric(20,2)`
where the source has `numeric(20,4)` parses perfectly, restores perfectly, and
silently rounds money differently for the rest of the system's life. The
fingerprint covers every column's name, type with precision, default
expression and NOT NULL, on all 80 tables.

**Is the seed well-formed, and is its JSON intact?**

```bash
python3 verify-seed.py seed-reference.sql
#   13 statements, 865 rows, every row's value count matches its column list

psql "$SRC" -At -c "select preset_key || ' ' || md5(build_definition::text)
                      from preset_catalog" > /tmp/preset.fp
python3 verify-presets.py seed-reference.sql /tmp/preset.fp
#   17/17 presets match the database
```

`verify-seed.py` needs no database — it is a string-aware SQL scanner, so it
catches the errors a seed file actually acquires: a dropped comma, a row with
one value too few, a quote that closes early and swallows the rest of the
statement. `verify-presets.py` covers what that cannot: 37 kB of nested JSON
across 17 rows, where a moved brace is invisible to any syntax check.

---

## Rebuilding

```bash
export DST="postgresql://…"           # the new database

psql "$DST" -v ON_ERROR_STOP=1 -f 00-auth-shim.sql     # roles, auth.users, auth.uid()
psql "$DST" -v ON_ERROR_STOP=1 -f schema.sql           # everything in public
psql "$DST" -v ON_ERROR_STOP=1 -f seed-reference.sql   # GL mappings, calendars, …
```

That is the whole rebuild — three files, no generation step. Regenerate only
when the source schema has moved on:

```bash
export SRC="postgresql://…"           # the existing database
psql "$SRC" -At -f generate-schema.sql > schema.sql
psql "$SRC" -At -f generate-seed.sql   > seed-reference.sql
git diff                              # the point of keeping generators
```

**The order is not optional.** `schema.sql` creates 73 foreign keys pointing
at `auth.users` and 236 policies naming the `anon` / `authenticated` /
`service_role` roles. If the shim has not run, the first of those fails and
you are left with a partial schema.

### Then point the application at it

`loan-module-v4-builder.html` → Settings → Database, or the browser console:

```js
localStorage.setItem('pcs_supabase_url', 'https://your-host');
localStorage.setItem('pcs_supabase_key', 'your-key');
```

The app speaks **PostgREST**, not raw Postgres. A plain Postgres instance will
not serve it — you need PostgREST (or Supabase self-hosted) in front. That is
a deployment decision this kit does not make for you; see HANDOVER §2.

---

## Verify by restoring

A DDL script that has never been restored is a hypothesis. Ten minutes:

```bash
createdb pcs_verify
psql pcs_verify -f 00-auth-shim.sql
psql pcs_verify -v ON_ERROR_STOP=1 -f schema.sql     # must exit 0
psql pcs_verify -v ON_ERROR_STOP=1 -f seed-reference.sql
```

Then compare against the source — equality is the test, not "it ran":

```sql
select
 (select count(*) from information_schema.tables
   where table_schema='public' and table_type='BASE TABLE')          as tables,
 (select count(*) from information_schema.views where table_schema='public') as views,
 (select count(distinct t.typname) from pg_type t
    join pg_enum e on e.enumtypid=t.oid
    join pg_namespace n on n.oid=t.typnamespace where n.nspname='public') as enums,
 (select count(*) from pg_policies where schemaname='public')        as policies,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public')                                         as functions,
 (select count(*) from pg_indexes where schemaname='public')         as indexes,
 (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace
   where n.nspname='public' and c.contype='f')                       as fkeys;
```

Source, as at 16 October 2026:

| | |
|---|---|
| tables | **80** |
| views | **7** |
| enums | **57** |
| policies | **236** |
| functions | **28** |
| indexes | **244** |
| foreign keys | **139** |

Reference row counts are printed at the end of `seed-reference.sql`. A seed
that restored 95 of 96 `gl_event_mappings` is the failure worth catching: the
application runs, and one business event posts to the wrong account.

Finally, confirm RLS actually engages:

```sql
insert into auth.users (email) values ('dev@example.com') returning id;
select set_config('app.current_user_id', '<that id>', false);
set role authenticated;
select auth.uid();                    -- the id, not null
select count(*) from public.deals;    -- RLS applies
reset role;
```

---

## Three things to decide before production

### 1 · Authentication

The shim gives you the data model, not authentication. No passwords, no JWTs,
no sessions. Your application authenticates however you choose and then tells
the database who the user is:

```sql
select set_config('app.current_user_id', '<uuid>', false);
set role authenticated;
```

Until it does, `auth.uid()` returns NULL and owner-scoped policies deny
everything — the correct direction to fail, but it will look like the
application is broken if nobody has read this paragraph.

### 2 · The demo-era policies

Some policies grant the `anon` role broad access, left over from when this was
a demo. The clearest example:

```sql
create policy v3_demo_anon_delete_user_deals on public.deals
  as permissive for delete to anon
  using ((is_preset = false));
```

**Anyone holding the publishable key can delete any non-preset deal.** That is
fine for a demo and unacceptable in production. Audit every policy granting
`anon` before you expose a key anywhere:

```sql
select tablename, policyname, cmd, qual
from pg_policies
where schemaname='public' and 'anon' = any(roles)
order by tablename;
```

### 3 · Why `auth.users` kept its name

The brief was to port to a local users table, and this is one — ordinary
Postgres, owned by you, no Supabase. Only the *name* is retained.

That is deliberate. Renaming to `public.users` means rewriting 73 foreign key
definitions and the bodies of 34 security policies. Every rewrite is a chance
to get an access rule subtly wrong, and a wrong RLS policy does not fail
loudly — it exposes data. Given the schema already needs a policy audit
(§2 above), adding a hand-retyping pass was the wrong order of operations.

If you still want `public.users`, do it as its own reviewed change, diffing
each new policy against the original in `schema.sql`.

---

## Latent issues found while building this

None of these was known before. Each is a defect in the application, not in
this kit, and each is reproduced faithfully in `schema.sql` /
`seed-reference.sql` rather than quietly corrected — a rebuild kit that
disagrees with the system it rebuilds is worse than one that is honestly
broken. All are logged as tasks.

**1 · The Australian presets cannot be materialised — two independent
reasons.** `materialize_preset()` does `COALESCE(…, 'none')::holiday_calendar`
when inserting `facilities.holiday_calendar`, which became `text` with an FK
on 2026-10-14. The cast fails for any calendar added since, so a preset
specifying `nlNational` or `luNational` cannot be materialised. Separately,
all five `-au` presets still carry `"holiday": "auFederal"` in their
`build_definition`, and `auFederal` no longer exists in `holiday_calendars`,
so the foreign key rejects them before the cast is even reached. Fixes: change
`::holiday_calendar` to `::text` in the function, and `jsonb_set` the five
presets to `auNational`. Standing check, which should return no rows:

```sql
select preset_key from preset_catalog
 where (build_definition #>> '{facility,holiday}')
       not in (select code from holiday_calendars);
```

**2 · The holiday calendars run out at 2035-12-26.** 611 rows, 2024–2035,
six calendars. Nine deals mature after that — latest **2063-03-01**. Beyond
the last date every payment date rolls for weekends only, and nothing says so:
the engine warns once per *unknown calendar code*, and these codes exist, they
simply have no dates in range. Extend the table before trusting a schedule
past 2035.

**3 · The auth shim needs more than `id`.** Three functions read columns a
minimal `auth.users` would not have: `handle_new_user()` and
`list_all_users()` both read `raw_user_meta_data`, and `list_all_users()` also
reads `deleted_at`. Omitting either produces a user who authenticates and then
sees nothing, with no error explaining it. `00-auth-shim.sql` now includes both.

**4 · `forbearance` maps 113000 → 113000 in all four frameworks.** Debit and
credit are the same account, so the journal nets to nothing. This is a
deliberate placeholder — forbearance changes the schedule and the accounting
consequence is picked up by the re-accretion — not a copy error. Left as is,
but do not "fix" it by guessing a second account.

**5 · Two GL accounts are classified oddly.** `23000 Interest Income Accrued`
is `account_class` *Income* although its name and use (accrued interest
receivable) are an asset; `40110 EIR Fee Accretion Offset` is *Asset* under a
4xxxx income code. Both are editable from the GL Mapping screen, so this is a
data change, not a schema change.

**6 · The seed emitter had two bugs of my own**, both fixed, recorded under
*Status* because they are the kind that survive review.

## What the generators do not capture

Known and deliberate. `supabase db dump` captures some of these; nothing
captures all of them.

- **Grants and role membership** beyond what the shim creates
- **Comments** on tables and columns
- **Sequence ownership** beyond what serial/identity defaults imply
- **Anything outside `public`** — including `public.handle_new_user()`'s
  trigger, which fires on `auth.users` and so lives in the `auth` schema.
  The shim recreates it; `generate-schema.sql` never sees it.
- **Row data** apart from the ten reference tables. The excluded tables are
  one client's demo content: `deals`, `facilities`, `tranches`, `interest_*`,
  `fees`, `covenants`, `accounting_runs`, `journal_entries` (~18k rows),
  `cashflow_schedules` (~222k), `external_*`, `loan_notices`,
  `borrower_financials`, `document_extractions`. The demo deals are
  reproducible from `loan-module-instruments.js` and `preset_catalog`, which
  is a cleaner route than copying rows because it exercises the save path you
  are shipping.
- **`gl_source_accounts`**, which is a *view* over `journal_entries`, not a
  table. An earlier `generate-seed.sql` emitted it; `insert into` a view fails
  outright, which at least fails loudly. Now excluded.
- **Supabase platform config** — Storage, Realtime, Edge Functions, the API
  gateway. None are used by this application.

If you have Supabase project credentials, `supabase db dump` remains the
authoritative route and is worth running once to diff against `schema.sql`.

---

## Status

**What is proven.** Both files are complete and content-verified against the
live database:

- `schema.sql` — **80/80 tables** match on every column's name, type with
  precision, default and NOT NULL (`verify-schema.py`). Object counts for
  enums, functions, constraints, FKs, indexes, views, triggers and all 236
  policies were each read from `pg_catalog`, not assumed.
- `seed-reference.sql` — **865 rows** across 10 tables, every row's value
  count matching its column list (`verify-seed.py`), and **17/17** preset JSON
  documents md5-identical to the database (`verify-presets.py`).

**What is not proven.** Neither file has been *restored*. That needs a
Postgres instance and a direct connection, which this environment does not
have: there is no `psql` and no DNS route to the database host, which is why
the files were relayed statement by statement through the Supabase API rather
than dumped. A DDL script that has never been restored is a hypothesis — the
ten-minute procedure is under *Verify by restoring* above, and it is the one
step left.

Three bugs found and fixed while building this, recorded because each is the
kind that survives review:

**1 · The seed emitter mis-aligned columns.** It originally ordered values by
`jsonb_each … with ordinality`, which is JSONB's internal key order (by key
length, then alphabetically) rather than column order. On `holiday_calendars`
that put `notes` into `country_code` and `'US'` into `updated_at`. Postgres
rejects the impossible combinations, so it would have half-restored — and any
two columns of the same type would have swapped in silence. Now correlated on
`information_schema.columns.ordinal_position`.

**2 · The seed emitter never nulled `created_by`.** The file's own header
promised it did. Those columns point at `auth.users` rows that do not exist in
a fresh database, so the seed would have failed partway through on a foreign
key. `pg_temp.emit` now takes a `p_null` argument covering `created_by`,
`updated_by`, `team_id` and `last_sync_by`, and raises if asked to emit an
object with no columns — which is how the `gl_source_accounts` view was caught.

**3 · `verify-presets.py` reported a false failure.** Its row regex was
matched against the whole file, and `holiday_calendars` has a row beginning
`('<uuid>', 'none', …`. A non-greedy `.*?` ran from there into the first
preset's JSON, filing it under the key `none` and leaving `atlas-syndicated`
looking absent — 16/17 on a file that was entirely correct. It now isolates
the `preset_catalog` statement before matching rows. Worth stating plainly: a
verifier that cries wolf is as dangerous as no verifier, because the next
mismatch gets waved through.
