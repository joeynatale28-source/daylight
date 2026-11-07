CREATE OR REPLACE FUNCTION public.mcp_workspace_tool(p_tool text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  client text := (select auth.jwt() ->> 'client_id');
  grant_row public.mcp_grants%rowtype;
  workspace_payload jsonb;
  calendar_items jsonb;
  event_items jsonb;
  task_items jsonb;
  record_item jsonb;
  updated_item jsonb;
  chosen_calendar jsonb;
  id_text text;
  title_text text;
  target_title text;
  start_at timestamptz;
  end_at timestamptz;
  next_id bigint;
  output jsonb;
  revision_number bigint;
  is_write boolean := p_tool in ('create_calendar','create_event','update_event','create_task','complete_task');
  is_delete boolean := p_tool = 'delete_event';
begin
  if actor is null or client is null or client = '' then
    raise exception 'OAuth client authorization required' using errcode='42501';
  end if;
  select * into grant_row from public.mcp_grants
    where user_id=actor and client_id=client and revoked_at is null;
  if not found then raise exception 'Client not authorized' using errcode='42501'; end if;
  if not grant_row.can_read or (is_write and not grant_row.can_write) or (is_delete and not grant_row.can_delete) then
    raise exception 'Insufficient daylight permissions' using errcode='42501';
  end if;
  if p_tool not in ('list_calendars','list_events','get_event','search_events','list_tasks',
     'create_calendar','create_event','update_event','delete_event','create_task','complete_task') then
    raise exception 'Unknown tool' using errcode='22023';
  end if;
  select w.payload,w.revision into workspace_payload,revision_number
    from public.workspace_snapshots w where w.user_id=actor
    for update;
  if not found then
    raise exception 'Daylight workspace not found' using errcode='22023';
  end if;
  calendar_items := coalesce(workspace_payload->'calendars','[]'::jsonb);
  event_items := coalesce(workspace_payload->'events','[]'::jsonb);
  task_items := coalesce(workspace_payload->'tasks','[]'::jsonb);
  if jsonb_typeof(calendar_items) <> 'array' or jsonb_typeof(event_items) <> 'array' or jsonb_typeof(task_items) <> 'array' then
    raise exception 'Invalid workspace' using errcode='22023';
  end if;
  case p_tool
  when 'list_calendars' then
    select coalesce(jsonb_agg(jsonb_build_object('id',c->>'id','name',c->>'name','color',c->>'color',
      'read_only',coalesce((c->>'subscribed')::boolean,false))),'[]'::jsonb)
      into output from jsonb_array_elements(calendar_items) c;
    select output || coalesce(jsonb_agg(jsonb_build_object('id','subscription:'||s.id::text,
      'name',s.name,'color',s.color,'read_only',true)),'[]'::jsonb)
      into output from public.subscriptions s where s.user_id=actor;
    return output;
  when 'list_tasks' then return task_items;
  when 'list_events' then
    if p_args->>'start' is null or p_args->>'end' is null then
      raise exception 'Start and end ISO timestamps required' using errcode='22023';
    end if;
    start_at := (p_args->>'start')::timestamptz;end_at := (p_args->>'end')::timestamptz;
    if end_at<=start_at or end_at-start_at>interval '1 year' then
      raise exception 'Date range must be within one year' using errcode='22023';
    end if;
    select coalesce(jsonb_agg(e),'[]'::jsonb) into output from jsonb_array_elements(event_items) e
      where (e->>'start')::timestamptz<end_at and (e->>'end')::timestamptz>start_at;
    select output || coalesce(jsonb_agg(
        e || jsonb_build_object('cal','subscription:'||sub.id::text,'source',sub.name,
          'feedSubscriptionId',sub.id,'read_only',true)
      ),'[]'::jsonb) into output
      from public.subscriptions sub
      cross join lateral jsonb_array_elements(coalesce(sub.cached_events,'[]'::jsonb)) e
      where sub.user_id=actor
        and (e->>'start')::timestamptz<end_at and (e->>'end')::timestamptz>start_at;
    return output;
  when 'get_event' then
    id_text := nullif(p_args->>'id','');
    select e into output from jsonb_array_elements(event_items) e where e->>'id'=id_text limit 1;
    if output is null then raise exception 'Event not found' using errcode='22023'; end if;
    return output;
  when 'search_events' then
    title_text := trim(coalesce(p_args->>'query',''));
    if title_text = '' then raise exception 'Search query required' using errcode='22023'; end if;
    select coalesce(jsonb_agg(e),'[]'::jsonb) into output
    from jsonb_array_elements(event_items) e
    where coalesce(e->>'title','') ilike '%'||title_text||'%'
       or coalesce(e->>'loc','') ilike '%'||title_text||'%'
       or coalesce(e->>'desc','') ilike '%'||title_text||'%';
    select output || coalesce(jsonb_agg(e || jsonb_build_object(
      'cal','subscription:'||sub.id::text,'source',sub.name,'feedSubscriptionId',sub.id,'read_only',true
    )),'[]'::jsonb) into output
      from public.subscriptions sub
      cross join lateral jsonb_array_elements(coalesce(sub.cached_events,'[]'::jsonb)) e
      where sub.user_id=actor and (
        coalesce(e->>'title','') ilike '%'||title_text||'%'
        or coalesce(e->>'location','') ilike '%'||title_text||'%'
        or coalesce(e->>'description','') ilike '%'||title_text||'%'
      );
    return output;
  when 'create_calendar' then
    title_text:=trim(coalesce(p_args->>'name',''));
    if length(title_text) not between 1 and 120 then raise exception 'Invalid calendar name' using errcode='22023'; end if;
    record_item:=jsonb_build_object('id','cal-'||pg_catalog.gen_random_uuid()::text,
      'name',title_text,'color',case when (p_args->>'color') ~ '^#[[:xdigit:]]{6}$'
        then p_args->>'color' else 'blue' end,'hidden',false,'subscribed',false);
    calendar_items:=calendar_items||jsonb_build_array(record_item);
    workspace_payload:=jsonb_set(workspace_payload,'{calendars}',calendar_items);
    output:=record_item;
  when 'create_event' then
    id_text:=p_args->>'calendar_id';
    select c into chosen_calendar from jsonb_array_elements(calendar_items) c
     where c->>'id'=id_text and coalesce((c->>'subscribed')::boolean,false)=false
       and coalesce((c->>'builtin')::boolean,false)=false limit 1;
    if chosen_calendar is null then raise exception 'Calendar is not writable' using errcode='42501'; end if;
    title_text:=trim(coalesce(p_args->>'title',''));
    if length(title_text) not between 1 and 300 then raise exception 'Invalid event title' using errcode='22023'; end if;
    start_at:=(p_args->>'starts_at')::timestamptz;end_at:=(p_args->>'ends_at')::timestamptz;
    if end_at<=start_at then raise exception 'End must follow start' using errcode='22023'; end if;
    select greatest(100,coalesce(max((e->>'id')::bigint),0))+1 into next_id
    from jsonb_array_elements(event_items) e where (e->>'id') ~ '^[0-9]{1,14}$';
    record_item:=jsonb_build_object('id',next_id,'uid',pg_catalog.gen_random_uuid()::text||'@daylight',
       'cal',id_text,'title',title_text,'start',start_at,'end',end_at,
       'loc',left(coalesce(p_args->>'location',''),1500),
       'desc',left(coalesce(p_args->>'description',''),10000),
       'allDay',coalesce((p_args->>'all_day')::boolean,false),
       'repeat',null,'declined',false,'sequence',0,'dtstamp',now());
    workspace_payload:=jsonb_set(workspace_payload,'{events}',event_items||jsonb_build_array(record_item));
    output:=record_item;
  when 'update_event','delete_event' then
    id_text:=p_args->>'id';
    select e into record_item from jsonb_array_elements(event_items) e where e->>'id'=id_text limit 1;
    if record_item is null then raise exception 'Event not found' using errcode='22023'; end if;
    select c into chosen_calendar from jsonb_array_elements(calendar_items) c
     where c->>'id'=record_item->>'cal' and coalesce((c->>'subscribed')::boolean,false)=false
       and coalesce((c->>'builtin')::boolean,false)=false limit 1;
    if chosen_calendar is null then raise exception 'Event is read-only' using errcode='42501'; end if;
    if p_tool='delete_event' then
      target_title := coalesce(record_item->>'title','');
      select coalesce(jsonb_agg(e order by ord),'[]'::jsonb) into event_items
      from jsonb_array_elements(event_items) with ordinality as x(e,ord) where e->>'id'<>id_text;
      output:=jsonb_build_object('deleted',true,'id',id_text);
    else
      updated_item:=record_item;
      if p_args ? 'title' then
        title_text:=trim(coalesce(p_args->>'title',''));
        if length(title_text) not between 1 and 300 then raise exception 'Invalid title' using errcode='22023'; end if;
        updated_item:=updated_item||jsonb_build_object('title',title_text);
      end if;
      if p_args ? 'location' then updated_item:=updated_item||jsonb_build_object('loc',left(coalesce(p_args->>'location',''),1500)); end if;
      if p_args ? 'description' then updated_item:=updated_item||jsonb_build_object('desc',left(coalesce(p_args->>'description',''),10000)); end if;
      if p_args ? 'starts_at' then updated_item:=updated_item||jsonb_build_object('start',(p_args->>'starts_at')::timestamptz); end if;
      if p_args ? 'ends_at' then updated_item:=updated_item||jsonb_build_object('end',(p_args->>'ends_at')::timestamptz); end if;
      if (updated_item->>'end')::timestamptz <= (updated_item->>'start')::timestamptz then
        raise exception 'Event end must follow start' using errcode='22023';
      end if;
      updated_item:=updated_item||jsonb_build_object('sequence',coalesce((record_item->>'sequence')::int,0)+1,'dtstamp',now());
      select coalesce(jsonb_agg(case when e->>'id'=id_text then updated_item else e end order by ord),'[]'::jsonb)
        into event_items from jsonb_array_elements(event_items) with ordinality as x(e,ord);
      output:=updated_item;
    end if;
    workspace_payload:=jsonb_set(workspace_payload,'{events}',event_items);
  when 'create_task' then
    title_text:=trim(coalesce(p_args->>'title',''));
    if length(title_text) not between 1 and 300 then raise exception 'Invalid task title' using errcode='22023'; end if;
    select greatest(100,coalesce(max((t->>'id')::bigint),0))+1 into next_id
    from jsonb_array_elements(task_items) t where (t->>'id') ~ '^[0-9]{1,14}$';
    record_item:=jsonb_build_object('id',next_id,'title',title_text,'cal',
      coalesce((select c->>'id' from jsonb_array_elements(calendar_items) c
        where coalesce((c->>'subscribed')::boolean,false)=false limit 1),'personal'),
      'due',coalesce(p_args->>'due_date',now()::date::text),'done',false,'hasTime',false);
    workspace_payload:=jsonb_set(workspace_payload,'{tasks}',task_items||jsonb_build_array(record_item));
    output:=record_item;
  when 'complete_task' then
    id_text:=p_args->>'id';
    select t into record_item from jsonb_array_elements(task_items) t where t->>'id'=id_text limit 1;
    if record_item is null then raise exception 'Task not found' using errcode='22023'; end if;
    updated_item:=record_item||jsonb_build_object('done',coalesce((p_args->>'completed')::boolean,false));
    select coalesce(jsonb_agg(case when t->>'id'=id_text then updated_item else t end order by ord),'[]'::jsonb)
      into task_items from jsonb_array_elements(task_items) with ordinality as x(t,ord);
    workspace_payload:=jsonb_set(workspace_payload,'{tasks}',task_items);
    output:=updated_item;
  end case;
  if is_write or is_delete then
    update public.workspace_snapshots set payload=workspace_payload,revision=revision_number+1,updated_at=now() where user_id=actor;
    insert into public.mcp_workspace_audit(user_id,client_id,tool,target_id,target_title,result)
      values(actor,client,p_tool,coalesce(id_text,output->>'id'),target_title,'success');
  end if;
  return output;
end;
$function$
