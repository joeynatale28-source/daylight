// Item 8d: in the Week view a partly hidden time line (e.g. a stray "pm" beside a school block's title after scrolling) must render
// fully or not at all. For every scroll position the time lines that are visible are measured: each must sit completely inside its
// card AND inside the scroll area, and none may be cut by an ellipsis. Both themes; Week as the default view.
import fs from 'node:fs';import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','week-time-clip');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
for(const theme of ['dark','light']){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload()});
 const {page}=app;await app.load();await sleep(900);
 try{
  await page.evaluate(()=>{state.defaultView='week';state.view='week';state.section='calendar';renderAll(false)});
  /* A school week: tall Mon-Fri blocks (with overlapping neighbours so some columns are narrow) plus short ones. */
  await page.evaluate(()=>{const cal=state.calendars.find(c=>!c.subscribed&&!c.builtin).id;let id=9000;
   for(let d=16;d<=20;d++){
    state.events.push({id:++id,cal,title:'Hungry Creek Middle School',start:new Date(2026,10,d,8,0),end:new Date(2026,10,d,15,10),allDay:false,loc:'Francistown Rd',desc:''});
    state.events.push({id:++id,cal,title:'Swim practice',start:new Date(2026,10,d,14,0),end:new Date(2026,10,d,17,30),allDay:false,loc:'',desc:''});
    state.events.push({id:++id,cal,title:'Homework',start:new Date(2026,10,d,18,0),end:new Date(2026,10,d,19,0),allDay:false,loc:'',desc:''});
    state.events.push({id:++id,cal,title:'Band',start:new Date(2026,10,d,15,30),end:new Date(2026,10,d,16,0),allDay:false,loc:'',desc:''});
   }
   state.cursor=new Date(2026,10,16);state.selected=new Date(2026,10,16);renderAll(false)});await sleep(800);
  const info=await page.evaluate(()=>{const s=document.querySelector('.tg-scroll');return {h:s.clientHeight,total:s.scrollHeight,cards:document.querySelectorAll('.tg-body .ev-card').length}});
  check(`${theme}: the week view has event blocks to measure`,info.cards>5,JSON.stringify(info));
  let bad=[],checked=0;
  for(let top=0;top<=info.total-info.h+60;top+=37){
   await page.evaluate(t=>{const s=document.querySelector('.tg-scroll');s.style.scrollBehavior='auto';s.scrollTop=t},top);await sleep(60);
   const r=await page.evaluate(()=>{const s=document.querySelector('.tg-scroll'),sr=s.getBoundingClientRect(),bad=[];let n=0;
    document.querySelectorAll('.tg-body .ev-card .ev-time').forEach(t=>{if(getComputedStyle(t).visibility==='hidden'||getComputedStyle(t).display==='none')return;n++;
     const tr=t.getBoundingClientRect(),cr=t.closest('.ev-card').getBoundingClientRect();
     const inCard=tr.top>=cr.top-0.5&&tr.bottom<=cr.bottom+0.5&&tr.left>=cr.left-0.5&&tr.right<=cr.right+0.5;
     const inScroll=tr.top>=sr.top-0.5&&tr.bottom<=sr.bottom+0.5;
     const cut=t.scrollWidth>t.clientWidth+1;
     if(!inCard||!inScroll||cut)bad.push({text:t.textContent,inCard,inScroll,cut,top:Math.round(tr.top-sr.top)});});
    return {n,bad}});
   checked+=r.n;bad=bad.concat(r.bad.map(b=>({scroll:top,...b})));
  }
  check(`${theme}: every visible time line is whole (inside its block and the scroll area, never cut) at every scroll position`,bad.length===0&&checked>20,JSON.stringify({checked,bad:bad.slice(0,6)}));
  await page.evaluate(()=>{const s=document.querySelector('.tg-scroll');s.scrollTop=420});await sleep(300);
  await page.screenshot({path:path.join(out,`week-scrolled-${theme}.png`)});
 }finally{await app.close()}
}
if(failed){console.log('week time clip FAILED');process.exit(1)}
console.log('PASS week time clip');
