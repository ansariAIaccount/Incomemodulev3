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
| `generate-schema.sql` | Reads `pg_catalog`, emits portable DDL |
| `generate-seed.sql` | Emits the eleven reference tables as guarded INSERTs |
| `schema.sql` | Generated output — regenerate rather than hand-edit |
| `seed-reference.sql` | Generated output — same |

Generators rather than a one-off dump, so the schema can be regenerated and
**diffed** when it changes. A checked-in dump is accurate for one day.

---

## Rebuilding

```bash
export SRC="postgresql://…"      # the existing database
export DST="postgresql://…"      # the new one

# 1 · Generate (skip if schema.sql / seed-reference.sql are current)
psql "$SRC" -At -f generate-schema.sql > schema.sql
psql "$SRC" -At -f generate-seed.sql   > seed-reference.sql

# 2 · Restore, in this order
psql "$DST" -f 00-auth-shim.sql       # roles + auth.users + auth.uid()
psql "$DST" -f schema.sql             # tables, constraints, RLS, policies
psql "$DST" -f seed-reference.sql     # GL mappings, holiday calendars, …
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

## What the generators do not capture

Known and deliberate. `supabase db dump` captures some of these; nothing
captures all of them.

- **Grants and role membership** beyond what the shim creates
- **Comments** on tables and columns
- **Sequence ownership** beyond what serial/identity defaults imply
- **Anything outside `public`** — including `public.handle_new_user()`'s
  trigger, which fires on `auth.users` and so lives in the `auth` schema.
  The shim recreates it; `generate-schema.sql` never sees it.
- **Row data** apart from the eleven reference tables
- **Supabase platform config** — Storage, Realtime, Edge Functions, the API
  gateway. None are used by this application.

If you have Supabase project credentials, `supabase db dump` remains the
authoritative route and is worth running once to diff against `schema.sql`.

---

## Status

The generators have been **tested against the live database** query by query:
enum, table, constraint, index, policy and seed emitters all produce valid
SQL, verified on real tables.

**The full generate-and-restore cycle has not been run end to end**, because
that needs a Postgres instance and direct connection credentials, which this
environment does not have. That is the one step left, it is the step that
turns this from a hypothesis into a tested artefact, and it is written up
under *Verify by restoring* above.

One bug found and fixed during testing, recorded because it is the kind that
would have survived review: the seed emitter originally ordered values by
`jsonb_each … with ordinality`, which is JSONB's internal key order rather
than column order. It inserted `notes` into `country_code` and a country code
into `updated_at`. Postgres rejects the impossible combinations, so it would
have half-restored — and any two columns of the same type would have swapped
in silence.
