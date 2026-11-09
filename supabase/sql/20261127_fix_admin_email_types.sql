-- Fix found while rebuilding on the new Supabase project (run AFTER 20261125_admin_dashboard.sql).
--
-- On real Supabase, auth.users.email is "character varying", so array_agg(u.email) is a varchar[] and Postgres refuses to
-- return it as the text[] these two owner-only functions declare ("structure of query does not match function result
-- type"). The Admin dashboard's "Manage" lists would fail. The only change from 20261125 is the ::text cast on u.email.
-- Additive and safe to run more than once; it replaces only these two functions and keeps their grants.

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
           coalesce((select array_agg(u.email::text order by u.email::text) from public.daylight_broadcast_recipients p join auth.users u on u.id = p.user_id where p.broadcast_id = b.id), '{}'::text[]),
           b.created_at
    from public.daylight_broadcasts b
    order by b.created_at desc
    limit 100;
end
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
           coalesce((select array_agg(u.email::text order by u.email::text) from public.daylight_banner_recipients p join auth.users u on u.id = p.user_id where p.banner_id = b.id), '{}'::text[]),
           b.created_at
    from public.daylight_banners b
    order by b.created_at desc
    limit 100;
end
$$;

revoke all on function public.daylight_admin_list_notifications() from public, anon;
revoke all on function public.daylight_admin_list_banners() from public, anon;
grant execute on function public.daylight_admin_list_notifications() to authenticated;
grant execute on function public.daylight_admin_list_banners() to authenticated;

select 'admin list functions replaced' as check, 'ok' as result;
