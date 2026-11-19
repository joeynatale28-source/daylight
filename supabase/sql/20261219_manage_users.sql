-- Manage users (Support Center, owner only): a summary, a searchable paginated list, and one person's detail.
-- Every function asks daylight_is_owner() itself. Nothing here ever returns calendar content: only the NAMES of a person's calendars.
-- No passwords, no passkey details (only that a passkey exists).

-- 1. the admin-action log can record a warning
do $$ declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.support_admin_actions'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%private_message%';
  if c is not null then execute format('alter table public.support_admin_actions drop constraint %I', c); end if;
end $$;
alter table public.support_admin_actions drop constraint if exists support_admin_actions_action_check;
alter table public.support_admin_actions add constraint support_admin_actions_action_check
  check (action in ('reset_password', 'change_email', 'suspend', 'ban', 'lift', 'private_message', 'give_data', 'warn'));

-- 2. summary strip
create or replace function public.support_users_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare total int; sus int; ban int;
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  select count(*) into total from auth.users;
  select count(distinct user_id) filter (where kind = 'suspended'), count(distinct user_id) filter (where kind = 'banned') into sus, ban
    from public.account_restrictions x where x.lifted_at is null and (x.ends_at is null or x.ends_at > now());
  return jsonb_build_object('total', total, 'suspended', coalesce(sus, 0), 'banned', coalesce(ban, 0), 'active', greatest(0, total - coalesce(sus, 0) - coalesce(ban, 0)));
end $$;

-- 3. the list: newest first, paginated, filtered by name / e-mail / username
create or replace function public.support_users_list(p_q text default '', p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := '%' || replace(replace(replace(lower(btrim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%'; lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0); total int; rows jsonb;
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  with u as (
    select a.id, a.email, a.created_at, a.last_sign_in_at,
           coalesce(nullif(a.raw_user_meta_data->>'full_name', ''), nullif(a.raw_user_meta_data->>'name', ''), '') as name,
           coalesce(nullif(a.raw_user_meta_data->>'username', ''), nullif(a.raw_user_meta_data->>'user_name', ''), nullif(a.raw_user_meta_data->>'preferred_username', ''), '') as username
      from auth.users a)
  select count(*) into total from u where q = '%%' or lower(u.email) like q escape '\' or lower(u.name) like q escape '\' or lower(u.username) like q escape '\';
  with u as (
    select a.id, a.email, a.created_at, a.last_sign_in_at,
           coalesce(nullif(a.raw_user_meta_data->>'full_name', ''), nullif(a.raw_user_meta_data->>'name', ''), '') as name,
           coalesce(nullif(a.raw_user_meta_data->>'username', ''), nullif(a.raw_user_meta_data->>'user_name', ''), nullif(a.raw_user_meta_data->>'preferred_username', ''), '') as username
      from auth.users a),
  f as (select * from u where q = '%%' or lower(u.email) like q escape '\' or lower(u.name) like q escape '\' or lower(u.username) like q escape '\' order by u.created_at desc limit lim offset off)
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'email', coalesce(f.email, ''), 'username', f.username, 'created_at', f.created_at, 'last_sign_in_at', f.last_sign_in_at,
           'status', coalesce((select case when r.kind = 'banned' then 'banned' else 'suspended' end from public.account_restrictions r
                                where r.user_id = f.id and r.lifted_at is null and (r.ends_at is null or r.ends_at > now()) order by r.created_at desc limit 1), 'active')) order by f.created_at desc), '[]'::jsonb)
    into rows from f;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- 4. one person
create or replace function public.support_user_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a record; r record; provs jsonb; cals jsonb;
begin
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  select x.id, x.email, x.created_at, x.last_sign_in_at,
         coalesce(nullif(x.raw_user_meta_data->>'full_name', ''), nullif(x.raw_user_meta_data->>'name', ''), '') as name,
         coalesce(nullif(x.raw_user_meta_data->>'username', ''), nullif(x.raw_user_meta_data->>'user_name', ''), nullif(x.raw_user_meta_data->>'preferred_username', ''), '') as username
    into a from auth.users x where x.id = p_id;
  if not found then raise exception 'That account does not exist.'; end if;
  select * into r from public.account_restrictions z where z.user_id = p_id and z.lifted_at is null and (z.ends_at is null or z.ends_at > now()) order by z.created_at desc limit 1;
  -- sign-in methods: types only
  select coalesce(jsonb_agg(distinct m), '[]'::jsonb) into provs from (
    select case i.provider when 'email' then 'Email' when 'google' then 'Google' else initcap(i.provider) end as m from auth.identities i where i.user_id = p_id
    union all select 'Passkey' where exists (select 1 from auth.webauthn_credentials w where w.user_id = p_id)) s;
  -- calendar NAMES only
  select coalesce(jsonb_agg(c.nm order by c.nm), '[]'::jsonb) into cals from (
    select e->>'name' as nm from public.workspace_snapshots w, jsonb_array_elements(case when jsonb_typeof(w.payload->'calendars') = 'array' then w.payload->'calendars' else '[]'::jsonb end) e
     where w.user_id = p_id and coalesce(e->>'name', '') <> '') c;
  return jsonb_build_object(
    'user', jsonb_build_object('id', a.id, 'name', a.name, 'email', coalesce(a.email, ''), 'username', a.username, 'created_at', a.created_at, 'last_sign_in_at', a.last_sign_in_at,
       'status', case when r.id is null then 'active' when r.kind = 'banned' then 'banned' else 'suspended' end,
       'restriction', case when r.id is null then null else jsonb_build_object('kind', r.kind, 'reason', r.reason, 'starts_at', r.starts_at, 'ends_at', r.ends_at) end),
    'sign_in', provs,
    'calendars', cals,
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'ref', upper(left(replace(t.id::text, '-', ''), 8)), 'title', t.title, 'status', t.status, 'category', t.category, 'created_at', t.created_at) order by t.created_at desc)
                          from (select * from public.support_tickets where user_id = p_id order by created_at desc limit 100) t), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('action', h.action, 'reason', h.reason, 'detail', h.detail, 'admin_email', h.admin_email, 'created_at', h.created_at) order by h.created_at desc)
                          from (select * from public.support_admin_actions where user_id = p_id order by created_at desc limit 100) h), '[]'::jsonb));
end $$;

revoke all on function public.support_users_summary() from public, anon;
revoke all on function public.support_users_list(text, int, int) from public, anon;
revoke all on function public.support_user_detail(uuid) from public, anon;
grant execute on function public.support_users_summary() to authenticated;
grant execute on function public.support_users_list(text, int, int) to authenticated;
grant execute on function public.support_user_detail(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'manage users ok' as result;
