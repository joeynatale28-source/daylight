-- Admin dashboard backend, added on top of the broadcast notifications that are already live
-- (20261124_broadcast_notifications.sql, which is NOT edited or re-run here).
--
--   * targeted notifications: send to everyone, or only to the accounts behind a list of email addresses;
--   * banners: owner-posted, undismissable, top-of-app messages with a color and an optional link;
--   * per-user clear: every account can clear a notification from its own list, for itself only;
--   * the owner always sees every notification in the bell, so the account that sends one is never left out.
--
-- Run it ONCE in the Supabase SQL Editor. It only adds: new tables, new columns, new functions, and a replacement of
-- daylight_list_broadcasts() that keeps the same shape. Nothing is dropped and no rows are changed. If a statement fails
-- because something with the same name already exists in a different form, stop and tell whoever maintains the app.
--
-- Same security pattern as before: row security on, no direct table access from browsers, everything goes through
-- security-definer functions that act as the signed-in user; owner-only actions are refused in the function itself.

-- ---------------------------------------------------------------------------------------------------------------------
-- New columns on the existing notifications table
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.daylight_broadcasts add column if not exists audience text not null default 'everyone';
alter table public.daylight_broadcasts add column if not exists created_by uuid;

-- ---------------------------------------------------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------------------------------------------------
create table public.daylight_broadcast_recipients (
  broadcast_id uuid not null references public.daylight_broadcasts(id) on delete cascade,
  user_id uuid not null,
  primary key (broadcast_id, user_id)
);

create table public.daylight_broadcast_clears (
  user_id uuid not null,
  broadcast_id uuid not null references public.daylight_broadcasts(id) on delete cascade,
  cleared_at timestamptz not null default now(),
  primary key (user_id, broadcast_id)
);

create table public.daylight_banners (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  color text not null,
  link text,
  audience text not null default 'everyone',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.daylight_banner_recipients (
  banner_id uuid not null references public.daylight_banners(id) on delete cascade,
  user_id uuid not null,
  primary key (banner_id, user_id)
);

alter table public.daylight_broadcast_recipients enable row level security;
alter table public.daylight_broadcast_clears enable row level security;
alter table public.daylight_banners enable row level security;
alter table public.daylight_banner_recipients enable row level security;
revoke all on public.daylight_broadcast_recipients from public, anon, authenticated;
revoke all on public.daylight_broadcast_clears from public, anon, authenticated;
revoke all on public.daylight_banners from public, anon, authenticated;
revoke all on public.daylight_banner_recipients from public, anon, authenticated;
grant all on public.daylight_broadcast_recipients to service_role;
grant all on public.daylight_broadcast_clears to service_role;
grant all on public.daylight_banners to service_role;
grant all on public.daylight_banner_recipients to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- What the bell panel lists (same columns as before).
-- Visible to an account when it is addressed (everyone, or named as a recipient), and not cleared by that account.
-- "Everyone" messages sent before an account existed are not shown to it, except that OWNERS see every message.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_list_broadcasts()
returns table(id uuid, title text, body text, sender text, created_at timestamptz, read boolean)
language sql
security definer
set search_path = ''
as $$
  select b.id, b.title, b.body, b.sender, b.created_at, (r.broadcast_id is not null) as read
  from public.daylight_broadcasts b
  left join public.daylight_broadcast_reads r
    on r.broadcast_id = b.id and r.user_id = auth.uid()
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

-- Clear one notification from the caller's own list (nobody else's).
create or replace function public.daylight_clear_broadcast(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if p_id is null then raise exception 'Invalid notification'; end if;
  insert into public.daylight_broadcast_clears (user_id, broadcast_id)
  select auth.uid(), b.id from public.daylight_broadcasts b where b.id = p_id
  on conflict do nothing;
  return jsonb_build_object('cleared', true);
end
$$;

-- Turn a list of email addresses into account ids. Owner-only helper (not callable from the browser).
create or replace function public.daylight_resolve_emails(p_emails text[])
returns table(email text, user_id uuid)
language sql
security definer
set search_path = ''
as $$
  select e.email, u.id
  from (select distinct lower(btrim(x)) as email from unnest(coalesce(p_emails, '{}'::text[])) as x where btrim(x) <> '') e
  left join auth.users u on lower(u.email) = e.email
$$;
revoke all on function public.daylight_resolve_emails(text[]) from public, anon, authenticated;

-- Send a notification to everyone (p_emails null or empty) or only to the accounts behind the listed emails.
-- Emails that match no account are reported back and nothing is sent to them; if none match, nothing is sent at all.
create or replace function public.daylight_send_notification(p_title text, p_body text, p_emails text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_matched text[];
  v_missing text[];
  v_wanted int;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can send notifications'; end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then raise exception 'Title must be 1 to 120 characters'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then raise exception 'Message must be 1 to 1000 characters'; end if;

  if p_emails is null or cardinality(p_emails) = 0 then
    insert into public.daylight_broadcasts (title, body, audience, created_by) values (v_title, v_body, 'everyone', auth.uid()) returning id into v_id;
    return jsonb_build_object('sent', true, 'id', v_id, 'audience', 'everyone', 'matched', '[]'::jsonb, 'not_found', '[]'::jsonb);
  end if;

  select count(*) into v_wanted from public.daylight_resolve_emails(p_emails);
  if v_wanted > 50 then raise exception 'Too many addresses (50 at most)'; end if;
  select coalesce(array_agg(r.email order by r.email) filter (where r.user_id is not null), '{}'),
         coalesce(array_agg(r.email order by r.email) filter (where r.user_id is null), '{}')
    into v_matched, v_missing
    from public.daylight_resolve_emails(p_emails) r;

  if cardinality(v_matched) = 0 then
    return jsonb_build_object('sent', false, 'audience', 'specific', 'matched', '[]'::jsonb, 'not_found', to_jsonb(v_missing));
  end if;

  insert into public.daylight_broadcasts (title, body, audience, created_by) values (v_title, v_body, 'specific', auth.uid()) returning id into v_id;
  insert into public.daylight_broadcast_recipients (broadcast_id, user_id)
  select v_id, r.user_id from public.daylight_resolve_emails(p_emails) r where r.user_id is not null
  on conflict do nothing;
  return jsonb_build_object('sent', true, 'id', v_id, 'audience', 'specific', 'matched', to_jsonb(v_matched), 'not_found', to_jsonb(v_missing));
end
$$;

-- The owner's Manage list: everything sent, with who it went to.
create or replace function public.daylight_admin_list_notifications()
returns table(id uuid, title text, body text, audience text, recipients text[], created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return query
    select b.id, b.title, b.body, b.audience,
           coalesce((select array_agg(u.email order by u.email) from public.daylight_broadcast_recipients p join auth.users u on u.id = p.user_id where p.broadcast_id = b.id), '{}'::text[]),
           b.created_at
    from public.daylight_broadcasts b
    order by b.created_at desc
    limit 100;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Banners
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_send_banner(p_body text, p_color text, p_link text default null, p_emails text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_color text := btrim(coalesce(p_color, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_id uuid;
  v_matched text[];
  v_missing text[];
  v_wanted int;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can post banners'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then raise exception 'Banner text must be 1 to 200 characters'; end if;
  if v_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Pick a banner color'; end if;
  if v_link is not null and (char_length(v_link) > 500 or v_link !~* '^https?://[^[:space:]]+$') then raise exception 'The link must start with http:// or https://'; end if;

  if p_emails is null or cardinality(p_emails) = 0 then
    insert into public.daylight_banners (body, color, link, audience, created_by) values (v_body, upper(v_color), v_link, 'everyone', auth.uid()) returning id into v_id;
    return jsonb_build_object('sent', true, 'id', v_id, 'audience', 'everyone', 'matched', '[]'::jsonb, 'not_found', '[]'::jsonb);
  end if;

  select count(*) into v_wanted from public.daylight_resolve_emails(p_emails);
  if v_wanted > 50 then raise exception 'Too many addresses (50 at most)'; end if;
  select coalesce(array_agg(r.email order by r.email) filter (where r.user_id is not null), '{}'),
         coalesce(array_agg(r.email order by r.email) filter (where r.user_id is null), '{}')
    into v_matched, v_missing
    from public.daylight_resolve_emails(p_emails) r;

  if cardinality(v_matched) = 0 then
    return jsonb_build_object('sent', false, 'audience', 'specific', 'matched', '[]'::jsonb, 'not_found', to_jsonb(v_missing));
  end if;

  insert into public.daylight_banners (body, color, link, audience, created_by) values (v_body, upper(v_color), v_link, 'specific', auth.uid()) returning id into v_id;
  insert into public.daylight_banner_recipients (banner_id, user_id)
  select v_id, r.user_id from public.daylight_resolve_emails(p_emails) r where r.user_id is not null
  on conflict do nothing;
  return jsonb_build_object('sent', true, 'id', v_id, 'audience', 'specific', 'matched', to_jsonb(v_matched), 'not_found', to_jsonb(v_missing));
end
$$;

-- Banners the caller should see: aimed at everyone or at them, newest first. Banners can't be dismissed, so there is no clear.
create or replace function public.daylight_list_banners()
returns table(id uuid, body text, color text, link text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select b.id, b.body, b.color, b.link, b.created_at
  from public.daylight_banners b
  where auth.uid() is not null
    and (b.audience = 'everyone'
         or exists (select 1 from public.daylight_banner_recipients p where p.banner_id = b.id and p.user_id = auth.uid()))
  order by b.created_at desc
  limit 5
$$;

create or replace function public.daylight_admin_list_banners()
returns table(id uuid, body text, color text, link text, audience text, recipients text[], created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return query
    select b.id, b.body, b.color, b.link, b.audience,
           coalesce((select array_agg(u.email order by u.email) from public.daylight_banner_recipients p join auth.users u on u.id = p.user_id where p.banner_id = b.id), '{}'::text[]),
           b.created_at
    from public.daylight_banners b
    order by b.created_at desc
    limit 100;
end
$$;

create or replace function public.daylight_delete_banner(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can remove banners'; end if;
  delete from public.daylight_banners where id = p_id;
  return jsonb_build_object('deleted', found);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on function public.daylight_list_broadcasts() from public, anon;
revoke all on function public.daylight_clear_broadcast(uuid) from public, anon;
revoke all on function public.daylight_send_notification(text, text, text[]) from public, anon;
revoke all on function public.daylight_admin_list_notifications() from public, anon;
revoke all on function public.daylight_send_banner(text, text, text, text[]) from public, anon;
revoke all on function public.daylight_list_banners() from public, anon;
revoke all on function public.daylight_admin_list_banners() from public, anon;
revoke all on function public.daylight_delete_banner(uuid) from public, anon;
grant execute on function public.daylight_list_broadcasts() to authenticated;
grant execute on function public.daylight_clear_broadcast(uuid) to authenticated;
grant execute on function public.daylight_send_notification(text, text, text[]) to authenticated;
grant execute on function public.daylight_admin_list_notifications() to authenticated;
grant execute on function public.daylight_send_banner(text, text, text, text[]) to authenticated;
grant execute on function public.daylight_list_banners() to authenticated;
grant execute on function public.daylight_admin_list_banners() to authenticated;
grant execute on function public.daylight_delete_banner(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'tables' as check, case when to_regclass('public.daylight_broadcast_recipients') is not null and to_regclass('public.daylight_broadcast_clears') is not null and to_regclass('public.daylight_banners') is not null and to_regclass('public.daylight_banner_recipients') is not null then 'ok' else 'MISSING' end as result
union all select 'notification columns', case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'daylight_broadcasts' and column_name in ('audience', 'created_by')) = 2 then 'ok' else 'MISSING' end
union all select 'send notification', case when to_regprocedure('public.daylight_send_notification(text,text,text[])') is not null then 'ok' else 'MISSING' end
union all select 'send banner', case when to_regprocedure('public.daylight_send_banner(text,text,text,text[])') is not null then 'ok' else 'MISSING' end
union all select 'clear notification', case when to_regprocedure('public.daylight_clear_broadcast(uuid)') is not null then 'ok' else 'MISSING' end
union all select 'row security on', case when (select bool_and(relrowsecurity) from pg_class where oid in ('public.daylight_broadcast_recipients'::regclass, 'public.daylight_broadcast_clears'::regclass, 'public.daylight_banners'::regclass, 'public.daylight_banner_recipients'::regclass)) then 'ok' else 'MISSING' end;
