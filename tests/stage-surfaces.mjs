/** Captures the surfaces of the presentation pass. HARNESS_ROOT=<build dir> | LIVE_URL=<deployed url>, SHOTS=<dir>, TAG=before|after */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload,TINY_AVATAR} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','stage');
const tag=process.env.TAG||'after';
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const theme of (process.env.THEMES||'dark,light').split(',')){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload({avatar:TINY_AVATAR}),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const shot=async(name,clip)=>{await sleep(550);await page.screenshot({path:path.join(out,`${tag}-${name}-${theme}.png`),...(clip?{clip}:{})})};
 const clear=async()=>{await page.evaluate(()=>{document.querySelectorAll('#overlayRoot>*,.menu,.popover,.dl-notif-panel').forEach(n=>n.remove());if(window.settingsState)settingsState.transactionActive=false});await sleep(150)};
 try{
  await app.load();
  await page.evaluate(()=>{state.customColors=['#13A5C7','#6C5CE7']});
  for(const name of ['Personal','US Holidays']){
   await page.evaluate(n=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent===n);row.querySelector('.cal-menu-btn').click()},name);
   await page.waitForSelector('.dl-calsettings, .menu');await shot('menu-'+name.replace(' ',''));await clear();
  }
  for(const section of ['profile','appearance','calendar','notifications','ai','shortcuts']){
   await page.evaluate(sec=>openSettings(sec),section);await page.waitForSelector('.settings-dialog');await shot('settings-'+section);await clear();
  }
  const bottom={x:0,y:640,width:300,height:260};
  await shot('sidebar-bottom',bottom);
  await page.click('button[aria-label="Add to Subscriptions"]');await page.waitForSelector('.dl-opt');await shot('chooser');
  await page.click('[data-opt="caldav"]');await page.waitForSelector('#dlCdServer');await page.type('#dlCdServer','caldav.example.com');await page.type('#dlCdUser','you@example.com');await page.type('#dlCdPass','password123');await shot('caldav-form');await clear();
  await page.click('button[aria-label="Add to Subscriptions"]');await page.click('[data-opt="ical"]');await page.waitForSelector('#dlSubUrl');await shot('ical-form');await clear();
  await page.click('button[aria-label="Add to Subscriptions"]');await page.click('[data-opt="ics"]');await page.waitForSelector('[data-drop]');await shot('ics-form');await clear();
 }finally{await app.close()}
}
console.log('captured',tag);
