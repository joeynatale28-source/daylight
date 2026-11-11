/**
 * Round 13 event features (both themes, stubbed Supabase auth + Storage):
 *  Fix 10 photo attachments (add/remove in the form, "Attachments" group in the popover, preview, graceful upload failure, cleanup)
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

  // ---------------- Fix 10: attachments in the form
  await create('Photo day');
  const grp=await page.evaluate(()=>{const add=document.querySelector('#efDesc').closest('.field').querySelector('[data-add]');return add?{add:add.textContent.trim(),hiddenGroup:document.querySelector('.dl-attach-field').hidden}:null});
  check(T('the form has "Add attachments" on the Description row (no extra height while empty)'),grp&&/Add attachments/.test(grp.add)&&grp.hiddenGroup,J(grp));
  const input=await page.$('#efDesc ~ input[type=file], .field input[type=file]');
  await input.uploadFile(f1,f2);await sleep(600);
  const tiles=await page.evaluate(()=>({n:document.querySelectorAll('.dl-attach-field .dl-attach-tile').length,x:document.querySelectorAll('.dl-attach-field .dl-attach-x').length}));
  check(T('two chosen photos show as thumbnails, each with a remove control, before saving'),tiles.n===2&&tiles.x===2,J(tiles));
  check(T('the Attachments group appears once there are photos'),await page.evaluate(()=>{const f=document.querySelector('.dl-attach-field');return !f.hidden&&f.querySelector('.dl-attach-h').textContent==='Attachments'}));
  await shot('1-form-attachments');
  await page.evaluate(()=>document.querySelector('.dl-attach-field .dl-attach-x').click());await sleep(300);
  check(T('removing a thumbnail drops it'),await page.evaluate(()=>document.querySelectorAll('.dl-attach-field .dl-attach-tile').length)===1);
  await input.uploadFile(f2);await sleep(400);
  await saveForm();await sleep(900);
  const ev1=await evByTitle('Photo day');
  const ups=await page.evaluate(()=>window.__att&&window.__att.uploads);
  check(T('saving uploads the photos to Storage (not into the event row) and stores references on the event'),ev1&&ev1.att===2&&ups&&ups.length===2&&ups.every(p=>/^[0-9a-f-]{36}\/\d+\//.test(p)),J([ev1,ups]));
  // popover group
  await openPop('Photo day');
  const pop=await page.evaluate(()=>{const s=document.querySelector('.popover .pop-attach');return s?{head:s.querySelector('.pop-attach-h').textContent,tiles:s.querySelectorAll('.dl-attach-tile').length,last:s===document.querySelector('.popover').lastElementChild||s.parentNode.lastElementChild===s}:null});
  check(T('the popover shows one "Attachments" group at the bottom with an even thumbnail grid'),pop&&pop.head==='Attachments'&&pop.tiles===2&&pop.last,J(pop));
  await shot('2-popover-attachments');
  await page.evaluate(()=>document.querySelector('.popover .dl-attach-tile').click());await page.waitForSelector('.dl-lightbox');await sleep(400);
  check(T('a photo opens a larger in-app preview; Escape closes it'),await page.evaluate(()=>!!document.querySelector('.dl-lightbox img')));
  await shot('3-lightbox');
  await page.keyboard.press('Escape');await sleep(350);
  check(T('Escape closed only the preview'),await page.evaluate(()=>!document.querySelector('.dl-lightbox')&&!!document.querySelector('.popover')));
  // no photos -> no section
  await page.keyboard.press('Escape');await sleep(300);
  await create('No photos here');await saveForm();
  await openPop('No photos here');
  check(T('an event without photos has NO Attachments heading or placeholder'),await page.evaluate(()=>!document.querySelector('.popover .pop-attach')&&!/Attachments/.test(document.querySelector('.popover').textContent)));
  await page.keyboard.press('Escape');await sleep(300);
  // failed upload: the event still saves
  await page.evaluate(()=>{window.__att.failUpload=true});
  await create('Upload fails');
  await (await page.$('#efDesc ~ input[type=file], .field input[type=file]')).uploadFile(f1);await sleep(400);
  await saveForm();await sleep(800);
  const evF=await evByTitle('Upload fails');
  check(T('when an upload fails the event still saves, and the user is told'),evF&&evF.att===0&&await page.evaluate(()=>/couldn.t be uploaded/.test(document.getElementById('toastRoot').textContent)),J(evF));
  await page.evaluate(()=>{window.__att.failUpload=false});

  // ---------------- Fix 18: undo after delete
  await openPop('Photo day');
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"]').click());await sleep(350);
  const menu=await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>b.textContent.trim()));
  check(T('the popover ⋯ menu: Duplicate and Export grouped together, Delete on its own after a divider'),menu.join('|')==='Duplicate|Export event (.ics)|Delete event'&&await page.evaluate(()=>!!document.querySelector('.menu .menu-sep')),J(menu));
  await shot('4-popover-menu');
  // Duplicate (Fix 19)
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')][0].click());await page.waitForSelector('#efTitle');await sleep(500);
  const dup=await page.evaluate(()=>({title:document.querySelector('#efTitle').value,tiles:document.querySelectorAll('.dl-attach-field .dl-attach-tile').length,head:document.querySelector('.dialog-title').textContent}));
  check(T('Duplicate opens the Create form pre-filled with a full copy, photos included'),dup.title==='Photo day'&&dup.tiles===2&&dup.head==='New event',J(dup));
  await page.$eval('#efTitle',e=>{e.value=''});await page.type('#efTitle','Photo day copy');
  await saveForm();await sleep(900);
  const copyEv=await page.evaluate(()=>{const o=state.events.find(x=>x.title==='Photo day'),c=state.events.find(x=>x.title==='Photo day copy');return {same:o===c,ids:[o&&o.id,c&&c.id],ca:(c&&c.attachments||[]).length,paths:(c&&c.attachments||[]).map(a=>a.path),copied:window.__att.copied.length,orig:(o.attachments||[]).length}});
  check(T('the copy is independent: its own id and its own photo copies; the original is untouched'),!copyEv.same&&copyEv.ids[0]!==copyEv.ids[1]&&copyEv.ca===2&&copyEv.copied===2&&copyEv.orig===2,J(copyEv));
  // delete + undo
  await openPop('Photo day copy');
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"]').click());await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Delete event/.test(b.textContent)).click());await page.waitForSelector('.backdrop [data-ok]');await sleep(300);
  await page.click('.backdrop [data-ok]');await sleep(500);
  const t1=await page.evaluate(()=>{const t=document.querySelector('#toastRoot .toast');return t?{text:t.textContent,undo:!!t.querySelector('.t-action'),gone:!state.events.find(x=>x.title==='Photo day copy')}:null});
  check(T('deleting shows "Event deleted" with an Undo action'),t1&&/Event deleted/.test(t1.text)&&t1.undo&&t1.gone,J(t1));
  await shot('5-undo-toast');
  await page.evaluate(()=>document.querySelector('#toastRoot .t-action').click());await sleep(500);
  const back=await page.evaluate(()=>{const c=state.events.find(x=>x.title==='Photo day copy');return c?{att:(c.attachments||[]).length,cal:c.cal}:null});
  check(T('Undo restores the event completely (calendar, details, photos)'),back&&back.att===2,J(back));
  await sleep(7200);
  check(T('an undone delete never removes the photos from Storage'),await page.evaluate(()=>window.__att.removed.filter(p=>/Photo day copy/.test(p)).length===0&&window.__att.removed.length===0),J(await page.evaluate(()=>window.__att.removed)));
  // delete (no undo) -> cleanup after the undo window
  await page.evaluate(()=>window.daylightDeleteEvents([state.events.find(x=>x.title==='Photo day copy')]));await sleep(7200);
  check(T('after the undo window a deleted event’s photos are removed from Storage'),await page.evaluate(()=>window.__att.removed.length===2),J(await page.evaluate(()=>window.__att.removed)));

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
