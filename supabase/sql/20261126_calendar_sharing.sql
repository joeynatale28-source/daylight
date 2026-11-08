-- Calendar sharing between Daylight accounts (invite by username, accept / decline, View only / Can edit).
-- ONE additive file: new table, new functions. Nothing existing is edited or dropped. Safe to run more than once.
--
-- How it works with the existing storage: an account's events live inside its own workspace_snapshots.payload (a JSON
-- document). A shared calendar is NOT copied. The recipient's app asks the functions below for that one calendar's events,
-- and (with "Can edit") sends changes through daylight_apply_shared_event_ops, which edits the owner's document in place
-- and bumps its revision, exactly the way the existing server-side tools already do. The owner's own app keeps working as
-- today; if both sides change things at once, the owner's next save hits the normal revision check and reloads.
--
-- Security: row security is on and browsers have NO direct table access; everything goes through security-definer
-- functions that act as the signed-in user. "View only" is enforced here: the write function refuses anyone who is not an
-- accepted "Can edit" recipient of that exact calendar. Only the named recipient can accept or decline.

-- ---------------------------------------------------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.daylight_calendar_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  calendar_id text not null,
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
create unique index if not exists daylight_calendar_shares_active_idx
  on public.daylight_calendar_shares (owner_id, calendar_id, recipient_id) where status in ('pending', 'accepted');
create index if not exists daylight_calendar_shares_recipient_idx
  on public.daylight_calendar_shares (recipient_id, status);
create index if not exists daylight_calendar_shares_owner_idx
  on public.daylight_calendar_shares (owner_id, calendar_id);

alter table public.daylight_calendar_shares enable row level security;
revoke all on public.daylight_calendar_shares from public, anon, authenticated;
grant all on public.daylight_calendar_shares to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- Internal helpers (not callable from the browser)
-- ---------------------------------------------------------------------------------------------------------------------
-- The calendar object (id, name, color, flags) an owner has under that id, or null. Never returns anything else.
create or replace function public.daylight_calendar_of(p_owner uuid, p_calendar text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object('id', c ->> 'id', 'name', c ->> 'name', 'color', c ->> 'color',
                            'subscribed', coalesce((c ->> 'subscribed')::boolean, false),
                            'builtin', coalesce((c ->> 'builtin')::boolean, false))
  from public.workspace_snapshots w, jsonb_array_elements(coalesce(w.payload -> 'calendars', '[]'::jsonb)) c
  where w.user_id = p_owner and c ->> 'id' = p_calendar
  limit 1
$$;

-- The only fields about an account that the sharing screens ever show: name, email and own-folder picture.
create or replace function public.daylight_person(p_user uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', u.id,
    'name', coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email::text, '@', 1)),
    'email', u.email::text,
    'avatar', case when (u.raw_user_meta_data ->> 'avatar_url') like '%/' || u.id::text || '/%' then u.raw_user_meta_data ->> 'avatar_url' else null end)
  from auth.users u where u.id = p_user
$$;

revoke all on function public.daylight_calendar_of(uuid, text) from public, anon, authenticated;
revoke all on function public.daylight_person(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Finding people (privacy-bounded: signed in, 2+ characters, at most 5 matches, only name / email / picture)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_search_people(p_query text)
returns table(user_id uuid, name text, email text, avatar_url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  q text := lower(btrim(coalesce(p_query, '')));
  pat text;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if char_length(q) < 2 or char_length(q) > 80 then return; end if;
  pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select u.id,
           (public.daylight_person(u.id) ->> 'name'),
           u.email::text,
           (public.daylight_person(u.id) ->> 'avatar')
    from auth.users u
    where u.id <> auth.uid()
      and (lower(public.daylight_person(u.id) ->> 'name') like pat escape '\' or lower(u.email::text) like pat escape '\')
    order by (lower(u.email::text) = q or lower(public.daylight_person(u.id) ->> 'name') = q) desc,
             (lower(u.email::text) like left(pat, -1) escape '\' or lower(public.daylight_person(u.id) ->> 'name') like left(pat, -1) escape '\') desc,
             public.daylight_person(u.id) ->> 'name'
    limit 5;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Owner: invite, list, change permission, revoke / cancel
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_send_calendar_share(p_calendar_id text, p_recipient uuid, p_permission text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cal jsonb;
  v_row public.daylight_calendar_shares%rowtype;
  v_count int;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if p_permission is null or p_permission not in ('view', 'edit') then raise exception 'Choose View only or Can edit'; end if;
  if p_recipient is null or p_recipient = auth.uid() then raise exception 'You already own this calendar'; end if;
  v_cal := public.daylight_calendar_of(auth.uid(), p_calendar_id);
  if v_cal is null then raise exception 'Calendar not found'; end if;
  if (v_cal ->> 'subscribed')::boolean or (v_cal ->> 'builtin')::boolean or p_calendar_id = 'holidays' then
    raise exception 'Only calendars you own can be shared';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_recipient) then raise exception 'Person not found'; end if;

  select * into v_row from public.daylight_calendar_shares s
   where s.owner_id = auth.uid() and s.calendar_id = p_calendar_id and s.recipient_id = p_recipient and s.status in ('pending', 'accepted');
  if found then
    if v_row.status = 'accepted' then raise exception 'This person already has access'; end if;
    -- a pending invite: sending again updates the permission and puts it back in front of them
    update public.daylight_calendar_shares set permission = p_permission, recipient_cleared = false, updated_at = now(), created_at = now()
     where id = v_row.id returning * into v_row;
  else
    select count(*) into v_count from public.daylight_calendar_shares s
     where s.owner_id = auth.uid() and s.calendar_id = p_calendar_id and s.status in ('pending', 'accepted');
    if v_count >= 50 then raise exception 'A calendar can be shared with 50 people at most'; end if;
    insert into public.daylight_calendar_shares (owner_id, calendar_id, recipient_id, permission)
    values (auth.uid(), p_calendar_id, p_recipient, p_permission) returning * into v_row;
  end if;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'permission', v_row.permission);
end
$$;

create or replace function public.daylight_list_calendar_shares(p_calendar_id text)
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
    from public.daylight_calendar_shares s
    where s.owner_id = auth.uid() and s.calendar_id = p_calendar_id and s.status in ('pending', 'accepted')
    order by (s.status = 'accepted') desc, s.created_at;
end
$$;

create or replace function public.daylight_set_calendar_share_permission(p_id uuid, p_permission text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if p_permission is null or p_permission not in ('view', 'edit') then raise exception 'Choose View only or Can edit'; end if;
  update public.daylight_calendar_shares set permission = p_permission, updated_at = now()
   where id = p_id and owner_id = auth.uid() and status in ('pending', 'accepted');
  if not found then raise exception 'Share not found'; end if;
  return jsonb_build_object('permission', p_permission);
end
$$;

-- A pending invite is deleted (the recipient's notification goes with it); an accepted share ends.
create or replace function public.daylight_revoke_calendar_share(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.daylight_calendar_shares%rowtype;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  select * into v_row from public.daylight_calendar_shares where id = p_id and owner_id = auth.uid() and status in ('pending', 'accepted');
  if not found then raise exception 'Share not found'; end if;
  if v_row.status = 'pending' then
    delete from public.daylight_calendar_shares where id = p_id;
  else
    update public.daylight_calendar_shares set status = 'revoked', ended_by = 'owner', updated_at = now() where id = p_id;
  end if;
  return jsonb_build_object('revoked', true);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Recipient: invites, accept / decline, clear, leave, the calendars I have
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_list_my_invites()
returns table(id uuid, status text, permission text, calendar_id text, calendar_name text, calendar_color text,
              owner_name text, owner_email text, owner_avatar text, created_at timestamptz, responded_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.status, s.permission, s.calendar_id,
         (public.daylight_calendar_of(s.owner_id, s.calendar_id) ->> 'name'),
         (public.daylight_calendar_of(s.owner_id, s.calendar_id) ->> 'color'),
         (public.daylight_person(s.owner_id) ->> 'name'), (public.daylight_person(s.owner_id) ->> 'email'),
         (public.daylight_person(s.owner_id) ->> 'avatar'), s.created_at, s.responded_at
  from public.daylight_calendar_shares s
  where auth.uid() is not null
    and s.recipient_id = auth.uid()
    and s.status in ('pending', 'accepted', 'declined')
    and not s.recipient_cleared
    and public.daylight_calendar_of(s.owner_id, s.calendar_id) is not null
  order by s.created_at desc
  limit 30
$$;

create or replace function public.daylight_respond_calendar_share(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  update public.daylight_calendar_shares
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now(), updated_at = now()
   where id = p_id and recipient_id = auth.uid() and status = 'pending'
  returning status into v_status;
  if not found then raise exception 'This invite is no longer available'; end if;
  return jsonb_build_object('status', v_status);
end
$$;

-- Clear a finished invite (Added / Declined) from my notifications. A pending invite can't be cleared.
create or replace function public.daylight_clear_calendar_invite(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  update public.daylight_calendar_shares set recipient_cleared = true
   where id = p_id and recipient_id = auth.uid() and status <> 'pending';
  if not found then raise exception 'Add or decline this invite first'; end if;
  return jsonb_build_object('cleared', true);
end
$$;

create or replace function public.daylight_leave_calendar_share(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  update public.daylight_calendar_shares set status = 'revoked', ended_by = 'recipient', updated_at = now()
   where id = p_id and recipient_id = auth.uid() and status = 'accepted';
  if not found then raise exception 'Share not found'; end if;
  return jsonb_build_object('left', true);
end
$$;

create or replace function public.daylight_list_my_shared_calendars()
returns table(share_id uuid, calendar_id text, calendar_name text, calendar_color text, owner_id uuid, owner_name text, owner_email text,
              owner_avatar text, permission text, updated_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.calendar_id,
         (public.daylight_calendar_of(s.owner_id, s.calendar_id) ->> 'name'),
         (public.daylight_calendar_of(s.owner_id, s.calendar_id) ->> 'color'),
         s.owner_id, (public.daylight_person(s.owner_id) ->> 'name'), (public.daylight_person(s.owner_id) ->> 'email'),
         (public.daylight_person(s.owner_id) ->> 'avatar'), s.permission, s.updated_at
  from public.daylight_calendar_shares s
  where auth.uid() is not null and s.recipient_id = auth.uid() and s.status = 'accepted'
    and public.daylight_calendar_of(s.owner_id, s.calendar_id) is not null
  order by s.created_at
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Events of ONE shared calendar: read (any accepted recipient) and write (accepted "Can edit" recipients only)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_shared_calendar_events(p_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share public.daylight_calendar_shares%rowtype;
  v_events jsonb;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  select * into v_share from public.daylight_calendar_shares where id = p_share_id and recipient_id = auth.uid() and status = 'accepted';
  if not found then raise exception 'Share not found'; end if;
  select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) into v_events
    from public.workspace_snapshots w, jsonb_array_elements(coalesce(w.payload -> 'events', '[]'::jsonb)) with ordinality as t(e, ord)
   where w.user_id = v_share.owner_id and e ->> 'cal' = v_share.calendar_id;
  return v_events;
end
$$;

-- ops: [{"op":"create","client_id":"x","event":{...}}, {"op":"update","event":{"id":5,...}}, {"op":"delete","event":{"id":5}}]
create or replace function public.daylight_apply_shared_event_ops(p_share_id uuid, p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share public.daylight_calendar_shares%rowtype;
  v_payload jsonb;
  v_events jsonb;
  v_op jsonb;
  v_ev jsonb;
  v_clean jsonb;
  v_id bigint;
  v_next bigint;
  v_created jsonb := '{}'::jsonb;
  v_allowed text[] := array['title','start','end','allDay','loc','desc','repeat','repeatEnd','accent','weekdaysOnly','reminder','declined',
                            'uid','rrule','exdates','timezone','recurrenceId','status','placeId','locationLat','locationLng','dtstamp','sequence'];
  v_changed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  select * into v_share from public.daylight_calendar_shares where id = p_share_id and recipient_id = auth.uid() and status = 'accepted';
  if not found then raise exception 'Share not found'; end if;
  if v_share.permission <> 'edit' then raise exception 'You can view this calendar but not change it'; end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 or jsonb_array_length(p_ops) > 50 then raise exception 'Nothing to change'; end if;
  if public.daylight_calendar_of(v_share.owner_id, v_share.calendar_id) is null then raise exception 'This calendar is no longer available'; end if;

  select payload into v_payload from public.workspace_snapshots where user_id = v_share.owner_id for update;
  if v_payload is null then raise exception 'This calendar is no longer available'; end if;
  v_events := coalesce(v_payload -> 'events', '[]'::jsonb);

  for v_op in select * from jsonb_array_elements(p_ops) loop
    v_ev := coalesce(v_op -> 'event', '{}'::jsonb);
    if jsonb_typeof(v_ev) <> 'object' then raise exception 'Invalid event'; end if;
    if (v_op ->> 'op') in ('create', 'update') then
      select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean from jsonb_each(v_ev) as t(k, v) where k = any(v_allowed);
      if char_length(coalesce(v_clean ->> 'title', '')) > 500 or char_length(coalesce(v_clean ->> 'desc', '')) > 20000 or char_length(coalesce(v_clean ->> 'loc', '')) > 1000 then
        raise exception 'That event is too long';
      end if;
    end if;
    if (v_op ->> 'op') = 'create' then
      if coalesce(v_clean ->> 'title', '') = '' or v_clean ->> 'start' is null or v_clean ->> 'end' is null then raise exception 'An event needs a title, start and end'; end if;
      select coalesce(max((e ->> 'id')::bigint) filter (where jsonb_typeof(e -> 'id') = 'number'), 0) + 1 into v_next from jsonb_array_elements(v_events) e;
      v_events := v_events || jsonb_build_array(v_clean || jsonb_build_object('id', v_next, 'cal', v_share.calendar_id));
      if v_op ->> 'client_id' is not null then v_created := v_created || jsonb_build_object(v_op ->> 'client_id', v_next); end if;
      v_changed := true;
    elsif (v_op ->> 'op') = 'update' then
      v_id := (v_ev ->> 'id')::bigint;
      if not exists (select 1 from jsonb_array_elements(v_events) e where jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id')::bigint = v_id and e ->> 'cal' = v_share.calendar_id) then
        raise exception 'That event no longer exists';
      end if;
      select coalesce(jsonb_agg(case when jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id')::bigint = v_id and e ->> 'cal' = v_share.calendar_id
                                     then (e || v_clean) || jsonb_build_object('id', v_id, 'cal', v_share.calendar_id) else e end order by ord), '[]'::jsonb)
        into v_events from jsonb_array_elements(v_events) with ordinality as t(e, ord);
      v_changed := true;
    elsif (v_op ->> 'op') = 'delete' then
      v_id := (v_ev ->> 'id')::bigint;
      select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) into v_events
        from jsonb_array_elements(v_events) with ordinality as t(e, ord)
       where not (jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id')::bigint = v_id and e ->> 'cal' = v_share.calendar_id);
      v_changed := true;
    else
      raise exception 'Unknown change';
    end if;
  end loop;

  if v_changed then
    update public.workspace_snapshots set payload = jsonb_set(v_payload, '{events}', v_events), revision = revision + 1, updated_at = now()
     where user_id = v_share.owner_id;
  end if;
  return jsonb_build_object('created', v_created,
    'events', (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from jsonb_array_elements(v_events) with ordinality as t(e, ord) where e ->> 'cal' = v_share.calendar_id));
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on function public.daylight_search_people(text) from public, anon;
revoke all on function public.daylight_send_calendar_share(text, uuid, text) from public, anon;
revoke all on function public.daylight_list_calendar_shares(text) from public, anon;
revoke all on function public.daylight_set_calendar_share_permission(uuid, text) from public, anon;
revoke all on function public.daylight_revoke_calendar_share(uuid) from public, anon;
revoke all on function public.daylight_list_my_invites() from public, anon;
revoke all on function public.daylight_respond_calendar_share(uuid, boolean) from public, anon;
revoke all on function public.daylight_clear_calendar_invite(uuid) from public, anon;
revoke all on function public.daylight_leave_calendar_share(uuid) from public, anon;
revoke all on function public.daylight_list_my_shared_calendars() from public, anon;
revoke all on function public.daylight_shared_calendar_events(uuid) from public, anon;
revoke all on function public.daylight_apply_shared_event_ops(uuid, jsonb) from public, anon;
grant execute on function public.daylight_search_people(text) to authenticated;
grant execute on function public.daylight_send_calendar_share(text, uuid, text) to authenticated;
grant execute on function public.daylight_list_calendar_shares(text) to authenticated;
grant execute on function public.daylight_set_calendar_share_permission(uuid, text) to authenticated;
grant execute on function public.daylight_revoke_calendar_share(uuid) to authenticated;
grant execute on function public.daylight_list_my_invites() to authenticated;
grant execute on function public.daylight_respond_calendar_share(uuid, boolean) to authenticated;
grant execute on function public.daylight_clear_calendar_invite(uuid) to authenticated;
grant execute on function public.daylight_leave_calendar_share(uuid) to authenticated;
grant execute on function public.daylight_list_my_shared_calendars() to authenticated;
grant execute on function public.daylight_shared_calendar_events(uuid) to authenticated;
grant execute on function public.daylight_apply_shared_event_ops(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'table' as check, case when to_regclass('public.daylight_calendar_shares') is not null then 'ok' else 'MISSING' end as result
union all select 'row security on', case when (select relrowsecurity from pg_class where oid = 'public.daylight_calendar_shares'::regclass) then 'ok' else 'MISSING' end
union all select 'search', case when to_regprocedure('public.daylight_search_people(text)') is not null then 'ok' else 'MISSING' end
union all select 'send invite', case when to_regprocedure('public.daylight_send_calendar_share(text,uuid,text)') is not null then 'ok' else 'MISSING' end
union all select 'write events', case when to_regprocedure('public.daylight_apply_shared_event_ops(uuid,jsonb)') is not null then 'ok' else 'MISSING' end
union all select 'browser roles have no table access', case when not has_table_privilege('authenticated', 'public.daylight_calendar_shares', 'select') then 'ok' else 'OPEN' end;
