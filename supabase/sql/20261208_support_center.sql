-- ============================================================================
-- Support Center: tickets, chat messages, photo uploads, data exports given in a ticket.
-- Browsers never touch these tables: they call the functions below, which only ever act as the signed-in person.
-- A person sees only their own tickets; owners (daylight_owners) see every ticket. Safe to run more than once.
-- Replaces the earlier emailed data-request flow (data_requests / data-request function), which is removed at the end.
-- ============================================================================
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null default '',
  user_name text not null default '',
  title text not null,
  kind text not null default 'ticket' check (kind in ('ticket', 'data')),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by text check (closed_by in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_sender text not null default 'user',
  user_seen_at timestamptz,
  admin_seen_at timestamptz
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin', 'system')),
  sender_id uuid,
  kind text not null default 'text' check (kind in ('text', 'export', 'system')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, last_message_at desc);
create index if not exists support_tickets_open_idx on public.support_tickets (status, last_message_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from public, anon, authenticated;

-- notifications can point at a ticket (the bell opens it)
alter table public.daylight_broadcasts add column if not exists ticket_id uuid;

drop function if exists public.daylight_list_broadcasts();
create function public.daylight_list_broadcasts()
returns table(id uuid, title text, body text, sender text, created_at timestamptz, read boolean, ticket_id uuid)
language sql security definer set search_path = '' as $$
  select b.id, b.title, b.body, b.sender, b.created_at, (r.broadcast_id is not null) as read, b.ticket_id
  from public.daylight_broadcasts b
  left join public.daylight_broadcast_reads r on r.broadcast_id = b.id and r.user_id = auth.uid()
  where auth.uid() is not null
    and not exists (select 1 from public.daylight_broadcast_clears c where c.broadcast_id = b.id and c.user_id = auth.uid())
    and (
      (b.audience = 'everyone'
        and (public.daylight_is_owner()
             or b.created_at >= coalesce((select u.created_at from auth.users u where u.id = auth.uid()), '-infinity'::timestamptz)))
      or (b.audience = 'specific'
        and exists (select 1 from public.daylight_broadcast_recipients p where p.broadcast_id = b.id and p.user_id = auth.uid()))
    )
  order by b.created_at desc
  limit 30
$$;
revoke all on function public.daylight_list_broadcasts() from public, anon;
grant execute on function public.daylight_list_broadcasts() to authenticated;

-- ------------------------------------------------------------------ private bucket for photos and exports
-- path: <ticket owner's user id>/<ticket id>/<file>. Exports are named export-*.zip and stop being readable after 24 hours.
insert into storage.buckets (id, name, public, file_size_limit)
values ('support-files', 'support-files', false, 52428800)
on conflict (id) do update set public = false;
drop policy if exists "support files read" on storage.objects;
drop policy if exists "support files upload" on storage.objects;
create policy "support files read" on storage.objects for select to authenticated
  using (bucket_id = 'support-files'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.daylight_is_owner())
    and (name !~ '/export-[^/]*$' or created_at > now() - interval '24 hours'));
create policy "support files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'support-files' and name !~ '/export-[^/]*$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.daylight_is_owner()));

-- ------------------------------------------------------------------ internals
create or replace function public.support_attachments_ok(p_atts jsonb, p_prefix text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare a jsonb;
begin
  if p_atts is null or jsonb_typeof(p_atts) <> 'array' then return false; end if;
  if jsonb_array_length(p_atts) > 4 then return false; end if;
  for a in select * from jsonb_array_elements(p_atts) loop
    if coalesce(a->>'path', '') !~ ('^' || p_prefix || '[^/]+$') or coalesce(a->>'type', '') !~ '^image/' or (a->>'path') ~ '/export-' then return false; end if;
  end loop;
  return true;
end $$;

-- one notification, unless the same person already has an unread one for this ticket
create or replace function public.support_notify(p_ticket_id uuid, p_to_admin boolean, p_title text, p_body text, p_sender text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; bid uuid;
begin
  select * into t from public.support_tickets where id = p_ticket_id;
  if not found then return; end if;
  if p_to_admin then
    if exists (select 1 from public.daylight_broadcasts b where b.ticket_id = t.id and b.sender = 'ticket' and b.created_at > now() - interval '30 minutes'
               and not exists (select 1 from public.daylight_broadcast_reads r join public.daylight_owners o on o.user_id = r.user_id where r.broadcast_id = b.id)) then return; end if;
    insert into public.daylight_broadcasts (title, body, sender, audience, ticket_id) values (left(p_title, 120), left(p_body, 1000), p_sender, 'specific', t.id) returning id into bid;
    insert into public.daylight_broadcast_recipients (broadcast_id, user_id) select bid, o.user_id from public.daylight_owners o;
  else
    if exists (select 1 from public.daylight_broadcasts b join public.daylight_broadcast_recipients p on p.broadcast_id = b.id and p.user_id = t.user_id
               where b.ticket_id = t.id and b.sender = 'support'
                 and not exists (select 1 from public.daylight_broadcast_reads r where r.broadcast_id = b.id and r.user_id = t.user_id)) then return; end if;
    insert into public.daylight_broadcasts (title, body, sender, audience, ticket_id) values (left(p_title, 120), left(p_body, 1000), p_sender, 'specific', t.id) returning id into bid;
    insert into public.daylight_broadcast_recipients (broadcast_id, user_id) values (bid, t.user_id);
  end if;
end $$;

-- the one place a message is written (used by the functions below and by the support Edge Function with the service role)
create or replace function public.support_post(p_ticket_id uuid, p_sender text, p_sender_id uuid, p_kind text, p_body text, p_atts jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; mid uuid; other_seen timestamptz; viewing boolean;
begin
  select * into t from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'That ticket does not exist.'; end if;
  if t.status = 'closed' and p_sender <> 'system' then raise exception 'This ticket is closed.'; end if;
  insert into public.support_messages (ticket_id, sender, sender_id, kind, body, attachments) values (t.id, p_sender, p_sender_id, p_kind, p_body, coalesce(p_atts, '[]'::jsonb)) returning id into mid;
  update public.support_tickets set updated_at = now(), last_message_at = now(), last_sender = p_sender,
         user_seen_at = case when p_sender = 'user' then now() else user_seen_at end,
         admin_seen_at = case when p_sender = 'admin' then now() else admin_seen_at end where id = t.id;
  if p_sender = 'admin' then
    viewing := coalesce(t.user_seen_at > now() - interval '20 seconds', false);
    if not viewing then perform public.support_notify(t.id, false, case when p_kind = 'export' then 'has an update on your support ticket' else 'replied to your support ticket' end, t.title, 'support'); end if;
  elsif p_sender = 'user' then
    viewing := coalesce(t.admin_seen_at > now() - interval '20 seconds', false);
    if not viewing then perform public.support_notify(t.id, true, case when t.user_name <> '' then t.user_name else t.user_email end, 'replied to a support ticket: ' || t.title, 'ticket'); end if;
  end if;
  return mid;
end $$;
revoke all on function public.support_post(uuid, text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.support_notify(uuid, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.support_post(uuid, text, uuid, text, text, jsonb) to service_role;

-- ------------------------------------------------------------------ the person
create or replace function public.support_ticket_create(p_id uuid, p_title text, p_body text, p_kind text, p_atts jsonb default '[]')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); u record; tid uuid := coalesce(p_id, gen_random_uuid()); ttl text := btrim(coalesce(p_title, '')); bd text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if p_kind not in ('ticket', 'data') then raise exception 'Unknown ticket type.'; end if;
  if char_length(ttl) < 1 or char_length(ttl) > 120 then raise exception 'Add a title (up to 120 characters).'; end if;
  if char_length(bd) > 4000 or (p_kind = 'ticket' and char_length(bd) < 1) then raise exception 'Describe the problem (up to 4000 characters).'; end if;
  if not public.support_attachments_ok(coalesce(p_atts, '[]'), uid::text || '/' || tid::text || '/') then raise exception 'Those photos can''t be attached.'; end if;
  if (select count(*) from public.support_tickets where user_id = uid and created_at > now() - interval '1 hour') >= 10 then raise exception 'Too many tickets just now. Please try again later.'; end if;
  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') as nm into u from auth.users where id = uid;
  insert into public.support_tickets (id, user_id, user_email, user_name, title, kind) values (tid, uid, coalesce(u.email, ''), coalesce(u.nm, ''), ttl, p_kind);
  perform public.support_post(tid, 'user', uid, 'text', case when bd = '' then 'Please send me a copy of my data.' else bd end, coalesce(p_atts, '[]'));
  return tid;
end $$;

create or replace function public.support_ticket_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'status', status, 'created_at', created_at, 'last_message_at', last_message_at, 'last_sender', last_sender,
           'unread', (last_sender <> 'user' and (user_seen_at is null or user_seen_at < last_message_at))) order by status, last_message_at desc)
         from (select * from public.support_tickets where user_id = auth.uid() order by last_message_at desc limit 100) q), '[]'::jsonb);
end $$;

-- admin: every ticket of one status
create or replace function public.support_admin_list(p_status text default 'open')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'status', status, 'user_email', user_email, 'user_name', user_name, 'created_at', created_at,
           'last_message_at', last_message_at, 'last_sender', last_sender, 'unread', (last_sender = 'user' and (admin_seen_at is null or admin_seen_at < last_message_at))) order by last_message_at desc)
         from (select * from public.support_tickets where status = p_status order by last_message_at desc limit 200) q), '[]'::jsonb);
end $$;

-- open one ticket: returns the ticket and its messages, and counts as "viewing" for the caller's side while p_viewing is true
create or replace function public.support_ticket_get(p_id uuid, p_viewing boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; adm boolean := public.daylight_is_owner(); res jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into t from public.support_tickets where id = p_id;
  if not found or (t.user_id <> auth.uid() and not adm) then raise exception 'That ticket does not exist.'; end if;
  if p_viewing then
    if t.user_id = auth.uid() then update public.support_tickets set user_seen_at = now() where id = t.id;
    else update public.support_tickets set admin_seen_at = now() where id = t.id; end if;
  end if;
  res := jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'title', t.title, 'kind', t.kind, 'status', t.status, 'closed_by', t.closed_by, 'user_id', t.user_id,
           'user_email', t.user_email, 'user_name', t.user_name, 'created_at', t.created_at, 'mine', t.user_id = auth.uid()),
         'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'kind', m.kind, 'body', m.body, 'attachments', m.attachments, 'created_at', m.created_at) order by m.created_at)
                               from public.support_messages m where m.ticket_id = t.id), '[]'::jsonb));
  return res;
end $$;

create or replace function public.support_send(p_id uuid, p_body text, p_atts jsonb default '[]')
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; adm boolean := public.daylight_is_owner(); bd text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into t from public.support_tickets where id = p_id;
  if not found or (t.user_id <> auth.uid() and not adm) then raise exception 'That ticket does not exist.'; end if;
  if char_length(bd) > 4000 then raise exception 'That message is too long.'; end if;
  if bd = '' and jsonb_array_length(coalesce(p_atts, '[]')) = 0 then raise exception 'Write a message or attach a photo.'; end if;
  if not public.support_attachments_ok(coalesce(p_atts, '[]'), t.user_id::text || '/' || t.id::text || '/') then raise exception 'Those photos can''t be attached.'; end if;
  return public.support_post(t.id, case when t.user_id = auth.uid() then 'user' else 'admin' end, auth.uid(), 'text', bd, coalesce(p_atts, '[]'));
end $$;

create or replace function public.support_close(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; adm boolean := public.daylight_is_owner(); who text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into t from public.support_tickets where id = p_id for update;
  if not found or (t.user_id <> auth.uid() and not adm) then raise exception 'That ticket does not exist.'; end if;
  if t.status = 'closed' then return; end if;
  who := case when t.user_id = auth.uid() then 'user' else 'admin' end;
  update public.support_tickets set status = 'closed', closed_by = who, updated_at = now() where id = t.id;
  insert into public.support_messages (ticket_id, sender, kind, body) values (t.id, 'system', 'system', case when who = 'user' then 'The ticket was closed by the person who opened it.' else 'The ticket was closed by Daylight Support.' end);
  update public.support_tickets set last_message_at = now(), last_sender = 'system' where id = t.id;
end $$;

revoke all on function public.support_attachments_ok(jsonb, text), public.support_ticket_create(uuid, text, text, text, jsonb), public.support_ticket_list(), public.support_admin_list(text),
  public.support_ticket_get(uuid, boolean), public.support_send(uuid, text, jsonb), public.support_close(uuid) from public, anon;
grant execute on function public.support_ticket_create(uuid, text, text, text, jsonb), public.support_ticket_list(), public.support_admin_list(text),
  public.support_ticket_get(uuid, boolean), public.support_send(uuid, text, jsonb), public.support_close(uuid) to authenticated;

notify pgrst, 'reload schema';
select 'support ready' as check, case when to_regclass('public.support_tickets') is not null and to_regclass('public.support_messages') is not null then 'ok' else 'MISSING' end as result;
