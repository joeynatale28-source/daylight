/** Legal pages, cookie notice and data requests: real pages through the harness (only Supabase is stubbed); exits 1 on any failure.
 *  LIVE_URL=https://.../daylight/ runs the site and app parts against the deployed build. */
import puppeteer from 'puppeteer-core';
import {launch,serve} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};
const LIVE=process.env.LIVE_URL?process.env.LIVE_URL.replace(/\/?$/,'/'):null;
const chrome=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ---------------------------------------------------------------- public pages
const srv=LIVE?null:await serve(0,'/daylight/');
const BASE=LIVE||srv.url;
const cb=LIVE?'?cb='+Date.now():'';
const browser=await puppeteer.launch({executablePath:chrome,headless:'new',args:['--no-sandbox']});
try{
 for(const theme of ['light','dark']){
  const ctx=await browser.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:1280,height:800});
  await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  for(const path of ['','privacy/','tos/']){
   await p.goto(BASE+path+cb,{waitUntil:'load'});await sleep(500);
   const b=await p.evaluate(()=>{const e=document.getElementById('dlCookie');if(!e||e.hidden)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {left:Math.round(r.left),bottomGap:Math.round(innerHeight-r.bottom),w:Math.round(r.width),bg:c.backgroundColor,fg:c.color,btns:[...e.querySelectorAll('button')].map(x=>x.textContent),link:(e.querySelector('a')||{}).getAttribute&&e.querySelector('a').getAttribute('href'),font:c.fontFamily.slice(0,5)}});
   check(!!b,`${theme} /${path}: banner shows on a first visit`,b);
   if(b){
    check(b.left<=24&&b.bottomGap<=24&&b.w<=400,`${theme} /${path}: small, bottom-left`,b);
    check(theme==='light'?b.bg==='rgb(255, 255, 255)':b.bg==='rgb(0, 0, 0)',`${theme} /${path}: ${theme==='light'?'white':'black'} background`,b.bg);
    check(b.btns.join()==='Deny,Accept'&&/privacy\/?$/.test(b.link||''),`${theme} /${path}: Deny + Accept, Privacy Policy link`,b);
   }
   if(path===''){
    await p.screenshot({path:process.env.SHOTS?process.env.SHOTS+`/cookie-${theme}.png`:undefined}).catch(()=>{});
   }
  }
  // choose Accept: hides, persists across a reload and a new page
  await p.goto(BASE+cb,{waitUntil:'load'});await sleep(300);
  await p.click('#dlCookie [data-accept]');await sleep(200);
  check(await p.evaluate(()=>document.getElementById('dlCookie').hidden),`${theme}: Accept hides the banner`);
  check(await p.evaluate(()=>daylightConsent.get()==='accepted'&&daylightConsent.allowed()),`${theme}: Accept is recorded`);
  await p.goto(BASE+'privacy/'+cb,{waitUntil:'load'});await sleep(400);
  check(await p.evaluate(()=>{const e=document.getElementById('dlCookie');return !e||e.hidden}),`${theme}: choice persists on the next page / visit`);
  // footer link reopens it; Deny works and is remembered
  await p.click('[data-cookie-settings]');await sleep(250);
  check(await p.evaluate(()=>!document.getElementById('dlCookie').hidden&&document.querySelector('#dlCookie [data-accept]').getAttribute('aria-pressed')==='true'),`${theme}: footer "Cookie settings" reopens it showing the current choice`);
  await p.click('#dlCookie [data-deny]');await sleep(200);
  check(await p.evaluate(()=>document.getElementById('dlCookie').hidden&&daylightConsent.get()==='denied'&&!daylightConsent.allowed()),`${theme}: Deny hides it and is recorded`);
  await p.reload({waitUntil:'load'});await sleep(300);
  check(await p.evaluate(()=>daylightConsent.get()==='denied'&&(!document.getElementById('dlCookie')||document.getElementById('dlCookie').hidden)),`${theme}: denial persists across a reload`);
  check(errs.length===0,`${theme}: no page errors`,errs);
  await ctx.close();
 }
 // ---- legal text
 const lp=await browser.newPage();
 for(const [path,secs,title] of [['privacy/',14,'Privacy Policy'],['tos/',16,'Terms of Service']]){
  await lp.goto(BASE+path+cb,{waitUntil:'load'});
  const r=await lp.evaluate(()=>({h2:[...document.querySelectorAll('.legal h2')].map(h=>h.textContent),h1:document.querySelector('.legal h1').textContent,upd:document.querySelector('.updated').textContent,text:document.querySelector('.legal').innerText,links:[...document.querySelectorAll('.legal a')].map(a=>a.getAttribute('href')),ft:[...document.querySelectorAll('.foot a')].map(a=>a.textContent.trim())}));
  check(r.h1===title&&r.h2.length===secs&&r.h2.every((h,i)=>h.startsWith((i+1)+'. ')),`/${path}: ${secs} numbered sections`,r.h2.length);
  check(r.upd==='Last updated: November 17, 2026',`/${path}: Last updated line`,r.upd);
  check(!/\[CONTACT EMAIL\]/.test(r.text)&&/privacy@daylightcal\.com/.test(r.text),`/${path}: contact placeholder replaced`);
  check(r.ft.includes('Privacy')&&r.ft.includes('Terms')&&r.ft.includes('Cookie settings'),`/${path}: footer links`,r.ft);
  if(path==='privacy/')check(r.links.filter(h=>/dashboard\/\?settings=yourdata/.test(h)).length===2&&!r.links.includes('../'),'/privacy/: data-request links point at Settings, not the homepage',r.links);
  for(const h of r.links.filter(h=>!/^mailto:/.test(h))){const u=new URL(h,BASE+path);const x=await fetch(u.href);if(x.status>=400)check(false,`broken link ${h}`,x.status)}
 }
}finally{await browser.close();if(srv)srv.server.close()}

// ---------------------------------------------------------------- the app: cookie notice, Settings -> Your data, Admin -> Data requests
const app=await launch(Object.assign({width:1440,height:900,theme:'dark'},LIVE?{baseUrl:LIVE+'dashboard/?cb='+Date.now()}:{}));
const page=app.page;
try{
 await app.load();await sleep(600);
 const ck=await page.evaluate(()=>{const e=document.getElementById('dlCookie');return e&&!e.hidden?{bg:getComputedStyle(e).backgroundColor,over:!!document.querySelector('.settings-dialog')}:null});
 check(ck&&ck.bg==='rgb(0, 0, 0)','app: cookie notice shows (black in dark theme)',ck);
 // stand in for the database + function so the real UI can be driven
 await page.evaluate(()=>{
  const c=window.daylightCloud,db=window.__dr={rows:[],calls:[]};
  const real=c.client.rpc.bind(c.client);
  c.client.rpc=function(name,args){
   if(name==='data_request_create'){if(db.rows.some(r=>r.kind===args.p_kind&&['pending','in_review','approved'].includes(r.status)))return Promise.resolve({data:null,error:{message:'You already have an open '+args.p_kind+' request.'}});const r={id:'r'+(db.rows.length+1),email:'user@daylightcal.com',user_id:'u',kind:args.p_kind,status:'pending',created_at:new Date().toISOString()};db.rows.unshift(r);return Promise.resolve({data:r,error:null})}
   if(name==='data_request_mine')return Promise.resolve({data:db.rows.slice(),error:null});
   if(name==='data_request_cancel'){const r=db.rows.find(x=>x.id===args.p_id);r.status='canceled';return Promise.resolve({data:null,error:null})}
   if(name==='data_admin_list')return Promise.resolve({data:db.rows.slice(),error:null});
   if(name==='data_admin_set_status'){const r=db.rows.find(x=>x.id===args.p_id);r.status=args.p_status;return Promise.resolve({data:null,error:null})}
   return real(name,args);
  };
  c.client.functions={invoke:async(fn,o)=>{db.calls.push({fn,body:o.body});if(o.body.action==='approve'){const r=db.rows.find(x=>x.id===o.body.id);r.status=r.kind==='export'?'sent':'completed';r.link_expires_at=new Date(Date.now()+7*864e5).toISOString();return {data:{ok:true,status:r.status,emailed:true},error:null}}return {data:{ok:true},error:null}}};
  window.daylightAdmin.isOwner=()=>true;
 });
 await page.evaluate(()=>openSettings('yourdata'));await sleep(800);
 const nav=await page.evaluate(()=>({active:[...document.querySelectorAll('.sr-item.active')].map(b=>b.textContent.trim()),items:[...document.querySelectorAll('.sr-item')].map(b=>b.textContent.trim()),sec:!!document.querySelector('#dl-sec-yourdata h2')}));
 check(nav.active.join()==='Your data'&&nav.sec,'Settings has a Your data section',nav);
 const hasBtns=await page.evaluate(()=>({e:!!document.querySelector('[data-export]'),d:!!document.querySelector('[data-delete]')}));
 check(hasBtns.e&&hasBtns.d,'Export my data / Delete my data buttons',hasBtns);
 // cookie choice from Settings
 await page.evaluate(()=>document.querySelector('#dl-sec-yourdata [data-accept]').click());
 check(await page.evaluate(()=>daylightConsent.get()==='accepted'&&document.querySelector('#dl-sec-yourdata [data-accept]').getAttribute('aria-pressed')==='true'),'Settings: change the cookie choice to Accept');
 await page.evaluate(()=>document.querySelector('#dl-sec-yourdata [data-deny]').click());
 check(await page.evaluate(()=>daylightConsent.get()==='denied'),'Settings: change it to Deny');
 // export request
 await page.evaluate(()=>document.querySelector('[data-export]').click());await sleep(300);
 await page.evaluate(()=>document.querySelector('.dl-confirm [data-ok]').click());await sleep(500);
 let rows=await page.evaluate(()=>[...document.querySelectorAll('#dl-sec-yourdata [data-list] .dl-dr-row')].map(r=>r.innerText.replace(/\s+/g,' ')));
 check(rows.length===1&&/Data export/.test(rows[0])&&/Pending/.test(rows[0]),'export request submitted and shows Pending',rows);
 await page.evaluate(()=>document.querySelector('[data-export]').click());await sleep(300);
 await page.evaluate(()=>document.querySelector('.dl-confirm [data-ok]').click());await sleep(500);
 check(/already have an open/.test(await page.evaluate(()=>document.querySelector('#dl-sec-yourdata [data-status]').textContent)),'a second open export is refused with a clear message');
 // delete request: needs its own confirmation
 await page.evaluate(()=>document.querySelector('[data-delete]').click());await sleep(300);
 const dlg=await page.evaluate(()=>({t:document.querySelector('.dl-confirm .dialog-title').textContent,danger:!!document.querySelector('.dl-confirm .btn-danger')}));
 check(/Delete all your data/.test(dlg.t)&&dlg.danger,'deletion asks for confirmation',dlg);
 await page.evaluate(()=>document.querySelector('.dl-confirm [data-ok]').click());await sleep(500);
 rows=await page.evaluate(()=>[...document.querySelectorAll('#dl-sec-yourdata [data-list] .dl-dr-row')].map(r=>r.innerText.replace(/\s+/g,' ')));
 check(rows.length===2&&rows.some(r=>/Data deletion/.test(r)&&/Pending/.test(r)),'deletion request submitted and shows Pending',rows);
 await page.screenshot({path:process.env.SHOTS?process.env.SHOTS+'/settings-yourdata.png':undefined}).catch(()=>{});
 await page.keyboard.press('Escape');await sleep(400);
 // Admin: both requests are visible; approval goes through the function; nothing without review
 await page.evaluate(()=>{state.section='admin';renderAll(false)});await sleep(500);
 await page.evaluate(()=>document.querySelector('[data-tab="data"]').click());await sleep(500);
 let ad=await page.evaluate(()=>[...document.querySelectorAll('[data-panel="data"] .dl-dr-row')].map(r=>({t:r.innerText.replace(/\s+/g,' '),b:[...r.querySelectorAll('button')].map(x=>x.textContent)})));
 check(ad.length===2&&ad.every(r=>/user@daylightcal\.com/.test(r.t)),'Admin lists both requests',ad);
 check(ad.some(r=>r.b.includes('Approve export'))&&ad.some(r=>r.b.includes('Approve deletion')),'Admin has Approve export / Approve deletion',ad.map(r=>r.b));
 check(await page.evaluate(()=>!!document.querySelector('[data-tab="maintenance"]')&&!!document.querySelector('[data-panel="maintenance"] .set-group')),'Admin also shows the Maintenance tab');
 await page.screenshot({path:process.env.SHOTS?process.env.SHOTS+'/admin-data.png':undefined}).catch(()=>{});
 await page.evaluate(()=>{[...document.querySelectorAll('[data-panel="data"] button')].find(b=>b.textContent==='Approve export').click()});await sleep(300);
 check(await page.evaluate(()=>!window.__dr.calls.some(c=>c.body.action==='approve')),'nothing happens until the owner confirms');
 await page.evaluate(()=>document.querySelector('.dl-confirm [data-ok]').click());await sleep(700);
 const calls=await page.evaluate(()=>window.__dr.calls.filter(c=>c.body.action==='approve'));
 ad=await page.evaluate(()=>[...document.querySelectorAll('[data-panel="data"] .dl-dr-row')].map(r=>r.innerText.replace(/\s+/g,' ')));
 check(calls.length===1&&ad.some(t=>/Data export|Sent/.test(t)&&/Sent/.test(t)),'approving the export runs the function and shows Sent',{calls,ad});
 check(errors0(app.errors),'no page errors in the app',app.errors);
}finally{await app.close()}
function errors0(e){return e.length===0}
// ---- the notice never covers the sign-in form
for(const [w,h] of [[1440,900],[390,780],[390,667]]){
 const au=await launch(Object.assign({width:w,height:h,theme:'light',signedIn:false},LIVE?{baseUrl:LIVE+'login/?cb='+Date.now()}:{}));
 try{
  const p=au.page;await p.goto(au.url,{waitUntil:'load'});await p.waitForSelector('#authToSignup',{timeout:15000});await sleep(1500);
  const r=await p.evaluate(()=>{document.getElementById('authScreen').scrollTop=99999;const k=document.getElementById('dlCookie').getBoundingClientRect();
   return [...document.querySelectorAll('#authScreen input,#authScreen button,#authScreen a')].filter(n=>n.offsetParent&&n.id!=='authEye').map(n=>{const a=n.getBoundingClientRect();return {id:n.id||n.textContent.trim().slice(0,20),o:!(a.bottom<=k.top||a.top>=k.bottom||a.right<=k.left||a.left>=k.right)}}).filter(x=>x.o)});
  check(r.length===0,`sign-in page ${w}x${h}: the cookie notice covers no field or button`,r);
 }finally{await au.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
