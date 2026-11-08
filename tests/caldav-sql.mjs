/**
 * Reproduces the CalDAV account-save failure in a REAL Postgres (PGlite = Postgres 16 compiled to WASM) and proves the
 * corrective SQL fixes it, is idempotent, and leaves the right security posture.
 *   npm i --no-save @electric-sql/pglite && node tests/caldav-sql.mjs
 * It runs the exact statement shape PostgREST sends for supabase-js `.upsert(row, {onConflict:'user_id,server_url,username'})`.
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const original=fs.readFileSync('supabase/sql/20261120_caldav_accounts.sql','utf8');
const fix=fs.readFileSync('supabase/sql/20261121_caldav_accounts_fix.sql','utf8');
const U='11111111-1111-4111-8111-111111111111';
let failed=false;
const check=(name,ok,detail)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+name+(ok||!detail?'':'  -> '+detail))};

async function freshDb(){
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    insert into auth.users values ('${U}');`);
  return db;
}
const UPSERT=`insert into public.caldav_accounts (user_id, server_url, username, password, principal_url, home_url, last_error)
  values ($1, $2, $3, $4, $5, $6, null)
  on conflict (user_id, server_url, username) do update set password = excluded.password, principal_url = excluded.principal_url, home_url = excluded.home_url, last_error = null
  returning id`;
const row=(pw)=>[U,'https://caldav.example.com/','joey',pw,'https://caldav.example.com/p/','https://caldav.example.com/h/'];
async function tryUpsert(db,pw='pw-one'){try{const r=await db.query(UPSERT,row(pw));return {ok:true,id:r.rows[0].id}}catch(e){return {ok:false,code:e.code,message:e.message}}}
async function report(db){const r=await db.query(fix.slice(fix.lastIndexOf('select check_name')));return r.rows}

const LEGACY_FULL_NO_UNIQUE=`create table public.caldav_accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null, server_url text not null, username text not null,
  password text not null, principal_url text, home_url text, last_synced_at timestamptz, last_error text, created_at timestamptz default now(), updated_at timestamptz default now());`;
const variants=[
 {name:'table exists with every column but WITHOUT the unique rule (the prime suspect)',legacy:LEGACY_FULL_NO_UNIQUE,expectCode:'42P10',
  expectText:/no unique or exclusion constraint matching the ON CONFLICT specification/},
 {name:'table exists but is missing columns the code writes',legacy:`create table public.caldav_accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null, server_url text not null, username text not null, password text not null);`,expectCode:'42703',expectText:/column .* does not exist/},
 {name:'table exists with an extra NOT NULL column the code never writes',legacy:LEGACY_FULL_NO_UNIQUE.replace('password text not null,','password text not null, access_token text not null,').replace('updated_at timestamptz default now());','updated_at timestamptz default now(), unique (user_id, server_url, username));'),expectCode:'23502',expectText:/null value in column/},
];

// ---- 1. reproduce each failure mode against the SHIPPED original SQL
for(const v of variants){
  const db=await freshDb();
  await db.exec(v.legacy);
  await db.exec(original);                      // what Joey ran: every CREATE TABLE IF NOT EXISTS is skipped
  const before=await tryUpsert(db);
  check('reproduced: '+v.name+' -> upsert fails with '+v.expectCode,!before.ok&&before.code===v.expectCode&&v.expectText.test(before.message),JSON.stringify(before));
  if(v===variants[0])console.log('       exact Postgres error: '+before.code+' "'+before.message+'"');
  // ---- 2. the corrective SQL repairs it; run twice (idempotent)
  await db.exec(fix);await db.exec(fix);
  const after=await tryUpsert(db);
  const again=await tryUpsert(db,'pw-two');
  const count=(await db.query('select count(*)::int n, max(password) pw from public.caldav_accounts')).rows[0];
  check('fixed: upsert works, a second connect updates the same row (no duplicate)',after.ok&&again.ok&&after.id===again.id&&count.n===1&&count.pw==='pw-two',JSON.stringify({after,again,count}));
  const rep=await report(db);
  check('fixed: verification report all ok',rep.length===9&&rep.every(r=>r.status==='ok'),JSON.stringify(rep.filter(r=>r.status!=='ok')));
  await db.close();
}

// ---- 3. pre-existing duplicate rows would block the unique rule: the fix removes them (keeps the newest)
{
  const db=await freshDb();
  await db.exec(LEGACY_FULL_NO_UNIQUE);
  await db.query(`insert into public.caldav_accounts (user_id,server_url,username,password,updated_at) values ($1,'https://s/','a','old','2026-01-01'),($1,'https://s/','a','new','2026-06-01'),($1,'https://s/','b','other','2026-01-01')`,[U]);
  await db.exec(fix);await db.exec(fix);
  const rows=(await db.query('select username,password from public.caldav_accounts order by username')).rows;
  check('fixed: duplicate accounts collapsed to the newest, other accounts kept',JSON.stringify(rows)===JSON.stringify([{username:'a',password:'new'},{username:'b',password:'other'}]),JSON.stringify(rows));
  await db.close();
}

// ---- 4. fresh database: both the original and the corrective file work; posture is right
{
  const db=await freshDb();
  await db.exec(original);
  const viaOriginal=await tryUpsert(db);
  check('fresh database: the original SQL alone is fine (so the failure needs a pre-existing table)',viaOriginal.ok,JSON.stringify(viaOriginal));
  await db.exec(fix);await db.exec(fix);
  const rep=await report(db);
  check('fresh database: corrective SQL twice, report all ok',rep.every(r=>r.status==='ok'),JSON.stringify(rep));
  const posture=(await db.query(`select has_table_privilege('authenticated','public.caldav_accounts','select') acc_auth, has_table_privilege('anon','public.caldav_accounts','select') acc_anon,
    has_table_privilege('authenticated','public.caldav_calendars','select') cal_auth, has_table_privilege('authenticated','public.caldav_calendars','insert') cal_write,
    (select count(*)::int from pg_policies where tablename='caldav_accounts') acc_policies, (select count(*)::int from pg_policies where tablename='caldav_calendars') cal_policies`)).rows[0];
  check('posture: accounts unreachable from the browser roles, calendars owner-read only',!posture.acc_auth&&!posture.acc_anon&&posture.cal_auth&&!posture.cal_write&&posture.acc_policies===0&&posture.cal_policies===1,JSON.stringify(posture));
  await db.close();
}
console.log(failed?'FAILED':'PASSED');
process.exit(failed?1:0);
