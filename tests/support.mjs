/**
 * Support, end to end at the client boundary, both themes (the database rules are proven in tests/support-sql.mjs):
 *  - sidebar: Documentation (no link) + Support ticket above Settings; Admin only for the owner, also above Settings;
 *  - the ticket popup (Create Event language): Send is disabled until valid, then a success state;
 *  - the same row then opens the Support window (chat) for a person with an open ticket; New ticket still works there;
 *  - the owner's Admin page: Notifications / Banners / Support tabs; the ticket shows unread; replying shows typing dots,
 *    reaches the person's Support window, and creates ONE notification for that person only (not the owner, not anyone else);
 *  - Admin is gone from Settings.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','support');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const OWNER={id:'00000000-0000-4000-8000-0000000000aa',email:'owner@example.com',user_metadata:{full_name:'Owner Account',onboarded:true}};
const TEST={id:'00000000-0000-4000-8000-0000000000bb',email:'user@daylightcal.com',user_metadata:{full_name:'Test Account',onboarded:true}};
const payload=cal=>{const p=busyPayload();p.calendars=[{id:'c9',name:cal,color:'blue'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];p.events=[];return p};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:payload('Owner calendar'),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.evaluateOnNewDocument((o,t,po,pt)=>{
   window.__accounts={[o.id]:{user:o,payload:po},[t.id]:{user:t,payload:pt}};
   var saved=null;try{saved=JSON.parse(localStorage.getItem('__bcState')||'null')}catch(e){}
   window.__bc=saved||{owners:[o.id],items:[],reads:{},clears:{},banners:[]};
   window.__sp=JSON.parse(localStorage.getItem('__spState')||'null')||{tickets:[],msgs:[]};
  },OWNER,TEST,payload('Owner calendar'),payload('Test calendar'));
  await app.load();
  const waitIdle=()=>page.waitForFunction(()=>!document.getElementById('dlWorkspaceLoading'),{timeout:8000});
  const signIn=async(who,cal)=>{await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},who);
   await page.waitForFunction(t=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent===t),{timeout:8000},cal);await waitIdle();await sleep(900)};
  const signOut=async()=>{await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(500)};
  const rows=()=>page.evaluate(()=>[...document.querySelectorAll('#sidebar .side-row')].map(b=>b.getAttribute('title')));
  const bellItems=async()=>{await page.click('.dl-notif-btn');await page.waitForSelector('.dl-notif-panel');await sleep(500);const r=await page.evaluate(()=>[...document.querySelectorAll('.dl-notif-item')].map(i=>i.textContent));await page.keyboard.press('Escape');await sleep(350);return r};
  await signOut();

  // ---- the test account
  await signIn(TEST,'Test calendar');
  let r=await rows();
  check(T('sidebar order ends Documentation, Support ticket, Settings (no Admin for a normal account)'),JSON.stringify(r.slice(-3))==='["Documentation","Support ticket","Settings"]'&&!r.includes('Admin'),JSON.stringify(r));
  check(T('Documentation does nothing (no link yet) and looks like the other rows'),await page.evaluate(()=>{const b=document.querySelector('[data-support-row="docs"]');const s=document.querySelector('[data-support-row="ticket"]');const before=location.href;b.click();return location.href===before&&getComputedStyle(b).height===getComputedStyle(s).height&&!document.querySelector('.backdrop')}));
  await page.evaluate(()=>document.querySelector('[data-support-row="ticket"]').click());
  await page.waitForSelector('.dl-ticket');await sleep(400);
  const pre=await page.evaluate(()=>({name:document.querySelector('#stName').value,email:document.querySelector('#stEmail').value,dis:document.querySelector('[data-go]').disabled,title:document.querySelector('.dialog-title').textContent}));
  check(T('the popup prefills name and email and Send is disabled while empty'),pre.name==='Test Account'&&pre.email==='user@daylightcal.com'&&pre.dis===true&&pre.title==='Support ticket',JSON.stringify(pre));
  await page.screenshot({path:path.join(out,`1-ticket-popup-${theme}.png`)});
  await page.type('#stSubject','Sync question');
  await page.type('#stMessage','My calendar looks different on my phone.');
  check(T('Send enables once everything is filled'),await page.evaluate(()=>!document.querySelector('[data-go]').disabled));
  await page.click('[data-go]');await page.waitForSelector('.dl-tk-ok');await sleep(300);
  await page.screenshot({path:path.join(out,`2-ticket-sent-${theme}.png`)});
  check(T('success state shown'),await page.evaluate(()=>/Request sent/.test(document.querySelector('.dl-tk-ok').textContent)));
  await page.click('[data-done]');await sleep(400);
  await page.evaluate(()=>document.querySelector('[data-support-row="ticket"]').click());
  await page.waitForSelector('.dl-chat');await sleep(500);
  const win=await page.evaluate(()=>({title:document.querySelector('.dl-page-title').textContent,msgs:[...document.querySelectorAll('.dl-msg-text')].map(n=>n.textContent),hasNew:!![...document.querySelectorAll('.dl-page-head button')].find(b=>b.textContent==='New ticket'),sidebar:!!document.querySelector('#sidebar .side-row.active')}));
  check(T('with an open ticket the row opens the Support window showing the chat'),win.title==='Support'&&win.msgs[0]==='My calendar looks different on my phone.'&&win.hasNew&&win.sidebar,JSON.stringify(win));
  await page.screenshot({path:path.join(out,`3-support-window-${theme}.png`)});
  await page.evaluate(()=>localStorage.setItem('__spState',JSON.stringify(window.__sp)));
  await page.evaluate(()=>localStorage.setItem('__bcState',JSON.stringify(window.__bc)));
  await signOut();

  // ---- the owner
  await signIn(OWNER,'Owner calendar');
  r=await rows();
  check(T('the owner sees Admin, Documentation, Support ticket, Settings in that order'),JSON.stringify(r.slice(-4))==='["Admin","Documentation","Support ticket","Settings"]',JSON.stringify(r));
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(500);
  check(T('Admin is no longer inside Settings'),await page.evaluate(()=>![...document.querySelectorAll('.settings-rail .sr-item')].some(b=>/admin/i.test(b.textContent))));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);
  await page.evaluate(()=>document.querySelector('[data-support-row="admin"]').click());
  await page.waitForSelector('.dl-tabs');await sleep(500);
  const tabs=await page.evaluate(()=>({tabs:[...document.querySelectorAll('.dl-tabs [data-tab]')].map(b=>b.textContent.trim()),dot:!!document.querySelector('.dl-tabs .dl-tab-dot'),groups:[...document.querySelectorAll('.dl-page [data-panel="notifications"] .set-group-title,.dl-page [data-panel="banners"] .set-group-title')].map(n=>n.textContent.trim())}));
  check(T('Admin page: Notifications, Banners, Support tabs; old features present; unread dot on Support'),tabs.tabs.join()==='Notifications,Banners,Support'&&tabs.dot&&tabs.groups.length===4,JSON.stringify(tabs));
  await page.screenshot({path:path.join(out,`4-admin-notifications-${theme}.png`)});
  await page.click('.dl-tabs [data-tab="support"]');await page.waitForSelector('.dl-tk-row');await sleep(600);
  const ad=await page.evaluate(()=>({rows:document.querySelectorAll('.dl-tk-row').length,who:document.querySelector('.dl-tk-who').textContent,unread:!!document.querySelector('.dl-tk-unread')}));
  check(T('the ticket is listed with the person and opens in the chat'),ad.rows===1&&ad.who==='Test Account',JSON.stringify(ad));
  await page.screenshot({path:path.join(out,`5-admin-support-${theme}.png`)});
  await page.type('.dl-chat-compose textarea','We are looking into it.');
  await page.click('.dl-chat-compose .btn-primary');
  await page.waitForSelector('.dl-typing',{timeout:2000}).then(()=>check(T('typing dots show while a reply sends'),true),()=>check(T('typing dots show while a reply sends'),false));
  await page.screenshot({path:path.join(out,`6-typing-${theme}.png`)});
  await page.waitForFunction(()=>!document.querySelector('.dl-typing')&&document.querySelectorAll('.dl-msg').length===2,{timeout:4000});
  check(T('the reply appears as Daylight Support in the thread'),await page.evaluate(()=>[...document.querySelectorAll('.dl-msg-name')].some(n=>/Daylight Support/.test(n.textContent))));
  const ownerBell=await bellItems();
  check(T('the owner gets NO notification from replying'),!ownerBell.some(x=>/Daylight Support/.test(x)),JSON.stringify(ownerBell));
  await page.evaluate(()=>localStorage.setItem('__spState',JSON.stringify(window.__sp)));
  await page.evaluate(()=>localStorage.setItem('__bcState',JSON.stringify(window.__bc)));
  await signOut();

  // ---- the person sees the reply
  await signIn(TEST,'Test calendar');
  const bell=await bellItems();
  check(T('the person has exactly one new notification, from Daylight Support'),bell.length===1&&/Daylight Support/.test(bell[0]),JSON.stringify(bell));
  await page.click('.dl-notif-btn');await page.waitForSelector('.dl-notif-item');await sleep(500);
  await page.click('.dl-notif-item');await page.waitForSelector('.dl-chat');await sleep(700);
  check(T('clicking the notification opens the Support window'),await page.evaluate(()=>document.querySelector('.dl-page-title').textContent==='Support'&&!document.querySelector('.dl-notif-panel')));
  check(T('their Support window shows the reply'),await page.evaluate(()=>[...document.querySelectorAll('.dl-msg-text')].some(n=>n.textContent==='We are looking into it.')));
  await page.screenshot({path:path.join(out,`7-person-reply-${theme}.png`)});
  await page.type('.dl-chat-compose textarea','Thanks, that fixed it.');await page.click('.dl-chat-compose .btn-primary');
  await page.waitForFunction(()=>document.querySelectorAll('.dl-msg').length===3,{timeout:4000});
  check(T('the person can reply in their own window'),await page.evaluate(()=>[...document.querySelectorAll('.dl-msg-text')].pop().textContent==='Thanks, that fixed it.'));
  await page.screenshot({path:path.join(out,`8-person-replied-${theme}.png`)});
  await page.evaluate(()=>localStorage.setItem('__spState',JSON.stringify(window.__sp)));
  await page.evaluate(()=>{[...document.querySelectorAll('.dl-page-head button')].find(b=>b.textContent==='New ticket').click()});
  await page.waitForSelector('.dl-ticket');
  check(T('New ticket works from inside the Support window'),true);
  await page.keyboard.press('Escape');await sleep(400);
  await page.evaluate(()=>document.querySelector('#sidebar .side-row[title="Calendar"]').click());await sleep(500);
  check(T('Calendar returns from the Support window'),await page.evaluate(()=>!!document.querySelector('.month-grid,.grid-month,#viewWrap .day-cell')));
  await signOut();
  // ---- the owner sees the person's reply and closes the ticket
  await signIn(OWNER,'Owner calendar');
  await page.evaluate(()=>document.querySelector('[data-support-row="admin"]').click());await page.waitForSelector('.dl-tabs');await sleep(400);
  await page.click('.dl-tabs [data-tab="support"]');await page.waitForSelector('.dl-tk-row');await sleep(600);
  check(T('the owner thread shows the person reply'),await page.evaluate(()=>[...document.querySelectorAll('.dl-msg-text')].some(n=>n.textContent==='Thanks, that fixed it.')));
  await page.screenshot({path:path.join(out,`9-owner-sees-reply-${theme}.png`)});
  await page.evaluate(()=>{[...document.querySelectorAll('.dl-chat-head button')].find(b=>b.textContent==='Close ticket').click()});await sleep(700);
  check(T('Close ticket closes it (state shown plainly, Reopen offered)'),await page.evaluate(()=>/Closed/.test(document.querySelector('.dl-chat-title span').textContent)&&!!([...document.querySelectorAll('.dl-chat-head button')].find(b=>b.textContent==='Reopen'))));
  await page.screenshot({path:path.join(out,`10-ticket-closed-${theme}.png`)});
  await signOut();
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('support FAILED');process.exit(1)}
console.log('PASS support');
