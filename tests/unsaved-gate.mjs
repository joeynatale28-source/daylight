/**
 * Settings with an unsaved change, both themes (Fix 86): X, Escape and a click outside never do nothing. Each shows a clear
 * "Save your changes?" choice: Save / Discard / Keep editing. Keep editing returns to Settings with the pill (which pulses);
 * Discard closes without saving; Save saves and closes. Without unsaved changes X and Escape close as before.
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
  const reduce=()=>page.evaluate(()=>state.reduceMotion);
  const open=async sec=>{await page.evaluate(s=>openSettings(s),sec);await page.waitForSelector('.settings-dialog');await sleep(600)};
  const dirty=async()=>{
   await page.evaluate(()=>{const row=[...document.querySelectorAll('.settings-pane .set-row')].find(r=>/Reduce motion/.test(r.textContent));row.querySelector('input').click()});
   await page.waitForFunction(()=>{const b=document.querySelector('.settings-savebar');return b&&!b.hidden},{timeout:3000});await sleep(250)};
  const info=()=>page.evaluate(()=>({open:!!document.querySelector('.settings-dialog'),prompt:!!document.querySelector('.dl-leave'),buttons:[...document.querySelectorAll('.dl-leave button')].map(b=>b.textContent.trim()),pill:!!document.querySelector('.settings-savebar')&&!document.querySelector('.settings-savebar').hidden}));
  const asks=async(label,fn)=>{await fn();await sleep(450);const i=await info();check(T(`${label}: a Save / Discard / Keep editing choice appears (never silent)`),i.open&&i.prompt&&i.buttons.join('|')==='Keep editing|Discard|Save',JSON.stringify(i));return i};

  // no unsaved change: X and Escape close as before
  await open('appearance');await page.click('.settings-close');await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  check(T('no unsaved changes: X closes'),true);
  await open('appearance');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  check(T('no unsaved changes: Escape closes'),true);

  // unsaved: prompts
  await open('appearance');const before=await reduce();await dirty();
  await asks('X',()=>page.click('.settings-close'));
  await page.screenshot({path:path.join(out,`1-prompt-after-X-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-leave [data-keep]').click());await sleep(450);
  let i=await info();
  check(T('Keep editing: back in Settings with the pill still showing'),i.open&&!i.prompt&&i.pill,JSON.stringify(i));
  check(T('Keep editing: the pill highlights'),await page.evaluate(()=>document.querySelector('.settings-savebar').classList.contains('is-nudge')));
  await asks('Escape',()=>page.keyboard.press('Escape'));
  await page.keyboard.press('Escape');await sleep(450);
  i=await info();
  check(T('Escape inside the prompt means Keep editing'),i.open&&!i.prompt&&i.pill,JSON.stringify(i));
  await asks('a click outside',()=>page.mouse.click(30,450));
  await page.screenshot({path:path.join(out,`2-prompt-after-outside-click-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-leave [data-drop]').click());
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});await sleep(300);
  check(T('Discard: Settings closes and the change was not saved'),(await reduce())===before);

  // Save from the prompt
  await open('appearance');await dirty();
  await asks('X (again)',()=>page.click('.settings-close'));
  await page.evaluate(()=>document.querySelector('.dl-leave [data-yes]').click());
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:6000});await sleep(300);
  check(T('Save: the change is kept and Settings closes'),(await reduce())!==before);
  await page.evaluate(()=>{state.reduceMotion=false;document.body.classList.remove('reduce-motion')});

  // the pill's own Save / Discard still work
  await open('appearance');await dirty();
  await page.click('.settings-savebar [data-discard]');await sleep(600);
  i=await info();
  check(T('the pill Discard still works and leaves Settings open'),i.open&&!i.pill&&!i.prompt,JSON.stringify(i));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});

  // phones
  for(const [w,h] of [[390,844],[360,640]]){
   await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:true,hasTouch:true});await sleep(500);
   await open('appearance');await dirty();
   await asks(`${w}x${h} the X`,()=>page.click('.settings-close'));
   const fits=await page.evaluate(()=>{const r=document.querySelector('.dl-leave').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight});
   check(T(`${w}x${h}: the prompt fits on screen`),fits);
   await page.screenshot({path:path.join(out,`3-prompt-phone-${w}x${h}-${theme}.png`)});
   await page.evaluate(()=>document.querySelector('.dl-leave [data-drop]').click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});
  }
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});
 }finally{await app.close()}
}
if(failed){console.log('unsaved gate FAILED');process.exit(1)}
console.log('PASS unsaved gate');
