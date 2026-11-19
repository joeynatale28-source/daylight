/** Print month: black logo top-right opposite the title, single-line event titles, the 6-week month fits the page, printed-date footer. */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const p=busyPayload({month:10,spans:7});p.events.push({id:9001,cal:'c2',title:'swimRVA Swim Practice and a very long event title that must not wrap',start:new Date(2026,10,10,18,30).toISOString(),end:new Date(2026,10,10,19,45).toISOString(),allDay:false,loc:'',desc:''});
const app=await launch({width:1440,height:900,theme:'dark',payload:p});const page=app.page;
try{
 await app.load();await sleep(500);
 await page.evaluate(()=>{state.cursor=new Date(2026,7,17);state.view='month';renderAll(false);daylightPrintMonth()});await sleep(1500);
 const frame=page.frames().find(f=>f!==page.mainFrame()&&f.parentFrame());
 const r=await frame.evaluate(()=>{const d=document,page=d.getElementById('dlPrint').getBoundingClientRect(),logo=d.querySelector('.pm-logo').getBoundingClientRect(),title=d.querySelector('.pm-title').getBoundingClientRect(),foot=d.querySelector('.pm-foot').getBoundingClientRect(),weeks=[...d.querySelectorAll('.pm-week')];
  const wraps=[...d.querySelectorAll('.pm-ev,.pm-bar')].filter(e=>e.getBoundingClientRect().height>16).length;
  const clipped=weeks.map((w,i)=>[...w.querySelectorAll('.pm-ev,.pm-bar,.pm-more')].some(e=>e.getBoundingClientRect().bottom>w.getBoundingClientRect().bottom+1)?i:-1).filter(i=>i>=0);
  return {weeks:weeks.length,logoRight:Math.round(page.right-logo.right),titleLeft:Math.round(title.left-page.left),sameRow:Math.abs((logo.top+logo.height/2)-(title.top+title.height/2))<6,black:getComputedStyle(d.querySelector('.pm-logo svg path')).fill||d.querySelector('.pm-logo svg path').getAttribute('fill'),wraps,clipped,footText:d.querySelector('.pm-foot').textContent,footInside:foot.bottom<=page.bottom+1,more:d.querySelectorAll('.pm-more').length}});
 check(r.weeks===6&&r.logoRight<=4&&r.titleLeft<=4&&r.sameRow,'the logo sits top-right, opposite the month title on the same row',r);
 check(String(r.black).replace(/ /g,'')==='rgb(0,0,0)','the logo is black',r.black);
 check(r.wraps===0,'event titles are single-line (truncated, never wrapped)',r.wraps);
 check(r.clipped.length===0&&r.footInside,'all six weeks fit the page: nothing cut off in any week, footer inside the page',r);
 check(/^Printed [A-Z][a-z]+ \d{1,2}, \d{4}$/.test(r.footText),'the footer shows the printed date',r.footText);
 if(process.env.SHOTS)await page.screenshot({path:process.env.SHOTS+'/print.png'});
 check(app.errors.length===0,'no page errors',app.errors);
}finally{await app.close()}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
