/**
 * Viewport sweep: opens every surface at 6 widths x 2 heights x 2 themes and records objective defects
 * (off-screen overlays, overlays taller than the window, page scroll, clipped text, content wider than its box).
 * Usage: node tests/viewport-sweep.mjs   (LIVE_URL=<deployed> to sweep a deployed build; WIDTHS/HEIGHTS/SURFACES to narrow)
 * Writes ui-screenshots/sweep/<surface>-<theme>-<w>x<h>.png for flagged cases and one "worst size" shot per surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload,TINY_AVATAR} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','sweep');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const WIDTHS=(process.env.WIDTHS||'1920,1680,1512,1440,1366,1280').split(',').map(Number);
const HEIGHTS=(process.env.HEIGHTS||'900,700').split(',').map(Number);
const PAIRS=process.env.SIZES?process.env.SIZES.split(',').map(x=>x.split('x').map(Number)):HEIGHTS.flatMap(h=>WIDTHS.map(w=>[w,h]));
const ALL=!!process.env.ALL_SHOTS;
const vp=(w,h)=>({width:w,height:h,deviceScaleFactor:1,isMobile:w<=834,hasTouch:w<=834});
const THEMES=(process.env.THEMES||'dark,light').split(',');
const ONLY=process.env.SURFACES?process.env.SURFACES.split(','):null;

/** Page-side inspection of the current surface. */
function inspectPage(rootSelector){
 const root=rootSelector?document.querySelector(rootSelector):null;
 const vw=innerWidth,vh=innerHeight,issues=[];
 if(document.documentElement.scrollWidth>vw+1)issues.push('page scrolls horizontally ('+document.documentElement.scrollWidth+' > '+vw+')');
 if(rootSelector&&!root)return {issues:['surface did not open'],box:null};
 if(root){
  const foot=root.querySelector('.dialog-foot button, .settings-savebar:not([hidden]) button');
  if(foot){const f=foot.getBoundingClientRect();if(f.bottom>vh+1||f.top<0)issues.push('the dialog footer buttons are outside the window');}
  const r=root.getBoundingClientRect(),cs=getComputedStyle(root);
  if(r.left<-1||r.top<-1||r.right>vw+1||r.bottom>vh+1)issues.push('overlay leaves the window: '+[r.left,r.top,r.right,r.bottom].map(Math.round).join(',')+' in '+vw+'x'+vh);
  if(r.width<200||r.height<60)issues.push('overlay collapsed to '+Math.round(r.width)+'x'+Math.round(r.height));
 }
 const scope=root||document.body;
 // text that is cut off without an ellipsis, and boxes whose content is wider than they are
 const seen=new Set();
 scope.querySelectorAll('button,span,div,p,h1,h2,h3,label,input,a').forEach(n=>{
  if(!n.getClientRects().length||seen.size>12)return;
  const cs=getComputedStyle(n);if(cs.visibility==='hidden'||cs.display==='none')return;
  if(n.closest('.day-cell,.tg-body,.agenda-scroll,.mini-cal,.dl-sw,svg'))return;
  if(n.scrollWidth>n.clientWidth+2&&n.clientWidth>0){
   const clipped=['hidden','clip'].includes(cs.overflowX)&&cs.textOverflow!=='ellipsis'&&n.children.length===0&&n.textContent.trim().length>2;
   const spills=cs.overflowX==='visible'&&n.children.length===0&&n.textContent.trim().length>2&&cs.whiteSpace==='nowrap'&&n.getBoundingClientRect().right>(n.parentElement?n.parentElement.getBoundingClientRect().right+2:1e9);
   if(clipped||spills){const t=n.textContent.trim().slice(0,28);if(!seen.has(t)){seen.add(t);issues.push((clipped?'text cut off: ':'text spills out of its box: ')+JSON.stringify(t))}}
  }
 });
 return {issues,box:root?(()=>{const r=root.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]})():null};
}

const sleepFor=ms=>sleep(ms);
const surfaces={
 'month':{open:async p=>p.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)})},
 'week':{open:async p=>p.evaluate(()=>{state.section='calendar';state.view='week';state.cursor=new Date(2026,10,10);renderAll(false)})},
 'day':{open:async p=>p.evaluate(()=>{state.section='calendar';state.view='day';state.cursor=new Date(2026,10,10);state.selected=new Date(2026,10,10);renderAll(false)})},
 'agenda':{open:async p=>p.evaluate(()=>{state.section='calendar';state.view='agenda';state.cursor=new Date(2026,10,10);renderAll(false)})},
 'tasks':{open:async p=>p.evaluate(()=>{showTasks()})},
 'event-popover':{root:'.popover',open:async p=>{await p.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(300);await p.evaluate(()=>{const ev=state.events.find(e=>e.title==='Practice 12');const a=document.querySelector('.day-cell[data-date="2026-11-12"] .chip')||document.querySelector('.chip');openPopover({ev,start:ev.start,end:ev.end},a)})}},
 'event-popover-edge':{root:'.popover',open:async p=>{await p.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(300);await p.evaluate(()=>{const chips=[...document.querySelectorAll('.day-cell .chip')];const a=chips[chips.length-1];const ev=state.events.find(e=>a.textContent.includes(e.title));openPopover({ev,start:ev.start,end:ev.end},a)})}},
 'event-dialog-new':{root:'.event-form-dialog',open:async p=>p.evaluate(()=>{state.section='calendar';state.view='month';renderAll(false);openEventForm(null,new Date(2026,10,10))})},
 'event-dialog-edit':{root:'.event-form-dialog',open:async p=>p.evaluate(()=>{state.section='calendar';state.view='month';renderAll(false);const ev=state.events.find(e=>e.title==='Practice 12');openEventForm(ev,null,ev)})},
 'cal-menu':{root:'.dl-manage',open:async p=>p.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent==='Personal');row.querySelector('.cal-menu-btn').click();setTimeout(()=>{const m=document.querySelector('.menu .menu-item');if(m)m.click()},80)})},
 'cal-menu-holidays':{root:'.dl-manage',open:async p=>p.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent==='US Holidays');row.querySelector('.cal-menu-btn').click();setTimeout(()=>{const m=document.querySelector('.menu .menu-item');if(m)m.click()},80)})},
 'new-calendar':{root:'#overlayRoot .dialog',open:async p=>p.evaluate(()=>document.querySelector('button[aria-label="New calendar"]').click())},
 'chooser':{root:'.dl-std',open:async p=>p.evaluate(()=>document.querySelector('button[aria-label="Add to Subscriptions"]').click())},
 'form-ical':{root:'.dl-std',open:async p=>{await p.evaluate(()=>document.querySelector('button[aria-label="Add to Subscriptions"]').click());await sleep(250);await p.evaluate(()=>document.querySelector('[data-opt="ical"]').click())}},
 'form-ics':{root:'.dl-std',open:async p=>{await p.evaluate(()=>document.querySelector('button[aria-label="Add to Subscriptions"]').click());await sleep(250);await p.evaluate(()=>document.querySelector('[data-opt="ics"]').click())}},
 'notifications':{root:'.dl-notif-panel',open:async p=>p.evaluate(()=>document.querySelector('#headerBand .dl-notif-btn').click())},
 'search':{root:'.palette',open:async p=>p.evaluate(()=>openSearch())},
 'sidebar-collapsed':{open:async p=>p.evaluate(()=>{state.section='calendar';state.view='month';document.querySelector('#collapseBtn').click()}),close:async p=>p.evaluate(()=>{const b=document.querySelector('#sidebar .sidebar-expand');if(b)b.click()})},
};
for(const sec of ['profile','appearance','calendar','notifications','ai','shortcuts'])surfaces['settings-'+sec]={root:'.settings-dialog',open:async p=>p.evaluate(s=>openSettings(s),sec)};

const results=[];
for(const theme of THEMES){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload({avatar:TINY_AVATAR}),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await app.load();
  await page.evaluate(()=>{state.customColors=['#13A5C7','#6C5CE7']});
  for(const [name,def] of Object.entries(surfaces)){
   if(ONLY&&!ONLY.includes(name))continue;
   for(const [w,h] of PAIRS){
    await page.setViewport(vp(w,h));await sleep(120);
    try{
     await page.evaluate(()=>{document.querySelectorAll('#overlayRoot>*,.menu,.popover,.dl-notif-panel,.palette-backdrop').forEach(n=>n.remove());try{closeSearch()}catch(e){}try{closeNotifPanel()}catch(e){}if(window.settingsState)settingsState.transactionActive=false});
     await sleep(80);
     await def.open(page);await sleep(520);
     const r=await page.evaluate(inspectPage,def.root||null);
     results.push({surface:name,theme,w,h,issues:r.issues});
     const worst=ALL||(w===Math.min(...PAIRS.map(x=>x[0]))&&h===Math.min(...PAIRS.map(x=>x[1])));
     if(r.issues.length||worst)await page.screenshot({path:path.join(out,`${name}-${theme}-${w}x${h}.png`)});
     if(def.close)await def.close(page);
    }catch(e){results.push({surface:name,theme,w,h,issues:['harness error: '+String(e.message).slice(0,120)]})}
   }
  }
 }finally{await app.close()}
}
// sign-in screen (signed out) at every size
for(const theme of THEMES){
 const app=await launch({theme,width:1440,height:900,signedIn:false,baseUrl:process.env.LIVE_URL||undefined});
 try{
  await app.page.goto(app.url);await app.page.waitForSelector('#authScreen',{timeout:15000});
  for(const [w,h] of PAIRS){
   if(ONLY&&!ONLY.includes('sign-in'))continue;
   await app.page.setViewport(vp(w,h));await sleep(250);
   const r=await app.page.evaluate(()=>{const issues=[];const s=document.getElementById('authScreen');if(document.documentElement.scrollWidth>innerWidth+1)issues.push('page scrolls horizontally');
    const form=document.querySelector('.auth-form-wrap');if(form){const b=form.getBoundingClientRect();if(b.bottom>innerHeight+1&&s.scrollHeight<=s.clientHeight+1)issues.push('sign-in form is cut off at the bottom');}return {issues}});
   results.push({surface:'sign-in',theme,w,h,issues:r.issues});
   if(r.issues.length||(ALL||(w===Math.min(...PAIRS.map(x=>x[0]))&&h===Math.min(...PAIRS.map(x=>x[1])))))await app.page.screenshot({path:path.join(out,`sign-in-${theme}-${w}x${h}.png`)});
  }
 }finally{await app.close()}
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,1));
const by={};
for(const r of results){const k=r.surface;(by[k]=by[k]||{cases:0,flagged:0,examples:new Set()});by[k].cases++;if(r.issues.length){by[k].flagged++;r.issues.slice(0,2).forEach(i=>by[k].examples.add(i))}}
for(const [k,v] of Object.entries(by))console.log(k.padEnd(22),String(v.flagged).padStart(3)+'/'+v.cases,v.flagged?'  '+[...v.examples].slice(0,3).join(' | ').slice(0,260):'');
console.log('sizes tested: '+PAIRS.map(x=>x.join('x')).join(', ')+' ; themes '+THEMES.join(', '));
