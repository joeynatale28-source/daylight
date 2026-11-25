/** Live, throwaway account: the task due-date button shows the full date, opens the calendar popup on the first click, picking sets it, "No date" removes it. SITE=local or default deployed. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const browser=await launchBrowser();
try{
 const A=await makeUser('td');const tok=await tokenFor(A);
 const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(site.url+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s))},tok);
 await page.goto(site.url+'dashboard/tasks',{waitUntil:'load'});await sleep(6000);
 await page.evaluate(()=>{const c=state.calendars.find(c=>!c.subscribed&&!c.builtin&&!c.holiday)||state.calendars[0];state.tasks.push(mkTask('Live due-date check',c.id,sod(TODAY),false,false,''));refreshTasks(false)});await sleep(500);
 const full=await page.evaluate(()=>fmtDateShort(sod(TODAY)));
 await page.click('.task-row .icon-btn[title="Edit task"]');await sleep(600);
 check(await page.evaluate(()=>document.querySelector('#teDue span').textContent)===full&&/\d{4}/.test(full),'live: the due-date button shows the full date ('+full+')');
 await page.click('#teDue');await sleep(500);
 const o=await page.evaluate(()=>({pop:!!document.getElementById('datePop'),menu:!!document.querySelector('.menu'),clear:!!document.querySelector('#datePop .dp-clear')}));
 check(o.pop&&!o.menu&&o.clear,'live: the first click opens the calendar popup (no shortcut menu) with a "No date" link',o);
 await page.evaluate(()=>{const d=[...document.querySelectorAll('#datePop .dp-day:not(.dim)')].find(b=>b.textContent.trim()==='15');d.click()});await sleep(300);
 check(/15, \d{4}/.test(await page.evaluate(()=>document.querySelector('#teDue span').textContent)),'live: picking a day shows it as a full date');
 await page.click('#teDue');await sleep(500);await page.click('#datePop .dp-clear');await sleep(300);
 check(await page.evaluate(()=>document.querySelector('#teDue span').textContent)==='No date','live: "No date" removes the due date');
 await page.click('[data-ok]');await sleep(600);
 check(await page.evaluate(()=>state.tasks[0].due===null),'live: saved with no due date');
 check(errs.length===0,'live: no page errors',errs);
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
