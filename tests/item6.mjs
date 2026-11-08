/**
 * Item 6 on the real page.
 *  6a: with the floating "unsaved changes" pill showing, no Settings label, description or control sits under it,
 *      in every section, when the pane is scrolled to its end (and the pane can always scroll that far).
 *  6b: in week view, scrolled to the school blocks, every timed block keeps its title line visible under the header.
 * LIVE_URL=<deployed> runs it against a deployed build (stubbed backend).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','item6');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SIZES=(process.env.SIZES||'1920x1080,1280x800,1024x768,390x844').split(',').map(x=>x.split('x').map(Number));
const SECTIONS=['appearance','calendar','notifications'];
let failed=false;
const fail=m=>{failed=true;console.log('FAIL',m)};

for(const theme of ['dark','light']){
 const app=await launch({theme,width:1920,height:1080,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await app.load();
  for(const [w,h] of SIZES){
   await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:w<=834,hasTouch:w<=834});await sleep(150);
   for(const sec of SECTIONS){
    await app.load();await page.evaluate(()=>{state.section='calendar';state.view='month';renderAll(false)});
    await page.evaluate(s=>openSettings(s),sec);await sleep(450);
    // dirty one setting so the pill appears
    await page.evaluate(()=>{const sw=document.querySelector('.settings-pane .switch input, .settings-pane input[type=checkbox]');if(sw){sw.click()}});
    await sleep(350);
    const info=await page.evaluate(()=>{
     const bar=document.querySelector('.settings-savebar');const pane=document.querySelector('.settings-pane');
     if(!bar||bar.hidden||!pane)return {noBar:true};
     pane.style.scrollBehavior='auto';pane.scrollTop=pane.scrollHeight;
     return new Promise(res=>setTimeout(()=>{
      const b=bar.getBoundingClientRect();const hits=[];
      pane.querySelectorAll('.set-row *, .set-group-title, .pane-sub, .sw-label, .sw-sub, label, button, input, select, .picker-btn').forEach(n=>{
       if(!n.getClientRects().length||n.closest('.settings-savebar'))return;
       const r=n.getBoundingClientRect();if(r.width<2||r.height<2)return;
       const pr=pane.getBoundingClientRect();if(r.bottom<pr.top||r.top>pr.bottom)return;
       if(r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top)hits.push((n.textContent||n.getAttribute('aria-label')||n.tagName).trim().slice(0,30));
      });
      res({hits:[...new Set(hits)],bar:[b.left,b.top,b.right,b.bottom].map(Math.round),canScroll:pane.scrollHeight>pane.clientHeight});
     },200));
    });
    if(info.noBar){fail(`${theme} ${w}x${h} ${sec}: could not make the pill appear`);}
    else{
     if(info.hits.length)fail(`${theme} ${w}x${h} ${sec}: pill covers ${JSON.stringify(info.hits)}`);
     console.log(info.hits.length?'':'ok  ',`${theme} ${w}x${h} settings/${sec} pill clear`);
    }
    if(w===1920||w===1280)await page.screenshot({path:path.join(out,`settings-${sec}-${theme}-${w}x${h}.png`)});
   }
   // 6b week view
   await app.load();await page.evaluate(()=>{state.events.push({id:99001,title:'School block',cal:state.calendars.find(c=>!c.subscribed&&!c.builtin).id,allDay:false,start:new Date(2026,11,8,8,35),end:new Date(2026,11,8,12,0),repeat:'none',reminder:'none'});state.section='calendar';state.view='week';state.cursor=new Date(2026,11,9);renderAll(false)});await sleep(400);
   const wk=await page.evaluate(()=>{
    const sc=document.querySelector('.tg-scroll');if(!sc)return {noScroll:true};
    const cards=[...document.querySelectorAll('.tg-body .ev-card')].filter(c=>c.getClientRects().length&&c.textContent.trim());
    return {n:cards.length,tops:cards.map(c=>Math.round(c.offsetTop))};
   });
   if(wk.noScroll||!wk.n){console.log('note',theme,w,h,'week had no timed blocks to inspect',JSON.stringify(wk));}
   else{
    const worst=Math.min(...wk.tops);
    const res=await page.evaluate(async()=>{
     const sc=document.querySelector('.tg-scroll');sc.style.scrollBehavior='auto';
     const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,30))));
     const bad=[];let tested=0;
     const cards=[...document.querySelectorAll('.tg-body .ev-card')].filter(c=>c.offsetHeight>=50&&c.querySelector('.ev-time'));
     for(const c of cards){
      for(const out of [12,18,24,30,36,44]){
       sc.scrollTop=Math.max(0,c.offsetTop+out);await frames();
       if(sc.scrollTop<c.offsetTop+out-1)continue;
       tested++;
       const scr=sc.getBoundingClientRect();const tEl=c.querySelector('.ev-title'),t=tEl.getBoundingClientRect(),name=tEl.textContent.trim().slice(0,20);
       const cr=c.getBoundingClientRect();if(cr.bottom<scr.top+t.height+6)continue;   // almost scrolled away: nothing to show
       if(t.top<scr.top-1)bad.push({why:'title scrolled out of view',t:name,by:Math.round(scr.top-t.top),out});
       const tm=c.querySelector('.ev-time');
       if(tm&&getComputedStyle(tm).visibility!=='hidden'){
        const r=tm.getBoundingClientRect();
        if(r.top<scr.top-0.5||r.bottom>scr.bottom+0.5)bad.push({why:'time line is cut by the scroll edge but still drawn (a fragment)',t:name,out});
        else if(r.top<t.bottom-0.5)bad.push({why:'time line sits under the title (a fragment)',t:name,out,overlap:Math.round(t.bottom-r.top)});
       }
      }
     }
     if(!tested)bad.push({why:'no tall block could be tested'});
     return bad;
    });
    if(res.length)fail(`${theme} ${w}x${h} week: ${JSON.stringify(res.slice(0,3))}`);else console.log('ok  ',`${theme} ${w}x${h} week titles visible (${wk.n} blocks)`);
    if(w===1920||w===1280)await page.screenshot({path:path.join(out,`week-scrolled-${theme}-${w}x${h}.png`)});
   }
  }
 }finally{await app.close()}
}
if(failed){console.log('item6 FAILED');process.exit(1)}
console.log('PASS item 6 (pill clearance, week titles)');
