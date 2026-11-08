/**
 * Proves supabase/sql/20261124_broadcast_notifications.sql in a REAL Postgres (PGlite) with a stand-in auth schema:
 * runs twice; only the owner can send or remove; everyone sees what was sent; unread flags and marking read work per user;
 * new accounts don't get old messages; the browser roles have no direct table access.
 *   npm i --no-save @electric-sql/pglite && node tests/notifications-sql.mjs   (local-only)
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=fs.readFileSync('supabase/sql/20261124_broadcast_notifications.sql','utf8');
const OWNER='11111111-1111-4111-8111-111111111111', USER2='22222222-2222-4222-8222-222222222222', NEWBIE='33333333-3333-4333-8333-333333333333';
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key, email text, created_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
 insert into auth.users(id,email,created_at) values ('${OWNER}','owner@example.com', now() - interval '30 days'),('${USER2}','two@example.com', now() - interval '20 days');`);
await db.exec(sql);await db.exec(sql);
check('runs twice without error',true);
await db.exec(`insert into public.daylight_owners(user_id) select id from auth.users where lower(email)=lower('owner@example.com') on conflict do nothing`);
const as=u=>db.exec(`select set_config('test.uid','${u||''}',false)`);
const call=async(u,q,a=[])=>{await as(u);return (await db.query(q,a)).rows};
const fails=async(u,q,a=[])=>{try{await call(u,q,a);return ''}catch(e){return e.message}};

check('owner is recognized',(await call(OWNER,'select public.daylight_is_owner() v'))[0].v===true);
check('another account is not',(await call(USER2,'select public.daylight_is_owner() v'))[0].v===false);
check('a signed-out caller is not',(await call(null,'select public.daylight_is_owner() v'))[0].v===false);

check('a non-owner cannot send',/Only the owner/.test(await fails(USER2,'select public.daylight_send_broadcast($1,$2)',['Hi','Everyone'])));
check('a signed-out caller cannot send',/Authenticated/.test(await fails(null,'select public.daylight_send_broadcast($1,$2)',['Hi','Everyone'])));
check('empty title/message and oversize are refused',/Title/.test(await fails(OWNER,'select public.daylight_send_broadcast($1,$2)',['  ','x']))&&/Message/.test(await fails(OWNER,'select public.daylight_send_broadcast($1,$2)',['t','']))&&/Message/.test(await fails(OWNER,'select public.daylight_send_broadcast($1,$2)',['t','x'.repeat(1001)])));
const sent=(await call(OWNER,'select public.daylight_send_broadcast($1,$2) r',['  Maintenance tonight  ','The calendar may be slow around 10pm.']))[0].r;
check('the owner can send (title is trimmed)',!!sent.id&&(await call(OWNER,'select title from public.daylight_list_broadcasts()'))[0].title==='Maintenance tonight');

let l2=await call(USER2,'select * from public.daylight_list_broadcasts()');
check('another account receives it, unread, from daylight',l2.length===1&&l2[0].read===false&&l2[0].sender==='daylight'&&l2[0].body.startsWith('The calendar'));
check('a signed-out caller sees nothing',(await call(null,'select * from public.daylight_list_broadcasts()')).length===0);
await call(USER2,'select public.daylight_mark_broadcasts_read()');
check('marking read is per account',(await call(USER2,'select read from public.daylight_list_broadcasts()'))[0].read===true&&(await call(OWNER,'select read from public.daylight_list_broadcasts()'))[0].read===false);

await db.exec(`insert into auth.users(id,email,created_at) values ('${NEWBIE}','new@example.com', now() + interval '1 minute')`);
check('an account created after the message does not get it',(await call(NEWBIE,'select * from public.daylight_list_broadcasts()')).length===0);

check('a non-owner cannot remove it',/Only the owner/.test(await fails(USER2,'select public.daylight_delete_broadcast($1)',[sent.id])));
check('the owner can remove it',(await call(OWNER,'select public.daylight_delete_broadcast($1) r',[sent.id]))[0].r.deleted===true&&(await call(USER2,'select * from public.daylight_list_broadcasts()')).length===0);

for(const t of ['daylight_owners','daylight_broadcasts','daylight_broadcast_reads'])
 check(`browser roles have no direct access to ${t}`,(await db.query(`select has_table_privilege('authenticated','public.${t}','select') a, has_table_privilege('authenticated','public.${t}','insert') b, has_table_privilege('anon','public.${t}','select') c`)).rows.every(r=>!r.a&&!r.b&&!r.c));
console.log(failed?'FAILED':'PASSED');process.exit(failed?1:0);
