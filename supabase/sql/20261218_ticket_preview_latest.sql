-- Ticket list previews show the latest real message (not the first one, never a blank/system line).
create or replace function public.support_ticket_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'category', category, 'status', status, 'created_at', created_at, 'last_message_at', last_message_at, 'last_sender', last_sender,
           'unread', (last_sender <> 'user' and (user_seen_at is null or user_seen_at < last_message_at)),
           'preview', left((select m.body from public.support_messages m where m.ticket_id = q.id and m.kind = 'text' and m.sender <> 'system' and btrim(m.body) <> '' order by m.created_at desc limit 1), 160)) order by status, last_message_at desc)
         from (select * from public.support_tickets where user_id = auth.uid() order by last_message_at desc limit 100) q), '[]'::jsonb);
end $$;

create or replace function public.support_admin_list(p_status text default 'open')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'category', category, 'status', status, 'user_email', user_email, 'user_name', user_name, 'created_at', created_at,
           'last_message_at', last_message_at, 'last_sender', last_sender, 'unread', (last_sender = 'user' and (admin_seen_at is null or admin_seen_at < last_message_at)),
           'preview', left((select m.body from public.support_messages m where m.ticket_id = q.id and m.kind = 'text' and m.sender <> 'system' and btrim(m.body) <> '' order by m.created_at desc limit 1), 160)) order by last_message_at desc)
         from (select * from public.support_tickets where status = p_status order by last_message_at desc limit 300) q), '[]'::jsonb);
end $$;


revoke all on function public.support_ticket_list() from public, anon;
revoke all on function public.support_admin_list(text) from public, anon;
grant execute on function public.support_ticket_list() to authenticated;
grant execute on function public.support_admin_list(text) to authenticated;
