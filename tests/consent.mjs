/**
 * The MCP consent screen in the app's own design (both themes). Logic is unchanged: it shows who is asking (name + redirect host),
 * who is signed in, and what is requested; Read is required; Write needs Read; Delete needs both; Approve / Deny go through Supabase.
 * Checks the visuals against the app's tokens (Inter, the standard dialog radius, the sun-arc mark, the app's switches and buttons)
 * and every state: consent, approved, denied, error.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','consent');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 for(const who of ['Claude','ChatGPT']){
  const app=await launch({theme,width:1280,height:900});
  const {page}=app;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shot=n=>page.screenshot({path:path.join(out,`${n}-${who.toLowerCase()}-${theme}.png`)});
  try{
   await page.evaluateOnNewDocument(w=>{window.__consent={name:w,redirect:w==='Claude'?'https://claude.ai/api/mcp/auth_callback':'https://chatgpt.com/connector_platform_oauth_redirect'}},who);
   await page.goto(app.url+'?oauth_consent=1&authorization_id=az1',{waitUntil:'load'});
   await page.waitForSelector('#daylightOAuthConsent #dl-oauth-allow',{timeout:15000});await sleep(500);
   const v=await page.evaluate(()=>{const d=document.querySelector('.dl-consent-dialog'),cs=getComputedStyle(d);const sw=[...d.querySelectorAll('.switch')];const logo=d.querySelector('.dl-oauth-logo.daylight img:not([style*="none"])');
    const visibleMark=[...d.querySelectorAll('.dl-oauth-logo.daylight img')].filter(i=>getComputedStyle(i).display!=='none').length;
    return {font:cs.fontFamily.split(',')[0].replace(/"/g,''),radius:cs.borderRadius,w:Math.round(d.getBoundingClientRect().width),heading:d.querySelector('#dl-oauth-heading').textContent,origin:d.querySelector('#dl-oauth-origin').textContent,account:d.querySelector('#dl-account-email').textContent,
     switches:sw.length,marks:visibleMark,clientLogo:!!d.querySelector('#dl-oauth-client-logo img'),clientIsDark:d.querySelector('#dl-oauth-client-logo').classList.contains('is-dark'),allow:d.querySelector('#dl-oauth-allow').textContent,allowCls:d.querySelector('#dl-oauth-allow').className,denyCls:d.querySelector('#dl-oauth-deny').className,
     read:d.querySelector('#dl-can-read').checked,write:d.querySelector('#dl-can-write').checked,del:d.querySelector('#dl-can-delete').checked}});
   check(T(who+': the consent card is the app dialog (Inter, 12px radius, 480px), with the sun-arc mark and the app switches and buttons'),v.font==='Inter'&&v.radius==='12px'&&v.w===480&&v.marks===1&&v.switches===3&&/btn-primary/.test(v.allowCls)&&/btn-ghost/.test(v.denyCls),J(v));
   check(T(who+': it states who is asking, from where, and who is signed in'),v.heading===who+' wants to access your Daylight account'&&v.origin===(who==='Claude'?'claude.ai':'chatgpt.com')&&v.account==='demo@example.com',J(v));
   check(T(who+': the real logo of the requesting app is shown'),v.clientLogo&&!v.clientIsDark,J(v));
   check(T(who+': Read is on by default, Write and Delete off'),v.read&&!v.write&&!v.del);
   await shot('1-consent');
   // permission rules (unchanged logic)
   await page.evaluate(()=>{document.querySelector('#dl-can-delete').click()});await sleep(200);
   const chain=await page.evaluate(()=>({r:document.querySelector('#dl-can-read').checked,w:document.querySelector('#dl-can-write').checked,d:document.querySelector('#dl-can-delete').checked,sum:document.querySelector('#dl-oauth-summary').textContent}));
   check(T(who+': Delete turns on Write and Read (same rules as before)'),chain.r&&chain.w&&chain.d&&/permanently delete events/.test(chain.sum),J(chain));
   await page.evaluate(()=>{document.querySelector('#dl-can-read').click()});await sleep(200);
   check(T(who+': turning Read off turns everything off and disables Allow'),await page.evaluate(()=>!document.querySelector('#dl-can-write').checked&&!document.querySelector('#dl-can-delete').checked&&document.querySelector('#dl-oauth-allow').disabled));
   await page.evaluate(()=>{document.querySelector('#dl-can-read').click()});await sleep(150);
   await page.click('#dl-oauth-allow');await sleep(500);
   const ap=await page.evaluate(()=>({heading:document.querySelector('.dl-consent-dialog h2').textContent,calls:window.__consentCalls,lead:(document.querySelector('.dl-oauth-state .dl-oauth-logo img')||{}).getAttribute&&document.querySelector('.dl-oauth-state .dl-oauth-logo img').getAttribute('src'),mark:document.querySelectorAll('.dl-oauth-state .dl-oauth-logo.daylight').length}));
   check(T(who+': Allow approves through Supabase and shows the connected state'),ap.calls.join()==='approve'&&ap.heading===who+' is connected',J(ap));
   check(T(who+': the redirecting screen leads with the connecting app logo, not the Daylight mark'),ap.mark===0&&new RegExp(who==='Claude'?'claude-logo.png':'chatgpt-logo.svg').test(ap.lead||''),J(ap));
   await shot('2-approved');
  }catch(e){check(T(who+': ran to completion'),false,String(e&&e.stack||e))}
  await app.close();
 }
 // denied and error states (one launch)
 const app2=await launch({theme,width:1280,height:900});
 const {page}=app2;
 try{
  await page.evaluateOnNewDocument(()=>{window.__consent={name:'Claude',redirect:'https://claude.ai/api/mcp/auth_callback'}});
  await page.goto(app2.url+'?oauth_consent=1&authorization_id=az1',{waitUntil:'load'});
  await page.waitForSelector('#dl-oauth-deny',{timeout:15000});await sleep(400);
  await page.click('#dl-oauth-deny');await sleep(500);
  const dn=await page.evaluate(()=>({h:document.querySelector('.dl-consent-dialog h2').textContent,calls:window.__consentCalls}));
  check(T('Cancel denies through Supabase and shows the not-allowed state'),dn.calls.join()==='deny'&&dn.h==='Access was not allowed',J(dn));
  await page.screenshot({path:path.join(out,`3-denied-${theme}.png`)});
 }catch(e){check(T('denied state ran'),false,String(e&&e.stack||e))}
 await app2.close();
 const app3=await launch({theme,width:1280,height:900});
 try{
  await app3.page.goto(app3.url+'?oauth_consent=1&authorization_id=missing',{waitUntil:'load'});
  await app3.page.waitForSelector('.dl-consent-dialog .btn-ghost',{timeout:15000});await sleep(400);
  const er=await app3.page.evaluate(()=>({h:document.querySelector('.dl-consent-dialog h2').textContent,t:document.querySelector('.dl-consent-dialog p').textContent,btn:document.querySelector('.dl-consent-dialog .btn-ghost').textContent,mark:document.querySelectorAll('.dl-oauth-logo.daylight').length}));
  check(T('an unknown request shows the error state in the same design, with a way back'),er.h==='Unable to authorize'&&/not found/i.test(er.t)&&er.btn==='Return to Daylight'&&er.mark===1,J(er));
  await app3.page.screenshot({path:path.join(out,`4-error-${theme}.png`)});
 }catch(e){check(T('error state ran'),false,String(e&&e.stack||e))}
 await app3.close();
}
if(failed){console.log('consent FAILED');process.exit(1)}
console.log('PASS consent');
