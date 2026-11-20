/** Tasks view: one add control, description on create + edit, task editor, zero state said once, tab-specific empty copy, due-date quick options. Harness. */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
for(const theme of ['light','dark']){
 const app=await launch({width:1440,height:900,theme});const page=app.page;
 try{
  await app.load();await sleep(500);
  await page.evaluate(()=>{state.tasks=[];state.section='tasks';state.taskFilter='all';renderAll(false)});await sleep(500);
  const z=await page.evaluate(()=>({addBtns:[...document.querySelectorAll('.tasks-inner button')].filter(b=>/^\s*(\+\s*)?Add( task)?\s*$/.test(b.textContent)).length,sub:(document.querySelector('.tasks-sub')||{}).textContent,tabs:[...document.querySelectorAll('.task-seg button')].map(b=>b.textContent.replace(/\s+/g,' ').trim()),empty:(document.querySelector('.es-title')||{}).textContent,text:document.querySelector('.tasks-inner').innerText}));
  check(z.addBtns===1,'one add control (no second "Add task" pill)',z.addBtns);
  check(!/0 active|0 completed/.test(z.text)&&z.tabs.join()==='All,Active,Completed','the zero state is said once (no "0 active · 0 completed", no zero counts on the tabs)',z);
  check(z.empty==='No tasks yet'&&!/swim|homework/i.test(z.text),'the empty state is generic',z.text);
  if(theme==='light')await page.screenshot({path:process.env.SHOTS?process.env.SHOTS+'/tasks-empty.png':undefined}).catch(()=>{});
  const copy={};for(const f of ['active','completed','all']){await page.evaluate(f=>{[...document.querySelectorAll('.task-seg button')].find(b=>b.textContent.trim().toLowerCase().startsWith(f)).click()},f);await sleep(350);copy[f]=await page.evaluate(()=>(document.querySelector('.es-title')||{}).textContent)}
  check(new Set(Object.values(copy)).size===3,'each tab has its own empty-state copy',copy);
  // both entry points open the same dialog
  const sig=async()=>page.evaluate(()=>{const d=document.querySelector('.event-form-dialog');return d&&{title:d.querySelector('.dialog-title').textContent,labels:[...d.querySelectorAll('label')].map(l=>l.textContent.trim()).join('|'),times:!!d.querySelector('#efSTime'),inline:!!document.querySelector('#taskTitleInput')}});
  await page.click('#taskAddBtn');await sleep(400);const fromPage=await sig();
  check(fromPage&&fromPage.title==='New task'&&fromPage.labels==='Title|Description|Due date|Calendar'&&!fromPage.times&&!fromPage.inline,'Add task opens the event-style dialog with title, description, due date, calendar and no times',fromPage);
  await page.keyboard.press('Escape');await sleep(400);
  await page.evaluate(()=>{state.section='calendar';renderAll(false);document.querySelector('.create-main, .sidebar-add-rail').click()});await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(x=>x.textContent.trim().startsWith('Task')).click());await sleep(500);
  const fromMenu=await sig();
  check(fromMenu&&JSON.stringify(fromMenu)===JSON.stringify(fromPage),'the Create menu Task option opens the same dialog',fromMenu);
  await page.type('#teTitle','Renew passport');await page.type('#teDesc','Bring two photos and the old passport.');
  await page.click('#teDue');await sleep(250);
  const popOpen=await page.evaluate(()=>({pop:!!document.getElementById('datePop'),menu:!!document.querySelector('.menu .menu-item')}));
  check(popOpen.pop&&!popOpen.menu,'the due-date control opens the calendar popup on the first click (like the event date)',popOpen);
  await page.evaluate(()=>{const start=weekStartOf(dt(TODAY.getFullYear(),TODAY.getMonth(),1));const idx=Math.round((sod(addDays(TODAY,1))-start)/864e5);document.querySelectorAll('#datePop .mini-day')[idx].click()});await sleep(250);
  await page.click('[data-ok]');await sleep(700);
  check(await page.evaluate(()=>state.section==='tasks'&&!state.events.some(e=>e.title==='Renew passport')),'the created task shows in Tasks, not on the calendar');
  let row=await page.evaluate(()=>{const r=document.querySelector('.task-row');return r&&{title:r.querySelector('.task-title').textContent,desc:(r.querySelector('.task-desc')||{}).textContent,due:r.querySelector('.tm-due').textContent.trim()}});
  check(row&&row.title==='Renew passport'&&/Bring two photos/.test(row.desc||'')&&/Tomorrow/.test(row.due),'a task is created with its description and due date, and the description shows on the task',row);
  check(await page.evaluate(()=>/1 active · 0 completed/.test(document.querySelector('.tasks-sub').textContent)&&[...document.querySelectorAll('.task-seg button')].every(b=>/\d/.test(b.textContent))),'counts appear once there are tasks');
  // editor
  await page.click('.task-row .task-title');await sleep(400);
  const fmtTomorrow=await page.evaluate(()=>fmtDateShort(sod(addDays(TODAY,1))));
  const ed=await page.evaluate(()=>({t:document.querySelector('#teTitle').value,d:document.querySelector('#teDesc').value,due:document.querySelector('#teDue').textContent.trim(),cal:!!document.querySelector('#teCal')}));
  check(ed.t==='Renew passport'&&/two photos/.test(ed.d)&&ed.due===fmtTomorrow&&ed.cal,'opening a task shows its editor (title, description, due date, calendar)',ed);
  if(theme==='light')await page.screenshot({path:process.env.SHOTS?process.env.SHOTS+'/tasks-editor.png':undefined}).catch(()=>{});
  await page.$eval('#teDesc',e=>{e.value='Bring three photos and the old passport.'});
  await page.click('#teDue');await sleep(250);await page.click('#datePop .dp-clear');await sleep(200);
  await page.click('[data-ok]');await sleep(600);
  row=await page.evaluate(()=>{const r=document.querySelector('.task-row');return {desc:r.querySelector('.task-desc').textContent,due:r.querySelector('.tm-due').textContent.trim(),group:[...document.querySelectorAll('.task-group-title')].map(g=>g.textContent)}});
  check(/three photos/.test(row.desc)&&row.due==='No date'&&row.group.some(g=>/^No date/.test(g)),'editing saves the description and can clear the due date (No date group)',row);
  check(await page.evaluate(()=>state.tasks[0].desc==='Bring three photos and the old passport.'&&state.tasks[0].due===null),'and the change is in the task data');
  if(theme==='light')await page.screenshot({path:process.env.SHOTS?process.env.SHOTS+'/tasks-list.png':undefined}).catch(()=>{});
  await page.evaluate(()=>openSearch());await sleep(300);await page.type('#palInput','passport');await sleep(400);
  const sr=await page.evaluate(()=>({groups:[...document.querySelectorAll('.pal-group')].map(g=>g.textContent),titles:[...document.querySelectorAll('.pal-item .pi-title')].map(x=>x.textContent),label:document.querySelector('.palette').getAttribute('aria-label')}));
  check(sr.groups.some(g=>/^Tasks/.test(g))&&sr.titles.includes('Renew passport')&&sr.label==='Search','search finds tasks, in a TASKS section',sr);
  await page.keyboard.press('Escape');await sleep(300);
  check(app.errors.length===0,'no page errors',app.errors);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
