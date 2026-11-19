/** Notifications arrive, live: an admin notification, a warning and a share invite each show up in the recipient's notifications. Throwaway accounts only. */
import fs from 'node:fs';
const R=new URL('../',import.meta.url);
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`;
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const mgmt=async q=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:q})});const j=await r.json();if(!r.ok)throw new Error(j.message||JSON.stringify(j));return j};
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
const SVC=keys.find(k=>k.name==='service_role').api_key,SH={apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'};
const stamp=Date.now(),ids=[];
const mk=async(email,meta)=>{const u=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:SH,body:JSON.stringify({email,password:'Qa-'+stamp+'Zz9!',email_confirm:true,user_metadata:meta})})).json();ids.push(u.id);return u.id};
const act=async body=>{const r=await fetch(BASE+'/functions/v1/support-admin',{method:'POST',headers:SH,body:JSON.stringify(body)});return {s:r.status,j:await r.json().catch(()=>({}))}};
try{
 const owner=(await mgmt(`select user_id from public.daylight_owners limit 1`))[0].user_id;
 const A=await mk(`qa.daylight.na${stamp}@mailinator.com`,{full_name:'Sender Person'});
 const B=await mk(`qa.daylight.nb${stamp}@mailinator.com`,{full_name:'Receiver Person'});
 await mgmt(`insert into public.workspace_snapshots(user_id,payload,revision) values ('${A}','{"calendars":[{"id":"personal","name":"Garden club"}],"events":[{"id":101,"uid":"x@daylight","cal":"personal","title":"Seed party","start":"2026-12-01T10:00:00Z","end":"2026-12-01T11:00:00Z"}],"tasks":[],"settings":{}}',1)`);
 const as=(uid,q)=>mgmt(`begin; select set_config('request.jwt.claims','${JSON.stringify({sub:uid,role:'authenticated'})}',true); set local role authenticated; ${q}; commit;`);
 const rows=async(uid,q)=>{const r=await as(uid,`select * from ${q}`);return Array.isArray(r)?r:[]};
 const one=async(uid,q)=>{const r=await as(uid,`select ${q} r`);return r[0]?.r??r.at(-1)?.r};
 // 1. admin notification
 await one(owner,`public.daylight_send_notification('QA admin notice','Hello from the admin test',array['qa.daylight.nb${stamp}@mailinator.com'])`);
 let list=await rows(B,`public.daylight_list_broadcasts()`);
 check(Array.isArray(list)&&list.some(n=>n.title==='QA admin notice'),'an admin notification arrives in the recipient notifications',list);
 const other=await rows(A,`public.daylight_list_broadcasts()`);
 check(!(other||[]).some(n=>n.title==='QA admin notice'),'and only for the person it was sent to');
 // 2. warning
 const w=await fetch(BASE+'/functions/v1/support-admin',{method:'POST',headers:SH,body:JSON.stringify({action:'warn',user_id:B,reason:'Test warning',message:'Please be kind.'})});
 check(w.status===200,'a warning is sent',await w.text());
 list=await rows(B,`public.daylight_list_broadcasts()`);
 if(!Array.isArray(list))console.log('DEBUG',JSON.stringify(list).slice(0,300));
 check(Array.isArray(list)&&list.some(n=>/warning/i.test(n.title)&&/Test warning/.test(n.body)),'the warning arrives in the notifications with its reason',list.map(n=>n.title));
 // 3. share invite: calendar and event
 const rcp=(await as(A,`select (public.daylight_search_people('qa.daylight.nb${stamp}')) r`))[0]?.r||(await as(A,`select (public.daylight_search_people('qa.daylight.nb${stamp}')) r`)).at(-1).r;
 const bid=(Array.isArray(rcp)?rcp[0]:rcp)?.user_id||B;
 await one(A,`public.daylight_send_calendar_share('personal','${bid}','view')`);
 await one(A,`public.daylight_send_event_share(101,'${bid}','view')`);
 const ci=await rows(B,`public.daylight_list_my_invites()`),ei=await rows(B,`public.daylight_list_my_event_invites()`);
 check(Array.isArray(ci)&&ci.length===1&&/Garden club/.test(JSON.stringify(ci)),'a calendar share invite arrives',ci);
 check(Array.isArray(ei)&&ei.length===1&&/Seed party/.test(JSON.stringify(ei)),'an event share invite arrives',ei);
const ce=await rows(B,`public.daylight_list_my_event_invites()`);
 await as(B,`select public.daylight_respond_event_share('${ce[0].id}',true)`);
 await as(B,`select public.daylight_respond_calendar_share('${ci[0].id}',true)`);
 const sc=await rows(B,`public.daylight_list_my_shared_calendars()`),se=await rows(B,`public.daylight_list_my_shared_events()`);
 check(sc.length===1&&se.length===1,'accepting both invites gives the recipient the shared calendar and event',{sc:sc.length,se:se.length});
}finally{
 for(const id of ids)await fetch(`${BASE}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:SH});
 console.log('left:',JSON.stringify(await mgmt(`select count(*)::int c from auth.users where email like 'qa.daylight.n_%${stamp}%'`)));
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
