/** Live, throwaway accounts: two tabs of one browser. Tab 1 is signed in as A; tab 2 signs out and signs in as B (and back). The browser must end up on the account that signed in last, in BOTH tabs, and stay there. */
import {check,sleep,makeUser,cleanup,launchBrowser,siteUrl,failures,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const SITE=site.url;
const browser=await launchBrowser();
const who=p=>p.evaluate(()=>({path:location.pathname.replace(/^.*\/(?=dashboard\/|login\/)/,'/'),email:document.querySelector('.profile-email')?.textContent||'',stored:(()=>{try{return JSON.parse(localStorage.getItem('sb-usihrcucnreecynewgbd-auth-token')).user.email}catch(e){return ''}})()}));
try{
 const A=await makeUser('ta',{owner:true}),B=await makeUser('tb');
 const ctx=await browser.createBrowserContext();
 const t1=await ctx.newPage(),t2=await ctx.newPage();for(const p of [t1,t2]){await p.setViewport({width:1300,height:850});await skipCheck(p)}
 async function signIn(p,u){await p.bringToFront();await p.goto(SITE+'login/',{waitUntil:'domcontentloaded'});await p.waitForSelector('#authEmail',{timeout:15000});await p.type('#authEmail',u.email);await p.type('#authPassword',u.pw);await p.keyboard.press('Enter');
  await p.waitForFunction(()=>/\/dashboard\//.test(location.pathname)&&document.querySelector('.profile-email')?.textContent,{timeout:30000});await sleep(2500)}
 await signIn(t1,A);
 let w=await who(t1);check(w.email===A.email,'tab 1 signed in as A',w);
 await t2.bringToFront();await t2.goto(SITE+'dashboard/',{waitUntil:'load'});await sleep(3000);
 await t2.evaluate(()=>logOut());await t2.waitForFunction(()=>/\/login\//.test(location.pathname),{timeout:20000});await sleep(1500);
 console.log('INFO t1 after t2 sign-out',JSON.stringify(await who(t1)),'t2',JSON.stringify(await who(t2)));
 await t2.waitForSelector('#authEmail',{timeout:15000});await t2.type('#authEmail',B.email);await t2.type('#authPassword',B.pw);await t2.keyboard.press('Enter');
 await t2.waitForFunction(()=>/\/dashboard\//.test(location.pathname)&&document.querySelector('.profile-email')?.textContent,{timeout:30000});
 console.log('INFO right after B signs in: t1',JSON.stringify(await who(t1).catch(e=>String(e))),'t2',JSON.stringify(await who(t2).catch(e=>String(e))));
 await sleep(40000);   /* past the client's automatic token refresh tick */
 const w1=await who(t1),w2=await who(t2);
 console.log('INFO tab1',JSON.stringify(w1),'tab2',JSON.stringify(w2));
 check(w2.email===B.email&&w2.stored===B.email,'tab 2 shows B and the browser holds B',w2);
 check(w1.stored===B.email&&(w1.email===''||w1.email===B.email),'tab 1 never shows A after B signed in (it follows to B or sits on the login page)',w1);
 await t1.bringToFront();await sleep(2500);await t1.reload({waitUntil:'load'});await sleep(5000);
 const w3=await who(t1);check(w3.email===B.email||w3.path.startsWith('/login'),'tab 1 after a reload: B (or the sign-in page), never A',w3);
 await ctx.close();
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
