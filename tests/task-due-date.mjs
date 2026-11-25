/** The task due-date control works like the event date control: the button shows the full date (Nov 20, 2026), one click opens the calendar popup (no Today / Tomorrow menu),
 *  picking a day sets it, and a "No date" link in the popup removes it. Editor button and the due chip on a task row. */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
for(const [theme,w,h] of [['light',1440,900],['dark',390,844]]){
 const app=await launch({theme,width:w,height:h});const {page}=app;const tag=`${theme} ${w}px`;
 try{
  await app.load();await sleep(500);
  await page.evaluate(()=>{state.tasks=[];state.tasks.push(mkTask('Pay rent',state.calendars.find(c=>!c.subscribed&&!c.builtin).id,sod(TODAY),false,false,''));showTasks()});await sleep(500);
  const full=await page.evaluate(()=>fmtDateShort(sod(TODAY)));
  await page.evaluate(()=>document.querySelector('.task-row .icon-btn[title="Edit task"]').click());await sleep(500);
  const lab=await page.evaluate(()=>document.querySelector('#teDue span').textContent);
  check(lab===full&&/\d{4}/.test(lab),`${tag}: the editor's due-date button shows the full date`,{lab,full});
  await page.click('#teDue');await sleep(400);
  let o=await page.evaluate(()=>({pop:!!document.getElementById('datePop'),menu:!!document.querySelector('.menu'),clear:!!document.querySelector('#datePop .dp-clear'),txt:document.querySelector('#datePop')?.innerText||''}));
  check(o.pop&&!o.menu&&!/Tomorrow|Pick a date/.test(o.txt),`${tag}: the first click opens the calendar popup, not the shortcut menu`,o);
  check(o.clear,`${tag}: the popup has a way to remove the date`,o);
  const target=await page.evaluate(()=>{const d=[...document.querySelectorAll('#datePop .dp-day:not(.dim)')].find(b=>b.textContent.trim()==='27');d.click();return fmtDateShort(new Date(TODAY.getFullYear(),TODAY.getMonth(),27))});await sleep(300);
  check(await page.evaluate(()=>document.querySelector('#teDue span').textContent)===target,`${tag}: picking a day sets it and the button shows the full date`);
  await page.click('#teDue');await sleep(700);await page.click('#datePop .dp-clear');await sleep(300);
  check(await page.evaluate(()=>document.querySelector('#teDue span').textContent==='No date'&&!document.getElementById('datePop')),`${tag}: "No date" removes the due date`);
  await page.click('#teDue');await sleep(300);
  check(await page.evaluate(()=>!!document.getElementById('datePop')&&!document.querySelector('#datePop .dp-clear')),`${tag}: with no date the popup opens (nothing to remove)`);
  await page.keyboard.press('Escape');await sleep(200);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove());const p=document.getElementById('datePop');if(p)p.remove()});
  /* the due chip on the task row behaves the same */
  await page.evaluate(()=>{state.tasks=[];state.tasks.push(mkTask('Call bank',state.calendars.find(c=>!c.subscribed&&!c.builtin).id,sod(TODAY),false,false,''));refreshTasks(false)});await sleep(400);
  await page.click('.task-row .tm-due');await sleep(300);
  o=await page.evaluate(()=>({pop:!!document.getElementById('datePop'),menu:!!document.querySelector('.menu')}));
  check(o.pop&&!o.menu,`${tag}: the due chip on a task row opens the calendar popup on the first click`,o);
  await page.click('#datePop .dp-clear');await sleep(400);
  check(await page.evaluate(()=>state.tasks[0].due===null&&/No date/.test(document.querySelector('.task-row .tm-due').textContent)),`${tag}: removing the date from the row works`);
  check(app.errors.filter(e=>!/reading 'status'/.test(e)).length===0,`${tag}: no page errors`,app.errors);
 }catch(e){bad++;console.log('FAIL exception '+String(e.stack||e).slice(0,300))}finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
