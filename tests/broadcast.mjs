/**
 * Item 8 on the real page. Two accounts (stand-ins at the client boundary): the OWNER and an ordinary USER.
 *  - the ordinary user has no composer anywhere and the owner does;
 *  - the owner sends a broadcast; the other account sees an unread badge, the message ("From daylight"), and the badge
 *    clears once the panel has been opened;
 *  - the owner removes it and it disappears for the other account.
 * Database-level enforcement (a non-owner cannot send even by calling the function) is proven separately in
 * tests/notifications-sql.mjs against real Postgres. LIVE_URL runs the page part against a deployed build.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','broadcast');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const OWNER={id:'00000000-0000-4000-8000-0000000000aa',email:'owner@example.com',user_metadata:{full_name:'Owner Account'}};
const USER={id:'00000000-0000-4000-8000-0000000000bb',email:'member@example.com',user_metadata:{full_name:'Member Account'}};
const payload=(cal)=>{const p=busyPayload();p.calendars=[{id:'c9',name:cal,color:'blue'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];p.events=[];return p};
const TITLE='Scheduled maintenance tonight',BODY='daylight may be slow around 10pm Eastern while we update things. Nothing to do on your side.';

for(const theme of ['dark','light']){
 const app=await launch({theme,width:1440,height:900,payload:payload('Owner calendar'),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await page.evaluateOnNewDocument((o,u,po,pu)=>{window.__accounts={[o.id]:{user:o,payload:po},[u.id]:{user:u,payload:pu}};window.__bc={owners:[o.id],items:[],reads:{}}},OWNER,USER,payload('Owner calendar'),payload('Member calendar'));
  await app.load();
  const signIn=async(who,cal)=>{await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},who);
   await page.waitForFunction(t=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent===t),{timeout:8000},cal);await sleep(700)};
  const signOut=async()=>{await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(400)};
  const bell=()=>page.evaluate(()=>{const b=document.querySelector('.dl-notif-btn');const g=b&&b.querySelector('.dl-notif-badge');return {badge:g&&!g.hidden?g.textContent:'',label:b&&b.getAttribute('aria-label')}});
  const openPanel=async()=>{await page.waitForFunction(()=>!document.getElementById('dlWorkspaceLoading'),{timeout:8000});await page.click('.dl-notif-btn');await page.waitForSelector('.dl-notif-panel');await sleep(450)};
  const closePanel=async()=>{await page.keyboard.press('Escape');await sleep(350)};

  // ordinary account first
  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);
  await signIn(USER,'Member calendar');
  check(`${theme}: no badge when nothing was sent`,(await bell()).badge==='');
  await openPanel();
  let panel=await page.evaluate(()=>({text:document.querySelector('.dl-notif-panel').innerText,composer:!!document.querySelector('.dl-notif-send'),empty:!document.querySelector('.dl-notif-empty').hidden}));
  check(`${theme}: empty state shows, and the ordinary account has NO composer`,panel.empty&&!panel.composer&&!/Send notification/i.test(panel.text),JSON.stringify(panel));
  await page.screenshot({path:path.join(out,`1-user-empty-${theme}.png`)});
  await closePanel();await signOut();

  // the owner sends
  await signIn(OWNER,'Owner calendar');
  await openPanel();
  check(`${theme}: the owner sees the composer button`,!!(await page.$('.dl-notif-send')));
  await page.screenshot({path:path.join(out,`2-owner-panel-${theme}.png`)});
  await page.click('.dl-notif-send');await page.waitForSelector('#dlBcTitle');await sleep(350);
  check(`${theme}: Send is disabled until title and message are filled`,await page.$eval('[data-send]',b=>b.disabled));
  await page.type('#dlBcTitle',TITLE);await page.type('#dlBcBody',BODY);await sleep(150);
  check(`${theme}: Send enables once both are filled`,!(await page.$eval('[data-send]',b=>b.disabled)));
  await page.screenshot({path:path.join(out,`3-composer-${theme}.png`)});
  await page.click('[data-send]');
  await page.waitForFunction(()=>!document.querySelector('#dlBcTitle'),{timeout:4000});await sleep(500);
  check(`${theme}: it was sent exactly once`,await page.evaluate(()=>window.__bc.items.length===1&&window.__bc.calls.filter(c=>c==='daylight_send_broadcast').length===1));
  await signOut();

  // another account receives it
  await signIn(USER,'Member calendar');
  await sleep(400);
  let b=await bell();
  check(`${theme}: the other account's bell shows an unread badge of 1`,b.badge==='1'&&/1 unread/.test(b.label),JSON.stringify(b));
  await page.screenshot({path:path.join(out,`4-user-badge-${theme}.png`),clip:{x:1140,y:0,width:300,height:60}});
  await openPanel();
  panel=await page.evaluate(()=>{const i=document.querySelector('.dl-notif-item');return {title:i&&i.querySelector('.dl-notif-title').textContent,msg:i&&i.querySelector('.dl-notif-msg').textContent,from:i&&i.querySelector('.dl-notif-from').textContent,time:i&&i.querySelector('.dl-notif-time').textContent,unread:i&&i.classList.contains('is-unread'),composer:!!document.querySelector('.dl-notif-send'),badge:document.querySelector('.dl-notif-badge')&&!document.querySelector('.dl-notif-badge').hidden}});
  check(`${theme}: the message arrived with its title, text, time and "From daylight"`,panel.title===TITLE&&panel.msg===BODY&&panel.from==='From daylight'&&!!panel.time,JSON.stringify(panel));
  check(`${theme}: the empty state is gone once there is a message`,await page.evaluate(()=>getComputedStyle(document.querySelector('.dl-notif-empty')).display==='none'));
  check(`${theme}: it is highlighted as new while the panel is open, and the badge has cleared`,panel.unread&&!panel.badge,JSON.stringify(panel));
  check(`${theme}: still no composer for the ordinary account`,!panel.composer);
  await page.screenshot({path:path.join(out,`5-user-received-${theme}.png`)});
  await closePanel();
  await openPanel();
  check(`${theme}: reopened, it is read (no highlight)`,await page.evaluate(()=>!document.querySelector('.dl-notif-item').classList.contains('is-unread')));
  await closePanel();await signOut();

  // the owner removes it
  await signIn(OWNER,'Owner calendar');
  await openPanel();await page.click('.dl-notif-send');await page.waitForSelector('#dlBcTitle');await sleep(350);
  check(`${theme}: the owner's Sent list shows it`,await page.evaluate(t=>[...document.querySelectorAll('.dl-bc-sent-text b')].some(n=>n.textContent===t),TITLE));
  await page.click('.dl-bc-sent .btn-ghost');await sleep(500);
  check(`${theme}: removing it empties the list`,await page.evaluate(()=>window.__bc.items.length===0&&!document.querySelector('.dl-bc-sent')));
  await page.keyboard.press('Escape');await sleep(300);
  await signOut();await signIn(USER,'Member calendar');await openPanel();
  check(`${theme}: the other account no longer sees it`,await page.evaluate(()=>!document.querySelector('.dl-notif-item')&&!document.querySelector('.dl-notif-empty').hidden));
  await page.screenshot({path:path.join(out,`6-user-after-remove-${theme}.png`)});
 }finally{await app.close()}
}
if(failed){console.log('broadcast FAILED');process.exit(1)}
console.log('PASS broadcast');
