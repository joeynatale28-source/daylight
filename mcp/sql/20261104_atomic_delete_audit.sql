-- Atomic snapshot deletion is executed ONLY by the server-side service role.
-- This function verifies the owner's deletion setting and writes the audit
-- inside the same transaction as the workspace revision update.
create or replace function public.daylight_mcp_delete_snapshot_event(
  p_owner uuid,p_event_id text,p_event_title text,p_token_name text,p_revision integer
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_payload jsonb;v_revision integer;v_filtered jsonb;v_removed integer;
begin
  if not exists(select 1 from public.user_settings where user_id=p_owner and mcp_allow_delete is true)
    then raise exception 'AI event deletion disabled'; end if;
  select payload,revision into v_payload,v_revision from public.workspace_snapshots
    where user_id=p_owner for update;
  if not found or v_revision<>p_revision then raise exception 'Workspace revision conflict';end if;
  select count(*)::integer into v_removed
    from jsonb_array_elements(coalesce(v_payload->'events','[]'::jsonb)) e where e->>'id'=p_event_id;
  if v_removed<>1 then raise exception 'Event not found or ambiguous';end if;
  select coalesce(jsonb_agg(e),'[]'::jsonb) into v_filtered
    from jsonb_array_elements(coalesce(v_payload->'events','[]'::jsonb)) e
    where e->>'id' is distinct from p_event_id;
  update public.workspace_snapshots set
    payload=jsonb_set(v_payload,'{events}',v_filtered,true),revision=v_revision+1,updated_at=now()
    where user_id=p_owner;
  insert into public.mcp_audit_log(user_id,token_name,tool,action,summary,target_id)
    values(p_owner,left(p_token_name,100),'delete_event','delete',
       'Event: '||left(p_event_title,300),left(p_event_id,100));
  return jsonb_build_object('deleted',true,'id',p_event_id);
end $$;
revoke all on function public.daylight_mcp_delete_snapshot_event(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.daylight_mcp_delete_snapshot_event(uuid,text,text,text,integer) to service_role;
