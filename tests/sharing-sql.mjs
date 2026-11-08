/**
 * Proves supabase/sql/20261126_calendar_sharing.sql in a REAL Postgres (PGlite) with stand-ins for auth.users and
 * workspace_snapshots: the privacy bounds of the people search; invite / accept / decline rules; and, above all, that
 * permissions are enforced by the database: a "View only" recipient's writes are refused and change nothing, a "Can edit"
 * recipient's writes land in the ONE shared calendar of the owner's document (never another calendar), and the owner's
 * other data is left untouched. Local-only (needs @electric-sql/pglite).
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=fs.readFileSync('supabase/sql/20261126_calendar_sharing.sql','utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const OWNER=id(1), SAM=id(2), RIA=id(3), STRANGER=id(4), SAM2=id(5);
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth;
 create table auth.users(id uuid primary key, email varchar, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
 create table public.workspace_snapshots(user_id uuid primary key, payload jsonb not null, revision int not null default 1, updated_at timestamptz default now());
 insert into auth.users(id,email,raw_user_meta_data) values
  ('${OWNER}','owner@example.com','{"full_name":"Olivia Owner"}'),
  ('${SAM}','sam.lee@example.com','{"full_name":"Sam Lee","avatar_url":"https://x.example/storage/v1/object/public/avatars/${SAM}/avatar.png"}'),
  ('${SAM2}','sam.park@example.org','{"full_name":"Sam Park","avatar_url":"https://x.example/avatars/${OWNER}/avatar.png"}'),
  ('${RIA}','ria@example.com','{"name":"Ria Stone"}'),
  ('${STRANGER}','stranger@example.com','{}');
 insert into public.workspace_snapshots(user_id,payload,revision) values ('${OWNER}', '${JSON.stringify({
  calendars:[{id:'c1',name:'Family',color:'blue',publicLink:'https://secret.example/feed?token=abc'},{id:'c2',name:'Work',color:'green'},{id:'sub1',name:'A feed',color:'amber',subscribed:true},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}],
  events:[{id:1,cal:'c1',title:'Dinner',start:'2026-11-10T23:00:00.000Z',end:'2026-11-11T00:00:00.000Z',allDay:false},{id:2,cal:'c1',title:'Trip',start:'2026-11-12T05:00:00.000Z',end:'2026-11-13T04:59:00.000Z',allDay:true},{id:7,cal:'c2',title:'Secret work thing',start:'2026-11-10T14:00:00.000Z',end:'2026-11-10T15:00:00.000Z',allDay:false}],
  tasks:[{id:1,title:'Private task'}],settings:{themeMode:'dark',profileName:'Olivia Owner'},feeds:[],ui:{}})}'::jsonb, 4);`);
await db.exec(sql);await db.exec(sql);
check('the file runs (twice, safely)',true);
const as=u=>db.exec(`select set_config('test.uid','${u||''}',false)`);
const call=async(u,q,a=[])=>{await as(u);return (await db.query(q,a)).rows};
const fails=async(u,q,a=[])=>{try{await call(u,q,a);return ''}catch(e){return e.message}};
const owner=async()=>(await db.query(`select payload, revision from public.workspace_snapshots where user_id='${OWNER}'`)).rows[0];

// ---- people search
check('search needs a signed-in user',/Authenticated/.test(await fails(null,'select * from public.daylight_search_people($1)',['sam'])));
check('a one-letter query returns nothing',(await call(OWNER,'select * from public.daylight_search_people($1)',['s'])).length===0);
let res=await call(OWNER,'select * from public.daylight_search_people($1)',['sam']);
check('search matches names and shows ONLY name, email and picture',res.length===2&&JSON.stringify(Object.keys(res[0]).sort())==='["avatar_url","email","name","user_id"]',JSON.stringify(res));
check('same-name people are told apart by email',new Set(res.map(r=>r.email)).size===2&&res.every(r=>/^Sam /.test(r.name)));
check('a picture is only returned when it is in that account\'s own folder',res.find(r=>r.name==='Sam Lee').avatar_url.includes(SAM)&&res.find(r=>r.name==='Sam Park').avatar_url===null);
check('search matches email text too',(await call(OWNER,'select * from public.daylight_search_people($1)',['ria@']))[0]?.name==='Ria Stone');
check('you never find yourself',(await call(OWNER,'select * from public.daylight_search_people($1)',['olivia'])).length===0);
check('wildcards do not match everyone',(await call(OWNER,'select * from public.daylight_search_people($1)',['%%'])).length===0&&(await call(OWNER,'select * from public.daylight_search_people($1)',['__'])).length===0);
await db.exec(`insert into auth.users(id,email,raw_user_meta_data) select ('10000000-0000-4000-8000-0000000000'||lpad(g::text,2,'0'))::uuid,'bulk'||g||'@example.com',('{"full_name":"Bulk Person '||g||'"}')::jsonb from generate_series(1,9) g`);
check('at most 5 matches come back',(await call(OWNER,'select * from public.daylight_search_people($1)',['bulk person'])).length===5);

// ---- sending
check('only a calendar you own can be shared (not someone else\'s)',/Calendar not found/.test(await fails(SAM,'select public.daylight_send_calendar_share($1,$2,$3)',['c1',RIA,'view'])));
check('a subscribed calendar cannot be shared',/Only calendars you own/.test(await fails(OWNER,'select public.daylight_send_calendar_share($1,$2,$3)',['sub1',SAM,'view'])));
check('US Holidays cannot be shared',/Only calendars you own/.test(await fails(OWNER,'select public.daylight_send_calendar_share($1,$2,$3)',['holidays',SAM,'view'])));
check('you cannot invite yourself, a bad permission, or a missing person',/already own/.test(await fails(OWNER,'select public.daylight_send_calendar_share($1,$2,$3)',['c1',OWNER,'view']))&&/Choose/.test(await fails(OWNER,'select public.daylight_send_calendar_share($1,$2,$3)',['c1',SAM,'owner']))&&/Person not found/.test(await fails(OWNER,'select public.daylight_send_calendar_share($1,$2,$3)',['c1',id(99),'view'])));
let sent=(await call(OWNER,'select public.daylight_send_calendar_share($1,$2,$3) r',['c1',SAM,'view']))[0].r;
check('an invite goes out pending',sent.status==='pending'&&sent.permission==='view');
check('sending again to a pending person updates it (a resend), not a duplicate',(await call(OWNER,'select public.daylight_send_calendar_share($1,$2,$3) r',['c1',SAM,'edit']))[0].r.permission==='edit'&&(await call(OWNER,'select * from public.daylight_list_calendar_shares($1)',['c1'])).length===1);

// ---- the recipient's side
let inv=await call(SAM,'select * from public.daylight_list_my_invites()');
check('the recipient sees the invite with the owner\'s name, the calendar, its color and the permission',inv.length===1&&inv[0].owner_name==='Olivia Owner'&&inv[0].calendar_name==='Family'&&inv[0].calendar_color==='blue'&&inv[0].permission==='edit'&&inv[0].status==='pending',JSON.stringify(inv));
check('nobody else sees it',(await call(RIA,'select * from public.daylight_list_my_invites()')).length===0&&(await call(STRANGER,'select * from public.daylight_list_my_invites()')).length===0);
check('a pending invite gives no access to events yet',/Share not found/.test(await fails(SAM,'select public.daylight_shared_calendar_events($1)',[sent.id])));
check('only the named recipient can respond',/no longer available/.test(await fails(RIA,'select public.daylight_respond_calendar_share($1,$2)',[sent.id,true]))&&/no longer available/.test(await fails(OWNER,'select public.daylight_respond_calendar_share($1,$2)',[sent.id,true])));
check('a pending invite cannot be cleared',/first/.test(await fails(SAM,'select public.daylight_clear_calendar_invite($1)',[sent.id])));
await call(SAM,'select public.daylight_respond_calendar_share($1,$2)',[sent.id,true]);
check('accepting makes it a shared calendar for them',(await call(SAM,'select * from public.daylight_list_my_shared_calendars()'))[0]?.calendar_name==='Family');
check('an invite cannot be answered twice',/no longer available/.test(await fails(SAM,'select public.daylight_respond_calendar_share($1,$2)',[sent.id,false])));
check('the finished invite stays (as "accepted") until the recipient clears it',(await call(SAM,'select * from public.daylight_list_my_invites()'))[0].status==='accepted');
await call(SAM,'select public.daylight_clear_calendar_invite($1)',[sent.id]);
check('after clearing it is gone from notifications but the calendar stays',(await call(SAM,'select * from public.daylight_list_my_invites()')).length===0&&(await call(SAM,'select * from public.daylight_list_my_shared_calendars()')).length===1);
check('a person who already has access cannot be invited again',/already has access/.test(await fails(OWNER,'select public.daylight_send_calendar_share($1,$2,$3)',['c1',SAM,'view'])));

// ---- reading
let evs=(await call(SAM,'select public.daylight_shared_calendar_events($1) r',[sent.id]))[0].r;
check('the recipient reads that ONE calendar\'s events and nothing else of the owner',evs.length===2&&evs.every(e=>e.cal==='c1')&&!JSON.stringify(evs).includes('Secret work thing')&&!JSON.stringify(evs).includes('Private task'));
check('a stranger cannot read them',/Share not found/.test(await fails(STRANGER,'select public.daylight_shared_calendar_events($1)',[sent.id])));
check('the owner\'s public link never leaks through the lists',!JSON.stringify(await call(SAM,'select * from public.daylight_list_my_shared_calendars()')).includes('secret.example'));

// ---- writing: Can edit
const snap0=await owner();
res=(await call(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb) r',[sent.id,JSON.stringify([{op:'create',client_id:'tmp1',event:{title:'Sam adds this',start:'2026-11-20T15:00:00.000Z',end:'2026-11-20T16:00:00.000Z',allDay:false,cal:'c2',id:1}}])]))[0].r;
let after=await owner();
const added=after.payload.events.find(e=>e.title==='Sam adds this');
check('a "Can edit" recipient\'s new event is written into the owner\'s document, with a fresh id',!!added&&added.id===8&&res.created.tmp1===8,JSON.stringify(res.created));
check('...on the SHARED calendar, even if the request named another one',added.cal==='c1');
check('...and the owner\'s revision moved on, other data untouched',after.revision===snap0.revision+1&&JSON.stringify(after.payload.settings)===JSON.stringify(snap0.payload.settings)&&JSON.stringify(after.payload.tasks)===JSON.stringify(snap0.payload.tasks)&&after.payload.events.find(e=>e.id===7).title==='Secret work thing');
await call(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'update',event:{id:1,title:'Dinner (moved)',cal:'c2',id2:5}}])]);
after=await owner();
check('an update changes that event only, and cannot move it to another calendar',after.payload.events.find(e=>e.id===1).title==='Dinner (moved)'&&after.payload.events.find(e=>e.id===1).cal==='c1'&&after.payload.events.find(e=>e.id===2).title==='Trip');
check('it cannot edit an event of the owner\'s other calendar',/no longer exists/.test(await fails(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'update',event:{id:7,title:'hacked'}}])]))&&(await owner()).payload.events.find(e=>e.id===7).title==='Secret work thing');
await call(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'delete',event:{id:7}}])]);
check('a delete cannot remove an event of another calendar either',(await owner()).payload.events.some(e=>e.id===7));
await call(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'delete',event:{id:2}}])]);
check('a delete removes the shared calendar\'s event',!(await owner()).payload.events.some(e=>e.id===2));
check('oversized or empty events are refused',/too long/.test(await fails(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'create',event:{title:'x'.repeat(501),start:'a',end:'b'}}])]))&&/needs a title/.test(await fails(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'create',event:{title:'',start:'a',end:'b'}}])])));

// ---- writing: View only is refused BY THE DATABASE
const owned=(await call(OWNER,'select * from public.daylight_list_calendar_shares($1)',['c1']))[0];
await call(OWNER,'select public.daylight_set_calendar_share_permission($1,$2)',[owned.id,'view']);
const snap1=await owner();
const refused=await fails(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'create',event:{title:'Should be refused',start:'2026-11-21T15:00:00.000Z',end:'2026-11-21T16:00:00.000Z'}}])]);
check('VIEW ONLY: a create is refused by the database',/view this calendar but not change it/.test(refused),refused);
check('VIEW ONLY: an update and a delete are refused too',/view this calendar/.test(await fails(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'update',event:{id:1,title:'nope'}}])]))&&/view this calendar/.test(await fails(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'delete',event:{id:1}}])])));
const snap2=await owner();
check('VIEW ONLY: nothing in the owner\'s document or revision changed',JSON.stringify(snap2)===JSON.stringify(snap1));
check('VIEW ONLY: reading still works',(await call(SAM,'select public.daylight_shared_calendar_events($1) r',[sent.id]))[0].r.length>=2);
check('a recipient cannot change their own permission',/Share not found/.test(await fails(SAM,'select public.daylight_set_calendar_share_permission($1,$2)',[owned.id,'edit'])));
await call(OWNER,'select public.daylight_set_calendar_share_permission($1,$2)',[owned.id,'edit']);
check('switching the person to "Can edit" lets the same account write',(await call(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb) r',[sent.id,JSON.stringify([{op:'update',event:{id:1,title:'Dinner (edit again)'}}])]))[0].r.events.some(e=>e.title==='Dinner (edit again)'));

// ---- owner's list, revoke, leave
check('the owner\'s list shows the person with their permission and status',(await call(OWNER,'select * from public.daylight_list_calendar_shares($1)',['c1']))[0].status==='accepted');
check('another account cannot see or change the owner\'s people list',(await call(RIA,'select * from public.daylight_list_calendar_shares($1)',['c1'])).length===0&&/Share not found/.test(await fails(RIA,'select public.daylight_revoke_calendar_share($1)',[owned.id])));
await call(OWNER,'select public.daylight_revoke_calendar_share($1)',[owned.id]);
check('revoking ends access: the calendar leaves their list and reads/writes are refused',(await call(SAM,'select * from public.daylight_list_my_shared_calendars()')).length===0&&/Share not found/.test(await fails(SAM,'select public.daylight_shared_calendar_events($1)',[sent.id]))&&/Share not found/.test(await fails(SAM,'select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,JSON.stringify([{op:'delete',event:{id:1}}])])));
// pending revoke deletes the invite
const p2=(await call(OWNER,'select public.daylight_send_calendar_share($1,$2,$3) r',['c2',RIA,'view']))[0].r;
check('a pending invite shows up for the recipient',(await call(RIA,'select * from public.daylight_list_my_invites()')).length===1);
await call(OWNER,'select public.daylight_revoke_calendar_share($1)',[p2.id]);
check('cancelling a pending invite deletes it, and the recipient\'s notification goes with it',(await call(RIA,'select * from public.daylight_list_my_invites()')).length===0&&(await db.query(`select count(*)::int n from public.daylight_calendar_shares where id='${p2.id}'`)).rows[0].n===0);
// decline is final, a fresh invite works
const p3=(await call(OWNER,'select public.daylight_send_calendar_share($1,$2,$3) r',['c2',RIA,'view']))[0].r;
await call(RIA,'select public.daylight_respond_calendar_share($1,$2)',[p3.id,false]);
check('declining is final for that invite and adds nothing',(await call(RIA,'select * from public.daylight_list_my_shared_calendars()')).length===0&&/no longer available/.test(await fails(RIA,'select public.daylight_respond_calendar_share($1,$2)',[p3.id,true])));
check('...but the owner can always send a fresh one',!!(await call(OWNER,'select public.daylight_send_calendar_share($1,$2,$3) r',['c2',RIA,'edit']))[0].r.id);
const p4=(await call(RIA,'select * from public.daylight_list_my_invites()')).find(r=>r.status==='pending');
await call(RIA,'select public.daylight_respond_calendar_share($1,$2)',[p4.id,true]);
await call(RIA,'select public.daylight_leave_calendar_share($1)',[p4.id]);
check('leaving ends their access and the owner\'s people list updates',(await call(RIA,'select * from public.daylight_list_my_shared_calendars()')).length===0&&(await call(OWNER,'select * from public.daylight_list_calendar_shares($1)',['c2'])).length===0);
// calendar deleted by the owner
const p5=(await call(OWNER,'select public.daylight_send_calendar_share($1,$2,$3) r',['c2',SAM,'view']))[0].r;
await call(SAM,'select public.daylight_respond_calendar_share($1,$2)',[p5.id,true]);
await db.exec(`update public.workspace_snapshots set payload = jsonb_set(payload,'{calendars}', (select jsonb_agg(c) from jsonb_array_elements(payload->'calendars') c where c->>'id' <> 'c2')) where user_id='${OWNER}'`);
check('if the owner deletes the calendar it disappears for the recipient',(await call(SAM,'select * from public.daylight_list_my_shared_calendars()')).length===0);

// ---- posture
check('browser roles have no direct access to the table',(await db.query(`select has_table_privilege('authenticated','public.daylight_calendar_shares','select') a, has_table_privilege('authenticated','public.daylight_calendar_shares','insert') b, has_table_privilege('anon','public.daylight_calendar_shares','select') c`)).rows.every(r=>!r.a&&!r.b&&!r.c));
check('the internal helpers are not callable from the browser',(await db.query(`select has_function_privilege('authenticated','public.daylight_calendar_of(uuid,text)','execute') a, has_function_privilege('authenticated','public.daylight_person(uuid)','execute') b`)).rows.every(r=>!r.a&&!r.b));
check('every public function refuses a signed-out caller',(await Promise.all([['select * from public.daylight_list_my_invites()'],['select * from public.daylight_list_my_shared_calendars()'],['select public.daylight_shared_calendar_events($1)',[sent.id]],['select public.daylight_apply_shared_event_ops($1,$2::jsonb)',[sent.id,'[]']]].map(async([q,a])=>(await call(null,q,a||[])).length===0||false).map(p=>p.catch(()=>true)))).every(Boolean));
console.log(failed?'FAILED':'PASSED');process.exit(failed?1:0);
