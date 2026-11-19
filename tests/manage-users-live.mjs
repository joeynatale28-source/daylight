/** Manage users, live: the owner-only RPCs (summary, search, paginated list, detail with calendar NAMES only) and the by-user admin actions
 *  (warn, suspend, ban, lift) through the real support-admin function, on throwaway accounts. Needs .env. Never touches real accounts. */
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
 const tgt=await mk(`qa.daylight.mu${stamp}@mailinator.com`,{full_name:'Zed Quillfeather',username:'zedq'+stamp});
 const other=await mk(`qa.daylight.mu2${stamp}@mailinator.com`,{full_name:'Other Person'});
 await mgmt(`insert into public.workspace_snapshots(user_id,payload,revision) values ('${tgt}','{"calendars":[{"id":"personal","name":"Garden club"},{"id":"c2","name":"Night shifts"}],"events":[{"id":1,"title":"SECRET dentist appointment","desc":"private notes","cal":"personal"}],"tasks":[{"id":2,"title":"SECRET task title"}],"settings":{}}',1)`);
 await mgmt(`insert into public.support_tickets(user_id,user_email,user_name,title,kind,category) values ('${tgt}','x','Zed','Calendar will not sync','ticket','bug')`);
 const asOwner=q=>mgmt(`begin; select set_config('request.jwt.claims','${JSON.stringify({sub:owner,role:'authenticated'})}',true); set local role authenticated; ${q}; commit;`);
 const asUser=(uid,q)=>mgmt(`begin; select set_config('request.jwt.claims','${JSON.stringify({sub:uid,role:'authenticated'})}',true); set local role authenticated; ${q}; commit;`);
 const one=async q=>{const r=await asOwner(`select ${q} r`);return r[0]?.r??r.at(-1)?.r};
 // owner-only, server side
 let denied=false;try{await asUser(tgt,`select public.support_users_list('',25,0)`)}catch(e){denied=/Only the owner/.test(e.message)}
 check(denied,'a regular account is refused by the list function (admin check is server-side)');
 denied=false;try{await asUser(tgt,`select public.support_user_detail('${tgt}')`)}catch(e){denied=/Only the owner/.test(e.message)}
 check(denied,'and by the detail function');
 denied=false;try{await asUser(tgt,`select public.support_users_summary()`)}catch(e){denied=/Only the owner/.test(e.message)}
 check(denied,'and by the summary');
 // summary
 const sum=await one(`public.support_users_summary()`);
 check(sum&&sum.total>=3&&sum.total===sum.active+sum.suspended+sum.banned,'the summary counts total / active / suspended / banned',sum);
 // search by name, e-mail, username
 const byName=await one(`public.support_users_list('quillfeather',25,0)`),byMail=await one(`public.support_users_list('mu${stamp}@mailinator',25,0)`),byUser=await one(`public.support_users_list('zedq${stamp}',25,0)`),none=await one(`public.support_users_list('zzzz-nobody-${stamp}',25,0)`);
 check(byName.rows.length===1&&byName.rows[0].id===tgt&&byMail.rows.some(r=>r.id===tgt)&&byUser.rows.length===1&&byUser.rows[0].id===tgt,'search finds a person by name, e-mail and username',{n:byName.rows.length,m:byMail.rows.length,u:byUser.rows.length});
 check(none.total===0&&none.rows.length===0,'no match returns an empty list');
 const page1=await one(`public.support_users_list('',2,0)`),page2=await one(`public.support_users_list('',2,2)`);
 check(page1.rows.length===2&&page2.rows.length>=1&&page1.rows[0].created_at>=page1.rows[1].created_at&&page1.rows[0].id!==page2.rows[0].id&&page1.total===sum.total,'the list is newest first and paginated',{p1:page1.rows.length,p2:page2.rows.length});
 check(page1.rows.every(r=>'email' in r&&r.email.includes('@')&&'status' in r&&'created_at' in r&&'last_sign_in_at' in r),'each row has the full e-mail, status, created and last active');
 // detail: names only
 const d=await one(`public.support_user_detail('${tgt}')`);
 check(d.user.email.includes('@mailinator.com')&&d.user.name==='Zed Quillfeather'&&d.sign_in.includes('Email'),'detail: name, full e-mail and sign-in types',{u:d.user.email,s:d.sign_in});
 check(JSON.stringify(d.calendars)==='["Garden club","Night shifts"]','detail: calendar NAMES',d.calendars);
 const raw=JSON.stringify(d);
 check(!/SECRET|dentist|private notes|"events"|"tasks"/i.test(raw),'detail: no event or task content anywhere in the response');
 check(!/password|passkey_|credential/i.test(raw.replace(/"Passkey"/g,'')),'detail: no password or passkey details');
 check(d.tickets.length===1&&d.tickets[0].title==='Calendar will not sync'&&/^[0-9A-F]{8}$/.test(d.tickets[0].ref),'detail: their tickets, with a reference',d.tickets);
 // actions by user id
 let r=await act({action:'warn',user_id:tgt,reason:'Spam in shared calendars',message:'Please stop.'});
 check(r.s===200&&r.j.ok,'Warn works',r);
 const note=await mgmt(`select b.title,b.body from public.daylight_broadcasts b join public.daylight_broadcast_recipients p on p.broadcast_id=b.id where p.user_id='${tgt}' order by b.created_at desc limit 1`);
 check(note[0]&&/warning/i.test(note[0].title)&&/Spam in shared calendars/.test(note[0].body)&&/appeal/i.test(note[0].body),'the warned person gets an in-app notification with the reason and how to appeal',note);
 check((await act({action:'warn',user_id:tgt,reason:'x'})).s===400,'Warn needs a reason');
 r=await act({action:'suspend',user_id:tgt,duration:'7d',reason:'Repeated spam'});check(r.s===200&&r.j.kind==='suspended','Suspend works',r);
 let d2=await one(`public.support_user_detail('${tgt}')`);check(d2.user.status==='suspended'&&d2.user.restriction.reason==='Repeated spam','the detail shows Suspended with the reason',d2.user);
 check((await one(`public.support_users_summary()`)).suspended>=1,'the summary counts the suspension');
 r=await act({action:'lift',user_id:tgt,reason:'Resolved'});check(r.s===200,'Lift works');
 r=await act({action:'ban',user_id:tgt,reason:'Abuse'});check(r.s===200&&r.j.kind==='banned','Ban works',r);
 d2=await one(`public.support_user_detail('${tgt}')`);check(d2.user.status==='banned','the detail shows Banned');
 await act({action:'lift',user_id:tgt,reason:'Appeal accepted'});
 d2=await one(`public.support_user_detail('${tgt}')`);
 check(d2.user.status==='active'&&['warn','suspend','lift','ban'].every(a=>d2.history.some(h=>h.action===a)),'everything is logged in the history and the account is Active again',d2.history.map(h=>h.action));
 // owners are protected; unknown users refused
 r=await act({action:'ban',user_id:owner,reason:'test'});check(r.s===403,'an owner account cannot be banned from here',r);
 r=await act({action:'warn',user_id:'00000000-0000-4000-8000-000000000000',reason:'test'});check(r.s===404,'an unknown account is refused',r);
 const anon=await fetch(BASE+'/functions/v1/support-admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'warn',user_id:tgt,reason:'abc'})});
 check(anon.status===403,'the function refuses a caller who is not the owner');
}finally{
 for(const id of ids)await fetch(`${BASE}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:SH});
 console.log('left:',JSON.stringify(await mgmt(`select count(*)::int c from auth.users where email like 'qa.daylight.mu%${stamp}%'`)));
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
