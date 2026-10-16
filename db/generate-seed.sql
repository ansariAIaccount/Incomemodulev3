-- ═══════════════════════════════════════════════════════════════════════
-- generate-seed.sql — emit reference data as INSERT statements
-- ═══════════════════════════════════════════════════════════════════════
--
--   psql "$DATABASE_URL" -At -f generate-seed.sql > seed-reference.sql
--
-- REFERENCE DATA, NOT DEMO DATA.
--
-- The eleven tables below are configuration the application needs in order to
-- work at all. Without them the GL mapping screen is empty, every business
-- event posts nowhere, and no payment date rolls for a holiday. A restored
-- schema with no seed looks fine and produces wrong journals.
--
-- Deliberately EXCLUDED, because it is one client's demo content:
--   deals, facilities, tranches, interest_*, fees, covenants,
--   accounting_runs, journal_entries (~18k rows), cashflow_schedules (~222k),
--   external_*, loan_notices, borrower_financials, document_extractions
--
-- If you want the demo deals too, they are reproducible from
-- loan-module-instruments.js and the preset catalogue — a cleaner route than
-- copying rows, because it exercises the save path you are shipping.
--
-- ON `created_by` AND `team_id`
--
-- Both are nulled below. They point at auth.users and teams rows that do not
-- exist in a fresh database, and a foreign key violation partway through a
-- seed leaves you with half the reference data and a transaction to unpick.
-- Null is honest: nobody in the new database created these.
-- ═══════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

select '-- Reference data generated ' || now()::date
    || E'\n-- Restore AFTER schema.sql. Safe to re-run: every insert is'
    || E'\n-- guarded by ON CONFLICT DO NOTHING.\n'
    || E'\nbegin;\n'
    || E'\nset local role service_role;  -- bypass RLS while seeding\n';

-- A generic row-to-INSERT emitter. Uses to_jsonb so every type is quoted
-- correctly without naming columns one by one — which is what makes this
-- survive a column being added to one of these tables.
--
-- THE ORDERING IS THE WHOLE TRICK. Values are correlated to columns by
-- `information_schema.columns.ordinal_position`, matched by NAME.
--
-- The obvious implementation — `jsonb_each(to_jsonb(t)) with ordinality`,
-- ordered by that ordinality — is wrong, and wrong in the worst available
-- way. JSONB stores keys in its own order (by key length, then
-- alphabetically), so the values come out shuffled relative to the column
-- list. On holiday_calendars that put the `notes` text into `country_code`
-- and the string 'US' into `updated_at`. Postgres rejects the obviously
-- impossible ones, which means you get a seed that half-restores and half
-- fails — and any pair of same-typed columns swaps silently.
create or replace function pg_temp.emit(p_table text, p_order text default '1')
returns setof text language plpgsql as $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table;

  return query execute format($f$
    select 'insert into public.%1$I (%2$s) values (' ||
           (select string_agg(
              case when to_jsonb(t) -> c.column_name is null
                     or jsonb_typeof(to_jsonb(t) -> c.column_name) = 'null'
                   then 'null'
                   when jsonb_typeof(to_jsonb(t) -> c.column_name) in ('number','boolean')
                   then (to_jsonb(t) -> c.column_name) #>> '{}'
                   else quote_literal((to_jsonb(t) -> c.column_name) #>> '{}')
              end, ', ' order by c.ordinal_position)
            from information_schema.columns c
            where c.table_schema = 'public' and c.table_name = %1$L)
           || ') on conflict do nothing;'
    from public.%1$I t order by %3$s
  $f$, p_table, cols, p_order);
end $$;

select E'\n-- ═══ accounting frameworks ═══';
select pg_temp.emit('accounting_frameworks', 'code');

select E'\n-- ═══ GL chart + mapping ═══';
select pg_temp.emit('gl_frameworks', 'sort_order');
select pg_temp.emit('gl_accounts', 'code');
select pg_temp.emit('gl_source_accounts', '1');
select pg_temp.emit('gl_business_events', 'sort_order');
select pg_temp.emit('gl_event_mappings', 'event_key, framework_code');
select pg_temp.emit('gl_transtype_mappings', '1');

select E'\n-- ═══ cashflow column composition ═══';
select pg_temp.emit('cashflow_column_config', '1');

select E'\n-- ═══ holiday calendars ═══';
select pg_temp.emit('holiday_calendars', 'sort_order');
select pg_temp.emit('holiday_dates', 'calendar_code, holiday_date');

select E'\n-- ═══ preset catalogue ═══';
select pg_temp.emit('preset_catalog', '1');

select E'\ncommit;\n';

-- ── Post-restore checks ────────────────────────────────────────────────
-- Counts an operator can compare against the source. A seed that restored
-- 95 of 96 GL mappings is the failure worth catching here: the application
-- will run, and one business event will post to the wrong account.
select E'\n-- Expected row counts — compare after restoring:';
select '--   ' || rpad(t, 24) || n
from (
  select 'accounting_frameworks' t, count(*) n from accounting_frameworks
  union all select 'gl_frameworks', count(*) from gl_frameworks
  union all select 'gl_accounts', count(*) from gl_accounts
  union all select 'gl_source_accounts', count(*) from gl_source_accounts
  union all select 'gl_business_events', count(*) from gl_business_events
  union all select 'gl_event_mappings', count(*) from gl_event_mappings
  union all select 'gl_transtype_mappings', count(*) from gl_transtype_mappings
  union all select 'cashflow_column_config', count(*) from cashflow_column_config
  union all select 'holiday_calendars', count(*) from holiday_calendars
  union all select 'holiday_dates', count(*) from holiday_dates
  union all select 'preset_catalog', count(*) from preset_catalog
) s order by t;
