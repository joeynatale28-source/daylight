/**
 * Round 20, both themes: Fix 85 Print month opens an in-app preview and never freezes the app; Fix 88 Settings is one long page
 * with scroll-spy; Fix 87 the month grid's last row is reachable at short heights.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round20');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900});const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await app.load();await sleep(900);
  await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,11,9);state.selected=new Date(2026,11,9);renderAll(false)});await sleep(600);
  // ---- Fix 85 print
  const themeBefore=await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  await shot('85-before-print');
  await page.evaluate(()=>document.querySelector('.head-right [aria-label="More"]').click());await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Print month/.test(b.textContent)).click());await page.waitForSelector('.dl-print-dlg');await sleep(700);
  const pv=await page.evaluate(()=>{const f=document.querySelector('.dl-print-frame');const d=f.contentDocument;return {weeks:d.querySelectorAll('.pm-week').length,title:(d.querySelector('.pm-title')||{}).textContent,bg:getComputedStyle(d.body).backgroundColor,btns:[...document.querySelectorAll('.dl-print-dlg button')].map(b=>b.textContent.trim()).filter(Boolean).join('|'),theme:document.documentElement.getAttribute('data-theme')}});
  check(T('Print month opens an in-app preview (white page) with Print / Close / new-tab'),pv.weeks>=5&&/December 2026/.test(pv.title||'')&&pv.bg==='rgb(255, 255, 255)'&&/Print/.test(pv.btns)&&/Close/.test(pv.btns),J(pv));
  check(T('printing never flips the live theme'),pv.theme===themeBefore);
  await shot('85-print-preview');
  await page.evaluate(()=>{const f=document.querySelector('.dl-print-frame');window.__printed=0;f.contentWindow.print=function(){window.__printed++}});
  await page.evaluate(()=>document.querySelector('.dl-print-dlg [data-print]').click());await sleep(300);
  check(T('Print triggers the print dialog'),await page.evaluate(()=>window.__printed===1));
  await page.keyboard.press('Escape');await sleep(500);
  check(T('Escape closes the preview'),await page.evaluate(()=>!document.querySelector('.dl-print-dlg')));
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(600);
  check(T('after printing, Settings opens (no reload)'),true);
  await page.evaluate(()=>document.querySelector('.settings-close').click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  await page.evaluate(()=>openEventForm(null,new Date(2026,11,10)));await page.waitForSelector('#efTitle');await sleep(400);
  check(T('after printing, Create opens (no reload)'),true);
  await page.keyboard.press('Escape');await sleep(500);
  check(T('images stay loaded'),await page.evaluate(()=>[...document.images].filter(i=>i.src&&!i.complete).length===0));
  await page.evaluate(()=>{const bd=document.querySelector('.backdrop');if(bd)bd.remove()});
  await shot('85-after-print');
  // ---- Fix 88 one long Settings page
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(900);
  const ids=await page.evaluate(()=>[...document.querySelectorAll('.settings-pane > .dl-set-sec')].map(s=>s.dataset.sec));
  check(T('all six sections are stacked in order'),ids.join()==='profile,appearance,calendar,notifications,ai,shortcuts',J(ids));
  const navNames=await page.evaluate(()=>[...document.querySelectorAll('.settings-rail .sr-item')].map(b=>b.textContent.trim()));
  check(T('the nav lists the six sections'),navNames.join()==='Profile,Appearance,Calendar,Notifications,AI access,Shortcuts',J(navNames));
  const active=()=>page.evaluate(()=>(document.querySelector('.settings-rail .sr-item.active')||{}).textContent);
  check(T('Profile is highlighted at the top'),(await active())==='Profile');
  await shot('88-top');
  const seen=[];
  for(const id of ['appearance','calendar','notifications','ai','shortcuts']){
   await page.evaluate(id=>{const p=document.querySelector('.settings-pane'),s=document.getElementById('dl-sec-'+id);p.scrollTop=s.offsetTop-20},id);await sleep(350);
   seen.push([id,await active()]);
   if(id==='notifications')await shot('88-scrolled-notifications');
  }
  check(T('scrolling updates the highlighted nav item'),seen.map(x=>x[1]).join()==='Appearance,Calendar,Notifications,AI access,Shortcuts',J(seen));
  const jumps=[];
  for(const name of ['Calendar','Shortcuts','Appearance','Profile']){
   await page.evaluate(n=>[...document.querySelectorAll('.settings-rail .sr-item')].find(b=>b.textContent.trim()===n).click(),name);await sleep(1000);
   jumps.push(await page.evaluate(n=>{const id={Calendar:'calendar',Shortcuts:'shortcuts',Appearance:'appearance',Profile:'profile'}[n];const p=document.querySelector('.settings-pane'),s=document.getElementById('dl-sec-'+id);const off=Math.round(s.getBoundingClientRect().top-p.getBoundingClientRect().top);return [n,off,(document.querySelector('.settings-rail .sr-item.active')||{}).textContent]},name));
   if(name==='Calendar')await shot('88-clicked-calendar');
  }
  check(T('clicking a nav item jumps to that section and highlights it'),jumps.every(j=>j[1]<=60&&j[1]>=-4&&j[2]===j[0]),J(jumps));
  await page.evaluate(()=>{const row=[...document.querySelectorAll('.settings-pane .set-row')].find(r=>/Notification sound/.test(r.textContent));row.scrollIntoView();row.querySelector('input').click()});
  await page.waitForFunction(()=>{const b=document.querySelector('.settings-savebar');return b&&!b.hidden},{timeout:3000});await sleep(300);
  await shot('88-pill-lower-section');
  await page.click('.settings-savebar [data-save]');await sleep(1500);
  check(T('a change in a lower section shows the pill and saves from it'),await page.evaluate(()=>document.querySelector('.settings-savebar').hidden));
  await page.evaluate(()=>{const row=[...document.querySelectorAll('.settings-pane .set-row')].find(r=>/Notification sound/.test(r.textContent));row.querySelector('input').click()});await sleep(500);
  await page.click('.settings-close');await sleep(500);
  check(T('X with unsaved changes asks (Fix 86 holds on the long page)'),await page.evaluate(()=>!!document.querySelector('.dl-leave')));
  await shot('88-leave-prompt');
  await page.evaluate(()=>document.querySelector('.dl-leave [data-drop]').click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
for(const theme of ['dark','light']){
 for(const [w,h] of [[1280,720],[1100,520]]){
  const app=await launch({theme,width:w,height:h});const {page}=app;
  try{
   await app.load();await sleep(700);
   await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,11,9);state.selected=new Date(2026,11,9);renderAll(false)});await sleep(800);
   await page.mouse.move(w/2,h/2);await page.mouse.wheel({deltaY:900});await sleep(500);
   const r=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.month-week')];const last=rows[rows.length-1].getBoundingClientRect();return {lastBottom:Math.round(last.bottom),vh:innerHeight,app:Math.round(document.getElementById('app').getBoundingClientRect().height)}});
   check(`${theme}: ${w}x${h} Month: the last row can be scrolled fully into view`,r.lastBottom<=r.vh+1&&r.app<=r.vh+1,J(r));
   await page.screenshot({path:path.join(out,`87-month-${w}x${h}-${theme}.png`)});
  }finally{await app.close()}
 }
}
if(failed){console.log('round20 FAILED');process.exit(1)}
console.log('PASS round20');
