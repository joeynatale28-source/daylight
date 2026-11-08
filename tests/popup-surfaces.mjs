/** Captures every popup surface (for before/after comparison). Usage: HARNESS_ROOT=<build dir> SHOTS=<out dir> TAG=before node tests/popup-surfaces.mjs */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','polish');
const tag=process.env.TAG||'after';
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const theme of (process.env.THEMES||'dark,light').split(',')){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload()});
 const {page}=app;
 const shot=async name=>{await sleep(450);await page.screenshot({path:path.join(out,`${tag}-${name}-${theme}.png`)})};
 const clear=async()=>{await page.evaluate(()=>{document.querySelectorAll('#overlayRoot>*,.menu,.popover,.dl-notif-panel,.palette-backdrop').forEach(n=>n.remove());if(window.settingsState)settingsState.transactionActive=false});await sleep(150)};
 try{
  await app.load();
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,10)));await page.waitForSelector('#efCal');await shot('event-dialog');await clear();
  await page.evaluate(()=>{const ev=state.events.find(e=>e.title==='Practice 12');openPopover({ev,start:ev.start,end:ev.end},document.querySelector('.day-cell[data-date="2026-12-12"], .day-cell .chip'))});
  await page.waitForSelector('.popover');await shot('event-popover');await clear();
  await page.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent==='Personal');row.querySelector('.cal-menu-btn').click()});
  await page.waitForSelector('.dl-calsettings, .menu');await shot('calendar-menu');await clear();
  await page.evaluate(()=>openSettings('calendar'));await page.waitForSelector('.settings-dialog');
  await page.evaluate(()=>{const i=document.querySelector('#csWeekends');i.checked=!i.checked;i.dispatchEvent(new Event('change',{bubbles:true}))});await sleep(300);
  await page.evaluate(()=>document.querySelector('.settings-savebar [data-discard]').click());await page.waitForSelector('#dlSettingsDiscardConfirm');await shot('discard-confirm');await clear();
  await page.evaluate(()=>openConfirm({title:'Delete calendar?',body:'This permanently removes the calendar and its events.',confirmLabel:'Delete',danger:true,fn(){}}));await shot('confirm-dialog');await clear();
  await page.click('#headerBand .dl-notif-btn');await page.waitForSelector('.dl-notif-panel');await shot('notifications-panel');await page.keyboard.press('Escape');await clear();
  await page.keyboard.down('Control');await page.keyboard.press('k');await page.keyboard.up('Control');await sleep(300);await shot('search');await page.keyboard.press('Escape');await clear();
  await page.click('button[aria-label="New calendar"]');await page.waitForSelector('.dialog');await shot('new-calendar');await clear();
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(300);
  await page.evaluate(()=>{const b=document.querySelector('.dl-session-row');b&&b.scrollIntoView()});await shot('settings-profile');await clear();
  if(tag==='after'){
   await page.click('button[aria-label="Add to Subscriptions"]');await page.waitForSelector('.dl-opt');await shot('subscriptions-chooser');
   await page.click('[data-opt="caldav"]');await page.waitForSelector('#dlCdServer');await shot('caldav-form');await clear();
   await page.click('button[aria-label="Add to Subscriptions"]');await page.click('[data-opt="ical"]');await page.waitForSelector('#dlSubUrl');await shot('ical-form');await clear();
   await page.click('button[aria-label="Add to Subscriptions"]');await page.click('[data-opt="ics"]');await page.waitForSelector('[data-drop]');await shot('ics-form');await clear();
  }
 }finally{await app.close()}
}
console.log('captured',tag);
