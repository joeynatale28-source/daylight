// Screenshot helper for the week-view time-line fragment: HARNESS_ROOT picks the build, TAG names the output.
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tag=process.env.TAG||'after',out=path.join('ui-screenshots','pm-fragment');
for(const theme of ['dark','light']){
 const app=await launch({theme,width:1280,height:800,payload:busyPayload()});
 const {page}=app;await app.load();
 await page.evaluate(()=>{state.events.push({id:99001,title:'School block',cal:state.calendars.find(c=>!c.subscribed&&!c.builtin).id,allDay:false,start:new Date(2026,11,8,8,35),end:new Date(2026,11,8,15,15),repeat:'none',reminder:'none'});state.section='calendar';state.view='week';state.cursor=new Date(2026,11,9);renderAll(false)});
 await sleep(500);
 await page.setViewport({width:1280,height:800,deviceScaleFactor:2});await sleep(300);
 const box=await page.evaluate(()=>{const sc=document.querySelector('.tg-scroll');sc.style.scrollBehavior='auto';
  const c=[...document.querySelectorAll('.tg-body .ev-card')].find(x=>/School block/.test(x.textContent));sc.scrollTop=c.offsetTop+24;
  const r=sc.getBoundingClientRect(),cr=c.getBoundingClientRect();return {x:cr.x-6,y:r.y-4,w:cr.width+12,h:90}});
 await sleep(400);
 await page.screenshot({path:path.join(out,`${tag}-${theme}.png`),clip:{x:Math.max(0,box.x),y:Math.max(0,box.y),width:box.w,height:box.h}});
 await app.close();
}
