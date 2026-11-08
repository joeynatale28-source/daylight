-- One row per device in Settings -> Profile -> Active sessions.
--
-- Each browser keeps a stable random device id (localStorage) and tells the server about it right after sign-in.
-- The server remembers which sign-in session belongs to which device, so:
--   * the list shows ONE row per device (the current session if it is this device, otherwise the newest);
--   * older sign-ins from the same browser are hidden, and are signed out together with the device's row;
--   * sessions that were created before this file ran have no device id. They cannot be told apart safely
--     (two computers can share a browser and network), so they are left exactly as they are.
--
-- Safe to run more than once. Nothing here changes Supabase Auth settings; the functions only read the signed-in
-- user's own rows, and (like daylight_revoke_my_session before) delete that user's own sessions.

create table if not exists public.daylight_device_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  device_id text not null,
  device_label text not null default '',
  registered_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- If the table already existed in some other shape, add whatever is missing.
alter table public.daylight_device_sessions add column if not exists user_id uuid;
alter table public.daylight_device_sessions add column if not exists device_id text;
alter table public.daylight_device_sessions add column if not exists device_label text not null default '';
alter table public.daylight_device_sessions add column if not exists registered_at timestamptz not null default now();
alter table public.daylight_device_sessions add column if not exists last_seen timestamptz not null default now();

create index if not exists daylight_device_sessions_user_device_idx
  on public.daylight_device_sessions (user_id, device_id);

-- Browsers never touch this table directly; only the functions below (security definer) do.
alter table public.daylight_device_sessions enable row level security;
revoke all on public.daylight_device_sessions from public, anon, authenticated;
grant all on public.daylight_device_sessions to service_role;

-- Called by the app right after sign-in with this browser's device id.
create or replace function public.daylight_register_device(p_device_id text, p_label text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session uuid;
begin
  if v_user_id is null then raise exception 'Authenticated session required'; end if;
  if p_device_id is null or p_device_id !~ '^[A-Za-z0-9-]{16,64}$' then raise exception 'Invalid device'; end if;
  begin
    v_session := (auth.jwt() ->> 'session_id')::uuid;
  exception when others then
    v_session := null;
  end;
  if v_session is null then return jsonb_build_object('registered', false); end if;

  insert into public.daylight_device_sessions (session_id, user_id, device_id, device_label, last_seen)
  values (v_session, v_user_id, p_device_id, left(coalesce(p_label, ''), 120), now())
  on conflict (session_id) do update
    set device_id = excluded.device_id, device_label = excluded.device_label, last_seen = now()
    where public.daylight_device_sessions.user_id = v_user_id;

  -- Forget mappings whose sign-in session no longer exists.
  delete from public.daylight_device_sessions d
   where d.user_id = v_user_id
     and not exists (select 1 from auth.sessions s where s.id = d.session_id);

  return jsonb_build_object('registered', true);
end
$$;

-- The list now carries the device id, and shows one row per registered device.
drop function if exists public.daylight_list_my_sessions();
create function public.daylight_list_my_sessions()
returns table(id text, user_agent text, last_active timestamptz, current boolean, device_id text, device_label text)
language sql
security definer
set search_path = ''
as $$
  with live as (
    select s.id, s.user_agent, s.updated_at,
           (s.id::text = auth.jwt() ->> 'session_id') as is_current,
           d.device_id, d.device_label
    from auth.sessions s
    left join public.daylight_device_sessions d
      on d.session_id = s.id and d.user_id = auth.uid()
    where s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now())
  ),
  ranked as (
    select live.*,
           row_number() over (
             partition by live.device_id
             order by live.is_current desc, live.updated_at desc
           ) as rn
    from live
  )
  select r.id::text,
         coalesce(r.user_agent, ''),
         r.updated_at,
         r.is_current,
         r.device_id,
         coalesce(r.device_label, '')
  from ranked r
  where r.device_id is null or r.rn = 1
  order by r.is_current desc, r.updated_at desc
  limit 20
$$;

-- Signing a device out also signs out that device's older, hidden sign-ins.
create or replace function public.daylight_revoke_my_session(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session text := auth.jwt() ->> 'session_id';
  v_session_id uuid;
  v_device text;
begin
  if v_user_id is null then raise exception 'Authenticated session required'; end if;
  if p_session_id is null or p_session_id !~* '^[0-9a-f-]{36}$' then
    raise exception 'Invalid session';
  end if;
  if p_session_id = v_current_session then
    raise exception 'The current session cannot be revoked here';
  end if;
  v_session_id := p_session_id::uuid;

  select d.device_id into v_device
    from public.daylight_device_sessions d
   where d.session_id = v_session_id and d.user_id = v_user_id;

  delete from auth.sessions where id = v_session_id and user_id = v_user_id;
  if not found then raise exception 'Session not found'; end if;

  if v_device is not null then
    delete from auth.sessions s
     using public.daylight_device_sessions d
     where d.user_id = v_user_id and d.device_id = v_device
       and s.id = d.session_id and s.user_id = v_user_id
       and s.id::text <> coalesce(v_current_session, '');
    delete from public.daylight_device_sessions d
     where d.user_id = v_user_id and d.device_id = v_device
       and d.session_id::text <> coalesce(v_current_session, '');
  end if;
  return jsonb_build_object('revoked', true);
end
$$;

revoke all on function public.daylight_register_device(text, text) from public, anon;
revoke all on function public.daylight_list_my_sessions() from public, anon;
revoke all on function public.daylight_revoke_my_session(text) from public, anon;
grant execute on function public.daylight_register_device(text, text) to authenticated;
grant execute on function public.daylight_list_my_sessions() to authenticated;
grant execute on function public.daylight_revoke_my_session(text) to authenticated;

notify pgrst, 'reload schema';

-- Check (run after the above): both functions exist and the table is locked down.
select 'register function' as check, case when to_regprocedure('public.daylight_register_device(text,text)') is not null then 'ok' else 'MISSING' end as result
union all select 'list function', case when to_regprocedure('public.daylight_list_my_sessions()') is not null then 'ok' else 'MISSING' end
union all select 'table', case when to_regclass('public.daylight_device_sessions') is not null then 'ok' else 'MISSING' end
union all select 'row security on', case when (select relrowsecurity from pg_class where oid = 'public.daylight_device_sessions'::regclass) then 'ok' else 'MISSING' end;
