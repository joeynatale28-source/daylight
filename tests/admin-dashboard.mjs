/**
 * Items 2, 3, 4 and 8b on the real page, both themes. Two accounts at the client boundary: the OWNER and the TEST account.
 *  - Admin dashboard: only the owner has the entry (last in Settings); nobody has a composer in the bell;
 *  - targeted notification: reaches only the named account; unmatched emails are named back and nothing is sent to them;
 *  - everyone notification: reaches both (the sender's own bell included, and badge and panel agree);
 *  - official row = the invite-card anatomy: logo avatar for the theme, bold "Daylight" + verified badge ("Official Account" tooltip), title line, message line, time; no footer text;
 *  - per-user clear: stays cleared after a reload for that account only; force remove empties it for everybody;
 *  - banners: color, no dismiss control, link opens in a new tab, targeted ones only for the named account, newest first,
 *    removing takes them off everyone, and the app keeps fitting under them.
 * Database-level enforcement is proven separately in tests/admin-sql.mjs (real Postgres). LIVE_URL runs this on the deployed page.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','admin');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const OWNER={id:'00000000-0000-4000-8000-0000000000aa',email:'owner@example.com',user_metadata:{full_name:'Owner Account'}};
const TEST={id:'00000000-0000-4000-8000-0000000000bb',email:'user@daylightcal.com',user_metadata:{full_name:'Test Account'}};
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
  },OWNER,TEST,payload('Owner calendar'),payload('Test calendar'));
  await app.load();
  const waitIdle=()=>page.waitForFunction(()=>!document.getElementById('dlWorkspaceLoading'),{timeout:8000});
  const signIn=async(who,cal)=>{await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},who);
   await page.waitForFunction(t=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent===t),{timeout:8000},cal);await waitIdle();await sleep(800)};
  const signOut=async()=>{await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(400)};
  const persist=()=>page.evaluate(()=>localStorage.setItem('__bcState',JSON.stringify(window.__bc)));
  const bell=()=>page.evaluate(()=>{const b=document.querySelector('.dl-notif-btn');const g=b&&b.querySelector('.dl-notif-badge');return {badge:g&&!g.hidden?g.textContent:'',label:b&&b.getAttribute('aria-label')}});
  const openBell=async()=>{await page.click('.dl-notif-btn');await page.waitForSelector('.dl-notif-panel');await sleep(550)};
  const closeBell=async()=>{await page.keyboard.press('Escape');await sleep(350)};
  const panelInfo=()=>page.evaluate(()=>({items:[...document.querySelectorAll('.dl-notif-item')].map(i=>i.querySelector('.dl-notif-msg').textContent),empty:getComputedStyle(document.querySelector('.dl-notif-empty')).display!=='none',composer:!!document.querySelector('.dl-notif-send,.dl-notif-foot')}));
  const railItems=()=>page.evaluate(()=>[...document.querySelectorAll('.settings-rail .sr-item')].map(b=>b.textContent.trim()));
  const openSettings=async sec=>{await page.evaluate(s=>openSettings(s),sec);await page.waitForSelector('.settings-dialog');await sleep(600)};
  const closeSettings=async()=>{await page.evaluate(()=>document.querySelector('.settings-close')?.click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});await sleep(300)};
  const openAdmin=async()=>{await openSettings('profile');await page.waitForFunction(()=>document.querySelector('.settings-rail [data-admin]'),{timeout:6000});await page.click('.settings-rail [data-admin]');await page.waitForSelector('#adTitle');await sleep(600)};
  const group=i=>`.settings-pane .set-group:nth-of-type(${i})`;
  const status=i=>page.evaluate(i=>(document.querySelectorAll('.settings-pane .set-group')[i].querySelector('[data-status]')||{}).innerText||'',i);
  const sendNote=async(title,body,emails)=>{
   await page.$eval('#adTitle',n=>{n.value='';});await page.$eval('#adBody',n=>{n.value='';});
   await page.type('#adTitle',title);await page.type('#adBody',body);
   if(emails){await page.evaluate(()=>document.querySelectorAll('.settings-pane .set-group')[0].querySelector('[data-aud="specific"]').click());await page.$eval('.settings-pane .set-group [data-emails]',n=>{n.value=''});await page.type('.settings-pane .set-group [data-emails]',emails)}
   else await page.evaluate(()=>document.querySelectorAll('.settings-pane .set-group')[0].querySelector('[data-aud="everyone"]').click());
   await page.evaluate(()=>document.querySelectorAll('.settings-pane .set-group')[0].querySelector('[data-send]').click());await sleep(700)};

  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);

  // ---- the test account: no admin entry, no composer anywhere
  await signIn(TEST,'Test calendar');
  await openSettings('profile');
  let rail=await railItems();
  check(T('the test account has no "Admin dashboard" entry'),!rail.some(x=>/admin/i.test(x))&&rail[rail.length-1]==='Shortcuts',JSON.stringify(rail));
  await page.screenshot({path:path.join(out,`1-test-settings-no-admin-${theme}.png`)});
  await closeSettings();
  await openBell();let pi=await panelInfo();
  check(T('the test account has no composer in the bell'),!pi.composer&&pi.empty,JSON.stringify(pi));
  await closeBell();await signOut();

  // ---- the owner: the entry is last; no composer in the bell
  await signIn(OWNER,'Owner calendar');
  await openSettings('profile');
  await page.waitForFunction(()=>document.querySelector('.settings-rail [data-admin]'),{timeout:6000});
  rail=await railItems();
  check(T('the owner has "Admin dashboard" as the very last entry'),rail[rail.length-1]==='Admin dashboard'&&rail.length===7,JSON.stringify(rail));
  await page.screenshot({path:path.join(out,`2-owner-settings-with-admin-${theme}.png`)});
  await closeSettings();
  await openBell();pi=await panelInfo();
  check(T('the owner has no composer in the bell either (sending lives in the dashboard)'),!pi.composer,JSON.stringify(pi));
  // a stale unread dot (as left by a cached header) never outlives the real list
  await page.evaluate(()=>{const b=document.querySelector('.dl-notif-btn');const s=document.createElement('span');s.className='dl-notif-badge';s.textContent='1';b.appendChild(s)});
  await closeBell();await page.evaluate(()=>daylightNotifications.refresh());await sleep(500);
  check(T('a stale unread dot is removed when the list says there is nothing unread'),(await bell()).badge==='');

  await openAdmin();
  await page.screenshot({path:path.join(out,`3-dashboard-${theme}.png`)});
  const dash=await page.evaluate(()=>({titles:[...document.querySelectorAll('.settings-pane .set-group-title')].map(n=>n.textContent.trim()),h2:document.querySelector('.settings-pane h2').textContent}));
  check(T('the dashboard has Send notification, Banner and the Manage lists, styled like Settings'),dash.h2==='Admin dashboard'&&JSON.stringify(dash.titles)==='["Send notification","Banner","Notifications sent","Active banners"]',JSON.stringify(dash));

  // ---- targeted notification
  await sendNote('Just for you','Hello test account','user@daylightcal.com');
  let st=await status(0);
  check(T('a targeted send says who it went to'),/sent to user@daylightcal\.com/i.test(st),st);
  await sendNote('Ghost message','Nobody home','made.up@nowhere.example');
  st=await status(0);
  check(T('a made-up email is named back as not found and nothing is sent'),/nothing was sent/i.test(st)&&/made\.up@nowhere\.example/.test(st)&&await page.evaluate(()=>!window.__bc.items.some(i=>i.title==='Ghost message')),st);
  await sendNote('Mixed audience','One real, one fake','user@daylightcal.com, ghost@nowhere.example');
  st=await status(0);
  check(T('a mixed list is sent to the real account and names the one not found'),/not found/i.test(st)&&/ghost@nowhere\.example/.test(st)&&await page.evaluate(()=>window.__bc.items.filter(i=>i.title==='Mixed audience').length===1),st);
  await page.screenshot({path:path.join(out,`4-dashboard-sent-${theme}.png`)});
  await sendNote('For everyone','Everybody gets this one',null);
  st=await status(0);
  check(T('an everyone send is reported'),/sent to everyone/i.test(st),st);
  const manage=await page.evaluate(()=>[...document.querySelectorAll('.settings-pane .dl-ad-item-title')].map(n=>n.textContent));
  check(T('Manage lists what was sent (newest first) with Force remove on each'),manage[0]==='For everyone'&&manage.includes('Just for you')&&(await page.$$('.settings-pane [data-force]')).length===3,JSON.stringify(manage));
  await page.screenshot({path:path.join(out,`5-dashboard-manage-${theme}.png`)});
  await closeSettings();
  await page.evaluate(()=>daylightNotifications.refresh());await sleep(500);
  check(T('the sender\'s own bell shows the everyone notification and the badge matches (1)'),(await bell()).badge==='1');
  await openBell();pi=await panelInfo();
  check(T('the owner\'s panel lists it, and not the ones addressed to someone else'),pi.items.length===1&&pi.items[0]==='For everyone'&&!pi.empty,JSON.stringify(pi));
  await closeBell();
  await persist();await signOut();

  // ---- the test account receives; polished row
  await signIn(TEST,'Test calendar');await sleep(500);
  check(T('the test account\'s bell badge counts the 3 it was sent'),(await bell()).badge==='3',JSON.stringify(await bell()));
  await openBell();pi=await panelInfo();
  check(T('the test account sees the targeted ones and the everyone one'),pi.items.length===3&&['Just for you','Mixed audience','For everyone'].every(t=>pi.items.includes(t)),JSON.stringify(pi));
  check(T('the ghost message reached nobody'),!pi.items.includes('Ghost message'));
  const row=await page.evaluate(()=>{const r=[...document.querySelectorAll('.dl-notif-item')].find(i=>i.querySelector('.dl-notif-msg').textContent==='Just for you');
   const imgs=[...r.querySelectorAll('.dl-notif-avatar img')].filter(i=>getComputedStyle(i).display!=='none');
   const badge=r.querySelector('.dl-verified'),from=r.querySelector('.dl-notif-from');
   return {logo:imgs.map(i=>i.getAttribute('src')),from:from.firstChild.textContent,fromWeight:getComputedStyle(from).fontWeight,hasBadge:!!badge,tip:badge&&badge.getAttribute('data-tip'),badgeAfterName:!!badge&&badge.parentElement===from,title:r.querySelector('.dl-notif-msg').textContent,msg:r.querySelector('.dl-notif-sub').textContent,time:r.querySelector('.dl-notif-time').textContent,
    footer:!!r.querySelector('.dl-notif-official')&&getComputedStyle(r.querySelector('.dl-notif-official')).display!=='none'||/Official Daylight notification/i.test(r.innerText),avatarBox:(()=>{const a=r.querySelector('.dl-notif-avatar').getBoundingClientRect();return [Math.round(a.width),Math.round(a.height)]})(),
    order:[...r.querySelector('.dl-notif-main').children].map(c=>c.className),unread:r.classList.contains('is-unread')}});
  const wantLogo=theme==='dark'?'./assets/daylight-sunarc-dark-NOBG.png':'./assets/daylight-sunarc-light-NOBG.png';
  check(T('the avatar is the daylight sun-arc for this theme (white in dark, black in light), nothing else'),row.logo.length===1&&row.logo[0]===wantLogo,JSON.stringify(row.logo));
  check(T('sender "Daylight" in bold with the verified badge right after the name, then the title line, the message line and the time'),row.from==='Daylight'&&Number(row.fromWeight)>=600&&row.hasBadge&&row.badgeAfterName&&row.title==='Just for you'&&row.msg==='Hello test account'&&!!row.time,JSON.stringify(row));
  check(T('the tiny footer text is gone: the badge is the only official marker'),!row.footer&&row.tip==='Official Account',JSON.stringify(row));
  check(T('the avatar sits in the same 36px circle a person photo does'),row.avatarBox[0]===36&&row.avatarBox[1]===36,JSON.stringify(row.avatarBox));
  await page.hover('.dl-notif-item .dl-verified');await sleep(300);
  check(T('hovering the badge shows the tooltip "Official Account"'),await page.evaluate(()=>{const b=document.querySelector('.dl-notif-item .dl-verified');return getComputedStyle(b,'::after').content.replace(/\"/g,'')==='Official Account'&&parseFloat(getComputedStyle(b,'::after').opacity)>0.9}));
  await page.screenshot({path:path.join(out,`6c-badge-tooltip-${theme}.png`),clip:{x:1000,y:40,width:430,height:460},captureBeyondViewport:false});
  await page.mouse.move(10,10);await sleep(200);
  await page.screenshot({path:path.join(out,`6-test-polished-${theme}.png`)});
  await page.screenshot({path:path.join(out,`6b-test-polished-crop-${theme}.png`),clip:{x:1000,y:40,width:430,height:460},captureBeyondViewport:false});
  // per-user clear
  await page.evaluate(()=>{[...document.querySelectorAll('.dl-notif-item')].find(i=>i.querySelector('.dl-notif-msg').textContent==='For everyone').querySelector('.dl-notif-clear').click()});await sleep(700);
  pi=await panelInfo();
  check(T('clearing removes it from this account\'s list'),!pi.items.includes('For everyone')&&pi.items.length===2,JSON.stringify(pi));
  check(T('and it no longer counts as unread'),(await bell()).badge==='');
  await closeBell();await persist();
  await page.reload();await page.waitForFunction(()=>window.__authCb,{timeout:8000});await sleep(500);
  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);
  await signIn(TEST,'Test calendar');await openBell();pi=await panelInfo();
  check(T('after a reload it is still cleared for the test account'),!pi.items.includes('For everyone')&&pi.items.length===2,JSON.stringify(pi));
  await page.screenshot({path:path.join(out,`7-test-after-clear-reload-${theme}.png`)});
  await closeBell();await signOut();
  await signIn(OWNER,'Owner calendar');await openBell();pi=await panelInfo();
  check(T('the owner still has their copy'),pi.items.includes('For everyone'),JSON.stringify(pi));
  await closeBell();

  // ---- force remove
  await openAdmin();
  await page.evaluate(()=>{[...document.querySelectorAll('.settings-pane .dl-ad-item')].find(i=>/For everyone/.test(i.textContent)).querySelector('[data-force]').click()});
  await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(800);
  check(T('force remove takes it out of the owner\'s Manage list and the data'),await page.evaluate(()=>!window.__bc.items.some(i=>i.title==='For everyone')&&![...document.querySelectorAll('.dl-ad-item-title')].some(n=>n.textContent==='For everyone')));
  await closeSettings();await persist();await signOut();
  await signIn(TEST,'Test calendar');await openBell();pi=await panelInfo();
  check(T('and it is gone for the test account as well'),!pi.items.includes('For everyone'));
  await closeBell();await signOut();

  // ---- banners
  await signIn(OWNER,'Owner calendar');
  await openAdmin();
  await page.evaluate(()=>document.querySelectorAll('.settings-pane .set-group')[1].scrollIntoView());
  await page.type('#adBanner','Scheduled maintenance tonight at 10pm Eastern');
  await page.click('.settings-pane .dl-ad-swatches .dl-sw:nth-child(4)');
  const picked=await page.$eval('.settings-pane .dl-ad-swatches .dl-sw[aria-pressed="true"]',b=>b.getAttribute('title'));
  await page.type('#adLink','https://example.com/status');
  await page.screenshot({path:path.join(out,`8-banner-form-${theme}.png`)});
  await page.evaluate(()=>document.querySelectorAll('.settings-pane .set-group')[1].querySelector('[data-post]').click());await sleep(800);
  check(T('the owner posted an everyone banner in the chosen color'),await page.evaluate(h=>window.__bc.banners.some(b=>b.color===h&&b.audience==='everyone'&&b.link==='https://example.com/status'),picked),picked);
  await page.type('#adBanner','Only for the test account');
  await page.evaluate(()=>document.querySelectorAll('.settings-pane .set-group')[1].querySelector('[data-aud="specific"]').click());
  await page.type('.settings-pane .set-group:nth-of-type(2) [data-emails]','user@daylightcal.com');
  await page.evaluate(()=>document.querySelectorAll('.settings-pane .set-group')[1].querySelector('[data-post]').click());await sleep(800);
  await closeSettings();await page.evaluate(()=>daylightBanners.refresh());await sleep(600);
  const ob=await page.evaluate(()=>[...document.querySelectorAll('#dlBanners .dl-banner')].map(b=>b.textContent));
  check(T('the owner sees only the everyone banner (the other is addressed to the test account)'),JSON.stringify(ob)==='["Scheduled maintenance tonight at 10pm Eastern"]',JSON.stringify(ob));
  await persist();await signOut();

  await signIn(TEST,'Test calendar');await page.evaluate(()=>daylightBanners.refresh());await sleep(700);
  const tb=await page.evaluate(()=>{const els=[...document.querySelectorAll('#dlBanners .dl-banner')];const app=document.getElementById('app').getBoundingClientRect(),h=document.getElementById('dlBanners').getBoundingClientRect();
   return {texts:els.map(e=>e.textContent),colors:els.map(e=>getComputedStyle(e).backgroundColor),top:Math.round(h.top),bannerBottom:Math.round(h.bottom),appTop:Math.round(app.top),appBottom:Math.round(app.bottom),vh:innerHeight,
    controls:els.map(e=>e.querySelectorAll('button,[role=button],.close,[aria-label*=ismiss],[aria-label*=lose]').length).reduce((a,b)=>a+b,0),link:(els[1]&&els[1].querySelector('a'))?{href:els[1].querySelector('a').href,target:els[1].querySelector('a').target,rel:els[1].querySelector('a').rel}:null,textColor:els.map(e=>getComputedStyle(e).color)}});
  check(T('the test account sees both banners, newest first, stacked at the very top'),JSON.stringify(tb.texts)==='["Only for the test account","Scheduled maintenance tonight at 10pm Eastern"]'&&tb.top===0,JSON.stringify(tb));
  const hexToRgb=h=>{const m=/^#(..)(..)(..)$/.exec(h);return `rgb(${parseInt(m[1],16)}, ${parseInt(m[2],16)}, ${parseInt(m[3],16)})`};
  check(T('the banner is in the picked color, with readable text'),tb.colors[1]===hexToRgb(picked)&&tb.textColor[1]!==tb.colors[1],JSON.stringify({c:tb.colors,want:hexToRgb(picked),t:tb.textColor}));
  check(T('there is no dismiss control on any banner'),tb.controls===0&&!await page.$('#dlBanners button'),String(tb.controls));
  check(T('the linked banner\'s text is a link that opens in a new tab'),tb.link&&tb.link.href==='https://example.com/status'&&tb.link.target==='_blank'&&/noopener/.test(tb.link.rel),JSON.stringify(tb.link));
  check(T('the app sits right under the banners and still fits the window'),tb.appTop===tb.bannerBottom&&tb.appBottom<=tb.vh+1,JSON.stringify(tb));
  const fits=await page.evaluate(()=>{const g=document.querySelector('.month-grid');if(!g)return null;g.scrollTop=g.scrollHeight;const rows=[...g.querySelectorAll('.month-week')];return {rows:rows.length,lastBottom:Math.round(rows[rows.length-1].getBoundingClientRect().bottom),gridBottom:Math.round(g.getBoundingClientRect().bottom),vh:innerHeight}});
  check(T('the month view still shows all six rows under the banners'),fits&&fits.rows===6&&fits.lastBottom<=fits.gridBottom+1&&fits.lastBottom<=fits.vh+1,JSON.stringify(fits));
  await page.screenshot({path:path.join(out,`9-test-banners-${theme}.png`)});
  await page.keyboard.press('Escape');await page.mouse.click(700,300);await sleep(300);
  check(T('Esc and clicking elsewhere do not dismiss them'),(await page.$$('#dlBanners .dl-banner')).length===2);
  // phone width
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await sleep(600);
  const ph=await page.evaluate(()=>{const h=document.getElementById('dlBanners').getBoundingClientRect(),a=document.getElementById('app').getBoundingClientRect();return {bannerH:Math.round(h.height),overflow:document.documentElement.scrollWidth>innerWidth+1,appBottom:Math.round(a.bottom),vh:innerHeight}});
  check(T('on a phone the banners wrap, nothing scrolls sideways and the app still fits'),!ph.overflow&&ph.appBottom<=ph.vh+1,JSON.stringify(ph));
  await page.screenshot({path:path.join(out,`10-banners-phone-${theme}.png`)});
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});await sleep(400);
  await signOut();

  // ---- remove banners
  await signIn(OWNER,'Owner calendar');await openAdmin();
  await page.evaluate(()=>{[...document.querySelectorAll('.settings-pane .dl-ad-item')].filter(i=>i.querySelector('[data-remove]')).forEach(()=>{})});
  for(let i=0;i<2;i++){
   await page.evaluate(()=>{document.querySelector('.settings-pane [data-remove]').click()});
   await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(800);
  }
  check(T('both banners are removed from the dashboard and the data'),await page.evaluate(()=>window.__bc.banners.length===0&&!document.querySelector('.settings-pane [data-remove]')));
  await closeSettings();await persist();await signOut();
  await signIn(TEST,'Test calendar');await page.evaluate(()=>daylightBanners.refresh());await sleep(600);
  check(T('after removal nothing shows at the top for the test account'),await page.evaluate(()=>document.querySelectorAll('#dlBanners .dl-banner').length===0&&getComputedStyle(document.documentElement).getPropertyValue('--dl-banner-h').trim()==='0px'));
  await page.screenshot({path:path.join(out,`11-test-banners-removed-${theme}.png`)});
  check(T('no page errors during any of it'),errors.length===0,errors.join(' | '));
  await page.evaluate(()=>localStorage.removeItem('__bcState'));
 }finally{await app.close()}
}
if(failed){console.log('admin dashboard FAILED');process.exit(1)}
console.log('PASS admin dashboard');
