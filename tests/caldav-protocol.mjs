/**
 * CalDAV protocol matrix against a real local server (Radicale). Starts and stops its own server:
 *   pip install radicale && node tests/caldav-protocol.mjs
 * Uses the real lib + handlers with an in-memory store. Prints one PASS/FAIL line per case.
 * (Local-only: CI has no Radicale.)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import ICAL from 'ical.js';
import {createCalDav} from '../supabase/functions/caldav/lib.mjs';
import {createHandlers} from '../supabase/functions/caldav/handlers.mjs';

const PORT=5290,B='http://127.0.0.1:'+PORT,USER='joey',PASS='correct-horse-1',NOW=new Date('2026-11-07T12:00:00Z');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rad-'));
const users=path.join(dir,'users');fs.writeFileSync(users,USER+':'+PASS+'\n');
fs.writeFileSync(path.join(dir,'config'),`[server]\nhosts = 127.0.0.1:${PORT}\n[auth]\ntype = htpasswd\nhtpasswd_filename = ${users}\nhtpasswd_encryption = plain\n[storage]\nfilesystem_folder = ${path.join(dir,'data')}\n[logging]\nlevel = warning\n`);
const server=spawn('python',['-m','radicale','--config',path.join(dir,'config')],{stdio:'ignore'});
const auth=u=>'Basic '+btoa(u+':'+PASS);
let results=[],failed=false;
const check=(name,ok,detail)=>{results.push(ok);if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'  -> '+detail))};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function raw(method,url,body,headers={}){return fetch(B+url,{method,headers:{Authorization:auth(USER),...headers},body})}
const ics=(uid,summary,extra='',dt='DTSTART:20261110T150000Z\r\nDTEND:20261110T160000Z')=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TEST//EN\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20261101T000000Z\r\n${dt}\r\nSUMMARY:${summary}\r\n${extra}END:VEVENT\r\nEND:VCALENDAR\r\n`;
async function put(cal,uid,body){const r=await raw('PUT',`/${USER}/${cal}/${uid}.ics`,body,{'Content-Type':'text/calendar'});if(![201,204].includes(r.status))throw Error('seed PUT '+r.status);return r.headers.get('etag')}
async function mkcal(name,display){const r=await raw('MKCALENDAR',`/${USER}/${name}/`,`<?xml version="1.0"?><c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>${display}</d:displayname></d:prop></d:set></c:mkcalendar>`,{'Content-Type':'application/xml'});if(r.status!==201)throw Error('mkcalendar '+r.status)}
async function serverEvents(cal,uidFilter){const dav2=createCalDav({ICAL,allowPrivate:true});const all=await dav2.fetchAll(B+`/${USER}/${cal}/`,USER,PASS);const out=[];for(const r of all){const parsed=dav2.eventsFromResource(r,{now:NOW.getTime()});for(const e of parsed.events)if(!uidFilter||e.uid===uidFilter)out.push({...e,_href:r.href})}return {resources:all,events:out}}

// ---- in-memory store (every call scoped by userId, like the real one)
function memoryStore(){
 const accounts=[],calendars=[];let n=0;const id=()=>'id'+(++n);
 return {accounts,calendars,
  async listAccounts(u){return accounts.filter(a=>a.user_id===u)},
  async getAccount(u,i){return accounts.find(a=>a.id===i&&a.user_id===u)||null},
  async upsertAccount(u,f){let a=accounts.find(a=>a.user_id===u&&a.server_url===f.server_url&&a.username===f.username);if(a)Object.assign(a,f,{updated_at:'x'});else{a={id:id(),user_id:u,...f};accounts.push(a)}return {...a}},
  async updateAccount(u,i,f){const a=accounts.find(a=>a.id===i&&a.user_id===u);Object.assign(a,f);return {...a}},
  async deleteAccount(u,i){for(let k=calendars.length-1;k>=0;k--)if(calendars[k].account_id===i&&calendars[k].user_id===u)calendars.splice(k,1);const k=accounts.findIndex(a=>a.id===i&&a.user_id===u);if(k>=0)accounts.splice(k,1)},
  async listCalendars(u,acc){return calendars.filter(c=>c.user_id===u&&(!acc||c.account_id===acc)).map(c=>({...c}))},
  async getCalendar(u,i){const c=calendars.find(c=>c.id===i&&c.user_id===u);return c?{...c,cached_events:c.cached_events.slice()}:null},
  async insertCalendar(u,f){const c={id:id(),user_id:u,...f};calendars.push(c);return {...c}},
  async updateCalendar(u,i,f){const c=calendars.find(c=>c.id===i&&c.user_id===u);Object.assign(c,f);return {...c}},
  async deleteCalendar(u,i){const k=calendars.findIndex(c=>c.id===i&&c.user_id===u);if(k>=0)calendars.splice(k,1)}};
}

try{
 for(let i=0;i<60;i++){try{const r=await fetch(B+'/',{headers:{Authorization:auth(USER)}});if(r.status<500)break}catch{}await new Promise(r=>setTimeout(r,250))}
 await mkcal('work','Work');await mkcal('home','Home');
 const dav=createCalDav({ICAL,allowPrivate:true});
 let syncTokenCalls=0,fullCalls=0;
 const spy={...dav,syncChanges:(...a)=>{syncTokenCalls++;return dav.syncChanges(...a)},fetchAll:(...a)=>{fullCalls++;return dav.fetchAll(...a)}};
 const store=memoryStore();
 const H=createHandlers({store,dav:spy,now:()=>NOW});
 const A='user-A',Bu='user-B';
 const call=(u,body)=>H.handle(u,body).then(r=>r.body);

 // ===== PART A =====
 for(const [label,url] of [['bare server URL',B],['link to one calendar',B+`/${USER}/work/`],['/.well-known/caldav',B+'/.well-known/caldav']]){
  const r=await call(A,{action:'test',server_url:url,username:USER,password:PASS});
  check('A discovery from '+label,r.ok&&r.server.calendars.length===2&&eq(r.server.calendars.map(c=>c.name).sort(),['Home','Work']),JSON.stringify(r).slice(0,200));
 }
 check('A test stores nothing',store.accounts.length===0&&store.calendars.length===0,'rows exist');
 {const r=await call(A,{action:'test',server_url:B,username:USER,password:'nope'});check('A wrong password -> auth_failed',!r.ok&&r.error.code==='auth_failed',JSON.stringify(r))}
 {const r=await call(A,{action:'test',server_url:'http://127.0.0.1:5999',username:USER,password:PASS});check('A unreachable server -> unreachable',!r.ok&&r.error.code==='unreachable',JSON.stringify(r))}
 {const strict=createCalDav({ICAL});for(const bad of ['https://localhost/','https://10.0.0.5/','http://example.com/','https://user:pw@example.com/','not a url ::']){let code='ok';try{await strict.discover(bad,'a','b')}catch(e){code=e.code}check('A SSRF/validity guard refuses '+bad,code==='invalid_url',code)}}

 // seed server data before connecting
 await put('work','single-1',ics('single-1','Team standup'));
 await put('work','allday-1',ics('allday-1','Offsite','','DTSTART;VALUE=DATE:20261112\r\nDTEND;VALUE=DATE:20261114'));
 await put('work','tz-1',ics('tz-1','Zone meeting','LOCATION:Room 4\r\nDESCRIPTION:Bring notes\r\n','DTSTART;TZID=America/New_York:20261111T090000\r\nDTEND;TZID=America/New_York:20261111T100000'));
 await put('work','weekly-1',ics('weekly-1','Weekly sync','RRULE:FREQ=WEEKLY;COUNT=20\r\n','DTSTART:20261109T140000Z\r\nDTEND:20261109T150000Z'));
 await put('home','home-1',ics('home-1','Dentist','','DTSTART:20261120T130000Z\r\nDTEND:20261120T140000Z'));

 const conn=await call(A,{action:'connect',server_url:B,username:USER,password:PASS});
 check('A connect creates account + one calendar per server calendar',conn.ok&&conn.calendars.length===2&&store.accounts.length===1,JSON.stringify(conn).slice(0,200));
 check('A connect response never contains the password',!JSON.stringify(conn).includes(PASS),'password leaked');
 const work=conn.calendars.find(c=>c.name==='Work'),home=conn.calendars.find(c=>c.name==='Home');
 const titles=work.cached_events.map(e=>e.title);
 check('A initial sync: events + recurrence expanded',titles.includes('Team standup')&&titles.includes('Offsite')&&titles.filter(t=>t==='Weekly sync').length===20,'got '+titles.length+' events');
 const tz=work.cached_events.find(e=>e.title==='Zone meeting'),ad=work.cached_events.find(e=>e.title==='Offsite');
 check('A event fields: tz-aware start, location, description',tz&&tz.start==='2026-11-11T14:00:00.000Z'&&tz.location==='Room 4'&&tz.description==='Bring notes',JSON.stringify(tz));
 check('A all-day event: inclusive end',ad&&ad.allDay&&ad.start==='2026-11-12T00:00:00.000Z'&&ad.end.startsWith('2026-11-13T23:59'),JSON.stringify(ad));
 check('A events carry href + etag (Part B needs them)',work.cached_events.every(e=>e.href&&e.etag),'missing');
 check('A calendars have colors assigned',work.color&&home.color,JSON.stringify([work.color,home.color]));
 {const again=await call(A,{action:'connect',server_url:B,username:USER,password:PASS});
  check('A reconnect updates, no duplicate account or calendars',again.ok&&store.accounts.length===1&&store.calendars.length===2,store.accounts.length+'/'+store.calendars.length)}
 {const idA=store.accounts[0].id;const s=await call(A,{action:'sync',account_id:idA});
  check('A sync with nothing changed is quiet and keeps events',s.ok&&s.calendars.find(c=>c.name==='Work').cached_events.length===work.cached_events.length,JSON.stringify(s).slice(0,150))}

 // incremental
 {const idA=store.accounts[0].id;
  await put('work','single-2',ics('single-2','Added on server','','DTSTART:20261115T150000Z\r\nDTEND:20261115T160000Z'));
  const et=(await serverEvents('work','single-1')).events[0].etag;
  await put('work','single-1',ics('single-1','Standup (renamed)','','DTSTART:20261110T160000Z\r\nDTEND:20261110T170000Z'));
  await raw('DELETE',`/${USER}/work/allday-1.ics`);
  syncTokenCalls=0;fullCalls=0;
  const s=await call(A,{action:'sync',account_id:idA});
  const t=s.calendars.find(c=>c.name==='Work').cached_events;
  check('A incremental: add/change/delete on server -> daylight matches',s.ok&&t.some(e=>e.title==='Added on server')&&t.some(e=>e.title==='Standup (renamed)')&&!t.some(e=>e.title==='Team standup')&&!t.some(e=>e.title==='Offsite'),JSON.stringify(t.map(e=>e.title)));
  check('A incremental used the sync token (no full re-read of the Work calendar)',syncTokenCalls>=1,'syncTokenCalls='+syncTokenCalls+' full='+fullCalls);
  check('A etag changed for the edited event',t.find(e=>e.title==='Standup (renamed)').etag!==et,'same etag');
 }

 // failure keeps last good events
 {const idA=store.accounts[0].id;
  fs.writeFileSync(users,USER+':changed-password\n');
  await new Promise(r=>setTimeout(r,500));
  const before=(await store.listCalendars(A,idA)).find(c=>c.name==='Work').cached_events.length;
  const s=await call(A,{action:'sync',account_id:idA,force:true});
  const after=(await store.listCalendars(A,idA)).find(c=>c.name==='Work').cached_events.length;
  check('A failed sync (password changed on server): error reported, last good events kept',!s.ok&&s.error.code==='auth_failed'&&before===after&&after>0&&store.accounts[0].last_error,JSON.stringify(s.error)+' '+before+'/'+after);
  fs.writeFileSync(users,USER+':'+PASS+'\n');await new Promise(r=>setTimeout(r,500));
  const ok=await call(A,{action:'sync',account_id:idA,force:true});
  check('A sync recovers once the password is right again',ok.ok&&!store.accounts[0].last_error,JSON.stringify(ok).slice(0,150));
 }

 // identity: another user can never reach this account
 {const idA=store.accounts[0].id,calA=store.calendars[0].id;
  const l=await call(Bu,{action:'list'});
  const s=await call(Bu,{action:'sync',account_id:idA});
  const d=await call(Bu,{action:'disconnect',account_id:idA});
  const u=await call(Bu,{action:'update_calendar',calendar_id:calA,color:'blue'});
  const w=await call(Bu,{action:'delete',calendar_id:calA,href:'x',uid:'y'});
  check("A user B sees none of user A's accounts/calendars and can't sync, disconnect, edit or write",l.accounts.length===0&&l.calendars.length===0&&!s.ok&&!d.ok&&!u.ok&&!w.ok&&store.accounts.length===1,JSON.stringify([l,s.error,d.error]).slice(0,200));
  const sneaky=await H.handle(Bu,{action:'list',user_id:A});
  check('A a user_id in the request body is ignored',sneaky.body.accounts.length===0,'leaked');
 }
 const partA=!failed;

 // ===== PART B (only if A is fully verified) =====
 if(!partA){console.log('SKIP Part B: Part A has failures')}
 else{
  const idA=store.accounts[0].id;const workRow=()=>store.calendars.find(c=>c.name==='Work');
  // B1 create
  {const r=await call(A,{action:'create',calendar_id:workRow().id,event:{title:'Created in daylight',start:'2026-11-17T15:00:00.000Z',end:'2026-11-17T16:30:00.000Z',allDay:false,location:'Cafe, Main St; booth 2',description:'Line one\nLine two'}});
   const srv=await serverEvents('work');const e=srv.events.find(x=>x.title==='Created in daylight');
   check('B create: event exists on the server (independent read) with all fields',r.ok&&e&&e.start==='2026-11-17T15:00:00.000Z'&&e.end==='2026-11-17T16:30:00.000Z'&&e.location==='Cafe, Main St; booth 2'&&e.description==='Line one\nLine two',JSON.stringify(r).slice(0,150)+JSON.stringify(e));
   check('B create stores the returned etag',r.ok&&r.etag&&workRow().cached_events.find(x=>x.title==='Created in daylight').etag===r.etag,'etag');
   const ad2=await call(A,{action:'create',calendar_id:workRow().id,event:{title:'All-day thing',start:'2026-11-20T00:00:00.000Z',end:'2026-11-21T00:00:00.000Z',allDay:true}});
   const e2=(await serverEvents('work')).events.find(x=>x.title==='All-day thing');
   check('B create all-day (2 days) round-trips',ad2.ok&&e2&&e2.allDay&&e2.start==='2026-11-20T00:00:00.000Z'&&e2.end.startsWith('2026-11-21T23:59'),JSON.stringify(e2));
  }
  // B2 update with fetch-merge preserving foreign properties
  {await put('work','merge-1',ics('merge-1','Has extras','X-CUSTOM-FIELD:keep-me\r\nATTENDEE;CN=Pat:mailto:pat@example.com\r\nCATEGORIES:Alpha\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\n','DTSTART:20261118T150000Z\r\nDTEND:20261118T160000Z'));
   await call(A,{action:'sync',account_id:idA,force:true});
   const ev=workRow().cached_events.find(e=>e.title==='Has extras');
   const r=await call(A,{action:'update',calendar_id:workRow().id,href:ev.href,uid:ev.uid,scope:'all',occurrence:{start:ev.original_start},fields:{title:'Has extras (edited)',start:'2026-11-18T16:00:00.000Z',end:'2026-11-18T17:00:00.000Z',location:'New place'}});
   const raw2=await (await raw('GET',`/${USER}/work/merge-1.ics`)).text();
   check('B update: server has the edit',r.ok&&/SUMMARY:Has extras \(edited\)/.test(raw2)&&/DTSTART:20261118T160000Z/.test(raw2)&&/LOCATION:New place/.test(raw2),raw2.slice(0,300));
   check('B update: fields daylight does not model are preserved (X- property, attendee, categories, alarm)',/X-CUSTOM-FIELD:keep-me/.test(raw2)&&/ATTENDEE;CN=Pat/.test(raw2)&&/CATEGORIES:Alpha/.test(raw2)&&/BEGIN:VALARM/.test(raw2),raw2);
  }
  // B3 delete
  {const ev=workRow().cached_events.find(e=>e.title==='Created in daylight');
   const r=await call(A,{action:'delete',calendar_id:workRow().id,href:ev.href,uid:ev.uid,scope:'all'});
   const gone=await raw('GET',new URL(ev.href).pathname);
   check('B delete: gone from the server (independent read) and from daylight',r.ok&&gone.status===404&&!workRow().cached_events.some(e=>e.title==='Created in daylight'),gone.status);
  }
  // B4 etag conflict: server changes between daylight's read and the write
  {const ev=workRow().cached_events.find(e=>e.title==='Added on server');
   await put('work','single-2',ics('single-2','Changed by someone else','','DTSTART:20261115T180000Z\r\nDTEND:20261115T190000Z'));
   const r=await call(A,{action:'update',calendar_id:workRow().id,href:ev.href,uid:ev.uid,scope:'all',occurrence:{start:ev.original_start},fields:{title:'My stale edit'}});
   const srv=await (await raw('GET',`/${USER}/work/single-2.ics`)).text();
   check('B conflict: write refused (never forced); server keeps the other client\'s version',!r.ok&&r.error.code==='conflict'&&/Changed by someone else/.test(srv)&&!/My stale edit/.test(srv),JSON.stringify(r.error)+srv.slice(0,200));
   check('B conflict: calendar refreshed from the server',workRow().cached_events.some(e=>e.title==='Changed by someone else')&&!workRow().cached_events.some(e=>e.title==='Added on server'),'not refreshed');
   await put('work','del-1',ics('del-1','Delete me','',['DTSTART:20261125T150000Z','DTEND:20261125T160000Z'].join('\r\n')));
   await call(A,{action:'sync',account_id:idA,force:true});
   const victim=workRow().cached_events.find(e=>e.uid==='del-1');
   await put('work','del-1',ics('del-1','Delete me (edited elsewhere)','',['DTSTART:20261125T170000Z','DTEND:20261125T180000Z'].join('\r\n')));
   const d=await call(A,{action:'delete',calendar_id:workRow().id,href:victim.href,uid:'del-1',scope:'all'});
   const still=await raw('GET','/'+USER+'/work/del-1.ics');
   check('B conflict on delete: refused, the event is still on the server and daylight shows the new version',!d.ok&&d.error.code==='conflict'&&still.status===200&&workRow().cached_events.some(e=>e.title==='Delete me (edited elsewhere)'),JSON.stringify(d.error)+still.status);
  }
  // B5 recurring scopes
  const weekly=()=>workRow().cached_events.filter(e=>e.uid==='weekly-1');
  const occN=n=>weekly().sort((a,b)=>a.start<b.start?-1:1)[n];
  {const o=occN(2);
   const r=await call(A,{action:'update',calendar_id:workRow().id,href:o.href,uid:'weekly-1',scope:'only',occurrence:{start:o.original_start},fields:{title:'Moved just this one',start:new Date(new Date(o.start).getTime()+3600e3).toISOString(),end:new Date(new Date(o.end).getTime()+3600e3).toISOString()}});
   const srv=(await serverEvents('work','weekly-1')).events;const raw3=await (await raw('GET',`/${USER}/work/weekly-1.ics`)).text();
   check('B recurring "only this event" (edit): one exception instance (RECURRENCE-ID); other 19 untouched',r.ok&&/RECURRENCE-ID/.test(raw3)&&srv.filter(e=>e.title==='Moved just this one').length===1&&srv.filter(e=>e.title==='Weekly sync').length===19&&srv.length===20,JSON.stringify(srv.map(e=>e.title)).slice(0,200));
  }
  {const o=occN(4);
   const r=await call(A,{action:'delete',calendar_id:workRow().id,href:o.href,uid:'weekly-1',scope:'only',occurrence:{start:o.original_start}});
   const raw3=await (await raw('GET',`/${USER}/work/weekly-1.ics`)).text();const srv=(await serverEvents('work','weekly-1')).events;
   check('B recurring "only this event" (delete): EXDATE added, 19 occurrences remain',r.ok&&/EXDATE/.test(raw3)&&srv.length===19,srv.length);
  }
  {const o=occN(0);
   const r=await call(A,{action:'update',calendar_id:workRow().id,href:o.href,uid:'weekly-1',scope:'all',occurrence:{start:o.original_start},fields:{title:'Weekly sync v2'}});
   check('B recurring "all events" with existing exceptions: title applies to the series, exceptions kept',r.ok&&weekly().filter(e=>e.title==='Weekly sync v2').length>=17&&weekly().some(e=>e.title==='Moved just this one'),JSON.stringify(weekly().map(e=>e.title)).slice(0,200));
   const o1=occN(1);
   const r2=await call(A,{action:'update',calendar_id:workRow().id,href:o1.href,uid:'weekly-1',scope:'all',occurrence:{start:o1.original_start},fields:{start:new Date(new Date(o1.start).getTime()+7200e3).toISOString(),end:new Date(new Date(o1.end).getTime()+7200e3).toISOString()}});
   check('B REFUSED: changing the time of a series that has exceptions ("all")',!r2.ok&&r2.error.code==='refused',JSON.stringify(r2.error));
  }
  {const o=occN(5);
   const r=await call(A,{action:'update',calendar_id:workRow().id,href:o.href,uid:'weekly-1',scope:'following',occurrence:{start:o.original_start},fields:{title:'New series'}});
   check('B REFUSED: "this and following" on a COUNT-limited series',!r.ok&&r.error.code==='refused',JSON.stringify(r.error));
  }
  // an UNTIL/open-ended series for split tests
  await put('work','open-1',ics('open-1','Open-ended','RRULE:FREQ=DAILY\r\n','DTSTART:20261108T090000Z\r\nDTEND:20261108T100000Z'));
  await call(A,{action:'sync',account_id:idA,force:true});
  const open=()=>workRow().cached_events.filter(e=>e.uid==='open-1').sort((a,b)=>a.start<b.start?-1:1);
  {const o=open()[10];const splitStart=o.original_start;
   const r=await call(A,{action:'update',calendar_id:workRow().id,href:o.href,uid:'open-1',scope:'following',occurrence:{start:splitStart},fields:{title:'Open-ended (from here)',start:new Date(new Date(o.start).getTime()+3600e3).toISOString(),end:new Date(new Date(o.end).getTime()+3600e3).toISOString()}});
   const all=(await serverEvents('work')).events;
   const before=all.filter(e=>e.uid==='open-1'),after=all.filter(e=>e.title==='Open-ended (from here)');
   const rawMaster=await (await raw('GET',`/${USER}/work/open-1.ics`)).text();
   check('B recurring "this and following": original series truncated (UNTIL) and a new series starts at the split',r.ok&&/UNTIL=/.test(rawMaster)&&before.length===10&&before.every(e=>e.start<splitStart)&&after.length>10&&after[0].start===new Date(new Date(o.start).getTime()+3600e3).toISOString(),JSON.stringify({r:r.ok,b:before.length,a:after.length,err:r.error}).slice(0,200));
  }
  {const o=open()[5];
   const r=await call(A,{action:'delete',calendar_id:workRow().id,href:o.href,uid:'open-1',scope:'following',occurrence:{start:o.original_start}});
   const rawMaster=await (await raw('GET',`/${USER}/work/open-1.ics`)).text();const srv=(await serverEvents('work','open-1')).events;
   check('B recurring delete "this and following": series cut before the instance',r.ok&&/UNTIL=/.test(rawMaster)&&srv.length===5,srv.length);
  }
  {await put('work','excepted-1',ics('excepted-1','Series with later exception','RRULE:FREQ=DAILY\r\n','DTSTART:20261108T120000Z\r\nDTEND:20261108T130000Z')+'');
   await call(A,{action:'sync',account_id:idA,force:true});
   const occs=workRow().cached_events.filter(e=>e.uid==='excepted-1').sort((a,b)=>a.start<b.start?-1:1);
   const later=occs[20];
   await call(A,{action:'update',calendar_id:workRow().id,href:later.href,uid:'excepted-1',scope:'only',occurrence:{start:later.original_start},fields:{title:'Later exception'}});
   const mid=workRow().cached_events.filter(e=>e.uid==='excepted-1').sort((a,b)=>a.start<b.start?-1:1)[8];
   const before=await (await raw('GET',`/${USER}/work/excepted-1.ics`)).text();
   const r=await call(A,{action:'update',calendar_id:workRow().id,href:mid.href,uid:'excepted-1',scope:'following',occurrence:{start:mid.original_start},fields:{title:'Split attempt'}});
   const afterTxt=await (await raw('GET',`/${USER}/work/excepted-1.ics`)).text();
   check('B REFUSED: "this and following" when a later instance was already changed individually; series left exactly as it was',!r.ok&&r.error.code==='refused'&&before===afterTxt,JSON.stringify(r.error));
  }
  // nothing but the series touched: a failed write leaves the UI cache unchanged
  {const before=JSON.stringify(workRow().cached_events.map(e=>e.title).sort());
   const ev=workRow().cached_events[0];
   const broken=createHandlers({store,dav:{...dav,putResource:async()=>{throw new (await import('../supabase/functions/caldav/lib.mjs')).CalDavError('unreachable','down')}},now:()=>NOW});
   const r=await broken.handle(A,{action:'update',calendar_id:workRow().id,href:ev.href,uid:ev.uid,scope:'all',occurrence:{start:ev.original_start},fields:{title:'Phantom'}}).then(x=>x.body);
   check('B write failure (network): reported, nothing changed locally',!r.ok&&JSON.stringify(workRow().cached_events.map(e=>e.title).sort())===before,JSON.stringify(r.error));
  }
  // disconnect leaves the server alone
  {const before=(await serverEvents('work')).events.length;
   const d=await call(A,{action:'disconnect',account_id:idA});
   const after=(await serverEvents('work')).events.length;
   check('A disconnect removes the account and its calendars from daylight; server data untouched',d.ok&&store.accounts.length===0&&store.calendars.length===0&&before===after&&after>0,before+'/'+after);
  }
 }
}catch(e){console.log('FAIL harness error: '+(e&&e.stack||e));failed=true}
finally{server.kill();try{fs.rmSync(dir,{recursive:true,force:true})}catch{}}
console.log(`\n${results.filter(Boolean).length}/${results.length} cases passed`);
process.exit(failed?1:0);
