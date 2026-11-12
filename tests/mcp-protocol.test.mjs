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
test('no attachment tools exist for any grant level',async()=>{
 const full={can_read:true,can_write:true,can_delete:true};
 assert.ok(!availableTools(full).some(t=>/attach/i.test(t.name)));
 const r=await dispatchMcp(base(8,'tools/call',{name:'add_attachment',arguments:{id:'1'},_meta:meta}),full,async()=>{throw Error('Must not execute')});
 assert.ok(r.data.error);
});
