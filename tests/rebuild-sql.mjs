/**
 * Proves the REBUILD run order on a brand-new, empty Postgres (PGlite): reconstructed base schema first, then the repo SQL
 * in date order, the _fixed MCP RPC (never the unfixed twin), the MCP atomic-delete function, and the CalDAV removal last.
 * Also checks the security posture of the reconstructed tables. Local-only (needs @electric-sql/pglite):
 *   node tests/rebuild-sql.mjs   (with NODE_PATH or a node_modules that has @electric-sql/pglite)
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const ORDER=[
 'supabase/sql/20261101_base_schema_core.sql',
 'supabase/sql/20261102_base_schema_mcp.sql',
 'supabase/sql/20261104_mcp_oauth_client_permissions.sql',
 'supabase/sql/20261104_mcp_grants_prevent_oauth_permission_escalation.sql',
 'supabase/sql/20261104_mcp_oauth_scoped_workspace_rpc_fixed.sql',
 'mcp/sql/20261104_atomic_delete_audit.sql',
 'supabase/sql/20261111_profile_sessions.sql',
 'supabase/sql/20261122_device_sessions.sql',
 'supabase/sql/20261124_broadcast_notifications.sql',
 'supabase/sql/20261125_admin_dashboard.sql',
 'supabase/sql/20261126_calendar_sharing.sql',
 'supabase/sql/20261127_fix_admin_email_types.sql',
 'supabase/sql/20261123_remove_caldav.sql'];
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),B=id(2);
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key, email varchar, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
 create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid, user_agent text, updated_at timestamptz default now(), not_after timestamptz);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
 create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
 alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
 insert into auth.users(id,email) values ('${A}','a@example.com'),('${B}','b@example.com');`);
for(const f of ORDER){
  try{await db.exec(fs.readFileSync(f,'utf8'));check('runs on a fresh database: '+f,true)}
  catch(e){check('runs on a fresh database: '+f,false,e.message)}
}
for(const f of ORDER.slice(0,3)){
  try{await db.exec(fs.readFileSync(f,'utf8'));check('safe to run twice: '+f,true)}catch(e){check('safe to run twice: '+f,false,e.message)}
}
const tables=(await db.query(`select tablename from pg_tables where schemaname='public'`)).rows.map(r=>r.tablename);
for(const t of ['workspace_snapshots','user_settings','calendars','subscriptions','mcp_tokens','mcp_audit_log','mcp_workspace_audit','mcp_grants','daylight_owners','daylight_broadcasts','daylight_banners','daylight_calendar_shares','daylight_device_sessions'])
  check('table exists: '+t,tables.includes(t));
check('no CalDAV tables exist',!tables.some(t=>/caldav/.test(t)));
const noRls=(await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)).rows;
check('row level security is on for every public table',noRls.length===0,JSON.stringify(noRls));
const as=async(uid,jwt)=>{await db.exec(`select set_config('test.uid','${uid||''}',false); select set_config('test.jwt','${jwt||''}',false); set role ${uid?'authenticated':'anon'}`)};
const reset=()=>db.exec('reset role');
const tryq=async(q,a=[])=>{try{return {rows:(await db.query(q,a)).rows}}catch(e){return {err:e.message}}};
// the browser path
await as(A);
let r=await tryq(`insert into public.workspace_snapshots(user_id,payload,revision) values ($1,'{"events":[]}',1)`,[A]);check('a person can create their own snapshot',!r.err,r.err);
r=await tryq(`insert into public.workspace_snapshots(user_id,payload,revision) values ($1,'{}',1)`,[B]);check('a person cannot create a snapshot for someone else',!!r.err);
r=await tryq(`update public.workspace_snapshots set payload='{"events":[1]}',revision=2 where user_id=$1 and revision=1 returning revision`,[A]);check('optimistic update by revision works',r.rows?.[0]?.revision===2,r.err);
r=await tryq(`update public.workspace_snapshots set revision=9 where user_id=$1 returning 1`,[B]);check('cannot update someone else\'s snapshot (0 rows)',!r.err&&r.rows.length===0);
r=await tryq(`select user_id from public.workspace_snapshots`);check('a person sees only their own snapshot',r.rows?.length===1&&r.rows[0].user_id===A);
await reset();await as(A,'{"client_id":"some-oauth-client"}');
r=await tryq(`select * from public.workspace_snapshots`);check('an OAuth (client_id) token sees NO snapshot rows through the Data API',r.rows?.length===0,JSON.stringify(r));
r=await tryq(`select * from public.user_settings`);check('an OAuth token sees no settings rows',(r.rows?.length||0)===0);
await reset();await as(A);
r=await tryq(`insert into public.user_settings(user_id,mcp_allow_delete) values ($1,true) on conflict (user_id) do update set mcp_allow_delete=excluded.mcp_allow_delete returning mcp_allow_delete`,[A]);check('settings upsert works for the owner',r.rows?.[0]?.mcp_allow_delete===true,r.err);
r=await tryq(`insert into public.mcp_tokens(user_id,name,scopes,token_prefix,token_hash) values ($1,'t',array['read','write'],'abcd1234','hash1') returning id`,[A]);check('a person can create an AI token',!r.err,r.err);
r=await tryq(`select id,user_id,name,token_prefix,scopes,created_at,last_used_at,revoked from public.mcp_tokens`);check('the token list columns the app reads work',r.rows?.length===1,r.err);
r=await tryq(`select token_hash from public.mcp_tokens`);check('the token hash is NOT readable from the browser',!!r.err);
r=await tryq(`update public.mcp_tokens set revoked=true where user_id=$1 returning revoked`,[A]);check('a person can revoke their token',r.rows?.[0]?.revoked===true,r.err);
r=await tryq(`insert into public.mcp_audit_log(user_id,tool) values ($1,'x')`,[A]);check('the browser cannot write the audit log',!!r.err);
r=await tryq(`select * from public.calendars`);check('browsers cannot touch calendars (Edge Function only)',!!r.err);
r=await tryq(`select * from public.subscriptions`);check('browsers cannot touch subscriptions directly',!!r.err);
await reset();await as(null);
r=await tryq(`select * from public.workspace_snapshots`);check('signed-out (anon) cannot read snapshots',!!r.err);
await reset();
// MCP definer paths on the rebuilt tables
await db.exec(`insert into public.mcp_grants(user_id,client_id,can_read,can_write,can_delete) values ('${A}','client-1',true,true,true)`);
await db.exec(`select set_config('test.uid','${A}',false); select set_config('test.jwt','{"client_id":"client-1"}',false); set role authenticated`);
r=await tryq(`select public.mcp_workspace_tool('list_calendars','{}') r`);check('OAuth list_calendars runs against the rebuilt tables',!r.err,r.err);
r=await tryq(`select public.mcp_workspace_tool('create_calendar','{"name":"AI Cal"}') r`);check('OAuth write path works and the audit insert succeeds',!r.err,r.err);
await reset();
r=await tryq(`select tool,result from public.mcp_workspace_audit where user_id=$1`,[A]);check('a human-readable audit row was written',r.rows?.length>=1,JSON.stringify(r));
await db.exec(`update public.workspace_snapshots set payload=jsonb_set(payload,'{events}','[{"id":7,"title":"Doomed","cal":"c1"}]') where user_id='${A}'`);
const rev=(await db.query(`select revision from public.workspace_snapshots where user_id=$1`,[A])).rows[0].revision;
r=await tryq(`select public.daylight_mcp_delete_snapshot_event($1,'7','Doomed','tok',$2) r`,[A,rev]);check('atomic delete function works (service role path) with the setting on',!r.err,r.err);
console.log(failed?'\nREBUILD SQL: FAILED':'\nREBUILD SQL: PASSED');
process.exit(failed?1:0);
