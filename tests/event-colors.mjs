/**
 * Event colors must match their calendar on EVERY surface that draws events (month chips, multi-day bars, week/day
 * all-day bars, timed cards, agenda dots), for palette colors, per-account custom colors, US Holidays, iCal
 * subscriptions, for events created in the dialog and for events loaded from storage
 * (including ones saved with the old "graphite" accent), after a cold load, a warm (cached) reload, and in both themes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','colors');
fs.mkdirSync(out,{recursive:true});
const iso=(d,h=0,m=0)=>new Date(2026,10,d,h,m).toISOString();
function colorPayload(){
 const base=busyPayload();
 const ev=(id,cal,title,start,end,extra)=>({id,cal,title,start,end,allDay:false,loc:'',desc:'',...extra});
 const calendars=[
  {id:'k1',name:'Teal cal',color:'teal'},{id:'k2',name:'Blue cal',color:'blue'},{id:'k3',name:'Custom orange',color:'#FF7A00'},
  {id:'k4',name:'Violet cal',color:'violet'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];
 const events=[];let id=500;
 for(const [cal,name] of [['k1','Teal'],['k2','Blue'],['k3','Orange'],['k4','Violet']]){
  events.push(ev(id++,cal,name+' timed',iso(10,9),iso(10,10)));
  events.push(ev(id++,cal,name+' allday',iso(11),iso(11,23,59),{allDay:true}));
  events.push(ev(id++,cal,name+' multiday',iso(16),iso(18,23,59),{allDay:true}));
  // saved by the OLD dialog default (accent "graphite"): used to render gray
  events.push(ev(id++,cal,name+' legacy',iso(12,14),iso(12,15),{accent:'graphite'}));
 }
 return {...base,calendars,events,settings:{themeMode:'system',customColors:['#FF7A00']}};
}
const rgb=c=>c.replace(/\s/g,'');
/** Collect every drawn event and the color it was drawn with, plus its calendar's actual color from the sidebar. */
async function audit(page){
 return page.evaluate(()=>{
  const theme=document.documentElement.getAttribute('data-theme');
  const dots={};document.querySelectorAll('#sidebar .cal-row').forEach(r=>{const n=r.querySelector('.cal-name')?.textContent;const c=r.querySelector('.cal-check');if(n&&c)dots[n]=getComputedStyle(c).backgroundColor});
  const probe=document.createElement('i');document.body.appendChild(probe);
  const tint=cal=>{const p=daylightPalette(cal.color);probe.style.background=theme==='light'?p.light:p.dark;return getComputedStyle(probe).backgroundColor};
  const rows=[];
  const titles=state.events.map(e=>e.title).sort((a,b)=>b.length-a.length);
  document.querySelectorAll('.chip, .dl-continuous-bar, .allday-bar, .ev-card').forEach(n=>{
   if(!n.getClientRects().length)return;
   const text=n.textContent;const ev=state.events.find(e=>text.includes(e.title)&&titles.includes(e.title));if(!ev)return;
   const cal=state.calendars.find(c=>c.id===ev.cal);if(!cal)return;
   const cs=getComputedStyle(n);
   const ribbon=(cs.boxShadow.match(/rgba?\([^)]*\)/)||[''])[0];
   rows.push({kind:n.className.split(' ')[0],title:ev.title,cal:cal.name,bg:cs.backgroundColor,ribbon,expectBg:tint(cal),expectDot:dots[cal.name]||null});
  });
  // agenda rows draw the color as a dot next to the title
  document.querySelectorAll('.ac-dot').forEach(n=>{
   const row=n.closest('button')||n.parentElement;
   if(!row||!state.events.some(e=>row.textContent.includes(e.title)))return;
   const ev=state.events.filter(e=>row.textContent.includes(e.title)).sort((a,b)=>b.title.length-a.title.length)[0];const cal=state.calendars.find(c=>c.id===ev.cal);if(!cal)return;
   const dot=getComputedStyle(n).backgroundColor;
   rows.push({kind:'agenda-dot',title:ev.title,cal:cal.name,bg:dot,ribbon:dot,expectBg:dot,expectDot:dots[cal.name]||null});
  });
  probe.remove();
  return {theme,rows};
 });
}
function verify(label,result,min=1){
 const bad=result.rows.filter(r=>r.ribbon.replace(/\s/g,'')!==String(r.expectDot).replace(/\s/g,'')||r.bg.replace(/\s/g,'')!==r.expectBg.replace(/\s/g,''));
 assert.ok(result.rows.length>=min,label+': audited '+result.rows.length+' drawn events');
 assert.ok(bad.length===0,label+': '+bad.length+' of '+result.rows.length+' events drawn in a color that is not their calendar\'s: '+JSON.stringify(bad.slice(0,6).map(r=>[r.kind,r.title,r.cal,'drawn '+r.ribbon+' on '+r.bg,'expected '+r.expectDot+' on '+r.expectBg])));
 return result.rows.length;
}
let failed=false;
for(const theme of (process.env.THEMES||'dark,light').split(',')){
 try{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dl-col-'));
  const PORT=47841+Math.floor(Math.random()*400);
  let total=0;
  // ---- cold load (fresh sign-in, no cache), then every view
  let app=await launch({theme,port:PORT,userDataDir:dir,width:1440,height:900,payload:colorPayload()});
  await app.load();
  const {page}=app;
  // iCal subscription calendar (materialized the way the app does it)
  await page.evaluate(()=>{
   state.calendars.push({id:'subscription:s1',name:'Subscribed feed',color:'rose',hidden:false,subscribed:true,remoteSubscriptionId:'s1'});
   const mk=(id,cal,title,s,e,extra)=>Object.assign({id,cal,title,start:new Date(s),end:new Date(e),allDay:false,loc:'',desc:'',repeat:null,reminder:null},extra);
   state.events.push(mk(901,'subscription:s1','Feed timed',2026*0+new Date(2026,10,10,11),new Date(2026,10,10,12),{feedSubscriptionId:'s1'}));
   renderAll(false);
  });
  // an event created through the real dialog (this is where the gray default came from)
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,13)));
  await page.waitForSelector('#efCal');
  await page.type('.event-form-dialog input.text-input','Dialog created');
  await page.click('#efCal');await page.waitForSelector('.menu');
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>b.textContent.trim()==='Custom orange').click());
  await sleep(150);await page.click('[data-save]');
  await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:5000});
  for(const view of ['month','week','day','agenda']){
   await page.evaluate(v=>{state.view=v;state.cursor=new Date(2026,10,v==='month'?15:10);state.selected=new Date(2026,10,10);renderAll(false)},view);
   await sleep(450);
   total+=verify(theme+' '+view,await audit(page));
   if(view==='month')await page.screenshot({path:path.join(out,'month-'+theme+'.png')});
  }
  await page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});
  await sleep(400);
  await app.close();
  // ---- warm reload from the cache (first-paint snapshot + cache render), then a "fresh sign-in" (cache cleared)
  app=await launch({theme,port:PORT,userDataDir:dir,width:1440,height:900,payload:colorPayload()});
  await app.load();await sleep(1500);
  await app.page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(300);
  total+=verify(theme+' cold load',await audit(app.page),8);
  await app.page.reload();await app.ready();
  await app.page.evaluate(()=>{state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(300);
  total+=verify(theme+' after hard refresh (cached render)',await audit(app.page),8);
  await app.page.screenshot({path:path.join(out,'month-refresh-'+theme+'.png')});
  await app.close();
  console.log('PASS '+theme+': '+total+' drawn events match their calendar color across month/week/day/agenda, cold load and refresh');
 }catch(e){failed=true;console.log('FAIL '+theme+': '+String(e&&e.message||e).slice(0,900))}
}
process.exit(failed?1:0);
