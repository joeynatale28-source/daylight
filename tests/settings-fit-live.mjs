/** Live: the Settings dialog fits the window at every height and its content scrolls INSIDE it (the last row is reachable). Throwaway account. SITE=local or default deployed. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const browser=await launchBrowser();
try{
 const A=await makeUser('sf');const tok=await tokenFor(A);
 for(const [w,h] of [[1919,998],[1440,800],[1280,600],[1100,480],[390,700],[390,520]]){
  const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:w,height:h});await skipCheck(page);
  await page.goto(site.url+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s))},tok);
  await page.goto(site.url+'dashboard/',{waitUntil:'load'});await sleep(5500);
  await page.evaluate(()=>openSettings());await sleep(1500);
  const m=await page.evaluate(()=>{const d=document.querySelector('.settings-dialog'),p=document.querySelector('.settings-pane'),r=d.getBoundingClientRect(),pr=p.getBoundingClientRect(),rail=document.querySelector('.settings-rail');
   return {vh:innerHeight,top:Math.round(r.top),bottom:Math.round(r.bottom),dh:Math.round(r.height),pane:Math.round(pr.height),paneScroll:p.scrollHeight,oy:getComputedStyle(p).overflowY,pageScroll:document.documentElement.scrollHeight-innerHeight,railOverflow:rail?rail.scrollHeight-rail.clientHeight:0}});
  const fit=m.top>=0&&m.bottom<=m.vh;
  p2:{
  await page.evaluate(()=>{const p=document.querySelector('.settings-pane');p.scrollTop=p.scrollHeight});await sleep(400);
  const e=await page.evaluate(()=>{const p=document.querySelector('.settings-pane'),pr=p.getBoundingClientRect(),secs=[...p.children].filter(x=>x.getBoundingClientRect().height>0),last=secs[secs.length-1].getBoundingClientRect();let deepest=0;p.querySelectorAll('*').forEach(n=>{const b=n.getBoundingClientRect();if(b.height>0&&b.bottom>deepest)deepest=b.bottom});return {atEnd:Math.round(p.scrollHeight-p.clientHeight-p.scrollTop),lastBottom:Math.round(deepest),paneBottom:Math.round(pr.bottom),vh:innerHeight}});
  check(fit,`${w}x${h}: the dialog fits inside the window (top ${m.top}, bottom ${m.bottom} of ${m.vh})`,m);
  check(m.pageScroll<=1,`${w}x${h}: the page behind does not grow`,m);
  check(e.lastBottom<=e.paneBottom+1&&e.lastBottom<=e.vh,`${w}x${h}: scrolled to the end, the last row is fully visible (row ends ${e.lastBottom}, pane ends ${e.paneBottom}, window ${e.vh})`,{m,e});}
  await ctx.close();
 }
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
