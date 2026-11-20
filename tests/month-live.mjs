/** Live month grid check at tall and short windows with a throwaway account: the bottom week must have visible clearance below it, and when the rows
 *  cannot fit the grid must scroll by itself. SITE=local for the local build. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const SITE=site.url;const browser=await launchBrowser();
try{
 const U=await makeUser('mg');const tok=await tokenFor(U);
 for(const [w,h] of [[1919,998],[1440,800],[1280,640]]){
  const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:w,height:h});await skipCheck(page);
  await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'});
  await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1')},tok);
  await page.goto(SITE+'dashboard/',{waitUntil:'load'});await sleep(6000);await page.keyboard.press('Escape');await sleep(500);
  const m=await page.evaluate(()=>{const g=document.querySelector('.month-grid'),rows=[...document.querySelectorAll('.month-week')],last=rows[rows.length-1].getBoundingClientRect(),gr=g.getBoundingClientRect();
   return {vh:innerHeight,appH:getComputedStyle(document.documentElement).getPropertyValue('--dl-app-h'),gridTop:Math.round(gr.top),gridH:Math.round(gr.height),client:g.clientHeight,scrollH:g.scrollHeight,rowH:Math.round(rows[0].getBoundingClientRect().height),lastBottom:Math.round(last.bottom),clear:Math.round(innerHeight-last.bottom),docScroll:document.documentElement.scrollHeight-innerHeight,pad:getComputedStyle(g).paddingBottom,oy:getComputedStyle(g).overflowY}});
  console.log('INFO',w+'x'+h,JSON.stringify(m));
  if(m.scrollH<=m.client+1)check(m.clear>=12,`${w}x${h}: the last week ends at least 12px above the bottom of the window (${m.clear}px)`,m);
  check(m.docScroll<=1,`${w}x${h}: the page itself does not scroll`,m);
  const fits=m.scrollH<=m.client+1;
  if(!fits){const before=await page.evaluate(()=>document.querySelector('.month-grid').scrollTop);await page.mouse.move(w/2,h/2);await page.mouse.wheel({deltaY:600});await sleep(500);
   const st=await page.evaluate(()=>{const g=document.querySelector('.month-grid');return {top:g.scrollTop,max:g.scrollHeight-g.clientHeight,lastBottom:Math.round([...document.querySelectorAll('.month-week')].pop().getBoundingClientRect().bottom),vh:innerHeight}});
   check(st.top>before&&st.vh-st.lastBottom>=12,`${w}x${h}: the grid scrolls inside, and the last week ends clear of the bottom (${st.vh-st.lastBottom}px)`,st)}
  else console.log(`INFO ${w}x${h}: all six weeks fit with room to spare, so there is nothing to scroll`);
  await ctx.close();
 }
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
