-- Restricted accounts (suspend / ban) can still sign in, but the app limits them to the Support Center and Settings, where they see why and can appeal.
-- Also: data requests can be fulfilled after the ticket is closed, and the "appeal" ticket category.

-- 1. the person's own restriction status (computed, so a suspension ends by itself when its time is up)
create or replace function public.my_account_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r public.account_restrictions;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'active'); end if;
  select * into r from public.account_restrictions x where x.user_id = auth.uid() and x.lifted_at is null and (x.ends_at is null or x.ends_at > now()) order by x.created_at desc limit 1;
  if not found then return jsonb_build_object('status', 'active'); end if;
  return jsonb_build_object('status', case when r.kind = 'banned' then 'banned' else 'suspended' end, 'reason', r.reason, 'starts_at', r.starts_at, 'ends_at', r.ends_at, 'appeal', 'privacy@daylightcal.com');
end $$;
revoke all on function public.my_account_status() from public, anon;
grant execute on function public.my_account_status() to authenticated;

-- 2. appeal category (only someone with an active restriction can open one)
alter table public.support_tickets drop constraint if exists support_tickets_category_check;
alter table public.support_tickets add constraint support_tickets_category_check check (category in ('feature', 'bug', 'account', 'data', 'other', 'appeal'));
create or replace function public.support_ticket_create(p_id uuid, p_title text, p_body text, p_kind text, p_category text, p_atts jsonb default '[]')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); u record; tid uuid := coalesce(p_id, gen_random_uuid()); ttl text := btrim(coalesce(p_title, '')); bd text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if p_kind not in ('ticket', 'data') then raise exception 'Unknown ticket type.'; end if;
  if p_category is null or p_category not in ('feature', 'bug', 'account', 'data', 'other', 'appeal') then raise exception 'Pick a category.'; end if;
  if p_category = 'appeal' and not exists (select 1 from public.account_restrictions x where x.user_id = uid and x.lifted_at is null and (x.ends_at is null or x.ends_at > now())) then raise exception 'There is nothing to appeal.'; end if;
  if char_length(ttl) < 1 or char_length(ttl) > 120 then raise exception 'Add a title (up to 120 characters).'; end if;
  if char_length(bd) > 4000 or (p_kind = 'ticket' and char_length(bd) < 1) then raise exception 'Describe the problem (up to 4000 characters).'; end if;
  if not public.support_attachments_ok(coalesce(p_atts, '[]'), uid::text || '/' || tid::text || '/') then raise exception 'Those photos can''t be attached.'; end if;
  if (select count(*) from public.support_tickets where user_id = uid and created_at > now() - interval '1 hour') >= 10 then raise exception 'Too many tickets just now. Please try again later.'; end if;
  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') as nm into u from auth.users where id = uid;
  insert into public.support_tickets (id, user_id, user_email, user_name, title, kind, category) values (tid, uid, coalesce(u.email, ''), coalesce(u.nm, ''), ttl, p_kind, p_category);
  perform public.support_post(tid, 'user', uid, 'text', case when bd = '' then 'Please send me a copy of my data.' else bd end, coalesce(p_atts, '[]'));
  return tid;
end $$;

-- 3. a data export may be posted on a closed data-request ticket
create or replace function public.support_post(p_ticket_id uuid, p_sender text, p_sender_id uuid, p_kind text, p_body text, p_atts jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; mid uuid;
begin
  select * into t from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'That ticket does not exist.'; end if;
  if t.status = 'closed' and p_sender <> 'system' and not (p_kind = 'export' and t.category = 'data') then raise exception 'This ticket is closed.'; end if;
  insert into public.support_messages (ticket_id, sender, sender_id, kind, body, attachments) values (t.id, p_sender, p_sender_id, p_kind, p_body, coalesce(p_atts, '[]'::jsonb)) returning id into mid;
  update public.support_tickets set updated_at = now(), last_message_at = now(), last_sender = p_sender,
         user_seen_at = case when p_sender = 'user' then now() else user_seen_at end,
         admin_seen_at = case when p_sender = 'admin' then now() else admin_seen_at end where id = t.id;
  return mid;
end $$;
revoke all on function public.support_post(uuid, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.support_post(uuid, text, uuid, text, text, jsonb) to service_role;

-- the sign-in notice helper is no longer needed (restricted people sign in and see the notice inside the app)
drop function if exists public.account_notice_check(text, text);
notify pgrst, 'reload schema';
select 'ok' as result;
