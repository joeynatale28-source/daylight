// OAuth MCP for daylight: official Supabase protected-resource and user-auth pipeline.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0'
import { pipeline } from 'npm:@supabase/middleware@1'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1'
import { z } from 'npm:zod@^4.3.6'
import { dispatchMcp } from './protocol.js'

const fail=(error='insufficient_scope',status=403)=>new Response(JSON.stringify({error}),{
 status,headers:{'content-type':'application/json','cache-control':'no-store',
  'www-authenticate':'Bearer error="'+error+'"'}
});
function decodeVerifiedToken(token:string){
 try{const p=token.split('.')[1];return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')))}
 catch{return {}}
}
Deno.serve(pipeline([
 withOAuthProtectedResource(),withSupabase({auth:'user'})
],async(req,{supabase})=>{
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 // getUser validates signature/user. Never trust a JWT payload on its own.
 const {data:identity,error:authError}=await supabase.auth.getUser(token);
 if(authError||!identity.user)return fail('invalid_token',401);
 const claims=decodeVerifiedToken(token);
 const clientId=typeof claims.client_id==='string'?claims.client_id:'';
 if(!clientId||claims.sub!==identity.user.id)return fail('invalid_token',401);
 const {data:grant,error:grantError}=await supabase.from('mcp_grants')
   .select('can_read,can_write,can_delete').eq('user_id',identity.user.id)
   .eq('client_id',clientId).is('revoked_at',null).maybeSingle();
 if(grantError||!grant||!grant.can_read)return fail();
 if(req.method==='GET')return new Response('MCP event streams are request scoped.',{
   status:405,headers:{allow:'POST, OPTIONS','cache-control':'no-store'}});
 if(req.method!=='POST')return new Response(null,{status:405,headers:{allow:'POST, OPTIONS'}});
 const contentType=req.headers.get('content-type')||'';
 if(!contentType.includes('application/json'))return new Response('JSON required',{status:415});
 let body:any;
 try{
   const raw=await req.text();
   if(raw.length>1000000)throw Error('Request too large');
   body=JSON.parse(raw);
 }catch{return new Response(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}}),{
   status:400,headers:{'content-type':'application/json'}})}
 // Supabase's OAuth middleware may consume the original request body.
 // Dispatch statelessly here, without session cookies or SDK body re-reads.
 const result=await dispatchMcp(body,grant,async(tool:string,args:Record<string,unknown>)=>{
   const {data,error}=await supabase.rpc('mcp_workspace_tool',{p_tool:tool,p_args:args||{}});
   if(error)throw Error(error.message);
   return {content:[{type:'text',text:JSON.stringify(data)}]};
 });
 if(result.insufficientScope)return fail();
 if(result.data===null)return new Response(null,{status:result.status});
 // JSON is valid with Streamable HTTP when client advertises JSON and SSE.
 // A single JSON response is simpler and avoids persistent connections.
 return new Response(JSON.stringify(result.data),{status:result.status,
   headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}));
