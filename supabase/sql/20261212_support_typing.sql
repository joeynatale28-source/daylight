-- Support chat: "is typing" indicator. Each side stamps its own typing time; the other side sees it for a few seconds.
alter table public.support_tickets add column if not exists user_typing_at timestamptz;
alter table public.support_tickets add column if not exists admin_typing_at timestamptz;

create or replace function public.support_typing(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; adm boolean := public.daylight_is_owner();
begin
  if auth.uid() is null then return; end if;
  select * into t from public.support_tickets where id = p_id;
  if not found or t.status <> 'open' or (t.user_id <> auth.uid() and not adm) then return; end if;
  if t.user_id = auth.uid() then update public.support_tickets set user_typing_at = now() where id = t.id;
  else update public.support_tickets set admin_typing_at = now() where id = t.id; end if;
end $$;
revoke all on function public.support_typing(uuid) from public, anon;
grant execute on function public.support_typing(uuid) to authenticated;

create or replace function public.support_ticket_get(p_id uuid, p_viewing boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; adm boolean := public.daylight_is_owner(); res jsonb; other_typing boolean;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into t from public.support_tickets where id = p_id;
  if not found or (t.user_id <> auth.uid() and not adm) then raise exception 'That ticket does not exist.'; end if;
  if p_viewing then
    if t.user_id = auth.uid() then update public.support_tickets set user_seen_at = now() where id = t.id;
    else update public.support_tickets set admin_seen_at = now() where id = t.id; end if;
  end if;
  other_typing := t.status = 'open' and coalesce(case when t.user_id = auth.uid() then t.admin_typing_at else t.user_typing_at end > now() - interval '6 seconds', false);
  res := jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'title', t.title, 'kind', t.kind, 'category', t.category, 'status', t.status, 'closed_by', t.closed_by, 'user_id', t.user_id,
           'user_email', t.user_email, 'user_name', t.user_name, 'created_at', t.created_at, 'mine', t.user_id = auth.uid(), 'other_typing', other_typing),
         'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'kind', m.kind, 'body', m.body, 'attachments', m.attachments, 'created_at', m.created_at) order by m.created_at)
                               from public.support_messages m where m.ticket_id = t.id), '[]'::jsonb));
  return res;
end $$;
revoke all on function public.support_ticket_get(uuid, boolean) from public, anon;
grant execute on function public.support_ticket_get(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
select 'ok' as result;
