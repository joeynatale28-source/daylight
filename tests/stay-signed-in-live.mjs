/** Live, throwaway owner account: a signed-in session must stay signed in during normal use. Two tabs, a token that is about to expire (so refreshes happen), moving between
 *  Calendar / Tasks / Support / Admin, tab switches, and a reload, for several minutes. Any visit to the login page is a failure. SITE=local or default deployed. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const SITE=site.url;const browser=await launchBrowser();const MIN=+process.env.MIN||4;
const bounces=[];
try{
 const A=await makeUser('stay',{owner:true});const tok=await tokenFor(A);
 const ctx=await browser.createBrowserContext();
 const t1=await ctx.newPage(),t2=await ctx.newPage();
 for(const [n,p] of [['tab1',t1],['tab2',t2]]){await p.setViewport({width:1300,height:850});await skipCheck(p);p.on('framenavigated',f=>{if(f===p.mainFrame()&&/\/login\//.test(f.url()))bounces.push(n+' -> '+f.url()+' @'+Math.round((Date.now()-T0)/1000)+'s')})}
 const T0=Date.now();
 await t1.goto(SITE+'login/',{waitUntil:'domcontentloaded'});
 /* the access token is about to expire: the client has to refresh it during use */
 await t1.evaluate(s=>{s.expires_at=Math.floor(Date.now()/1000)+45;localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1')},tok);
 await t1.goto(SITE+'dashboard/',{waitUntil:'load'});await t2.goto(SITE+'dashboard/admin',{waitUntil:'load'});await sleep(5000);
 const go=async(p,fn)=>{await p.bringToFront();await p.evaluate(fn).catch(()=>{})};
 const steps=[()=>[...document.querySelectorAll('.side-row')].find(b=>b.title==='Tasks')?.click(),()=>window.daylightSupport&&window.daylightSupport.open(),()=>[...document.querySelectorAll('.side-row')].find(b=>b.title==='Admin')?.click(),()=>[...document.querySelectorAll('.side-row')].find(b=>b.title==='Calendar')?.click()];
 let i=0;
 while(Date.now()-T0<MIN*60000){
  await go(i%2?t1:t2,steps[i%steps.length]);i++;await sleep(15000);
  if(i%6===0){await t1.bringToFront();await t1.reload({waitUntil:'load'});await sleep(4000)}
 }
 for(const [n,p] of [['tab1',t1],['tab2',t2]]){await p.bringToFront();const s=await p.evaluate(()=>({path:location.pathname,email:document.querySelector('.profile-email')?.textContent||''}));check(!/login/.test(s.path)&&s.email===A.email,n+' is still signed in as the same account after '+MIN+' minutes',s)}
 check(bounces.length===0,'the login page was never shown',bounces);
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
