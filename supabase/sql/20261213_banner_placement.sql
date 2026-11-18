-- Banner placement (App / Landing page / Both) and per-person dismissal. Additive; every existing banner keeps its current surfaces
-- (show_on_landing stays as the "landing" flag, the new show_in_app flag defaults to true).
alter table public.daylight_banners add column if not exists show_in_app boolean not null default true;

create table if not exists public.daylight_banner_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  banner_id uuid not null references public.daylight_banners(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, banner_id)
);
alter table public.daylight_banner_dismissals enable row level security;
revoke all on public.daylight_banner_dismissals from public, anon, authenticated;

create or replace function public.daylight_dismiss_banner(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  insert into public.daylight_banner_dismissals (user_id, banner_id) select auth.uid(), b.id from public.daylight_banners b where b.id = p_id on conflict do nothing;
end $$;
revoke all on function public.daylight_dismiss_banner(uuid) from public, anon;
grant execute on function public.daylight_dismiss_banner(uuid) to authenticated;

-- what the app shows: only banners placed in the app, aimed at this person, and not dismissed by them
drop function if exists public.daylight_list_banners();
create function public.daylight_list_banners()
returns table(id uuid, body text, color text, link text, created_at timestamptz)
language sql security definer set search_path = '' as $$
  select b.id, b.body, b.color, b.link, b.created_at
  from public.daylight_banners b
  where auth.uid() is not null and b.show_in_app
    and (b.audience = 'everyone' or exists (select 1 from public.daylight_banner_recipients p where p.banner_id = b.id and p.user_id = auth.uid()))
    and not exists (select 1 from public.daylight_banner_dismissals d where d.banner_id = b.id and d.user_id = auth.uid())
  order by b.created_at desc
  limit 5
$$;
revoke all on function public.daylight_list_banners() from public, anon;
grant execute on function public.daylight_list_banners() to authenticated;

-- owner functions gain the placement flag
drop function if exists public.daylight_admin_list_banners();
create function public.daylight_admin_list_banners()
returns table(id uuid, body text, color text, link text, audience text, recipients text[], created_at timestamptz, show_on_landing boolean, show_in_app boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can do this'; end if;
  return query
    select b.id, b.body, b.color, b.link, b.audience,
           coalesce((select array_agg(u.email::text order by u.email::text) from public.daylight_banner_recipients p join auth.users u on u.id = p.user_id where p.banner_id = b.id), '{}'::text[]),
           b.created_at, b.show_on_landing, b.show_in_app
    from public.daylight_banners b order by b.created_at desc limit 100;
end $$;
revoke all on function public.daylight_admin_list_banners() from public, anon;
grant execute on function public.daylight_admin_list_banners() to authenticated;

drop function if exists public.daylight_send_banner(text, text, text, text[], boolean);
create function public.daylight_send_banner(p_body text, p_color text, p_link text default null, p_emails text[] default null, p_landing boolean default false, p_app boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_body text := btrim(coalesce(p_body, '')); v_color text := btrim(coalesce(p_color, '')); v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_landing boolean := coalesce(p_landing, false); v_app boolean := coalesce(p_app, true);
  v_id uuid; v_matched text[]; v_missing text[]; v_wanted int;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can post banners'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then raise exception 'Banner text must be 1 to 200 characters'; end if;
  if v_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Pick a banner color'; end if;
  if v_link is not null and (char_length(v_link) > 500 or v_link !~* '^https?://[^[:space:]]+$') then raise exception 'The link must start with http:// or https://'; end if;
  if not v_landing and not v_app then raise exception 'Pick where the banner shows'; end if;
  if p_emails is null or cardinality(p_emails) = 0 then
    insert into public.daylight_banners (body, color, link, audience, created_by, show_on_landing, show_in_app) values (v_body, upper(v_color), v_link, 'everyone', auth.uid(), v_landing, v_app) returning id into v_id;
    return jsonb_build_object('sent', true, 'id', v_id, 'audience', 'everyone', 'landing', v_landing, 'app', v_app, 'matched', '[]'::jsonb, 'not_found', '[]'::jsonb);
  end if;
  if v_landing then raise exception 'Only a banner for everyone can be shown on the landing page'; end if;
  select count(*) into v_wanted from public.daylight_resolve_emails(p_emails);
  if v_wanted > 50 then raise exception 'Too many addresses (50 at most)'; end if;
  select coalesce(array_agg(r.email order by r.email) filter (where r.user_id is not null), '{}'), coalesce(array_agg(r.email order by r.email) filter (where r.user_id is null), '{}')
    into v_matched, v_missing from public.daylight_resolve_emails(p_emails) r;
  if cardinality(v_matched) = 0 then return jsonb_build_object('sent', false, 'audience', 'specific', 'matched', '[]'::jsonb, 'not_found', to_jsonb(v_missing)); end if;
  insert into public.daylight_banners (body, color, link, audience, created_by, show_in_app) values (v_body, upper(v_color), v_link, 'specific', auth.uid(), true) returning id into v_id;
  insert into public.daylight_banner_recipients (banner_id, user_id) select v_id, r.user_id from public.daylight_resolve_emails(p_emails) r where r.user_id is not null on conflict do nothing;
  return jsonb_build_object('sent', true, 'id', v_id, 'audience', 'specific', 'matched', to_jsonb(v_matched), 'not_found', to_jsonb(v_missing));
end $$;
revoke all on function public.daylight_send_banner(text, text, text, text[], boolean, boolean) from public, anon;
grant execute on function public.daylight_send_banner(text, text, text, text[], boolean, boolean) to authenticated;

drop function if exists public.daylight_update_banner(uuid, text, text, text, boolean);
create function public.daylight_update_banner(p_id uuid, p_body text, p_color text, p_link text default null, p_landing boolean default false, p_app boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_body text := btrim(coalesce(p_body, '')); v_color text := btrim(coalesce(p_color, '')); v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_landing boolean := coalesce(p_landing, false); v_app boolean := coalesce(p_app, true); v_aud text;
begin
  if auth.uid() is null then raise exception 'Authenticated session required'; end if;
  if not public.daylight_is_owner() then raise exception 'Only the owner can edit banners'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then raise exception 'Banner text must be 1 to 200 characters'; end if;
  if v_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Pick a banner color'; end if;
  if v_link is not null and (char_length(v_link) > 500 or v_link !~* '^https?://[^[:space:]]+$') then raise exception 'The link must start with http:// or https://'; end if;
  if not v_landing and not v_app then raise exception 'Pick where the banner shows'; end if;
  select audience into v_aud from public.daylight_banners where id = p_id;
  if v_aud is null then return jsonb_build_object('updated', false); end if;
  if v_landing and v_aud <> 'everyone' then raise exception 'Only a banner for everyone can be shown on the landing page'; end if;
  update public.daylight_banners set body = v_body, color = upper(v_color), link = v_link, show_on_landing = v_landing, show_in_app = v_app where id = p_id;
  return jsonb_build_object('updated', true);
end $$;
revoke all on function public.daylight_update_banner(uuid, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.daylight_update_banner(uuid, text, text, text, boolean, boolean) to authenticated;
notify pgrst, 'reload schema';
select 'ok' r, (select count(*) from public.daylight_banners)::int banners;
