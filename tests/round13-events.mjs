/**
 * Round 13 event features (both themes, stubbed Supabase auth + Storage):
 *  Fix 66: no attachments anywhere in the form or popover
 *  Fix 18 undo after delete · Fix 19 duplicate · Fix 20 select mode · Fix 21 quick add · Fix 22 sync indicator ·
 *  Fix 23 default reminder per calendar · Fix 24 print month · Fix 11 premium checkbox
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round13');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const f1=path.join(os.tmpdir(),'dl-photo-1.png'),f2=path.join(os.tmpdir(),'dl-photo-2.png');
fs.writeFileSync(f1,png);fs.writeFileSync(f2,png);
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:1000});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await app.load();await sleep(800);
  await page.evaluate(()=>{state.view='month';state.section='calendar';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(400);
  const create=async(title,quick)=>{
   await page.evaluate(()=>openEventForm(null,new Date(2026,10,20)));await page.waitForSelector('#efTitle');await sleep(300);
   await page.type('#efTitle',title);
  };
  const saveForm=async()=>{await page.click('[data-save]');await sleep(900)};
  const evByTitle=t=>page.evaluate(t=>{const e=state.events.find(x=>x.title===t);return e?{id:e.id,att:(e.attachments||[]).length,cal:e.cal,rem:e.reminder}:null},t);
  const openPop=async t=>{await page.evaluate(t=>{const c=[...document.querySelectorAll('.chip')].find(x=>x.textContent.includes(t));c.click()},t);await page.waitForSelector('.popover');await sleep(500)};

  // ---------------- Fix 66: attachments are gone from the form and the popover
  await create('Photo day');
  check(T('the Create form has no way to add an attachment'),await page.evaluate(()=>!document.querySelector('.dl-attach-field,input[type=file],[data-add]')&&!/ttachment/.test(document.querySelector('.dialog,.backdrop').textContent)));
  await shot('1-form-no-attachments');
  await saveForm();await sleep(600);
  await openPop('Photo day');
  check(T('the popover has no Attachments section'),await page.evaluate(()=>!document.querySelector('.popover .pop-attach')&&!/ttachment/.test(document.querySelector('.popover').textContent)));
  await shot('2-popover-no-attachments');
  await page.keyboard.press('Escape');await sleep(300);

  // ---------------- Fix 18/19: duplicate and undo delete
  await openPop('Photo day');
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"]').click());await sleep(350);
  const menu=await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>b.textContent.trim()));
  check(T('the popover menu: Duplicate and Export grouped together, Delete on its own after a divider'),menu.join('|')==='Duplicate|Export event (.ics)|Delete event'&&await page.evaluate(()=>!!document.querySelector('.menu .menu-sep')),J(menu));
  await shot('4-popover-menu');
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')][0].click());await page.waitForSelector('#efTitle');await sleep(500);
  const dup=await page.evaluate(()=>({title:document.querySelector('#efTitle').value,head:document.querySelector('.dialog-title').textContent}));
  check(T('Duplicate opens the Create form pre-filled with a full copy'),dup.title==='Photo day'&&dup.head==='New event',J(dup));
  await page.$eval('#efTitle',e=>{e.value=''});await page.type('#efTitle','Photo day copy');
  await saveForm();await sleep(900);
  const copyEv=await page.evaluate(()=>{const o=state.events.find(x=>x.title==='Photo day'),c=state.events.find(x=>x.title==='Photo day copy');return {same:o===c,ids:[o&&o.id,c&&c.id]}});
  check(T('the copy is independent: its own id; the original is untouched'),!copyEv.same&&copyEv.ids[0]!==copyEv.ids[1],J(copyEv));
  await openPop('Photo day copy');
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"]').click());await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Delete event/.test(b.textContent)).click());await page.waitForSelector('.backdrop [data-ok]');await sleep(300);
  await page.click('.backdrop [data-ok]');await sleep(500);
  const t1=await page.evaluate(()=>{const t=document.querySelector('#toastRoot .toast');return t?{text:t.textContent,undo:!!t.querySelector('.t-action'),gone:!state.events.find(x=>x.title==='Photo day copy')}:null});
  check(T('deleting shows "Event deleted" with an Undo action'),t1&&/Event deleted/.test(t1.text)&&t1.undo&&t1.gone,J(t1));
  await shot('5-undo-toast');
  await page.evaluate(()=>document.querySelector('#toastRoot .t-action').click());await sleep(500);
  check(T('Undo restores the event'),await page.evaluate(()=>!!state.events.find(x=>x.title==='Photo day copy')));

  // ---------------- Fix 11: premium checkbox
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,20)));await page.waitForSelector('#efTitle');await sleep(300);
  await page.evaluate(()=>{const ad=document.querySelector('#efAllDay');ad.click()});await sleep(200);
  await page.evaluate(()=>{state.__x=1});
  const wd=await page.evaluate(()=>{const l=document.querySelector('#efWeekdaysWrap');return l?{cls:l.className,box:!!l.querySelector('.dl-cb-box'),native:getComputedStyle(l.querySelector('input')).opacity}:null});
  check(T('"Only include weekdays" uses the app checkbox component (custom box, not the browser default)'),wd&&/dl-checkbox/.test(wd.cls)&&wd.box&&wd.native==='0',J(wd));
  await page.keyboard.press('Escape');await sleep(300);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('round 13 events FAILED');process.exit(1)}
console.log('PASS round 13 events');
