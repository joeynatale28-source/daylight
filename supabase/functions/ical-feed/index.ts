import ical, { ICalCalendarMethod } from "npm:ical-generator@11.1.2";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors = {
 "Access-Control-Allow-Origin":"https://joeynatale28-source.github.io",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
};
const send = (o:unknown,status=200) => new Response(JSON.stringify(o),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const notFound = () => new Response("Not Found",{status:404,headers:{"Cache-Control":"no-store"}});
const hash = async (s:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const generate = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(40)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const feedBase = url+"/functions/v1/ical-feed/";
function tokenLinks(id:string,token:string) {
 const https=feedBase+encodeURIComponent(id)+"?token="+encodeURIComponent(token);
 return {https,webcal:https.replace(/^https:/,"webcal:")};
}
function asDate(v:unknown) {
 if(typeof v==="number"||(typeof v==="string"&&/^\d{13}$/.test(v)))return new Date(Number(v));
 return new Date(String(v??""));
}
function dayInZone(d:Date,timezone:string) {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+"-"+p.month+"-"+p.day;
}
function repeat(e:Record<string,unknown>) {
 const r=String(e.rrule||"").replace(/^RRULE:/i,"");
 const pattern=String(e.repeat||"").toUpperCase();
 let opts:Record<string,unknown>|null=null;
 if(r) {
  const fields=Object.fromEntries(r.split(";").map(v=>v.split("=")));
  if(!["DAILY","WEEKLY","MONTHLY","YEARLY"].includes(fields.FREQ))return null;
  opts={freq:fields.FREQ};
  if(fields.INTERVAL)opts.interval=Number(fields.INTERVAL);
  if(fields.COUNT)opts.count=Number(fields.COUNT);
  if(fields.BYDAY)opts.byDay=fields.BYDAY.toLowerCase().split(",");
  if(fields.BYMONTH)opts.byMonth=fields.BYMONTH.split(",").map(Number);
  if(fields.BYMONTHDAY)opts.byMonthDay=fields.BYMONTHDAY.split(",").map(Number);
  if(fields.BYSETPOS)opts.bySetPos=Number(fields.BYSETPOS);
  if(fields.UNTIL) {
   const m=fields.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/);
   if(m)opts.until=new Date(m[1]+"-"+m[2]+"-"+m[3]+"T"+(m[4]||"23")+":"+(m[5]||"59")+":"+(m[6]||"59")+"Z");
  }
 } else if(["DAILY","WEEKLY","MONTHLY","YEARLY"].includes(pattern))opts={freq:pattern};
 if(opts)opts.exclude=(Array.isArray(e.exdates)?e.exdates:[]).map(asDate).filter((d:Date)=>!isNaN(d.getTime()));
 return opts;
}
function buildCalendar(name:string,items:Record<string,unknown>[],stamp:string,timezone:string) {
 const cal=ical({name,prodId:{company:"Daylight",product:"Calendar",language:"EN"},method:ICalCalendarMethod.PUBLISH,ttl:3600});
 for(const item of items) {
  const start=asDate(item.start??item.startMs),end=asDate(item.end??item.endMs);
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)continue;
  const allDay=!!item.allDay;
  const tz=String(item.timezone||timezone);
  const startValue=allDay?dayInZone(start,tz):start;
  // Daylight keeps inclusive end-of-day dates at 23:59. RFC 5545 requires an exclusive end.
  const endValue=allDay?dayInZone(new Date(end.getTime()+86400000),tz):end;
  const uid=String(item.uid||item.feed_uid||item.id);
  const event=cal.createEvent({
   uid:uid.includes("@")?uid:uid+"@daylight",
   summary:String(item.title||"Untitled"),start:startValue,end:endValue,allDay,
   stamp:item.dtstamp?asDate(item.dtstamp):asDate(stamp),lastModified:asDate(stamp),
   sequence:Number(item.sequence||0),description:String(item.desc||item.description||""),
   location:String(item.loc||item.location||""),
   recurrenceId:item.recurrenceId?asDate(item.recurrenceId):undefined,
  });
  // RFC 5545 GEO and LOCATION: preserve coordinates only for resolved places.
  const latitude=item.locationLat==null?NaN:Number(item.locationLat);
  const longitude=item.locationLng==null?NaN:Number(item.locationLng);
  if(Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180){
    const address=String(item.loc||item.location_text||item.location||"");
    event.location({title:address,address,geo:{lat:latitude,lon:longitude}});
  }
  const rule=repeat(item);
  if(rule&&!item.recurrenceId)event.repeating(rule as any);
 }
 return cal.toString();
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method==="GET"){
  const parsed=new URL(req.url),id=parsed.pathname.split("/").pop()||"",token=parsed.searchParams.get("token")||"";
  if(!/^[a-f0-9-]{36}$/i.test(id))return notFound();
  const publicRequest=parsed.searchParams.get("public")==="1";
  let cal:any=null,readError:any=null;
  if(publicRequest){
    const found=await admin.from("calendars").select("id,user_id,name,client_id,share_public_token")
      .eq("id",id).eq("share_public_enabled",true).maybeSingle();
    cal=found.data;readError=found.error;
    if(!cal||!token||cal.share_public_token!==token)return notFound();
  }else{
    if(!/^[A-Za-z0-9_-]{50,100}$/.test(token))return notFound();
    const tokenHash=await hash(token);
    const found=await admin.from("calendars").select("id,user_id,name,client_id,share_token_hash")
      .eq("id",id).eq("share_token_prefix",token.slice(0,8)).eq("share_feed_enabled",true).maybeSingle();
    cal=found.data;readError=found.error;
    if(!cal||cal.share_token_hash!==tokenHash)return notFound();
  }
  if(readError||!cal)return notFound();
  const {data:workspace,error:workspaceError}=await admin.from("workspace_snapshots").select("payload,revision,updated_at")
    .eq("user_id",cal.user_id).maybeSingle();
  if(workspaceError||!workspace)return notFound();
  const payload=workspace.payload||{};
  const owned=(payload.calendars||[]).some((c:Record<string,unknown>)=>String(c.id)===cal.client_id&&!c.subscribed&&!c.builtin);
  if(!owned)return notFound();
  const etag='"daylight-'+id+'-'+workspace.revision+'"',modified=new Date(workspace.updated_at).toUTCString();
  const headers={"ETag":etag,"Last-Modified":modified,"Cache-Control":publicRequest?"no-store":"private, max-age=300"};
  if(req.headers.get("if-none-match")===etag)return new Response(null,{status:304,headers});
  const events=(payload.events||[]).filter((e:Record<string,unknown>)=>String(e.cal)===cal.client_id);
  try {
   return new Response(buildCalendar(cal.name,events,workspace.updated_at,String(payload.settings?.tzLabel||"America/New_York")),{
    headers:{...headers,"Content-Type":"text/calendar; charset=utf-8"},
   });
  }catch(e){console.error("Feed formatting failed",e);return new Response("Unavailable",{status:503});}
 }
 if(req.method!=="POST")return send({error:"Method not allowed"},405);
 const bearer=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!bearer)return send({error:"Authentication required"},401);
 const {data:session,error:authError}=await admin.auth.getUser(bearer);
 if(authError||!session.user)return send({error:"Authentication required"},401);
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return send({error:"Invalid JSON"},400)}
 const clientId=String(body.calendar_id||""),action=String(body.action||"");
 if(!clientId||clientId.length>160)return send({error:"Choose a calendar"},400);
 const found=await admin.from("workspace_snapshots").select("payload").eq("user_id",session.user.id).maybeSingle();
 if(found.error)return send({error:"Unable to open calendar"},503);
 const cal=(found.data?.payload?.calendars||[]).find((c:Record<string,unknown>)=>c.id===clientId&&!c.subscribed&&!c.builtin&&clientId!=="holidays");
 if(!cal)return send({error:"Calendar not found or read-only"},404);
 if(action==="export"){
  const contents=found.data?.payload||{};
  const all=(contents.events||[]).filter((e:Record<string,unknown>)=>String(e.cal)===clientId);
  const wanted=body.event_id==null?all:all.filter((e:Record<string,unknown>)=>String(e.id)===String(body.event_id));
  if(body.event_id!=null&&!wanted.length)return send({error:"Event not found"},404);
  const source=buildCalendar(String(cal.name||"Calendar"),wanted,new Date().toISOString(),String(contents.settings?.tzLabel||"America/New_York"));
  const name=String(cal.name||"daylight").replace(/[^a-zA-Z0-9 _-]/g,"").slice(0,80)||"daylight";
  return new Response(source,{headers:{...cors,"Content-Type":"text/calendar; charset=utf-8",
   "Content-Disposition":'attachment; filename="'+name+'.ics"',"Cache-Control":"no-store"}});
 }
 let row=await admin.from("calendars").select("id,share_feed_enabled,share_token_prefix,share_public_enabled,share_public_token").eq("user_id",session.user.id).eq("client_id",clientId).maybeSingle();
 if(row.error)return send({error:"Unable to load share settings"},503);
 if(!row.data){
  const created=await admin.from("calendars").insert({user_id:session.user.id,client_id:clientId,
   name:String(cal.name||"Calendar"),color:"#5b8def",shade:"blue",source_type:"local"})
   .select("id,share_feed_enabled,share_token_prefix,share_public_enabled,share_public_token").single();
  if(created.error)return send({error:"Could not create share settings"},503);
  row=created;
 }
 const id=row.data!.id;
 if(action==="status")return send({calendar_id:id,enabled:row.data!.share_feed_enabled,public_enabled:row.data!.share_public_enabled,public_url:row.data!.share_public_enabled&&row.data!.share_public_token?feedBase+encodeURIComponent(id)+"?public=1&token="+encodeURIComponent(row.data!.share_public_token):null,prefix:row.data!.share_token_prefix});
 if(action==="set-public"){
  if(typeof body.public!=="boolean")return send({error:"Choose Public or Private"},400);
  const publicToken=body.public?generate():null;
  const update=await admin.from("calendars").update({share_public_enabled:body.public,share_public_token:publicToken}).eq("id",id).eq("user_id",session.user.id);
  return update.error?send({error:"Unable to update calendar privacy"},503):send({public_enabled:body.public,public_url:publicToken?feedBase+encodeURIComponent(id)+"?public=1&token="+encodeURIComponent(publicToken):null});
 }
 if(action==="disable"){
  const update=await admin.from("calendars").update({share_feed_enabled:false,share_public_enabled:false,share_token_hash:null,share_token_prefix:null,share_public_token:null})
   .eq("id",id).eq("user_id",session.user.id);
  return update.error?send({error:"Unable to disable feed"},503):send({enabled:false,public_enabled:false,public_url:null});
 }
 if(action==="reset-public"){
  if(!row.data!.share_public_enabled)return send({error:"Turn on Public link first"},409);
  const publicToken=generate();
  const update=await admin.from("calendars").update({share_public_token:publicToken}).eq("id",id).eq("user_id",session.user.id);
  if(update.error)return send({error:"Unable to reset public link"},503);
  return send({public_enabled:true,public_url:feedBase+encodeURIComponent(id)+"?public=1&token="+encodeURIComponent(publicToken)});
 }
 if(!["enable","reset"].includes(action))return send({error:"Unknown action"},400);
 if(action==="enable"&&row.data!.share_feed_enabled)return send({error:"Already enabled; use Reset link"},409);
 const token=generate(),h=await hash(token);
 const publicToken=row.data!.share_public_enabled?generate():row.data!.share_public_token;
 const update=await admin.from("calendars").update({share_feed_enabled:true,share_token_hash:h,share_token_prefix:token.slice(0,8),share_public_token:publicToken})
  .eq("id",id).eq("user_id",session.user.id);
 if(update.error)return send({error:"Could not save feed token"},503);
 return send({enabled:true,calendar_id:id,prefix:token.slice(0,8),urls:tokenLinks(id,token),public_url:row.data!.share_public_enabled&&publicToken?feedBase+encodeURIComponent(id)+"?public=1&token="+encodeURIComponent(publicToken):null});
});
