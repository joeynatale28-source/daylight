/**
 * Proves supabase/sql/20261122_device_sessions.sql in a REAL Postgres (PGlite) against a stand-in `auth` schema:
 * runs twice, registers the same browser three times (three sign-ins) and shows ONE row for it, keeps a second device
 * and legacy (unregistered) sessions apart, marks "current" correctly, and signs a device out together with its older sign-ins.
 *   npm i --no-save @electric-sql/pglite && node tests/sessions-sql.mjs   (local-only)
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const base=fs.readFileSync('supabase/sql/20261111_profile_sessions.sql','utf8');
const fix=fs.readFileSync('supabase/sql/20261122_device_sessions.sql','utf8');
const U='11111111-1111-4111-8111-111111111111', V='22222222-2222-4222-8222-222222222222';
const S=n=>`aaaaaaaa-0000-4000-8000-${String(n).padStart(12,'0')}`;
const DEV_A='device-aaaaaaaaaaaaaaaa', DEV_B='device-bbbbbbbbbbbbbbbb';
let failed=false;
const check=(name,ok,detail)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+name+(ok||!detail?'':'  -> '+detail))};

const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key);
  create table auth.sessions(id uuid primary key, user_id uuid, user_agent text, updated_at timestamptz default now(), not_after timestamptz);
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('session_id', current_setting('test.sid', true)) $$;
  insert into auth.users values ('${U}'),('${V}');`);
await db.exec(base);   // the earlier version of the functions (what is deployed today)
await db.exec(fix);
await db.exec(fix);    // idempotent
check('runs twice without error',true);

const as=async(uid,sid)=>{await db.exec(`select set_config('test.uid','${uid}',false), set_config('test.sid','${sid}',false)`)};
const sess=(n,ua,minsAgo)=>db.query(`insert into auth.sessions(id,user_id,user_agent,updated_at) values ($1,$2,$3, now() - ($4 || ' minutes')::interval)`,[S(n),U,ua,String(minsAgo)]);
const list=async()=>(await db.query('select * from public.daylight_list_my_sessions()')).rows;
const reg=async(sid,dev,label='Chrome on Windows')=>{await as(U,sid);return (await db.query('select public.daylight_register_device($1,$2) as r',[dev,label])).rows[0].r};

// Joey's list today: three sign-ins from the SAME browser (before this change, no device id) + a phone
await sess(1,'Chrome Windows',300);await sess(2,'Chrome Windows',200);await sess(3,'Chrome Windows',100);await sess(9,'Safari iPhone',50);
await as(U,S(3));
check('before registering: legacy rows are all shown (cannot be told apart safely)',(await list()).length===4,JSON.stringify((await list()).map(r=>r.id.slice(-2))));

// the same browser signs in again twice (new session each time) and registers
await sess(4,'Chrome Windows',10);await reg(S(4),DEV_A);
await sess(5,'Chrome Windows',5);await reg(S(5),DEV_A);
await sess(6,'Chrome Windows',1);await reg(S(6),DEV_A);
await as(U,S(6));
let rows=await list();
const mine=rows.filter(r=>r.device_id===DEV_A);
check('three registered sign-ins of one browser collapse to ONE row',mine.length===1,JSON.stringify(mine.map(r=>r.id.slice(-2))));
check('that row is the current session and says so',mine[0]&&mine[0].current===true&&mine[0].id===S(6));
check('legacy unregistered rows are left alone (3 legacy + phone)',rows.filter(r=>!r.device_id).length===4);

// a second registered device stays separate
await sess(7,'Firefox Linux',2);await reg(S(7),DEV_B,'Firefox on Linux');
await as(U,S(6));rows=await list();
check('a second device is its own row',rows.filter(r=>r.device_id===DEV_B).length===1&&rows.filter(r=>r.device_id===DEV_A).length===1);
check('current row sorts first',rows[0].id===S(6));

// from the other device, device A's newest session is shown (not an older one)
await as(U,S(7));rows=await list();
check('seen from device B, device A shows its newest session',rows.find(r=>r.device_id===DEV_A).id===S(6),rows.find(r=>r.device_id===DEV_A).id);

// signing device A out removes ALL of its sign-ins (the hidden ones too), never the caller's
await as(U,S(7));
const res=(await db.query('select public.daylight_revoke_my_session($1) as r',[S(6)])).rows[0].r;
const left=(await db.query('select id from auth.sessions order by id')).rows.map(r=>r.id);
check('revoke reports success',res.revoked===true);
check('every session of that device is gone',![4,5,6].some(n=>left.includes(S(n))));
check('the caller (device B) and legacy sessions survive',[1,2,3,7,9].every(n=>left.includes(S(n))),left.map(x=>x.slice(-2)).join());
let err='';try{await db.query('select public.daylight_revoke_my_session($1)',[S(7)])}catch(e){err=e.message}
check('current session cannot be revoked',/current session/i.test(err));

// another user can neither see nor register against these rows
await db.query(`insert into auth.sessions(id,user_id,user_agent) values ($1,$2,'Chrome Windows')`,[S(20),V]);
await as(V,S(20));
check('another user sees only their own session',(await list()).length===1);
await reg(S(20),DEV_A);
await as(U,S(7));
check('same device id from another user does not merge with this one',(await list()).filter(r=>r.id===S(20)).length===0);

// bad device ids are refused
let bad='';try{await reg(S(7),'x')}catch(e){bad=e.message}
check('malformed device id is refused',/Invalid device/.test(bad));
// browser roles cannot read the mapping table
check('anon/authenticated have no table privileges',(await db.query(`select has_table_privilege('authenticated','public.daylight_device_sessions','select') as a, has_table_privilege('anon','public.daylight_device_sessions','select') as b`)).rows.every(r=>!r.a&&!r.b));
console.log(failed?'FAILED':'PASSED');
process.exit(failed?1:0);
