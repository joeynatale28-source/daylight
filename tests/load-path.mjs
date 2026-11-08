/** Load-path checks on the real page: cold (no cache) and warm (snapshot) loads, both themes. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots');
fs.mkdirSync(out,{recursive:true});
const PORT=47831;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fresh=()=>fs.mkdtempSync(path.join(os.tmpdir(),'dl-profile-'));
const rgb=c=>c.match(/\d+/g).slice(0,3).map(Number);
const lum=c=>{const [r,g,b]=rgb(c);return (r*299+g*587+b*114)/1000};
const GOOD=['dark','light'];
const rects=()=>{const q=s=>[...document.querySelectorAll(s)].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]});
 return {sidebar:q('#sidebar'),header:q('#headerBand'),cells:q('.month-grid .day-cell'),dow:q('.dow-cell'),chips:q('.day-cell .chip:not([hidden])')}};
for(const theme of GOOD){
 // ---- A. cold: session hint, no cache; the shell and spinner must be the whole first paint
 {
  const app=await launch({theme,port:PORT,userDataDir:fresh(),delayMs:1500,cdnDelayMs:2500});
  try{
   app.page.goto(app.url).catch(()=>{});await app.page.waitForFunction(()=>!!document.getElementById('sidebar'),{timeout:5000});
   await sleep(700);
   const first=await app.page.evaluate(()=>({
    html:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,
    theme:document.documentElement.getAttribute('data-theme'),brand:!!document.querySelector('#sidebar .brand-name'),
    pill:!!document.querySelector('#sidebar .dl-shell-pill'),spinner:!!document.querySelector('#dlWorkspaceLoading .dl-loading-spinner'),
    sidebarW:document.getElementById('sidebar').getBoundingClientRect().width,scripts:!!window.daylightCloud,
    appVisible:!document.getElementById('app').hidden,auth:document.getElementById('authRoot').children.length}));
   await app.page.screenshot({path:path.join(out,'load-cold-first-paint-'+theme+'.png')});
   assert.equal(first.theme,theme);
   assert.ok(first.brand&&first.pill&&first.spinner&&first.appVisible,'cold first paint is the formatted shell: '+JSON.stringify(first));
   assert.equal(first.scripts,false,'this frame was painted before the app scripts ran');
   assert.equal(first.auth,0,'a signed-in user never sees the sign-in screen');
   assert.ok(theme==='dark'?lum(first.body)<60:lum(first.body)>200,'first paint uses the '+theme+' theme: '+first.body);
   const t0=Date.now();
   await app.ready();
   const shown=await app.page.evaluate(()=>!!document.querySelector('.month-grid .chip'));
   assert.ok(shown,'calendar appears after the hold');
   await app.page.screenshot({path:path.join(out,'load-cold-ready-'+theme+'.png')});
  }finally{await app.close()}
 }
 // ---- B. warm: first load writes the caches; second load paints the calendar from them at once
 {
  const dir=fresh();
  let before;
  {
   const app=await launch({theme,port:PORT,userDataDir:dir,delayMs:0});
   try{await app.load();await sleep(1500);
    const snap=await app.page.evaluate(()=>({snap:!!localStorage.getItem('daylight-first-paint:00000000-0000-4000-8000-000000000001'),warm:!!localStorage.getItem('daylight-warm-workspace:00000000-0000-4000-8000-000000000001')}));
    assert.deepEqual(snap,{snap:true,warm:true},'snapshot and workspace cache are written after a normal load');
   }finally{await app.close()}
  }
  // second visit: slow network, and the server now has one extra event
  const changed=busyPayload();
  changed.events.push({id:9999,cal:'c3',title:'Fresh from server',start:new Date(2026,10,3,13).toISOString(),end:new Date(2026,10,3,14).toISOString(),allDay:false,loc:'',desc:''});
  const app=await launch({theme,port:PORT,userDataDir:dir,delayMs:2200,cdnDelayMs:1200,payload:changed});
  try{
   app.page.goto(app.url).catch(()=>{});await app.page.waitForFunction(()=>!!document.getElementById('sidebar'),{timeout:5000});
   await sleep(500);
   const painted=await app.page.evaluate(()=>({snapshot:document.documentElement.getAttribute('data-dl-snapshot')==='1',scripts:!!window.daylightCloud,
    chips:document.querySelectorAll('.month-grid .day-cell .chip').length,spinner:!!document.getElementById('dlWorkspaceLoading'),rects:null}));
   await app.page.screenshot({path:path.join(out,'load-warm-before-refresh-'+theme+'.png')});
   assert.ok(painted.snapshot&&painted.chips>20&&!painted.spinner,'warm load paints the calendar immediately, no spinner: '+JSON.stringify(painted));
   assert.equal(painted.scripts,false,'...before any app script ran');
   before=await app.page.evaluate(rects);
   await app.page.waitForFunction(()=>!!window.daylightCloud,{timeout:10000});
   await sleep(300);
   const early=await app.page.evaluate(()=>({spinner:!!document.getElementById('dlWorkspaceLoading'),hold:document.body.classList.contains('dl-canvas-holding'),chips:document.querySelectorAll('.month-grid .day-cell .chip').length}));
   assert.deepEqual([early.spinner,early.hold,early.chips>20],[false,false,true],'no artificial hold while the cache is showing: '+JSON.stringify(early));
   // fresh data arrives
   await app.page.waitForFunction(()=>[...document.querySelectorAll('.chip-title')].some(n=>n.textContent==='Fresh from server'),{timeout:15000});
   await sleep(400);
   const after=await app.page.evaluate(rects);
   await app.page.screenshot({path:path.join(out,'load-warm-after-refresh-'+theme+'.png')});
   for(const k of ['sidebar','header','cells','dow'])assert.deepEqual(after[k],before[k],'refresh must not move '+k);
   // existing chips stay exactly where they were (the new event only adds a chip in its own cell)
   const cellOf=r=>r;
   const moved=before.chips.filter(c=>!after.chips.some(a=>a[0]===c[0]&&a[1]===c[1]&&a[2]===c[2]&&a[3]===c[3]));
   assert.ok(moved.length<=3,'only chips in the changed cell may move: '+JSON.stringify(moved));
  }finally{await app.close()}
 }
}

// ---- C. workspace cache present but no first-paint snapshot (e.g. window size changed):
// once scripts run, the calendar renders from the cache at once; no spinner, no hold, before the network answers.
for(const theme of GOOD){
 const dir=fresh();
 {const app=await launch({theme,port:PORT,userDataDir:dir});
  try{await app.load();await sleep(1500);
  }finally{await app.close()}}
 const app=await launch({theme,port:PORT,userDataDir:dir,delayMs:3000});
 try{
  await app.page.evaluateOnNewDocument(()=>{try{localStorage.removeItem('daylight-first-paint:00000000-0000-4000-8000-000000000001')}catch(e){}});
  app.page.goto(app.url).catch(()=>{});
  await app.page.waitForFunction(()=>!!window.daylightCloud,{timeout:10000});
  await sleep(400);
  const state=await app.page.evaluate(()=>({snapshot:document.documentElement.getAttribute('data-dl-snapshot')==='1',spinner:!!document.getElementById('dlWorkspaceLoading'),
   hold:document.body.classList.contains('dl-canvas-holding'),chips:document.querySelectorAll('.month-grid .day-cell .chip').length,fetching:!window.daylightCloud.ready}));
  await app.page.screenshot({path:path.join(out,'load-cache-only-'+theme+'.png')});
  assert.deepEqual([state.snapshot,state.spinner,state.hold,state.chips>20,state.fetching],[false,false,false,true,true],'cache render shows the calendar before the network answers: '+JSON.stringify(state));
  await app.ready();
 }finally{await app.close()}
}
console.log('load-path checks passed');
