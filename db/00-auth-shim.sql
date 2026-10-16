-- ═══════════════════════════════════════════════════════════════════════
-- 00-auth-shim.sql — run this FIRST, before schema.sql
-- ═══════════════════════════════════════════════════════════════════════
--
-- Replaces Supabase's auth system with a local one, so the schema restores
-- onto any PostgreSQL 15+ instance with no Supabase involvement.
--
-- WHAT THE SCHEMA DEPENDS ON
--
--   73 foreign keys  →  auth.users(id)
--   34 RLS policies  →  auth.uid()
--    3 roles          →  anon, authenticated, service_role
--
-- A DELIBERATE NAMING DECISION, PLEASE READ
--
-- This creates a real local `auth.users` TABLE rather than renaming it to
-- `public.users`. The brief was "port to a local users table" and this is
-- that table — it is ordinary Postgres, owned by you, with no Supabase
-- anywhere. Only the NAME is kept.
--
-- Keeping the name matters because the alternative is rewriting 73 foreign
-- key definitions and the bodies of 34 security policies. Every one of those
-- rewrites is a chance to get an access rule subtly wrong, and a wrong RLS
-- policy does not fail loudly — it exposes data. The schema is already under
-- review for demo-era policies that are too permissive (see README §4); this
-- is not the moment to also retype every policy by hand.
--
-- If you later want `public.users` instead, do it as its own change, with the
-- policy rewrite reviewed line by line against the originals in schema.sql.
--
-- WHAT THIS DOES NOT GIVE YOU
--
-- Authentication. There is no password handling, no JWT issuing, no email
-- verification, no session management. This is the DATA MODEL that the
-- schema's constraints and policies need. Your application must authenticate
-- the user by whatever means you choose and then tell the database who it is
-- (§3 below). Until it does, auth.uid() returns NULL and every owner-scoped
-- policy denies — which is the correct direction to fail.
-- ═══════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

begin;

-- ── 1 · Extensions ─────────────────────────────────────────────────────
-- gen_random_uuid() is a column default across the schema. On PG13+ it is
-- built in via pgcrypto; create it explicitly so this works on 13 and 14 too.
create extension if not exists pgcrypto;

-- ── 2 · Roles ──────────────────────────────────────────────────────────
-- The policies name these roles in their TO clause. They must exist before
-- schema.sql runs or every CREATE POLICY fails.
--
-- NOLOGIN on all three: they are permission sets your application connects
-- AS (via SET ROLE), not accounts anyone signs in to.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- BYPASSRLS: this role sees everything. Use it for migrations and
    -- back-office jobs. Never from anything a browser can reach.
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- ── 3 · The auth schema ────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- The users table. Only `id` is referenced by the 73 foreign keys — verified
-- against the source database, not assumed — so the rest of these columns are
-- for your convenience and can be changed freely.
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  display_name  text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table auth.users is
  'Local replacement for Supabase auth.users. Only id is referenced by the application schema. Authentication happens in the application; this table records who exists.';

-- ── 4 · auth.uid() ─────────────────────────────────────────────────────
-- The identity of the current request, read from a session setting rather
-- than a JWT.
--
-- `true` as the second argument to current_setting means "return NULL if
-- unset" instead of raising. That is load-bearing: without it, every query on
-- a connection that has not set the user would ERROR rather than simply
-- returning no rows, and a background job would look broken rather than
-- unprivileged.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

comment on function auth.uid() is
  'Current user id for RLS. Set per connection with: select set_config(''app.current_user_id'', ''<uuid>'', false);';

-- Supabase also exposes auth.role(). Nothing in this schema's policies calls
-- it today, but application code or a future policy might.
create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.current_role', true), ''), 'anon');
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- ── 5 · handle_new_user ────────────────────────────────────────────────
-- The source database has a public.handle_new_user() trigger fired by inserts
-- into auth.users, which seeds public.user_profiles. The trigger lives in the
-- auth schema, so generate-schema.sql does NOT capture it — it only reads
-- public. Recreated here.
--
-- Without this, a new user has no profile row, and in_team() / is_admin()
-- both read user_profiles. The user would authenticate successfully and then
-- be unable to see anything, with nothing explaining why.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'handle_new_user')
  then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  else
    raise notice 'public.handle_new_user() not found — run this AFTER schema.sql, or create the trigger by hand.';
  end if;
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- USING IT
--
-- Per connection, after you have authenticated the user yourself:
--
--   select set_config('app.current_user_id', '<the user uuid>', false);
--   set role authenticated;
--
-- For a migration or an admin job:
--
--   set role service_role;        -- bypasses RLS entirely
--
-- To confirm the shim works, after restoring schema.sql:
--
--   insert into auth.users (email, display_name)
--   values ('dev@example.com', 'Dev') returning id;
--
--   select set_config('app.current_user_id', '<that id>', false);
--   set role authenticated;
--   select auth.uid();            -- must return the id, not null
--   select count(*) from public.deals;   -- RLS now applies
--
-- If auth.uid() returns NULL after set_config, the setting name does not
-- match the one in the function — check for a typo before suspecting RLS.
-- ═══════════════════════════════════════════════════════════════════════
