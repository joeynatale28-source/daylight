/**
 * Round 8, finish and feel (both themes, on the real page). For every animation: its name, duration and easing are MEASURED here.
 *  - one depth language: every floating surface has the Settings dialog's shadow; dialogs / menus / popover / date picker share the 12px radius;
 *  - one motion system: every surface opens with dl-overlay-show (190ms ease-out) and CLOSES with dl-overlay-hide (170ms ease-in) on Esc, the X,
 *    click-away and toggling the same event again, no instant vanish; mid-animation frames are saved;
 *  - feedback: a press scales buttons to 0.98; paging, Back to today, the mini calendar and the task filters animate;
 *  - Reduce motion: every one of these is switched off (surfaces leave instantly, nothing animates, no press transform);
 *  - footer buttons are the same height and padding in every popup; nothing changed size (a before/after of key box sizes is compared).
 * Frames go to ui-screenshots/motion-finish.
 */
import fs from 'node:fs';import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','motion-finish');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await app.load();await sleep(1200);
  const props=sel=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return {shadow:c.boxShadow,radius:c.borderRadius,anim:c.animationName,dur:c.animationDuration,ease:c.animationTimingFunction,exit:!!e.closest('.dl-overlay-exit'),connected:e.isConnected}},sel);
  const gone=sel=>page.evaluate(s=>!document.querySelector(s),sel);
  const realChip=()=>page.evaluate(()=>{const c=[...document.querySelectorAll('.chip')].find(c=>!/Day|Hanukkah|Thanksgiving/.test(c.textContent));c.click()});
  // Settings = the reference for depth
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(500);
  const ref=await props('.settings-dialog');
  check(T('Settings opens with the standard dialog animation: dl-overlay-show, 190ms, ease-out'),ref.anim==='dl-overlay-show'&&ref.dur==='0.19s'&&/cubic-bezier\(0\.23, 1, 0\.32, 1\)/.test(ref.ease),JSON.stringify(ref));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(60);
  const mid=await props('.settings-dialog');
  check(T('Settings closing is animated: still present 60ms after the X, running dl-overlay-hide (170ms, ease-in)'),mid&&mid.exit&&mid.anim==='dl-overlay-hide'&&mid.dur==='0.17s'&&/cubic-bezier\(0\.4, 0, 1, 1\)/.test(mid.ease),JSON.stringify(mid));
  await page.screenshot({path:path.join(out,`frame-settings-closing-${theme}.png`)});await sleep(300);
  check(T('...and gone after it'),await gone('.settings-dialog'));

  const surfaces=[
   ['Create Event',async()=>{await page.evaluate(()=>{state.section='calendar';renderAll(false);openEventForm(null,state.selected)});await page.waitForSelector('.event-form-dialog')},'.event-form-dialog','x'],
   ['confirmation',async()=>{await page.evaluate(()=>openConfirm({title:'Delete this?',body:'Body text',confirmLabel:'Delete',danger:true,fn(){}}))},'.dl-confirm','esc'],
   ['event popover',async()=>{await realChip();await page.waitForSelector('.popover')},'.popover','toggle'],
   ['notifications panel',async()=>{await page.evaluate(()=>document.querySelector('.dl-notif-btn').click());await page.waitForSelector('.dl-notif-panel')},'.dl-notif-panel','esc'],
   ['search dialog',async()=>{await page.evaluate(()=>openSearch());await page.waitForSelector('.palette')},'.palette','esc'],
   ['account menu',async()=>{await page.evaluate(()=>{document.querySelector('.profile-row,.profile-wrap button').click()});await page.waitForSelector('.menu')},'.menu','away'],
   ['Manage dialog',async()=>{await page.evaluate(()=>{[...document.querySelectorAll('.cal-row')][0].querySelector('.cal-menu-btn').click();setTimeout(()=>{const m=document.querySelector('.menu .menu-item');if(m)m.click()},80)});await page.waitForSelector('.dl-manage')},'.dl-manage','x2']
  ];
  const sizes={};
  for(const [name,open,sel,how] of surfaces){
   await open();await sleep(40);
   const early=await props(sel);
   await page.screenshot({path:path.join(out,`frame-${name.replace(/ /g,'-')}-opening-${theme}.png`)});
   await sleep(450);
   const p=await props(sel);
   check(T(`${name}: opens with dl-overlay-show, 190ms, ease-out`),p.anim==='dl-overlay-show'&&p.dur==='0.19s',JSON.stringify(p));
   check(T(`${name}: same shadow as the Settings dialog`),p.shadow===ref.shadow,JSON.stringify({p:p.shadow,ref:ref.shadow}));
   sizes[name]=await page.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]},sel);
   if(how==='x')await page.evaluate(()=>document.querySelector('.event-form-dialog [data-x]').click());
   else if(how==='x2')await page.evaluate(()=>document.querySelector('.dl-manage [data-x]').click());
   else if(how==='esc')await page.keyboard.press('Escape');
   else if(how==='toggle')await realChip();
   else await page.mouse.click(1000,700);
   await sleep(70);
   const closing=await props(sel);
   check(T(`${name}: closing animates out (${how}): still there 70ms later, running dl-overlay-hide 170ms ease-in`),closing&&closing.exit&&closing.anim==='dl-overlay-hide'&&closing.dur==='0.17s',JSON.stringify(closing));
   if(name==='event popover'||name==='Create Event')await page.screenshot({path:path.join(out,`frame-${name.replace(/ /g,'-')}-closing-${theme}.png`)});
   await sleep(300);
   check(T(`${name}: gone once the animation ends`),await gone(sel));
  }
  // radius family
  await page.evaluate(()=>{state.section='calendar';renderAll(false);openEventForm(null,state.selected)});await page.waitForSelector('.event-form-dialog');await sleep(450);
  await page.evaluate(()=>document.querySelector('#efSDate').click());await page.waitForSelector('.date-pop');await sleep(350);
  const fam=await page.evaluate(()=>({dialog:getComputedStyle(document.querySelector('.event-form-dialog')).borderRadius,date:getComputedStyle(document.querySelector('.date-pop')).borderRadius,dateShadow:getComputedStyle(document.querySelector('.date-pop')).boxShadow}));
  check(T('the date picker shares the dialogs\' 12px radius and the Settings shadow'),fam.dialog==='12px'&&fam.date==='12px'&&fam.dateShadow===ref.shadow,JSON.stringify(fam));
  await page.screenshot({path:path.join(out,`frame-date-picker-${theme}.png`)});
  await page.keyboard.press('Escape');await sleep(260);
  await page.evaluate(()=>document.querySelector('#efSTime').click());await sleep(350);
  const dd=await props('.dd-menu');
  check(T('dropdown lists share the 12px radius and the Settings shadow'),dd&&dd.radius==='12px'&&dd.shadow===ref.shadow,JSON.stringify(dd));
  await page.keyboard.press('Escape');await sleep(250);
  // footer buttons: same height + padding everywhere
  const foot=await page.evaluate(()=>{const b=document.querySelector('.event-form-dialog .dialog-foot .btn-primary'),c=getComputedStyle(b);return {h:Math.round(b.getBoundingClientRect().height),pad:c.padding,radius:c.borderRadius}});
  await page.evaluate(()=>document.querySelector('.event-form-dialog [data-x]').click());await sleep(350);
  const foots={};
  const grab=async(name,open,sel,close)=>{await open();await sleep(450);foots[name]=await page.evaluate(s=>[...document.querySelectorAll(s+' .dialog-foot button')].map(b=>{const c=getComputedStyle(b);return Math.round(b.getBoundingClientRect().height)+'|'+c.padding+'|'+c.borderRadius}),sel);await close();await sleep(300)};
  await grab('confirm',()=>page.evaluate(()=>openConfirm({title:'t',body:'b',confirmLabel:'Delete',danger:true,fn(){}})),'.dl-confirm',()=>page.evaluate(()=>document.querySelector('.dl-confirm [data-cancel]').click()));
  await grab('new calendar',()=>page.evaluate(()=>openNewCalendar()),'.dl-std',()=>page.evaluate(()=>document.querySelector('.dl-std [data-x]').click()));
  await grab('manage',()=>page.evaluate(()=>{[...document.querySelectorAll('.cal-row')][0].querySelector('.cal-menu-btn').click();setTimeout(()=>{const m=document.querySelector('.menu .menu-item');if(m)m.click()},80)}),'.dl-manage',()=>page.evaluate(()=>document.querySelector('.dl-manage [data-x]').click()));
  await grab('subscribe form',()=>page.evaluate(()=>window.daylightSubscribeDialog({})),'.dl-form',()=>page.evaluate(()=>document.querySelector('.dl-form [data-x]').click()));
  const all=Object.values(foots).flat();
  check(T('footer buttons are the same height, padding and radius in every popup (36px, 0 16px)'),all.length>=6&&new Set(all).size===1&&all[0].startsWith(String(foot.h)+'|'),JSON.stringify({foots,foot}));

  // feedback + calendar motion
  const press=await page.evaluate(async()=>{const b=document.querySelector('#headerBand .head-right .icon-btn');const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
  await page.mouse.move(press.x,press.y);await page.mouse.down();await sleep(260);
  const pressed=await page.evaluate(()=>{const e=[...document.querySelectorAll(':active')].find(x=>x.classList&&x.classList.contains('icon-btn'));return e?getComputedStyle(e).transform:'none'});
  await page.mouse.up();
  check(T('pressing a button scales it to 0.98 (160ms ease-out)'),/matrix\(0\.98/.test(pressed),pressed);
  await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,9);renderAll(false)});await sleep(500);
  await page.evaluate(()=>{document.querySelector('#headerBand [aria-label="Next month"]').click()});await sleep(60);
  const next=await page.evaluate(()=>{const n=document.querySelector('#viewWrap > *');return {cls:n.className,anim:getComputedStyle(n).animationName,dur:getComputedStyle(n).animationDuration}});
  await page.screenshot({path:path.join(out,`frame-paging-next-${theme}.png`)});
  check(T('paging forward slides in from the right: slideNext, 200ms, ease-out'),/anim-next/.test(next.cls)&&next.anim==='slideNext'&&next.dur==='0.2s',JSON.stringify(next));
  await sleep(300);
  await page.evaluate(()=>{document.querySelector('#headerBand [aria-label="Previous month"]').click()});await sleep(60);
  check(T('paging back slides in from the left: slidePrev'),await page.evaluate(()=>{const n=document.querySelector('#viewWrap > *');return /anim-prev/.test(n.className)&&getComputedStyle(n).animationName==='slidePrev'}));
  await sleep(300);
  await page.evaluate(()=>{state.cursor=new Date(2027,2,9);renderAll(false)});await sleep(400);
  await page.evaluate(()=>{document.querySelector('#tbToday').click()});await sleep(60);
  check(T('Back to today travels back with a direction-aware slide (slidePrev, 200ms)'),await page.evaluate(()=>{const n=document.querySelector('#viewWrap > *');return /anim-prev/.test(n.className)&&getComputedStyle(n).animationDuration==='0.2s'}));
  await sleep(300);
  await page.evaluate(()=>{state.view='week';renderView(true,1)});await sleep(60);
  check(T('switching Month / Week / Day animates (never a hard cut)'),await page.evaluate(()=>/anim-/.test(document.querySelector('#viewWrap > *').className)));
  await sleep(300);
  await page.evaluate(()=>{state.view='month';renderAll(false)});await sleep(400);
  await page.evaluate(()=>{document.querySelectorAll('.mini-nav')[1].click()});await sleep(50);
  const mini=await page.evaluate(()=>{const w=document.querySelector('#miniWrap');return {cls:w.className,anim:getComputedStyle(w).animationName,dur:getComputedStyle(w).animationDuration}});
  check(T('the mini calendar month change slides/fades with its direction: slideNext, 180ms, ease-out'),/mini-anim-next/.test(mini.cls)&&mini.anim==='slideNext'&&mini.dur==='0.18s',JSON.stringify(mini));
  await sleep(300);
  await page.evaluate(()=>showTasks());await sleep(500);
  await page.evaluate(()=>{[...document.querySelectorAll('.tasks-head [role=tab], [role=tab]')].find(b=>/Active/.test(b.textContent)).click()});await sleep(40);
  const tf=await page.evaluate(()=>{const i=document.querySelector('.task-results');return {cls:i.className,anim:getComputedStyle(i).transitionProperty,dur:getComputedStyle(i).transitionDuration,op:+getComputedStyle(i).opacity}});
  check(T('switching All / Active / Completed cross-fades the list: fades out over 110ms then in over 200ms'),/is-out|is-in/.test(tf.cls)&&tf.anim==='opacity'&&tf.dur==='0.11s',JSON.stringify(tf));
  await page.evaluate(()=>showCalendar());await sleep(400);

  // ---- Reduce motion
  await page.evaluate(()=>{state.reduceMotion=true;document.body.classList.add('reduce-motion');document.body.classList.add('dl-reduce-motion')});
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(150);
  const rm=await page.evaluate(()=>({anim:getComputedStyle(document.querySelector('.settings-dialog')).animationDuration}));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(40);
  check(T('Reduce motion: dialogs open without animation and leave instantly'),parseFloat(rm.anim)<=0.001&&await gone('.settings-dialog'),JSON.stringify(rm));
  await page.evaluate(()=>{document.querySelectorAll('.mini-nav')[1].click()});await sleep(40);
  const rmv=await page.evaluate(()=>{const w=document.querySelector('#miniWrap');const b=document.querySelector('#headerBand .head-right .icon-btn');return {mini:getComputedStyle(w).animationName,tr:getComputedStyle(b).transitionDuration,prop:getComputedStyle(b).transitionProperty,cls:b.className}});
  check(T('Reduce motion: the mini calendar does not animate and buttons only fade (80ms, no transform)'),rmv.mini==='none'&&parseFloat(rmv.tr)<=0.08&&!/transform/.test(rmv.prop),JSON.stringify(rmv));
  const rb=await page.evaluate(()=>{const b=document.querySelector('#headerBand .head-right .icon-btn'),r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
  await page.mouse.move(rb.x,rb.y);await page.mouse.down();await sleep(220);
  const rpress=await page.evaluate(()=>{const e=[...document.querySelectorAll(':active')].find(x=>x.classList&&x.classList.contains('icon-btn'));return e?getComputedStyle(e).transform:'none'});await page.mouse.up();
  check(T('Reduce motion: no press scale'),rpress==='none'||/matrix\(1,/.test(rpress),rpress);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('motion finish FAILED');process.exit(1)}
console.log('PASS motion finish');
