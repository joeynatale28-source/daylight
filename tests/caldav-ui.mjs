/**
 * End-to-end on the RENDERED app: the real page and the real Stage 1 connect form, talking through
 * the real caldav handlers to a real local CalDAV server (Radicale). Local-only (needs python + radicale).
 *   node tests/caldav-ui.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import {createCalDav} from '../supabase/functions/caldav/lib.mjs';
import {createHandlers} from '../supabase/functions/caldav/handlers.mjs';
import {launch} from './harness.mjs';

const PORT=5291,B='http://127.0.0.1:'+PORT,USER='joey',PASS='ui-test-password-9';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','caldav');
fs.mkdirSync(out,{recursive:true});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rad-ui-'));
fs.writeFileSync(path.join(dir,'users'),USER+':'+PASS+'\n');
fs.writeFileSync(path.join(dir,'config'),`[server]\nhosts = 127.0.0.1:${PORT}\n[auth]\ntype = htpasswd\nhtpasswd_filename = ${path.join(dir,'users')}\nhtpasswd_encryption = plain\n[storage]\nfilesystem_folder = ${path.join(dir,'data')}\n[logging]\nlevel = warning\n`);
const server=spawn('python',['-m','radicale','--config',path.join(dir,'config')],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const auth='Basic '+btoa(USER+':'+PASS);
const raw=(m,u,b,h={})=>fetch(B+u,{method:m,headers:{Authorization:auth,...h},body:b});
const ics=(uid,title,start,end)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//T//EN\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20261101T000000Z\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${title}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
function memoryStore(){const accounts=[],calendars=[];let n=0;const id=()=>'id'+(++n);return {accounts,calendars,
 async listAccounts(u){return accounts.filter(a=>a.user_id===u)},async getAccount(u,i){return accounts.find(a=>a.id===i&&a.user_id===u)||null},
 async upsertAccount(u,f){let a=accounts.find(a=>a.user_id===u&&a.server_url===f.server_url&&a.username===f.username);if(a)Object.assign(a,f);else{a={id:id(),user_id:u,...f};accounts.push(a)}return {...a}},
 async updateAccount(u,i,f){const a=accounts.find(a=>a.id===i&&a.user_id===u);Object.assign(a,f);return {...a}},
 async deleteAccount(u,i){for(let k=calendars.length-1;k>=0;k--)if(calendars[k].account_id===i)calendars.splice(k,1);const k=accounts.findIndex(a=>a.id===i);if(k>=0)accounts.splice(k,1)},
 async listCalendars(u,acc){return calendars.filter(c=>c.user_id===u&&(!acc||c.account_id===acc)).map(c=>({...c}))},
 async getCalendar(u,i){const c=calendars.find(c=>c.id===i&&c.user_id===u);return c?{...c,cached_events:c.cached_events.slice()}:null},
 async insertCalendar(u,f){const c={id:id(),user_id:u,...f};calendars.push(c);return {...c}},
 async updateCalendar(u,i,f){const c=calendars.find(c=>c.id===i&&c.user_id===u);Object.assign(c,f);return {...c}},
 async deleteCalendar(u,i){const k=calendars.findIndex(c=>c.id===i);if(k>=0)calendars.splice(k,1)}}}
let failed=false;
try{
 for(let i=0;i<60;i++){try{const r=await raw('PROPFIND','/');if(r.status<500)break}catch{}await sleep(250)}
 for(const [slug,name] of [['work','Work'],['home','Home']])await raw('MKCALENDAR',`/${USER}/${slug}/`,`<?xml version="1.0"?><c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>${name}</d:displayname></d:prop></d:set></c:mkcalendar>`,{'Content-Type':'application/xml'});
 await raw('PUT',`/${USER}/work/seed-1.ics`,ics('seed-1','Server-side standup','20261110T150000Z','20261110T160000Z'),{'Content-Type':'text/calendar'});
 await raw('PUT',`/${USER}/home/seed-2.ics`,ics('seed-2','Server-side dentist','20261112T130000Z','20261112T140000Z'),{'Content-Type':'text/calendar'});
 const serverTitles=async slug=>{const dav=createCalDav({ICAL,allowPrivate:true});const all=await dav.fetchAll(B+`/${USER}/${slug}/`,USER,PASS);return all.flatMap(r=>dav.eventsFromResource(r,{now:new Date('2026-11-07T12:00:00Z').getTime()}).events.map(e=>e.title))};

 for(const theme of (process.env.THEMES||'dark,light').split(',')){
  // fresh server state for every theme run
  await raw('DELETE',`/${USER}/work/`);await raw('DELETE',`/${USER}/home/`);
  for(const [slug,name] of [['work','Work'],['home','Home']])await raw('MKCALENDAR',`/${USER}/${slug}/`,`<?xml version="1.0"?><c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>${name}</d:displayname></d:prop></d:set></c:mkcalendar>`,{'Content-Type':'application/xml'});
  await raw('PUT',`/${USER}/work/seed-1.ics`,ics('seed-1','Server-side standup','20261110T150000Z','20261110T160000Z'),{'Content-Type':'text/calendar'});
  await raw('PUT',`/${USER}/home/seed-2.ics`,ics('seed-2','Server-side dentist','20261112T130000Z','20261112T140000Z'),{'Content-Type':'text/calendar'});
  const store=memoryStore();
  const dav=createCalDav({ICAL,allowPrivate:true});
  const handlers=createHandlers({store,dav});
  const wire=[];
  const app=await launch({theme,width:1440,height:900});
  const {page}=app;
  await page.exposeFunction('__caldavInvoke',async json=>{const body=JSON.parse(json);const r=await handlers.handle('00000000-0000-4000-8000-000000000001',body);const text=JSON.stringify(r.body);wire.push(text);return text});
  try{
   await app.load();
   // ---- connect through the real Stage 1 form
   await page.click('button[aria-label="Add to Subscriptions"]');
   await page.click('[data-opt="caldav"]');
   await page.waitForSelector('#dlCdServer');
   await page.type('#dlCdServer',B);await page.type('#dlCdUser',USER);await page.type('#dlCdPass',PASS);
   await page.screenshot({path:path.join(out,'01-connect-form-'+theme+'.png')});
   await page.click('[data-connect]');
   await page.waitForFunction(()=>!document.querySelector('.dl-std'),{timeout:20000});
   await sleep(600);
   const subs=await page.evaluate(()=>{const labels=[...document.querySelectorAll('#sidebar .side-label')];const sub=labels.find(l=>/Subscriptions/.test(l.textContent));
    const rows=[];let n=sub.nextElementSibling;while(n&&!n.classList.contains('side-label')&&!n.classList.contains('side-spacer')){n.querySelectorAll('.cal-name').forEach(x=>rows.push(x.textContent));n=n.nextElementSibling}return rows});
   await page.screenshot({path:path.join(out,'02-calendars-in-subscriptions-'+theme+'.png')});
   assert.ok(subs.includes('Work')&&subs.includes('Home'),'CalDAV calendars land in Subscriptions: '+JSON.stringify(subs));
   assert.ok(await page.evaluate(()=>state.events.some(e=>e.title==='Server-side standup')&&state.events.some(e=>e.title==='Server-side dentist')),'server events render in daylight');
   assert.ok(!(await page.evaluate(()=>JSON.stringify(window.daylightCloud&&0)||'')).includes(PASS));
   // local calendars are untouched
   assert.ok(await page.evaluate(()=>state.calendars.filter(c=>!c.caldav).length>=4&&state.events.some(e=>e.title==='Practice 3')),'local calendars and events untouched');

   // ---- create an event in daylight on the CalDAV calendar
   await page.evaluate(()=>openEventForm(null,new Date(2026,10,19)));
   await page.waitForSelector('#efCal');
   await page.type('#event-title, .event-form-dialog input.text-input','Created in daylight');
   await page.click('#efCal');await page.waitForSelector('.menu');
   await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>b.textContent.trim()==='Work').click());
   await sleep(200);
   await page.screenshot({path:path.join(out,'03-new-event-on-caldav-'+theme+'.png')});
   await page.click('[data-save]');
   await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:15000});
   await sleep(500);
   assert.ok(await page.evaluate(()=>state.events.some(e=>e.title==='Created in daylight'&&e.caldav)),'event appears in daylight after the server accepted it');
   assert.ok((await serverTitles('work')).includes('Created in daylight'),'the event exists on the server (independent read)');
   await page.screenshot({path:path.join(out,'04-event-created-'+theme+'.png')});

   // ---- conflict: someone else changes the event, then we edit from daylight
   await raw('PUT',`/${USER}/work/seed-1.ics`,ics('seed-1','Changed by another client','20261110T170000Z','20261110T180000Z'),{'Content-Type':'text/calendar'});
   await page.evaluate(()=>{const ev=state.events.find(e=>e.title==='Server-side standup');editOccurrence(ev,{ev,start:ev.start,end:ev.end})});
   await page.waitForSelector('.event-form-dialog');
   await page.evaluate(()=>{const i=document.querySelector('.event-form-dialog input.text-input');i.value='My stale edit';i.dispatchEvent(new Event('input',{bubbles:true}))});
   await page.click('[data-save]');
   await page.waitForSelector('.dl-std .dialog-body p',{timeout:15000});
   const notice=await page.$eval('.dl-std .dialog-body p',n=>n.textContent);
   await page.screenshot({path:path.join(out,'05-conflict-message-'+theme+'.png')});
   assert.equal(notice,'This event changed on the server, so your edit wasn’t saved. It’s been refreshed — try again.');
   assert.ok((await serverTitles('work')).includes('Changed by another client')&&!(await serverTitles('work')).includes('My stale edit'),'server keeps the other client’s version');
   await page.click('.dl-std [data-ok]');
   await page.waitForFunction(()=>!document.querySelector('.dl-std'),{timeout:3000});
   assert.ok(await page.evaluate(()=>state.events.some(e=>e.title==='Changed by another client')),'daylight refreshed to the server version');

   // ---- popup: last synced, Sync now, Disconnect
   await page.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent==='Work');row.querySelector('.cal-menu-btn').click()});
   await page.waitForSelector('.dl-calsettings [data-sync]');
   await sleep(450);
   const popup=await page.evaluate(()=>({sections:[...document.querySelectorAll('.dl-calsettings .set-group-title')].map(n=>n.textContent.trim()),last:document.querySelector('[data-last]').textContent,hasDisconnect:!!document.querySelector('[data-disconnect]')}));
   await page.screenshot({path:path.join(out,'06-calendar-popup-'+theme+'.png')});
   assert.deepEqual(popup.sections,['Name','Sync','Appearance'],'CalDAV popup sections: '+JSON.stringify(popup));
   assert.notEqual(popup.last,'Never');assert.ok(popup.hasDisconnect);
   await raw('PUT',`/${USER}/work/seed-3.ics`,ics('seed-3','Appeared after Sync now','20261124T150000Z','20261124T160000Z'),{'Content-Type':'text/calendar'});
   await page.click('[data-sync]');
   await page.waitForFunction(()=>state.events.some(e=>e.title==='Appeared after Sync now'),{timeout:15000});
   // failure keeps events and says so plainly
   fs.writeFileSync(path.join(dir,'users'),USER+':password-changed\n');await sleep(500);
   await page.click('[data-sync]');
   await page.waitForFunction(()=>{const e=document.querySelector('.dl-cd-error');return e&&!e.hidden},{timeout:15000});
   const failure=await page.evaluate(()=>({text:document.querySelector('.dl-cd-error').textContent,events:state.events.filter(e=>e.caldav).length}));
   await page.screenshot({path:path.join(out,'07-sync-failure-'+theme+'.png')});
   assert.ok(/Last sync failed|Sync failed/.test(failure.text)&&failure.events>0,'failed sync is explained and events stay: '+JSON.stringify(failure));
   fs.writeFileSync(path.join(dir,'users'),USER+':'+PASS+'\n');await sleep(500);

   // ---- disconnect: only CalDAV goes away
   const serverBefore=(await serverTitles('work')).length;
   await page.click('[data-disconnect]');
   await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');
   await page.screenshot({path:path.join(out,'08-disconnect-confirm-'+theme+'.png')});
   await page.click('#overlayRoot > .backdrop:last-child [data-ok]');
   await page.waitForFunction(()=>!state.calendars.some(c=>c.caldav),{timeout:10000});
   await sleep(400);
   await page.screenshot({path:path.join(out,'09-after-disconnect-'+theme+'.png')});
   assert.ok(await page.evaluate(()=>state.calendars.filter(c=>!c.caldav).length>=4&&state.events.some(e=>e.title==='Practice 3')&&!state.events.some(e=>e.caldav)),'rest of the app untouched after disconnect');
   assert.equal((await serverTitles('work')).length,serverBefore,'server data untouched by disconnect');
   assert.equal(store.accounts.length,0);
   assert.ok(wire.every(w=>!w.includes(PASS)),'no response ever contained the password');
   console.log('PASS caldav UI end-to-end ('+theme+')');
  }finally{await app.close()}
 }
}catch(e){console.log('FAIL '+(e&&e.stack||e));failed=true}
finally{server.kill();try{fs.rmSync(dir,{recursive:true,force:true})}catch{}}
process.exit(failed?1:0);
