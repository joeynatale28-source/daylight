/** Desktop polish sweep: screenshots of every page in both themes (set SHOTS), plus page errors and anything poking out of its card. */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,400)))};
const SHOTS=process.env.SHOTS||null;
for(const theme of ['light','dark']){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload()});const {page}=app;
 try{
  await app.load();await sleep(500);
  const step=async(name,fn)=>{await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove());if(window.settingsState)settingsState.transactionActive=false});await page.evaluate(typeof fn==='string'?'('+fn+')()':fn);await sleep(900);if(SHOTS)await page.screenshot({path:`${SHOTS}/d-${theme}-${name}.png`})};
  await step('week',()=>{state.section='calendar';state.view='week';renderAll(false)});
  await step('day',()=>{state.view='day';renderAll(false)});
  await step('tasks',()=>{state.tasks=[mkTask('Call the plumber','c3',sod(TODAY),false,false,'Ask about the leak'),mkTask('Buy paint','c1',addDays(sod(TODAY),-2),false,false,''),mkTask('Renew passport','c4',addDays(sod(TODAY),9),false,false,'')];state.section='tasks';renderAll(false)});
  await step('support',()=>{window.daylightAdmin=window.daylightAdmin||{};window.daylightAdmin.isOwner=()=>true;window.daylightSupport.open()});
  for(const t of ['notifications','banners','maintenance','users'])await step('admin-'+t,`()=>{state.section='admin';renderAll(false);document.querySelector('[data-tab=${t}]').click()}`);
  for(const s of ['profile','appearance','calendar','notifications','shortcuts','ai'])await step('settings-'+s,`()=>{state.section='calendar';renderAll(false);openSettings('${s}')}`);
  check(app.errors.length===0,`${theme}: no page errors across every page`,app.errors);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
