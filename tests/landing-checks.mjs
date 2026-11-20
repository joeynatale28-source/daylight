/** Landing / legal pages: every "Open Daylight" goes to the live app (login/), no Gemini anywhere, the heading's spoken text follows the rotating word.
 *  SITE=local or default deployed. */
import {check,sleep,launchBrowser,siteUrl,failures}from './live-lib.mjs';
const site=await siteUrl();const browser=await launchBrowser();
try{
 const page=await browser.newPage();await page.setViewport({width:1440,height:900});
 for(const [path,expectLogin] of [['',true],['privacy/',true],['tos/',true],['status/',true]]){
  await page.goto(site.url+path,{waitUntil:'load'});await sleep(1200);
  const r=await page.evaluate(()=>({links:[...document.querySelectorAll('a')].filter(a=>/open daylight/i.test(a.textContent)).map(a=>a.href),text:document.body.innerText+' '+document.documentElement.innerHTML}));
  const target=new URL('login/',site.url).href;
  check(r.links.length>0&&r.links.every(h=>h===target),`${path||'landing'}: every "Open Daylight" (${r.links.length}) goes to ${target}`,r.links);
  check(!/gemini/i.test(r.text),`${path||'landing'}: no mention of Gemini`);
  if(path===''){check(!/daylightcal\.com\/dashboard["']/.test(r.text.replace(/<span class="url">[^<]*<\/span>/,'')),'landing: no link to daylightcal.com/dashboard')}
 }
 for(const path of ['login/','sign-up/','dashboard/']){await page.goto(site.url+path,{waitUntil:'domcontentloaded'});await sleep(800);const t=await page.evaluate(()=>document.documentElement.outerHTML);check(!/gemini/i.test(t),`${path}: no mention of Gemini`)}
 await page.goto(site.url,{waitUntil:'load'});await sleep(800);
 let ok=0,bad=0,seen=new Set();
 for(let i=0;i<70;i++){
  const r=await page.evaluate(()=>{const h=document.querySelector('.hero h1');const ws=[...h.querySelectorAll('.slot .word')];let best=null,bo=-1;ws.forEach(n=>{const o=parseFloat(getComputedStyle(n).opacity);if(o>bo){bo=o;best=n}});return {label:h.getAttribute('aria-label'),word:best.textContent,bo}});
  if(r.bo>0.99){seen.add(r.word);const want='Your calendar, minus the '+r.word;if(r.label.startsWith(want))ok++;else{bad++;if(bad<3)console.log('  mismatch',JSON.stringify(r))}}
  await sleep(160);
 }
 check(bad===0&&ok>10&&seen.size>=3,`the heading's accessible text matches the visible word (${ok} samples, words seen: ${[...seen].join(' ')})`,{ok,bad});
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,300))}finally{await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
