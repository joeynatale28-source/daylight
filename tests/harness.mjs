/**
 * Faithful local harness. Unlike a hand-built DOM, this loads the REAL
 * index.html and every real script/stylesheet over HTTP (real Google Fonts
 * included), and drives the REAL boot path: Supabase session restore ->
 * loadForUser -> workspace fetch -> render -> reveal. Only the Supabase CDN
 * script is replaced by a small stub that serves a synthetic account.
 *
 * Usage: import {launch, busyPayload} from './harness.mjs'
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(process.env.HARNESS_ROOT||process.cwd());
const chrome=process.env.CHROME_PATH||[
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
 '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/google-chrome-stable'
].find(fs.existsSync);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};

export function serve(port=0){
 return new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
   let file=decodeURIComponent(new URL(req.url,'http://x').pathname);
   if(file.endsWith('/'))file+='index.html';
   const full=path.join(ROOT,file);
   if(!full.startsWith(ROOT)||!fs.existsSync(full)||fs.statSync(full).isDirectory()){res.writeHead(404);res.end('nf');return}
   res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
   fs.createReadStream(full).pipe(res);
  }).listen(port,'127.0.0.1',()=>resolve({server,url:'http://127.0.0.1:'+server.address().port+'/'}));
 });
}

const STUB=`(function(){
 var cfg=window.__HARNESS||{};
 var user={id:'00000000-0000-4000-8000-000000000001',email:'demo@example.com',user_metadata:{full_name:'Calendar Demo'}};
 var session=cfg.signedIn===false?null:{user:user,access_token:'t'};
 function chain(table){var q={select(){return q},eq(){return q},order(){return q},limit(){return q},is(){return q},
  update(){return q},upsert(){return Promise.resolve({data:null,error:null})},insert(){return Promise.resolve({data:null,error:null})},
  single(){return q.maybeSingle()},
  maybeSingle(){
   if(table==='workspace_snapshots'){
     return new Promise(function(r){setTimeout(function(){r({data:{payload:cfg.payload,revision:1},error:null})},cfg.delayMs||0)});
   }
   return Promise.resolve({data:null,error:null});
  },
  then(done){return Promise.resolve({data:[],error:null}).then(done)}};return q}
 var client={auth:{getSession:function(){return Promise.resolve({data:{session:session},error:null})},
   getUser:function(){return Promise.resolve({data:{user:session&&session.user},error:null})},
   updateUser:function(){return Promise.resolve({data:{user:user},error:null})},
   resetPasswordForEmail:function(){return Promise.resolve({data:{},error:null})},
   signOut:function(){return Promise.resolve({})},
   onAuthStateChange:function(cb){setTimeout(function(){cb(session?'INITIAL_SESSION':'SIGNED_OUT',session)},0);return {data:{subscription:{unsubscribe:function(){}}}}},
   oauth:{listGrants:function(){return Promise.resolve({data:{grants:[]},error:null})}}},
  rpc:function(){return Promise.resolve({data:[],error:null})},from:chain,
  storage:{from:function(){return {upload:function(p){return Promise.resolve({data:{path:p},error:null})},remove:function(p){return Promise.resolve({data:p,error:null})},getPublicUrl:function(p){return {data:{publicUrl:'https://storage.example/avatars/'+p}}}}}},
  functions:{invoke:function(){return Promise.resolve({data:{subscriptions:[]},error:null})}}};
 window.supabase={createClient:function(){return client}};
})();`;

/** A realistic December workspace: stacked multi-day bars, busy days, holidays. */
export function busyPayload({month=11,spans=4,busyDay=9}={}){
 const events=[];let id=1;
 const add=(d,h,t,cal,extra)=>events.push(Object.assign({id:id++,cal,title:t,start:new Date(2026,month,d,h).toISOString(),end:new Date(2026,month,d,h,45).toISOString(),allDay:false,loc:'',desc:''},extra||{}));
 for(let d=1;d<=30;d++){add(d,8,'Practice '+d,'c2');if(d%2)add(d,15,'Homework '+d,'c4')}
 for(let n=0;n<4;n++)add(busyDay,9+n,'Extra '+(n+1),'c1');
 for(let n=0;n<3;n++)add(busyDay+1,9+n,'Late '+(n+1),'c3');
 const bars=[[6,12,'Winter camp'],[7,11,'School trip'],[8,12,'Meet series'],[9,10,'Clinic'],[27,31,'Break'],[28,31,'Closed'],[29,31,'Holiday show']].slice(0,spans?7:0);
 bars.forEach(([a,b,t],i)=>{if(i<spans||i>=4)events.push({id:id++,cal:'c1',title:t,start:new Date(2026,month,a).toISOString(),end:new Date(2026,month,b,23,59).toISOString(),allDay:true,loc:'',desc:''})});
 return {version:2,calendars:[
  {id:'c1',name:'Hungary Creek Recreation Association',color:'teal'},{id:'c2',name:'swimRVA Rapids',color:'blue'},
  {id:'c3',name:'Personal',color:'green'},{id:'c4',name:'School Events and Assignments',color:'violet'},
  {id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}],
  events,tasks:[],feeds:[],settings:{themeMode:'system'},ui:{}};
}

/**
 * Launch the real app. opts: width,height,theme('dark'|'light'),payload,
 * delayMs (workspace fetch latency), signedIn, cache (keep localStorage from
 * a previous launch via userDataDir), month cursor via ?; returns handles.
 */
export async function launch(opts={}){
 const {width=1919,height=998,theme='dark',payload=busyPayload(),delayMs=0,signedIn=true,userDataDir,port=0,cdnDelayMs=0}=opts;
 const {server,url}=await serve(port);
 const browser=await puppeteer.launch({executablePath:chrome,headless:'new',userDataDir,args:['--no-sandbox']});
 const page=await browser.newPage();
 await page.setViewport({width,height,deviceScaleFactor:1});
 await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
 await page.evaluateOnNewDocument((cfg)=>{window.__HARNESS=cfg;
  if(cfg.signedIn&&cfg.seedSession!==false){try{localStorage.setItem('sb-qrqemjgpzoqhtmsowmqv-auth-token',JSON.stringify({access_token:'t',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'00000000-0000-4000-8000-000000000001',email:'demo@example.com',user_metadata:{full_name:'Calendar Demo'}}}))}catch(e){}}
 },{payload,delayMs,signedIn,seedSession:opts.seedSession});
 await page.setRequestInterception(true);
 page.on('request',r=>{
  const u=r.url();
  if(/cdn\.jsdelivr\.net\/npm\/@supabase/.test(u))return setTimeout(()=>r.respond({status:200,contentType:'text/javascript',body:STUB}),cdnDelayMs);
  if(/supabase\.co/.test(u))return r.respond({status:200,contentType:'application/json',body:'{}'});
  r.continue();
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const logs=[];page.on('console',m=>logs.push(m.text().slice(0,140)));page.on('requestfailed',r=>logs.push('FAILED '+r.url().slice(0,90)));
 const close=async()=>{await browser.close();server.close()};
 return {page,browser,url,errors,close,
  async load({wait=true}={}){await page.goto(url,{waitUntil:'load'});if(wait)await this.ready()},
  async ready(){try{await page.waitForFunction(()=>!!document.querySelector('.month-grid')&&!document.getElementById('dlWorkspaceLoading')&&!document.body.classList.contains('dl-canvas-holding'),{timeout:20000})}catch(e){
   const state=await page.evaluate(()=>({body:document.body.className,grid:!!document.querySelector('.month-grid'),spinner:!!document.getElementById('dlWorkspaceLoading'),app:!document.getElementById('app').hidden,auth:document.getElementById('authRoot').children.length,cloudReady:window.daylightCloud&&window.daylightCloud.ready,fonts:document.fonts.status,sb:typeof window.supabase})).catch(x=>String(x));
   throw new Error('app did not finish booting: '+JSON.stringify(state)+' errors='+JSON.stringify(errors.slice(0,3))+' console='+JSON.stringify(logs.slice(-4)));
  }
  await Promise.race([page.evaluate(()=>document.fonts.ready),new Promise(r=>setTimeout(r,4000))]);await new Promise(r=>setTimeout(r,500))}};
}

/** Measurements of the real month grid at the current viewport. */
export async function measureMonth(page){
 return page.evaluate(()=>{
  const grid=document.querySelector('.month-grid');if(!grid)return null;
  const g=grid.getBoundingClientRect();
  const scrolls=grid.scrollHeight>grid.clientHeight+1;
  const rows=[...grid.querySelectorAll('.month-week')].map(r=>{const b=r.getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)}});
  const gridTop=Math.round(g.top),viewport=innerHeight;
  const clipped=[];
  const edgeFor=cell=>{const c=cell.getBoundingClientRect();return c.top+cell.clientTop+cell.clientHeight+0.5};
  grid.querySelectorAll('.day-cell').forEach(cell=>{
   const edge=edgeFor(cell);
   cell.querySelectorAll('.cell-events > *').forEach(k=>{
    if(!k.getClientRects().length)return;const b=k.getBoundingClientRect();
    if(b.height&&b.bottom>edge)clipped.push(cell.dataset.date+' '+k.className.split(' ')[0]+' +'+Math.round(b.bottom-edge)+'px');
   });
  });
  grid.querySelectorAll('.dl-continuous-bar').forEach(bar=>{
   if(!bar.getClientRects().length)return;const row=bar.closest('.month-week').getBoundingClientRect();const b=bar.getBoundingClientRect();
   if(b.bottom>row.bottom+0.5)clipped.push('bar '+bar.textContent.slice(0,12)+' +'+Math.round(b.bottom-row.bottom)+'px');
  });
  const lastBottom=rows.length?rows[rows.length-1].bottom:0;
  // Rows must fill from the header to the viewport bottom exactly, unless the grid scrolls.
  const fits=scrolls?true:Math.abs(lastBottom-viewport)<=1;
  const docOverflow=document.documentElement.scrollHeight>viewport+1;
  return {viewport,gridTop,gridBottom:Math.round(g.bottom),rows:rows.map(r=>r.h),lastRowBottom:lastBottom,scrolls,fits,docOverflow,clipped,
   more:[...grid.querySelectorAll('.more-link')].filter(m=>!m.hidden).map(m=>m.textContent).slice(0,8)};
 });
}
