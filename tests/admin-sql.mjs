/**
 * Proves supabase/sql/20261125_admin_dashboard.sql in a REAL Postgres (PGlite) on top of the broadcast file that is already
 * live: targeting and not-found reporting, the owner always seeing everything, per-user clear, force remove, banners, and
 * that every owner action is refused for everyone else. Local-only (needs @electric-sql/pglite).
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const live=fs.readFileSync('supabase/sql/20261124_broadcast_notifications.sql','utf8');
const next=fs.readFileSync('supabase/sql/20261125_admin_dashboard.sql','utf8');
const OWNER='11111111-1111-4111-8111-111111111111', TEST='22222222-2222-4222-8222-222222222222', OTHER='33333333-3333-4333-8333-333333333333';
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key, email text, created_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
 insert into auth.users(id,email,created_at) values ('${OWNER}','owner@example.com', now() + interval '1 hour'),('${TEST}','user@daylightcal.com', now() - interval '20 days'),('${OTHER}','other@example.com', now() - interval '10 days');`);
await db.exec(live);
await db.exec(`insert into public.daylight_owners(user_id) values ('${OWNER}')`);
// a notification that exists before this change (like the one already sent), then the new file
await db.exec(`select set_config('test.uid','${OWNER}',false)`);
await db.query(`select public.daylight_send_broadcast('Already live','Sent before this change')`);
await db.exec(next);
check('the new file runs on top of the live one',true);
const as=u=>db.exec(`select set_config('test.uid','${u||''}',false)`);
const call=async(u,q,a=[])=>{await as(u);return (await db.query(q,a)).rows};
const fails=async(u,q,a=[])=>{try{await call(u,q,a);return ''}catch(e){return e.message}};
const titles=async u=>(await call(u,'select title from public.daylight_list_broadcasts()')).map(r=>r.title);

// the owner's own list
check('the owner sees a message that was sent before their account existed (the sender is never left out)',(await titles(OWNER)).includes('Already live'));
check('an ordinary account created before it also sees it',(await titles(TEST)).includes('Already live'));

// targeting
let r=(await call(OWNER,'select public.daylight_send_notification($1,$2,$3) r',['Just for you','Hello test account',['user@daylightcal.com']]))[0].r;
check('a targeted send reports who matched',r.sent===true&&r.audience==='specific'&&JSON.stringify(r.matched)==='["user@daylightcal.com"]'&&r.not_found.length===0,JSON.stringify(r));
check('the named account receives it',(await titles(TEST)).includes('Just for you'));
check('an account that was not named does not',!(await titles(OTHER)).includes('Just for you'));
check('and neither does the owner (it was not addressed to them)',!(await titles(OWNER)).includes('Just for you'));
r=(await call(OWNER,'select public.daylight_send_notification($1,$2,$3) r',['Mixed','Some match',['USER@daylightcal.com ',' nobody@made-up.example']]))[0].r;
check('emails are matched case-insensitively and the unmatched one is named back',r.sent===true&&r.matched.length===1&&JSON.stringify(r.not_found)==='["nobody@made-up.example"]',JSON.stringify(r));
check('only the matched account got it',(await titles(TEST)).includes('Mixed')&&!(await titles(OTHER)).includes('Mixed'));
const before=(await call(OWNER,'select count(*)::int n from public.daylight_admin_list_notifications()'))[0].n;
r=(await call(OWNER,'select public.daylight_send_notification($1,$2,$3) r',['Nobody','No match',['made.up@example.com','also.fake@example.com']]))[0].r;
check('when no email matches nothing is sent, and both are named',r.sent===false&&r.not_found.length===2&&(await call(OWNER,'select count(*)::int n from public.daylight_admin_list_notifications()'))[0].n===before,JSON.stringify(r));
r=(await call(OWNER,'select public.daylight_send_notification($1,$2,$3) r',['For all','Everyone gets this',null]))[0].r;
check('an everyone send reaches every account, the sender included',r.sent===true&&r.audience==='everyone'&&(await titles(TEST)).includes('For all')&&(await titles(OTHER)).includes('For all')&&(await titles(OWNER)).includes('For all'));

// owner-only
for(const [name,q,a] of [['send notification','select public.daylight_send_notification($1,$2,$3)',['x','y',null]],['admin list','select * from public.daylight_admin_list_notifications()',[]],['send banner','select public.daylight_send_banner($1,$2,$3,$4)',['Hi','#112233',null,null]],['admin banners','select * from public.daylight_admin_list_banners()',[]],['delete banner','select public.daylight_delete_banner($1)',[OWNER]],['delete notification','select public.daylight_delete_broadcast($1)',[OWNER]]])
 check(`a non-owner is refused: ${name}`,/Only the owner/.test(await fails(TEST,q,a)),await fails(TEST,q,a));
check('a signed-out caller is refused',/Authenticated/.test(await fails(null,'select public.daylight_send_notification($1,$2,$3)',['x','y',null])));
check('the resolver is not callable by the browser roles',(await db.query(`select has_function_privilege('authenticated','public.daylight_resolve_emails(text[])','execute') a`)).rows[0].a===false);

// per-user clear
const mixedId=(await call(OWNER,`select id from public.daylight_admin_list_notifications() where title='For all'`))[0].id;
await call(TEST,'select public.daylight_clear_broadcast($1)',[mixedId]);
check('clearing removes it from that account only',!(await titles(TEST)).includes('For all')&&(await titles(OTHER)).includes('For all')&&(await titles(OWNER)).includes('For all'));
check('and it stays cleared (the next list, any device)',!(await titles(TEST)).includes('For all'));

// force remove
await call(OWNER,'select public.daylight_delete_broadcast($1)',[mixedId]);
check('the owner can force-remove it for everyone',!(await titles(OTHER)).includes('For all')&&!(await titles(OWNER)).includes('For all'));

// banners
const ok=(await call(OWNER,'select public.daylight_send_banner($1,$2,$3,$4) r',['Maintenance at 10pm','#e07a1f','https://example.com/status',null]))[0].r;
check('an everyone banner posts',ok.sent===true&&ok.audience==='everyone');
await call(OWNER,'select public.daylight_send_banner($1,$2,$3,$4)',['Only for the test account','#2563eb',null,['user@daylightcal.com']]);
const bt=async u=>(await call(u,'select body, color, link from public.daylight_list_banners()')).map(x=>x.body);
check('the named account sees both banners, newest first',JSON.stringify(await bt(TEST))==='["Only for the test account","Maintenance at 10pm"]',JSON.stringify(await bt(TEST)));
check('another account sees only the everyone banner',JSON.stringify(await bt(OTHER))==='["Maintenance at 10pm"]');
check('the color and link are stored as given',(await call(OTHER,'select color, link from public.daylight_list_banners()'))[0].color==='#E07A1F'&&(await call(OTHER,'select link from public.daylight_list_banners()'))[0].link==='https://example.com/status');
check('a banner to a made-up address posts nothing and says so',(await call(OWNER,'select public.daylight_send_banner($1,$2,$3,$4) r',['Ghost','#111111',null,['ghost@nowhere.example']]))[0].r.sent===false&&(await bt(TEST)).length===2);
check('bad colors and links are refused',/color/i.test(await fails(OWNER,'select public.daylight_send_banner($1,$2,$3,$4)',['x','red',null,null]))&&/link/i.test(await fails(OWNER,'select public.daylight_send_banner($1,$2,$3,$4)',['x','#111111','javascript:alert(1)',null])));
const bid=(await call(OWNER,`select id from public.daylight_admin_list_banners() where body='Maintenance at 10pm'`))[0].id;
await call(OWNER,'select public.daylight_delete_banner($1)',[bid]);
check('removing a banner takes it off everyone',!(await bt(TEST)).includes('Maintenance at 10pm')&&(await bt(OTHER)).length===0);

for(const t of ['daylight_broadcast_recipients','daylight_broadcast_clears','daylight_banners','daylight_banner_recipients'])
 check(`browser roles have no direct access to ${t}`,(await db.query(`select has_table_privilege('authenticated','public.${t}','select') a, has_table_privilege('authenticated','public.${t}','insert') b, has_table_privilege('anon','public.${t}','select') c`)).rows.every(x=>!x.a&&!x.b&&!x.c));
console.log(failed?'FAILED':'PASSED');process.exit(failed?1:0);
