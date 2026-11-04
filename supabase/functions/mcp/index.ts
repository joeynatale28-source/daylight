// Daylight OAuth MCP endpoint. Uses Supabase's official Protected Resource -> JWT pipeline.
// Authenticated user context is used for all tools; no service role key is used.
import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0'
import { pipeline } from 'npm:@supabase/middleware@1'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1'
import { z } from 'npm:zod@^4.3.6'

const FORBIDDEN=new Set(['delete_event'])
const WRITE=new Set(['create_calendar','create_event','update_event','create_task','complete_task'])
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
  return handler.fetch(req)
 }
))