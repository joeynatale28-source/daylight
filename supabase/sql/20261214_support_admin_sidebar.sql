-- Admin sidebar on a support ticket. Everything the admin sees about a person comes from THIS ticket's context: ticket details, the person's account
-- status (name, e-mail, created, last active), their other tickets, the admin-action log and data-request history. Never calendars, events or tasks.
-- Actions (reset password, change e-mail, suspend, ban, lift, private message, give data) run in the support-admin / support Edge Functions and are logged here.
create table if not exists public.support_admin_actions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.support_tickets(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid,
  admin_email text not null default '',
  action text not null check (action in ('reset_password', 'change_email', 'suspend', 'ban', 'lift', 'private_message', 'give_data')),
  reason text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_admin_actions_user_idx on public.support_admin_actions (user_id, created_at desc);
alter table public.support_admin_actions enable row level security;
revoke all on public.support_admin_actions from public, anon, authenticated;

create table if not exists public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('suspended', 'banned')),
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,                       -- null = until an admin lifts it (always null for a ban)
  set_by uuid,
  lifted_at timestamptz,
  lifted_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists account_restrictions_user_idx on public.account_restrictions (user_id, created_at desc);
alter table public.account_restrictions enable row level security;
revoke all on public.account_restrictions from public, anon, authenticated;

create or replace function public.support_admin_context(p_ticket_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.support_tickets; u record; r record; res jsonb;
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  select * into t from public.support_tickets where id = p_ticket_id;
  if not found then raise exception 'That ticket does not exist.'; end if;
  select id, email, created_at, last_sign_in_at, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') as name into u from auth.users where id = t.user_id;
  select * into r from public.account_restrictions x where x.user_id = t.user_id and x.lifted_at is null and (x.ends_at is null or x.ends_at > now()) order by x.created_at desc limit 1;
  res := jsonb_build_object(
    'ticket', jsonb_build_object('id', t.id, 'ref', upper(left(replace(t.id::text, '-', ''), 8)), 'created_at', t.created_at, 'category', t.category, 'status', t.status, 'closed_by', t.closed_by,
       'last_sender', t.last_sender, 'last_message_at', t.last_message_at),
    'user', jsonb_build_object('name', coalesce(nullif(t.user_name, ''), u.name, ''), 'email', coalesce(u.email, t.user_email), 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
       'status', case when r.id is null then 'active' when r.kind = 'banned' then 'banned' else 'suspended' end,
       'restriction', case when r.id is null then null else jsonb_build_object('kind', r.kind, 'reason', r.reason, 'starts_at', r.starts_at, 'ends_at', r.ends_at) end),
    'history', jsonb_build_object(
       'tickets', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'status', x.status, 'category', x.category, 'created_at', x.created_at) order by x.created_at desc)
                            from (select * from public.support_tickets where user_id = t.user_id and id <> t.id order by created_at desc limit 25) x), '[]'::jsonb),
       'actions', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'reason', a.reason, 'detail', a.detail, 'admin_email', a.admin_email, 'created_at', a.created_at) order by a.created_at desc)
                            from (select * from public.support_admin_actions where user_id = t.user_id order by created_at desc limit 50) a), '[]'::jsonb)),
    'data', jsonb_build_object(
       'requests', (select count(*) from public.support_tickets where user_id = t.user_id and category = 'data'),
       'exports_given', (select count(*) from public.support_messages m join public.support_tickets s on s.id = m.ticket_id where s.user_id = t.user_id and m.kind = 'export'),
       'last_export_at', (select max(m.created_at) from public.support_messages m join public.support_tickets s on s.id = m.ticket_id where s.user_id = t.user_id and m.kind = 'export')));
  return res;
end $$;
revoke all on function public.support_admin_context(uuid) from public, anon;
grant execute on function public.support_admin_context(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'ok' as result;
