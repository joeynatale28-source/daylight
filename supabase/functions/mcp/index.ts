// Daylight OAuth MCP endpoint. Uses Supabase's official Protected Resource -> JWT pipeline.
// Authenticated user context is used for all tools; no service role key is used.
import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0'
import { pipeline } from 'npm:@supabase/middleware@1'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1'
import { z } from 'npm:zod@^4.3.6'

const capabilities={
  list_calendars:'read',list_events:'read',get_event:'read',search_events:'read',list_tasks:'read',
  create_calendar:'write',create_event:'write',update_event:'write',
  delete_event:'delete',create_task:'write',complete_task:'write'
}
function deny(message='insufficient_scope'){
 return new Response(JSON.stringify({error:message}),{status:403,headers:{
  'Content-Type':'application/json','Cache-Control':'no-store',
  'WWW-Authenticate':'Bearer error="insufficient_scope"'
 }})
}
function claims(token:string){
 try{const part=token.split('.')[1];return JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')))}
 catch{return {}}
}
Deno.serve(pipeline(
 [withOAuthProtectedResource(),withSupabase({auth:'user'})],
 async(req,{supabase})=>{
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  const {data:identity,error:authError}=await supabase.auth.getUser(token)
  if(authError||!identity.user)return deny('unauthorized')
  const payload=claims(token)
  const clientId=typeof payload.client_id==='string'?payload.client_id:''
  if(!clientId||payload.sub!==identity.user.id)return deny('client_authorization_required')
  const {data:grant,error:grantError}=await supabase.from('mcp_grants')
    .select('can_read,can_write,can_delete,revoked_at')
    .eq('user_id',identity.user.id).eq('client_id',clientId).is('revoked_at',null).maybeSingle()
  if(grantError||!grant)return deny('client_not_authorized')
  let requested:any=null
  try{if(req.method==='POST')requested=await req.clone().json()}catch{}
  if(requested?.method==='tools/call'){
   const name=String(requested.params?.name||'')
   const required=(capabilities as Record<string,string>)[name]
   if(required==='write'&&!grant.can_write)return deny()
   if(required==='delete'&&!grant.can_delete)return deny()
   if(required==='read'&&!grant.can_read)return deny()
  }
  if(!grant.can_read)return deny()
  const invoke=async(tool:string,args:Record<string,unknown>)=>{
    const {data,error}=await supabase.rpc('mcp_workspace_tool',{p_tool:tool,p_args:args||{}})
    if(error)throw new Error(error.message)
    return {content:[{type:'text' as const,text:JSON.stringify(data)}]}
  }
  const handler=createMcpHandler(()=>{
    const server=new McpServer({name:'daylight',version:'2.0.0'})
    const add=(name:string,description:string,inputSchema:any,mode:'read'|'write'|'delete')=>{
      if(mode==='write'&&!grant.can_write)return
      if(mode==='delete'&&!grant.can_delete)return
      if(mode==='read'&&!grant.can_read)return
      server.registerTool(name,{
        description,inputSchema,
        annotations:{
          readOnlyHint:mode==='read',
          destructiveHint:mode==='delete',
          ...(mode==='write'?{destructiveHint:false}:{})
        }
      },async(args:any)=>invoke(name,args))
    }
    add('list_calendars','List your Daylight calendars',z.object({}),'read')
    add('list_events','List calendar events during an ISO 8601 range',
      z.object({start:z.string(),end:z.string()}),'read')
    add('get_event','Get one Daylight event by ID',
      z.object({id:z.string()}),'read')
    add('search_events','Search event titles, descriptions and locations',
      z.object({query:z.string().min(1)}),'read')
    add('list_tasks','List your Daylight tasks',z.object({}),'read')
    add('create_calendar','Create a writable calendar',
      z.object({name:z.string().min(1),color:z.string().optional()}),'write')
    add('create_event','Create an event in a calendar you own',
      z.object({calendar_id:z.string(),title:z.string(),starts_at:z.string(),
        ends_at:z.string(),location:z.string().optional(),description:z.string().optional(),
        all_day:z.boolean().optional()}),'write')
    add('update_event','Edit an event in a calendar you own',
      z.object({id:z.string(),title:z.string().optional(),starts_at:z.string().optional(),
        ends_at:z.string().optional(),location:z.string().optional(),description:z.string().optional()}),'write')
    add('delete_event','Permanently delete an owned calendar event',
      z.object({id:z.string()}),'delete')
    add('create_task','Create a Daylight task',
      z.object({title:z.string(),due_date:z.string().optional()}),'write')
    add('complete_task','Mark a task complete or incomplete',
      z.object({id:z.string(),completed:z.boolean()}),'write')
    return server
  })
  // Compatibility with MCP clients negotiating the pre-2026 Streamable HTTP
  // handshake. The official SDK remains primary; this path handles legacy
  // initialize/tools/list calls if the SDK rejects their protocol revision.
  const response=await handler.fetch(req)
  if(response.status!==400 || req.method!=='POST' || !requested || typeof requested.method!=='string')
    return response
  // Log only protocol diagnostics, never access tokens or tool arguments.
  console.warn('daylight_mcp_transport_compat',JSON.stringify({
    method:requested.method,
    clientVersion:req.headers.get('mcp-protocol-version')||'unspecified',
    requestedVersion:requested.params?.protocolVersion||'unspecified',
    status:response.status,
    issue:(await response.clone().text()).slice(0,400)
  }))
  const proto=String(requested.params?.protocolVersion||'2025-11-25')
  const ver=['2025-03-26','2025-06-18','2025-11-25'].includes(proto)?proto:'2025-11-25'
  const toolDefs=[
    {name:'list_calendars',description:'List Daylight calendars',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true}},
    {name:'list_events',description:'List events in an ISO date range',inputSchema:{type:'object',properties:{start:{type:'string'},end:{type:'string'}},required:['start','end']},annotations:{readOnlyHint:true}},
    {name:'get_event',description:'Read one event',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']},annotations:{readOnlyHint:true}},
    {name:'search_events',description:'Search events by text',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']},annotations:{readOnlyHint:true}},
    {name:'list_tasks',description:'List Daylight tasks',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true}},
    {name:'create_calendar',description:'Create a calendar',inputSchema:{type:'object',properties:{name:{type:'string'},color:{type:'string'}},required:['name']},annotations:{readOnlyHint:false,destructiveHint:false}},
    {name:'create_event',description:'Create an event',inputSchema:{type:'object',properties:{calendar_id:{type:'string'},title:{type:'string'},starts_at:{type:'string'},ends_at:{type:'string'},location:{type:'string'},description:{type:'string'},all_day:{type:'boolean'}},required:['calendar_id','title','starts_at','ends_at']},annotations:{readOnlyHint:false,destructiveHint:false}},
    {name:'update_event',description:'Edit an event',inputSchema:{type:'object',properties:{id:{type:'string'},title:{type:'string'},starts_at:{type:'string'},ends_at:{type:'string'},location:{type:'string'},description:{type:'string'}},required:['id']},annotations:{readOnlyHint:false,destructiveHint:false}},
    {name:'delete_event',description:'Delete an event',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']},annotations:{readOnlyHint:false,destructiveHint:true}},
    {name:'create_task',description:'Create a task',inputSchema:{type:'object',properties:{title:{type:'string'},due_date:{type:'string'}},required:['title']},annotations:{readOnlyHint:false,destructiveHint:false}},
    {name:'complete_task',description:'Complete a task',inputSchema:{type:'object',properties:{id:{type:'string'},completed:{type:'boolean'}},required:['id','completed']},annotations:{readOnlyHint:false,destructiveHint:false}}
  ]
  const filtered=toolDefs.filter(t=>
    capabilities[t.name as keyof typeof capabilities]==='read'?
      grant.can_read:
    capabilities[t.name as keyof typeof capabilities]==='write'?
      grant.can_write:grant.can_delete)
  if(requested.method==='notifications/initialized')
    return new Response(null,{status:202})
  let result:unknown
  if(requested.method==='initialize'){
    result={protocolVersion:ver,capabilities:{tools:{listChanged:false}},serverInfo:{name:'daylight',version:'2.0.1'}}
  }else if(requested.method==='tools/list'){
    result={tools:filtered}
  }else if(requested.method==='ping'){
    result={}
  }else if(requested.method==='tools/call'){
    const tool=String(requested.params?.name||'')
    if(!filtered.some(t=>t.name===tool))
      return deny('insufficient_scope')
    try{result=await invoke(tool,requested.params?.arguments||{})}
    catch(err){result={isError:true,content:[{type:'text',text:err instanceof Error?err.message:'Tool error'}]}}
  }else{
    return response
  }
  const rpcPayload=JSON.stringify({jsonrpc:'2.0',id:requested.id??null,result})
  const accept=req.headers.get('accept')||''
  if(accept.includes('text/event-stream'))
    return new Response('event: message\\ndata: '+rpcPayload+'\\n\\n',{status:200,headers:{
      'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','X-Accel-Buffering':'no'
    }})
  return new Response(rpcPayload,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
 }
))