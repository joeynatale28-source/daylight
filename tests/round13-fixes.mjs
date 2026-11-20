/** The Tasks page has no Overview side panel (one centered list); Settings always opens at the top of Profile. */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
for(const [theme,w,h] of [['light',1440,900],['dark',390,844]]){
 const app=await launch({theme,width:w,height:h});const {page}=app;const tag=`${theme} ${w}px`;
 try{
  await app.load();await sleep(500);
  await page.evaluate(()=>{state.tasks=[];showTasks()});await sleep(500);
  check(await page.evaluate(()=>!document.querySelector('.tasks-side')&&!!document.querySelector('.tasks-wrap')&&/No tasks yet/.test(document.body.innerText)&&!/Overdue|Due today/.test(document.querySelector('.tasks-wrap').innerText)),`${tag}: zero tasks: the empty state stands alone, no Overview panel`);
  await page.evaluate(()=>{state.tasks.push(mkTask('First task',state.calendars[0].id,sod(TODAY),false,false,''));refreshTasks(false)});await sleep(250);
  const r=await page.evaluate(()=>{const g=document.querySelector('.tasks-grid'),i=document.querySelector('.tasks-inner'),gr=g.getBoundingClientRect(),ir=i.getBoundingClientRect();return {side:!!document.querySelector('.tasks-side,.ts-card'),overview:/overview|by calendar/i.test(document.querySelector('.tasks-wrap').innerText),left:Math.round(ir.left-gr.left),right:Math.round(gr.right-ir.right),heading:/Tasks/.test(document.querySelector('.tasks-title').textContent),counts:/1 active/.test(document.querySelector('.tasks-sub').textContent),filters:document.querySelectorAll('.task-seg button').length}});
  check(!r.side&&!r.overview&&r.heading&&r.counts&&r.filters===3&&Math.abs(r.left-r.right)<=2,`${tag}: with a task there is no Overview / By calendar panel; heading, counts and filters stay, and the list is one centered column`,r);
  const tint=await page.evaluate(()=>{const r=document.querySelector('.task-row'),c=getComputedStyle(r);const o={bg:c.backgroundColor,left:c.borderLeftWidth,leftColor:c.borderLeftColor,top:c.borderTopColor,ring:getComputedStyle(r.querySelector('.task-check')).borderColor,tag:!!r.querySelector('.tm-cal')};return o});
  check(tint.left==='1px'&&tint.leftColor===tint.top&&tint.tag,`${tag}: a task row has no calendar-colour tint, left bar or ring, and keeps its calendar tag`,tint);
  await page.evaluate(()=>{state.tasks=[];refreshTasks(false)});await sleep(400);
  check(await page.evaluate(()=>!document.querySelector('.tasks-side')&&/No tasks yet/.test(document.body.innerText)),`${tag}: back to zero tasks, the empty state shows`);
  // settings: always the top of Profile
  await page.evaluate(()=>{state.section='calendar';renderAll(false);openSettings('profile')});await sleep(900);
  await page.evaluate(()=>{document.querySelector('.settings-pane').scrollTop=600});await sleep(200);
  await page.evaluate(()=>document.querySelector('.settings-dialog').closest('.backdrop').querySelector('[data-discard],.settings-close,button[aria-label="Close"]')?.click());await sleep(200);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove());settingsState.transactionActive=false});
  await page.evaluate(()=>openSettings());await sleep(900);
  const t=await page.evaluate(()=>{const p=document.querySelector('.settings-pane'),h=p.querySelector('#dl-sec-profile'),pr=p.getBoundingClientRect();return {top:p.scrollTop,secTop:Math.round(h.getBoundingClientRect().top-pr.top),active:document.querySelector('.sr-item.active')?.textContent}});
  check(t.top===0&&/Profile/.test(t.active||''),`${tag}: Settings opens at the top of Profile`,t);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove());settingsState.transactionActive=false});
  await page.evaluate(()=>openSettings('calendar'));await sleep(700);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove());settingsState.transactionActive=false});
  await page.evaluate(()=>openSettings());await sleep(900);
  check(await page.evaluate(()=>document.querySelector('.settings-pane').scrollTop===0&&/Profile/.test(document.querySelector('.sr-item.active').textContent)),`${tag}: after visiting another section, Settings still opens on Profile at the top`);
  const errs=app.errors;check(errs.length===0,`${tag}: no page errors`,errs);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
