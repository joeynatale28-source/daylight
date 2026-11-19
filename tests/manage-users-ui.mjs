/** Manage users, UI through the harness (Supabase stubbed in-page): the button sits under Open tickets for the owner only, the list (summary, live search,
 *  rows with full e-mail + status + dates, empty state, pagination), the detail (calendar names only, tickets, history), and Warn / Suspend / Ban / Lift with
 *  a confirmation naming the person. Light and dark, desktop and phone. The real RPCs and function are covered by tests/manage-users-live.mjs. */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const SHOTS=process.env.SHOTS||null;
const setup=owner=>{
 const c=window.daylightCloud;window.daylightAdmin=window.daylightAdmin||{};window.daylightAdmin.isOwner=()=>owner;
 const USERS=[];for(let i=0;i<30;i++)USERS.push({id:'u'+i,name:i===0?'Zed Quillfeather':i===1?'':'Person '+i,email:i===0?'zed@example.com':i===1?'noname@example.com':'p'+i+'@example.com',username:i===0?'zedq':'',created_at:new Date(Date.now()-i*864e5).toISOString(),last_sign_in_at:i===2?null:new Date(Date.now()-i*36e5).toISOString(),status:i===3?'suspended':i===4?'banned':'active'});
 const st=window.__mu={calls:[],users:USERS,status:{}};
 const real=c.client.rpc.bind(c.client);
 const ok=d=>Promise.resolve({data:d,error:null});
 c.client.rpc=function(name,a){
  if(name==='support_admin_list')return ok([]);
  if(name==='support_ticket_list')return ok([]);
  if(name==='support_users_summary'){const s=st.users.map(u=>st.status[u.id]||u.status);return ok({total:st.users.length,active:s.filter(x=>x==='active').length,suspended:s.filter(x=>x==='suspended').length,banned:s.filter(x=>x==='banned').length})}
  if(name==='support_users_list'){const q=(a.p_q||'').toLowerCase();const f=st.users.filter(u=>!q||[u.name,u.email,u.username].join(' ').toLowerCase().includes(q)).map(u=>Object.assign({},u,{status:st.status[u.id]||u.status}));st.calls.push({n:'list',q:a.p_q,off:a.p_offset});return ok({total:f.length,rows:f.slice(a.p_offset,a.p_offset+a.p_limit)})}
  if(name==='support_user_detail'){const u=st.users.find(x=>x.id===a.p_id);const s=st.status[u.id]||u.status;return ok({user:Object.assign({},u,{status:s,restriction:s==='active'?null:{kind:s==='banned'?'banned':'suspended',reason:st.reason||'Spam',ends_at:null}}),sign_in:['Email','Google'],calendars:['Garden club','Night shifts'],tickets:[{id:'t1',ref:'A1B2C3D4',title:'Calendar will not sync',status:'open',category:'bug',created_at:new Date().toISOString()}],history:st.log||[]})}
  return real(name,a);
 };
 c.client.functions={invoke:async(fn,o)=>{st.calls.push({n:'fn',fn,body:o.body});const b=o.body;if(fn==='support-admin'){const t=st.users.find(u=>u.id===b.user_id);
   if(b.action==='suspend'){st.status[t.id]='suspended';st.reason=b.reason}if(b.action==='ban'){st.status[t.id]='banned';st.reason=b.reason}if(b.action==='lift')st.status[t.id]='active';
   (st.log=st.log||[]).unshift({action:b.action,reason:b.reason||'',detail:b.duration?{duration:b.duration}:{},admin_email:'owner@example.com',created_at:new Date().toISOString()});}
  return {data:{ok:true},error:null}}};
};
for(const [theme,w,h] of [['light',1440,900],['dark',1440,900],['light',390,844]]){
 const tag=`${theme} ${w}px`;
 const app=await launch({width:w,height:h,theme});const page=app.page;
 try{
  await app.load();await sleep(500);
  // not the owner: no button
  await page.evaluate(setup,false);
  await page.evaluate(()=>{state.section='support';renderAll(false)});await sleep(700);
  check(await page.evaluate(()=>!document.body.innerText.includes('Manage users')&&!document.querySelector('.dl-um-btn')),`${tag}: a regular user never sees Manage users`);
  // owner
  await page.evaluate(setup,true);
  await page.evaluate(()=>{state.section='support';renderAll(false)});await sleep(800);
  const pos=await page.evaluate(()=>{const o=document.querySelector('.dl-sup-open:not(.dl-um-btn)'),m=document.querySelector('.dl-um-btn');return o&&m&&{open:o.textContent.replace(/\s+/g,' ').trim(),manage:m.textContent.trim(),below:m.getBoundingClientRect().top>=o.getBoundingClientRect().bottom-1}});
  check(pos&&/Open tickets/.test(pos.open)&&pos.manage==='Manage users'&&pos.below,`${tag}: Manage users sits under Open tickets for the owner`,pos);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/mu-home-${theme}-${w}.png`});
  await page.click('.dl-um-btn');await page.waitForSelector('.dl-um-stats',{timeout:5000});await sleep(900);
  await sleep(500);const lv=await page.evaluate(()=>({h:document.querySelector('.dl-sup-hello').textContent,stats:[...document.querySelectorAll('.dl-um-stat')].map(s=>s.innerText.replace(/\s+/g,' ').trim()),rows:document.querySelectorAll('.dl-um-row').length,first:document.querySelector('.dl-um-row').innerText.replace(/\s+/g,' '),pg:document.querySelector('.dl-um-pg span').textContent,back:document.querySelector('.dl-sup-back').textContent.trim()}));
  check(lv.h==='Manage users'&&lv.stats.join('|')==='30 Total users|28 Active|1 Suspended|1 Banned'&&lv.back==='Support Center','list: title, summary strip (total / active / suspended / banned), back to Support Center',lv);
  check(lv.rows===25&&/Zed Quillfeather/.test(lv.first)&&/zed@example\.com/.test(lv.first)&&/@zedq/.test(lv.first)&&/Active/.test(lv.first)&&/Joined/.test(lv.first)&&/Active /.test(lv.first)&&/Showing 1–25 of 30/.test(lv.pg),'list: full e-mail, username, status badge, joined and last active; 25 per page',lv);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/mu-list-${theme}-${w}.png`});
  // pagination
  await page.click('[data-next]');await sleep(500);
  check(await page.evaluate(()=>document.querySelectorAll('.dl-um-row').length===5&&/Showing 26–30 of 30/.test(document.querySelector('.dl-um-pg span').textContent)),'list: next page shows the rest');
  await page.click('[data-prev]');await sleep(400);
  // live search
  await page.type('.dl-sup-search input','quill');await sleep(700);
  check(await page.evaluate(()=>document.querySelectorAll('.dl-um-row').length===1&&/Zed/.test(document.querySelector('.dl-um-row').innerText)),'search: filters live by name');
  await page.$eval('.dl-sup-search input',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.type('.dl-sup-search input','noname@');await sleep(700);
  check(await page.evaluate(()=>document.querySelectorAll('.dl-um-row').length===1),'search: by e-mail');
  await page.$eval('.dl-sup-search input',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.type('.dl-sup-search input','zedq');await sleep(700);
  check(await page.evaluate(()=>document.querySelectorAll('.dl-um-row').length===1),'search: by username');
  await page.$eval('.dl-sup-search input',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.type('.dl-sup-search input','nobody-here');await sleep(700);
  check(await page.evaluate(()=>/Nobody matches/.test(document.querySelector('.dl-sup-card').innerText)&&document.querySelectorAll('.dl-um-row').length===0),'search: a clean empty state when nothing matches');
  await page.$eval('.dl-sup-search input',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.type('.dl-sup-search input','zed');await sleep(700);
  // detail
  await page.click('.dl-um-row');await page.waitForSelector('.dl-um-grid',{timeout:5000});await sleep(700);
  const dv=await page.evaluate(()=>({h:document.querySelector('.dl-um-head h1').textContent,sub:document.querySelector('.dl-um-head .dl-sup-sub').textContent,meta:document.querySelector('.dl-um-meta').innerText.replace(/\s+/g,' '),cards:[...document.querySelectorAll('.dl-um-card h2')].map(h=>h.textContent),chips:[...document.querySelectorAll('.dl-um-chip')].map(c=>c.textContent),acct:document.querySelector('.dl-um-kv').innerText.replace(/\s+/g,' '),btns:[...document.querySelectorAll('.dl-um-actions button')].map(b=>b.textContent),back:document.querySelector('.dl-sup-back').textContent.trim(),text:document.querySelector('.dl-um-detail').innerText}));
  check(dv.h==='Zed Quillfeather'&&dv.sub==='zed@example.com'&&/Active/.test(dv.meta)&&/Member since/.test(dv.meta)&&/Last active/.test(dv.meta)&&dv.cards.join('|')==='Account|Calendars|Tickets|History|Actions'&&dv.back==='Users','detail: header (name, full e-mail, status, member since, last active) and the five sections',dv);
  check(/Email, Google/.test(dv.acct)&&dv.chips.join('|')==='Garden club|Night shifts'&&!/SECRET/.test(dv.text),'detail: sign-in types, calendar names only',dv);
  check(dv.btns.join('|')==='Warn|Suspend|Ban','detail: Warn, Suspend and Ban',dv.btns);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/mu-detail-${theme}-${w}.png`});
  // ticket link
  await page.click('.dl-adm-tk');await sleep(600);
  check(await page.evaluate(()=>/Users/.test(document.querySelector('.dl-sup-back').textContent)),'detail: a ticket opens, and back returns to the person');
  await page.evaluate(()=>[...document.querySelectorAll('.dl-sup-back')][0].click());await sleep(700);
  // warn
  await page.evaluate(()=>[...document.querySelectorAll('.dl-um-actions button')].find(b=>b.textContent==='Warn').click());await sleep(400);
  const wd=await page.evaluate(()=>({t:document.querySelector('.dl-act .dialog-title').textContent,who:document.querySelector('.dl-act-who').innerText.replace(/\s+/g,' '),ok:document.querySelector('[data-ok]').disabled}));
  check(wd.t==='Warn this user?'&&/Zed Quillfeather/.test(wd.who)&&/zed@example\.com/.test(wd.who)&&wd.ok===true,'Warn: a confirmation naming the person, disabled until a reason is typed',wd);
  await page.type('.dl-act textarea','Spam in shared calendars');await sleep(150);
  await page.click('[data-ok]');await sleep(900);
  check(await page.evaluate(()=>window.__mu.calls.some(c=>c.fn==='support-admin'&&c.body.action==='warn'&&c.body.user_id==='u0'&&c.body.reason==='Spam in shared calendars')&&/Warning sent/.test(document.querySelector('.dl-um-detail').innerText)),'Warn: sent, and logged in the history');
  // suspend
  await page.evaluate(()=>[...document.querySelectorAll('.dl-um-actions button')].find(b=>b.textContent==='Suspend').click());await sleep(400);
  await page.type('.dl-act textarea','Repeated abuse');await sleep(150);await page.click('[data-ok]');await sleep(1000);
  const sv=await page.evaluate(()=>({pill:document.querySelector('.dl-um-meta .dl-sup-pill').textContent,restr:(document.querySelector('.dl-um-restr')||{}).textContent,btns:[...document.querySelectorAll('.dl-um-actions button')].map(b=>b.textContent),log:document.querySelector('.dl-um-card:nth-child(4)').innerText}));
  check(sv.pill==='Suspended'&&/Repeated abuse/.test(sv.restr)&&sv.btns.includes('Lift suspension')&&/Suspended/.test(sv.log),'Suspend: status flips, reason shown, logged, Lift offered',sv);
  // lift then ban
  await page.evaluate(()=>[...document.querySelectorAll('.dl-um-actions button')].find(b=>/Lift/.test(b.textContent)).click());await sleep(400);
  await page.type('.dl-act textarea','Resolved');await sleep(150);await page.click('[data-ok]');await sleep(1000);
  await page.evaluate(()=>[...document.querySelectorAll('.dl-um-actions button')].find(b=>b.textContent==='Ban').click());await sleep(400);
  check(await page.evaluate(()=>/Zed Quillfeather/.test(document.querySelector('.dl-act-who').innerText)&&document.querySelector('.dl-act .dialog-title').textContent==='Ban this user?'),'Ban: a confirmation naming the person');
  await page.type('.dl-act textarea','Abuse');await sleep(150);await page.click('[data-ok]');await sleep(1000);
  check(await page.evaluate(()=>document.querySelector('.dl-um-meta .dl-sup-pill').textContent==='Banned'),'Ban: status flips to Banned');
  // back to the list keeps working and shows the new summary
  await page.evaluate(()=>document.querySelector('.dl-sup-back').click());await sleep(900);
  check(await page.evaluate(()=>document.querySelector('.dl-um-stat[data-k=banned] b').textContent==='2'),'back to the list: the summary reflects the ban');
  if(w<500)check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.dl-sup').scrollWidth<=document.querySelector('.dl-sup').clientWidth+1),'phone: nothing scrolls sideways');
  {const errs=app.errors.filter(e=>!/reading 'status'/.test(e));check(errs.length===0,`${tag}: no page errors (the ticket chat itself has no stub in this test)`,errs)}
 }catch(e){bad++;console.log('FAIL exception: '+String(e.message).slice(0,240))}finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
