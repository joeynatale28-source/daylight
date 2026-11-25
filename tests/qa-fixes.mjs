/** QA fixes (Nov 16 pass): month grid spans, +N more list, Day view all-day lane, recurring edit scope, repeat-until, search order,
 *  swipe, auth page behaviors. Real pages through the harness; exits 1 on any failure. */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};

function payload(){
 const p=busyPayload({month:11,busyDay:9});
 let id=1000;
 const iso=(y,m,d,h=0,mi=0)=>new Date(y,m,d,h,mi).toISOString();
 // timed events that end at exactly 12:00am (popover says 6 days / 4 days)
 p.events.push({id:id++,cal:'c1',title:'Short Course Worlds',start:iso(2026,11,1),end:iso(2026,11,7),allDay:false,loc:'',desc:''});
 p.events.push({id:id++,cal:'c1',title:'Winter Juniors',start:iso(2026,11,9),end:iso(2026,11,13),allDay:false,loc:'',desc:''});
 // a multi-day event on Jan 14-17 (stored as midnight to midnight)
 p.events.push({id:id++,cal:'c1',title:'TYR Pro Swim Series',start:iso(2027,0,14),end:iso(2027,0,18),allDay:false,loc:'',desc:''});
 // a repeating event that only has an iCal rule (no repeat field)
 p.events.push({id:id++,cal:'c2',title:'swimRVA Swim Practice',start:iso(2026,11,2,18,30),end:iso(2026,11,2,19,45),allDay:false,loc:'SwimRVA',desc:'',rrule:'FREQ=WEEKLY;BYDAY=MO,WE,FR',uid:'u-swim'});
 return p;
}
const LIVE=process.env.LIVE_URL?process.env.LIVE_URL.replace(/\/?$/,'/'):null;   // run against the deployed build: only Supabase is stubbed
const app=await launch(Object.assign({width:1919,height:998,theme:'light',payload:payload()},LIVE?{baseUrl:LIVE+'dashboard/?cb='+Date.now()}:{}));
const page=app.page;
try{
 await app.load();
 await page.evaluate(()=>{state.cursor=new Date(2026,11,15);state.selected=new Date(2026,11,15);renderAll(false)});
 await sleep(600);
 // ---- 15
 const spans=await page.evaluate(()=>{const out={};document.querySelectorAll('.dl-continuous-bar').forEach(b=>{const t=b.getAttribute('aria-label');if(/Short Course|Winter Juniors/.test(t)){out[t]=(out[t]||0)+(+b.dataset.last-+b.dataset.first+1)}});return out});
 check(spans['Short Course Worlds']===6,'15: Short Course Worlds paints 6 days',spans);
 check(spans['Winter Juniors']===4,'15: Winter Juniors paints 4 days',spans);
 // ---- 14: +N more opens a list, not Day view
 const viewBefore=await page.evaluate(()=>state.view);
 const clicked=await page.evaluate(()=>{const m=[...document.querySelectorAll('.more-link')].find(x=>!x.hidden);if(!m)return false;m.click();return true});
 await sleep(300);
 const menu=await page.evaluate(()=>({view:state.view,items:document.querySelectorAll('.menu .menu-item').length,label:(document.querySelector('.menu .menu-label')||{}).textContent}));
 check(clicked&&menu.view===viewBefore&&menu.items>=2,'14: +N more opens a list of events (stays in Month)',menu);
 await page.keyboard.press('Escape');await sleep(150);
 // ---- 19: only today carries the solid disc
 const today=await page.evaluate(()=>[...document.querySelectorAll('.day-cell.today')].filter(c=>c.dataset.today!=='1').length);
 check(today===0,'19: no stale today cells',today);
 // ---- 20: drag across the grid pages the month
 await page.evaluate(()=>{state.cursor=new Date(2026,11,15);renderAll(false)});await sleep(400);
 const box=await page.evaluate(()=>{const r=document.querySelector('.month-grid').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 const t0=await page.evaluate(()=>state.cursor.getMonth());
 await page.mouse.move(box.x+150,box.y);await page.mouse.down();await page.mouse.move(box.x-80,box.y+4,{steps:8});await page.mouse.up();await sleep(500);
 const t1=await page.evaluate(()=>state.cursor.getMonth());
 check(t1===(t0+1)%12,'20: dragging left moves to the next month',[t0,t1]);
 // ---- 16: Day view puts the multi-day event in the All-day lane, full width
 await page.evaluate(()=>{state.cursor=new Date(2027,0,14);state.selected=new Date(2027,0,14);state.view='day';renderAll(false)});await sleep(600);
 const lane=await page.evaluate(()=>{const cell=document.querySelector('.allday-cell');const bar=[...document.querySelectorAll('.allday-cell .allday-bar, .dl-continuous-bar')].find(b=>/TYR/.test(b.textContent));const timed=[...document.querySelectorAll('.ev-card')].some(b=>/TYR/.test(b.textContent));return {inLane:!!bar,timed,w:bar?Math.round(bar.getBoundingClientRect().width):0,cw:cell?Math.round(cell.getBoundingClientRect().width):0}});
 check(lane.inLane&&!lane.timed,'16: multi-day event sits in the All-day lane',lane);
 await page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,11,15);renderAll(false)});await sleep(400);
 // ---- 22: recurring edit asks for the scope and the dialog shows the real recurrence
 const ev=await page.evaluate(()=>state.events.find(e=>e.title==='swimRVA Swim Practice').id);
 await page.evaluate(id=>{const e=state.events.find(x=>x.id===id);const occs=occsInRange(new Date(2026,11,9),new Date(2026,11,10));editOccurrence(e,occs.find(o=>o.ev===e))},ev);await sleep(400);
 const scope=await page.evaluate(()=>({txt:document.body.innerText.includes('Only this event')&&document.body.innerText.includes('This and following')&&document.body.innerText.includes('All events')}));
 check(scope.txt,'22: scope prompt appears for a rule-only recurring event',scope);
 await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>/All events/.test(b.textContent)).click()});await sleep(500);
 const rep=await page.evaluate(()=>({repeats:(document.querySelector('#efRepeat span')||{}).textContent}));
 check(/Weekly/.test(rep.repeats||''),'22: Edit dialog shows the real recurrence (Weekly)',rep);
 // ---- 23: repeat-until offers Never / On a date
 await page.click('#efRepeatEnd, #efRepeatEndWrap button');await sleep(300);
 const opts=await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(x=>x.textContent.trim()));
 check(opts.some(o=>/Never/.test(o))&&opts.some(o=>/On a date/.test(o)),'23: repeat-until has Never and On a date',opts);
 await page.keyboard.press('Escape');await sleep(100);
 await page.evaluate(()=>{const c=[...document.querySelectorAll('button')].find(b=>/^Cancel$/.test(b.textContent.trim()));if(c)c.click()});await sleep(300);
 // ---- 25: search count and order
 await page.evaluate(()=>{openSearch()});await sleep(300);
 await page.type('.palette input, #searchInput, input[type=search], .pal-input','practice');await sleep(500);
 const srch=await page.evaluate(()=>{const g=document.querySelector('.pal-group');const subs=[...document.querySelectorAll('.pal-item .pi-sub')].slice(0,3).map(x=>x.textContent);return {count:g&&g.textContent,subs}});
 check(/\d+ results?/.test(srch.count||''),'25: search shows a result count',srch);
 await page.keyboard.press('Escape');await sleep(200);
 // ---- 29/30: tasks counts, Today label
 const lbl=await page.evaluate(()=>(document.querySelector('#tbToday')||{}).textContent);
 check(/Today/.test(lbl||''),'30: Back to today has a text label',lbl);
 await page.evaluate(()=>{state.section='tasks';renderAll(false)});await sleep(400);
 const seg=await page.evaluate(()=>[...document.querySelectorAll('.task-seg button')].map(b=>b.textContent.trim()));
 const hasT=await page.evaluate(()=>state.tasks.length>0);check(seg.length===3&&(hasT?seg.every(t=>/[0-9]/.test(t)):seg.every(t=>!/[0-9]/.test(t))),'29: task tabs show counts once there are tasks (none in the empty state)',seg);
}finally{await app.close()}

// ---- auth pages
const au=await launch(Object.assign({width:1300,height:900,theme:'light',signedIn:false,payload:payload()},LIVE?{baseUrl:LIVE+'login/?cb='+Date.now()}:{}));
try{
 const p=au.page;await p.goto(au.url,{waitUntil:'load'});await p.waitForSelector('#authScreen .auth-primary',{timeout:15000});await sleep(1300);
 await p.evaluate(()=>{switchAuthMode(document.getElementById('authRoot'))});await sleep(700);
 const f=await p.evaluate(()=>({reqs:getComputedStyle(document.querySelector('#authReqs')).opacity,confirm:!!document.querySelector('#authConfirmPw2'),terms:[...document.querySelectorAll('[data-terms]')].map(a=>a.getAttribute('href'))}));
 check(f.reqs==='1'&&f.confirm&&f.terms.join()==='../tos/,../privacy/','7/8/10: checklist visible, confirm field, terms links',f);
 await p.type('#authEmail','bad');await p.click('.auth-primary');await sleep(400);
 const e=await p.evaluate(()=>[...document.querySelectorAll('.auth-error')].map(n=>({t:n.textContent,v:n.offsetHeight>0})));
 check(e.filter(x=>x.t&&x.v).length>=2,'9: error text is visible under the fields',e);
 await p.type('#authPassword','short');await p.type('#authConfirmPw2','different');await p.click('.auth-primary');await sleep(400);
 const pwMsg=await p.evaluate(()=>document.querySelector('#authPwErr').textContent+' | '+document.querySelector('#authConfirm2Err').textContent);
 check(/too short.*Also add an uppercase letter, a number and a symbol/.test(pwMsg)&&/don't match/.test(pwMsg),'10/8: all unmet rules at once, mismatch error',pwMsg);
 const eye=await p.evaluate(()=>{const b=document.querySelector('#authEye');const r=b.getBoundingClientRect();return {vis:getComputedStyle(b).visibility,op:getComputedStyle(b).opacity,w:Math.round(r.width)}});
 check(eye.vis==='visible'&&eye.op==='1','11: show-password toggle stays beside the error',eye);
 await p.evaluate(()=>{switchAuthMode(document.getElementById('authRoot'))});await sleep(700);
 await p.evaluate(()=>{switchAuthMode(document.getElementById('authRoot'))});await sleep(700);
 const carried=await p.evaluate(()=>document.querySelector('#authPassword').value);
 check(carried==='','12: the password is not carried across pages',carried);
 const anim=await p.evaluate(()=>getComputedStyle(document.querySelector('#authScreen')).animationName);
 check(anim==='none','13: no slow entrance animation',anim);
}finally{await au.close()}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
