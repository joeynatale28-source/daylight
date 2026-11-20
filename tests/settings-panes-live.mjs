/** Live, throwaway accounts: the Settings pane list is the same for an owner and a non-owner, on every fresh load and after reopening. SITE=local or default deployed. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck}from './live-lib.mjs';
const site=await siteUrl();const SITE=site.url;const browser=await launchBrowser();
try{
 const A=await makeUser('sa',{owner:true}),B=await makeUser('sb');
 const lists={};
 for(const [tag,u] of [['owner',A],['plain',B],['owner',A],['plain',B]]){
  const tok=await tokenFor(u);const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);
  await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1')},tok);
  await page.goto(SITE+'dashboard/',{waitUntil:'load'});await sleep(6000);await page.keyboard.press('Escape');
  await page.evaluate(()=>[...document.querySelectorAll('.side-row')].find(b=>b.title==='Settings').click());await sleep(1800);
  const l=await page.evaluate(()=>[...document.querySelectorAll('.settings-rail .sr-item span')].map(s=>s.textContent.trim()));
  console.log('INFO',tag,JSON.stringify(l));
  (lists[tag]=lists[tag]||[]).push(l.join(' | '));await ctx.close();
 }
 const all=[...lists.owner,...lists.plain];
 check(all.every(x=>x===all[0])&&all[0].length>0,'the Settings pane list is identical for the owner and a non-owner, on every load',all);
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
