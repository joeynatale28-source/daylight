/**
 * Item 6 on the real page, both themes: the Settings save pill is the ONLY unsaved-changes gate.
 * With an unsaved change, every exit route (X, backdrop click, Esc, switching to another Settings page) leaves Settings open,
 * the pill still visible and fully on screen, with NO second popup and no shake animation. Save and Discard are the only
 * ways out; afterwards Settings closes normally. Also at phone widths.
 * LIVE_URL=<deployed build> runs it against the deployed page.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','unsaved-gate');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await app.load();await sleep(500);
  const state0=()=>page.evaluate(()=>({reduce:state.reduceMotion,weekends:state.showWeekends}));
  const open=async sec=>{await page.evaluate(s=>openSettings(s),sec);await page.waitForSelector('.settings-dialog');await sleep(550)};
  const dirty=async()=>{ // flip "Reduce motion" in Appearance
   await page.evaluate(()=>{const row=[...document.querySelectorAll('.settings-pane .set-row')].find(r=>/Reduce motion/.test(r.textContent));row.querySelector('input').click()});
   await page.waitForFunction(()=>{const b=document.querySelector('.settings-savebar');return b&&!b.hidden},{timeout:3000});await sleep(250)};
  const info=()=>page.evaluate(()=>{const d=document.querySelector('.settings-dialog'),b=document.querySelector('.settings-savebar');const r=b&&b.getBoundingClientRect();
   const hit=r?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;
   return {open:!!d,pill:!!b&&!b.hidden,onScreen:!!r&&r.top>=0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,uncovered:!!hit&&b.contains(hit),
    popups:document.querySelectorAll('#overlayRoot > .backdrop').length,confirm:!!document.getElementById('dlSettingsDiscardConfirm'),section:(document.querySelector('.settings-rail .sr-item.active')||{}).textContent,
    anim:[d&&getComputedStyle(d).animationName,b&&getComputedStyle(b).animationName].join(' ')}});
  const attempt=async(label,fn)=>{
   await fn();await sleep(500);
   const i=await info();
   check(T(`${label}: Settings stays open, the pill stays, nothing stacked on top`),i.open&&i.pill&&i.popups===1&&!i.confirm,JSON.stringify(i));
   check(T(`${label}: the pill is fully on screen and not covered`),i.onScreen&&i.uncovered,JSON.stringify(i));
   check(T(`${label}: no shake or other animation on the dialog or pill`),!/shake|wiggle|nudge|bounce/i.test(i.anim),i.anim);
   return i;
  };

  // ---- Save path
  await open('appearance');const before=await state0();await dirty();
  await page.screenshot({path:path.join(out,`1-unsaved-pill-${theme}.png`)});
  let i=await attempt('the X',()=>page.click('.settings-close'));
  await page.screenshot({path:path.join(out,`2-after-X-${theme}.png`)});
  await attempt('clicking the backdrop',()=>page.mouse.click(30,450));
  await page.screenshot({path:path.join(out,`3-after-backdrop-${theme}.png`)});
  await attempt('Esc',()=>page.keyboard.press('Escape'));
  await page.screenshot({path:path.join(out,`4-after-esc-${theme}.png`)});
  i=await attempt('switching to another Settings page',()=>page.evaluate(()=>[...document.querySelectorAll('.settings-rail .sr-item')].find(b=>/Calendar/.test(b.textContent)).click()));
  check(T('switching pages did not switch (still on Appearance)'),/Appearance/.test(i.section),i.section);
  await page.screenshot({path:path.join(out,`5-after-page-switch-${theme}.png`)});
  await page.click('.settings-savebar [data-save]');
  await page.waitForFunction(()=>document.querySelector('.settings-savebar')?.hidden,{timeout:4000});await sleep(400);
  i=await info();
  check(T('Save: the pill leaves cleanly, Settings is still open, no popup'),i.open&&!i.pill&&i.popups===1&&!i.confirm,JSON.stringify(i));
  check(T('Save: the change was kept'),(await state0()).reduce!==before.reduce);
  await page.screenshot({path:path.join(out,`6-after-save-${theme}.png`)});
  await page.click('.settings-close');await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  check(T('after Save, the X closes Settings'),true);

  // ---- Discard path
  await open('appearance');const before2=await state0();await dirty();
  await attempt('the X (again)',()=>page.click('.settings-close'));
  await page.click('.settings-savebar [data-discard]');await sleep(600);
  i=await info();
  check(T('Discard: no confirmation popup appears, the pill leaves, Settings is still open'),i.open&&!i.pill&&i.popups===1&&!i.confirm,JSON.stringify(i));
  check(T('Discard: the change was undone'),(await state0()).reduce===before2.reduce);
  await page.screenshot({path:path.join(out,`7-after-discard-${theme}.png`)});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  check(T('after Discard, Esc closes Settings'),true);

  // ---- phones: the pill is always on screen
  for(const [w,h] of [[390,844],[360,640],[430,932]]){
   await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:true,hasTouch:true});await sleep(500);
   await open('appearance');await dirty();
   const pi=await info();
   check(T(`${w}x${h}: the pill is fully on screen and uncovered with an unsaved change`),pi.onScreen&&pi.uncovered&&pi.popups===1,JSON.stringify(pi));
   await page.screenshot({path:path.join(out,`8-phone-${w}x${h}-${theme}.png`)});
   await attempt(`${w}x${h} the X`,()=>page.click('.settings-close'));
   await page.click('.settings-savebar [data-discard]');await sleep(500);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  }
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});
 }finally{await app.close()}
}
if(failed){console.log('unsaved gate FAILED');process.exit(1)}
console.log('PASS unsaved gate');
