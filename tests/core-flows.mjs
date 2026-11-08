/**
 * Item 9b regression: the core flows on the real page, both themes.
 *  - create / edit / delete an event through the real dialogs;
 *  - recurring events: delete "only this", delete "this and following", edit "only this" (each scope really applies);
 *  - Tasks: add, complete (green check, lands in Completed), and the count follows;
 *  - Settings: change something, Save (green check), it sticks and reaches the workspace save;
 *  - search finds an event.
 * (Sign in/out + account switching: tests/account-switch.mjs. iCal subscribe + ICS import: tests/stage1.mjs.)
 * LIVE_URL=<deployed build> runs the same flows against the deployed page (stubbed backend).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','core-flows');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const saveDialog=async page=>{await page.click('[data-save]');await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:5000});await sleep(450)};

for(const theme of ['dark','light']){
 const t=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await app.load();await sleep(500);
  await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(300);

  // ---- events: create, edit, delete
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,18)));
  await page.waitForSelector('#efTitle');await sleep(300);
  await page.type('#efTitle','Dentist visit');await saveDialog(page);
  let ev=await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Dentist visit');return e&&{id:e.id,day:e.start.getDate()}});
  check(t('create: the event exists on the chosen day'),ev&&ev.day===18,JSON.stringify(ev));
  check(t('create: it is drawn in the month grid'),await page.evaluate(()=>[...document.querySelectorAll('.chip')].some(c=>/Dentist visit/.test(c.textContent))));
  await page.evaluate(id=>{const e=state.events.find(x=>x.id===id);editOccurrence(e,{ev:e,start:e.start,end:e.end})},ev.id);
  await page.waitForSelector('.event-form-dialog #efTitle');await sleep(300);
  await page.click('#efTitle',{clickCount:3});await page.type('#efTitle','Dentist visit (moved)');await saveDialog(page);
  check(t('edit: the title changed on the same event'),await page.evaluate(id=>{const e=state.events.find(x=>x.id===id);return e&&e.title==='Dentist visit (moved)'},ev.id));
  await page.evaluate(id=>{const e=state.events.find(x=>x.id===id);confirmDeleteEvent(e,{ev:e,start:e.start,end:e.end})},ev.id);
  await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(500);
  check(t('delete: it is gone from the data and from the grid'),await page.evaluate(()=>!state.events.some(x=>/Dentist visit/.test(x.title))&&![...document.querySelectorAll('.chip')].some(c=>/Dentist visit/.test(c.textContent))));

  // ---- recurring scopes
  const mk=async(title,day)=>page.evaluate((title,day)=>{const id=++uid;state.events.push({id,title,cal:state.calendars.find(c=>!c.subscribed&&!c.builtin).id,start:new Date(2026,10,day,10),end:new Date(2026,10,day,11),allDay:false,loc:'',desc:'',repeat:'weekly',reminder:null,uid:'rec-'+id});renderAll(false);return id},title,day);
  const occs=(id)=>page.evaluate(id=>occsInRange(new Date(2026,10,1),new Date(2026,11,31)).filter(o=>o.ev.id===id||(o.ev.uid&&o.ev.uid===state.events.find(e=>e.id===id).uid)).map(o=>o.start.getTime()),id);
  const pick=async(id,n)=>page.evaluate((id,n)=>{const list=occsInRange(new Date(2026,10,1),new Date(2026,11,31)).filter(o=>o.ev.id===id).sort((a,b)=>a.start-b.start);window.__occ=list[n];return list.length},id,n);
  const scope=async s=>{await page.waitForSelector(`[data-scope="${s}"]`);await page.click(`[data-scope="${s}"]`);await sleep(450)};

  let rid=await mk('Piano lesson',2);
  const before=await occs(rid);
  await pick(rid,2);
  await page.evaluate(()=>{const o=window.__occ;confirmDeleteEvent(o.ev,o)});
  await scope('only');
  const afterOnly=await occs(rid);
  check(t('recurring delete "only this event": exactly that one occurrence disappears'),afterOnly.length===before.length-1&&!afterOnly.includes(before[2])&&afterOnly.includes(before[1])&&afterOnly.includes(before[3]),JSON.stringify({before:before.length,after:afterOnly.length}));
  await pick(rid,3);
  const chosen=await page.evaluate(()=>window.__occ.start.getTime());
  await page.evaluate(()=>{const o=window.__occ;confirmDeleteEvent(o.ev,o)});
  await scope('following');
  const afterFollowing=await occs(rid);
  check(t('recurring delete "this and following": nothing from that date on remains, earlier ones do'),afterFollowing.length>0&&afterFollowing.every(x=>x<chosen)&&afterFollowing.includes(before[0])&&afterFollowing.includes(before[1]),JSON.stringify({chosen,left:afterFollowing.length}));
  await page.screenshot({path:path.join(out,`recurring-delete-${theme}.png`)});

  const rid2=await mk('Choir',3);
  const b2=await occs(rid2);
  await pick(rid2,1);
  await page.evaluate(()=>{const o=window.__occ;editOccurrence(o.ev,o)});
  await scope('only');
  await page.waitForSelector('.event-form-dialog #efTitle');await sleep(300);
  await page.click('#efTitle',{clickCount:3});await page.type('#efTitle','Choir (special)');await saveDialog(page);
  const edited=await page.evaluate(()=>({special:state.events.filter(e=>e.title==='Choir (special)').length,series:state.events.filter(e=>e.title==='Choir').length,rec:!!state.events.find(e=>e.title==='Choir (special)')?.recurrenceId}));
  check(t('recurring edit "only this event": one exception is created, the series keeps its name'),edited.special===1&&edited.series===1&&edited.rec,JSON.stringify(edited));
  const after2=await page.evaluate(()=>occsInRange(new Date(2026,10,1),new Date(2026,11,31)).filter(o=>/^Choir/.test(o.ev.title)).map(o=>o.ev.title));
  check(t('recurring edit: the grid shows one "Choir (special)" among the normal "Choir" ones'),after2.filter(x=>x==='Choir (special)').length===1&&after2.filter(x=>x==='Choir').length>=b2.length-2,JSON.stringify(after2));

  // ---- tasks
  await page.evaluate(()=>showTasks());await page.waitForSelector('#taskTitleInput');await sleep(400);
  const nTasks=await page.evaluate(()=>state.tasks.length);
  await page.type('#taskTitleInput','Pack swim bag');await page.click('.task-add-card .btn-primary');await sleep(500);
  check(t('tasks: adding creates the task and shows its row'),await page.evaluate(n=>state.tasks.length===n+1&&[...document.querySelectorAll('.task-row')].some(r=>/Pack swim bag/.test(r.textContent)),nTasks));
  await page.screenshot({path:path.join(out,`tasks-added-${theme}.png`)});
  await page.evaluate(()=>{[...document.querySelectorAll('.task-row')].find(r=>/Pack swim bag/.test(r.textContent)).querySelector('.task-check').click()});
  await sleep(120);
  const mid=await page.evaluate(()=>{const c=[...document.querySelectorAll('.task-row')].find(r=>/Pack swim bag/.test(r.textContent));return c?c.querySelector('.task-check').className:'row already gone'});
  check(t('tasks: completing draws the green check first'),/completing|done/.test(mid),mid);
  await sleep(900);
  check(t('tasks: it is then recorded as completed'),await page.evaluate(()=>state.tasks.some(x=>x.title==='Pack swim bag'&&x.done)));
  await page.evaluate(()=>{[...document.querySelectorAll('.task-seg button')].find(b=>/Completed/.test(b.textContent)).click()});await sleep(400);
  check(t('tasks: the Completed tab lists it'),await page.evaluate(()=>[...document.querySelectorAll('.task-row.done')].some(r=>/Pack swim bag/.test(r.textContent))));

  // ---- Settings save
  await page.evaluate(()=>{state.section='calendar';renderAll(false);openSettings('calendar')});await page.waitForSelector('.settings-dialog');await sleep(500);
  await page.evaluate(()=>{const row=[...document.querySelectorAll('.settings-pane .set-row')].find(r=>/Show weekends/.test(r.textContent));row.querySelector('input').click()});
  await page.waitForFunction(()=>{const b=document.querySelector('.settings-savebar');return b&&!b.hidden},{timeout:3000});
  await page.click('.settings-savebar [data-save]');
  await page.waitForFunction(()=>document.querySelector('.settings-savebar')?.classList.contains('is-saved'),{timeout:2000});
  await page.waitForFunction(()=>document.querySelector('.settings-savebar')?.hidden,{timeout:3000});
  check(t('settings: Save shows the green check, then the change is kept'),await page.evaluate(()=>state.showWeekends===false));
  await page.waitForFunction(()=>window.__lastUpdate&&window.__lastUpdate.payload,{timeout:6000}).catch(()=>{});
  check(t('settings: the saved workspace carries the new setting'),await page.evaluate(()=>{const u=window.__lastUpdate;return !!u&&JSON.stringify(u).includes('"showWeekends":false')}),'no workspace save seen');
  await page.screenshot({path:path.join(out,`settings-saved-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.settings-close')?.click());await sleep(400);

  // ---- search
  await page.evaluate(()=>{state.showWeekends=true;renderAll(false);openSearch()});await page.waitForSelector('.palette-input');await sleep(300);
  await page.type('.palette-input','Practice 12');await sleep(600);
  check(t('search: typing finds the matching event'),await page.evaluate(()=>/Practice 12/.test(document.querySelector('.palette-results')?document.querySelector('.palette-results').innerText:'')));
  await page.screenshot({path:path.join(out,`search-${theme}.png`)});
  await page.keyboard.press('Escape');await sleep(300);
  check(t('no page errors during any of it'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('core flows FAILED');process.exit(1)}
console.log('PASS core flows');
