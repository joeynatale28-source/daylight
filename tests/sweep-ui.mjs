/** Verification sweep (harness): "+N more" popover on a busy day, and recurring-edit scope (Only this event / This and following / All events). */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
for(const [theme,w,h] of [['light',1440,900],['dark',1440,900]]){
 const app=await launch({theme,width:w,height:h,payload:busyPayload()});const {page}=app;const tag=theme;
 try{
  await app.load();await sleep(500);
  // +N more on a day with more than 3 events (Dec 9 has 6)
  await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,11,9);renderAll(false)});await sleep(800);
  const more=await page.evaluate(()=>{const l=[...document.querySelectorAll('.more-link')].filter(x=>!x.hidden&&x.offsetParent);return l.map(x=>x.textContent.trim())});
  check(more.some(t=>/^\+\s?\d+ more$/i.test(t)),`${tag}: a busy day shows a "+N more" link`,more);
  await page.evaluate(()=>{const k=[...document.querySelectorAll('.day-cell')].find(c=>/12-09$/.test(c.dataset.date||''));k.querySelector('.more-link').click()});await sleep(500);
  const pop=await page.evaluate(()=>{const p=document.querySelector('.menu');return p&&{n:p.querySelectorAll('.menu-item').length,t:p.innerText.replace(/\s+/g,' ')}});
  check(pop&&pop.n>=6&&/Extra 1/.test(pop.t)&&/Extra 4/.test(pop.t),`${tag}: it opens a popover listing the day's events`,pop);
  await page.keyboard.press('Escape');await sleep(500);await page.evaluate(()=>{closeMenu&&closeMenu();closePopover&&closePopover()});await sleep(300);
  // recurring edit scopes
  for(const [scope,label,expect] of [['only','Only this event',1],['following','This and following',3],['all','All events',4]]){
   await page.evaluate(()=>{state.events=state.events.filter(e=>!/Weekly sync|Renamed/.test(e.title));state.events.push({id:9001,cal:'c3',title:'Weekly sync',start:new Date(2026,11,7,9),end:new Date(2026,11,7,10),allDay:false,loc:'',desc:'',repeat:'weekly',reminder:null,declined:false,uid:'daylight-9001'});renderAll(false)});await sleep(300);
   await page.evaluate(()=>{const e=state.events.find(x=>x.id===9001);const occs=occsInRange(new Date(2026,11,14),new Date(2026,11,15));editOccurrence(e,occs.find(o=>o.ev===e))});await sleep(400);
   const asked=await page.evaluate(()=>['Only this event','This and following','All events'].every(t=>document.body.innerText.includes(t)));
   check(asked,`${tag}: editing asks Only this event / This and following / All events`);
   await page.evaluate(l=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(l)).click(),label);await sleep(500);
   await page.$eval('#efTitle',e=>{e.value='Renamed';e.dispatchEvent(new Event('input',{bubbles:true}))});
   await page.click('[data-save]');await sleep(700);
   const r=await page.evaluate(()=>{const occ=occsInRange(new Date(2026,11,1),new Date(2026,11,31,23,59));return {renamed:occ.filter(o=>o.ev.title==='Renamed').map(o=>o.start?new Date(o.start).getDate():0),original:occ.filter(o=>o.ev.title==='Weekly sync').map(o=>new Date(o.start).getDate())}});
   check(r.renamed.length===expect,`${tag}: "${label}" renames ${expect} occurrence(s) (${r.renamed.join(',')}); the others keep their title (${r.original.join(',')})`,r);
  }
  await page.evaluate(()=>{state.events.push({id:9100,cal:'c3',title:'training',start:new Date(2026,11,3,17),end:new Date(2026,11,3,18),allDay:false,loc:'',desc:'',repeat:null,reminder:null,declined:false,uid:'daylight-9100'});state.cursor=new Date(2026,11,3);renderAll(false)});await sleep(500);
  await page.evaluate(()=>{const e=state.events.find(x=>x.id===9100);const o=occsInRange(new Date(2026,11,3),new Date(2026,11,4)).find(x=>x.ev===e);openPopover(o,[...document.querySelectorAll('.chip')].find(c=>/training/.test(c.textContent)))});await sleep(900);
  const bn=await page.evaluate(()=>[...document.querySelectorAll('img,[style*=background-image]')].map(n=>(n.src||n.style.backgroundImage||'')).filter(x=>/gym/.test(x)));
  check(bn.length>0,`${tag}: an event titled "training" shows the gym banner`,bn);
  check(app.errors.length===0,`${tag}: no page errors`,app.errors);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
