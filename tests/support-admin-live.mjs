/** Admin sidebar actions against the REAL project, using throwaway accounts this script creates and deletes (never a real account). Needs .env.
 *  Set SKIP_MAIL=1 to skip the two actions that send e-mail (reset password, change e-mail): the built-in mailer allows only 2 e-mails an hour. */
import fs from 'node:fs';
const R=new URL('../',import.meta.url);
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`,ANON=env.NEW_SUPABASE_ANON_KEY;
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,400)))};
const mgmt=async q=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:q})});return r.json()};
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
const SVC=keys.find(k=>k.name==='service_role').api_key,SH={apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'};
const stamp=Date.now(),made=[];
const mk=async(tag,name)=>{const email=`qa.daylight.${tag}${stamp}@mailinator.com`.toLowerCase(),password='Qa-'+Math.random().toString(36).slice(2)+'Zz9!';
 const u=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:SH,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:name}})})).json();made.push(u.id);
 const login=async()=>{const r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify({email,password})});return {status:r.status,body:await r.json().catch(()=>({}))}};
 const t=await login();return {id:u.id,email,password,jwt:t.body.access_token,login}};
const rpc=async(u,name,args)=>{const r=await fetch(`${BASE}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+u.jwt,'content-type':'application/json'},body:JSON.stringify(args||{})});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}return {ok:r.ok,data:j}};
const fn=async(u,name,b)=>{const r=await fetch(`${BASE}/functions/v1/${name}`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+(u?u.jwt:ANON),'content-type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json().catch(()=>({}))}};
const SKIP=!!process.env.SKIP_MAIL;
try{
 const A=await mk('adA','Casey Test'),B=await mk('adB','Support Admin');
 await mgmt(`insert into public.daylight_owners(user_id) values ('${B.id}');
   insert into public.workspace_snapshots(user_id,payload,revision) values ('${A.id}','{"calendars":[{"id":"c1","name":"Secret Calendar Name"}],"events":[{"id":1,"cal":"c1","title":"Secret dentist appointment","start":"2026-12-20T10:00:00Z","end":"2026-12-20T11:00:00Z"}],"tasks":[{"id":1,"title":"Secret task"}],"settings":{}}',1)`);
 const tid=crypto.randomUUID();
 await rpc(A,'support_ticket_create',{p_id:tid,p_title:'Cannot sign in',p_body:'Help',p_kind:'ticket',p_category:'account',p_atts:[]});
 const t2=crypto.randomUUID();await rpc(A,'support_ticket_create',{p_id:t2,p_title:'Old question',p_body:'Hi',p_kind:'ticket',p_category:'other',p_atts:[]});await rpc(A,'support_close',{p_id:t2});
 // ---- the sidebar context
 check((await rpc(A,'support_admin_context',{p_ticket_id:tid})).ok===false,'a customer cannot read the sidebar context');
 const c=await rpc(B,'support_admin_context',{p_ticket_id:tid});const cx=c.data;
 check(c.ok&&cx.ticket.ref&&cx.ticket.category==='account'&&cx.ticket.status==='open'&&cx.ticket.last_sender==='user','ticket details: reference, category, status, who replied last',cx&&cx.ticket);
 check(cx.user.email===A.email&&cx.user.name==='Casey Test'&&cx.user.status==='active'&&cx.user.created_at&&'last_sign_in_at' in cx.user,'user: name, e-mail, status Active, created, last active',cx.user);
 check(cx.history.tickets.length===1&&cx.history.tickets[0].title==='Old question'&&cx.history.tickets[0].status==='closed','history lists the person\'s other tickets (open and closed)',cx.history.tickets);
 check(cx.data.requests===0&&cx.data.exports_given===0,'data section reports past data requests',cx.data);
 check(!/Secret/i.test(JSON.stringify(cx)),'the sidebar context contains no calendar, event or task content');
 check(Object.keys(cx.user).sort().join()==='created_at,email,last_sign_in_at,name,restriction,status','the user block holds only the allowed account fields',Object.keys(cx.user));
 // ---- typing indicator, two accounts in one ticket
 check((await rpc(B,'support_ticket_get',{p_id:tid,p_viewing:true})).data.ticket.other_typing===false,'nobody typing: no indicator');
 await rpc(A,'support_typing',{p_id:tid});
 check((await rpc(B,'support_ticket_get',{p_id:tid,p_viewing:true})).data.ticket.other_typing===true&&(await rpc(A,'support_ticket_get',{p_id:tid,p_viewing:true})).data.ticket.other_typing===false,'customer types: the admin sees the indicator, the customer does not');
 await rpc(B,'support_typing',{p_id:tid});
 check((await rpc(A,'support_ticket_get',{p_id:tid,p_viewing:true})).data.ticket.other_typing===true,'admin types: the customer sees the indicator');
 await new Promise(r=>setTimeout(r,6500));
 check((await rpc(B,'support_ticket_get',{p_id:tid,p_viewing:true})).data.ticket.other_typing===false,'the indicator goes away when they stop');
 // ---- who may act
 check((await fn(A,'support-admin',{action:'suspend',ticket_id:tid,duration:'1d',reason:'x y z'})).status===403,'a customer cannot call the admin actions');
 check((await fn(null,'support-admin',{action:'suspend',ticket_id:tid,duration:'1d',reason:'x y z'})).status===403,'nor can anyone without a sign-in');
 // ---- private message
 const pm=await fn(B,'support-admin',{action:'private_message',ticket_id:tid,text:'Hello from support (private)'});
 check(pm.status===200,'private message sent',pm);
 const nl=await rpc(A,'daylight_list_broadcasts');check((nl.data||[]).some(n=>n.sender==='support'&&n.body==='Hello from support (private)'),'it arrives in the customer\'s notifications from Daylight Support',nl.data);
 const th=await rpc(A,'support_ticket_get',{p_id:tid,p_viewing:false});check(!(th.data.messages||[]).some(m=>/private/.test(m.body)),'and it is separate from the ticket thread');
 // ---- suspend
 check((await fn(B,'support-admin',{action:'suspend',ticket_id:tid,duration:'1d',reason:'ab'})).status===400,'a suspension needs a real reason');
 check((await rpc(A,'support_ticket_create',{p_id:crypto.randomUUID(),p_title:'Appeal',p_body:'x',p_kind:'ticket',p_category:'appeal',p_atts:[]})).ok===false,'an appeal ticket needs an active restriction');
 check((await rpc(A,'my_account_status')).data.status==='active','before: the account is active');
 const sp=await fn(B,'support-admin',{action:'suspend',ticket_id:tid,duration:'1d',reason:'Repeated abuse of the sharing feature'});
 check(sp.status===200&&sp.body.ends_at,'suspend for 1 day',sp);
 const lg=await A.login();check(lg.status===200,'a suspended user CAN still sign in (restricted)',lg.status);
 const ms=(await rpc(A,'my_account_status')).data;
 check(ms.status==='suspended'&&/Repeated abuse/.test(ms.reason)&&ms.ends_at&&ms.appeal==='privacy@daylightcal.com','their account status gives the reason, the end date and the appeal address',ms);
 const ap=crypto.randomUUID();const apr=await rpc(A,'support_ticket_create',{p_id:ap,p_title:'Appeal: my suspension',p_body:'Please review.',p_kind:'ticket',p_category:'appeal',p_atts:[]});
 check(apr.ok,'a suspended user can open an appeal ticket',apr.data);
 const ctxA=(await rpc(B,'support_admin_list',{p_status:'open'})).data.find(t=>t.id===ap);check(ctxA&&ctxA.category==='appeal','the admin sees the appeal as a ticket in the Appeal category',ctxA);
 const cs=(await rpc(B,'support_admin_context',{p_ticket_id:tid})).data;check(cs.user.status==='suspended'&&cs.user.restriction.reason,'the sidebar shows Suspended with the reason',cs.user);
 const lf=await fn(B,'support-admin',{action:'lift',ticket_id:tid,reason:'Resolved'});check(lf.status===200&&(await rpc(A,'my_account_status')).data.status==='active','lift the suspension early: the account is active again');
 await fn(B,'support-admin',{action:'suspend',ticket_id:tid,duration:'1d',reason:'Short test window'});
 await mgmt(`update public.account_restrictions set ends_at = now() - interval '1 minute' where user_id='${A.id}' and lifted_at is null`);
 check((await rpc(A,'my_account_status')).data.status==='active','a suspension lifts by itself when its time is up');
 // ---- ban
 check((await fn(B,'support-admin',{action:'ban',ticket_id:tid,reason:''})).status===400,'a ban needs a reason');
 const bn=await fn(B,'support-admin',{action:'ban',ticket_id:tid,reason:'Posting harmful content'});check(bn.status===200,'ban',bn);
 check((await A.login()).status===200,'a banned user CAN still sign in (restricted)');
 const mb=(await rpc(A,'my_account_status')).data;check(mb.status==='banned'&&/harmful/.test(mb.reason)&&mb.ends_at===null&&mb.appeal==='privacy@daylightcal.com','the ban status gives the reason and the appeal address',mb);
 check((await rpc(A,'support_ticket_create',{p_id:crypto.randomUUID(),p_title:'Appeal: my ban',p_body:'Please review.',p_kind:'ticket',p_category:'appeal',p_atts:[]})).ok,'a banned user can open an appeal ticket');
 check((await fn(B,'support-admin',{action:'lift',ticket_id:tid,reason:'Appeal accepted'})).status===200&&(await rpc(A,'my_account_status')).data.status==='active','an admin lifts the ban');
 // an owner cannot be banned from here
 const t3=crypto.randomUUID();await rpc(B,'support_ticket_create',{p_id:t3,p_title:'Owner ticket',p_body:'x',p_kind:'ticket',p_category:'other',p_atts:[]});
 check((await fn(B,'support-admin',{action:'ban',ticket_id:t3,reason:'test only'})).status===403,'an owner account cannot be suspended or banned');
 // ---- e-mail actions
 if(!SKIP){
  const rp=await fn(B,'support-admin',{action:'reset_password',ticket_id:tid,redirect_to:'https://joeynatale28-source.github.io/daylight/'});
  check(rp.status===200||/rate limit/i.test(JSON.stringify(rp.body)),'reset password sends the existing reset e-mail (or is held back by the mailer limit)',rp);
  const ce=await fn(B,'support-admin',{action:'change_email',ticket_id:tid,new_email:`qa.daylight.new${stamp}@mailinator.com`});
  const row=(await mgmt(`select email, email_change as new_email, email_change_sent_at from auth.users where id='${A.id}'`))[0];
  check((ce.status===200&&row.new_email&&row.email===A.email)||/rate limit/i.test(JSON.stringify(ce.body)),'change e-mail: verification goes to the NEW address; the account e-mail stays until they confirm',{ce,row});
 }
 // ---- history log
 const h=(await rpc(B,'support_admin_context',{p_ticket_id:tid})).data.history.actions.map(a=>a.action);
 check(['private_message','suspend','lift','ban'].every(a=>h.includes(a)),'every action is in the History log (who, what, when, reason)',h);
 const first=(await rpc(B,'support_admin_context',{p_ticket_id:tid})).data.history.actions.find(a=>a.action==='ban');
 check(first&&first.reason==='Posting harmful content'&&first.admin_email===B.email&&first.created_at,'log entries carry the reason, the admin and the date',first);
 // ---- give data still works from this ticket
 const gd=await fn(B,'support',{action:'give_data',ticket_id:tid});check(gd.status===200&&gd.body.ok,'Give data posts the ZIP in this ticket',gd);
 const full=await rpc(A,'support_ticket_get',{p_id:tid,p_viewing:false});check((full.data.messages||[]).some(m=>m.kind==='export'),'the customer sees the export in their ticket');
 const t4=crypto.randomUUID();await rpc(A,'support_ticket_create',{p_id:t4,p_title:'Data request',p_body:'',p_kind:'data',p_category:'data',p_atts:[]});await rpc(A,'support_close',{p_id:t4});
 check((await fn(B,'support',{action:'give_data',ticket_id:t4})).status===200,'Give data still works on a CLOSED data-request ticket');
 check((await fn(B,'support',{action:'give_data',ticket_id:t2})).status===409,'but not on a closed ordinary ticket');
 const cx2=(await rpc(B,'support_admin_context',{p_ticket_id:tid})).data;check(cx2.data.exports_given>=1&&cx2.data.requests>=0,'the data section now shows the export',cx2.data);
}finally{
 await mgmt(`delete from public.daylight_owners where user_id = any (array[${made.filter(Boolean).map(i=>`'${i}'`).join(',')||"'00000000-0000-0000-0000-000000000000'"}]::uuid[])`);
 for(const u of made.filter(Boolean)){
  try{const l=await (await fetch(`${BASE}/storage/v1/object/list/support-files`,{method:'POST',headers:SH,body:JSON.stringify({prefix:u+'/',limit:100})})).json();for(const f of (Array.isArray(l)?l:[])){const l2=await (await fetch(`${BASE}/storage/v1/object/list/support-files`,{method:'POST',headers:SH,body:JSON.stringify({prefix:u+'/'+f.name+'/',limit:100})})).json();const ps=(Array.isArray(l2)?l2:[]).map(x=>`${u}/${f.name}/${x.name}`);if(ps.length)await fetch(`${BASE}/storage/v1/object/support-files`,{method:'DELETE',headers:SH,body:JSON.stringify({prefixes:ps})})}}catch(e){}
  await fetch(`${BASE}/auth/v1/admin/users/${u}`,{method:'DELETE',headers:SH});
 }
 await mgmt(`delete from public.daylight_broadcasts where body='Hello from support (private)'`);
 console.log('left:',JSON.stringify(await mgmt(`select (select count(*) from auth.users where email like 'qa.daylight.ad%${stamp}@mailinator.com')::int users, (select count(*) from public.support_admin_actions where admin_email like 'qa.daylight.ad%${stamp}%')::int actions`)));
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
