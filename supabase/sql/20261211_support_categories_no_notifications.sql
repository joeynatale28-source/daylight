-- Support Center follow-up: (1) no notifications for tickets at all, (2) ticket categories (required), preview text for the admin list.
-- Safe to run more than once.

-- ---- 1. remove ticket notifications everywhere
delete from public.daylight_broadcasts where ticket_id is not null;      -- reads, clears and recipients go with them (cascade)
drop function if exists public.support_notify(uuid, boolean, text, text, text);
drop function if exists public.daylight_list_broadcasts();
create function public.daylight_list_broadcasts()
returns table(id uuid, title text, body text, sender text, created_at timestamptz, read boolean)
language sql security definer set search_path = '' as $$
  select b.id, b.title, b.body, b.sender, b.created_at, (r.broadcast_id is not null) as read
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
alter table public.daylight_broadcasts drop column if exists ticket_id;

-- messages are still written in one place, now without any notification
create or replace function public.support_post(p_ticket_id uuid, p_sender text, p_sender_id uuid, p_kind text, p_body text, p_atts jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; mid uuid;
begin
  select * into t from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'That ticket does not exist.'; end if;
  if t.status = 'closed' and p_sender <> 'system' then raise exception 'This ticket is closed.'; end if;
  insert into public.support_messages (ticket_id, sender, sender_id, kind, body, attachments) values (t.id, p_sender, p_sender_id, p_kind, p_body, coalesce(p_atts, '[]'::jsonb)) returning id into mid;
  update public.support_tickets set updated_at = now(), last_message_at = now(), last_sender = p_sender,
         user_seen_at = case when p_sender = 'user' then now() else user_seen_at end,
         admin_seen_at = case when p_sender = 'admin' then now() else admin_seen_at end where id = t.id;
  return mid;
end $$;
revoke all on function public.support_post(uuid, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.support_post(uuid, text, uuid, text, text, jsonb) to service_role;

-- ---- 2. categories
alter table public.support_tickets add column if not exists category text not null default 'other';
alter table public.support_tickets drop constraint if exists support_tickets_category_check;
alter table public.support_tickets add constraint support_tickets_category_check check (category in ('feature', 'bug', 'account', 'data', 'other'));
update public.support_tickets set category = 'data' where kind = 'data' and category = 'other';

drop function if exists public.support_ticket_create(uuid, text, text, text, jsonb);
create function public.support_ticket_create(p_id uuid, p_title text, p_body text, p_kind text, p_category text, p_atts jsonb default '[]')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); u record; tid uuid := coalesce(p_id, gen_random_uuid()); ttl text := btrim(coalesce(p_title, '')); bd text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if p_kind not in ('ticket', 'data') then raise exception 'Unknown ticket type.'; end if;
  if p_category is null or p_category not in ('feature', 'bug', 'account', 'data', 'other') then raise exception 'Pick a category.'; end if;
  if char_length(ttl) < 1 or char_length(ttl) > 120 then raise exception 'Add a title (up to 120 characters).'; end if;
  if char_length(bd) > 4000 or (p_kind = 'ticket' and char_length(bd) < 1) then raise exception 'Describe the problem (up to 4000 characters).'; end if;
  if not public.support_attachments_ok(coalesce(p_atts, '[]'), uid::text || '/' || tid::text || '/') then raise exception 'Those photos can''t be attached.'; end if;
  if (select count(*) from public.support_tickets where user_id = uid and created_at > now() - interval '1 hour') >= 10 then raise exception 'Too many tickets just now. Please try again later.'; end if;
  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') as nm into u from auth.users where id = uid;
  insert into public.support_tickets (id, user_id, user_email, user_name, title, kind, category) values (tid, uid, coalesce(u.email, ''), coalesce(u.nm, ''), ttl, p_kind, p_category);
  perform public.support_post(tid, 'user', uid, 'text', case when bd = '' then 'Please send me a copy of my data.' else bd end, coalesce(p_atts, '[]'));
  return tid;
end $$;

create or replace function public.support_ticket_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'category', category, 'status', status, 'created_at', created_at, 'last_message_at', last_message_at, 'last_sender', last_sender,
           'unread', (last_sender <> 'user' and (user_seen_at is null or user_seen_at < last_message_at)),
           'preview', left((select m.body from public.support_messages m where m.ticket_id = q.id and m.sender = 'user' order by m.created_at limit 1), 160)) order by status, last_message_at desc)
         from (select * from public.support_tickets where user_id = auth.uid() order by last_message_at desc limit 100) q), '[]'::jsonb);
end $$;

create or replace function public.support_admin_list(p_status text default 'open')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'category', category, 'status', status, 'user_email', user_email, 'user_name', user_name, 'created_at', created_at,
           'last_message_at', last_message_at, 'last_sender', last_sender, 'unread', (last_sender = 'user' and (admin_seen_at is null or admin_seen_at < last_message_at)),
           'preview', left((select m.body from public.support_messages m where m.ticket_id = q.id and m.sender = 'user' order by m.created_at limit 1), 160)) order by last_message_at desc)
         from (select * from public.support_tickets where status = p_status order by last_message_at desc limit 300) q), '[]'::jsonb);
end $$;

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
  res := jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'title', t.title, 'kind', t.kind, 'category', t.category, 'status', t.status, 'closed_by', t.closed_by, 'user_id', t.user_id,
           'user_email', t.user_email, 'user_name', t.user_name, 'created_at', t.created_at, 'mine', t.user_id = auth.uid()),
         'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'kind', m.kind, 'body', m.body, 'attachments', m.attachments, 'created_at', m.created_at) order by m.created_at)
                               from public.support_messages m where m.ticket_id = t.id), '[]'::jsonb));
  return res;
end $$;

revoke all on function public.support_ticket_create(uuid, text, text, text, text, jsonb), public.support_ticket_list(), public.support_admin_list(text), public.support_ticket_get(uuid, boolean) from public, anon;
grant execute on function public.support_ticket_create(uuid, text, text, text, text, jsonb), public.support_ticket_list(), public.support_admin_list(text), public.support_ticket_get(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
select 'ok' as result, (select count(*) from public.daylight_broadcasts where sender in ('support','ticket'))::int as leftover_ticket_notifications;
