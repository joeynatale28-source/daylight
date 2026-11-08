/**
 * Item 1: the Manage dialog (the ⋯ on a calendar) is built like Settings. On the real page, both themes:
 *  - it is the Settings window (same size and radius at every window size), with a left rail and a scrolling pane, content-fit:
 *    nothing clipped, no mini-scrollbars inside, the Danger zone reachable even in a short window;
 *  - owned calendar: Calendar, Sharing, Export, Danger zone; US Holidays: Calendar (color) + Export;
 *    subscribed: Calendar, Source (feed, refresh + last updated), Danger zone (unsubscribe) and each of them works;
 *  - the color layout has no dead slots (whole palette rows, no gap before Your colors).
 * Side-by-side shots with Settings go to ui-screenshots/manage-dialog. (The shared-with-me variant is covered in tests/sharing.mjs;
 * rename / color / Your colors / custom picker / public link / export / delete confirmation in tests/daylight-ui-smoke.mjs.)
 * LIVE_URL=<deployed build> runs this on the deployed page.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','manage-dialog');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const SUB={id:'s1',name:'School feed',url:'https://example.com/school.ics',color:'rose',last_fetched_at:new Date(2026,10,1,9,0).toISOString(),last_error:null,cached_events:[]};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.evaluateOnNewDocument(sub=>{window.__subs=[sub]},SUB);
  await app.load();await sleep(900);
  const openManage=async name=>{await page.evaluate(n=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent===n);row.querySelector('.cal-menu-btn').click()},name);await page.waitForSelector('.dl-manage');await sleep(550)};
  const goSection=async s=>{await page.evaluate(s=>document.querySelector('.dl-manage [data-section="'+s+'"]').click(),s);await sleep(450)};
  const closeManage=async()=>{await page.evaluate(()=>document.querySelector('.dl-manage .settings-close')?.click());await page.waitForFunction(()=>!document.querySelector('.dl-manage'),{timeout:4000});await sleep(300)};
  const settingsBox=async()=>{await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(500);const r=await page.evaluate(()=>{const d=document.querySelector('.settings-dialog');return [d.offsetWidth,d.offsetHeight,getComputedStyle(d).borderRadius]});await page.evaluate(()=>document.querySelector('.settings-close').click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});await sleep(250);return r};
  const nested=()=>page.evaluate(()=>{const d=document.querySelector('.dl-manage');const bad=[];d.querySelectorAll('*').forEach(n=>{if(n.classList.contains('settings-pane'))return;const c=getComputedStyle(n);if(/(auto|scroll)/.test(c.overflowY)&&n.scrollHeight>n.clientHeight+1&&n.clientHeight>0)bad.push(n.className||n.tagName)});return bad});

  // ---- same window as Settings, at many sizes; content-fit with nothing clipped
  for(const [w,h] of [[1920,1080],[1536,730],[1366,768],[1280,800],[1280,560],[1024,768],[390,844]]){
   await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:w<=640,hasTouch:w<=640});await sleep(450);
   const sb=await settingsBox();
   await openManage('Personal');
   const m=await page.evaluate(()=>{const d=document.querySelector('.dl-manage'),r=d.getBoundingClientRect(),pane=d.querySelector('.settings-pane'),pr=pane.getBoundingClientRect();
    return {box:[d.offsetWidth,d.offsetHeight,getComputedStyle(d).borderRadius],inside:r.left>=-0.5&&r.top>=-0.5&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5,rail:[...d.querySelectorAll('.settings-rail .sr-item')].map(n=>n.textContent.trim()),paneScrolls:pane.scrollHeight>pane.clientHeight+1}});
   check(T(`${w}x${h}: same size and radius as Settings, inside the window`),JSON.stringify(m.box)===JSON.stringify(sb)&&m.inside,JSON.stringify({m:m.box,settings:sb,inside:m.inside}));
   check(T(`${w}x${h}: an owned calendar's rail is Calendar, Sharing, Export, Danger zone`),m.rail.join('|')==='Calendar|Sharing|Export|Danger zone',JSON.stringify(m.rail));
   check(T(`${w}x${h}: no mini-scrollbars inside (only the pane scrolls, like Settings)`),(await nested()).length===0,JSON.stringify(await nested()));
   // every section: its last control can be reached by scrolling the pane, nothing is clipped
   for(const sec of ['calendar','sharing','export','danger']){
    await goSection(sec);
    const r=await page.evaluate(()=>{const pane=document.querySelector('.dl-manage .settings-pane');pane.style.scrollBehavior='auto';pane.scrollTop=pane.scrollHeight;const pr=pane.getBoundingClientRect();
     const last=[...pane.querySelectorAll('.set-group')].pop().getBoundingClientRect();return {bottomVisible:last.bottom<=pr.bottom+1,topOk:last.top>=pr.top-1||pane.scrollHeight>pane.clientHeight}});
    check(T(`${w}x${h}: ${sec}: the last group is fully reachable (not clipped)`),r.bottomVisible,JSON.stringify(r));
   }
   if([[1920,1080],[1280,560],[390,844]].some(([a,b])=>a===w&&b===h)){
    await goSection('danger');
    const d=await page.evaluate(()=>{const b=document.querySelector('.dl-manage [data-delete]').getBoundingClientRect(),pr=document.querySelector('.dl-manage .settings-pane').getBoundingClientRect();return {inView:b.top>=pr.top&&b.bottom<=pr.bottom,label:document.querySelector('.dl-manage [data-delete]').textContent}});
    check(T(`${w}x${h}: the Danger zone's Delete calendar is fully visible and reachable`),d.inView&&/Delete calendar/.test(d.label),JSON.stringify(d));
    await page.screenshot({path:path.join(out,`danger-${w}x${h}-${theme}.png`)});
   }
   await closeManage();
  }
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});await sleep(400);

  // ---- the color layout has no dead slots
  await openManage('Personal');
  const col=await page.evaluate(()=>{const sw=[...document.querySelectorAll('[data-presets] .dl-sw')];const rows={};sw.forEach(x=>{const k=Math.round(x.getBoundingClientRect().top);rows[k]=(rows[k]||0)+1});const counts=Object.keys(rows).sort((a,b)=>a-b).map(k=>rows[k]);
   const pr=document.querySelector('[data-presets]').getBoundingClientRect(),yl=[...document.querySelectorAll('.dl-mg-sub')].find(n=>/Your colors/.test(n.textContent)).getBoundingClientRect();return {counts,gap:Math.round(yl.top-pr.bottom)}});
  check(T('the palette fills whole rows and "Your colors" follows without a dead gap'),col.counts.length===3&&Math.max(...col.counts)-Math.min(...col.counts)<=1&&col.gap<=30,JSON.stringify(col));
  await page.screenshot({path:path.join(out,`calendar-${theme}.png`)});
  await closeManage();

  // ---- side by side with Settings (same account, same window)
  await openManage('Personal');
  const box=async sel=>page.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}},sel);
  let b=await box('.dl-manage');
  await page.screenshot({path:path.join(out,`side-manage-${theme}.png`),clip:{x:Math.max(0,b.x-8),y:Math.max(0,b.y-8),width:b.w+16,height:b.h+16},captureBeyondViewport:false});
  await goSection('sharing');await page.screenshot({path:path.join(out,`side-manage-sharing-${theme}.png`),clip:{x:Math.max(0,b.x-8),y:Math.max(0,b.y-8),width:b.w+16,height:b.h+16},captureBeyondViewport:false});
  await closeManage();
  await page.evaluate(()=>openSettings('calendar'));await page.waitForSelector('.settings-dialog');await sleep(550);
  b=await box('.settings-dialog');
  await page.screenshot({path:path.join(out,`side-settings-${theme}.png`),clip:{x:Math.max(0,b.x-8),y:Math.max(0,b.y-8),width:b.w+16,height:b.h+16},captureBeyondViewport:false});
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(400);
  const typo=await (async()=>{await openManage('Personal');const m=await page.evaluate(()=>{const g=n=>getComputedStyle(document.querySelector(n));return {h2:g('.dl-manage .settings-pane h2').fontSize+'/'+g('.dl-manage .settings-pane h2').fontWeight,title:g('.dl-manage .set-group-title').fontSize+'/'+g('.dl-manage .set-group-title').fontWeight,font:g('.dl-manage').fontFamily.slice(0,5)}});await closeManage();
   await page.evaluate(()=>openSettings('calendar'));await page.waitForSelector('.settings-dialog');await sleep(450);const s=await page.evaluate(()=>{const g=n=>getComputedStyle(document.querySelector(n));return {h2:g('.settings-pane h2').fontSize+'/'+g('.settings-pane h2').fontWeight,title:g('.settings-pane .set-group-title').fontSize+'/'+g('.settings-pane .set-group-title').fontWeight,font:g('.settings-dialog').fontFamily.slice(0,5)}});await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(350);return {m,s}})();
  check(T('same typography as Settings (page heading, group labels, Inter)'),JSON.stringify(typo.m)===JSON.stringify(typo.s),JSON.stringify(typo));

  // ---- US Holidays: reduced set
  await openManage('US Holidays');
  const hol=await page.evaluate(()=>({rail:[...document.querySelectorAll('.dl-manage .sr-item')].map(n=>n.textContent.trim()),name:!!document.querySelector('#calSettingsName'),swatches:document.querySelectorAll('[data-presets] .dl-sw').length>0}));
  check(T('US Holidays keeps only colors + Export'),hol.rail.join('|')==='Calendar|Export'&&!hol.name&&hol.swatches,JSON.stringify(hol));
  await goSection('export');check(T('US Holidays Export is a proper button row'),await page.evaluate(()=>!!document.querySelector('.dl-manage [data-export]')));
  await closeManage();

  // ---- subscribed calendar: same dialog, parallel sections, and they work
  await page.waitForFunction(()=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='School feed'),{timeout:8000});
  await openManage('School feed');
  const sub=await page.evaluate(()=>({rail:[...document.querySelectorAll('.dl-manage .sr-item')].map(n=>n.textContent.trim()),name:document.querySelector('#calSettingsName')?.value,swatches:document.querySelectorAll('[data-presets] .dl-sw').length}));
  check(T('a subscribed calendar: Calendar, Source, Danger zone (rename + color override in Calendar)'),sub.rail.join('|')==='Calendar|Source|Danger zone'&&sub.name==='School feed'&&sub.swatches>10,JSON.stringify(sub));
  await page.screenshot({path:path.join(out,`subscribed-calendar-${theme}.png`)});
  await page.click('#calSettingsName',{clickCount:3});await page.type('#calSettingsName','School feed (renamed)');
  await page.evaluate(()=>document.querySelectorAll('[data-presets] .dl-sw')[3].click());await sleep(250);
  await page.click('.dl-manage .settings-savebar [data-save]');await page.waitForFunction(()=>document.querySelector('.dl-manage .settings-savebar')?.hidden,{timeout:5000});await sleep(500);
  const upd=await page.evaluate(()=>({server:window.__subs[0],sidebar:[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='School feed (renamed)')}));
  check(T('subscribed: rename and color override are saved to the subscription'),upd.server.name==='School feed (renamed)'&&upd.server.color!=='rose'&&upd.sidebar,JSON.stringify(upd));
  await goSection('source');
  const src=await page.evaluate(()=>({text:document.querySelector('.settings-pane').innerText.replace(/\s+/g,' '),refresh:!!document.querySelector('[data-refresh]')}));
  check(T('subscribed: Source shows the feed address, last updated, status and Refresh now'),/example\.com\/school\.ics/.test(src.text)&&/Last updated/.test(src.text)&&/Up to date/.test(src.text)&&src.refresh,src.text.slice(0,200));
  await page.screenshot({path:path.join(out,`subscribed-source-${theme}.png`)});
  const was=await page.evaluate(()=>document.querySelector('[data-updated]').textContent);
  await page.click('[data-refresh]');await sleep(1200);
  check(T('subscribed: Refresh now checks the source and updates "last updated"'),await page.evaluate(w=>document.querySelector('[data-updated]').textContent!==w&&/refreshed/i.test(document.querySelector('[data-note]').textContent),was));
  await goSection('danger');
  await page.click('[data-danger]');await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');
  check(T('subscribed: Unsubscribe asks first (nothing removed yet)'),await page.evaluate(()=>window.__subs.length===1));
  await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(1400);
  check(T('subscribed: confirmed, the subscription is removed and its calendar leaves the sidebar'),await page.evaluate(()=>window.__subs.length===0&&![...document.querySelectorAll('.cal-name')].some(n=>/School feed/.test(n.textContent))&&!document.querySelector('.dl-manage')));
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('manage dialog FAILED');process.exit(1)}
console.log('PASS manage dialog');
