/**
 * Item 8a: November 2026 month view. At many real window sizes and display scalings, in both themes, with a busy account:
 *  - all six week rows are fully inside the grid or reachable by scrolling it;
 *  - nothing inside a row (event pills, bars, "+N more") is cut off by the row's or the grid's bottom edge;
 *  - after scrolling the grid to its end, the whole Dec 6-12 row is on screen (screenshot per theme).
 * LIVE_URL=<deployed build> runs the same checks against the deployed page.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','month-clip');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
// [width, height, scale]: CSS pixels the page actually gets (a 1920x1080 screen at 125% is 1536x~730 of page)
const SIZES=(process.env.SIZES?process.env.SIZES.split(',').map(s=>s.split('x').map(Number)):[[1920,1080,1],[1680,1050,1],[1536,730,1.25],[1536,864,1.25],[1440,900,1],[1366,768,1],[1280,720,1],[1280,650,1],[1229,584,1.5],[1024,768,1],[1280,560,1]]);
for(const theme of ['dark','light']){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await app.load();await sleep(500);
  await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});
  for(const [w,h,scale] of SIZES){
   await page.setViewport({width:w,height:h,deviceScaleFactor:scale});await sleep(500);
   const r=await page.evaluate(()=>{
    const grid=document.querySelector('.month-grid'),g=grid.getBoundingClientRect();
    const rows=[...grid.querySelectorAll('.month-week')];
    grid.scrollTop=grid.scrollHeight;
    const g2=grid.getBoundingClientRect();
    const last=rows[rows.length-1].getBoundingClientRect();
    const cut=[];
    rows.forEach((row,i)=>{const rr=row.getBoundingClientRect();
     row.querySelectorAll('.chip,.more-link,.dl-continuous-bar').forEach(n=>{if(!n.getClientRects().length)return;const b=n.getBoundingClientRect();
      if(b.bottom>rr.bottom+1.5||b.bottom>g2.bottom+1.5)cut.push({row:i+1,t:(n.textContent||'').trim().slice(0,16),over:Math.round(Math.max(b.bottom-rr.bottom,b.bottom-g2.bottom))})})});
    return {vh:innerHeight,rows:rows.length,gridBottom:Math.round(g2.bottom),lastTop:Math.round(last.top),lastBottom:Math.round(last.bottom),rowH:Math.round(rows[0].getBoundingClientRect().height),scrolls:grid.scrollHeight>grid.clientHeight+1,cut:cut.slice(0,4),pageScrolls:document.documentElement.scrollHeight>innerHeight+1};
   });
   const fully=r.lastBottom<=r.gridBottom+1;
   check(`${theme} ${w}x${h}@${scale}: six rows, the last one fully visible after scrolling the grid to its end`,r.rows===6&&fully&&r.lastBottom<=r.vh+1,JSON.stringify(r));
   check(`${theme} ${w}x${h}@${scale}: nothing inside a row is cut off`,r.cut.length===0,JSON.stringify(r.cut));
   if([[1536,730],[1280,650],[1229,584]].some(([a,b])=>a===w&&b===h)){
    await page.screenshot({path:path.join(out,`dec6-12-${w}x${h}-${theme}.png`)});
   }
  }
 }finally{await app.close()}
}
if(failed){console.log('month clip FAILED');process.exit(1)}
console.log('PASS month clip');
