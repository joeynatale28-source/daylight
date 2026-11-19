/** Security check (Cloudflare Turnstile): the full-page card renders in both themes (logo, "security check", "verification required to continue",
 *  reference line); a passing token continues; a failing one shows a retry (never a dead end); sign-in and delete-account run it first; with no
 *  secret configured it passes at once. Cloudflare and the verify function are stubbed. */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const TJS="window.turnstile={render:function(el,o){window.__tsOpts=o;setTimeout(function(){o.callback('tok-'+(window.__tsN=(window.__tsN||0)+1))},150);return 'w1'},remove:function(){}};";
for(const theme of ['light','dark']){
 let mode='pass';
 const app=await launch({theme,width:1440,height:900,security:true,turnstileJs:TJS,verifyBody:()=>mode==='pass'?'{"ok":true,"configured":true}':mode==='open'?'{"ok":true,"configured":false}':'{"ok":false,"configured":true}'});
 const {page}=app;
 try{
  await app.load();await sleep(400);
  // failing token: a clear retry
  mode='fail';
  const p1=page.evaluate(()=>window.daylightTurnstile.check('test',{force:true,cancel:true}).then(r=>window.__r1=r).catch(()=>{}));
  await page.waitForSelector('.dl-sc .dl-sc-err',{timeout:6000});await page.evaluate(()=>{window.__m1=document.querySelector('.dl-sc-err').textContent});
  const f=await page.evaluate(()=>({h:document.querySelector('.dl-sc h1').textContent,sub:document.querySelector('.dl-sc p').textContent,ref:document.querySelector('.dl-sc-ref').innerText.replace(/\s+/g,' '),btns:[...document.querySelectorAll('.dl-sc-act button')].map(b=>b.textContent),logo:!!document.querySelector('.dl-sc-logo svg'),bg:getComputedStyle(document.querySelector('.dl-sc')).backgroundColor,site:window.__tsOpts&&window.__tsOpts.sitekey}));
  check(f.h==='Security Check'&&/Verification required to continue/.test(f.sub)&&/^Ref [0-9a-f]{16} Protected by Cloudflare$/.test(f.ref)&&f.logo&&f.site==='0x4AAAAAAGIfeIbpHfLEL4Jo','the card shows the logo, heading, subtitle, reference line and uses the site key',f);
  check(f.btns.includes('Try again')&&f.btns.includes('Cancel'),'a failed check offers Try again (and Cancel for an action)',f.btns);
  if(process.env.SHOTS)await page.screenshot({path:process.env.SHOTS+`/security-${theme}.png`});
  mode='pass';await page.click('.dl-sc-act .p');await page.waitForSelector('.dl-sc-ok',{timeout:6000});if(process.env.SHOTS)await page.screenshot({path:process.env.SHOTS+`/security-ok-${theme}.png`});await page.waitForFunction(()=>!document.querySelector('.dl-sc'),{timeout:6000});await p1;
  check(await page.evaluate(()=>window.__r1===true),'retrying with a good token passes and continues');
  // fresh pass is remembered (no second prompt), a forced one prompts again, cancel resolves false
  check(await page.evaluate(()=>window.daylightTurnstile.check('again',{cancel:true}).then(r=>r&&!document.querySelector('.dl-sc'))),'a pass is remembered for a few minutes (no repeated prompts)');
  mode='fail';
  const p2=page.evaluate(()=>window.daylightTurnstile.check('x',{force:true,cancel:true}).then(r=>window.__r2=r).catch(()=>{}));
  await page.waitForSelector('.dl-sc .dl-sc-btn:not(.p)',{timeout:6000});await page.click('.dl-sc-act button:not(.p)');await p2;
  check(await page.evaluate(()=>window.__r2===false&&!document.querySelector('.dl-sc')),'Cancel closes it without continuing');
  // not configured yet: passes at once
  mode='open';
  check(await page.evaluate(()=>window.daylightTurnstile.check('open',{force:true}).then(r=>r)),'with no secret key set the check passes (never a lock-out)');
  check(app.errors.length===0,'no page errors',app.errors);
 }catch(e){bad++;console.log('FAIL exception: '+String(e.message).slice(0,200))}finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
