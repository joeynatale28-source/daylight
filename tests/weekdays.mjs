/**
 * "Only include weekdays" for multi-day events, on the real page: create across a weekend (Fri Nov 13 -> Tue Nov 17),
 * check every view, edit from a covered day, uncheck, re-check, reopen, delete; and an ordinary multi-day event.
 * LIVE_URL=<deployed url> runs it against a deployed build (stubbed backend).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','weekdays');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DAYS=[13,14,15,16,17]; // Fri Sat Sun Mon Tue
let failed=false;

/** Which of Nov 13-17 does an event of this title visibly cover, in the current view? */
async function coverage(page,title){
 return page.evaluate((title,days)=>{
  const view=state.view;
  const bars=[...document.querySelectorAll('.dl-continuous-bar, .chip')].filter(b=>b.textContent.includes(title)&&b.getClientRects().length);
  const rects=bars.map(b=>b.getBoundingClientRect());
  if(view==='month'){
   return days.map(d=>{const cell=document.querySelector('.day-cell[data-date="2026-11-'+String(d).padStart(2,'0')+'"]');if(!cell)return null;const c=cell.getBoundingClientRect();
    return rects.some(r=>{const x=Math.min(r.right,c.right)-Math.max(r.left,c.left);return x>c.width*0.5&&r.top>=c.top-60&&r.top<=c.bottom})});
  }
  // week / day: columns come from the header cells
  const heads=[...document.querySelectorAll('.tg-head .tg-day, .tg-head > *')].filter(h=>h.getClientRects().length);
  return {bars:bars.length};
 },title,DAYS);
}
async function openNewEvent(page,startDay){
 await page.evaluate(d=>openEventForm(null,new Date(2026,10,d)),startDay);
 await page.waitForSelector('#efTitle');await sleep(300);
}
async function pickEnd(page,day){
 await page.click('#efEDate');await page.waitForSelector('#datePop');
 await page.evaluate(d=>{[...document.querySelectorAll('#datePop .mini-day:not(.dim)')].find(b=>b.textContent.trim()===String(d)).click()},day);
 await sleep(150);
}
async function setAllDay(page){
 const on=await page.$eval('#efAllDay',i=>i.checked);if(!on){await page.evaluate(()=>document.querySelector('#efAllDay').click());await sleep(150)}
}
const month=async page=>{await page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(500)};

for(const theme of (process.env.THEMES||'dark,light').split(',')){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await app.load();
  await page.evaluate(()=>{state.events=state.events.filter(e=>!/^(Practice|Homework|Extra|Late)/.test(e.title))});
  await month(page);
  // ---- 1. create Friday -> Tuesday with "Only include weekdays"
  await openNewEvent(page,13);
  assert.equal(await page.$eval('#efWeekdaysWrap',n=>n.hidden),true,'the checkbox does not appear for a single-day event');
  await page.type('#efTitle','Conference');
  await setAllDay(page);
  assert.equal(await page.$eval('#efWeekdaysWrap',n=>n.hidden),true,'still hidden: the event is one day');
  await pickEnd(page,17);
  const shown=await page.evaluate(()=>({hidden:document.querySelector('#efWeekdaysWrap').hidden,label:document.querySelector('#efWeekdaysWrap').textContent.trim(),checked:document.querySelector('#efWeekdays').checked}));
  assert.deepEqual(shown,{hidden:false,label:'Only include weekdays',checked:false},'the checkbox appears for a multi-day event, unchecked by default');
  await page.screenshot({path:path.join(out,'01-dialog-'+theme+'.png')});
  await page.click('#efWeekdays');
  await page.click('[data-save]');
  await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:4000});await sleep(500);
  assert.deepEqual(await coverage(page,'Conference'),[true,false,false,true,true],'month: Fri, Mon and Tue covered; Sat and Sun blank');
  await page.screenshot({path:path.join(out,'02-month-weekdays-'+theme+'.png')});
  // saved as ONE event with the flag (and the full range)
  await sleep(700);
  const saved=await page.evaluate(()=>{const e=(window.__lastUpdate&&window.__lastUpdate.payload.events||[]).filter(x=>x.title==='Conference');return e.map(x=>({weekdaysOnly:x.weekdaysOnly,start:x.start.slice(0,10),end:x.end.slice(0,10)}))});
  assert.equal(saved.length,1,'stored as a single event record: '+JSON.stringify(saved));
  assert.equal(saved[0].weekdaysOnly,true);
  // week view: Saturday/Sunday columns have no bar, Fri/Mon/Tue do (bar segments never span the weekend)
  await page.evaluate(()=>{state.view='week';state.cursor=new Date(2026,10,15);state.selected=new Date(2026,10,15);renderAll(false)});await sleep(500);
  const week=await page.evaluate(()=>{const bars=[...document.querySelectorAll('.dl-week-span-layer .dl-continuous-bar')].filter(b=>b.textContent.includes('Conference')).map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.left),Math.round(r.right)]});
   const heads=[...document.querySelectorAll('.tg-head .th, .tg-head .tg-col-head, .tg-head > div')].map(h=>{const r=h.getBoundingClientRect();return {t:h.textContent.trim().slice(0,6),l:Math.round(r.left),r:Math.round(r.right)}}).filter(h=>/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i.test(h.t));
   return {bars,heads}});
  await page.screenshot({path:path.join(out,'03-week-weekdays-'+theme+'.png')});
  const col=n=>week.heads.find(h=>h.t.toLowerCase().startsWith(n));
  const covered=name=>week.bars.some(([l,r])=>{const h=col(name);return h&&Math.min(r,h.r)-Math.max(l,h.l)>(h.r-h.l)*0.5});
  assert.deepEqual(['sun','mon','tue','sat'].map(covered),[false,true,true,false],'week view: Sun and Sat blank, Mon and Tue covered: '+JSON.stringify(week));
  // day view: Sunday (blank) vs Monday (covered)
  for(const [d,expected] of [[15,0],[16,1]]){
   await page.evaluate(d=>{state.view='day';state.cursor=new Date(2026,10,d);state.selected=new Date(2026,10,d);renderAll(false)},d);await sleep(450);
   const n=await page.evaluate(()=>[...document.querySelectorAll('.allday-bar, .dl-continuous-bar')].filter(b=>b.textContent.includes('Conference')&&b.getClientRects().length).length);
   assert.equal(n>0?1:0,expected,'day view Nov '+d);
  }
  await page.screenshot({path:path.join(out,'04-day-monday-'+theme+'.png')});
  await month(page);

  // ---- 2. edit the title from a covered day: the whole event changes
  await page.evaluate(()=>{const ev=state.events.find(e=>e.title==='Conference');editOccurrence(ev,{ev,start:ev.start,end:ev.end})});
  await page.waitForSelector('#efTitle');await sleep(300);
  const reopened=await page.evaluate(()=>({checked:document.querySelector('#efWeekdays').checked,hidden:document.querySelector('#efWeekdaysWrap').hidden,range:[document.querySelector('#efSDate span').textContent,document.querySelector('#efEDate span').textContent]}));
  assert.equal(reopened.checked,true,'reopening shows the checkbox still checked');
  assert.ok(/Nov 13/.test(reopened.range[0])&&/Nov 17/.test(reopened.range[1]),'reopening shows the original full range: '+JSON.stringify(reopened.range));
  await page.$eval('#efTitle',i=>{i.value='';});await page.type('#efTitle','Conference (renamed)');
  await page.click('[data-save]');await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:4000});await sleep(500);
  assert.deepEqual(await coverage(page,'Conference (renamed)'),[true,false,false,true,true],'the new title shows on every covered day');
  assert.equal(await page.evaluate(()=>state.events.filter(e=>/^Conference/.test(e.title)).length),1,'still one event');
  await page.screenshot({path:path.join(out,'05-renamed-'+theme+'.png')});

  // ---- 3. uncheck: the weekend days are covered again
  await page.evaluate(()=>{const ev=state.events.find(e=>e.title==='Conference (renamed)');editOccurrence(ev,{ev,start:ev.start,end:ev.end})});
  await page.waitForSelector('#efTitle');await sleep(300);
  await page.click('#efWeekdays');await page.click('[data-save]');
  await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:4000});await sleep(500);
  assert.deepEqual(await coverage(page,'Conference (renamed)'),[true,true,true,true,true],'unchecked: full coverage including the weekend');
  await page.screenshot({path:path.join(out,'06-unchecked-'+theme+'.png')});

  // ---- 4. re-check, then delete: every day clear
  await page.evaluate(()=>{const ev=state.events.find(e=>e.title==='Conference (renamed)');editOccurrence(ev,{ev,start:ev.start,end:ev.end})});
  await page.waitForSelector('#efTitle');await sleep(300);
  await page.click('#efWeekdays');await page.click('[data-save]');
  await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:4000});await sleep(500);
  assert.deepEqual(await coverage(page,'Conference (renamed)'),[true,false,false,true,true]);
  await page.evaluate(()=>{const ev=state.events.find(e=>e.title==='Conference (renamed)');confirmDeleteEvent(ev,{ev,start:ev.start,end:ev.end})});
  await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(500);
  assert.deepEqual(await coverage(page,'Conference'),[false,false,false,false,false],'deleted: every day clear');
  assert.equal(await page.evaluate(()=>state.events.filter(e=>/^Conference/.test(e.title)).length),0);
  await page.screenshot({path:path.join(out,'07-deleted-'+theme+'.png')});

  // ---- 5. an ordinary multi-day event (box unchecked) behaves as before
  await openNewEvent(page,13);
  await page.type('#efTitle','Ordinary trip');await setAllDay(page);await pickEnd(page,17);
  await page.click('[data-save]');await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:4000});await sleep(500);
  assert.deepEqual(await coverage(page,'Ordinary trip'),[true,true,true,true,true],'unchecked multi-day event covers every day, weekend included');
  await page.screenshot({path:path.join(out,'08-ordinary-'+theme+'.png')});
  // a weekend-only range cannot be saved with the box checked
  await page.evaluate(()=>{const ev=state.events.find(e=>e.title==='Ordinary trip');state.events=state.events.filter(e=>e!==ev);renderAll(false)});
  await openNewEvent(page,14);await page.type('#efTitle','Weekend only');await setAllDay(page);await pickEnd(page,15);await page.click('#efWeekdays');await page.click('[data-save]');
  await sleep(300);
  assert.ok(await page.$('.event-form-dialog'),'a weekend-only range with the box checked is refused (dialog stays open)');
  // recurring events do not get the checkbox
  await page.evaluate(()=>document.querySelector('#efRepeat').click());await page.waitForSelector('.menu');
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/weekly/i.test(b.textContent)).click());await sleep(200);
  assert.equal(await page.$eval('#efWeekdaysWrap',n=>n.hidden),true,'no checkbox for recurring events');
  await page.evaluate(()=>document.querySelectorAll('#overlayRoot>*').forEach(n=>n.remove()));
  console.log('PASS weekdays-only ('+theme+')');
 }catch(e){failed=true;console.log('FAIL '+theme+': '+String(e&&e.stack||e).slice(0,1200))}
 finally{await app.close()}
}
process.exit(failed?1:0);
