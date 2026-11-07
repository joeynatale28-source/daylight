/**
 * Local measurement harness (synthetic data only, no live Supabase).
 * Usage: node tests/harness.mjs <script.mjs>  — the script default-exports
 * async (page, helpers) => {}.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const chrome=process.env.CHROME_PATH||[
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/google-chrome-stable'
].find(fs.existsSync);
export async function open({width=1920,height=1080,theme='dark',busy=false}={}){
 const browser=await puppeteer.launch({executablePath:chrome,headless:'new',args:['--no-sandbox','--allow-file-access-from-files']});
 const page=await browser.newPage();
 await page.setViewport({width,height,deviceScaleFactor:1});
 await page.evaluateOnNewDocument(()=>{
   const chain=()=>{const q={select(){return q},eq(){return q},order(){return q},limit(){return q},is(){return q},
     single(){return Promise.resolve({data:null,error:null})},maybeSingle(){return Promise.resolve({data:null,error:null})},
     update(){return q},upsert(){return Promise.resolve({data:null,error:null})},insert(){return Promise.resolve({data:null,error:null})},
     then(done){return Promise.resolve({data:[],error:null}).then(done)}};return q};
   window.__fakeClient={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
     updateUser:async({data})=>({data:{user:{id:'u1',email:'demo@example.com',user_metadata:data}},error:null}),
     resetPasswordForEmail:async()=>({data:{},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
     oauth:{listGrants:async()=>({data:{grants:[]},error:null})}},
     rpc:async()=>({data:[],error:null}),from:()=>chain(),
     storage:{from:()=>({upload:async p=>({data:{path:p},error:null}),remove:async p=>({data:p,error:null}),getPublicUrl:p=>({data:{publicUrl:'https://storage.example/avatars/'+p}})})},
     functions:{invoke:async()=>({data:{subscriptions:[],enabled:false},error:null})}};
   window.supabase={createClient:()=>window.__fakeClient};
 });
 await page.setRequestInterception(true);
 page.on('request',r=>{const u=r.url();if(u.startsWith('file://')||u.startsWith('data:')||u.startsWith('blob:'))r.continue();else r.respond({status:200,contentType:'text/plain',body:''})});
 await page.goto('file://'+path.join(process.cwd(),'index.html'),{waitUntil:'load'});
 await page.waitForSelector('#authScreen',{timeout:5000});
 await page.evaluate((theme,busy)=>{
   const cloud=window.daylightCloud;
   Object.defineProperty(cloud,'ready',{get:()=>true,configurable:true});
   Object.defineProperty(cloud,'user',{get:()=>({id:'u1',email:'demo@example.com',user_metadata:{full_name:'Calendar Demo'}}),configurable:true});
   Object.defineProperty(cloud,'client',{get:()=>window.__fakeClient,configurable:true});
   state.calendars=[
     {id:'c1',name:'Hungary Creek Recreation Association',color:'teal',hidden:false,subscribed:false},
     {id:'c2',name:'swimRVA Rapids',color:'blue',hidden:false,subscribed:false},
     {id:'c3',name:'Personal',color:'green',hidden:false,subscribed:false},
     {id:'c4',name:'School Events and Assignments',color:'violet',hidden:false,subscribed:false},
     {id:'holidays',name:'US Holidays',color:'amber',hidden:false,subscribed:true,builtin:true}];
   const ev=[];let id=1;
   const add=(d,h,t,cal)=>ev.push({id:id++,cal,title:t,start:new Date(2026,10,d,h),end:new Date(2026,10,d,h,45),allDay:false,loc:'',desc:''});
   for(let d=1;d<=30;d++){add(d,8,'Practice '+d,'c2');if(d%2)add(d,15,'Homework '+d,'c4')}
   if(busy)for(let n=0;n<9;n++)add(30,7+n,'Busy item '+(n+1),'c3');
   for(let n=0;n<3;n++)add(29,9+n,'Late item '+(n+1),'c1');
   state.events=ev;
   state.themeMode=theme;state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);state.selected=new Date(2026,10,15);state.sidebarRail=false;
   document.getElementById('app').hidden=false;document.getElementById('authRoot').innerHTML='';
   applyTheme();renderAll(false);
 },theme,busy);
 await new Promise(r=>setTimeout(r,300));
 return {browser,page};
}
export async function measureMonth(page){
 return page.evaluate(()=>{
   const grid=document.querySelector('.month-grid');if(!grid)return null;
   const g=grid.getBoundingClientRect();
   const rows=[...grid.querySelectorAll('.month-week')].map(r=>{const b=r.getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)}});
   let clipped=0,chips=0;
   grid.querySelectorAll('.day-cell').forEach(cell=>{const c=cell.getBoundingClientRect();
     cell.querySelectorAll('.chip,.ev-chip,.month-chip,[class*="chip"]').forEach(ch=>{if(ch.offsetParent===null)return;const b=ch.getBoundingClientRect();if(!b.height)return;chips++;
       if(b.bottom>c.bottom+0.5||b.bottom>g.bottom+0.5&&grid.scrollHeight<=grid.clientHeight+1)clipped++})});
   const more=[...grid.querySelectorAll('.more-link')].map(m=>m.textContent);
   return {viewport:[innerWidth,innerHeight],grid:{top:Math.round(g.top),bottom:Math.round(g.bottom),h:Math.round(g.height),client:grid.clientHeight,scroll:grid.scrollHeight,overflowY:getComputedStyle(grid).overflowY},rows,chips,clipped,more,
     main:document.getElementById('main').getBoundingClientRect().height,viewWrap:document.getElementById('viewWrap').getBoundingClientRect().height};
 });
}
if(process.argv[2]){const mod=await import('file://'+path.resolve(process.argv[2]));await mod.default({open,measureMonth});}
