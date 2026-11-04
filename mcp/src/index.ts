import "dotenv/config";
import express from "express";
import {randomUUID,createHash} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {rrulestr,RRule} from "rrule";
import {z} from "zod";

if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error("Missing Supabase server credentials");
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const api=express();api.disable("x-powered-by");api.use(express.json({limit:"128kb"}));
const title=z.string().trim().min(1).max(300),iso=z.string().datetime({offset:true}),ident=z.union([z.string(),z.number()]).transform(String);
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const fail=(res:any,status:number,message:string)=>res.status(status).json({jsonrpc:"2.0",id:null,error:{code:status===401?-32001:-32603,message}});
async function authenticate(header:unknown){
 const token=typeof header==="string"?header.match(/^Bearer (dl_mcp_[a-f0-9]{64})$/i)?.[1]:null;
 if(!token)return null;
 const {data,error}=await db.from("mcp_tokens").select("id,user_id,name,scopes,revoked").eq("token_hash",hash(token)).eq("revoked",false).maybeSingle();
 if(error||!data)return null;
 await db.from("mcp_tokens").update({last_used_at:new Date().toISOString()}).eq("id",data.id).eq("user_id",data.user_id);
 return data;
}
async function permission(c:any,scope:"read"|"write"){
 const {data,error}=await db.from("mcp_tokens").select("user_id,revoked,scopes").eq("id",c.id).maybeSingle();
 if(error||!data||data.revoked||data.user_id!==c.user_id||!data.scopes?.includes(scope))throw Error("This token does not have "+scope+" permission");
}
async function load(c:any){
 const {data,error}=await db.from("workspace_snapshots").select("payload,revision").eq("user_id",c.user_id).maybeSingle();
 if(error)throw Error("Could not read calendar data");
 const p=data?.payload||{};return {revision:data?.revision||0,p:{...p,calendars:p.calendars||[],events:p.events||[],tasks:p.tasks||[]}};
}
async function commit(c:any,revision:number,p:any){
 if(JSON.stringify(p).length>1500000)throw Error("Calendar exceeds size limit");
 const payload={payload:p,revision:revision+1,updated_at:new Date().toISOString()};
 if(!revision){
  const r=await db.from("workspace_snapshots").insert({...payload,user_id:c.user_id});
  if(r.error)throw Error("Workspace changed; retry");return;
 }
 const r=await db.from("workspace_snapshots").update(payload).eq("user_id",c.user_id).eq("revision",revision).select("revision").maybeSingle();
 if(r.error||!r.data)throw Error("Workspace changed; reload and retry");
}
function own(p:any,id:string){
 const cal=p.calendars.find((x:any)=>String(x.id)===id);
 if(!cal)throw Error("Calendar not found");
 if(cal.builtin||cal.subscribed||id==="holidays")throw Error("Read-only calendar");
 return cal;
}
function findEvent(p:any,id:string){
 const e=p.events.find((x:any)=>String(x.id)===id);
 if(!e)throw Error("Event not found");own(p,String(e.cal));return e;
}
const nextId=(items:any[])=>Math.max(100,...items.map(x=>Number(x.id)).filter(Number.isSafeInteger))+1;
function occurrences(ev:any,from:Date,to:Date){
 const start=new Date(ev.start??Number(ev.startMs)),end=new Date(ev.end??Number(ev.endMs));
 if(!isFinite(+start)||!isFinite(+end)||end<=start)return [];
 const recurrence=String(ev.rrule||ev.repeat||"").replace(/^RRULE:/i,"");
 if(!recurrence||recurrence==="null")return end>from&&start<to?[{...ev,occurrence_start:start.toISOString(),occurrence_end:end.toISOString()}]:[];
 const rule=recurrence.includes("FREQ=")?recurrence:"FREQ="+recurrence.toUpperCase();
 const parsed=rrulestr(rule,{dtstart:start,tzid:ev.timezone||undefined}) as RRule;
 const except=new Set((ev.exdates||[]).map((x:any)=>new Date(x).toISOString()));
 return parsed.between(new Date(+from-(+end- +start)),to,true).filter(d=>!except.has(d.toISOString())).slice(0,500)
  .map(d=>({...ev,occurrence_start:d.toISOString(),occurrence_end:new Date(+d+(+end- +start)).toISOString()}));
}
const spec={
 list_calendars:{scope:"read",schema:{},description:"List owned and subscribed calendars"},
 list_events:{scope:"read",schema:{start:iso,end:iso,calendar_id:z.string().optional()},description:"List event occurrences by date range"},
 get_event:{scope:"read",schema:{id:ident},description:"Get an event"},
 search_events:{scope:"read",schema:{query:z.string().min(1).max(200)},description:"Search events"},
 list_tasks:{scope:"read",schema:{},description:"List tasks"},
 create_task:{scope:"write",schema:{title,due_date:z.string().optional(),calendar_id:z.string().optional()},description:"Create a task"},
 complete_task:{scope:"write",schema:{id:ident,completed:z.boolean()},description:"Complete a task"},
 create_event:{scope:"write",schema:{calendar_id:z.string(),title,starts_at:iso,ends_at:iso,location:z.string().max(1500).optional(),description:z.string().max(10000).optional(),all_day:z.boolean().optional(),timezone:z.string().optional(),rrule:z.string().optional()},description:"Create an event"},
 update_event:{scope:"write",schema:{id:ident,title:title.optional(),starts_at:iso.optional(),ends_at:iso.optional(),location:z.string().optional(),description:z.string().optional(),timezone:z.string().optional(),rrule:z.string().nullable().optional()},description:"Update an event"},
 delete_event:{scope:"write",schema:{id:ident},description:"Delete event if account owner enabled deletion"}
} as const;
async function action(c:any,name:string,a:any){
 const {p,revision}=await load(c);
 if(name==="list_calendars")return p.calendars.map((x:any)=>({id:x.id,name:x.name,color:x.color,read_only:!!x.subscribed,visible:!x.hidden}));
 if(name==="list_tasks")return p.tasks;
 if(name==="get_event")return p.events.find((e:any)=>String(e.id)===a.id)||null;
 if(name==="list_events"){
  const from=new Date(a.start),to=new Date(a.end);
  if(to<=from||+to-+from>366*86400000)throw Error("Date range must be 1 to 366 days");
  if(a.calendar_id&&!p.calendars.some((x:any)=>x.id===a.calendar_id))throw Error("Calendar not found");
  return p.events.filter((e:any)=>!a.calendar_id||e.cal===a.calendar_id).flatMap((e:any)=>occurrences(e,from,to)).slice(0,500);
 }
 if(name==="search_events"){
  const q=a.query.toLowerCase(),now=Date.now();
  return p.events.filter((e:any)=>[e.title,e.loc,e.desc].some(x=>String(x||"").toLowerCase().includes(q)))
   .flatMap((e:any)=>occurrences(e,new Date(now-365*86400000),new Date(now+365*86400000))).slice(0,200);
 }
 if(name==="create_task"){
  const cal=a.calendar_id||p.calendars.find((x:any)=>!x.subscribed)?.id;own(p,cal);
  const due=a.due_date?new Date(a.due_date+"T12:00:00Z"):new Date();
  if(!isFinite(+due))throw Error("Invalid due date");
  const rec={id:nextId(p.tasks),cal,title:a.title,due:due.toISOString(),hasTime:false,done:false};
  p.tasks.push(rec);await commit(c,revision,p);return rec;
 }
 if(name==="complete_task"){
  const rec=p.tasks.find((x:any)=>String(x.id)===a.id);
  if(!rec)throw Error("Task not found");
  rec.done=a.completed;await commit(c,revision,p);return rec;
 }
 if(name==="create_event"){
  own(p,a.calendar_id);
  if(+new Date(a.ends_at)<=+new Date(a.starts_at))throw Error("End must follow start");
  if(a.timezone)try{new Intl.DateTimeFormat("en",{timeZone:a.timezone});}catch{throw Error("Invalid IANA time zone")}
  const rec={id:nextId(p.events),uid:randomUUID()+"@daylight",sequence:0,dtstamp:new Date().toISOString(),
   cal:a.calendar_id,title:a.title,start:a.starts_at,end:a.ends_at,allDay:!!a.all_day,loc:a.location||"",
   desc:a.description||"",timezone:a.timezone||"America/New_York",rrule:a.rrule||null,repeat:null,exdates:[],declined:false,reminder:null};
  p.events.push(rec);await commit(c,revision,p);return rec;
 }
 if(name==="update_event"){
  const rec=findEvent(p,a.id);
  if(a.title!==undefined)rec.title=a.title;
  if(a.starts_at!==undefined)rec.start=a.starts_at;
  if(a.ends_at!==undefined)rec.end=a.ends_at;
  if(+new Date(rec.end)<=+new Date(rec.start))throw Error("End must follow start");
  if(a.location!==undefined)rec.loc=a.location;
  if(a.description!==undefined)rec.desc=a.description;
  if(a.timezone!==undefined){new Intl.DateTimeFormat("en",{timeZone:a.timezone});rec.timezone=a.timezone;}
  if(a.rrule!==undefined)rec.rrule=a.rrule;
  rec.sequence=(rec.sequence||0)+1;rec.dtstamp=new Date().toISOString();
  await commit(c,revision,p);return rec;
 }
 if(name==="delete_event"){
  const flags=await db.from("user_settings").select("mcp_allow_delete").eq("user_id",c.user_id).maybeSingle();
  if(flags.error||!flags.data?.mcp_allow_delete)throw Error("Account AI deletion setting is disabled");
  const rec=findEvent(p,a.id);
  p.events=p.events.filter((e:any)=>String(e.id)!==a.id);await commit(c,revision,p);
  const audit=await db.from("mcp_audit_log").insert({user_id:c.user_id,tool:"delete_event",action:"delete",
   token_name:c.name,target_id:null,summary:"Deleted event "+String(rec.id)+" "+String(rec.title).slice(0,100)});
  if(audit.error)throw Error("Deletion succeeded but the audit write failed");
  return {deleted:true,id:a.id};
 }
 throw Error("Unknown tool");
}
function makeServer(c:any){
 const server=new McpServer({name:"daylight",version:"0.1.0"});
 for(const [name,def] of Object.entries(spec)){
  server.registerTool(name,{description:def.description,inputSchema:def.schema},async(args:any)=>{
   try{
    await permission(c,def.scope);
    return {content:[{type:"text" as const,text:JSON.stringify(await action(c,name,args))}]};
   }catch(e){return {isError:true as const,content:[{type:"text" as const,text:e instanceof Error?e.message:"Operation failed"}]};}
  });
 }
 return server;
}
api.get("/health",(_req,res)=>res.json({status:"ready"}));
api.all("/mcp",async(req,res)=>{
 if(req.method!=="POST"){fail(res,405,"POST required");return;}
 if(req.headers.origin&&process.env.MCP_ALLOWED_ORIGIN&&req.headers.origin!==process.env.MCP_ALLOWED_ORIGIN){
  fail(res,403,"Forbidden");return;
 }
 const c=await authenticate(req.headers.authorization);
 if(!c){res.setHeader("WWW-Authenticate",'Bearer realm="daylight"');fail(res,401,"Unauthorized");return;}
 const server=makeServer(c);
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}
 catch(e){console.error(e);if(!res.headersSent)fail(res,500,"Server error");}
 finally{await transport.close().catch(()=>{});await server.close().catch(()=>{});}
});
api.listen(Number(process.env.PORT||8787),"0.0.0.0",()=>console.info("Daylight MCP ready"));
