-- Event sharing between Daylight accounts: share ONE event (and its whole series) with another account, who accepts or declines.
-- ONE additive file: a new table and new functions. Nothing existing is edited or dropped. Safe to run more than once.
-- Run AFTER 20261126_calendar_sharing.sql (it reuses that file's daylight_person() helper).
--
-- How it works with the existing storage: an account's events live inside its own workspace_snapshots.payload (a JSON document).
-- A shared event is NOT copied. The recipient's app asks daylight_list_my_shared_events() for the owner's event, and (with
-- "Can edit") sends changes through daylight_apply_shared_event_changes(), which edits the owner's document in place and bumps its
-- revision, exactly the way the calendar-sharing and server-side tools do.
--
-- What each permission means, enforced HERE (not just hidden in the app):
--   View only : the recipient can see the event. Every write is refused.
--   Can edit  : the recipient can change that one event's details (title, time, location, description, repeat...). They cannot
--               delete it, move it to another calendar, or create events. They can leave it.
-- Series: one share covers the event record, so a repeating event is shared as ONE series. Detached single-occurrence copies that
-- share the event's uid (imported exceptions) are returned with it (read-only context); writes only ever change the shared event.
--
-- Security: row security is on and browsers have NO direct table access; everything goes through security-definer functions that act
-- as the signed-in user. Only the named recipient can accept or decline; only the owner can change a person's permission or revoke.

create table if not exists public.daylight_event_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  event_id bigint not null,
  recipient_id uuid not null,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  ended_by text check (ended_by in ('owner', 'recipient')),
  recipient_cleared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (owner_id <> recipient_id)
);
create unique index if not exists daylight_event_shares_active_idx
  on public.daylight_event_shares (owner_id, event_id, recipient_id) where status in ('pending', 'accepted');
create index if not exists daylight_event_shares_recipient_idx on public.daylight_event_shares (recipient_id, status);
create index if not exists daylight_event_shares_owner_idx on public.daylight_event_shares (owner_id, event_id);

alter table public.daylight_event_shares enable row level security;
revoke all on public.daylight_event_shares from public, anon, authenticated;
grant all on public.daylight_event_shares to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- Internal helper (not callable from a browser): the owner's event record plus its calendar's display fields, or null.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_event_of(p_owner uuid, p_event bigint)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select e || jsonb_build_object(
           '_cal_name', c ->> 'name', '_cal_color', c ->> 'color',
           '_cal_ok', not (coalesce((c ->> 'subscribed')::boolean, false) or coalesce((c ->> 'builtin')::boolean, false) or (c ->> 'id') = 'holidays'))
  from public.workspace_snapshots w
  cross join lateral jsonb_array_elements(coalesce(w.payload -> 'events', '[]'::jsonb)) e
  left join lateral (select cc from jsonb_array_elements(coalesce(w.payload -> 'calendars', '[]'::jsonb)) cc where cc ->> 'id' = e ->> 'cal' limit 1) cal(c) on true
  where w.user_id = p_owner and jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id')::bigint = p_event
  limit 1
$$;
revoke all on function public.daylight_event_of(uuid, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Owner: invite, list, change permission, revoke / cancel
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_send_event_share(p_event_id bigint, p_recipient uuid, p_permission text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ev jsonb;
  v_row public.daylight_event_shares%rowtype;
  v_count int;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if p_permission is null or p_permission not in ('view', 'edit') then raise exception 'Choose View only or Can edit'; end if;
  if p_recipient is null or p_recipient = auth.uid() then raise exception 'You already own this event'; end if;
  v_ev := public.daylight_event_of(auth.uid(), p_event_id);
  if v_ev is null then raise exception 'Event not found'; end if;
  if not (v_ev ->> '_cal_ok')::boolean then raise exception 'Only events on your own calendars can be shared'; end if;
  if not exists (select 1 from auth.users u where u.id = p_recipient) then raise exception 'Person not found'; end if;
  if exists (select 1 from public.daylight_calendar_shares s
              where s.owner_id = auth.uid() and s.calendar_id = v_ev ->> 'cal' and s.recipient_id = p_recipient and s.status = 'accepted') then
    raise exception 'This person already sees this calendar';
  end if;

  select * into v_row from public.daylight_event_shares s
   where s.owner_id = auth.uid() and s.event_id = p_event_id and s.recipient_id = p_recipient and s.status in ('pending', 'accepted');
  if found then
    if v_row.status = 'accepted' then raise exception 'This person already has access'; end if;
    update public.daylight_event_shares set permission = p_permission, recipient_cleared = false, updated_at = now(), created_at = now()
     where id = v_row.id returning * into v_row;
  else
    select count(*) into v_count from public.daylight_event_shares s
     where s.owner_id = auth.uid() and s.event_id = p_event_id and s.status in ('pending', 'accepted');
    if v_count >= 50 then raise exception 'An event can be shared with 50 people at most'; end if;
    insert into public.daylight_event_shares (owner_id, event_id, recipient_id, permission)
    values (auth.uid(), p_event_id, p_recipient, p_permission) returning * into v_row;
  end if;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'permission', v_row.permission);
end
$$;

create or replace function public.daylight_list_event_shares(p_event_id bigint)
returns table(id uuid, recipient_id uuid, name text, email text, avatar_url text, permission text, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  return query
    select s.id, s.recipient_id, (public.daylight_person(s.recipient_id) ->> 'name'), (public.daylight_person(s.recipient_id) ->> 'email'),
           (public.daylight_person(s.recipient_id) ->> 'avatar'), s.permission, s.status, s.created_at
    from public.daylight_event_shares s
    where s.owner_id = auth.uid() and s.event_id = p_event_id and s.status in ('pending', 'accepted')
    order by (s.status = 'accepted') desc, s.created_at;
end
$$;

create or replace function public.daylight_set_event_share_permission(p_id uuid, p_permission text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if p_permission is null or p_permission not in ('view', 'edit') then raise exception 'Choose View only or Can edit'; end if;
  update public.daylight_event_shares set permission = p_permission, updated_at = now()
   where id = p_id and owner_id = auth.uid() and status in ('pending', 'accepted');
  if not found then raise exception 'Share not found'; end if;
  return jsonb_build_object('permission', p_permission);
end
$$;

-- A pending invite is deleted (the recipient's notification goes with it); an accepted share ends.
create or replace function public.daylight_revoke_event_share(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.daylight_event_shares%rowtype;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  select * into v_row from public.daylight_event_shares where id = p_id and owner_id = auth.uid() and status in ('pending', 'accepted');
  if not found then raise exception 'Share not found'; end if;
  if v_row.status = 'pending' then
    delete from public.daylight_event_shares where id = p_id;
  else
    update public.daylight_event_shares set status = 'revoked', ended_by = 'owner', updated_at = now() where id = p_id;
  end if;
  return jsonb_build_object('revoked', true);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Recipient: invites, accept / decline, clear, leave
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_list_my_event_invites()
returns table(id uuid, status text, permission text, event_id bigint, event_title text, event_start text, event_end text, event_all_day boolean,
              calendar_color text, owner_name text, owner_email text, owner_avatar text, created_at timestamptz, responded_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.status, s.permission, s.event_id,
         (public.daylight_event_of(s.owner_id, s.event_id) ->> 'title'),
         (public.daylight_event_of(s.owner_id, s.event_id) ->> 'start'),
         (public.daylight_event_of(s.owner_id, s.event_id) ->> 'end'),
         coalesce((public.daylight_event_of(s.owner_id, s.event_id) ->> 'allDay')::boolean, false),
         (public.daylight_event_of(s.owner_id, s.event_id) ->> '_cal_color'),
         (public.daylight_person(s.owner_id) ->> 'name'), (public.daylight_person(s.owner_id) ->> 'email'),
         (public.daylight_person(s.owner_id) ->> 'avatar'), s.created_at, s.responded_at
  from public.daylight_event_shares s
  where auth.uid() is not null
    and s.recipient_id = auth.uid()
    and s.status in ('pending', 'accepted', 'declined')
    and not s.recipient_cleared
    and public.daylight_event_of(s.owner_id, s.event_id) is not null
  order by s.created_at desc
  limit 30
$$;

create or replace function public.daylight_respond_event_share(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  update public.daylight_event_shares
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now(), updated_at = now()
   where id = p_id and recipient_id = auth.uid() and status = 'pending'
  returning status into v_status;
  if not found then raise exception 'This invite is no longer available'; end if;
  return jsonb_build_object('status', v_status);
end
$$;

create or replace function public.daylight_clear_event_invite(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  update public.daylight_event_shares set recipient_cleared = true
   where id = p_id and recipient_id = auth.uid() and status <> 'pending';
  if not found then raise exception 'Accept or decline this invite first'; end if;
  return jsonb_build_object('cleared', true);
end
$$;

create or replace function public.daylight_leave_event_share(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  update public.daylight_event_shares set status = 'revoked', ended_by = 'recipient', updated_at = now()
   where id = p_id and recipient_id = auth.uid() and status = 'accepted';
  if not found then raise exception 'Share not found'; end if;
  return jsonb_build_object('left', true);
end
$$;

-- The events I have accepted: one row per event record (the shared event, plus any same-uid exception copies of its series).
create or replace function public.daylight_list_my_shared_events()
returns table(share_id uuid, permission text, is_main boolean, owner_id uuid, owner_name text, owner_email text, owner_avatar text,
              calendar_name text, calendar_color text, event jsonb)
language sql
security definer
set search_path = ''
as $$
  with mine as (
    select s.*, public.daylight_event_of(s.owner_id, s.event_id) as ev
    from public.daylight_event_shares s
    where auth.uid() is not null and s.recipient_id = auth.uid() and s.status = 'accepted'
  )
  select m.id, m.permission, true, m.owner_id, (public.daylight_person(m.owner_id) ->> 'name'), (public.daylight_person(m.owner_id) ->> 'email'),
         (public.daylight_person(m.owner_id) ->> 'avatar'), m.ev ->> '_cal_name', m.ev ->> '_cal_color',
         m.ev - '_cal_name' - '_cal_color' - '_cal_ok'
  from mine m where m.ev is not null
  union all
  select m.id, m.permission, false, m.owner_id, (public.daylight_person(m.owner_id) ->> 'name'), (public.daylight_person(m.owner_id) ->> 'email'),
         (public.daylight_person(m.owner_id) ->> 'avatar'), m.ev ->> '_cal_name', m.ev ->> '_cal_color', x
  from mine m
  join public.workspace_snapshots w on w.user_id = m.owner_id
  cross join lateral jsonb_array_elements(coalesce(w.payload -> 'events', '[]'::jsonb)) x
  where m.ev is not null and coalesce(m.ev ->> 'uid', '') <> '' and x ->> 'uid' = m.ev ->> 'uid'
    and (x ->> 'recurrenceId') is not null and not (jsonb_typeof(x -> 'id') = 'number' and (x ->> 'id')::bigint = m.event_id)
$$;

-- Change the shared event's details. Accepted "Can edit" recipients only. Nothing else about the owner's data can be touched:
-- only an allow-list of fields, only that one event, never its calendar, never a delete, never a new event.
create or replace function public.daylight_apply_shared_event_changes(p_share_id uuid, p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share public.daylight_event_shares%rowtype;
  v_payload jsonb;
  v_events jsonb;
  v_clean jsonb;
  v_new jsonb;
  v_allowed text[] := array['title','start','end','allDay','loc','desc','repeat','repeatEnd','weekdaysOnly','reminder',
                            'rrule','exdates','timezone','placeId','locationLat','locationLng'];
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  select * into v_share from public.daylight_event_shares where id = p_share_id and recipient_id = auth.uid() and status = 'accepted';
  if not found then raise exception 'Share not found'; end if;
  if v_share.permission <> 'edit' then raise exception 'You can view this event but not change it'; end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then raise exception 'Invalid event'; end if;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean from jsonb_each(p_event) as t(k, v) where k = any(v_allowed);
  if char_length(coalesce(v_clean ->> 'title', '')) > 500 or char_length(coalesce(v_clean ->> 'desc', '')) > 20000 or char_length(coalesce(v_clean ->> 'loc', '')) > 1000 then
    raise exception 'That event is too long';
  end if;
  if v_clean ? 'title' and btrim(coalesce(v_clean ->> 'title', '')) = '' then raise exception 'An event needs a title'; end if;

  select payload into v_payload from public.workspace_snapshots where user_id = v_share.owner_id for update;
  if v_payload is null or public.daylight_event_of(v_share.owner_id, v_share.event_id) is null then raise exception 'This event is no longer available'; end if;
  v_events := coalesce(v_payload -> 'events', '[]'::jsonb);
  select coalesce(jsonb_agg(case when jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id')::bigint = v_share.event_id
                                 then (e || v_clean) || jsonb_build_object('id', v_share.event_id, 'cal', e -> 'cal') else e end order by ord), '[]'::jsonb)
    into v_events from jsonb_array_elements(v_events) with ordinality as t(e, ord);
  update public.workspace_snapshots set payload = jsonb_set(v_payload, '{events}', v_events), revision = revision + 1, updated_at = now()
   where user_id = v_share.owner_id;
  v_new := public.daylight_event_of(v_share.owner_id, v_share.event_id);
  return v_new - '_cal_name' - '_cal_color' - '_cal_ok';
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on function public.daylight_send_event_share(bigint, uuid, text) from public, anon;
revoke all on function public.daylight_list_event_shares(bigint) from public, anon;
revoke all on function public.daylight_set_event_share_permission(uuid, text) from public, anon;
revoke all on function public.daylight_revoke_event_share(uuid) from public, anon;
revoke all on function public.daylight_list_my_event_invites() from public, anon;
revoke all on function public.daylight_respond_event_share(uuid, boolean) from public, anon;
revoke all on function public.daylight_clear_event_invite(uuid) from public, anon;
revoke all on function public.daylight_leave_event_share(uuid) from public, anon;
revoke all on function public.daylight_list_my_shared_events() from public, anon;
revoke all on function public.daylight_apply_shared_event_changes(uuid, jsonb) from public, anon;
grant execute on function public.daylight_send_event_share(bigint, uuid, text) to authenticated;
grant execute on function public.daylight_list_event_shares(bigint) to authenticated;
grant execute on function public.daylight_set_event_share_permission(uuid, text) to authenticated;
grant execute on function public.daylight_revoke_event_share(uuid) to authenticated;
grant execute on function public.daylight_list_my_event_invites() to authenticated;
grant execute on function public.daylight_respond_event_share(uuid, boolean) to authenticated;
grant execute on function public.daylight_clear_event_invite(uuid) to authenticated;
grant execute on function public.daylight_leave_event_share(uuid) to authenticated;
grant execute on function public.daylight_list_my_shared_events() to authenticated;
grant execute on function public.daylight_apply_shared_event_changes(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'table' as check, case when to_regclass('public.daylight_event_shares') is not null then 'ok' else 'MISSING' end as result
union all select 'row security on', case when (select relrowsecurity from pg_class where oid = 'public.daylight_event_shares'::regclass) then 'ok' else 'MISSING' end
union all select 'send invite', case when to_regprocedure('public.daylight_send_event_share(bigint,uuid,text)') is not null then 'ok' else 'MISSING' end
union all select 'write changes', case when to_regprocedure('public.daylight_apply_shared_event_changes(uuid,jsonb)') is not null then 'ok' else 'MISSING' end
union all select 'browser roles have no table access', case when not has_table_privilege('authenticated', 'public.daylight_event_shares', 'select') then 'ok' else 'OPEN' end;
