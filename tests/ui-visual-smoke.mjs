// UI-only smoke: browser interaction with a stubbed Supabase client.
// No production user or token is used. Screenshots are genuine daylight UI
// rendered in Chromium, not mocked screenshots from a design tool.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const port=Number(process.env.DAYLIGHT_SMOKE_PORT||8765);
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{
  stdio:'ignore'
});
const artifacts='ui-artifacts';
await mkdir(artifacts,{recursive:true});
let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const user={id:'11111111-1111-4111-8111-111111111111',email:'ui-test@example.com',
      user_metadata:{full_name:'Test User'}};
    const storage={
      payload:{version:2,calendars:[
        {id:'personal',name:'Personal',color:'blue',hidden:false,subscribed:false},
        {id:'swim',name:'Swimming',color:'teal',hidden:false,subscribed:false},
        {id:'holidays',name:'US Holidays',color:'gray',hidden:false,subscribed:true,builtin:true}
      ],events:[],tasks:[],settings:{themeMode:'dark'},ui:{view:'month'}},revision:1,
      tokens:[],settings:{mcp_allow_delete:false},shareEnabled:false,
      subs:[]
    };
    window.__daylightTest=storage;
    function query(table){
      let op='select',value=null,filters=[],limit=50;
      const api={
        select(){return api},eq(k,v){filters.push([k,v]);return api},
        order(){return api},limit(n){limit=n;return api},
        update(v){op='update';value=v;return api},insert(v){op='insert';value=v;return api},
        upsert(v){op='upsert';value=v;return api},
        delete(){op='delete';return api},
        maybeSingle:async()=>resolve(true),single:async()=>resolve(true),
        then: (fn,err)=>Promise.resolve(resolve(false)).then(fn,err)
      };
      function resolve(single){
        if(table==='workspace_snapshots'){
          if(op==='update'){
            storage.payload=value.payload;storage.revision=value.revision;
            return {data:single?{revision:storage.revision}:[{revision:storage.revision}],error:null};
          }
          if(op==='insert'){
            storage.payload=value.payload;storage.revision=1;
            return {data:single?{revision:1}:[{revision:1}],error:null};
          }
          return {data:single?{payload:storage.payload,revision:storage.revision}:
            [{payload:storage.payload,revision:storage.revision}],error:null};
        }
        if(table==='mcp_tokens'){
          if(op==='insert'){storage.tokens.push({
            ...value,id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(storage.tokens.length+1).padStart(12,'0'),
            created_at:new Date().toISOString(),last_used_at:null,revoked:false
          });return {data:single?storage.tokens.at(-1):[storage.tokens.at(-1)],error:null};}
          if(op==='update'){
            const id=filters.find(v=>v[0]==='id')?.[1];
            const item=storage.tokens.find(t=>t.id===id);
            if(item)Object.assign(item,value);
            return {data:single?item:item?[item]:[],error:null};
          }
          return {data:single?storage.tokens[0]||null:storage.tokens.slice(0,limit),error:null};
        }
        if(table==='user_settings'){
          if(op==='upsert'||op==='update')Object.assign(storage.settings,value);
          return {data:single?storage.settings:[storage.settings],error:null};
        }
        if(table==='mcp_workspace_audit'||table==='mcp_audit_log')
          return {data:single?null:[],error:null};
        return {data:single?null:[],error:null};
      }
      return api;
    }
    const client={
      auth:{
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
        getSession:async()=>({data:{session:{user}},error:null}),
        signInWithPassword:async()=>({data:{user},error:null}),
        signOut:async()=>({error:null}),
        updateUser:async()=>({data:{user},error:null})
      },
      from:query,
      functions:{invoke:async(name,{body})=>{
        if(name==='places')return {data:{suggestions:[
          {primary:'10833 W Broad St',secondary:'Glen Allen, Virginia 23060 · United States',
            address:'10833 W Broad St, Glen Allen, Virginia 23060, United States',
            osmRef:'osm:way:888888',lat:37.644,lng:-77.592}
        ],attribution:'© OpenStreetMap contributors'},error:null};
        if(name==='ical-feed'){
          if(body.action==='status')return {data:{enabled:storage.shareEnabled,prefix:'sample42'},error:null};
          if(body.action==='enable'||body.action==='reset'){
            storage.shareEnabled=true;return {data:{urls:{
              https:'https://example.com/ical?token=temporary',
              webcal:'webcal://example.com/ical?token=temporary'
            },enabled:true},error:null};
          }
          if(body.action==='disable'){storage.shareEnabled=false;return {data:{enabled:false},error:null};}
          return {data:'BEGIN:VCALENDAR\nEND:VCALENDAR',error:null};
        }
        if(name==='ical-subscribe'){
          if(body.action==='list')return {data:{subscriptions:storage.subs},error:null};
          if(body.action==='preview')return {data:{
            name:'Sample external calendar',imported:3,skipped:0,source_host:'example.com'
          },error:null};
          if(body.action==='add'){
            const sub={id:'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb',name:body.name,
              url:body.url,color:body.color,cached_events:[],last_fetched_at:new Date().toISOString()};
            storage.subs.push(sub);return {data:{subscription:sub,imported:0,skipped:0},error:null};
          }
          if(body.action==='remove'){
            storage.subs=storage.subs.filter(s=>s.id!==body.id);
            return {data:{removed:true},error:null};
          }
          return {data:{unchanged:true},error:null};
        }
        return {data:{added:1,updated:0,skipped:0},error:null};
      }}
    };
    window.supabase={createClient:()=>client};
  });
  await page.route('**/supabase.min.js',route=>route.fulfill({
    status:200,contentType:'text/javascript',body:'/* Session-bound test Supabase fixture loaded by addInitScript */'
  }));
  await new Promise(resolve=>setTimeout(resolve,500));
  await page.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.daylightCloud?.ready,{timeout:20000});
  const screenshot=async(label,theme)=>{
    await page.evaluate(theme=>{
      state.themeMode=theme;applyTheme();renderAll(false);
    },theme);
    await page.screenshot({path:artifacts+'/'+label+'-'+theme+'.png',fullPage:false});
  };
  for(const theme of ['dark','light']){
    await page.evaluate(()=>openSettings('ai'));
    await page.locator('.settings-dialog').waitFor();
    assert.equal(await page.locator('.settings-pane h2').textContent(),'AI access');
    await screenshot('ai-access',theme);
    await page.evaluate(()=>document.querySelector('.settings-dialog')?.closest('.backdrop')?.remove());
    await page.evaluate(()=>window.daylightShareCalendar(state.calendars.find(c=>c.id==='personal')));
    await page.locator('#shareToggle').waitFor();
    await screenshot('share',theme);
    await page.evaluate(()=>document.querySelector('#shareToggle')?.closest('.backdrop')?.remove());
    await page.evaluate(()=>openSettings('data'));
    await page.locator('#subUrl').waitFor();
    await screenshot('subscriptions',theme);
    await page.evaluate(()=>document.querySelector('.settings-dialog')?.closest('.backdrop')?.remove());
    await page.evaluate(()=>openEventForm(null,state.selected));
    await page.locator('#efTitle').fill('Location smoke test '+theme);
    await page.locator('#efLoc').fill('10833 W Broad');
    await page.locator('.dl-place-option').first().waitFor({timeout:8000});
    await screenshot('location',theme);
    if(theme==='dark'){
      await page.locator('#efLoc').press('ArrowDown');
      await page.locator('#efLoc').press('Enter');
    }else await page.locator('.dl-place-option').first().click();
    assert.match(await page.locator('#efLoc').inputValue(),/Glen Allen.*23060/);
    await page.locator('[data-save]').click();
    const item=await page.evaluate(()=>state.events.at(-1));
    assert.equal(item.placeId,'osm:way:888888');
    assert.equal(item.placeLat,37.644);
    assert.equal(item.placeLng,-77.592);
  }
  await page.evaluate(()=>openEventForm(null,state.selected));
  await page.locator('#efTitle').fill('Free text location');
  await page.locator('#efLoc').fill('Somewhere near the pool');
  await page.locator('[data-save]').click();
  const free=await page.evaluate(()=>state.events.at(-1));
  assert.equal(free.loc,'Somewhere near the pool');
  assert.equal(free.placeId,null);
  assert.equal(free.placeLat,null);
  // Check owner-only write control from UI in the AI panel.
  await page.evaluate(()=>openSettings('ai'));
  await page.locator('#mcpName').fill('Read-only test');
  await page.locator('#mcpCreate').click();
  await page.locator('#mcpReveal').waitFor();
  assert.match(await page.locator('#mcpReveal').inputValue(),/^dl_mcp_[a-f0-9]{64}$/);
  await page.evaluate(()=>document.querySelector('#mcpReveal')?.closest('.backdrop')?.remove());
  await page.locator('#mcpTokens .dl-token-row').first().waitFor();
  assert.equal(await page.locator('#mcpTokens .dl-token-row').count(),1);
  if(errors.length)throw Error('Browser page errors: '+errors.join(' | '));
  console.log('PASS: AI, share, subscriptions and address UI rendered; keyboard and mouse commit coordinates; free text saved; screenshots written');
}finally{
  await browser?.close();
  server.kill();
}
