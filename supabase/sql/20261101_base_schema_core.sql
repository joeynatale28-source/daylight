-- ============================================================================
-- RECONSTRUCTED BASE SCHEMA (1 of 2): core tables.
--
-- The original creation SQL for these tables was never saved in this repo (they were made by hand in the
-- old project). This file was rebuilt from how the code uses them, and every column below is traced to a
-- line of code:
--
--   workspace_snapshots  daylight-cloud.js (select payload,revision / update / insert), mcp scoped RPC,
--                        supabase/functions/ical-feed, ical-import, mcp/src/server.ts
--   user_settings        daylight-integrations.js (mcp_allow_delete upsert/select), atomic delete function
--   calendars            supabase/functions/ical-feed (share link settings; one row per shared calendar)
--   subscriptions        supabase/functions/ical-subscribe, mcp scoped RPC (list_calendars)
--
-- Safe to run more than once. Run on a NEW project only, before every other file in supabase/sql.
-- Posture: row level security ON everywhere; nothing is readable or writable by `anon`; signed-in people
-- reach only their own rows. Tables that only Edge Functions touch (calendars, subscriptions) have no
-- browser access at all (the functions use the service role).
-- ============================================================================

-- Keeps updated_at honest even when a client does not set it (the browser save only sends payload+revision).
create or replace function public.daylight_touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

-- ---- workspace_snapshots: one JSON document per account, optimistic concurrency by revision ----
create table if not exists public.workspace_snapshots (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  revision   integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
drop trigger if exists workspace_snapshots_touch on public.workspace_snapshots;
create trigger workspace_snapshots_touch before update on public.workspace_snapshots
  for each row execute function public.daylight_touch_updated_at();

alter table public.workspace_snapshots enable row level security;
revoke all on public.workspace_snapshots from public, anon, authenticated;
grant select, insert, update on public.workspace_snapshots to authenticated;
drop policy if exists workspace_snapshots_self_select on public.workspace_snapshots;
drop policy if exists workspace_snapshots_self_insert on public.workspace_snapshots;
drop policy if exists workspace_snapshots_self_update on public.workspace_snapshots;
drop policy if exists workspace_snapshots_no_oauth on public.workspace_snapshots;
create policy workspace_snapshots_self_select on public.workspace_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);
create policy workspace_snapshots_self_insert on public.workspace_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy workspace_snapshots_self_update on public.workspace_snapshots for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- OAuth (MCP) tokens carry a client_id claim. They must never touch this table through the Data API:
-- the audited mcp_workspace_tool() function is their only path (see 20261104_mcp_oauth_scoped_workspace_rpc_fixed.sql).
create policy workspace_snapshots_no_oauth on public.workspace_snapshots as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'client_id') is null) with check ((select auth.jwt() ->> 'client_id') is null);

-- ---- user_settings: account-wide switches (currently only "AI may delete events") ----
create table if not exists public.user_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  mcp_allow_delete boolean not null default false,
  updated_at       timestamptz not null default now()
);
drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.daylight_touch_updated_at();

alter table public.user_settings enable row level security;
revoke all on public.user_settings from public, anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;
drop policy if exists user_settings_self_select on public.user_settings;
drop policy if exists user_settings_self_insert on public.user_settings;
drop policy if exists user_settings_self_update on public.user_settings;
drop policy if exists user_settings_no_oauth on public.user_settings;
create policy user_settings_self_select on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_settings_self_insert on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_settings_self_update on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_settings_no_oauth on public.user_settings as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'client_id') is null) with check ((select auth.jwt() ->> 'client_id') is null);

-- ---- calendars: per-calendar link-sharing settings, written only by the ical-feed Edge Function ----
-- id is the public feed id (a uuid in the URL); client_id is the calendar's id inside the workspace JSON.
create table if not exists public.calendars (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  client_id           text not null,
  name                text not null default 'Calendar',
  color               text not null default '#5b8def',
  shade               text,
  source_type         text not null default 'local',
  share_feed_enabled  boolean not null default false,
  share_public_enabled boolean not null default false,
  share_token_hash    text,
  share_token_prefix  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint calendars_user_client_unique unique (user_id, client_id)
);
create index if not exists calendars_user_idx on public.calendars (user_id);
drop trigger if exists calendars_touch on public.calendars;
create trigger calendars_touch before update on public.calendars
  for each row execute function public.daylight_touch_updated_at();
alter table public.calendars enable row level security;
revoke all on public.calendars from public, anon, authenticated;   -- service role only (Edge Function)

-- ---- subscriptions: iCal feeds a person subscribed to, written only by the ical-subscribe Edge Function ----
create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  url             text not null,
  color           text not null default 'teal',
  etag            text,
  cached_events   jsonb not null default '[]'::jsonb,
  skipped_count   integer not null default 0,
  last_fetched_at timestamptz,
  last_error      text,
  last_error_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint subscriptions_user_url_unique unique (user_id, url)
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at);
drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.daylight_touch_updated_at();
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from public, anon, authenticated;  -- service role + security-definer RPCs only

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'workspace_snapshots' as object, case when to_regclass('public.workspace_snapshots') is not null then 'ok' else 'MISSING' end as result
union all select 'user_settings', case when to_regclass('public.user_settings') is not null then 'ok' else 'MISSING' end
union all select 'calendars', case when to_regclass('public.calendars') is not null then 'ok' else 'MISSING' end
union all select 'subscriptions', case when to_regclass('public.subscriptions') is not null then 'ok' else 'MISSING' end
union all select 'RLS on all four', case when (select count(*) from pg_class where oid in
  ('public.workspace_snapshots'::regclass,'public.user_settings'::regclass,'public.calendars'::regclass,'public.subscriptions'::regclass)
  and relrowsecurity) = 4 then 'ok' else 'OFF' end;
