/** MCP task tools end to end, on a throwaway account (never the owner's data): the real JSON-RPC dispatcher (supabase/functions/mcp/protocol.js, exactly as deployed) calling the real
 *  database function mcp_workspace_tool under OAuth-style claims, then the deployed app showing the result on the Tasks page. The OAuth layer itself is not exercised or changed here.
 *  Covers the way assistants really call these tools: ids as the strings the schema says AND as the numbers list_tasks returns, "completed" as true / "true". SITE=local or deployed. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck,mgmt}from './live-lib.mjs';
const src=fs.readFileSync(new URL('../supabase/functions/mcp/protocol.js',import.meta.url),'utf8');
const tmp=path.join(os.tmpdir(),'dl-protocol-'+Date.now()+'.mjs');fs.writeFileSync(tmp,src);
const {dispatchMcp,availableTools}=await import(pathToFileURL(tmp).href);
const site=await siteUrl();const browser=await launchBrowser();
try{
 const U=await makeUser('mt',{name:'QA MCP Tasks'});const tok=await tokenFor(U);
 await mgmt(`update public.workspace_snapshots set payload=jsonb_set(coalesce(payload,'{}'::jsonb),'{tasks}','[]'::jsonb) where user_id='${U.id}'`);
 const ws=await mgmt(`select count(*)::int c from public.workspace_snapshots where user_id='${U.id}'`);
 if(!ws[0].c)await mgmt(`insert into public.workspace_snapshots(user_id,payload,revision) values ('${U.id}','{"calendars":[{"id":"personal","name":"Personal"}],"events":[],"tasks":[],"settings":{}}',1)`);
 await mgmt(`insert into public.mcp_grants(user_id,client_id,client_name,can_read,can_write,can_delete) values ('${U.id}','qa-full','QA assistant',true,true,true) on conflict do nothing`);
 const grant={can_read:true,can_write:true,can_delete:true};
 const invoke=async(tool,args)=>{
  const claims=JSON.stringify({sub:U.id,role:'authenticated',client_id:'qa-full'});
  const q=`begin; select set_config('request.jwt.claims','${claims}',true); set local role authenticated; select public.mcp_workspace_tool(${"$a$"+tool+"$a$"},${"$a$"+JSON.stringify(args||{})+"$a$"}::jsonb) as r; commit;`;
  const r=await mgmt(q);if(r&&r.message)throw Error(r.message);
  const row=Array.isArray(r)?r.find(x=>x&&x.r!==undefined):null;if(!row)throw Error('no result '+JSON.stringify(r).slice(0,200));
  return {content:[{type:'text',text:JSON.stringify(row.r)}]};
 };
 let n=0;
 const call=async(name,args)=>{const res=await dispatchMcp({jsonrpc:'2.0',id:++n,method:'tools/call',params:{name,arguments:args}},grant,invoke);const r=res.data&&res.data.result;
  const text=r&&r.content&&r.content[0]&&r.content[0].text;return {err:!r||r.isError===true||!!(res.data&&res.data.error),text,json:(()=>{try{return JSON.parse(text)}catch(e){return null}})()}};
 const stored=async()=>(await mgmt(`select payload->'tasks' t,payload->'events' e from public.workspace_snapshots where user_id='${U.id}'`))[0];
 check(availableTools(grant).some(t=>t.name==='create_task'&&/TASK/.test(t.description)),'the assistant is offered create_task, described as a task (not an event)');
 /* 1. create */
 let c=await call('create_task',{title:'MCP e2e task A',due_date:'2026-12-05'});
 check(!c.err&&c.json&&c.json.title==='MCP e2e task A','create_task returns the new task',c);
 let s=await stored();check(s.t.length===1&&s.t[0].title==='MCP e2e task A'&&s.e.length===0,'it is a task in the workspace and NOT an event',s);
 const idNum=c.json&&c.json.id;
 /* 2. complete: id as the string the schema says */
 let d=await call('complete_task',{id:String(idNum),completed:true});
 check(!d.err,'complete_task with the id as a string works',d);
 s=await stored();check(s.t[0].done===true,'the task is stored as done',s.t);
 d=await call('complete_task',{id:String(idNum),completed:false});s=await stored();check(!d.err&&s.t[0].done===false,'complete_task can mark it not done again',d);
 /* the way many assistants really send it: the id exactly as list_tasks returned it (a number), completed as a boolean or the text "true" */
 const l=await call('list_tasks',{});check(!l.err&&Array.isArray(l.json)&&l.json.length===1,'list_tasks lists it',l);
 d=await call('complete_task',{id:l.json[0].id,completed:true});
 check(!d.err,'complete_task with the id as the NUMBER list_tasks returned works',d);
 s=await stored();check(s.t[0].done===true,'  ...and the task is stored as done',s.t);
 await call('complete_task',{id:String(idNum),completed:false});
 d=await call('complete_task',{id:String(idNum),completed:'true'});s=await stored();
 check(!d.err&&s.t[0].done===true,'complete_task with completed sent as the text "true" works',d);
 /* the app shows it completed on the Tasks page */
 const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);
 await page.goto(site.url+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(t=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(t))},tok);
 await page.goto(site.url+'dashboard/tasks',{waitUntil:'load'});await sleep(6000);
 let ui=await page.evaluate(()=>({rows:[...document.querySelectorAll('.task-row')].map(r=>({t:r.querySelector('.task-title').textContent,done:r.classList.contains('done')})),sub:document.querySelector('.tasks-sub')?.textContent||''}));
 check(ui.rows.length===1&&ui.rows[0].t==='MCP e2e task A'&&ui.rows[0].done,'the Tasks page shows the task, completed',ui);
 check(await page.evaluate(()=>state.events.filter(e=>/MCP e2e/.test(e.title)).length===0),'no event with that title exists on the calendar');
 /* 3. delete */
 d=await call('delete_task',{id:l.json[0].id});
 check(!d.err,'delete_task with the numeric id works',d);
 s=await stored();check(s.t.length===0,'the task is gone from storage',s.t);
 /* a second task deleted with the string id */
 c=await call('create_task',{title:'MCP e2e task B'});d=await call('delete_task',{id:String(c.json.id)});s=await stored();check(!d.err&&s.t.length===0,'delete_task with the id as a string works too',d);
 await page.reload({waitUntil:'load'});await sleep(5500);
 ui=await page.evaluate(()=>({n:document.querySelectorAll('.task-row').length,txt:document.querySelector('.tasks-wrap')?.innerText.slice(0,80)}));
 check(ui.n===0,'after a reload the Tasks page shows no tasks',ui);
 const bad=await call('delete_task',{id:'999999'});check(bad.err&&/not found/i.test(bad.text||''),'deleting an unknown task is a clear error (nothing else is touched)',bad);
 await ctx.close();
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,500))}finally{await cleanup();await browser.close();site.close();try{fs.unlinkSync(tmp)}catch(e){}}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
