-- Landing-page banner. The owner can choose, per banner, whether it shows on the dashboard only (as before) or on the dashboard
-- AND the public landing page. Additive: one new column (default false, so every existing banner stays dashboard-only), the two
-- owner functions below gain the new field, and one narrow public function returns the single newest landing banner.
-- Nothing here changes who can see a banner inside the app, and nothing here exposes a banner that is not flagged for the landing page.

alter table public.daylight_banners add column if not exists show_on_landing boolean not null default false;

-- ---------------------------------------------------------------------------------------------------------------------
-- Post a banner (owner only). p_landing = also show it on the landing page. Only a banner aimed at everyone can be on the landing page.
-- ---------------------------------------------------------------------------------------------------------------------
drop function if exists public.daylight_send_banner(text, text, text, text[]);
create or replace function public.daylight_send_banner(p_body text, p_color text, p_link text default null, p_emails text[] default null, p_landing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_color text := btrim(coalesce(p_color, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_landing boolean := coalesce(p_landing, false);
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
    insert into public.daylight_banners (body, color, link, audience, created_by, show_on_landing) values (v_body, upper(v_color), v_link, 'everyone', auth.uid(), v_landing) returning id into v_id;
    return jsonb_build_object('sent', true, 'id', v_id, 'audience', 'everyone', 'landing', v_landing, 'matched', '[]'::jsonb, 'not_found', '[]'::jsonb);
  end if;

  if v_landing then raise exception 'Only a banner for everyone can be shown on the landing page'; end if;

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

-- ---------------------------------------------------------------------------------------------------------------------
-- The owner's list gains the landing flag.
-- ---------------------------------------------------------------------------------------------------------------------
drop function if exists public.daylight_admin_list_banners();
create or replace function public.daylight_admin_list_banners()
returns table(id uuid, body text, color text, link text, audience text, recipients text[], created_at timestamptz, show_on_landing boolean)
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
           b.created_at, b.show_on_landing
    from public.daylight_banners b
    order by b.created_at desc
    limit 100;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- The landing page (signed out, public): the newest banner that is for everyone AND flagged for the landing page. Text and link only.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.daylight_landing_banner()
returns table(body text, color text, link text)
language sql
security definer
set search_path = ''
stable
as $$
  select b.body, b.color, b.link
  from public.daylight_banners b
  where b.audience = 'everyone' and b.show_on_landing
  order by b.created_at desc
  limit 1
$$;

revoke all on function public.daylight_send_banner(text, text, text, text[], boolean) from public, anon;
revoke all on function public.daylight_admin_list_banners() from public, anon;
revoke all on function public.daylight_landing_banner() from public;
grant execute on function public.daylight_send_banner(text, text, text, text[], boolean) to authenticated;
grant execute on function public.daylight_admin_list_banners() to authenticated;
grant execute on function public.daylight_landing_banner() to anon, authenticated;
