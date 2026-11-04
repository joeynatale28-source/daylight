import ICAL from 'npm:ical.js@2.2.1';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const cors={
 'Access-Control-Allow-Origin':'https://joeynatale28-source.github.io',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info'
};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}
});
function convert(time:any){
 if(time.isDate)return new Date(Date.UTC(time.year,time.month-1,time.day));
 // If VTIMEZONE is bundled, ical.js honors it. Missing TZID is not assumed UTC.
 if(time.zone?.tzid==='floating'||time.zone?.tzid==='local')
   throw Error('Floating timestamps without a calendar zone cannot be imported safely');
 const d=time.toJSDate();
 if(!Number.isFinite(+d))throw Error('Invalid event date');
 return d;
}
function localDay(d:Date,timezone:string){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const x=Object.fromEntries(p.map(v=>[v.type,v.value]));
 return x.year+'-'+x.month+'-'+x.day;
}
function parse(text:string,calendarId:string) {
 let root:any;
 try{root=new ICAL.Component(ICAL.parse(text))}catch{throw Error('Invalid iCalendar file')}
 if(root.name!=='vcalendar')throw Error('Expected VCALENDAR');
 for(const part of root.getAllSubcomponents('vtimezone')){
   try{const t=new ICAL.Timezone(part);ICAL.TimezoneService.register(t.tzid,t)}catch{}
 }
 const fallback=String(root.getFirstPropertyValue('x-wr-timezone')||'UTC');
 const parts=root.getAllSubcomponents('vevent');
 if(parts.length>5000)throw Error('iCalendar file contains too many events');
 const parsed:any[]=[];
 let skipped=0;
 for(const part of parts){
   try{
     const e=new ICAL.Event(part);
     if(!e.uid||!e.startDate||!e.endDate)throw Error('Incomplete event');
     const allDay=!!e.startDate.isDate;
     let start=convert(e.startDate),end=convert(e.endDate);
     if(!(end>start))throw Error('Invalid event interval');
     // Daylight workspace has an inclusive end (23:59) for all-day events.
     if(allDay)end=new Date(+end-60000);
     const sourceTz=String(e.startDate.zone?.tzid||fallback);
     const recurrence=e.component.getFirstPropertyValue('rrule');
     const repeat=recurrence?.freq ? String(recurrence.freq).toLowerCase():null;
     let rrule=recurrence ? String(recurrence.toString()).replace(/^RRULE:/i,'') : null;
     const recurrenceId=part.getFirstProperty('recurrence-id');
     // RFC 5545 GEO is independent of vendor-specific OSM references.
     const geoRaw=part.getFirstProperty('geo')?.getFirstValue();
     const geoMatch=String(geoRaw||'').match(/^(-?\\d+(?:\\.\\d+)?)\\s*;\\s*(-?\\d+(?:\\.\\d+)?)$/);
     const geoLat=geoMatch?Number(geoMatch[1]):null;
     const geoLng=geoMatch?Number(geoMatch[2]):null;
     const validGeo=geoLat!==null&&geoLng!==null&&Math.abs(geoLat)<=90&&Math.abs(geoLng)<=180;
     parsed.push({
       cal:calendarId,uid:String(e.uid),rrule,repeat,
       recurrenceId:recurrenceId?String(recurrenceId.getFirstValue()):null,
       title:String(e.summary||'Untitled').slice(0,300),start:start.toISOString(),end:end.toISOString(),
       allDay,loc:String(e.location||'').slice(0,1500),desc:String(e.description||'').slice(0,10000),
       placeId:null,locationLat:validGeo?geoLat:null,locationLng:validGeo?geoLng:null,
       timezone:sourceTz,sequence:Number(part.getFirstPropertyValue('sequence')||0),
       dtstamp:(part.getFirstPropertyValue('dtstamp')?.toJSDate?.()||new Date()).toISOString(),
       status:String(part.getFirstPropertyValue('status')||'CONFIRMED').toUpperCase(),
       exdates:part.getAllProperties('exdate').flatMap((x:any)=>{
         const v=x.getValues();return v.map((d:any)=>convert(d).toISOString());
       }),
       declined:false
     });
   }catch(err){
     skipped++;console.warn('Skipping unrepresentable VEVENT:',err);
   }
 }
 return {parsed,skipped};
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return respond({error:'POST required'},405);
 const token=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return respond({error:'Sign-in required'},401);
 const {data:{user},error:authError}=await admin.auth.getUser(token);
 if(authError||!user)return respond({error:'Sign-in required'},401);
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return respond({error:'Invalid JSON'},400)}
 const calendarId=String(body.calendar_id||'');
 const raw=String(body.ics||'');
 if(!calendarId||raw.length>2500000||!raw.includes('BEGIN:VCALENDAR'))
   return respond({error:'Choose a writable calendar and a valid .ics file smaller than 2.5 MB'},400);
 const {data:row,error:readError}=await admin.from('workspace_snapshots')
   .select('payload,revision').eq('user_id',user.id).maybeSingle();
 if(readError||!row)return respond({error:'Workspace not available'},404);
 const doc=row.payload||{};
 const target=(doc.calendars||[]).find((c:any)=>c.id===calendarId&&!c.subscribed&&!c.builtin);
 if(!target)return respond({error:'Target calendar not found or read-only'},404);
 let imported;
 try{imported=parse(raw,calendarId)}catch(err){
   return respond({error:err instanceof Error?err.message:'Unable to parse calendar'},400);
 }
 const events=Array.isArray(doc.events)?doc.events:[];
 let added=0,updated=0;
 let nextId=Math.max(100,...events.map((e:any)=>Number(e.id)).filter(Number.isFinite));
 for(const event of imported.parsed){
   const existing=events.find((e:any)=>e.cal===calendarId&&
     e.uid===event.uid&&(e.recurrenceId||null)===(event.recurrenceId||null));
   if(existing){Object.assign(existing,event);updated++;}
   else{events.push({...event,id:++nextId});added++;}
 }
 const result=await admin.from('workspace_snapshots')
   .update({payload:{...doc,events},revision:row.revision+1,updated_at:new Date().toISOString()})
   .eq('user_id',user.id).eq('revision',row.revision).select('revision').maybeSingle();
 if(result.error||!result.data)return respond({error:'Workspace changed while importing; reload and retry'},409);
 return respond({added,updated,skipped:imported.skipped,revision:result.data.revision});
});
