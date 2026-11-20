/** Live (real Supabase, throwaway accounts only): cold-load dashboard routes for an admin, the Admin button after a reload, the Users tab, a non-owner on /dashboard/admin,
 *  and sign-in landing on the SUBMITTED account with another session cached in the browser (both directions). SITE=local tests the local build, default is the deployed site. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,putSession,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const SITE=site.url;
const where=p=>p.evaluate(()=>({path:location.pathname.replace(/^.*\/(?=dashboard\/|login\/)/,'/'),admin:!![...document.querySelectorAll('.side-row')].find(b=>b.title==='Admin'),
 sec:document.querySelector('.dl-sup')?'support':document.querySelector('.tasks-wrap')?'tasks':document.querySelector('.dl-tabs [data-tab=users]')?'admin':document.querySelector('.month-grid')?'calendar':'?',
 tab:document.querySelector('.dl-tabs .is-active,.dl-tabs [aria-selected=true],.dl-tabs .active')?.dataset?.tab||'',email:document.querySelector('.profile-email')?.textContent||''}));
const browser=await launchBrowser();
try{
 const A=await makeUser('own',{owner:true,name:'QA Owner'}),B=await makeUser('usr',{name:'QA Plain'});
 const ta=await tokenFor(A),tb=await tokenFor(B);
 check(!!ta.access_token&&!!tb.access_token,'both throwaway accounts can sign in');
 async function cold(tok,url,wait=9000){
  const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);
  await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>{});
  await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1')},tok);
  await page.goto(SITE+url,{waitUntil:'load'});await sleep(wait);
  const w=await where(page);return {w,page,ctx};
 }
 /* ---- Fix 2: every route on a cold load, with and without the trailing slash ---- */
 for(const [u,sec,pth] of [['dashboard/tasks','tasks','/dashboard/tasks'],['dashboard/tasks/','tasks','/dashboard/tasks'],['dashboard/support','support','/dashboard/support'],['dashboard/support/','support','/dashboard/support'],['dashboard/admin','admin','/dashboard/admin'],['dashboard/admin/','admin','/dashboard/admin'],['dashboard/admin/users','admin','/dashboard/admin'],['dashboard/admin/users/','admin','/dashboard/admin']]){
  const r=await cold(ta,u);
  check(r.w.sec===sec&&r.w.path.replace(/\/$/,'')===pth.replace(/\/$/,''),`owner, cold load of /${u}: shows ${sec} at ${pth}`,r.w);
  if(sec==='admin'){check(r.w.admin,`owner, cold load of /${u}: the Admin button is in the sidebar`);check(r.w.tab==='users','owner, cold load of /'+u+': the Users tab is selected',r.w)}
  await r.ctx.close();
 }
 {const r=await cold(ta,'dashboard/',6000);check(r.w.admin&&r.w.sec==='calendar','owner, cold load of /dashboard/: Admin button visible without any in-app navigation',r.w);
  await r.page.reload({waitUntil:'load'});await sleep(6000);const w2=await where(r.page);check(w2.admin,'owner, after a full reload the Admin button is still there',w2);
  await r.page.reload({waitUntil:'load'});await sleep(600);const w3=await where(r.page);console.log('INFO admin button 0.6s after reload:',w3.admin);
  await r.ctx.close()}
 {const r=await cold(tb,'dashboard/admin',9000);check(r.w.sec==='calendar'&&!r.w.admin&&/\/dashboard\/?$/.test(r.w.path),'non-owner on /dashboard/admin: lands on the calendar with no Admin button',r.w);await r.ctx.close()}
 {const r=await cold(tb,'dashboard/admin/users',9000);check(r.w.sec==='calendar'&&!/404/.test(await r.page.title()),'non-owner on /dashboard/admin/users: calendar, not a 404',r.w);await r.ctx.close()}
 {const r=await cold(ta,'dashboard/nope/x',4000);const t=await r.page.title();console.log('INFO unknown dashboard path ->',t,r.w.path);await r.ctx.close()}
 /* ---- Fix 3: sign in as one account, sign out, sign in as another, in both directions ---- */
 async function uiSignIn(page,u){
  await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#authEmail',{timeout:15000});
  await page.type('#authEmail',u.email);await page.type('#authPassword',u.pw);await page.keyboard.press('Enter');
  await page.waitForFunction(()=>/\/dashboard\//.test(location.pathname)&&document.querySelector('.profile-email'),{timeout:30000});await sleep(2500);
 }
 const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);
 await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.setItem('daylight-onboarded','1')).catch(()=>{});
 await uiSignIn(page,A);
 {const w=await where(page);check(w.email.toLowerCase()===A.email.toLowerCase(),'first sign-in (owner) shows the owner',w)}
 let cur=A;
 for(const to of [B,A,B,A]){
  const tag=(cur===A?'owner':'plain')+' -> '+(to===A?'owner':'plain');
  await page.evaluate(()=>logOut());await page.waitForFunction(()=>/\/login\//.test(location.pathname),{timeout:20000});await sleep(1500);
  await page.waitForSelector('#authEmail',{timeout:15000});
  await page.type('#authEmail',to.email);await page.type('#authPassword',to.pw);await page.keyboard.press('Enter');
  await page.waitForFunction(()=>/\/dashboard\//.test(location.pathname)&&document.querySelector('.profile-email')?.textContent,{timeout:30000});await sleep(3500);
  const w=await where(page);check(w.email.toLowerCase()===to.email.toLowerCase(),`${tag}: after sign-out, signing in shows THAT account`,w);
  check(w.admin===(to===A),`${tag}: Admin button only for the owner account`,w);
  cur=to;
 }
 /* a different session is CACHED in the browser while the other credentials are typed quickly on the login page */
 for(const [cached,typed,tag] of [[ta,B,'cached owner, typed plain'],[tb,A,'cached plain, typed owner']]){
  const c2=await browser.createBrowserContext();const p2=await c2.newPage();await p2.setViewport({width:1440,height:900});await skipCheck(p2);
  await p2.goto(SITE+'login/',{waitUntil:'domcontentloaded'});
  await p2.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1')},cached);
  /* sign-in page is opened WITH a cached session present, and credentials are typed as soon as the form exists */
  await p2.goto(SITE+'login/',{waitUntil:'domcontentloaded'});
  let landed=null;
  try{
   await p2.waitForSelector('#authEmail',{timeout:2500});
   await p2.type('#authEmail',typed.email);await p2.type('#authPassword',typed.pw);await p2.keyboard.press('Enter');
  }catch(e){landed='form never shown (cached session went straight to the app)'}
  await sleep(9000);
  const w=await where(p2).catch(()=>({email:'?'}));
  console.log('INFO',tag,'->',landed||'form shown',w.path,w.email);
  if(!landed)check(w.email.toLowerCase()===typed.email.toLowerCase(),`${tag}: submitted credentials win over the cached session`,w);
  await c2.close();
 }
 /* the form's values changed WITHOUT input events (browser autofill / paste): the submitted account is the one shown in the form */
 {const c3=await browser.createBrowserContext();const p3=await c3.newPage();await p3.setViewport({width:1440,height:900});await skipCheck(p3);
  await p3.goto(SITE+'login/',{waitUntil:'domcontentloaded'});await p3.waitForSelector('#authEmail',{timeout:15000});
  await p3.type('#authEmail',A.email);await p3.type('#authPassword','wrong-first-password');
  await p3.evaluate((e,pw)=>{document.querySelector('#authEmail').value=e;document.querySelector('#authPassword').value=pw},B.email,B.pw);
  await p3.click('.auth-primary');
  await p3.waitForFunction(()=>/\/dashboard\//.test(location.pathname)&&document.querySelector('.profile-email')?.textContent,{timeout:30000}).catch(()=>{});await sleep(3000);
  const w=await where(p3);check(w.email.toLowerCase()===B.email.toLowerCase(),'autofilled values (no input events): signs in as the account shown in the form',w);await c3.close()}
 await ctx.close();
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
