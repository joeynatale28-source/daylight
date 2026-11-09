/**
 * Item 3: the calendar Manage dialog (the ⋯ on a calendar) is ONE single-column Daylight dialog. On the real page, both themes:
 *  - one centered dialog about 480px wide (never wider than the window), NO left rail, NO tabs; sections stack in one scroll;
 *    a slim footer with Done stays visible; the same window language as Settings (radius, border, typography);
 *  - owned calendar order: Calendar (name + color) -> Sharing -> Export -> Danger zone (Delete calendar LAST in the same scroll);
 *    US Holidays: Calendar (color) + Export; subscribed: Calendar -> Source -> Danger zone (Unsubscribe last);
 *  - nothing clipped, no mini-scrollbars other than the one column scroll, Delete reachable even in a short window;
 *  - the color layout has no dead slots; Done does nothing while the Save pill is showing (the pill is the only gate);
 *  - every other calendar popup (Add to Subscriptions chooser, New calendar, confirmations) shares the same shell width/radius.
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
  const openManage=async name=>{await page.evaluate(n=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent===n);row.querySelector('.cal-menu-btn').click()},name);await page.waitForSelector('.dl-manage');await sleep(450)};
  const closeManage=async()=>{await page.evaluate(()=>document.querySelector('.dl-manage .settings-close')?.click());await page.waitForFunction(()=>!document.querySelector('.dl-manage'),{timeout:4000});await sleep(300)};
  const refLook=async()=>{await page.evaluate(()=>{state.section='calendar';renderAll(false);openEventForm(null,state.selected)});await page.waitForSelector('.event-form-dialog');await sleep(500);
   const ev=await page.evaluate(()=>{const d=document.querySelector('.event-form-dialog'),cs=getComputedStyle(d),h=getComputedStyle(d.querySelector('.dialog-head')),ti=getComputedStyle(d.querySelector('.dialog-title')),f=getComputedStyle(d.querySelector('.dialog-foot'));return {radius:cs.borderRadius,bg:cs.backgroundColor,font:cs.fontFamily.split(',')[0],headBg:h.backgroundColor,headBorder:h.borderBottomWidth,title:ti.fontSize+'/'+ti.fontWeight,footBorder:f.borderTopWidth,footPad:f.padding,backdrop:getComputedStyle(document.querySelector('#overlayRoot > .backdrop')).backgroundColor}});
   await page.evaluate(()=>document.querySelector('.event-form-dialog [data-x]').click());await sleep(400);
   await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(500);
   const st=await page.evaluate(()=>{const t=getComputedStyle(document.querySelector('.settings-pane .set-group-title')),g=getComputedStyle(document.querySelector('.set-group'));return {title:t.fontSize+'/'+t.fontWeight+'/'+t.textTransform,card:g.borderRadius}});
   await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(400);return {ev,st}};
  const nested=()=>page.evaluate(()=>{const d=document.querySelector('.dl-manage');const bad=[];d.querySelectorAll('*').forEach(n=>{if(n.classList.contains('dl-col-body'))return;const c=getComputedStyle(n);if(/(auto|scroll)/.test(c.overflowY)&&n.scrollHeight>n.clientHeight+2&&n.clientHeight>0)bad.push(n.className.toString().slice(0,40))});return bad});

  // ---- one column at many window sizes; content-fit, nothing clipped, Danger zone reachable
  for(const [w,h] of [[1920,1080],[1536,730],[1366,768],[1280,800],[1280,560],[1024,768],[390,844]]){
   await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:w<=640,hasTouch:w<=640});await sleep(450);
   await openManage('Personal');
   const m=await page.evaluate(()=>{const d=document.querySelector('.dl-manage'),r=d.getBoundingClientRect(),body=d.querySelector('.dl-col-body'),foot=d.querySelector('.dl-col .dialog-foot').getBoundingClientRect();
    return {w:Math.round(r.width),inside:r.left>=-0.5&&r.top>=-0.5&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5,rail:!!d.querySelector('.settings-rail,.sr-item'),tabs:!!d.querySelector('[role=tab],[role=tablist]'),
     heads:[...d.querySelectorAll('.dl-col-h,.dl-col-body .set-group-title')].map(n=>n.textContent.trim()),doneVisible:foot.bottom<=r.bottom+0.5&&foot.top>=r.top&&!!d.querySelector('[data-done]'),
     scrolls:body.scrollHeight>body.clientHeight+1,h:Math.round(r.height)}});
   check(T(`${w}x${h}: one centered column no wider than 480px, inside the window`),m.w<=480&&m.w>=Math.min(440,w-30)&&m.inside,JSON.stringify(m));
   check(T(`${w}x${h}: no left rail and no tabs`),!m.rail&&!m.tabs);
   check(T(`${w}x${h}: owned calendar sections stack Calendar, Sharing, Export, Danger zone`),['Calendar','Sharing','Export','Danger zone'].every((h,i,a)=>m.heads.indexOf(h)>=0&&(i===0||m.heads.indexOf(h)>m.heads.indexOf(a[i-1])))&&m.heads[m.heads.length-1]==='Danger zone',JSON.stringify(m.heads));
   check(T(`${w}x${h}: the Done footer stays visible`),m.doneVisible);
   check(T(`${w}x${h}: only the one column scrolls (no mini-scrollbars inside)`),(await nested()).length===0,JSON.stringify(await nested()));
   const d=await page.evaluate(()=>{const body=document.querySelector('.dl-manage .dl-col-body');body.style.scrollBehavior='auto';body.scrollTop=body.scrollHeight;const b=document.querySelector('.dl-manage [data-delete]').getBoundingClientRect(),pr=body.getBoundingClientRect();
    const groups=[...body.querySelectorAll('.set-group')];const last=groups[groups.length-1];return {inView:b.top>=pr.top-1&&b.bottom<=pr.bottom+1,label:document.querySelector('.dl-manage [data-delete]').textContent.trim(),isLastGroup:last.contains(document.querySelector('.dl-manage [data-delete]'))}});
   check(T(`${w}x${h}: Delete calendar is the LAST row of the same scroll and fully reachable`),d.inView&&/Delete calendar/.test(d.label)&&d.isLastGroup,JSON.stringify(d));
   if([[1920,1080],[1280,560],[390,844]].some(([a,b])=>a===w&&b===h))await page.screenshot({path:path.join(out,`danger-${w}x${h}-${theme}.png`)});
   await closeManage();
  }
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});await sleep(400);

  // ---- the same window language as Settings
  const ref=await refLook();
  await openManage('Personal');
  const mg=await page.evaluate(()=>{const d=document.querySelector('.dl-manage'),cs=getComputedStyle(d),h=getComputedStyle(d.querySelector('.dialog-head')),ti=getComputedStyle(d.querySelector('.dialog-title')),f=getComputedStyle(d.querySelector('.dialog-foot')),t=getComputedStyle(d.querySelector('.set-group-title')),g=getComputedStyle(d.querySelector('.set-group'));
   return {radius:cs.borderRadius,bg:cs.backgroundColor,font:cs.fontFamily.split(',')[0],headBg:h.backgroundColor,headBorder:h.borderBottomWidth,title:ti.fontSize+'/'+ti.fontWeight,footBorder:f.borderTopWidth,footPad:f.padding,backdrop:getComputedStyle(document.querySelector('#overlayRoot > .backdrop')).backgroundColor,label:t.fontSize+'/'+t.fontWeight+'/'+t.textTransform,card:g.borderRadius}});
  check(T('Manage matches Create Event: same radius, surface, font, plain header (no tint, no divider), title size, footer padding without divider, same backdrop'),['radius','bg','font','headBg','headBorder','title','footBorder','footPad','backdrop'].every(k=>mg[k]===ref.ev[k]),JSON.stringify({mg,ev:ref.ev}));
  check(T('section labels and grouped cards match Settings (small-caps grey label, 16px card)'),mg.label===ref.st.title&&mg.card===ref.st.card,JSON.stringify({mg:[mg.label,mg.card],st:ref.st}));
  const nameBox=await page.evaluate(()=>{const i=document.querySelector('#calSettingsName'),r=i.getBoundingClientRect(),c=getComputedStyle(i),card=i.closest('.set-group');return {h:Math.round(r.height),radius:c.borderRadius,inCard:!!card&&card.querySelectorAll('.text-input,.dl-idf-input').length>0&&!!card.closest('.set-group')&&card.querySelector('.set-group-title')?.textContent!=='Name'}});
  check(T('the Name field is one 44px field with a 12px radius and no outer card'),nameBox.h===44&&nameBox.radius==='12px',JSON.stringify(nameBox));

  // ---- the color layout has no dead slots
  const col=await page.evaluate(()=>{const sw=[...document.querySelectorAll('[data-presets] .dl-sw')];const rows={};sw.forEach(x=>{const k=Math.round(x.getBoundingClientRect().top);rows[k]=(rows[k]||0)+1});const counts=Object.keys(rows).sort((a,b)=>a-b).map(k=>rows[k]);
   const pr=document.querySelector('[data-presets]').getBoundingClientRect(),yl=document.querySelector('[data-custom-toggle]').getBoundingClientRect();return {counts,gap:Math.round(yl.top-pr.bottom)}});
  check(T('the palette fills whole rows; Your colors (if any) follows without a dead gap'),col.counts.length>=3&&Math.max(...col.counts)-Math.min(...col.counts)<=1&&col.gap<=60,JSON.stringify(col));
  const b=await page.evaluate(()=>{const r=document.querySelector('.dl-manage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
  await page.screenshot({path:path.join(out,`manage-owned-${theme}.png`),clip:{x:Math.max(0,b.x-8),y:Math.max(0,b.y-8),width:b.w+16,height:b.h+16},captureBeyondViewport:false});
  await page.evaluate(()=>{const body=document.querySelector('.dl-manage .dl-col-body');body.style.scrollBehavior='auto';body.querySelector('.dl-inv-field').scrollIntoView({block:'start'})});await sleep(300);
  await page.screenshot({path:path.join(out,`manage-sharing-${theme}.png`),clip:{x:Math.max(0,b.x-8),y:Math.max(0,b.y-8),width:b.w+16,height:b.h+16},captureBeyondViewport:false});

  // ---- Done and the pill: Done does nothing while there are unsaved changes
  await page.evaluate(()=>{const body=document.querySelector('.dl-manage .dl-col-body');body.scrollTop=0});
  await page.click('#calSettingsName',{clickCount:3});await page.type('#calSettingsName','Personal (new)');await sleep(200);
  check(T('an edit raises the Save pill'),await page.evaluate(()=>!document.querySelector('.dl-manage .settings-savebar').hidden));
  await page.click('.dl-manage [data-done]');await sleep(300);
  check(T('Done does nothing while the pill is showing (the pill is the only gate)'),await page.evaluate(()=>!!document.querySelector('.dl-manage')));
  await page.click('.dl-manage .settings-savebar [data-save]');await page.waitForFunction(()=>document.querySelector('.dl-manage .settings-savebar')?.hidden,{timeout:5000});await sleep(400);
  await page.click('.dl-manage [data-done]');await page.waitForFunction(()=>!document.querySelector('.dl-manage'),{timeout:4000});
  check(T('after Save, Done closes the dialog and the new name is in the sidebar'),await page.evaluate(()=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='Personal (new)')));

  // ---- the other calendar popups share the shell
  await page.evaluate(()=>window.daylightAddToSubscriptions());await page.waitForSelector('.dl-chooser');await sleep(350);
  const ch=await page.evaluate(()=>{const d=document.querySelector('.dl-chooser'),r=d.getBoundingClientRect();return {w:Math.round(r.width),radius:getComputedStyle(d).borderRadius}});
  check(T('the Add to Subscriptions chooser uses the same shell (480px, same radius as Create Event)'),ch.w===480&&ch.radius===ref.ev.radius,JSON.stringify({ch,ref:ref.ev.radius}));
  await page.screenshot({path:path.join(out,`subscribe-chooser-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-chooser [data-x]').click());await sleep(350);
  await page.evaluate(()=>openNewCalendar());await page.waitForSelector('.dl-std');await sleep(300);
  const nc=await page.evaluate(()=>{const d=[...document.querySelectorAll('.dl-std')].pop(),r=d.getBoundingClientRect();return {w:Math.round(r.width),radius:getComputedStyle(d).borderRadius}});
  check(T('New calendar uses the same shell'),nc.w===480&&nc.radius===ref.ev.radius,JSON.stringify(nc));
  await page.evaluate(()=>[...document.querySelectorAll('.dl-std')].pop().querySelector('[data-x]').click());await sleep(300);

  // ---- US Holidays: reduced set
  await openManage('US Holidays');
  const hol=await page.evaluate(()=>({heads:[...document.querySelectorAll('.dl-manage .dl-col-h,.dl-manage .set-group-title')].map(n=>n.textContent.trim()),name:!!document.querySelector('#calSettingsName'),swatches:document.querySelectorAll('[data-presets] .dl-sw').length>0,exp:!!document.querySelector('.dl-manage [data-export]'),del:!!document.querySelector('.dl-manage [data-delete],.dl-manage [data-danger]')}));
  check(T('US Holidays keeps only colors + Export (no name, no Sharing, no Delete)'),hol.heads.includes('Calendar')&&hol.heads.includes('Export')&&!hol.heads.includes('Sharing')&&!hol.heads.includes('Danger zone')&&!hol.name&&hol.swatches&&hol.exp&&!hol.del,JSON.stringify(hol));
  await closeManage();

  // ---- subscribed calendar: same dialog, parallel rows, and they work
  await page.waitForFunction(()=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='School feed'),{timeout:8000});
  await openManage('School feed');
  const sub=await page.evaluate(()=>({heads:[...document.querySelectorAll('.dl-manage .dl-col-h,.dl-manage .set-group-title')].map(n=>n.textContent.trim()),name:document.querySelector('#calSettingsName')?.value,swatches:document.querySelectorAll('[data-presets] .dl-sw').length,
   lastIsDanger:!!document.querySelector('.dl-manage .dl-col-body .set-group:last-child [data-danger]')}));
  check(T('a subscribed calendar: Calendar, Source, Danger zone (Unsubscribe last)'),['Calendar','Source','Danger zone'].every((h,i,a)=>sub.heads.indexOf(h)>=0&&(i===0||sub.heads.indexOf(h)>sub.heads.indexOf(a[i-1])))&&sub.name==='School feed'&&sub.swatches>10&&sub.lastIsDanger,JSON.stringify(sub));
  await page.screenshot({path:path.join(out,`subscribed-${theme}.png`)});
  await page.click('#calSettingsName',{clickCount:3});await page.type('#calSettingsName','School feed (renamed)');
  await page.evaluate(()=>document.querySelectorAll('[data-presets] .dl-sw')[3].click());await sleep(250);
  await page.click('.dl-manage .settings-savebar [data-save]');await page.waitForFunction(()=>document.querySelector('.dl-manage .settings-savebar')?.hidden,{timeout:5000});await sleep(500);
  const upd=await page.evaluate(()=>({server:window.__subs[0],sidebar:[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='School feed (renamed)')}));
  check(T('subscribed: rename and color override are saved to the subscription'),upd.server.name==='School feed (renamed)'&&upd.server.color!=='rose'&&upd.sidebar,JSON.stringify(upd));
  const src=await page.evaluate(()=>({text:document.querySelector('.dl-col-body').innerText.replace(/\s+/g,' '),refresh:!!document.querySelector('[data-refresh]')}));
  check(T('subscribed: the Source rows show the feed address, last updated, status and Refresh now'),/example\.com\/school\.ics/.test(src.text)&&/Last updated/.test(src.text)&&/Up to date/.test(src.text)&&src.refresh,src.text.slice(0,200));
  const was=await page.evaluate(()=>document.querySelector('[data-updated]').textContent);
  await page.evaluate(()=>document.querySelector('[data-refresh]').click());await sleep(1200);
  check(T('subscribed: Refresh now checks the source and updates "last updated"'),await page.evaluate(w=>document.querySelector('[data-updated]').textContent!==w&&/refreshed/i.test(document.querySelector('[data-note]').textContent),was));
  await page.evaluate(()=>document.querySelector('[data-danger]').click());await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(450);
  const conf=await page.evaluate(()=>{const d=document.querySelector('#overlayRoot > .backdrop:last-child .dialog'),r=d.getBoundingClientRect(),foot=[...d.querySelectorAll('.dialog-foot button')].map(b=>b.textContent.trim());return {w:Math.round(r.width),radius:getComputedStyle(d).borderRadius,foot,subs:window.__subs.length}});
  check(T('Unsubscribe asks first in the same shell, with the danger action last (nothing removed yet)'),conf.w===480&&conf.radius===ref.ev.radius&&conf.foot[conf.foot.length-1]==='Unsubscribe'&&conf.subs===1,JSON.stringify(conf));
  await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(1400);
  check(T('subscribed: confirmed, the subscription is removed and its calendar leaves the sidebar'),await page.evaluate(()=>window.__subs.length===0&&![...document.querySelectorAll('.cal-name')].some(n=>/School feed/.test(n.textContent))&&!document.querySelector('.dl-manage')));
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('manage dialog FAILED');process.exit(1)}
console.log('PASS manage dialog');
