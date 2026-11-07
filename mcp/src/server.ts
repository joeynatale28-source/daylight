import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { RRule, rrulestr } from 'rrule';
import { z } from 'zod';

const url=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!secret)throw Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'512kb'}));
type Obj=Record<string,any>;
type Caller={user_id:string,name:string,scopes:string[]};

async function authenticate(header:string|undefined):Promise<Caller|null> {
  const match=/^Bearer (dl_mcp_[a-f0-9]{64})$/.exec(header||'');
  if(!match)return null;
  const hash=createHash('sha256').update(match[1]).digest('hex');
  const {data,error}=await db.from('mcp_tokens').select('id,user_id,name,token_hash,scopes,revoked')
    .eq('token_hash',hash).eq('revoked',false).maybeSingle();
  if(error||!data||typeof data.token_hash!=='string')return null;
  const a=Buffer.from(hash,'hex'),b=Buffer.from(data.token_hash,'hex');
  if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  await db.from('mcp_tokens').update({last_used_at:new Date().toISOString()}).eq('id',data.id).eq('user_id',data.user_id);
  return {user_id:data.user_id,name:data.name,scopes:data.scopes||[]};
}
const fail=(message:string)=>{throw Error(message)};
function title(v:string){const s=v.trim();if(!s||s.length>300)fail('Title must be 1–300 characters');return s;}
function when(v:string){const d=new Date(v);if(!Number.isFinite(+d))fail('Invalid ISO 8601 timestamp');return d;}
function tz(v:string){try{new Intl.DateTimeFormat('en',{timeZone:v});return v}catch{return fail('Invalid IANA timezone')}}
function hasWrite(c:Caller){if(!c.scopes.includes('write'))fail('This token has read-only scope');}
async function doc(c:Caller){
  const {data,error}=await db.from('workspace_snapshots').select('payload,revision')
    .eq('user_id',c.user_id).maybeSingle();
  if(error)throw error;
  return {payload:(data?.payload||{version:2,calendars:[],events:[],tasks:[],settings:{},ui:{}}) as Obj,
    revision:Number(data?.revision||0)};
}
async function commit(c:Caller,payload:Obj,revision:number){
  if(JSON.stringify(payload).length>1_500_000)fail('Workspace size limit exceeded');
  const patch={payload,revision:revision+1,updated_at:new Date().toISOString()};
  if(revision===0){
    const {error}=await db.from('workspace_snapshots').insert({...patch,user_id:c.user_id});
    if(error)fail('Workspace changed concurrently; reload and retry');return;
  }
  const {data,error}=await db.from('workspace_snapshots').update(patch)
    .eq('user_id',c.user_id).eq('revision',revision).select('revision').maybeSingle();
  if(error||!data)fail('Workspace changed concurrently; reload and retry');
}
function writable(payload:Obj,id:string){
  const c=(payload.calendars||[]).find((v:Obj)=>v.id===id);
  if(!c||c.subscribed||c.builtin)fail('Calendar not found or read-only');
  return c;
}
function event(payload:Obj,id:string){
  const e=(payload.events||[]).find((v:Obj)=>String(v.id)===id);
  if(!e)fail('Event not found');
  writable(payload,String(e.cal));return e;
}
function validate(data:Obj){
  if(data.title!==undefined)data.title=title(String(data.title));
  if(data.timezone!==undefined)data.timezone=tz(String(data.timezone));
  if(data.start!==undefined)data.start=when(String(data.start)).toISOString();
  if(data.end!==undefined)data.end=when(String(data.end)).toISOString();
  if(data.start!==undefined&&data.end!==undefined&&+when(data.end)<=+when(data.start))
    fail('End time must be after start time');
  if(data.rrule!==undefined&&data.rrule!==null){
    try{rrulestr('RRULE:'+String(data.rrule).replace(/^RRULE:/i,''))}
    catch{fail('Invalid RRULE');}
  }
  return data;
}
function nextId(items:Obj[]){return Math.max(100,...items.map(e=>Number(e.id)).filter(Number.isSafeInteger))+1;}
function occurrences(e:Obj,start:Date,end:Date){
  const first=when(e.start);
  const duration=+when(e.end)-+first;
  if(duration<=0)return [];
  const raw=String(e.rrule||(/^daily|weekly|monthly|yearly$/.test(e.repeat||'')?'FREQ='+e.repeat.toUpperCase():'')).replace(/^RRULE:/i,'');
  const points:Date[]=raw?rrulestr('RRULE:'+raw,{dtstart:first}).between(new Date(+start-duration),end,true):[first];
  const ex=new Set((e.exdates||[]).map((v:string)=>+when(v)));
  return points.filter(d=>!ex.has(+d)&&+d<+end&&+d+duration>+start)
    .slice(0,1000).map(d=>({...e,occurrence_start:d.toISOString(),occurrence_end:new Date(+d+duration).toISOString()}));
}
function response(value:unknown){return {content:[{type:'text' as const,text:JSON.stringify(value)}]};}
function permission(c:Caller,write=false){if(!c.scopes.includes('read')&&!c.scopes.includes('write'))fail('Token has no read scope');if(write)hasWrite(c);}
function install(server:McpServer,c:Caller) {
  const add=(name:string,description:string,inputSchema:Obj,run:(args:any)=>Promise<unknown>,write=false)=>{
    server.registerTool(name,{description,inputSchema:inputSchema as any},async(args:any)=>{
      try{permission(c,write);return response(await run(args))}
      catch(e){return {isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:'Operation failed'}]}}
    });
  };
  add('list_calendars','List your calendars',{},async()=>{
    const {payload}=await doc(c);
    return (payload.calendars||[]).map((x:Obj)=>({id:x.id,name:x.name,color:x.color,read_only:!!x.subscribed}));
  });
  add('list_events','List events with recurring occurrences in a time range',{
    calendar_id:z.string().optional(),start:z.string(),end:z.string()
  },async(a)=>{
    const {payload}=await doc(c),start=when(a.start),end=when(a.end);
    if(+end<=+start||+end-+start>366*864e5)fail('Provide a range of at most 366 days');
    if(a.calendar_id && !(payload.calendars||[]).some((x:Obj)=>x.id===a.calendar_id))fail('Calendar not found');
    return (payload.events||[]).filter((x:Obj)=>!a.calendar_id||x.cal===a.calendar_id)
      .flatMap((x:Obj)=>occurrences(x,start,end)).slice(0,500);
  });
  add('get_event','Get an owned event',{id:z.string()},async(a)=>{
    const {payload}=await doc(c);
    return event(payload,a.id);
  });
  add('search_events','Search event title, description, or location',{
    query:z.string().min(1),start:z.string().optional(),end:z.string().optional()
  },async(a)=>{
    const {payload}=await doc(c),q=a.query.toLowerCase();
    const start=when(a.start||new Date(Date.now()-365*864e5).toISOString());
    const end=when(a.end||new Date(Date.now()+365*864e5).toISOString());
    if(+end<=+start||+end-+start>732*864e5)fail('Invalid search window');
    return (payload.events||[]).filter((e:Obj)=>
      [e.title,e.desc,e.loc].some(v=>String(v||'').toLowerCase().includes(q)))
      .flatMap((e:Obj)=>occurrences(e,start,end)).slice(0,200);
  });
  add('create_event','Create event on an owned writable calendar',{
    calendar_id:z.string(),title:z.string(),starts_at:z.string(),ends_at:z.string(),
    timezone:z.string().optional(),all_day:z.boolean().optional(),rrule:z.string().optional(),
    description:z.string().optional(),location:z.string().optional()
  },async(a)=>{
    const {payload,revision}=await doc(c);
    writable(payload,a.calendar_id);
    const e=validate({id:nextId(payload.events||[]),uid:crypto.randomUUID()+'@daylight',
      cal:a.calendar_id,title:a.title,start:a.starts_at,end:a.ends_at,
      timezone:a.timezone||'America/New_York',allDay:!!a.all_day,
      rrule:a.rrule||null,repeat:null,desc:String(a.description||'').slice(0,10000),
      loc:String(a.location||'').slice(0,1500),dtstamp:new Date().toISOString(),
      sequence:0,exdates:[],declined:false});
    (payload.events||=[]).push(e);await commit(c,payload,revision);return e;
  },true);
  add('update_event','Edit one owned event',{
    id:z.string(),title:z.string().optional(),starts_at:z.string().optional(),
    ends_at:z.string().optional(),timezone:z.string().optional(),rrule:z.string().nullable().optional(),
    description:z.string().optional(),location:z.string().optional()
  },async(a)=>{
    const {payload,revision}=await doc(c);
    const e=event(payload,a.id);
    const newFields:Obj={};
    if(a.title!==undefined)newFields.title=a.title;
    if(a.starts_at!==undefined)newFields.start=a.starts_at;
    if(a.ends_at!==undefined)newFields.end=a.ends_at;
    if(a.timezone!==undefined)newFields.timezone=a.timezone;
    if(a.rrule!==undefined)newFields.rrule=a.rrule;
    if(a.description!==undefined)newFields.desc=String(a.description).slice(0,10000);
    if(a.location!==undefined)newFields.loc=String(a.location).slice(0,1500);
    Object.assign(e,validate(newFields));
    if(+when(e.end)<=+when(e.start))fail('End time must follow start');
    e.sequence=Number(e.sequence||0)+1;e.dtstamp=new Date().toISOString();
    await commit(c,payload,revision);return e;
  },true);
  add('delete_event','Permanently delete event only when owner has enabled AI deletion',{id:z.string()},async(a)=>{
    const {payload,revision}=await doc(c);
    const target=event(payload,a.id);
    // One database transaction performs the deletion and immutable audit write.
    const {data:out,error}=await db.rpc('daylight_mcp_delete_snapshot_event',{
      p_owner:c.user_id,p_event_id:a.id,p_event_title:String(target.title||'Untitled'),
      p_token_name:c.name,p_revision:revision
    });
    if(error)throw error;
    return out;
  },true);
  add('list_tasks','List tasks',{},async()=>{
    const {payload}=await doc(c);return payload.tasks||[];
  });
  add('create_task','Create task',{
    title:z.string(),due_date:z.string().optional(),notes:z.string().optional()
  },async(a)=>{
    const {payload,revision}=await doc(c);
    const chosen=(payload.calendars||[]).find((x:Obj)=>!x.subscribed&&!x.builtin);
    if(!chosen)fail('Create a writable calendar first');
    const due=a.due_date||new Date().toISOString().slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due)))fail('Invalid YYYY-MM-DD due date');
    const t={id:nextId(payload.tasks||[]),title:title(a.title),cal:chosen.id,notes:String(a.notes||'').slice(0,5000),
      due:new Date(due+'T12:00:00Z').toISOString(),hasTime:false,done:false};
    (payload.tasks||=[]).push(t);await commit(c,payload,revision);return t;
  },true);
  add('complete_task','Mark a task done or undone',{id:z.string(),completed:z.boolean()},async(a)=>{
    const {payload,revision}=await doc(c);
    const t=(payload.tasks||[]).find((x:Obj)=>String(x.id)===a.id);
    if(!t)fail('Task not found');
    t.done=a.completed;await commit(c,payload,revision);return t;
  },true);
}

app.post('/mcp',async(req,res)=>{
  try{
    const c=await authenticate(req.header('Authorization'));
    if(!c){res.status(401).json({jsonrpc:'2.0',id:null,error:{code:-32001,message:'Unauthorized'}});return;}
    // Stateless transport: each HTTP request gets a server bound to the
    // token owner. No shared process-global "current user" state.
    const server=new McpServer({name:'daylight',version:'0.1.0'});
    install(server,c);
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});
    res.on('close',()=>{void transport.close();void server.close();});
    await server.connect(transport);
    await transport.handleRequest(req,res,req.body);
  }catch(error){
    if(!res.headersSent)res.status(500).json({jsonrpc:'2.0',id:null,error:{code:-32603,message:'Server error'}});
    console.error('MCP request failed',error);
  }
});
app.get('/health',(_req,res)=>res.json({ok:true,service:'daylight-mcp'}));
const port=Number(process.env.DAYLIGHT_MCP_PORT||8787);
app.listen(port,()=>console.log('Daylight MCP listening on :'+port));
