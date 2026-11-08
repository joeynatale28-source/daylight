-- CalDAV accounts: corrective migration. Safe to run any number of times.
--
-- WHY THIS EXISTS
--   20261120_caldav_accounts.sql uses CREATE TABLE IF NOT EXISTS. If caldav_accounts already existed
--   (for example from an earlier experiment), that statement silently skipped EVERYTHING in it,
--   including the unique rule on (user_id, server_url, username). The caldav function saves accounts with
--   an upsert (INSERT ... ON CONFLICT (user_id, server_url, username)), and Postgres refuses an
--   ON CONFLICT target that has no matching unique rule (error 42P10: "there is no unique or exclusion
--   constraint matching the ON CONFLICT specification"). PostgREST returns that as HTTP 400, which is what
--   the logs showed. A missing column (PostgREST PGRST204) or a stray NOT NULL column (23502) also give 400,
--   so this file repairs those kinds of drift too.
--
-- WHAT IT DOES (every step is "add what's missing", never "assume a fresh database")
--   1. Creates both tables if they don't exist at all.
--   2. Adds every column the code expects if it's missing.
--   3. Drops NOT NULL from any extra column the code doesn't write (so inserts can't fail on it).
--   4. Removes duplicate rows that would block the unique rules (keeps the newest).
--   5. Adds the primary keys, the unique rules, and the calendars -> accounts foreign key if missing.
--   6. Re-applies row-level security and grants: accounts are service-role only; calendars are owner-read.
--   7. Reloads PostgREST's schema cache.
--   8. Prints a verification report (see the last query).

-- 1. Tables ---------------------------------------------------------------------------------------------
create table if not exists public.caldav_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  server_url     text not null,
  username       text not null,
  password       text not null,
  principal_url  text,
  home_url       text,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table if not exists public.caldav_calendars (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  href           text not null,
  name           text not null,
  color          text,
  read_only      boolean not null default false,
  ctag           text,
  sync_token     text,
  cached_events  jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2. Columns the code expects (no-ops when present) -----------------------------------------------------
alter table public.caldav_accounts
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists server_url text,
  add column if not exists username text,
  add column if not exists password text,
  add column if not exists principal_url text,
  add column if not exists home_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.caldav_calendars
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists account_id uuid,
  add column if not exists user_id uuid,
  add column if not exists href text,
  add column if not exists name text,
  add column if not exists color text,
  add column if not exists read_only boolean default false,
  add column if not exists ctag text,
  add column if not exists sync_token text,
  add column if not exists cached_events jsonb default '[]'::jsonb,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
update public.caldav_accounts  set id = gen_random_uuid() where id is null;
update public.caldav_calendars set id = gen_random_uuid() where id is null;
update public.caldav_calendars set read_only = false where read_only is null;
update public.caldav_calendars set cached_events = '[]'::jsonb where cached_events is null;
update public.caldav_accounts  set created_at = now() where created_at is null;
update public.caldav_accounts  set updated_at = now() where updated_at is null;

-- 3. Extra columns the code never writes must not be NOT NULL-without-default -----------------------------
do $$
declare r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name in ('caldav_accounts', 'caldav_calendars')
      and c.is_nullable = 'NO' and c.column_default is null and c.is_identity = 'NO'
      and c.column_name not in ('id','user_id','server_url','username','password','account_id','href','name')
  loop
    execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
  end loop;
end $$;

-- 4. Duplicates that would block the unique rules (keep the newest) ---------------------------------------
delete from public.caldav_accounts a using public.caldav_accounts b
 where a.user_id = b.user_id and a.server_url = b.server_url and a.username = b.username
   and (coalesce(a.updated_at, a.created_at, 'epoch'), a.id) < (coalesce(b.updated_at, b.created_at, 'epoch'), b.id);
delete from public.caldav_calendars a using public.caldav_calendars b
 where a.account_id = b.account_id and a.href = b.href
   and (coalesce(a.updated_at, a.created_at, 'epoch'), a.id) < (coalesce(b.updated_at, b.created_at, 'epoch'), b.id);
delete from public.caldav_calendars where account_id is null or account_id not in (select id from public.caldav_accounts);

-- 5. Keys and unique rules ---------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.caldav_accounts'::regclass and contype = 'p') then
    alter table public.caldav_accounts add constraint caldav_accounts_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.caldav_calendars'::regclass and contype = 'p') then
    alter table public.caldav_calendars add constraint caldav_calendars_pkey primary key (id);
  end if;

  -- The rule the upsert needs: a unique constraint or unique index on exactly (user_id, server_url, username).
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.caldav_accounts'::regclass and i.indisunique and i.indpred is null and i.indexprs is null
      and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a
            where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['server_url','user_id','username']
  ) then
    alter table public.caldav_accounts add constraint caldav_accounts_user_server_username_key unique (user_id, server_url, username);
  end if;

  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.caldav_calendars'::regclass and i.indisunique and i.indpred is null and i.indexprs is null
      and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a
            where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['account_id','href']
  ) then
    alter table public.caldav_calendars add constraint caldav_calendars_account_href_key unique (account_id, href);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.caldav_calendars'::regclass and contype = 'f'
                   and confrelid = 'public.caldav_accounts'::regclass) then
    alter table public.caldav_calendars add constraint caldav_calendars_account_id_fkey
      foreign key (account_id) references public.caldav_accounts(id) on delete cascade;
  end if;
end $$;
create index if not exists caldav_calendars_user_idx on public.caldav_calendars(user_id);
create index if not exists caldav_accounts_user_idx  on public.caldav_accounts(user_id);

-- 6. Row-level security and grants ---------------------------------------------------------------------------
alter table public.caldav_accounts  enable row level security;
alter table public.caldav_calendars enable row level security;
revoke all on public.caldav_accounts  from anon, authenticated;
revoke all on public.caldav_calendars from anon, authenticated;
grant all on public.caldav_accounts  to service_role;
grant all on public.caldav_calendars to service_role;
grant select on public.caldav_calendars to authenticated;
drop policy if exists caldav_calendars_owner_select on public.caldav_calendars;
create policy caldav_calendars_owner_select on public.caldav_calendars
  for select to authenticated using ((select auth.uid()) = user_id);
-- (no policy on caldav_accounts on purpose: the password never reaches the browser)

create or replace function public.caldav_touch_updated_at() returns trigger language plpgsql as $f$
begin new.updated_at = now(); return new; end $f$;
drop trigger if exists caldav_accounts_touch on public.caldav_accounts;
create trigger caldav_accounts_touch before update on public.caldav_accounts for each row execute function public.caldav_touch_updated_at();
drop trigger if exists caldav_calendars_touch on public.caldav_calendars;
create trigger caldav_calendars_touch before update on public.caldav_calendars for each row execute function public.caldav_touch_updated_at();

-- 7. Make PostgREST see the new columns and rules immediately -------------------------------------------------
notify pgrst, 'reload schema';

-- 8. Verification: every row should say "ok". (This query changes nothing.) -----------------------------------
select check_name, case when passed then 'ok' else 'MISSING' end as status from (
  select 'accounts: unique (user_id, server_url, username)' as check_name, exists (
    select 1 from pg_index i where i.indrelid = 'public.caldav_accounts'::regclass and i.indisunique
      and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['server_url','user_id','username']) as passed
  union all select 'calendars: unique (account_id, href)', exists (
    select 1 from pg_index i where i.indrelid = 'public.caldav_calendars'::regclass and i.indisunique
      and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['account_id','href'])
  union all select 'accounts: row-level security on', (select relrowsecurity from pg_class where oid = 'public.caldav_accounts'::regclass)
  union all select 'calendars: row-level security on', (select relrowsecurity from pg_class where oid = 'public.caldav_calendars'::regclass)
  union all select 'accounts: browser roles have no access', not has_table_privilege('authenticated', 'public.caldav_accounts', 'select') and not has_table_privilege('anon', 'public.caldav_accounts', 'select')
  union all select 'calendars: owner can read', has_table_privilege('authenticated', 'public.caldav_calendars', 'select')
  union all select 'accounts: service role can write', has_table_privilege('service_role', 'public.caldav_accounts', 'insert')
  union all select 'accounts: all expected columns', (select count(*) = 11 from information_schema.columns where table_schema = 'public' and table_name = 'caldav_accounts'
      and column_name in ('id','user_id','server_url','username','password','principal_url','home_url','last_synced_at','last_error','created_at','updated_at'))
  union all select 'calendars: all expected columns', (select count(*) = 14 from information_schema.columns where table_schema = 'public' and table_name = 'caldav_calendars'
      and column_name in ('id','account_id','user_id','href','name','color','read_only','ctag','sync_token','cached_events','last_synced_at','last_error','created_at','updated_at'))
) t order by 1;
