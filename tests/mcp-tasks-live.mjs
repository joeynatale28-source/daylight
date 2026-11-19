/** MCP task tools (list / create with description / complete / delete) through the real mcp_workspace_tool with OAuth-style claims, on a throwaway account. Needs .env. */
import fs from 'node:fs';
const R=new URL('../',import.meta.url);
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`;
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const mgmt=async q=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:q})});const j=await r.json();if(!r.ok)throw new Error(j.message||JSON.stringify(j));return j};
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
const SVC=keys.find(k=>k.name==='service_role').api_key,SH={apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'};
const stamp=Date.now();let uid=null;
try{
 const u=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:SH,body:JSON.stringify({email:`qa.daylight.mcptask${stamp}@mailinator.com`,password:'Qa-'+stamp+'Zz9!',email_confirm:true})})).json();uid=u.id;
 await mgmt(`insert into public.workspace_snapshots(user_id,payload,revision) values ('${uid}','{"calendars":[{"id":"personal","name":"Personal"}],"events":[],"tasks":[],"settings":{}}',1);
  insert into public.mcp_grants(user_id,client_id,client_name,can_read,can_write,can_delete) values ('${uid}','qa-w','QA write',true,true,false),('${uid}','qa-d','QA delete',true,true,true),('${uid}','qa-r','QA read',true,false,false)`);
 const call=async(client,tool,args)=>{try{const r=await mgmt(`begin; select set_config('request.jwt.claims','${JSON.stringify({sub:uid,role:'authenticated',client_id:client})}',true); set local role authenticated; select public.mcp_workspace_tool('${tool}','${JSON.stringify(args).replace(/'/g,"''")}'::jsonb) r; commit;`);return {ok:true,r}}catch(e){return {ok:false,msg:e.message}}};
 const tasks=async()=>(await mgmt(`select payload->'tasks' t from public.workspace_snapshots where user_id='${uid}'`))[0].t;
 check(!(await call('qa-r','create_task',{title:'x'})).ok,'a read-only grant cannot create a task');
 const c=await call('qa-w','create_task',{title:'Call the plumber',description:'Ask about the leak under the sink.',due_date:'2026-12-01'});
 check(c.ok,'create_task with a description works (write grant)',c.msg);
 let t=await tasks();check(t.length===1&&t[0].title==='Call the plumber'&&t[0].desc==='Ask about the leak under the sink.','the task is in the workspace with its description (the app shows it)',t);
 check(!(await call('qa-r','list_tasks',{})).ok===false,'list_tasks works with a read grant');
 const id=String(t[0].id);
 check((await call('qa-w','complete_task',{id,completed:true})).ok&&(await tasks())[0].done===true,'complete_task works (write grant)');
 const dw=await call('qa-w','delete_task',{id});check(!dw.ok&&/Insufficient/i.test(dw.msg),'delete_task is refused without the delete permission',dw.msg);
 check((await call('qa-d','delete_task',{id})).ok&&(await tasks()).length===0,'delete_task works with the delete permission');
 const al=await mgmt(`select tool from public.mcp_workspace_audit where user_id='${uid}' order by created_at`);check(['create_task','complete_task','delete_task'].every(x=>al.some(a=>a.tool===x)),'every task action is in the AI activity log',al.map(a=>a.tool));
}finally{
 if(uid)await fetch(`${BASE}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:SH});
 console.log('left:',JSON.stringify(await mgmt(`select count(*)::int c from auth.users where email like 'qa.daylight.mcptask${stamp}%'`)));
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
