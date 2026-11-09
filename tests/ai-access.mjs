/**
 * Settings -> AI access, per-AI chooser (both themes, stubbed Supabase auth + tables):
 *  - exactly Claude and ChatGPT rows, each with logo, name and a live Connected / Not connected status for THIS account;
 *  - Connected shows when it was connected, the permission level and last activity, with a Disconnect that revokes at once;
 *  - Not connected opens a connect panel: the MCP address with Copy + that client's exact steps;
 *  - an unrecognized registration shows as "Other connection" with the same Disconnect;
 *  - Recent AI activity sits below, each row naming the AI (logo + name).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','ai-access');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
const UID='00000000-0000-4000-8000-000000000001';
const now=Date.now();
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:1000});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await page.evaluateOnNewDocument((uid,now)=>{
   window.__oauthGrants=[{client_id:'c-claude',client:{id:'c-claude',name:'Claude'}},{client_id:'c-gpt-old',client:{id:'c-gpt-old',name:'ChatGPT'}},{client_id:'c-gpt',client:{id:'c-gpt',name:'ChatGPT'}},{client_id:'c-x',client:{id:'c-x',name:'Acme Notes Bot'}}];
   window.__tbl={mcp_grants:[
    {user_id:uid,client_id:'c-claude',client_name:'Claude',can_read:true,can_write:true,can_delete:false,granted_at:new Date(now-86400e3).toISOString(),revoked_at:null},
    {user_id:uid,client_id:'c-gpt-old',client_name:'ChatGPT',can_read:true,can_write:false,can_delete:false,granted_at:new Date(now-5*86400e3).toISOString(),revoked_at:new Date(now-86400e3).toISOString()},
    {user_id:uid,client_id:'c-gpt',client_name:'ChatGPT',can_read:true,can_write:true,can_delete:true,granted_at:new Date(now-3600e3).toISOString(),revoked_at:null},
    {user_id:uid,client_id:'c-x',client_name:'Acme Notes Bot',can_read:true,can_write:false,can_delete:false,granted_at:new Date(now-7200e3).toISOString(),revoked_at:null}],
   mcp_workspace_audit:[
    {user_id:uid,client_id:'c-gpt',tool:'create_event',result:'Event: Dentist',created_at:new Date(now-600e3).toISOString()},
    {user_id:uid,client_id:'c-claude',tool:'list_events',result:'success',created_at:new Date(now-1800e3).toISOString()},
    {user_id:uid,client_id:'c-x',tool:'delete_event',result:'Event: Old thing',created_at:new Date(now-3600e3).toISOString()}]};
  },UID,now);
  await app.load();
  const openAi=async()=>{await page.evaluate(()=>openSettings('ai'));await page.waitForSelector('.dl-sec-row [data-name]',{timeout:8000});await sleep(700)};
  await openAi();
  const rows=await page.evaluate(()=>[...document.querySelectorAll('.settings-pane [data-list] .dl-sec-row')].map(r=>({name:r.querySelector('[data-name]').textContent,badge:r.querySelector('.dl-ai-badge').textContent,on:r.querySelector('.dl-ai-badge').classList.contains('is-on'),sub:r.querySelector('[data-sub]').textContent,btn:[...r.querySelectorAll('button')].map(b=>b.textContent.trim()),logo:!!r.querySelector('.dl-ai-tile img')})));
  check(T('AI list: Claude, ChatGPT, then the unrecognized registration as "Other connection"'),rows.map(r=>r.name).join('|')==='Claude|ChatGPT|Other connection · Acme Notes Bot',J(rows));
  check(T('both known AIs show their real logo and a live Connected status'),rows[0].logo&&rows[1].logo&&rows[0].on&&rows[1].on&&rows[0].badge==='Connected',J(rows));
  check(T('Connected rows show when, the permission level and last activity'),/Connected [A-Z][a-z]{2} \d+, \d{4} · Read and write · Last activity/.test(rows[0].sub)&&/Read, write and delete · Last activity 10 minutes ago/.test(rows[1].sub),J([rows[0].sub,rows[1].sub]));
  check(T('each connected row has a Disconnect; the other connection has the same one'),rows.every(r=>r.btn.join()==='Disconnect'),J(rows.map(r=>r.btn)));
  const act=await page.evaluate(()=>[...document.querySelectorAll('.settings-pane .dl-ai-act')].map(r=>({what:r.querySelector('.dl-ai-act-what').textContent,meta:r.querySelector('.dl-ai-act-meta').textContent,logo:!!r.querySelector('.dl-ai-tile img')})));
  check(T('Recent AI activity (below the list) names which AI did each thing'),act.length===3&&act[0].what==='Created the event “Dentist”'&&/^ChatGPT · /.test(act[0].meta)&&act[0].logo&&/^Claude · /.test(act[1].meta)&&act[1].what==='Viewed your calendar'&&/^Acme Notes Bot · /.test(act[2].meta),J(act));
  await shot('1-ai-access');
  // Disconnect revokes at once
  await page.evaluate(()=>document.querySelectorAll('.settings-pane [data-list] .dl-sec-row')[0].querySelector('button').click());
  await page.waitForSelector('.backdrop [data-ok]',{timeout:3000});await sleep(300);await shot('2-disconnect-confirm');
  await page.click('.backdrop [data-ok]');await sleep(900);
  const after=await page.evaluate(()=>({revoked:window.__revoked,rows:[...document.querySelectorAll('.settings-pane [data-list] .dl-sec-row')].map(r=>r.querySelector('[data-name]').textContent+':'+r.querySelector('.dl-ai-badge').textContent+':'+[...r.querySelectorAll('button')].map(b=>b.textContent.trim()).join('/'))}));
  check(T('Disconnect revokes that client at Supabase and the row flips to Not connected with a Connect button'),(after.revoked||[]).includes('c-claude')&&after.rows[0]==='Claude:Not connected:Connect',J(after));
  // Connect panel
  await page.evaluate(()=>document.querySelectorAll('.settings-pane [data-list] .dl-sec-row')[0].querySelector('button').click());
  await page.waitForSelector('.dl-ai-steps',{timeout:3000});await sleep(400);
  const panel=await page.evaluate(()=>({title:document.querySelector('.dialog-title').textContent,url:document.querySelector('#aiUrl').value,steps:[...document.querySelectorAll('.dl-ai-steps li')].map(l=>l.textContent),copy:!!document.querySelector('[data-copy]')}));
  check(T('Claude connect panel: the MCP address with Copy and the exact steps'),panel.title==='Connect Claude'&&panel.url==='https://usihrcucnreecynewgbd.supabase.co/functions/v1/mcp'&&panel.copy&&panel.steps.join('|')==='Open Claude and go to Settings → Connectors.|Choose Add custom connector.|Paste the address above.|Choose “Register automatically”.|Leave Client ID and Client Secret blank.|Approve access in Daylight.',J(panel));
  await shot('3-connect-claude');
  await page.keyboard.press('Escape');await sleep(400);
  await page.evaluate(()=>{window.__oauthGrants=window.__oauthGrants.filter(g=>g.client_id!=='c-gpt');window.__tbl.mcp_grants.forEach(g=>{if(g.client_id==='c-gpt')g.revoked_at=new Date().toISOString()})});
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);await openAi();
  await page.evaluate(()=>document.querySelectorAll('.settings-pane [data-list] .dl-sec-row')[1].querySelector('button').click());
  await page.waitForSelector('.dl-ai-steps',{timeout:3000});await sleep(400);
  const gpt=await page.evaluate(()=>({title:document.querySelector('.dialog-title').textContent,steps:[...document.querySelectorAll('.dl-ai-steps li')].map(l=>l.textContent)}));
  check(T('ChatGPT connect panel: new plugin or connector, paste the address, blank client ID and secret, approve'),gpt.title==='Connect ChatGPT'&&gpt.steps.join('|')==='In ChatGPT, create a new plugin or connector.|Paste the address above.|Leave Client ID and Client Secret blank.|Approve access in Daylight.',J(gpt));
  await shot('3-connect-chatgpt');
  await page.keyboard.press('Escape');await sleep(400);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('ai access FAILED');process.exit(1)}
console.log('PASS ai access');
