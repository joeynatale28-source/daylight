/** Phone width sweep (390px, light and dark): Calendar, Tasks, Support Center, Admin (owner) and Settings are usable: nothing scrolls sideways, nothing sticks out of the screen, controls are reachable. */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,400)))};
const SHOTS=process.env.SHOTS||null;
const PAGES={
 calendar:()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,11,9);renderAll(false)},
 tasks:()=>{state.tasks=[mkTask('Call the plumber','c3',sod(TODAY),false,false,'Ask about the leak'),mkTask('Buy paint','c1',addDays(sod(TODAY),-2),false,false,'')];state.section='tasks';renderAll(false)},
 support:()=>{window.daylightSupport.open()},
 admin:()=>{window.daylightAdmin=window.daylightAdmin||{};window.daylightAdmin.isOwner=()=>true;state.section='admin';renderAll(false)},
 settings:()=>{state.section='calendar';renderAll(false);openSettings('profile')},
};
for(const theme of ['light','dark']){
 const app=await launch({theme,width:390,height:844,payload:busyPayload()});const {page}=app;
 try{
  await app.load();await sleep(500);
  for(const [name,fn] of Object.entries(PAGES)){
   await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove());if(window.settingsState)settingsState.transactionActive=false});
   await page.evaluate(fn);await sleep(1100);
   if(name==='admin'){for(const t of ['notifications','banners','maintenance','users']){await page.evaluate(t=>document.querySelector('[data-tab='+t+']').click(),t);await sleep(500);if(SHOTS)await page.screenshot({path:`${SHOTS}/m-${theme}-admin-${t}.png`});
     const r=await page.evaluate(()=>{const W=innerWidth,out=[];document.querySelectorAll('.dl-page *').forEach(e=>{if(!e.offsetParent)return;const b=e.getBoundingClientRect();if(b.width&&(b.right>W+1||b.left<-1)&&!e.closest('.dl-tabs'))out.push((e.className||e.tagName)+':'+Math.round(b.left)+'-'+Math.round(b.right))});return {over:document.documentElement.scrollWidth>W+1,out:out.slice(0,5)}});
     check(!r.over&&r.out.length===0,`${theme} phone: Admin › ${t} fits the screen`,r)}continue}
   if(SHOTS)await page.screenshot({path:`${SHOTS}/m-${theme}-${name}.png`});
   const r=await page.evaluate(()=>{const W=innerWidth,out=[];document.querySelectorAll('body *').forEach(e=>{if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')return;const b=e.getBoundingClientRect();if(!b.width||!b.height)return;if(e.closest('.dl-tabs,.task-seg,#sidebar,.settings-rail,.month-grid,.dow-row,svg,.menu,.dd-menu'))return;if(b.right>W+1||b.left<-1)out.push((e.className&&e.className.baseVal===undefined?e.className:e.tagName)+':'+Math.round(b.left)+'-'+Math.round(b.right))});return {over:document.documentElement.scrollWidth>W+1,out:out.slice(0,6)}});
   check(!r.over&&r.out.length===0,`${theme} phone: ${name} fits the screen`,r);
  }
  check(app.errors.length===0,`${theme} phone: no page errors`,app.errors);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
