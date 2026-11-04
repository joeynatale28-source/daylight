/**
 * Daylight MCP integration smoke test, using the official SDK client.
 * Run against a TEST calendar only. The test creates disposable tokens.
 *
 * Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * DAYLIGHT_MCP_PUBLIC_URL, SMOKE_USER_ID, SMOKE_CALENDAR_ID.
 * Optional: SMOKE_SECOND_USER_ID to verify cross-user isolation.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes,createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint=process.env.DAYLIGHT_MCP_PUBLIC_URL;
const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
const owner=process.env.SMOKE_USER_ID,calendar=process.env.SMOKE_CALENDAR_ID;
if(!endpoint||!url||!secret||!owner||!calendar)throw Error('Missing required smoke-test env');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const created:string[]=[];
const check=(condition:boolean,why:string)=>{if(!condition)throw Error('FAIL: '+why);console.log('PASS: '+why)};
const idFrom=(tool:any)=>JSON.parse(tool.content[0].text).id;
async function token(name:string,scopes:string[]){
  const raw='dl_mcp_'+randomBytes(32).toString('hex');
  const hash=createHash('sha256').update(raw).digest('hex');
  const {data,error}=await admin.from('mcp_tokens').insert({
    user_id:owner,name,scopes,token_prefix:raw.slice(7,15),token_hash:hash
  }).select('id').single();
  if(error)throw error;
  created.push(data.id);return {raw,id:data.id};
}
async function connect(token:string){
  const client=new Client({name:'daylight-smoke',version:'1.0.0'});
  const transport=new StreamableHTTPClientTransport(new URL(endpoint),{
    requestInit:{headers:{Authorization:'Bearer '+token}}
  });
  await client.connect(transport);
  return {client,transport};
}
const call=async(client:Client,name:string,args:Record<string,any>)=>
  client.callTool({name,arguments:args});
const oldDelete=await admin.from('user_settings').select('mcp_allow_delete').eq('user_id',owner).maybeSingle();
if(oldDelete.error)throw oldDelete.error;
const prev=!!oldDelete.data?.mcp_allow_delete;
let testEvent:string|undefined;
const reads=await token('smoke-read-'+Date.now(),['read']);
const writes=await token('smoke-write-'+Date.now(),['read','write']);
let readConn:Awaited<ReturnType<typeof connect>>|undefined;
let writeConn:Awaited<ReturnType<typeof connect>>|undefined;
try{
  await admin.from('user_settings').upsert({user_id:owner,mcp_allow_delete:false});
  readConn=await connect(reads.raw);
  writeConn=await connect(writes.raw);
  const readCals=await call(readConn.client,'list_calendars',{});
  const owned=JSON.parse((readCals.content as any)[0].text);
  check(owned.some((c:any)=>c.id===calendar),'read token lists owned calendar');
  const testTask=await call(writeConn.client,'create_task',{
    title:'Temporary MCP smoke task',due_date:'2026-11-04'
  });
  check(!testTask.isError,'write token creates task');
  const taskId=String(idFrom(testTask));
  const completed=await call(writeConn.client,'complete_task',{id:taskId,completed:true});
  check(!completed.isError,'write token completes task');
  const started=new Date(Date.now()+86400000);
  const ended=new Date(+started+3600000);
  const createdEvent=await call(writeConn.client,'create_event',{
    calendar_id:calendar,title:'Temporary MCP smoke event',
    starts_at:started.toISOString(),ends_at:ended.toISOString(),
    timezone:'America/New_York'
  });
  check(!createdEvent.isError,'write token creates event');
  testEvent=String(idFrom(createdEvent));
  const deniedRead=await call(readConn.client,'create_event',{
    calendar_id:calendar,title:'Should be denied',
    starts_at:started.toISOString(),ends_at:ended.toISOString()
  });
  check(!!deniedRead.isError,'read token cannot create events');
  const deleteOff=await call(writeConn.client,'delete_event',{id:testEvent});
  check(!!deleteOff.isError,'delete denied when account setting is off');
  const enabled=await admin.from('user_settings').upsert({user_id:owner,mcp_allow_delete:true});
  if(enabled.error)throw enabled.error;
  const deletion=await call(writeConn.client,'delete_event',{id:testEvent});
  check(!deletion.isError,'write token deletes when explicitly enabled');
  const audit=await admin.from('mcp_audit_log').select('id').eq('user_id',owner)
    .eq('tool','delete_event').eq('token_name','smoke-write-'+String(writes.id)).limit(1);
  // Token name is not the UUID; verify audit entry by the event ID summary instead.
  const auditByEvent=await admin.from('mcp_audit_log').select('id,summary').eq('user_id',owner)
    .eq('tool','delete_event').ilike('summary','%'+testEvent+'%').limit(1);
  check(!auditByEvent.error&&!!auditByEvent.data?.length,'atomic deletion audit exists');
  testEvent=undefined;
  const revoke=await admin.from('mcp_tokens').update({revoked:true}).eq('id',reads.id);
  if(revoke.error)throw revoke.error;
  const unauth=await fetch(endpoint,{
    method:'POST',headers:{Authorization:'Bearer '+reads.raw,'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:7,method:'tools/list',params:{}})
  });
  check(unauth.status===401,'revoked token returns 401');
  const second=process.env.SMOKE_SECOND_USER_ID;
  if(second){
    const other=await admin.from('workspace_snapshots').select('payload').eq('user_id',second).maybeSingle();
    if(other.error)throw other.error;
    const theirs=new Set((other.data?.payload?.calendars||[]).map((x:any)=>x.id));
    check(owned.every((c:any)=>!theirs.has(c.id)),'user A sees no user B calendars');
  }else console.log('SKIP: cross-user isolation needs SMOKE_SECOND_USER_ID');
}finally{
  await admin.from('user_settings').upsert({user_id:owner,mcp_allow_delete:prev});
  if(testEvent) console.warn('Cleanup required: test event ID '+testEvent);
  for(const uuid of created)await admin.from('mcp_tokens').update({revoked:true}).eq('id',uuid);
  await readConn?.client.close();await writeConn?.client.close();
}
