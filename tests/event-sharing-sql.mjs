/**
 * Proves supabase/sql/20261128_event_sharing.sql in a REAL Postgres (PGlite): invites, accept / decline, and above all that the
 * permissions are enforced by the database: a "View only" recipient's write is refused and changes nothing, a "Can edit"
 * recipient can change that one event's details only (never its calendar, never delete, never create), the owner's other events are
 * untouched, and an event the owner deletes or unshares disappears for the right people. Local-only (needs @electric-sql/pglite).
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const cal=fs.readFileSync('supabase/sql/20261126_calendar_sharing.sql','utf8');
const sql=fs.readFileSync('supabase/sql/20261128_event_sharing.sql','utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const OWNER=id(1),SAM=id(2),RIA=id(3),STRANGER=id(4);
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const db=new PGlite();
const payload={calendars:[{id:'c1',name:'Family',color:'blue'},{id:'c2',name:'Work',color:'green'},{id:'sub1',name:'Feed',color:'amber',subscribed:true},{id:'holidays',name:'US Holidays',color:'amber',builtin:true}],
 events:[{id:1,cal:'c1',title:'Dinner',start:'2026-11-10T23:00:00.000Z',end:'2026-11-11T00:00:00.000Z',allDay:false,loc:'Home'},
  {id:2,cal:'c2',title:'Standup',start:'2026-11-12T14:00:00.000Z',end:'2026-11-12T14:15:00.000Z',repeat:'weekly',uid:'series-1'},
  {id:3,cal:'c2',title:'Standup (moved)',start:'2026-11-19T16:00:00.000Z',end:'2026-11-19T16:15:00.000Z',uid:'series-1',recurrenceId:'2026-11-19T14:00:00.000Z'},
  {id:4,cal:'sub1',title:'Feed event',start:'2026-11-13T14:00:00.000Z',end:'2026-11-13T15:00:00.000Z'},
  {id:5,cal:'c1',title:'Private thing',start:'2026-11-14T14:00:00.000Z',end:'2026-11-14T15:00:00.000Z'}],tasks:[{id:1,title:'Private task'}],settings:{}};
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key, email varchar, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
 create table public.workspace_snapshots(user_id uuid primary key, payload jsonb not null, revision int not null default 1, updated_at timestamptz default now());
 insert into auth.users(id,email,raw_user_meta_data) values ('${OWNER}','owner@example.com','{"full_name":"Olivia Owner"}'),('${SAM}','sam@example.com','{"full_name":"Sam Lee"}'),('${RIA}','ria@example.com','{"name":"Ria Stone"}'),('${STRANGER}','stranger@example.com','{}');
 insert into public.workspace_snapshots(user_id,payload,revision) values ('${OWNER}','${JSON.stringify(payload).replace(/'/g,"''")}'::jsonb, 4);`);
await db.exec(cal);await db.exec(sql);await db.exec(sql);
check('the file runs (twice, safely)',true);
const as=u=>db.exec(`select set_config('test.uid','${u||''}',false)`);
const call=async(u,q,a=[])=>{await as(u);return (await db.query(q,a)).rows};
const fails=async(u,q,a=[])=>{try{await call(u,q,a);return ''}catch(e){return e.message}};
const owner=async()=>(await db.query(`select payload, revision from public.workspace_snapshots where user_id='${OWNER}'`)).rows[0];

// ---- sending
check('signed-out cannot share',/Authenticated/.test(await fails(null,'select public.daylight_send_event_share($1,$2,$3)',[1,SAM,'view'])));
check('only your own events can be shared',/Event not found/.test(await fails(SAM,'select public.daylight_send_event_share($1,$2,$3)',[1,RIA,'view'])));
check('an event on a subscribed calendar cannot be shared',/Only events on your own/.test(await fails(OWNER,'select public.daylight_send_event_share($1,$2,$3)',[4,SAM,'view'])));
check('self, bad permission and unknown person are refused',/already own/.test(await fails(OWNER,'select public.daylight_send_event_share($1,$2,$3)',[1,OWNER,'view']))&&/Choose/.test(await fails(OWNER,'select public.daylight_send_event_share($1,$2,$3)',[1,SAM,'admin']))&&/Person not found/.test(await fails(OWNER,'select public.daylight_send_event_share($1,$2,$3)',[1,id(99),'view'])));
const sent=(await call(OWNER,'select public.daylight_send_event_share($1,$2,$3) r',[1,SAM,'view']))[0].r;
check('an invite goes out pending',sent.status==='pending'&&sent.permission==='view');
check('sending again to a pending person updates it (a resend), not a duplicate',(await call(OWNER,'select public.daylight_send_event_share($1,$2,$3) r',[1,SAM,'edit']))[0].r.permission==='edit'&&(await call(OWNER,'select * from public.daylight_list_event_shares($1)',[1])).length===1);
await call(OWNER,'select public.daylight_set_event_share_permission($1,$2)',[sent.id,'view']);

// ---- recipient side
let inv=await call(SAM,'select * from public.daylight_list_my_event_invites()');
check('the recipient sees the invite with owner, event title/time, its calendar color and the permission',inv.length===1&&inv[0].owner_name==='Olivia Owner'&&inv[0].event_title==='Dinner'&&inv[0].calendar_color==='blue'&&inv[0].permission==='view'&&!!inv[0].event_start,JSON.stringify(inv));
check('nobody else sees it',(await call(RIA,'select * from public.daylight_list_my_event_invites()')).length===0&&(await call(STRANGER,'select * from public.daylight_list_my_event_invites()')).length===0);
check('a pending invite gives no access to the event',(await call(SAM,'select * from public.daylight_list_my_shared_events()')).length===0);
check('only the named recipient can respond',/no longer available/.test(await fails(RIA,'select public.daylight_respond_event_share($1,$2)',[sent.id,true]))&&/no longer available/.test(await fails(OWNER,'select public.daylight_respond_event_share($1,$2)',[sent.id,true])));
check('a pending invite cannot be cleared',/first/.test(await fails(SAM,'select public.daylight_clear_event_invite($1)',[sent.id])));
await call(SAM,'select public.daylight_respond_event_share($1,$2)',[sent.id,true]);
let shared=await call(SAM,'select * from public.daylight_list_my_shared_events()');
check('accepting makes it visible to them: the owner\'s ONE event, with owner and calendar info',shared.length===1&&shared[0].event.title==='Dinner'&&shared[0].owner_name==='Olivia Owner'&&shared[0].calendar_name==='Family'&&shared[0].is_main,JSON.stringify(shared));
check('no private fields leak into the shared event (no calendar flags, no other events)',!('_cal_name' in shared[0].event)&&shared[0].event.id===1&&shared.every(r=>r.event.title!=='Private thing'));
check('an invite cannot be answered twice',/no longer available/.test(await fails(SAM,'select public.daylight_respond_event_share($1,$2)',[sent.id,false])));

// ---- VIEW ONLY: the database refuses writes
const before=await owner();
let m=await fails(SAM,`select public.daylight_apply_shared_event_changes($1,$2::jsonb)`,[sent.id,JSON.stringify({title:'Hacked'})]);
check('VIEW ONLY: a change is refused by the database',/view this event but not change it/.test(m),m);
const after=await owner();
check('VIEW ONLY: the owner\'s document and revision are unchanged',JSON.stringify(before)===JSON.stringify(after));
check('there is no function that lets a recipient delete or create the owner\'s events',(await db.query(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^daylight_(delete|create)_.*event'`)).rows[0].n===0);

// ---- switch to EDIT
await call(OWNER,'select public.daylight_set_event_share_permission($1,$2)',[sent.id,'edit']);
check('the owner can change the person\'s permission; the list shows it',(await call(OWNER,'select * from public.daylight_list_event_shares($1)',[1]))[0].permission==='edit');
const res=(await call(SAM,`select public.daylight_apply_shared_event_changes($1,$2::jsonb) r`,[sent.id,JSON.stringify({title:'Dinner at Ria\'s',loc:'Ria\'s place',cal:'c2',id:999,uid:'evil',desc:'bring wine'})]))[0].r;
const o2=await owner();
const dinner=o2.payload.events.find(e=>e.id===1);
check('EDIT: the title/location/description change on the owner\'s one event',dinner.title==='Dinner at Ria\'s'&&dinner.loc==='Ria\'s place'&&dinner.desc==='bring wine'&&res.title==='Dinner at Ria\'s');
check('EDIT: it can NOT move the event to another calendar, change its id, or its uid',dinner.cal==='c1'&&dinner.id===1&&dinner.uid===undefined&&!o2.payload.events.some(e=>e.id===999));
check('EDIT: the owner\'s revision goes up and nothing else changed',o2.revision===before.revision+1&&o2.payload.events.length===before.payload.events.length&&JSON.stringify(o2.payload.tasks)===JSON.stringify(before.payload.tasks)&&o2.payload.events.find(e=>e.id===5).title==='Private thing'&&o2.payload.events.find(e=>e.id===2).title==='Standup');
check('EDIT: an empty title / a huge field is refused',/needs a title/.test(await fails(SAM,`select public.daylight_apply_shared_event_changes($1,$2::jsonb)`,[sent.id,JSON.stringify({title:'  '})]))&&/too long/.test(await fails(SAM,`select public.daylight_apply_shared_event_changes($1,$2::jsonb)`,[sent.id,JSON.stringify({desc:'x'.repeat(20001)})])));
check('a stranger can never write',/Share not found/.test(await fails(STRANGER,`select public.daylight_apply_shared_event_changes($1,$2::jsonb)`,[sent.id,JSON.stringify({title:'x'})])));

// ---- series
const s2=(await call(OWNER,'select public.daylight_send_event_share($1,$2,$3) r',[2,SAM,'view']))[0].r;
await call(SAM,'select public.daylight_respond_event_share($1,$2)',[s2.id,true]);
shared=await call(SAM,'select * from public.daylight_list_my_shared_events()');
check('a repeating event is shared as ONE series: its record plus its same-uid exception copy',shared.filter(r=>r.share_id===s2.id).length===2&&shared.filter(r=>r.share_id===s2.id&&r.is_main).length===1);

// ---- calendar-share overlap
await db.exec(`insert into public.daylight_calendar_shares(owner_id,calendar_id,recipient_id,permission,status) values ('${OWNER}','c1','${RIA}','view','accepted')`);
check('an event cannot be invited to someone who already has its whole calendar',/already sees this calendar/.test(await fails(OWNER,'select public.daylight_send_event_share($1,$2,$3)',[5,RIA,'view'])));

// ---- decline, revoke, leave, delete
const s3=(await call(OWNER,'select public.daylight_send_event_share($1,$2,$3) r',[5,SAM,'view']))[0].r;
await call(SAM,'select public.daylight_respond_event_share($1,$2)',[s3.id,false]);
check('declined: nothing shared; the finished invite can be cleared and then disappears',(await call(SAM,'select * from public.daylight_list_my_shared_events()')).every(r=>r.event.id!==5)&&(await call(SAM,'select public.daylight_clear_event_invite($1) r',[s3.id]))[0].r.cleared&&(await call(SAM,'select * from public.daylight_list_my_event_invites()')).every(r=>r.id!==s3.id));
const s4=(await call(OWNER,'select public.daylight_send_event_share($1,$2,$3) r',[5,SAM,'view']))[0].r;
check('declining is final for that invite but the owner can send a fresh one',s4.id!==s3.id&&s4.status==='pending');
await call(OWNER,'select public.daylight_revoke_event_share($1)',[s4.id]);
check('the owner revoking a PENDING invite deletes it (the notification goes with it)',(await call(SAM,'select * from public.daylight_list_my_event_invites()')).every(r=>r.id!==s4.id)&&(await db.query(`select count(*)::int n from public.daylight_event_shares where id='${s4.id}'`)).rows[0].n===0);
await call(SAM,'select public.daylight_leave_event_share($1)',[s2.id]);
check('the recipient leaving removes it for them and from the owner\'s people list',(await call(SAM,'select * from public.daylight_list_my_shared_events()')).every(r=>r.share_id!==s2.id)&&(await call(OWNER,'select * from public.daylight_list_event_shares($1)',[2])).length===0);
check('after leaving, writes are refused',/Share not found/.test(await fails(SAM,`select public.daylight_apply_shared_event_changes($1,$2::jsonb)`,[s2.id,JSON.stringify({title:'x'})])));
await call(OWNER,'select public.daylight_revoke_event_share($1)',[sent.id]);
check('the owner removing an accepted person ends their access to that event only',(await call(SAM,'select * from public.daylight_list_my_shared_events()')).length===0);
const s5=(await call(OWNER,'select public.daylight_send_event_share($1,$2,$3) r',[1,SAM,'view']))[0].r;
await call(SAM,'select public.daylight_respond_event_share($1,$2)',[s5.id,true]);
await db.exec(`update public.workspace_snapshots set payload = jsonb_set(payload,'{events}',(select jsonb_agg(e) from jsonb_array_elements(payload->'events') e where (e->>'id')::int<>1)) where user_id='${OWNER}'`);
check('when the owner deletes the event it disappears for the recipient (list and invites)',(await call(SAM,'select * from public.daylight_list_my_shared_events()')).length===0&&(await call(SAM,'select * from public.daylight_list_my_event_invites()')).every(r=>r.id!==s5.id));

// ---- posture
check('browsers have no direct table access',(await db.query(`select has_table_privilege('authenticated','public.daylight_event_shares','select') a, has_table_privilege('anon','public.daylight_event_shares','select') b`)).rows[0].a===false);
check('the internal helper is not callable by browsers',(await db.query(`select has_function_privilege('authenticated','public.daylight_event_of(uuid,bigint)','execute') a`)).rows[0].a===false);
console.log(failed?'\nEVENT SHARING SQL: FAILED':'\nEVENT SHARING SQL: PASSED');
process.exit(failed?1:0);
