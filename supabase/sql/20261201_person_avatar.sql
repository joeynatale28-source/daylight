-- Round 13 (Fix 16): sharing notifications and every sharing screen show a person's real uploaded picture.
-- The picture a user uploads lives in the avatars bucket (their own folder) and in their workspace settings (avatarUrl).
-- Their auth metadata avatar_url can still hold the Google photo (Google sign-in refreshes it), so daylight_person used to
-- return no picture for anyone who signed in with Google and later uploaded their own. It now prefers the uploaded picture
-- (own folder only) and falls back to the metadata picture only when that one is also an own-folder file.
-- Additive: replaces one function body; same signature and same fields returned.
create or replace function public.daylight_person(p_user uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', u.id,
    'name', coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email::text, '@', 1)),
    'email', u.email::text,
    'avatar', coalesce(
      (select s.url from (select w.payload -> 'settings' ->> 'avatarUrl' as url from public.workspace_snapshots w where w.user_id = u.id) s
        where s.url like '%/' || u.id::text || '/%'),
      case when (u.raw_user_meta_data ->> 'avatar_url') like '%/' || u.id::text || '/%' then u.raw_user_meta_data ->> 'avatar_url' else null end))
  from auth.users u where u.id = p_user
$$;

revoke all on function public.daylight_person(uuid) from public, anon, authenticated;
