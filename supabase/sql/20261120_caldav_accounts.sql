-- CalDAV accounts + calendar mapping for daylight.
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Security model:
--   * caldav_accounts holds the server password. It has RLS enabled and NO policy for
--     anon/authenticated, and all table privileges are revoked from them, so the browser
--     (PostgREST) can never read or write it. Only the `caldav` edge function (service role)
--     touches it, and it scopes every query by the user id from the verified JWT.
--   * caldav_calendars holds no secrets (server calendar URL, name, color, sync state and the
--     cached events). The owner may read their own rows; all writes go through the function.

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
  updated_at     timestamptz not null default now(),
  unique (user_id, server_url, username)
);

create table if not exists public.caldav_calendars (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.caldav_accounts(id) on delete cascade,
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
  updated_at     timestamptz not null default now(),
  unique (account_id, href)
);
create index if not exists caldav_calendars_user_idx on public.caldav_calendars(user_id);
create index if not exists caldav_accounts_user_idx on public.caldav_accounts(user_id);

alter table public.caldav_accounts  enable row level security;
alter table public.caldav_calendars enable row level security;

revoke all on public.caldav_accounts  from anon, authenticated;
revoke all on public.caldav_calendars from anon, authenticated;
grant select on public.caldav_calendars to authenticated;

drop policy if exists caldav_calendars_owner_select on public.caldav_calendars;
create policy caldav_calendars_owner_select on public.caldav_calendars
  for select to authenticated using ((select auth.uid()) = user_id);
-- (intentionally no policies on caldav_accounts: the password never reaches the browser)

create or replace function public.caldav_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists caldav_accounts_touch on public.caldav_accounts;
create trigger caldav_accounts_touch before update on public.caldav_accounts for each row execute function public.caldav_touch_updated_at();
drop trigger if exists caldav_calendars_touch on public.caldav_calendars;
create trigger caldav_calendars_touch before update on public.caldav_calendars for each row execute function public.caldav_touch_updated_at();
