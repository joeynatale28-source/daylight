-- Round 17 (Fix 50): PDFs + captions on event attachments, and MCP attachment tools.
-- Additive only: the bucket also accepts PDFs, and one new function handles the three attachment tools for the OAuth-connected AI.
-- mcp_workspace_tool is NOT changed. Permissions follow the existing grant levels, checked per call against the connected account:
--   list_attachments needs read, add_attachment needs write, remove_attachment needs delete.
-- The attachment record is {path, name, type, size, caption} (caption nullable); existing records without a caption keep working untouched.
-- The file bytes never pass through the database: the Edge Function stores them in the private event-attachments bucket under
-- <account id>/<event id>/ (the same place the app stores them) and this function only records / removes the reference + writes the audit row.

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']
 where id = 'event-attachments';

create or replace function public.mcp_attachment_tool(p_tool text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  client text := (select auth.jwt() ->> 'client_id');
  grant_row public.mcp_grants%rowtype;
  ws_payload jsonb;
  revision_number bigint;
  events_json jsonb;
  calendars_json jsonb;
  ev jsonb;
  ev_id text := nullif(p_args ->> 'id', '');
  atts jsonb;
  item jsonb;
  new_ev jsonb;
  removed_path text;
  cal jsonb;
  result_json jsonb;
begin
  if actor is null or client is null or client = '' then
    raise exception 'OAuth client authorization required' using errcode = '42501';
  end if;
  if p_tool not in ('list_attachments', 'add_attachment', 'remove_attachment') then
    raise exception 'Unknown tool' using errcode = '22023';
  end if;
  select * into grant_row from public.mcp_grants where user_id = actor and client_id = client and revoked_at is null;
  if not found then raise exception 'Client not authorized' using errcode = '42501'; end if;
  if not grant_row.can_read
     or (p_tool = 'add_attachment' and not grant_row.can_write)
     or (p_tool = 'remove_attachment' and not grant_row.can_delete) then
    raise exception 'Insufficient daylight permissions' using errcode = '42501';
  end if;
  if ev_id is null then raise exception 'Event id required' using errcode = '22023'; end if;

  select w.payload, w.revision into ws_payload, revision_number from public.workspace_snapshots w where w.user_id = actor for update;
  if not found then raise exception 'Daylight workspace not found' using errcode = '22023'; end if;
  events_json := coalesce(ws_payload -> 'events', '[]'::jsonb);
  calendars_json := coalesce(ws_payload -> 'calendars', '[]'::jsonb);
  select e into ev from jsonb_array_elements(events_json) e where e ->> 'id' = ev_id limit 1;
  if ev is null then raise exception 'Event not found' using errcode = '22023'; end if;
  atts := case when jsonb_typeof(ev -> 'attachments') = 'array' then ev -> 'attachments' else '[]'::jsonb end;

  if p_tool = 'list_attachments' then
    select coalesce(jsonb_agg(jsonb_build_object(
        'attachment_id', a ->> 'path', 'file_name', a ->> 'name', 'type', a ->> 'type',
        'size', (a ->> 'size')::bigint, 'caption', nullif(a ->> 'caption', ''))), '[]'::jsonb)
      into result_json from jsonb_array_elements(atts) a;
    return result_json;
  end if;

  -- add / remove only on events in a calendar the account owns (never a subscription or the built-in holidays)
  select c into cal from jsonb_array_elements(calendars_json) c
   where c ->> 'id' = ev ->> 'cal' and coalesce((c ->> 'subscribed')::boolean, false) = false
     and coalesce((c ->> 'builtin')::boolean, false) = false limit 1;
  if cal is null then raise exception 'Event is read-only' using errcode = '42501'; end if;

  if p_tool = 'add_attachment' then
    if jsonb_array_length(atts) >= 10 then raise exception 'An event can have up to 10 attachments' using errcode = '22023'; end if;
    if coalesce(p_args ->> 'path', '') not like actor::text || '/' || ev_id || '/%' then
      raise exception 'Invalid attachment path' using errcode = '22023';
    end if;
    if coalesce(p_args ->> 'type', '') not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf') then
      raise exception 'Unsupported file type' using errcode = '22023';
    end if;
    item := jsonb_build_object('path', p_args ->> 'path', 'name', left(coalesce(p_args ->> 'name', 'attachment'), 200),
      'type', p_args ->> 'type', 'size', coalesce((p_args ->> 'size')::bigint, 0));
    if nullif(btrim(coalesce(p_args ->> 'caption', '')), '') is not null then
      item := item || jsonb_build_object('caption', left(btrim(p_args ->> 'caption'), 200));
    end if;
    new_ev := ev || jsonb_build_object('attachments', atts || jsonb_build_array(item),
      'sequence', coalesce((ev ->> 'sequence')::int, 0) + 1, 'dtstamp', now());
    result_json := jsonb_build_object('added', true, 'attachment_id', item ->> 'path', 'file_name', item ->> 'name', 'caption', item -> 'caption');
  else
    select a ->> 'path' into removed_path from jsonb_array_elements(atts) a where a ->> 'path' = coalesce(p_args ->> 'attachment_id', '') limit 1;
    if removed_path is null then raise exception 'Attachment not found' using errcode = '22023'; end if;
    select coalesce(jsonb_agg(a), '[]'::jsonb) into atts from jsonb_array_elements(atts) a where a ->> 'path' <> removed_path;
    new_ev := ev || jsonb_build_object('attachments', atts,
      'sequence', coalesce((ev ->> 'sequence')::int, 0) + 1, 'dtstamp', now());
    result_json := jsonb_build_object('removed', true, 'attachment_id', removed_path);
  end if;

  select coalesce(jsonb_agg(case when e ->> 'id' = ev_id then new_ev else e end order by ord), '[]'::jsonb)
    into events_json from jsonb_array_elements(events_json) with ordinality as x(e, ord);
  update public.workspace_snapshots
     set payload = jsonb_set(ws_payload, '{events}', events_json), revision = revision_number + 1, updated_at = now()
   where user_id = actor;
  insert into public.mcp_workspace_audit(user_id, client_id, tool, target_id, result)
    values (actor, client, p_tool, ev_id, 'Event: ' || left(coalesce(ev ->> 'title', 'Untitled'), 300));
  return result_json;
end;
$$;
revoke all on function public.mcp_attachment_tool(text, jsonb) from public, anon;
grant execute on function public.mcp_attachment_tool(text, jsonb) to authenticated;
