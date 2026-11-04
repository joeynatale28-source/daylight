import "dotenv/config";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const serverURL=process.env.MCP_PUBLIC_URL||"http://localhost:8787/mcp";
const supabaseURL=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!supabaseURL||!secret)throw Error("Smoke tests require Supabase server credentials in .env");
const db=createClient(supabaseURL,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const token=()=>"dl_mcp_"+randomBytes(32).toString("hex");
const people:string[]=[];
async function rpc(key:string) {
 const client=new Client({name:"daylight-smoke-client",version:"0.1.0"});
 const transport=new StreamableHTTPClientTransport(new URL(serverURL),{
  requestInit:{headers:{Authorization:"Bearer "+key}}
 });
 await client.connect(transport);
 return {client,close:()=>client.close()};
}
function data(result:any) {
 const item=result.content?.find((x:any)=>x.type==="text");
 if(result.isError)throw Error(item?.text||"MCP returned tool error");
 assert.ok(item&&typeof item.text==="string");
 return JSON.parse(item.text);
}
const call=async(client:Client,name:string,args:Record<string,unknown>={})=>
 data(await client.callTool({name,arguments:args}));
async function makeUser(label:string) {
 const email="daylight-smoke-"+label+"-"+randomUUID()+"@example.invalid";
 const created=await db.auth.admin.createUser({email,email_confirm:true,password:randomBytes(24).toString("hex")});
 if(created.error||!created.data.user)throw Error("Unable to create test user: "+created.error?.message);
 const id=created.data.user.id;people.push(id);
 const workspace={version:2,calendars:[{id:"test",name:"Only "+label,color:"blue",hidden:false,subscribed:false}],
  events:[],tasks:[],settings:{},ui:{}};
 const insert=await db.from("workspace_snapshots").insert({user_id:id,payload:workspace,revision:1});
 if(insert.error)throw insert.error;
 return id;
}
async function mint(userId:string,name:string,scopes:string[]) {
 const key=token();
 const r=await db.from("mcp_tokens").insert({
  user_id:userId,name,token_hash:hash(key),token_prefix:key.slice(0,8),scopes
 }).select("id").single();
 if(r.error)throw r.error;
 return {key,id:r.data.id};
}
async function main(){
 let read:any,write:any,other:any;
 try {
  const a=await makeUser("A"),b=await makeUser("B");
  const aRead=await mint(a,"read-test",["read"]);
  const aWrite=await mint(a,"write-test",["read","write"]);
  const bRead=await mint(b,"other-user",["read"]);
  read=await rpc(aRead.key);write=await rpc(aWrite.key);other=await rpc(bRead.key);
  const aCalendars=await call(read.client,"list_calendars");
  const bCalendars=await call(other.client,"list_calendars");
  assert.equal(aCalendars.length,1);assert.equal(aCalendars[0].name,"Only A");
  assert.equal(bCalendars.length,1);assert.equal(bCalendars[0].name,"Only B");
  console.log("PASS: per-user calendar isolation and read scope");
  const task=await call(write.client,"create_task",{title:"MCP smoke task",calendar_id:"test"});
  const tasks=await call(read.client,"list_tasks");
  assert.ok(tasks.some((t:any)=>String(t.id)===String(task.id)));
  const completed=await call(write.client,"complete_task",{id:String(task.id),completed:true});
  assert.equal(completed.done,true);
  console.log("PASS: create, list, complete task");
  const start=new Date(Date.now()+3600000).toISOString();
  const end=new Date(Date.now()+7200000).toISOString();
  const ev=await call(write.client,"create_event",{
   calendar_id:"test",title:"MCP smoke event",starts_at:start,ends_at:end,timezone:"America/New_York"
  });
  const updated=await call(write.client,"update_event",{id:String(ev.id),title:"Updated smoke event"});
  assert.equal(updated.title,"Updated smoke event");
  const fetched=await call(read.client,"get_event",{id:String(ev.id)});
  assert.equal(fetched.title,"Updated smoke event");
  console.log("PASS: create, update, get event");
  const blocked=await read.client.callTool({name:"create_event",arguments:{
   calendar_id:"test",title:"Must not create",starts_at:start,ends_at:end
  }});
  assert.equal(blocked.isError,true);
  console.log("PASS: read-only token denied write");
  const deletion=await write.client.callTool({name:"delete_event",arguments:{id:String(ev.id)}});
  assert.equal(deletion.isError,true);
  console.log("PASS: write token denied delete when account setting off");
  await db.from("user_settings").upsert({user_id:a,mcp_allow_delete:true},{onConflict:"user_id"});
  const removed=await call(write.client,"delete_event",{id:String(ev.id)});
  assert.equal(removed.deleted,true);
  const audit=await db.from("mcp_audit_log").select("id").eq("user_id",a).eq("tool","delete_event");
  assert.ok(audit.data?.length);
  console.log("PASS: independently enabled deletion and audit record");
  await db.from("mcp_tokens").update({revoked:true}).eq("id",aRead.id);
  await read.close();read=null;
  const denied=await fetch(serverURL,{method:"POST",headers:{
   Authorization:"Bearer "+aRead.key,"Content-Type":"application/json","Accept":"application/json,text/event-stream"
  },body:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",
   params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"revoke-test",version:"1"}}})});
  assert.equal(denied.status,401);
  console.log("PASS: revoked token receives HTTP 401");
  console.log("ALL MCP SMOKE TESTS PASSED");
 }finally{
  await Promise.allSettled([read?.close(),write?.close(),other?.close()].filter(Boolean));
  for(const id of people){
   await db.from("mcp_audit_log").delete().eq("user_id",id);
   await db.from("mcp_tokens").delete().eq("user_id",id);
   await db.from("user_settings").delete().eq("user_id",id);
   await db.from("workspace_snapshots").delete().eq("user_id",id);
   await db.auth.admin.deleteUser(id);
  }
 }
}
main().catch(error=>{console.error("MCP smoke failed:",error);process.exitCode=1});
