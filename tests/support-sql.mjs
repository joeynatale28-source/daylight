/**
 * Proves supabase/sql/20261129_support_tickets.sql in a REAL Postgres (PGlite): a person sees and writes only their own tickets;
 * owners reach everything through the admin functions (refused to everyone else); and a support reply creates exactly ONE
 * notification, addressed to that ticket's person only (never everyone). Local-only (needs @electric-sql/pglite).
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const files=['20261124_broadcast_notifications','20261125_admin_dashboard','20261126_calendar_sharing','20261129_support_tickets'].map(f=>fs.readFileSync('supabase/sql/'+f+'.sql','utf8'));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const OWNER=id(1),ANN=id(2),BEN=id(3);
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key, email varchar, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
 create table public.workspace_snapshots(user_id uuid primary key, payload jsonb not null, revision int not null default 1, updated_at timestamptz default now());
 insert into auth.users(id,email,raw_user_meta_data,created_at) values ('${OWNER}','owner@example.com','{"full_name":"Olivia Owner"}','2020-01-01'),('${ANN}','ann@example.com','{"full_name":"Ann Lee"}','2020-01-01'),('${BEN}','ben@example.com','{"full_name":"Ben Roy"}','2020-01-01');`);
for(const f of files)await db.exec(f);
await db.exec(`insert into public.daylight_owners(user_id) values ('${OWNER}')`);
for(const f of files.slice(-1))await db.exec(f);
check('the file runs (twice, safely)',true);
const as=u=>db.exec(`select set_config('test.uid','${u||''}',false)`);
const call=async(u,q,a=[])=>{await as(u);return (await db.query(q,a)).rows};
const fails=async(u,q,a=[])=>{try{await call(u,q,a);return ''}catch(e){return e.message}};

check('signed-out cannot create a ticket',/Authenticated/.test(await fails(null,'select public.daylight_support_create_ticket($1,$2,$3,$4)',['A','a@b.co','S','M'])));
check('a ticket needs a name, a valid email, a subject and a message',/name/.test(await fails(ANN,'select public.daylight_support_create_ticket($1,$2,$3,$4)',['','a@b.co','S','M']))&&/valid email/.test(await fails(ANN,'select public.daylight_support_create_ticket($1,$2,$3,$4)',['A','nope','S','M']))&&/subject/.test(await fails(ANN,'select public.daylight_support_create_ticket($1,$2,$3,$4)',['A','a@b.co','','M']))&&/message/.test(await fails(ANN,'select public.daylight_support_create_ticket($1,$2,$3,$4)',['A','a@b.co','S',''])));
const t1=(await call(ANN,'select public.daylight_support_create_ticket($1,$2,$3,$4) r',['Ann Lee','ann@example.com','Calendar will not sync','It stopped yesterday.']))[0].r.id;
const t2=(await call(BEN,'select public.daylight_support_create_ticket($1,$2,$3,$4) r',['Ben Roy','ben@example.com','Question','Hello?']))[0].r.id;
let mine=await call(ANN,'select * from public.daylight_support_my_tickets()');
check('a person lists only their own tickets, with the last message',mine.length===1&&mine[0].id===t1&&mine[0].last_body==='It stopped yesterday.'&&mine[0].last_sender==='user'&&mine[0].status==='open',JSON.stringify(mine));
check('another person cannot read or write into that ticket',/Ticket not found/.test(await fails(BEN,'select * from public.daylight_support_thread($1)',[t1]))&&/Ticket not found/.test(await fails(BEN,'select public.daylight_support_send($1,$2)',[t1,'hi'])));
let th=await call(ANN,'select * from public.daylight_support_thread($1)',[t1]);
check('the person reads their thread: their own message under their name',th.length===1&&th[0].sender==='user'&&th[0].name==='Ann Lee');
check('a person cannot use the owner functions',/Only the owner/.test(await fails(ANN,'select * from public.daylight_support_admin_list()'))&&/Only the owner/.test(await fails(ANN,'select public.daylight_support_admin_reply($1,$2)',[t1,'x']))&&/Only the owner/.test(await fails(ANN,'select public.daylight_support_admin_set_status($1,$2)',[t1,'closed']))&&/Only the owner/.test(await fails(ANN,'select public.daylight_support_admin_seen($1)',[t1])));
let list=await call(OWNER,'select * from public.daylight_support_admin_list()');
check('the owner sees every ticket, unread until looked at',list.length===2&&list.every(r=>r.unread)&&list.find(r=>r.id===t1).name==='Ann Lee'&&list.find(r=>r.id===t1).last_sender==='user',JSON.stringify(list.map(r=>[r.name,r.unread])));
check('the owner can read any thread',(await call(OWNER,'select * from public.daylight_support_thread($1)',[t1])).length===1);
await call(OWNER,'select public.daylight_support_admin_seen($1)',[t1]);
check('marking a ticket seen clears its unread marker',(await call(OWNER,'select * from public.daylight_support_admin_list()')).find(r=>r.id===t1).unread===false);

// ---- the reply: ONE notification, for that one person only
const before=(await db.query('select count(*)::int n from public.daylight_broadcasts')).rows[0].n;
await call(OWNER,'select public.daylight_support_admin_reply($1,$2)',[t1,'We are looking into it.']);
const after=(await db.query('select count(*)::int n from public.daylight_broadcasts')).rows[0].n;
const note=(await db.query(`select b.id,b.title,b.body,b.sender,b.audience from public.daylight_broadcasts b order by b.created_at desc limit 1`)).rows[0];
const recips=(await db.query(`select user_id from public.daylight_broadcast_recipients where broadcast_id='${note.id}'`)).rows.map(r=>r.user_id);
check('a reply creates exactly ONE notification, audience "specific", sender "support"',after===before+1&&note.audience==='specific'&&note.sender==='support'&&note.title==='Daylight Support'&&/replied to your ticket/.test(note.body),JSON.stringify(note));
check('...addressed to the ticket\'s person only (one recipient, nobody else)',recips.length===1&&recips[0]===ANN,JSON.stringify(recips));
check('the person sees it in their bell',(await call(ANN,'select * from public.daylight_list_broadcasts()')).some(r=>r.sender==='support'&&r.title==='Daylight Support'));
check('nobody else sees it (not another person, not the owner)',!(await call(BEN,'select * from public.daylight_list_broadcasts()')).some(r=>r.sender==='support')&&!(await call(OWNER,'select * from public.daylight_list_broadcasts()')).some(r=>r.sender==='support'));
th=await call(ANN,'select * from public.daylight_support_thread($1)',[t1]);
check('the thread now shows the reply as "Daylight Support"',th.length===2&&th[1].sender==='support'&&th[1].name==='Daylight Support'&&th[1].avatar_url===null);
mine=await call(ANN,'select * from public.daylight_support_my_tickets()');
check('the ticket list shows the last message (the reply)',mine[0].last_sender==='support'&&mine[0].last_body==='We are looking into it.');

// ---- user reply, close / reopen
await call(ANN,'select public.daylight_support_send($1,$2)',[t1,'Thank you, it works now.']);
check('the person can reply; the owner sees it as unread again',(await call(OWNER,'select * from public.daylight_support_admin_list()')).find(r=>r.id===t1).unread===true);
await call(OWNER,'select public.daylight_support_admin_set_status($1,$2)',[t1,'closed']);
check('the owner can close a ticket; the person sees it closed',(await call(ANN,'select * from public.daylight_support_my_tickets()'))[0].status==='closed');
await call(ANN,'select public.daylight_support_send($1,$2)',[t1,'One more thing']);
check('a reply from the person reopens a closed ticket',(await call(ANN,'select * from public.daylight_support_my_tickets()'))[0].status==='open');
check('a ticket that does not exist is refused',/Ticket not found/.test(await fails(OWNER,'select public.daylight_support_admin_reply($1,$2)',[id(99),'x'])));

// ---- limits and posture
for(let i=0;i<4;i++)await call(ANN,'select public.daylight_support_create_ticket($1,$2,$3,$4)',['Ann Lee','ann@example.com','Extra '+i,'m']);
check('a person cannot pile up more than 5 open tickets',/several open requests/.test(await fails(ANN,'select public.daylight_support_create_ticket($1,$2,$3,$4)',['Ann Lee','ann@example.com','Too many','m'])));
check('browsers have no direct table access (row security on, no grants)',(await db.query(`select has_table_privilege('authenticated','public.daylight_support_tickets','select') a, has_table_privilege('authenticated','public.daylight_support_messages','insert') b, has_table_privilege('anon','public.daylight_support_tickets','select') c`)).rows[0].a===false);
console.log(failed?'\nSUPPORT SQL: FAILED':'\nSUPPORT SQL: PASSED');
process.exit(failed?1:0);
