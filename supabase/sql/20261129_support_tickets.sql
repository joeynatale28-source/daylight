-- In-app support: tickets and chat messages between a person and Daylight Support (the owner account).
-- ONE additive file: two new tables and new functions. Nothing existing is edited or dropped. Safe to run more than once.
-- Run AFTER 20261126_calendar_sharing.sql (it reuses daylight_person()) and 20261125_admin_dashboard.sql (support replies create
-- a notification for that ONE person using the notification tables created there).
--
-- Security (same pattern as broadcasts and sharing): row security is ON for both tables and browsers have NO direct table access.
-- Everything goes through security-definer functions that act as the signed-in user:
--   * a person can read and write ONLY their own tickets and the messages inside them;
--   * owners (daylight_owners) can read and write every ticket, through the daylight_support_admin_* functions, which refuse anyone else.
-- A support reply notifies exactly ONE account: the function inserts a notification addressed to the ticket owner's user id only
-- (audience 'specific' + one recipient row, inside the same transaction as the reply). It can never broadcast.

create table if not exists public.daylight_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  email text not null,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_user_message_at timestamptz not null default now(),
  admin_seen_at timestamptz
);
create index if not exists daylight_support_tickets_user_idx on public.daylight_support_tickets (user_id, updated_at desc);
create index if not exists daylight_support_tickets_status_idx on public.daylight_support_tickets (status, updated_at desc);

create table if not exists public.daylight_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.daylight_support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user', 'support')),
  sender_user_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists daylight_support_messages_ticket_idx on public.daylight_support_messages (ticket_id, created_at);

alter table public.daylight_support_tickets enable row level security;
alter table public.daylight_support_messages enable row level security;
revoke all on public.daylight_support_tickets from public, anon, authenticated;
revoke all on public.daylight_support_messages from public, anon, authenticated;
grant all on public.daylight_support_tickets to service_role;
grant all on public.daylight_support_messages to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- A person: create a ticket, list mine, read a thread, write a message
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_support_create_ticket(p_name text, p_email text, p_subject text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_email text := left(btrim(coalesce(p_email, '')), 200);
  v_subject text := left(btrim(coalesce(p_subject, '')), 200);
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if v_name = '' then raise exception 'Enter your name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if v_subject = '' then raise exception 'Enter a subject'; end if;
  if char_length(v_message) < 1 or char_length(v_message) > 5000 then raise exception 'Write a message (up to 5,000 characters)'; end if;
  if (select count(*) from public.daylight_support_tickets t where t.user_id = auth.uid() and t.status = 'open') >= 5 then
    raise exception 'You already have several open requests. Please reply in one of them.';
  end if;
  insert into public.daylight_support_tickets (user_id, name, email, subject) values (auth.uid(), v_name, v_email, v_subject) returning id into v_id;
  insert into public.daylight_support_messages (ticket_id, sender, sender_user_id, body) values (v_id, 'user', auth.uid(), v_message);
  return jsonb_build_object('id', v_id);
end
$$;

create or replace function public.daylight_support_my_tickets()
returns table(id uuid, subject text, status text, created_at timestamptz, updated_at timestamptz, last_body text, last_sender text)
language sql
security definer
set search_path = ''
as $$
  select t.id, t.subject, t.status, t.created_at, t.updated_at,
         (select m.body from public.daylight_support_messages m where m.ticket_id = t.id order by m.created_at desc limit 1),
         (select m.sender from public.daylight_support_messages m where m.ticket_id = t.id order by m.created_at desc limit 1)
  from public.daylight_support_tickets t
  where auth.uid() is not null and t.user_id = auth.uid()
  order by t.updated_at desc
  limit 50
$$;

-- The messages of one ticket: the ticket's own person, or an owner.
create or replace function public.daylight_support_thread(p_ticket uuid)
returns table(id uuid, sender text, body text, created_at timestamptz, name text, avatar_url text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not exists (select 1 from public.daylight_support_tickets t where t.id = p_ticket and (t.user_id = auth.uid() or public.daylight_is_owner())) then
    raise exception 'Ticket not found';
  end if;
  return query
    select m.id, m.sender, m.body, m.created_at,
           case when m.sender = 'user' then (select t.name from public.daylight_support_tickets t where t.id = m.ticket_id) else 'Daylight Support' end,
           case when m.sender = 'user' then (public.daylight_person(m.sender_user_id) ->> 'avatar') else null end
    from public.daylight_support_messages m
    where m.ticket_id = p_ticket
    order by m.created_at;
end
$$;

-- A person writes in their own ticket (a reply to a closed ticket reopens it).
create or replace function public.daylight_support_send(p_ticket uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 5000 then raise exception 'Write a message (up to 5,000 characters)'; end if;
  if not exists (select 1 from public.daylight_support_tickets t where t.id = p_ticket and t.user_id = auth.uid()) then raise exception 'Ticket not found'; end if;
  insert into public.daylight_support_messages (ticket_id, sender, sender_user_id, body) values (p_ticket, 'user', auth.uid(), v_body);
  update public.daylight_support_tickets set status = 'open', updated_at = now(), last_user_message_at = now() where id = p_ticket;
  return jsonb_build_object('sent', true);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Owners: list everything, reply (notifies that ONE person), open / close, mark seen
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_support_admin_list()
returns table(id uuid, user_id uuid, name text, email text, avatar_url text, subject text, status text, created_at timestamptz, updated_at timestamptz,
              last_body text, last_sender text, unread boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return query
    select t.id, t.user_id, t.name, t.email, (public.daylight_person(t.user_id) ->> 'avatar'), t.subject, t.status, t.created_at, t.updated_at,
           (select m.body from public.daylight_support_messages m where m.ticket_id = t.id order by m.created_at desc limit 1),
           (select m.sender from public.daylight_support_messages m where m.ticket_id = t.id order by m.created_at desc limit 1),
           (t.admin_seen_at is null or t.last_user_message_at > t.admin_seen_at)
    from public.daylight_support_tickets t
    order by t.updated_at desc
    limit 200;
end
$$;

create or replace function public.daylight_support_admin_seen(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  update public.daylight_support_tickets set admin_seen_at = now() where id = p_ticket;
  return jsonb_build_object('seen', true);
end
$$;

create or replace function public.daylight_support_admin_reply(p_ticket uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_user uuid;
  v_note uuid;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 5000 then raise exception 'Write a message (up to 5,000 characters)'; end if;
  select t.user_id into v_user from public.daylight_support_tickets t where t.id = p_ticket;
  if v_user is null then raise exception 'Ticket not found'; end if;
  insert into public.daylight_support_messages (ticket_id, sender, sender_user_id, body) values (p_ticket, 'support', auth.uid(), v_body);
  update public.daylight_support_tickets set updated_at = now(), admin_seen_at = now() where id = p_ticket;
  -- ONE notification, addressed to this ticket's person only (audience 'specific' + a single recipient row). Never 'everyone'.
  insert into public.daylight_broadcasts (title, body, sender, audience, created_by)
  values ('Daylight Support', 'Daylight Support replied to your ticket', 'support', 'specific', auth.uid())
  returning id into v_note;
  insert into public.daylight_broadcast_recipients (broadcast_id, user_id) values (v_note, v_user);
  return jsonb_build_object('sent', true);
end
$$;

create or replace function public.daylight_support_admin_set_status(p_ticket uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  if p_status not in ('open', 'closed') then raise exception 'Choose open or closed'; end if;
  update public.daylight_support_tickets set status = p_status, updated_at = now() where id = p_ticket;
  if not found then raise exception 'Ticket not found'; end if;
  return jsonb_build_object('status', p_status);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on function public.daylight_support_create_ticket(text, text, text, text) from public, anon;
revoke all on function public.daylight_support_my_tickets() from public, anon;
revoke all on function public.daylight_support_thread(uuid) from public, anon;
revoke all on function public.daylight_support_send(uuid, text) from public, anon;
revoke all on function public.daylight_support_admin_list() from public, anon;
revoke all on function public.daylight_support_admin_seen(uuid) from public, anon;
revoke all on function public.daylight_support_admin_reply(uuid, text) from public, anon;
revoke all on function public.daylight_support_admin_set_status(uuid, text) from public, anon;
grant execute on function public.daylight_support_create_ticket(text, text, text, text) to authenticated;
grant execute on function public.daylight_support_my_tickets() to authenticated;
grant execute on function public.daylight_support_thread(uuid) to authenticated;
grant execute on function public.daylight_support_send(uuid, text) to authenticated;
grant execute on function public.daylight_support_admin_list() to authenticated;
grant execute on function public.daylight_support_admin_seen(uuid) to authenticated;
grant execute on function public.daylight_support_admin_reply(uuid, text) to authenticated;
grant execute on function public.daylight_support_admin_set_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'tickets table' as check, case when to_regclass('public.daylight_support_tickets') is not null then 'ok' else 'MISSING' end as result
union all select 'messages table', case when to_regclass('public.daylight_support_messages') is not null then 'ok' else 'MISSING' end
union all select 'create ticket', case when to_regprocedure('public.daylight_support_create_ticket(text,text,text,text)') is not null then 'ok' else 'MISSING' end
union all select 'admin reply', case when to_regprocedure('public.daylight_support_admin_reply(uuid,text)') is not null then 'ok' else 'MISSING' end
union all select 'row security on', case when (select count(*) from pg_class where oid in ('public.daylight_support_tickets'::regclass,'public.daylight_support_messages'::regclass) and relrowsecurity) = 2 then 'ok' else 'OFF' end
union all select 'browser roles have no table access', case when not has_table_privilege('authenticated', 'public.daylight_support_tickets', 'select') and not has_table_privilege('authenticated', 'public.daylight_support_messages', 'select') then 'ok' else 'OPEN' end;
