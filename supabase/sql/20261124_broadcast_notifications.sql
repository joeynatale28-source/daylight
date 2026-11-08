-- In-app broadcast notifications: the owner sends one message, every signed-in user sees it in the bell panel
-- (with the usual unread badge). Safe to run more than once.
--
-- Who may send: only accounts listed in public.daylight_owners. That check lives in the database function, so hiding a
-- button in the app is not what protects it. Browsers never read or write these tables directly; they call the
-- functions below, which only ever act as the signed-in user.
--
-- STEP 1: run this whole file.
-- STEP 2: make yourself the owner (edit the address first, then run just this statement; your address is not stored in the repo):
--
--   insert into public.daylight_owners (user_id)
--   select id from auth.users where lower(email) = lower('YOUR-EMAIL@EXAMPLE.COM')
--   on conflict do nothing;
--
-- The check at the bottom shows how many owners exist (it should be 1 after step 2).

create table if not exists public.daylight_owners (
  user_id uuid primary key,
  added_at timestamptz not null default now()
);

create table if not exists public.daylight_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sender text not null default 'daylight',
  created_at timestamptz not null default now()
);
alter table public.daylight_broadcasts add column if not exists title text;
alter table public.daylight_broadcasts add column if not exists body text;
alter table public.daylight_broadcasts add column if not exists sender text not null default 'daylight';
alter table public.daylight_broadcasts add column if not exists created_at timestamptz not null default now();

create table if not exists public.daylight_broadcast_reads (
  user_id uuid not null,
  broadcast_id uuid not null references public.daylight_broadcasts(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, broadcast_id)
);

-- Row security on, no policies, no direct privileges: only the functions below can touch the data.
alter table public.daylight_owners enable row level security;
alter table public.daylight_broadcasts enable row level security;
alter table public.daylight_broadcast_reads enable row level security;
revoke all on public.daylight_owners from public, anon, authenticated;
revoke all on public.daylight_broadcasts from public, anon, authenticated;
revoke all on public.daylight_broadcast_reads from public, anon, authenticated;
grant all on public.daylight_owners to service_role;
grant all on public.daylight_broadcasts to service_role;
grant all on public.daylight_broadcast_reads to service_role;

create or replace function public.daylight_is_owner()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.daylight_owners o where o.user_id = auth.uid())
$$;

-- What the bell panel shows: newest first, only messages sent after this account was created.
create or replace function public.daylight_list_broadcasts()
returns table(id uuid, title text, body text, sender text, created_at timestamptz, read boolean)
language sql
security definer
set search_path = ''
as $$
  select b.id, b.title, b.body, b.sender, b.created_at, (r.broadcast_id is not null) as read
  from public.daylight_broadcasts b
  left join public.daylight_broadcast_reads r
    on r.broadcast_id = b.id and r.user_id = auth.uid()
  where auth.uid() is not null
    and b.created_at >= coalesce((select u.created_at from auth.users u where u.id = auth.uid()), '-infinity'::timestamptz)
  order by b.created_at desc
  limit 30
$$;

create or replace function public.daylight_mark_broadcasts_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authenticated session required'; end if;
  insert into public.daylight_broadcast_reads (user_id, broadcast_id)
  select v_user, b.id from public.daylight_broadcasts b
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.daylight_send_broadcast(p_title text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can send notifications'; end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then raise exception 'Title must be 1 to 120 characters'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then raise exception 'Message must be 1 to 1000 characters'; end if;
  insert into public.daylight_broadcasts (title, body) values (v_title, v_body) returning id into v_id;
  return jsonb_build_object('id', v_id);
end
$$;

create or replace function public.daylight_delete_broadcast(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can remove notifications'; end if;
  delete from public.daylight_broadcasts where id = p_id;
  return jsonb_build_object('deleted', found);
end
$$;

revoke all on function public.daylight_is_owner() from public, anon;
revoke all on function public.daylight_list_broadcasts() from public, anon;
revoke all on function public.daylight_mark_broadcasts_read() from public, anon;
revoke all on function public.daylight_send_broadcast(text, text) from public, anon;
revoke all on function public.daylight_delete_broadcast(uuid) from public, anon;
grant execute on function public.daylight_is_owner() to authenticated;
grant execute on function public.daylight_list_broadcasts() to authenticated;
grant execute on function public.daylight_mark_broadcasts_read() to authenticated;
grant execute on function public.daylight_send_broadcast(text, text) to authenticated;
grant execute on function public.daylight_delete_broadcast(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Check: every line should say ok (the owner line says "none yet" until step 2).
select 'tables' as check, case when to_regclass('public.daylight_broadcasts') is not null and to_regclass('public.daylight_broadcast_reads') is not null and to_regclass('public.daylight_owners') is not null then 'ok' else 'MISSING' end as result
union all select 'send function', case when to_regprocedure('public.daylight_send_broadcast(text,text)') is not null then 'ok' else 'MISSING' end
union all select 'list function', case when to_regprocedure('public.daylight_list_broadcasts()') is not null then 'ok' else 'MISSING' end
union all select 'row security on', case when (select bool_and(relrowsecurity) from pg_class where oid in ('public.daylight_owners'::regclass, 'public.daylight_broadcasts'::regclass, 'public.daylight_broadcast_reads'::regclass)) then 'ok' else 'MISSING' end
union all select 'owners', case when (select count(*) from public.daylight_owners) = 0 then 'none yet' else (select count(*)::text from public.daylight_owners) end;
