/** Live, throwaway owner: opening Admin, Support Center (cold load and in-app) must never show an empty card, not even for a frame. A watcher samples every animation frame from the
 *  first paint and records any visible card-like box that has no text/controls inside. SITE=local or default deployed. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const SITE=site.url;const browser=await launchBrowser();
const watcher=()=>{window.__blank=[];const sel='.dl-sup-card,.set-group,.dl-page .card,.dl-um-card,.dl-sup .dl-card,.ts-card';let n=0;
 const tick=()=>{n++;document.querySelectorAll(sel).forEach(c=>{const r=c.getBoundingClientRect();if(r.width>80&&r.height>60&&getComputedStyle(c).visibility!=='hidden'&&getComputedStyle(c).display!=='none'&&!c.innerText.trim()&&!c.querySelector('input,button,select,textarea,svg,img,canvas')){window.__blank.push({cls:c.className.slice(0,60),h:Math.round(r.height),w:Math.round(r.width),frame:n})}});requestAnimationFrame(tick)};requestAnimationFrame(tick)};
try{
 const A=await makeUser('bc',{owner:true});const tok=await tokenFor(A);
 for(const [tag,url] of [['support','dashboard/support'],['admin','dashboard/admin'],['calendar','dashboard/']]){
  const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);
  await page.evaluateOnNewDocument(watcher);
  const cdp=await page.createCDPSession();await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:250,downloadThroughput:400*1024,uploadThroughput:200*1024});
  await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'}).catch(()=>{});await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1')},tok);
  await page.goto(SITE+url,{waitUntil:'load'});await sleep(9000);
  const b=await page.evaluate(()=>window.__blank);const uniq=[...new Set(b.map(x=>x.cls+'|'+x.h))];
  check(b.length===0,`${tag}: cold load on a slow connection never shows an empty card`,uniq.slice(0,6));
  await ctx.close();
 }
 /* in-app: opening Support and Admin from the sidebar */
 const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);await page.evaluateOnNewDocument(watcher);
 await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1')},tok);
 await page.goto(SITE+'dashboard/',{waitUntil:'load'});await sleep(6000);
 await page.evaluate(()=>{window.__blank=[]});
 for(const t of ['Support','Admin','Support','Admin']){await page.evaluate(t=>{if(t==='Support')window.daylightSupport.open();else [...document.querySelectorAll('.side-row')].find(b=>b.title==='Admin').click()},t);await sleep(1800)}
 const b=await page.evaluate(()=>window.__blank);check(b.length===0,'opening Support and Admin from the sidebar never shows an empty card',[...new Set(b.map(x=>x.cls+'|'+x.h))].slice(0,6));
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
