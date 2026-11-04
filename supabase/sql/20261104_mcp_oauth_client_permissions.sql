create table if not exists public.mcp_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  client_name text,
  can_read boolean not null default true,
  can_write boolean not null default false,
  can_delete boolean not null default false,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id,client_id),
  constraint mcp_grants_permission_hierarchy check (
    (not can_delete or can_write) and (not can_write or can_read)
  )
);
alter table public.mcp_grants enable row level security;
revoke all on public.mcp_grants from anon;
grant select,insert,update,delete on public.mcp_grants to authenticated;
drop policy if exists mcp_grants_self_select on public.mcp_grants;
drop policy if exists mcp_grants_self_insert on public.mcp_grants;
drop policy if exists mcp_grants_self_update on public.mcp_grants;
drop policy if exists mcp_grants_self_delete on public.mcp_grants;
create policy mcp_grants_self_select on public.mcp_grants for select to authenticated using ((select auth.uid()) = user_id);
create policy mcp_grants_self_insert on public.mcp_grants for insert to authenticated with check ((select auth.uid()) = user_id);
create policy mcp_grants_self_update on public.mcp_grants for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy mcp_grants_self_delete on public.mcp_grants for delete to authenticated using ((select auth.uid()) = user_id);