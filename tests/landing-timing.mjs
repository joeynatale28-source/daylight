/** Landing page feature animations: how long after a section comes into view does it show its result, and how long is one full cycle (real wall-clock). SITE=local or default deployed. */
import {check,sleep,launchBrowser,siteUrl,failures}from './live-lib.mjs';
const site=await siteUrl();const browser=await launchBrowser();
try{
 const page=await browser.newPage();await page.setViewport({width:1440,height:900});
 await page.goto(site.url,{waitUntil:'load'});await sleep(1500);
 const ids=await page.evaluate(()=>[...document.querySelectorAll('section.fx')].map((s,i)=>({i,id:s.id||'',h2:s.querySelector('h2')?.textContent.slice(0,40)})));
 console.log('INFO sections',JSON.stringify(ids));
 for(const s of ids){
  await page.evaluate(i=>{const el=document.querySelectorAll('section.fx')[i];window.scrollTo(0,0);el.scrollIntoView({block:'center'})},s.i);
  const t0=Date.now();
  /* sample: the first running animation's currentTime and duration, plus the AI scene's "ans" flag */
  let ansAt=null,cycle=null,lastCt=-1,wraps=[];
  while(Date.now()-t0<30000){
   const r=await page.evaluate(i=>{const el=document.querySelectorAll('section.fx')[i];const sc=el.querySelector('.sc1');const an=el.getAnimations({subtree:true}).filter(a=>a.effect&&a.effect.getComputedTiming().iterations===Infinity&&a.effect.getComputedTiming().duration>2000)[0];
    return {on:el.classList.contains('on'),ans:!!(sc&&sc.classList.contains('ans')),ct:an?an.currentTime:null,dur:an?an.effect.getComputedTiming().duration:null,state:an?.playState}},s.i);
   const now=Date.now()-t0;
   if(r.ans&&ansAt===null)ansAt=now;
   if(r.ct!==null){if(lastCt>=0&&r.ct%r.dur<lastCt%r.dur-1000)wraps.push(now);lastCt=r.ct}
   if(wraps.length>=2||(ansAt!==null&&!r.dur))break;
   await sleep(150);
  }
  const dur=await page.evaluate(i=>{const el=document.querySelectorAll('section.fx')[i];const an=el.getAnimations({subtree:true}).filter(a=>a.effect.getComputedTiming().iterations===Infinity&&a.effect.getComputedTiming().duration>2000)[0];return an?an.effect.getComputedTiming().duration:null},s.i);
  console.log(`INFO ${s.id||s.h2}: answer/result flag after ${ansAt===null?'n/a':ansAt+'ms'}; loop length ${dur===null?'n/a':dur+'ms'}; observed loop wraps at ${JSON.stringify(wraps)}`);
 }
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,300))}finally{await browser.close();site.close()}
process.exit(0);
