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
const PRIVATE_HOST=/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;
function isPrivateAddress(h:string):boolean{
 if(PRIVATE_HOST.test(h))return true;
 const v4=h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
 if(v4){const [a,b]=[+v4[1],+v4[2]];return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||a>=224}
 if(h.includes(':'))return true;   // IPv6 literals are not accepted
 return false;
}
async function fetchPublicFile(raw:string):Promise<{bytes:Uint8Array,name:string}>{
 let url:URL;
 try{url=new URL(raw)}catch{throw Error('url is not a valid link')}
 for(let hop=0;hop<4;hop++){
   if(url.protocol!=='https:')throw Error('Only https links can be downloaded');
   if(isPrivateAddress(url.hostname))throw Error('That address can not be downloaded');
   const res=await fetch(url.toString(),{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'user-agent':'daylight-mcp/1','accept':'application/pdf,image/*,*/*;q=0.5'}});
   if(res.status>=300&&res.status<400&&res.headers.get('location')){url=new URL(res.headers.get('location')!,url);continue}
   if(!res.ok)throw Error('The link answered '+res.status);
   const len=Number(res.headers.get('content-length')||0);
   if(len>10485760)throw Error('File is larger than 10 MB');
   const reader=res.body!.getReader();const chunks:Uint8Array[]=[];let total=0;
   for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>10485760){await reader.cancel();throw Error('File is larger than 10 MB')}chunks.push(value)}
   const bytes=new Uint8Array(total);let off=0;for(const c of chunks){bytes.set(c,off);off+=c.length}
   return {bytes,name:decodeURIComponent(url.pathname.split('/').filter(Boolean).pop()||'')};
 }
 throw Error('Too many redirects');
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
   if(raw.length>15000000)throw Error('Request too large');   // up to a 10 MB attachment, base64-encoded
   body=JSON.parse(raw);
 }catch{return new Response(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}}),{
   status:400,headers:{'content-type':'application/json'}})}
 // Supabase's OAuth middleware may consume the original request body.
 // Dispatch statelessly here, without session cookies or SDK body re-reads.
 const BUCKET='event-attachments';
 const TYPES:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf'};
 const sniff=(b:Uint8Array):string=>{
   const s=(i:number,n:number)=>String.fromCharCode(...b.slice(i,i+n));
   if(b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF)return 'image/jpeg';
   if(b[0]===0x89&&s(1,3)==='PNG')return 'image/png';
   if(s(0,4)==='GIF8')return 'image/gif';
   if(s(0,4)==='RIFF'&&s(8,4)==='WEBP')return 'image/webp';
   if(s(0,4)==='%PDF')return 'application/pdf';
   return '';
 };
 const result=await dispatchMcp(body,grant,async(tool:string,args:Record<string,unknown>)=>{
   if(tool==='add_attachment'){
     // the file is stored in the private bucket under <account>/<event>/ (the same place the app stores it); the database only keeps the reference
     const eventId=String(args.id||'');
     const fileName=String(args.file_name||'').trim()||'attachment';
     let safe=fileName.replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-60)||'attachment';
     let bytes:Uint8Array;
     let nameFromUrl='';
     if(typeof args.url==='string'&&args.url.trim()){
       // download an https link server-side (so an agent that cannot produce base64 can still attach a file); public hosts only
       const got=await fetchPublicFile(args.url.trim());
       bytes=got.bytes;nameFromUrl=got.name;
     }else{
       const b64=String(args.content_base64||'').replace(/^data:[^,]+,/,'').replace(/\s+/g,'');
       if(!b64)throw Error('Provide url (an https link to the file) or content_base64');
       if(b64.length>14000000)throw Error('File is larger than 10 MB');
       try{bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}catch{throw Error('content_base64 is not valid base64')}
     }
     if(bytes.length>10485760)throw Error('File is larger than 10 MB');
     const real=sniff(bytes);
     if(!real)throw Error('Unsupported file type: use a JPEG, PNG, WebP, GIF or PDF');
     if(fileName==='attachment'&&nameFromUrl)safe=nameFromUrl.replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-60)||'attachment';
     const ext=(safe.split('.').pop()||'').toLowerCase();
     const claimed=String(args.mime_type||'').toLowerCase()||TYPES[ext]||'';
     if(claimed&&claimed!==real)throw Error('The file content does not match its type');
     const path=identity.user.id+'/'+eventId+'/'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)+'-'+safe;
     // make sure the event exists and can take attachments BEFORE storing anything
     const pre=await supabase.rpc('mcp_attachment_tool',{p_tool:'list_attachments',p_args:{id:eventId}});
     if(pre.error)throw Error(pre.error.message);
     if(Array.isArray(pre.data)&&pre.data.length>=10)throw Error('An event can have up to 10 attachments');
     const up=await supabase.storage.from(BUCKET).upload(path,bytes,{contentType:real,upsert:false});
     if(up.error)throw Error('Could not store the file: '+up.error.message);
     const rec=await supabase.rpc('mcp_attachment_tool',{p_tool:'add_attachment',p_args:{id:eventId,path,name:(fileName!=='attachment'?fileName:(nameFromUrl||fileName)),type:real,size:bytes.length,caption:typeof args.caption==='string'?args.caption:''}});
     if(rec.error){await supabase.storage.from(BUCKET).remove([path]);throw Error(rec.error.message)}
     return {content:[{type:'text',text:JSON.stringify(rec.data)}]};
   }
   if(tool==='remove_attachment'||tool==='list_attachments'){
     const {data,error}=await supabase.rpc('mcp_attachment_tool',{p_tool:tool,p_args:args||{}});
     if(error)throw Error(error.message);
     if(tool==='remove_attachment'&&data?.attachment_id&&String(data.attachment_id).startsWith(identity.user.id+'/'))
       await supabase.storage.from(BUCKET).remove([String(data.attachment_id)]);
     return {content:[{type:'text',text:JSON.stringify(data)}]};
   }
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
