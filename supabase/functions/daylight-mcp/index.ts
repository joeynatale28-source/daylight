// Daylight MCP resource server. OAuth 2.1 is issued by Supabase Auth;
// THIS server validates the Supabase token and an explicit per-client consent.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const PROJECT=Deno.env.get('SUPABASE_URL')!;
const ADMIN=createClient(PROJECT,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const AUTH_SERVER=PROJECT+'/auth/v1';
const SELF=PROJECT+'/functions/v1/daylight-mcp';
const PERM='Bearer realm="daylight", resource_metadata="'+SELF+'/.well-known/oauth-protected-resource"';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,mcp-session-id,mcp-protocol-version','access-control-allow-methods':'GET,POST,OPTIONS','access-control-expose-headers':'www-authenticate,mcp-session-id'};
const resp=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store',...headers}});
const noAuth=()=>resp({error:'Unauthorized',error_description:'Connect Daylight with OAuth 2.1 and approve its requested permissions.'},401,{'www-authenticate':PERM});
type Obj=Record<string,any>;
const bad=(message:string,status=400)=>resp({error:message},status);
const definitions=[
 {name:'list_calendars',description:'List your Daylight calendars.',inputSchema:{type:'object',properties:{}}},
 {name:'list_events',description:'List events within a time range (ISO 8601).',inputSchema:{type:'object',properties:{start:{type:'string'},end:{type:'string'}},required:['start','end']}},
 {name:'get_event',description:'Get an event by its ID.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}},
 {name:'search_events',description:'Search calendar events by title, location, or description.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}},
 {name:'list_tasks',description:'List personal to-do tasks.',inputSchema:{type:'object',properties:{}}},
 {name:'create_calendar',description:'Create a new writable calendar.',inputSchema:{type:'object',properties:{name:{type:'string'},color:{type:'string'}},required:['name']}},
 {name:'create_event',description:'Create a calendar event.',inputSchema:{type:'object',properties:{calendar_id:{type:'string'},title:{type:'string'},starts_at:{type:'string'},ends_at:{type:'string'},location:{type:'string'},description:{type:'string'},all_day:{type:'boolean'}},required:['calendar_id','title','starts_at','ends_at']}},
 {name:'update_event',description:'Edit one event on a writable calendar.',inputSchema:{type:'object',properties:{id:{type:'string'},title:{type:'string'},starts_at:{type:'string'},ends_at:{type:'string'},location:{type:'string'},description:{type:'string'}},required:['id']}},
 {name:'delete_event',description:'Delete an event (requires additional explicit delete permission).',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}},
 {name:'create_task',description:'Create a to-do task.',inputSchema:{type:'object',properties:{title:{type:'string'},notes:{type:'string'},due_date:{type:'string'}},required:['title']}},
 {name:'complete_task',description:'Set a task completion status.',inputSchema:{type:'object',properties:{id:{type:'string'},completed:{type:'boolean'}},required:['id','completed']}}
];
const writeTools=new Set(['create_calendar','create_event','update_event','create_task','complete_task']);
const deleteTools=new Set(['delete_event']);
const safeIso=(str:unknown)=>{const d=new Date(String(str||''));if(!Number.isFinite(d.valueOf()))throw Error('Invalid ISO date');return d.toISOString()};
const id=()=>crypto.randomUUID();
const jsonr=(id:unknown,result:unknown)=>resp({jsonrpc:'2.0',id,result});
const rpcErr=(id:unknown,message:string)=>jsonr(id,{isError:true,content:[{type:'text',text:message}]});
function accessOf(token:string){
 try{const payload=token.split('.')[1];return JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')))}
 catch{return {}}
}
async function sha(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function auth(token:string){
 if(!token)return null;
 if(/^dl_mcp_[a-f0-9]{64}$/.test(token)){
  const hashed=await sha(token);
  const {data}=await ADMIN.from('mcp_tokens').select('id,user_id,revoked,scopes').eq('token_hash',hashed).eq('revoked',false).maybeSingle();
  if(!data)return null;
  await ADMIN.from('mcp_tokens').update({last_used_at:new Date().toISOString()}).eq('id',data.id);
  const scopes=Array.isArray(data.scopes)?data.scopes:[];
  return {user_id:data.user_id,client_id:'manual:'+data.id,grant:{can_read:scopes.includes('read')||scopes.includes('write'),can_write:scopes.includes('write'),can_delete:scopes.includes('write'),revoked:false},manual:true};
 }
 const {data:{user},error}=await ADMIN.auth.getUser(token);
 if(error||!user)return null;
 const claims=accessOf(token); // Decoded only AFTER getUser verifies token.
 if(claims.sub!==user.id||typeof claims.client_id!=='string'||!claims.client_id)return null;
 const {data:grant,error:grantError}=await ADMIN.from('oauth_mcp_grants').select('can_read,can_write,can_delete,revoked').eq('user_id',user.id).eq('client_id',claims.client_id).maybeSingle();
 if(grantError||!grant||grant.revoked)return null;
 return {user_id:user.id,client_id:claims.client_id,grant,manual:false};
}
async function loadDoc(uid:string){
 const {data,error}=await ADMIN.from('workspace_snapshots').select('revision,payload').eq('user_id',uid).maybeSingle();
 if(error)throw error;
 return {revision:data?.revision||0,document:data?.payload||{version:1,calendars:[],events:[],tasks:[],settings:{},ui:{},notified:{}}};
}
function checkCalendar(doc:Obj,calId:string){
 const cal=(doc.calendars||[]).find((x:Obj)=>x.id===calId);
 if(!cal)throw Error('Calendar does not belong to your account');
 if(cal.subscribed)throw Error('Subscribed calendars are read-only');
 return cal;
}
function checkEvent(doc:Obj,eventId:string){
 const ev=(doc.events||[]).find((x:Obj)=>String(x.id)===eventId);
 if(!ev)throw Error('Event not found');
 checkCalendar(doc,ev.cal);
 return ev;
}
function requireTitle(v:unknown){const s=String(v||'').trim();if(!s||s.length>300)throw Error('Title must be between 1 and 300 characters');return s}
async function apply(uid:string,doc:Obj,version:number){
 if(JSON.stringify(doc).length>1_500_000)throw Error('Workspace too large');
 if(version===0){
  const {error}=await ADMIN.from('workspace_snapshots').insert({user_id:uid,payload:doc,revision:1});
  if(error)throw Error('Calendar changed; reload and retry: '+error.message);
  return;
 }
 const {data,error}=await ADMIN.from('workspace_snapshots').update({payload:doc,revision:version+1,updated_at:new Date().toISOString()}).eq('user_id',uid).eq('revision',version).select('revision').maybeSingle();
 if(error)throw error;if(!data)throw Error('Calendar was changed in another session; retry your request');
}
async function action(user_id:string,tool:string,args:Obj,perm:Obj){
 const {document:doc,revision}=await loadDoc(user_id);
 const events=doc.events as Obj[],cals=doc.calendars as Obj[],tasks=doc.tasks as Obj[];
 if(tool==='list_calendars')return cals.map(c=>({id:c.id,name:c.name,color:c.color,visible:!c.hidden,read_only:!!c.subscribed}));
 if(tool==='list_tasks')return tasks;
 if(tool==='get_event')return checkEvent(doc,String(args.id||''));
 if(tool==='list_events'){
  const start=+new Date(safeIso(args.start)),end=+new Date(safeIso(args.end));
  if(end<=start||end-start>365*86400000)throw Error('Choose a time window up to one year');
  return events.filter(ev=>{const s=ev.start!=null?+new Date(ev.start):Number(ev.startMs);const e=ev.end!=null?+new Date(ev.end):Number(ev.endMs);return s<end&&e>start;}).slice(0,500);
 }
 if(tool==='search_events'){
  const q=String(args.query||'').trim().toLowerCase();if(!q)throw Error('Search query required');
  return events.filter(ev=>[ev.title,ev.loc,ev.desc].some(s=>String(s||'').toLowerCase().includes(q))).slice(0,200);
 }
 if(tool==='create_calendar'){
  const name=requireTitle(args.name).slice(0,120),color=String(args.color||'blue');
  const rec={id:'cal-'+id(),name,color:['blue','violet','green','amber','rose','teal','plum','gray'].includes(color)?color:'blue',hidden:false,subscribed:false,feedUrl:null,source:null,lastSync:null};
  cals.push(rec);await apply(user_id,doc,revision);return rec;
 }
 if(tool==='create_event'){
  const cal=String(args.calendar_id||'');checkCalendar(doc,cal);
  const start=+new Date(safeIso(args.starts_at)),end=+new Date(safeIso(args.ends_at));if(end<=start)throw Error('Event end must follow start');
  const nextId=Math.max(100,...events.map(e=>Number(e.id)).filter(Number.isFinite))+1;
  const rec={id:nextId,uid:id()+'@daylight',cal,title:requireTitle(args.title),loc:String(args.location||'').slice(0,1500),desc:String(args.description||'').slice(0,10000),allDay:!!args.all_day,start:new Date(start).toISOString(),end:new Date(end).toISOString(),rrule:null,repeat:null,exdates:[],declined:false,dtstamp:new Date().toISOString(),sequence:0};
  events.push(rec);await apply(user_id,doc,revision);return rec;
 }
 if(tool==='update_event'){
  const rec=checkEvent(doc,String(args.id||'')),old={...rec};
  if(args.title!==undefined)rec.title=requireTitle(args.title);
  if(args.location!==undefined)rec.loc=String(args.location||'').slice(0,1500);
  if(args.description!==undefined)rec.desc=String(args.description||'').slice(0,10000);
  if(args.starts_at!==undefined)rec.start=safeIso(args.starts_at);
  if(args.ends_at!==undefined)rec.end=safeIso(args.ends_at);
  if(+new Date(rec.end)<=+new Date(rec.start))throw Error('Event end must follow start');
  rec.sequence=(rec.sequence||0)+1;rec.dtstamp=new Date().toISOString();
  await apply(user_id,doc,revision);return rec;
 }
 if(tool==='delete_event'){
  const rec=checkEvent(doc,String(args.id||''));
  doc.events=events.filter(e=>String(e.id)!==String(rec.id));await apply(user_id,doc,revision);return {deleted:true,id:rec.id};
 }
 if(tool==='create_task'){
  const nextId=Math.max(100,...tasks.map(t=>Number(t.id)).filter(Number.isFinite))+1;
  const due=args.due_date?String(args.due_date):new Date().toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Due date must be YYYY-MM-DD');
  const defaultCal=cals.find(c=>!c.subscribed)?.id||'personal';
  const rec={id:nextId,cal:defaultCal,title:requireTitle(args.title),notes:String(args.notes||'').slice(0,5000),due:new Date(due+'T12:00:00Z').toISOString(),hasTime:false,done:false};
  tasks.push(rec);await apply(user_id,doc,revision);return rec;
 }
 if(tool==='complete_task'){
  const rec=tasks.find(t=>String(t.id)===String(args.id||''));if(!rec)throw Error('Task not found');rec.done=args.completed===true;
  await apply(user_id,doc,revision);return rec;
 }
 throw Error('Unknown tool');
}
async function audit(uid:string,cid:string,tool:string,target:string,result:string){
 await ADMIN.from('mcp_workspace_audit').insert({user_id:uid,client_id:cid,tool,target_id:target||null,result});
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method==='GET'&&req.url.includes('oauth-protected-resource')){
  return resp({resource:SELF,authorization_servers:[AUTH_SERVER],bearer_methods_supported:['header'],scopes_supported:['openid','profile','email']});
 }
 if(req.method!=='POST')return bad('MCP requires POST',405);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 const caller=await auth(token);
 if(!caller)return noAuth();
 let body:Obj;try{body=await req.json()}catch{return bad('Invalid JSON')}
 const requestId=body.id??null;
 if(body.method==='initialize')return jsonr(requestId,{protocolVersion:'2025-06-18',serverInfo:{name:'Daylight Calendar',version:'1.1.0'},capabilities:{tools:{listChanged:false}}});
 if(body.method==='notifications/initialized')return new Response(null,{status:202,headers:cors});
 if(body.method==='ping')return jsonr(requestId,{});
 if(body.method==='tools/list')return jsonr(requestId,{tools:definitions.filter(t=>caller.grant.can_read&&(writeTools.has(t.name)?caller.grant.can_write:deleteTools.has(t.name)?caller.grant.can_delete:true))});
 if(body.method==='tools/call'){
  const tool=String(body.params?.name||''),args=body.params?.arguments||{};
  const def=definitions.find(t=>t.name===tool);
  if(!def)return rpcErr(requestId,'Unknown tool');
  if(!caller.grant.can_read||(writeTools.has(tool)&&!caller.grant.can_write)||(deleteTools.has(tool)&&!caller.grant.can_delete))return rpcErr(requestId,'This client has not been approved for that permission');
  if(deleteTools.has(tool)){
   const {data}=await ADMIN.from('user_settings').select('mcp_allow_delete').eq('user_id',caller.user_id).maybeSingle();
   if(!data?.mcp_allow_delete)return rpcErr(requestId,'Account-wide AI deletion is disabled in Daylight settings');
  }
  try{
   const value=await action(caller.user_id,tool,args,caller.grant);
   if(writeTools.has(tool)||deleteTools.has(tool))await audit(caller.user_id,caller.client_id,tool,String(args.id||value?.id||''),'success');
   return jsonr(requestId,{content:[{type:'text',text:JSON.stringify(value)}]});
  }catch(err){
   if(writeTools.has(tool)||deleteTools.has(tool))await audit(caller.user_id,caller.client_id,tool,String(args.id||''),'failure');
   return rpcErr(requestId,err instanceof Error?err.message:'Operation failed');
  }
 }
 return resp({jsonrpc:'2.0',id:requestId,error:{code:-32601,message:'Method not found'}});
});
