/** The security check in a real Chrome: does it pass on the FIRST attempt (no error screen, no "Try again")? Runs the /security-check/ page N times in fresh browser contexts
 *  and records what the card showed. Deployed site only (the widget's site key is tied to the live domains). */
import {sleep,launchBrowser,siteUrl,check,failures}from './live-lib.mjs';
const site=await siteUrl();const N=+process.env.N||6;const browser=await launchBrowser();
let firstTry=0;
try{
 for(let i=0;i<N;i++){
  const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1280,height:800});
  const msgs=[];page.on('console',m=>{if(/turnstile|security check/i.test(m.text()))msgs.push(m.text().slice(0,140))});
  await page.goto(site.url+'security-check/?next=../login/',{waitUntil:'domcontentloaded'});
  const seen=new Set();let t0=Date.now(),res='timeout';
  while(Date.now()-t0<25000){
   const s=await page.evaluate(()=>({url:location.pathname,err:document.querySelector('.dl-sc-err')?.textContent||'',btn:!!document.querySelector('.dl-sc-btn'),ok:!!document.querySelector('.dl-sc-ok'),box:document.querySelector('.dl-sc-box')?.innerText||''})).catch(()=>({url:'navigated'}));
   if(s.err)seen.add('ERR:'+s.err);
   if(/\/login\//.test(s.url)||s.url==='navigated'){res='passed';break}
   await sleep(200);
  }
  const errs=[...seen];const first=res==='passed'&&errs.length===0;if(first)firstTry++;
  console.log(`run ${i+1}: ${res} in ${Date.now()-t0}ms; error screens: ${errs.length?errs.join(' | '):'none'}${msgs.length?' ; console: '+msgs.join(' / '):''}`);
  await ctx.close();
 }
 check(firstTry===N,`the check passed on the first attempt in ${firstTry}/${N} fresh browsers`);
}finally{await browser.close();site.close()}
console.log(failures()?'FAILURES':'ALL OK');process.exit(0);
