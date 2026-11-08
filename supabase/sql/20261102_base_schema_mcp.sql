-- ============================================================================
-- RECONSTRUCTED BASE SCHEMA (2 of 2): AI access (MCP) tables.
--
-- Rebuilt from the code, since the original creation SQL was never saved here:
--   mcp_tokens          daylight-integrations.js (list / insert / revoke; the browser never reads token_hash),
--                       mcp/src/server.ts (authenticate by hash), mcp/scripts/smoke.ts
--   mcp_audit_log       daylight-integrations.js (Recent AI activity), mcp/sql/20261104_atomic_delete_audit.sql
--   mcp_workspace_audit daylight-integrations.js (Recent AI activity), mcp_workspace_tool() in
--                       20261104_mcp_oauth_scoped_workspace_rpc_fixed.sql (inserts user_id, client_id, tool, target_id, result)
--
-- mcp_grants is NOT here: 20261104_mcp_oauth_client_permissions.sql creates it.
-- Safe to run more than once. Run after 20261101_base_schema_core.sql.
-- ============================================================================

-- ---- mcp_tokens: personal access tokens (only the SHA-256 hash is stored) ----
create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 100),
  scopes       text[] not null default '{read}' check (scopes <@ array['read','write']::text[] and cardinality(scopes) > 0),
  token_prefix text,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked      boolean not null default false
);
create index if not exists mcp_tokens_user_idx on public.mcp_tokens (user_id, created_at desc);
alter table public.mcp_tokens enable row level security;
revoke all on public.mcp_tokens from public, anon, authenticated;
-- Column-level grants: the browser can list its tokens (never the hash), create one, and revoke one.
grant select (id, user_id, name, token_prefix, scopes, created_at, last_used_at, revoked) on public.mcp_tokens to authenticated;
grant insert (user_id, name, scopes, token_prefix, token_hash) on public.mcp_tokens to authenticated;
grant update (revoked) on public.mcp_tokens to authenticated;
drop policy if exists mcp_tokens_self_select on public.mcp_tokens;
drop policy if exists mcp_tokens_self_insert on public.mcp_tokens;
drop policy if exists mcp_tokens_self_update on public.mcp_tokens;
drop policy if exists mcp_tokens_no_oauth on public.mcp_tokens;
create policy mcp_tokens_self_select on public.mcp_tokens for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mcp_tokens_self_insert on public.mcp_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy mcp_tokens_self_update on public.mcp_tokens for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy mcp_tokens_no_oauth on public.mcp_tokens as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'client_id') is null) with check ((select auth.jwt() ->> 'client_id') is null);

-- ---- mcp_audit_log: activity from personal tokens (written server-side only) ----
create table if not exists public.mcp_audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token_name text,
  tool       text not null,
  action     text,
  summary    text,
  target_id  text,
  created_at timestamptz not null default now()
);
create index if not exists mcp_audit_log_user_idx on public.mcp_audit_log (user_id, created_at desc);
alter table public.mcp_audit_log enable row level security;
revoke all on public.mcp_audit_log from public, anon, authenticated;
grant select on public.mcp_audit_log to authenticated;                 -- read-only for the account owner
drop policy if exists mcp_audit_log_self_select on public.mcp_audit_log;
drop policy if exists mcp_audit_log_no_oauth on public.mcp_audit_log;
create policy mcp_audit_log_self_select on public.mcp_audit_log for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mcp_audit_log_no_oauth on public.mcp_audit_log as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'client_id') is null) with check ((select auth.jwt() ->> 'client_id') is null);

-- ---- mcp_workspace_audit: activity from OAuth connections (written by mcp_workspace_tool only) ----
create table if not exists public.mcp_workspace_audit (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  text,
  tool       text not null,
  target_id  text,
  result     text,
  created_at timestamptz not null default now()
);
create index if not exists mcp_workspace_audit_user_idx on public.mcp_workspace_audit (user_id, created_at desc);
alter table public.mcp_workspace_audit enable row level security;
revoke all on public.mcp_workspace_audit from public, anon, authenticated;
grant select on public.mcp_workspace_audit to authenticated;
drop policy if exists mcp_workspace_audit_self_select on public.mcp_workspace_audit;
drop policy if exists mcp_workspace_audit_no_oauth on public.mcp_workspace_audit;
create policy mcp_workspace_audit_self_select on public.mcp_workspace_audit for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mcp_workspace_audit_no_oauth on public.mcp_workspace_audit as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'client_id') is null) with check ((select auth.jwt() ->> 'client_id') is null);

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'mcp_tokens' as object, case when to_regclass('public.mcp_tokens') is not null then 'ok' else 'MISSING' end as result
union all select 'mcp_audit_log', case when to_regclass('public.mcp_audit_log') is not null then 'ok' else 'MISSING' end
union all select 'mcp_workspace_audit', case when to_regclass('public.mcp_workspace_audit') is not null then 'ok' else 'MISSING' end
union all select 'token hash hidden from browsers', case when not has_column_privilege('authenticated','public.mcp_tokens','token_hash','select') then 'ok' else 'EXPOSED' end;
