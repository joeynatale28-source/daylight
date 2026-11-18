-- The sign-in notice for a suspended/banned person must only be shown to someone who knows the password (Supabase answers "user_banned" before it checks the
-- password, so that answer alone proves nothing). This lets the account-notice Edge Function check the password itself. Service role only.
create or replace function public.account_notice_check(p_email text, p_password text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare u record;
begin
  select id, encrypted_password into u from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if not found or coalesce(u.encrypted_password, '') = '' then return null; end if;
  if extensions.crypt(p_password, u.encrypted_password) = u.encrypted_password then return u.id; end if;
  return null;
end $$;
revoke all on function public.account_notice_check(text, text) from public, anon, authenticated;
grant execute on function public.account_notice_check(text, text) to service_role;
select 'ok' as result;
