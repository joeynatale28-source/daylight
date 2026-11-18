-- ============================================================================
-- Data requests: "Export my data" and "Delete my data" (Settings -> Your data), reviewed by the owner in Admin.
-- Nothing is fulfilled here: approving (and building the export / deleting) happens in the `data-request` Edge Function,
-- which re-checks that the caller is the owner. People only ever see and cancel their OWN requests.
-- Safe to run more than once.
-- ============================================================================
create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                       -- deliberately no foreign key: the row must outlive a deleted account
  email text not null,
  kind text not null check (kind in ('export', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'sent', 'completed', 'rejected', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text not null default '',
  export_path text,                            -- private storage object (bucket data-exports); never shown to the person
  link_expires_at timestamptz,
  email_sent_at timestamptz,
  email_error text
);
alter table public.data_requests enable row level security;
revoke all on public.data_requests from anon, authenticated;   -- no direct access: only the functions below

create index if not exists data_requests_user_idx on public.data_requests (user_id, created_at desc);
create index if not exists data_requests_open_idx on public.data_requests (status) where status in ('pending', 'in_review', 'approved');

-- private bucket for the finished export files (the Edge Function uses the service role; no policies = nobody else can touch it)
insert into storage.buckets (id, name, public, file_size_limit)
values ('data-exports', 'data-exports', false, 52428800)
on conflict (id) do update set public = false;

-- ------------------------------------------------------------------ the signed-in person
create or replace function public.data_request_create(p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mail text; r public.data_requests;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if p_kind not in ('export', 'delete') then raise exception 'Unknown request.'; end if;
  select email into mail from auth.users where id = uid;
  if exists (select 1 from public.data_requests where user_id = uid and kind = p_kind and status in ('pending', 'in_review', 'approved')) then
    raise exception 'You already have an open % request.', p_kind;
  end if;
  insert into public.data_requests (user_id, email, kind) values (uid, coalesce(mail, ''), p_kind) returning * into r;
  return jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status, 'created_at', r.created_at);
end $$;

create or replace function public.data_request_mine()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'created_at', created_at, 'updated_at', updated_at, 'link_expires_at', link_expires_at, 'email_sent_at', email_sent_at) order by created_at desc)
                   from (select * from public.data_requests where user_id = auth.uid() order by created_at desc limit 20) q), '[]'::jsonb);
end $$;

create or replace function public.data_request_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update public.data_requests set status = 'canceled', updated_at = now()
   where id = p_id and user_id = auth.uid() and status in ('pending', 'in_review');
  if not found then raise exception 'That request can no longer be canceled.'; end if;
end $$;

-- ------------------------------------------------------------------ owner only (Admin)
create or replace function public.data_admin_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'email', email, 'kind', kind, 'status', status, 'created_at', created_at, 'reviewed_at', reviewed_at,
           'admin_note', admin_note, 'link_expires_at', link_expires_at, 'email_sent_at', email_sent_at, 'email_error', email_error) order by created_at desc)
         from (select * from public.data_requests order by created_at desc limit 200) q), '[]'::jsonb);
end $$;

-- review steps that do not touch any data: start review, reject, cancel
create or replace function public.data_admin_set_status(p_id uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  if p_status not in ('in_review', 'rejected', 'canceled') then raise exception 'Unknown status.'; end if;
  update public.data_requests
     set status = p_status, admin_note = coalesce(p_note, ''), updated_at = now(), reviewed_at = now()
   where id = p_id and status in ('pending', 'in_review');
  if not found then raise exception 'That request is not open.'; end if;
end $$;

revoke all on function public.data_request_create(text), public.data_request_mine(), public.data_request_cancel(uuid),
  public.data_admin_list(), public.data_admin_set_status(uuid, text, text) from public, anon;
grant execute on function public.data_request_create(text), public.data_request_mine(), public.data_request_cancel(uuid),
  public.data_admin_list(), public.data_admin_set_status(uuid, text, text) to authenticated;

select 'data_requests ready' as check, case when to_regclass('public.data_requests') is not null then 'ok' else 'MISSING' end as result;
