/** Support Center + MCP sharing against the REAL Supabase project, using throwaway accounts this script creates and deletes (never a real account).
 *  Needs .env (project ref, anon key, access token). Run: node tests/support-center-live.mjs */
import fs from 'node:fs';
import zlib from 'node:zlib';
const R=new URL('../',import.meta.url);
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`,ANON=env.NEW_SUPABASE_ANON_KEY;
function unzipSync(u8){   // minimal zip reader (deflate or stored) via the central directory
 const b=Buffer.from(u8);let e=b.length-22;while(e>=0&&b.readUInt32LE(e)!==0x06054b50)e--;
 const n=b.readUInt16LE(e+10);let off=b.readUInt32LE(e+16);const out={};
 for(let i=0;i<n;i++){const method=b.readUInt16LE(off+10),csize=b.readUInt32LE(off+20),nl=b.readUInt16LE(off+28),xl=b.readUInt16LE(off+30),cl=b.readUInt16LE(off+32),lho=b.readUInt32LE(off+42);
  const name=b.toString('utf8',off+46,off+46+nl);const lnl=b.readUInt16LE(lho+26),lxl=b.readUInt16LE(lho+28);const data=b.subarray(lho+30+lnl+lxl,lho+30+lnl+lxl+csize);
  out[name]=method===0?data:zlib.inflateRawSync(data);off+=46+nl+xl+cl}
 return out}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const mgmt=async q=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:q})});const j=await r.json();if(!r.ok)throw Object.assign(new Error(j.message||JSON.stringify(j)),{status:r.status});return j};
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
const SVC=keys.find(k=>k.name==='service_role').api_key;
const SH={apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'};
const stamp=Date.now();
const mk=async(tag,name)=>{
 const email=`qa.daylight.${tag}${stamp}@mailinator.com`,password='Qa-'+Math.random().toString(36).slice(2)+'Zz9!';
 const u=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:SH,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:name}})})).json();
 if(!u.id)throw new Error('could not create '+tag+': '+JSON.stringify(u));
 const t=await (await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify({email,password})})).json();
 return {id:u.id,email,jwt:t.access_token};
};
const rpc=async(u,name,args)=>{const r=await fetch(`${BASE}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+u.jwt,'content-type':'application/json'},body:JSON.stringify(args||{})});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}return {ok:r.ok,data:j}};
const upload=async(u,path,bytes,type)=>{const r=await fetch(`${BASE}/storage/v1/object/support-files/${path}`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+u.jwt,'content-type':type},body:bytes});return r.status};
const signed=async(u,path)=>{const r=await fetch(`${BASE}/storage/v1/object/sign/support-files/${path}`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+u.jwt,'content-type':'application/json'},body:JSON.stringify({expiresIn:300})});return {status:r.status,body:await r.json().catch(()=>({}))}};
const fnCall=async(u,b)=>{const r=await fetch(`${BASE}/functions/v1/support`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+u.jwt,'content-type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json().catch(()=>({}))}};
const PNG=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVR4nGNkYGD4z0AEYBxVSF/F/6EQ0EQoAwMDQ/wnQL+KA1QAAHlwBwWfHfMQAAAAAElFTkSuQmCC','base64'));
const users=[];
try{
 const A=await mk('a','Alex Rivera'),B=await mk('b','Support Admin'),C=await mk('c','Chris Lee');users.push(A,B,C);
 await mgmt(`insert into public.daylight_owners(user_id) values ('${B.id}')`);   // B acts as the admin (removed at the end)
 // ================= Support Center =================
 const tid=crypto.randomUUID();
 const att=[];
 const pstat=await upload(A,`${A.id}/${tid}/pic.png`,PNG,'image/png');check(pstat===200,'user uploads a photo into their own ticket folder',pstat);
 check(await upload(A,`${C.id}/${tid}/x.png`,PNG,'image/png')!==200,"a user cannot upload into someone else's folder");
 const created=await rpc(A,'support_ticket_create',{p_id:tid,p_title:'Calendar will not load',p_body:'Blank month view.',p_kind:'ticket',p_atts:[{path:`${A.id}/${tid}/pic.png`,name:'pic.png',type:'image/png',size:PNG.length}]});
 check(created.ok&&created.data===tid,'creating a ticket works (with a photo)',created);
 check(!(await rpc(A,'support_ticket_create',{p_id:crypto.randomUUID(),p_title:'x',p_body:'y',p_kind:'ticket',p_atts:[{path:`${C.id}/z/pic.png`,name:'p',type:'image/png',size:1}]})).ok,'attachments must live in the ticket owner folder');
 check((await rpc(A,'support_ticket_list')).data.length===1,'the user sees their own ticket');
 check((await rpc(C,'support_ticket_list')).data.length===0&&!(await rpc(C,'support_ticket_get',{p_id:tid})).ok,'another user sees nothing and cannot open it');
 check(!(await rpc(A,'support_admin_list',{p_status:'open'})).ok,'a normal user cannot list all tickets');
 const al=await rpc(B,'support_admin_list',{p_status:'open'});check(al.ok&&al.data.some(t=>t.id===tid),'the admin sees it under Open tickets',al.data&&al.data.length);
 const notesFor=async uid=>Number((await mgmt(`select count(*)::int c from public.daylight_broadcast_recipients r join public.daylight_broadcasts b on b.id=r.broadcast_id where r.user_id='${uid}' and b.ticket_id='${tid}'`))[0].c);
 check(await notesFor(B.id)===1,'the admin was notified of the new ticket (nobody was viewing)');
 check(!(await rpc(C,'support_send',{p_id:tid,p_body:'hi',p_atts:[]})).ok,"another user cannot write in someone else's ticket");
 // admin views the ticket, then the user replies: no notification
 await rpc(B,'support_ticket_get',{p_id:tid,p_viewing:true});
 const before=await notesFor(B.id);
 await rpc(A,'support_send',{p_id:tid,p_body:'Any update?',p_atts:[]});
 check(await notesFor(B.id)===before,'user reply while the admin is viewing: no admin notification');
 await sleep(22000);   // the admin stops "viewing" (no heartbeat for 20+ seconds)
 await mgmt(`delete from public.daylight_broadcasts where ticket_id='${tid}'`);   // the admin has read the earlier one
 await rpc(A,'support_send',{p_id:tid,p_body:'Still blank.',p_atts:[]});
 check(await notesFor(B.id)===1,'user reply while the admin is NOT viewing: admin notified');
 // admin reply: user viewing -> none; not viewing -> notification from Daylight Support
 await rpc(A,'support_ticket_get',{p_id:tid,p_viewing:true});
 await rpc(B,'support_send',{p_id:tid,p_body:'Looking now.',p_atts:[]});
 check(await notesFor(A.id)===0,'admin reply while the user is viewing: no user notification');
 await sleep(22000);
 await rpc(B,'support_send',{p_id:tid,p_body:'Fixed on our side.',p_atts:[]});
 const nl=await rpc(A,'daylight_list_broadcasts');const n=(nl.data||[]).find(x=>x.ticket_id===tid);
 check(n&&n.sender==='support'&&/replied to your support ticket/.test(n.title),'admin reply while the user is away: notification "Daylight Support ✓ replied to your support ticket"',n);
 const ad=await rpc(B,'daylight_list_broadcasts');const an=(ad.data||[]).find(x=>x.ticket_id===tid);
 check(an&&an.sender==='ticket'&&/Alex Rivera/.test(an.title),'admin notifications name the person who replied',an);
 // ---- data export
 const g=await fnCall(A,{action:'give_data',ticket_id:tid});check(g.status===403,'a normal user cannot call Give data',g.status);
 const gd=await fnCall(B,{action:'give_data',ticket_id:tid});check(gd.status===200&&gd.body.ok,'the admin gives data',gd);
 const full=await rpc(A,'support_ticket_get',{p_id:tid,p_viewing:false});
 const ex=(full.data.messages||[]).find(m=>m.kind==='export');
 check(ex&&ex.attachments[0].expires_at&&Math.abs(new Date(ex.attachments[0].expires_at)-Date.now()-864e5)<120000,'the export is in the chat and expires in 24 hours',ex&&ex.attachments);
 const sg=await signed(A,ex.attachments[0].path);check(sg.status===200,'the user can download it',sg);
 const zipRes=await fetch(BASE+'/storage/v1'+sg.body.signedURL);const files=unzipSync(new Uint8Array(await zipRes.arrayBuffer()));const names=Object.keys(files);
 check(['account.json','settings.json','calendars.json','events.json','tasks.json','sharing.json','ai-access.json','support-tickets.json','SUMMARY.txt'].every(f=>names.includes(f)),'the ZIP holds JSON files, a summary and the rest',names);
 const acc=JSON.parse(Buffer.from(files['account.json']).toString());check(acc.email===A.email&&!JSON.stringify(files['account.json']).includes(C.email),'the export is only that user\'s own data');
 check(/WHAT IS INSIDE/.test(Buffer.from(files['SUMMARY.txt']).toString()),'the summary explains what is inside');
 check((await signed(C,ex.attachments[0].path)).status!==200,"another user cannot download someone else's export");
 // expiry: age the file past 24h
 await mgmt(`update storage.objects set created_at = now() - interval '25 hours' where bucket_id='support-files' and name='${ex.attachments[0].path}'`);
 check((await signed(A,ex.attachments[0].path)).status!==200,'after 24 hours the download is refused');
 check((await signed(B,ex.attachments[0].path)).status!==200,'and the admin cannot fetch it either');
 const pic=await signed(B,`${A.id}/${tid}/pic.png`);check(pic.status===200,'the admin can see the ticket photo');
 // ---- closing
 check((await rpc(A,'support_close',{p_id:tid})).ok,'the user can close the ticket');
 const closed=(await rpc(A,'support_ticket_get',{p_id:tid,p_viewing:false})).data;check(closed.ticket.status==='closed','closed tickets stay readable',closed.ticket.status);
 check(!(await rpc(B,'support_send',{p_id:tid,p_body:'late',p_atts:[]})).ok,'nobody can write after it is closed');
 const cl=await rpc(B,'support_admin_list',{p_status:'closed'});check(cl.data.some(t=>t.id===tid),'the admin sees it under Closed');
 // admin can close another ticket
 const t2=crypto.randomUUID();await rpc(C,'support_ticket_create',{p_id:t2,p_title:'Data request',p_body:'',p_kind:'data',p_atts:[]});
 check((await rpc(B,'support_close',{p_id:t2})).ok,'the admin can close a ticket');

 // ================= MCP sharing (through the real mcp_workspace_tool, with an OAuth-style claim) =================
 await mgmt(`insert into public.workspace_snapshots(user_id,payload,revision) values ('${A.id}','{"calendars":[{"id":"c-share","name":"Family","color":"blue"}],"events":[{"id":501,"cal":"c-share","title":"Dinner","start":"2026-12-20T18:00:00Z","end":"2026-12-20T19:00:00Z"}],"tasks":[],"settings":{}}',1) on conflict (user_id) do update set payload=excluded.payload`);
 await mgmt(`insert into public.mcp_grants(user_id,client_id,client_name,can_read,can_write,can_delete) values ('${A.id}','qa-write','QA write',true,true,false),('${A.id}','qa-read','QA read',true,false,false)`);
 const asMcp=(uid,client,tool,args)=>`begin; select set_config('request.jwt.claims','${JSON.stringify({sub:uid,role:'authenticated',client_id:client}).replace(/'/g,"''")}',true); set local role authenticated; select public.mcp_workspace_tool('${tool}','${JSON.stringify(args).replace(/'/g,"''")}'::jsonb) r; commit;`;
 const run=async(client,tool,args)=>{try{return {ok:true,data:await mgmt(asMcp(A.id,client,tool,args))}}catch(e){return {ok:false,msg:e.message}}};
 const rs=await run('qa-read','share_event',{event_id:'501',email:B.email,permission:'view'});
 check(!rs.ok&&/Insufficient/i.test(rs.msg),'a read-only grant is refused (event)',rs.msg);
 const rs2=await run('qa-read','share_calendar',{calendar_id:'c-share',email:B.email,permission:'view'});
 check(!rs2.ok&&/Insufficient/i.test(rs2.msg),'a read-only grant is refused (calendar)',rs2.msg);
 const se=await run('qa-write','share_event',{event_id:'501',email:B.email,permission:'view'});
 check(se.ok,'share an event through MCP (write grant)',se.msg);
 const sc=await run('qa-write','share_calendar',{calendar_id:'c-share',email:C.email,permission:'edit'});
 check(sc.ok,'share a calendar through MCP (write grant)',sc.msg);
 const bad=await run('qa-write','share_event',{event_id:'501',email:B.email,permission:'owner'});check(!bad.ok&&/view or edit/.test(bad.msg),'only the app\'s permission levels are accepted',bad.msg);
 const nob=await run('qa-write','share_event',{event_id:'501',email:'nobody.'+stamp+'@mailinator.com',permission:'view'});check(!nob.ok&&/No Daylight account/.test(nob.msg),'an unknown email is refused',nob.msg);
 const evInv=await rpc(B,'daylight_list_my_event_invites');check(evInv.ok&&evInv.data.some(i=>i.event_title==='Dinner'&&i.permission==='view'&&i.status==='pending'),'the recipient gets the in-app invitation for the event',evInv.data);
 const calInv=await rpc(C,'daylight_list_my_invites');check(calInv.ok&&calInv.data.some(i=>i.calendar_name==='Family'&&i.permission==='edit'),'the recipient gets the in-app invitation for the calendar',calInv.data);
 const mine=await rpc(A,'daylight_list_event_shares',{p_event_id:501});check(mine.ok&&mine.data.some(s=>s.email===B.email),'the share shows up in the owner\'s sharing list',mine.data);
 const mineC=await rpc(A,'daylight_list_calendar_shares',{p_calendar_id:'c-share'});check(mineC.ok&&mineC.data.some(s=>s.email===C.email),'and for the calendar',mineC.data);
 const aud=await mgmt(`select tool,result from public.mcp_workspace_audit where user_id='${A.id}' and tool like 'share_%' order by created_at`);check(aud.length===2,'both shares are in the AI activity log',aud);
}finally{
 // clean up: the test tickets, files, owner row, throwaway accounts
 try{await mgmt(`delete from public.daylight_owners where user_id in (${users.map(u=>`'${u.id}'`).join(',')||"'00000000-0000-0000-0000-000000000000'"})`)}catch(e){}
 for(const u of users){
  try{const l=await (await fetch(`${BASE}/storage/v1/object/list/support-files`,{method:'POST',headers:SH,body:JSON.stringify({prefix:u.id+'/',limit:1000})})).json();
   const sub=Array.isArray(l)?l:[];for(const f of sub){const l2=await (await fetch(`${BASE}/storage/v1/object/list/support-files`,{method:'POST',headers:SH,body:JSON.stringify({prefix:u.id+'/'+f.name+'/',limit:1000})})).json();
    const paths=(Array.isArray(l2)?l2:[]).map(x=>`${u.id}/${f.name}/${x.name}`);if(paths.length)await fetch(`${BASE}/storage/v1/object/support-files`,{method:'DELETE',headers:SH,body:JSON.stringify({prefixes:paths})})}}catch(e){}
  try{await mgmt(`delete from public.daylight_broadcasts where ticket_id in (select id from public.support_tickets where user_id='${u.id}'); delete from public.daylight_calendar_shares where owner_id='${u.id}' or recipient_id='${u.id}'; delete from public.daylight_event_shares where owner_id='${u.id}' or recipient_id='${u.id}'; delete from public.mcp_grants where user_id='${u.id}'; delete from public.mcp_workspace_audit where user_id='${u.id}'`)}catch(e){console.log('cleanup',e.message)}
  await fetch(`${BASE}/auth/v1/admin/users/${u.id}`,{method:'DELETE',headers:SH});
 }
 const left=await mgmt(`select (select count(*) from auth.users where email like 'qa.daylight.%${stamp}@mailinator.com')::int users, (select count(*) from public.support_tickets where user_email like 'qa.daylight.%${stamp}%')::int tickets`);
 console.log('cleanup left:',JSON.stringify(left));
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
