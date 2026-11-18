/** Delete account against the REAL project with throwaway accounts this script creates (never a real account). Needs .env. */
import fs from 'node:fs';
const R=new URL('../',import.meta.url);
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`,ANON=env.NEW_SUPABASE_ANON_KEY;
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const mgmt=async q=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:q})});return r.json()};
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
const SVC=keys.find(k=>k.name==='service_role').api_key,SH={apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'};
const stamp=Date.now(),made=[];
const mk=async tag=>{const email=`qa.daylight.${tag}${stamp}@mailinator.com`,password='Qa-'+Math.random().toString(36).slice(2)+'Zz9!';
 const u=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:SH,body:JSON.stringify({email,password,email_confirm:true})})).json();made.push(u.id);
 const t=await (await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify({email,password})})).json();return {id:u.id,email,jwt:t.access_token}};
const del=(u,confirm)=>fetch(`${BASE}/functions/v1/delete-account`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+u.jwt,'content-type':'application/json'},body:JSON.stringify({confirm})}).then(async r=>({status:r.status,body:await r.json().catch(()=>({}))}));
const count=async(sql)=>Number((await mgmt(sql))[0].c);
try{
 const A=await mk('delA'),O=await mk('delO');
 await mgmt(`insert into public.workspace_snapshots(user_id,payload,revision) values ('${A.id}','{"calendars":[{"id":"c1","name":"T"}],"events":[],"tasks":[],"settings":{}}',1);
   insert into public.mcp_grants(user_id,client_id,client_name,can_read,can_write,can_delete) values ('${A.id}','qa','QA',true,true,false);
   insert into public.daylight_owners(user_id) values ('${O.id}')`);
 const tid=crypto.randomUUID();
 await fetch(`${BASE}/rest/v1/rpc/support_ticket_create`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+A.jwt,'content-type':'application/json'},body:JSON.stringify({p_id:tid,p_title:'t',p_body:'b',p_kind:'ticket',p_atts:[]})});
 await fetch(`${BASE}/storage/v1/object/support-files/${A.id}/${tid}/p.png`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+A.jwt,'content-type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==','base64')});
 check((await del(A,'someone@else.com')).status===400,'a wrong confirmation is refused');
 check((await del({jwt:ANON},'x')).status===401,'no signed-in user: refused');
 check(await count(`select count(*)::int c from auth.users where id='${A.id}'`)===1,'nothing was deleted by the refusals');
 const o=await del(O,O.email);check(o.status===403,'an owner account is refused',o);
 check(await count(`select count(*)::int c from auth.users where id='${O.id}'`)===1,'the owner account is untouched');
 const r=await del(A,A.email.toUpperCase());check(r.status===200&&r.body.ok,'the right confirmation deletes the account',r);
 check(await count(`select count(*)::int c from auth.users where id='${A.id}'`)===0,'the sign-in account is gone');
 check(await count(`select (select count(*) from public.workspace_snapshots where user_id='${A.id}')+(select count(*) from public.mcp_grants where user_id='${A.id}')+(select count(*) from public.support_tickets where user_id='${A.id}')::int c`)===0,'workspace, AI grants and support tickets are gone');
 const l=await (await fetch(`${BASE}/storage/v1/object/list/support-files`,{method:'POST',headers:SH,body:JSON.stringify({prefix:A.id+'/',limit:100})})).json();
 check(Array.isArray(l)&&l.length===0,'uploaded files are gone');
 const again=await fetch(`${BASE}/auth/v1/user`,{headers:{apikey:ANON,authorization:'Bearer '+A.jwt}});check(again.status>=400,'the old session no longer works',again.status);
}finally{
 await mgmt(`delete from public.daylight_owners where user_id = any (array[${made.filter(Boolean).map(i=>`'${i}'`).join(',')||"'00000000-0000-0000-0000-000000000000'"}]::uuid[])`);
 for(const id of made.filter(Boolean))await fetch(`${BASE}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:SH});
 console.log('left:',JSON.stringify(await mgmt(`select count(*)::int c from auth.users where email like 'qa.daylight.del%${stamp}@mailinator.com'`)));
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
