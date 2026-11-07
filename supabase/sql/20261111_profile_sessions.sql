create or replace function public.daylight_list_my_sessions()
returns table(id text, user_agent text, last_active timestamptz, current boolean)
language sql
security definer
set search_path = ''
as $$
  select s.id::text,
         coalesce(s.user_agent, ''),
         s.updated_at,
         s.id::text = auth.jwt()->>'session_id'
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by s.updated_at desc
  limit 20
$$;

create or replace function public.daylight_revoke_my_session(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session text := auth.jwt()->>'session_id';
  v_session_id uuid;
begin
  if v_user_id is null then raise exception 'Authenticated session required'; end if;
  if p_session_id is null or p_session_id !~* '^[0-9a-f-]{36}$' then
    raise exception 'Invalid session';
  end if;
  if p_session_id = v_current_session then
    raise exception 'The current session cannot be revoked here';
  end if;
  v_session_id := p_session_id::uuid;
  delete from auth.sessions
    where id = v_session_id and user_id = v_user_id;
  if not found then raise exception 'Session not found'; end if;
  return jsonb_build_object('revoked', true);
end
$$;

revoke all on function public.daylight_list_my_sessions() from public, anon;
revoke all on function public.daylight_revoke_my_session(text) from public, anon;
grant execute on function public.daylight_list_my_sessions() to authenticated;
grant execute on function public.daylight_revoke_my_session(text) to authenticated;
