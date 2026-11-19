/** Month grid: the last row has visible clearance below it (not flush with the window edge) and is reachable at every height. */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
for(const theme of ['dark','light'])for(const [w,h] of [[1919,998],[1440,800],[1280,700],[390,800]]){
 const app=await launch({theme,width:w,height:h,payload:busyPayload()});const {page}=app;
 try{
  await app.load();await sleep(500);
  await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,11,10);renderAll(false)});await sleep(600);
  const r=await page.evaluate(()=>{const grid=document.querySelector('.month-grid');grid.scrollTop=grid.scrollHeight;const rows=[...grid.querySelectorAll('.month-week')],last=rows[rows.length-1].getBoundingClientRect(),g=grid.getBoundingClientRect();return {rows:rows.length,clear:Math.round(innerHeight-last.bottom),gridBottom:Math.round(g.bottom),lastBottom:Math.round(last.bottom),vh:innerHeight,border:getComputedStyle(rows[rows.length-1]).borderBottomWidth,scrolls:grid.scrollHeight>grid.clientHeight+1}});
  check(r.rows===6&&r.clear>=10&&r.lastBottom<=r.gridBottom&&r.border==='1px',`${theme} ${w}x${h}: all 6 rows, last row bottom edge visible with ${r.clear}px clearance (scrolls: ${r.scrolls})`,r);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
