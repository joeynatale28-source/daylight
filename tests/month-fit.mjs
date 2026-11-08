/** Month grid fit check against the real page. Fails (exit 1) on any clipped chip/bar or a grid that neither fits nor scrolls. */
import {launch,busyPayload,measureMonth} from './harness.mjs';
const heights=(process.env.HEIGHTS||'1080,998,900,800,700,620').split(',').map(Number);
const months=[[10,'November'],[11,'December']];
let failed=false;
for(const theme of (process.env.THEMES||'dark,light').split(',')){
 for(const [month,name] of months){
  for(const h of heights){
   const app=await launch({width:1919,height:h,theme,payload:busyPayload({month,busyDay:month===11?9:10})});
   try{
    await app.page.evaluateOnNewDocument(m=>{window.__HARNESS_MONTH=m},month);
    await app.load();
    await app.page.evaluate(m=>{state.cursor=new Date(2026,m,15);renderAll(false)},month);
    await new Promise(r=>setTimeout(r,700));
    const m=await measureMonth(app.page);
    const ok=m.clipped.length===0&&m.fits&&!m.docOverflow;
    if(!ok)failed=true;
    console.log((ok?'PASS':'FAIL'),theme,name,h+'px','rows',JSON.stringify(m.rows),'scrolls',m.scrolls,'lastRowBottom',m.lastRowBottom,'more',m.more.length,m.clipped.length?'CLIPPED '+JSON.stringify(m.clipped.slice(0,5)):'');
   }finally{await app.close()}
  }
 }
}
process.exit(failed?1:0);
