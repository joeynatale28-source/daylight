/** The month switcher's buttons must never move, and 12 fast clicks from one cursor position must land every time. */
import assert from 'node:assert/strict';
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const box=async(page,sel)=>page.$eval(sel,n=>{const r=n.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(v=>Math.round(v*100)/100)});
for(const theme of (process.env.THEMES||'dark,light').split(',')){
 const app=await launch({theme,width:1440,height:900});
 const {page}=app;
 try{
  await app.load();
  const seen=new Map();
  for(const year of [2026,2030]){
   for(let m=0;m<12;m++){
    await page.evaluate((y,m)=>{state.view='month';state.cursor=new Date(y,m,15);renderAll(false)},year,m);
    const name=await page.$eval('#tbMonth',n=>n.textContent);
    seen.set(name,{prev:await box(page,'#tbPrev'),next:await box(page,'#tbNext'),today:await box(page,'#tbToday'),h:await page.$eval('#headerBand',n=>n.offsetHeight)});
   }
  }
  const sets=new Set([...seen.values()].map(v=>JSON.stringify([v.prev,v.next,v.today])));
  const may=seen.get('May 2026'),sep=seen.get('September 2026');
  console.log(theme,'forward button bbox  May 2026:',JSON.stringify(may.next),' September 2026:',JSON.stringify(sep.next),' distinct button layouts across 24 months:',sets.size,' header height:',may.h);
  if(sets.size!==1){failed=true;console.log('FAIL '+theme+': buttons move with the label')}
  // 12 real clicks from one fixed cursor position
  await page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,0,15);renderAll(false)});
  const b=await box(page,'#tbNext'),x=b[0]+b[2]/2,y=b[1]+b[3]/2;
  const start=await page.evaluate(()=>state.cursor.getFullYear()*12+state.cursor.getMonth());
  let landed=0,onLabel=0;
  for(let i=0;i<12;i++){
   const hit=await page.evaluate((x,y)=>{const n=document.elementFromPoint(x,y);return n&&(n.closest('#tbNext')?'next':n.closest('#tbMonth')?'label':n.tagName)},x,y);
   if(hit==='label')onLabel++;
   await page.mouse.click(x,y);
   const now=await page.evaluate(()=>state.cursor.getFullYear()*12+state.cursor.getMonth());
   if(now===start+i+1)landed++;
  }
  const end=await page.evaluate(()=>state.cursor.getFullYear()*12+state.cursor.getMonth());
  console.log(theme,'12 clicks at ('+x+', '+y+'): registered',landed,'/12, advanced',end-start,'months, cursor over label',onLabel,'times');
  if(landed!==12||end-start!==12||onLabel){failed=true;console.log('FAIL '+theme+': clicks missed')}
  // Day view keeps its buttons fixed too
  const dayBoxes=new Set();
  for(const ms of [new Date(2026,0,1).getTime(),new Date(2026,8,30).getTime(),new Date(2026,4,5).getTime()]){await page.evaluate(ms=>{const d=new Date(ms);state.view='day';state.cursor=d;state.selected=d;renderAll(false)},ms);dayBoxes.add(JSON.stringify([await box(page,'#tbPrev'),await box(page,'#tbNext')]))}
  if(dayBoxes.size!==1){failed=true;console.log('FAIL '+theme+': Day view buttons move')}
 }finally{await app.close()}
}
console.log(failed?'FAILED':'PASSED');
process.exit(failed?1:0);
