import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchMcp,tools,availableTools} from '../supabase/functions/mcp/protocol.js';
const read={can_read:true,can_write:false,can_delete:false};
const full={can_read:true,can_write:true,can_delete:true};
const base=(id,method,params={})=>({jsonrpc:'2.0',id,method,params});
const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'ChatGPT',version:'1.0.0'},'io.modelcontextprotocol/clientCapabilities':{}};
test('2026-07-28 discover handshake advertises tools',async()=>{
 const r=await dispatchMcp(base(1,'server/discover',{_meta:meta}),read);
 assert.equal(r.status,200);assert.equal(r.data.result.resultType,'complete');
 assert.ok(r.data.result.supportedVersions.includes('2026-07-28'));
 assert.ok(r.data.result.capabilities.tools);
});
test('legacy initialize and tools/list both work without sessions',async()=>{
 const r=await dispatchMcp(base(2,'initialize',{protocolVersion:'2025-11-25'}),read);
 assert.equal(r.data.result.protocolVersion,'2025-11-25');
 const l=await dispatchMcp(base(3,'tools/list'),read);assert.equal(l.status,200);
 assert.ok(l.data.result.tools.some(t=>t.name==='list_events'));
});
test('modern tool list is parseable schema and stable',async()=>{
 const r=await dispatchMcp(base(4,'tools/list',{_meta:meta}),full);
 assert.equal(r.data.result.resultType,'complete');
 assert.equal(r.data.result.tools.length,tools.length);
 for(const t of r.data.result.tools){assert.ok(t.name&&t.description);assert.equal(t.inputSchema.type,'object');assert.ok(Array.isArray(t.inputSchema.required));}
});
test('permissions filter and refuse writes with 403',async()=>{
 assert.ok(!availableTools(read).some(t=>t.name==='delete_event'));
 const req=base(5,'tools/call',{name:'delete_event',arguments:{id:'1'},_meta:meta});
 const r=await dispatchMcp(req,read,async()=>{throw Error('Must not execute')});
 assert.equal(r.status,403);assert.equal(r.insufficientScope,true);
});
test('read tool returns real downstream data',async()=>{
 const r=await dispatchMcp(base(6,'tools/call',{name:'list_events',arguments:{start:'2026-11-01',end:'2026-12-01'},_meta:meta}),read,async()=>({content:[{type:'text',text:'[{"title":"Practice"}]'}]}));
 assert.equal(r.status,200);assert.equal(r.data.result.resultType,'complete');
 assert.match(r.data.result.content[0].text,/Practice/);
});
test('invalid args cannot invoke dangerous action',async()=>{
 const r=await dispatchMcp(base(7,'tools/call',{name:'delete_event',arguments:{id:123},_meta:meta}),full,async()=>{throw Error('Must not execute')});
 assert.equal(r.data.result.isError,true);
});
test('attachment tools follow the grant levels: list needs read, add needs write, remove needs delete',async()=>{
 const names=g=>availableTools(g).map(t=>t.name);
 assert.ok(names(read).includes('list_attachments'));
 assert.ok(!names(read).includes('add_attachment')&&!names(read).includes('remove_attachment'));
 const write={can_read:true,can_write:true,can_delete:false};
 assert.ok(names(write).includes('add_attachment')&&!names(write).includes('remove_attachment'));
 assert.ok(names(full).includes('remove_attachment'));
 const denied=await dispatchMcp(base(8,'tools/call',{name:'add_attachment',arguments:{id:'1',file_name:'a.png',content_base64:'AA=='},_meta:meta}),read,async()=>{throw Error('Must not execute')});
 assert.equal(denied.status,403);
 const deniedRm=await dispatchMcp(base(9,'tools/call',{name:'remove_attachment',arguments:{id:'1',attachment_id:'x'},_meta:meta}),write,async()=>{throw Error('Must not execute')});
 assert.equal(deniedRm.status,403);
 const ok=await dispatchMcp(base(10,'tools/call',{name:'add_attachment',arguments:{id:'1',file_name:'a.png',content_base64:'AA==',caption:'c'},_meta:meta}),write,async(t,a)=>({t,a}));
 assert.equal(ok.status,200);
});
