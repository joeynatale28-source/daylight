// Stateless MCP JSON-RPC dispatcher for legacy Streamable HTTP and MCP 2026-07-28.
// The Edge Function authenticates the OAuth user + checks permissions before calling this code.
// No Supabase service key is required by this module.
export const supportedVersions=['2026-07-28','2025-11-25','2025-06-18','2025-03-26'];
const object=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string'};
const opt=(name,desc,inputSchema,permission)=>({
 name,title:name.split('_').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),
 description:desc,inputSchema,permission,
 annotations:{readOnlyHint:permission==='read',destructiveHint:permission==='delete',
   ...(permission==='write'?{destructiveHint:false}:{})}
});
export const tools=[
 opt('list_calendars','List the calendars in your daylight account',object(), 'read'),
 opt('list_events','Find calendar events within a date and time range',object({start:str,end:str},['start','end']),'read'),
 opt('get_event','Read one calendar event by its ID',object({id:str},['id']),'read'),
 opt('search_events','Search events by title, location, or description',object({query:str},['query']),'read'),
 opt('list_tasks','List your tasks (the to-dos on the Tasks page). Each task has an id, title, due date and a done flag; pass the id of a task exactly as shown here to complete_task or delete_task.',object(),'read'),
 opt('create_calendar','Create a writable calendar',object({name:str,color:str},['name']),'write'),
 opt('create_event','Create a calendar EVENT: something that happens at a specific date and time (meeting, appointment, flight). Needs a start and end time. Do NOT use this for to-dos, errands or things to remember; use create_task for those.',object({calendar_id:str,title:str,starts_at:str,ends_at:str,location:str,description:str,all_day:{type:'boolean'}},['calendar_id','title','starts_at','ends_at']),'write'),
 opt('update_event','Edit a calendar event',object({id:str,title:str,starts_at:str,ends_at:str,location:str,description:str},['id']),'write'),
 opt('delete_event','Delete a calendar event permanently',object({id:str},['id']),'delete'),
 opt('share_calendar','Share one of your own calendars with a person by email, with view or edit permission, exactly like sharing in the Daylight app. They receive the same invitation and can accept or decline it.',object({calendar_id:str,email:str,permission:{type:'string',enum:['view','edit']}},['calendar_id','email','permission']),'write'),
 opt('share_event','Share one event with a person by email, with view or edit permission, exactly like sharing in the Daylight app. They receive the same invitation and can accept or decline it.',object({event_id:str,email:str,permission:{type:'string',enum:['view','edit']}},['event_id','email','permission']),'write'),
 opt('create_task','Create a TASK (a to-do) that appears on the Tasks page, not on the calendar. Use this whenever the person says task, to-do, reminder, errand or "add to my list". Takes a title, an optional due date (YYYY-MM-DD) and an optional description. No start or end time. Do NOT use create_event for tasks.',object({title:str,due_date:str,description:str},['title']),'write'),
 opt('delete_task','Delete a task (a to-do on the Tasks page) permanently. id is the id of the task as returned by list_tasks or create_task.',object({id:str},['id']),'delete'),
 opt('complete_task','Mark a task (a to-do on the Tasks page) complete, or incomplete again. id is the id of the task as returned by list_tasks or create_task; completed is true to mark it done, false to reopen it.',object({id:str,completed:{type:'boolean'}},['id','completed']),'write'),
];
function publicTool(def){const {permission,...rest}=def;return rest}
export function availableTools(grant){return tools.filter(t=>grant?.can_read&&(
 t.permission==='read'||(t.permission==='write'&&grant.can_write)||(t.permission==='delete'&&grant.can_delete)
)).map(publicTool)}
export function rpcError(id,code,message){return {jsonrpc:'2.0',id:id??null,error:{code,message}}}
/* Task tools only: assistants pass back what list_tasks showed them. A task id is a number there, so a numeric id is accepted as its text, and "true"/"false" as a boolean.
   Anything else is still rejected, and the message now says which argument is wrong. */
const TASK_TOOLS=new Set(['create_task','complete_task','delete_task']);
function coerceTaskArgs(name,args){
 if(!TASK_TOOLS.has(name)||!args||typeof args!=='object'||Array.isArray(args))return args;
 const out={...args};
 if(typeof out.id==='number'&&Number.isSafeInteger(out.id)&&out.id>0)out.id=String(out.id);
 if(typeof out.id==='string')out.id=out.id.trim();
 if(typeof out.completed==='string'){const v=out.completed.trim().toLowerCase();if(v==='true'||v==='false')out.completed=v==='true'}
 return out;
}
function taskArgProblem(def,args){
 if(!args||typeof args!=='object'||Array.isArray(args))return 'arguments must be an object';
 const schema=def.inputSchema;
 for(const key of schema.required||[])if(!(key in args))return key+' is required';
 for(const [key,val] of Object.entries(args)){
  const typ=schema.properties[key]?.type;
  if(!typ)return key+' is not an argument of '+def.name;
  if(typeof val!==typ)return key+' must be a '+typ;
 }
 return null;
}
function validArgs(def,args){
 if(!args||typeof args!=='object'||Array.isArray(args))return false;
 const schema=def.inputSchema;
 for(const key of schema.required||[])if(!(key in args))return false;
 for(const [key,val] of Object.entries(args)){
  const typ=schema.properties[key]?.type;
  if(!typ||typeof val!==typ)return false;
 }
 return true;
}
export async function dispatchMcp(message,grant,invoke){
 if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')
  return {status:400,data:rpcError(message?.id,-32600,'Invalid JSON-RPC request')};
 const modern=(message.params?._meta?.['io.modelcontextprotocol/protocolVersion']==='2026-07-28')||
   message.method==='server/discover';
 const id=message.id??null;
 const reply=result=>({status:200,data:{jsonrpc:'2.0',id,result}});
 if(message.method==='server/discover')
  return reply({resultType:'complete',supportedVersions,
   capabilities:{tools:{listChanged:false}},
   _meta:{'io.modelcontextprotocol/serverInfo':{name:'daylight',version:'2.1.0'}},
   instructions:'Read and manage your own daylight calendars and tasks. Mutations require user permission.',
   cacheScope:'private',ttlMs:15000});
 if(message.method==='initialize'){
  const offered=message.params?.protocolVersion;
  return reply({protocolVersion:supportedVersions.includes(offered)?offered:'2025-11-25',
   capabilities:{tools:{listChanged:false}},serverInfo:{name:'daylight',version:'2.1.0'}});
 }
 if(message.method==='notifications/initialized')return {status:202,data:null};
 if(message.method==='ping')return reply({});
 if(message.method==='tools/list')
  return reply(modern?{resultType:'complete',tools:availableTools(grant),cacheScope:'private',ttlMs:15000}:
    {tools:availableTools(grant)});
 if(message.method==='tools/call'){
  const name=message.params?.name;
  const def=tools.find(t=>t.name===name);
  if(!def)return {status:200,data:rpcError(id,-32601,'Unknown tool')};
  if(!grant?.can_read||(def.permission==='write'&&!grant.can_write)||(def.permission==='delete'&&!grant.can_delete))
   return {status:403,insufficientScope:true,data:{error:'insufficient_scope'}};
  const args=coerceTaskArgs(name,message.params?.arguments||{});
  if(!validArgs(def,args))return reply({isError:true,content:[{type:'text',text:TASK_TOOLS.has(name)?'Invalid tool arguments: '+taskArgProblem(def,args):'Invalid tool arguments'}]});
  try{
   const value=await invoke(name,args);
   const content=Array.isArray(value?.content)?value.content:[{type:'text',text:JSON.stringify(value)}];
   return reply(modern?{resultType:'complete',content}:{content});
  }catch(err){return reply({isError:true,content:[{type:'text',text:String(err?.message||'Tool operation failed').slice(0,700)}]})}
 }
 return {status:200,data:rpcError(id,-32601,'Method not found')};
}
