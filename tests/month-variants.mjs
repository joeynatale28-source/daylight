/** Month grid at 1920x999 under real-account variations (banner above the app, week numbers, compact density, subscriptions, tasks): the last week is always fully reachable. */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const VARS={plain:()=>{},weekNumbers:()=>{state.weekNumbers=true},compact:()=>{state.density='compact'},banner:()=>{const h=document.createElement('div');h.id='dlBanners';h.style.cssText='height:44px;background:#222;color:#fff';h.textContent='Announcement';document.getElementById('app').before(h);document.documentElement.style.setProperty('--dl-banner-h','44px')},bannerUnmeasured:()=>{const h=document.createElement('div');h.id='dlBanners';h.style.cssText='height:44px;background:#222;color:#fff';h.textContent='Announcement';document.getElementById('app').before(h)}};
for(const theme of ['dark','light'])for(const [name,fn] of Object.entries(VARS)){
 const app=await launch({theme,width:1920,height:999,payload:busyPayload()});const {page}=app;
 try{
  await app.load();await sleep(500);
  await page.evaluate(f=>{eval('('+f+')')();state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)},VARS[name].toString());await sleep(600);
  const r=await page.evaluate(()=>{const grid=document.querySelector('.month-grid');grid.scrollTop=grid.scrollHeight;const g=grid.getBoundingClientRect(),rows=[...grid.querySelectorAll('.month-week')],last=rows[rows.length-1].getBoundingClientRect(),app=document.getElementById('app').getBoundingClientRect();return {rows:rows.length,gridBottom:Math.round(g.bottom),lastBottom:Math.round(last.bottom),appBottom:Math.round(app.bottom),vh:innerHeight,scrolls:grid.scrollHeight>grid.clientHeight+1,docScroll:document.documentElement.scrollHeight>innerHeight+1}});
  check(r.lastBottom<=r.gridBottom+1&&r.gridBottom<=r.vh+1&&r.appBottom<=r.vh+1,`${theme} ${name}: last week fully visible inside the window`,r);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
