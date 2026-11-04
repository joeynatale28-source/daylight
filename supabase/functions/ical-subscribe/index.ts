import ICAL from "npm:ical.js@2.2.1";
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const cors={"Access-Control-Allow-Origin":"https://joeynatale28-source.github.io",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS"};
const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}
});
function safeURL(raw:unknown) {
 if(typeof raw!=="string"||raw.length>2048)throw Error("Enter a calendar feed URL");
 const value=raw.startsWith("webcal://")?"https://"+raw.slice(9):raw;
 const u=new URL(value);
 if(u.protocol!=="https:"||u.username||u.password||u.port)throw Error("Only HTTPS calendar feeds are supported");
 const host=u.hostname.toLowerCase();
 if(!host.includes(".")||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||
    host.endsWith(".internal")||host.endsWith(".test")||host.includes(":")||
    /^\d+(?:\.\d+){3}$/.test(host)||host.endsWith(".invalid"))
  throw Error("Private network and local addresses cannot be used");
 return u.href;
}
async function fetchICS(input:string) {
 let address=safeURL(input);
 for(let n=0;n<5;n++) {
  const response=await fetch(address,{redirect:"manual",signal:AbortSignal.timeout(14000),
   headers:{"Accept":"text/calendar,text/plain","User-Agent":"DaylightCalendar/1.0 (iCalendar Subscription Reader)"}});
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get("location");if(!location)throw Error("Invalid feed redirect");
   address=safeURL(new URL(location,address).href);continue;
  }
  if(!response.ok)throw Error("Feed fetch failed (HTTP "+response.status+")");
  if(Number(response.headers.get("content-length")||0)>3_000_000)throw Error("Feed is too large");
  const text=await response.text();
  if(text.length>3_000_000)throw Error("Feed is too large");
  if(!/BEGIN:VCALENDAR/.test(text)||!/END:VCALENDAR/.test(text))throw Error("The URL did not return a valid iCalendar");
  return {text,address,etag:response.headers.get("etag")};
 }
 throw Error("Calendar URL redirected too many times");
}
function inUTC(value:any,defaultTz:string) {
 if(value.isDate) return new Date(Date.UTC(value.year,value.month-1,value.day));
 const tzid=value.zone?.tzid;
 if(tzid && tzid!=="floating" && tzid!=="local" && tzid!=="UTC" && tzid!=="Z") {
  // ICAL.js supplies UTC conversion when an actual VTIMEZONE definition exists.
  if(value.zone?.component) return value.toJSDate();
  // No VTIMEZONE: use Intl's IANA rules rather than silently assuming UTC.
  try{
   const zone=new Intl.DateTimeFormat("en-US",{timeZone:tzid,year:"numeric",month:"2-digit",day:"2-digit",
     hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
   const wanted=Date.UTC(value.year,value.month-1,value.day,value.hour,value.minute,value.second);
   let ms=wanted;
   for(let i=0;i<4;i++){
    const parts=Object.fromEntries(zone.formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
    const displayed=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
    ms+=wanted-displayed;
   }
   return new Date(ms);
  }catch{throw Error("Unsupported time zone: "+tzid)}
 }
 if(tzid==="UTC"||tzid==="Z")return value.toJSDate();
 // Floating times use the X-WR-TIMEZONE of the source calendar, never the viewer's zone.
 if(defaultTz) {
  const temporal={...value,zone:{tzid:defaultTz}};
  return inUTC(temporal,"");
 }
 throw Error("Floating time has no calendar time zone");
}
function parseFeed(raw:string) {
 let comp:any;
 try{comp=new ICAL.Component(ICAL.parse(raw))}catch{throw Error("Invalid iCalendar syntax")}
 if(comp.name!=="vcalendar")throw Error("Feed must be a VCALENDAR");
 for(const part of comp.getAllSubcomponents("vtimezone")) {
  try{const tz=new ICAL.Timezone(part);ICAL.TimezoneService.register(tz.tzid,tz)}catch{/* skip malformed VTIMEZONE */}
 }
 const timezone=String(comp.getFirstPropertyValue("x-wr-timezone")||"UTC");
 const name=String(comp.getFirstPropertyValue("x-wr-calname")||"").trim();
 const all=comp.getAllSubcomponents("vevent");
 if(all.length>5000)throw Error("Feed has too many events");
 const master=new Map<string,any>(),exceptions:any[]=[];
 let skipped=0;
 for(const part of all) {
  try {
   const ev=new ICAL.Event(part);
   if(!ev.uid||!ev.startDate) {skipped++;continue}
   if(ev.isRecurrenceException())exceptions.push(ev);
   else master.set(ev.uid,ev);
  }catch{skipped++}
 }
 for(const ex of exceptions) {
  const parent=master.get(ex.uid);
  if(!parent){skipped++;continue}
  try{parent.relateException(ex)}catch{skipped++}
 }
 const events:any[]=[];
 const lower=new Date(Date.now()-365*86400000),upper=new Date(Date.now()+730*86400000);
 function store(ev:any,part:any,original:any,index:number) {
  const start=inUTC(part.startDate,timezone),end=inUTC(part.endDate,timezone);
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)throw Error("Invalid event dates");
  if(end<lower||start>upper)return;
  // Convert RFC exclusive all-day DTEND to the inclusive end used in Daylight's UI.
  const allDay=!!part.startDate.isDate;
  const adjustedEnd=allDay?new Date(end.getTime()-60000):end;
  events.push({
   external_uid:String(ev.uid),occurrence_id:String(ev.uid)+":"+String(original?.toICALString()||index),
   title:String(part.summary||ev.summary||"Untitled").slice(0,300),
   description:String(part.description||"").slice(0,10000),location:String(part.location||"").slice(0,1500),
   start:start.toISOString(),end:adjustedEnd.toISOString(),allDay,
   status:String(part.component?.getFirstPropertyValue("status")||"CONFIRMED").toUpperCase(),
   source_timezone:part.startDate.zone?.tzid||timezone,
   recurrence_id:original?.toICALString()||null
  });
 }
 for(const ev of master.values()) {
  try {
   const recurring=!!ev.component.getFirstPropertyValue("rrule")||ev.component.getAllProperties("rdate").length>0;
   if(!recurring){store(ev,ev,null,0);continue}
   const iter=ev.iterator();
   let seen=0,next;
   while((next=iter.next()) && seen++<3000){
    const d=ev.getOccurrenceDetails(next);
    const st=inUTC(d.startDate,timezone);
    if(st>upper)break;
    try{store(ev,d.item,d.recurrenceId,seen)}catch{skipped++}
   }
   if(seen>=3000)skipped++;
  }catch{skipped++}
 }
 return {name,timezone,events,skipped};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond({error:"POST required"},405);
 const jwt=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!jwt)return respond({error:"Sign in required"},401);
 const {data:{user},error}=await admin.auth.getUser(jwt);
 if(error||!user)return respond({error:"Sign in required"},401);
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return respond({error:"Invalid JSON"},400)}
 const action=String(body.action||"");
 if(action==="list"){
  const result=await admin.from("subscriptions")
    .select("id,name,url,color,last_fetched_at,last_error,skipped_count,cached_events")
    .eq("user_id",user.id).order("created_at",{ascending:true});
  return result.error?respond({error:"Could not load subscriptions"},503):respond({subscriptions:result.data});
 }
 if(action==="remove"){
  const id=String(body.id||"");
  const result=await admin.from("subscriptions").delete().eq("id",id).eq("user_id",user.id);
  return result.error?respond({error:"Cannot remove subscription"},503):respond({removed:true});
 }
 if(action!=="add"&&action!=="refresh")return respond({error:"Unknown action"},400);
 let record:any=null,feedURL="";
 try {
  if(action==="refresh"){
   const id=String(body.id||"");
   const result=await admin.from("subscriptions").select("*").eq("id",id).eq("user_id",user.id).maybeSingle();
   if(result.error||!result.data)return respond({error:"Subscription not found"},404);
   record=result.data;feedURL=record.url;
   if(record.last_fetched_at && Date.now()-Date.parse(record.last_fetched_at)<3*3600000)
    return respond({subscription:record,unchanged:true});
  }else{
   feedURL=safeURL(body.url);
   const exists=await admin.from("subscriptions").select("id").eq("user_id",user.id).eq("url",feedURL).maybeSingle();
   if(exists.data)return respond({error:"Already subscribed to that URL"},409);
  }
  const fetched=await fetchICS(feedURL);
  const parsed=parseFeed(fetched.text);
  const name=String(body.name||record?.name||parsed.name||new URL(feedURL).hostname).trim().slice(0,120);
  const fields={name,url:feedURL,color:record?.color||"teal",cached_events:parsed.events,
   skipped_count:parsed.skipped,last_fetched_at:new Date().toISOString(),
   last_error:null,last_error_at:null,etag:fetched.etag};
  const response=record
   ? await admin.from("subscriptions").update(fields).eq("id",record.id).eq("user_id",user.id).select().single()
   : await admin.from("subscriptions").insert({...fields,user_id:user.id}).select().single();
  if(response.error)throw response.error;
  return respond({subscription:response.data,imported:parsed.events.length,skipped:parsed.skipped});
 } catch(err) {
  const message=err instanceof Error?err.message:"Could not fetch iCalendar feed";
  if(record)await admin.from("subscriptions").update({last_error:message,last_error_at:new Date().toISOString()})
   .eq("id",record.id).eq("user_id",user.id);
  return respond({error:message,kept_cache:!!record},400);
 }
});
