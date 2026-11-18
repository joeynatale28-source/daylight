/** Settings: no "Your data" section; Danger Zone is last and deleting needs the typed e-mail (function call stubbed here; the real deletion is tests/delete-account-live.mjs). */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};
const app=await launch({width:+process.env.W||1440,height:+process.env.H||900,theme:process.env.THEME||'light'});const page=app.page;
try{
 await app.load();await sleep(400);
 await page.evaluate(()=>{window.__inv=[];const c=window.daylightCloud;c.client.functions={invoke:async(fn,o)=>{window.__inv.push({fn,body:o.body});return {data:{ok:true},error:null}}};window.__nav=[];window.daylightRoute=Object.assign(window.daylightRoute||{},{siteRoot:'about:blank#gone'})});
 await page.evaluate(()=>openSettings('profile'));await sleep(700);
 const rail=await page.evaluate(()=>[...document.querySelectorAll('.sr-item')].map(b=>b.textContent.trim()));
 check(!rail.includes('Your data')&&rail[rail.length-1]==='Danger Zone',"no 'Your data'; Danger Zone is the last item",rail);
 check(await page.evaluate(()=>!/Your data|Request your data/.test(document.querySelector('.settings-pane').innerText)),'no Your data text anywhere in Settings');
 await page.evaluate(()=>[...document.querySelectorAll('.sr-item')].find(b=>/Danger/.test(b.textContent)).click());await sleep(900);
 if(process.env.SHOTS)await page.screenshot({path:process.env.SHOTS+'/danger.png'});
 check(await page.evaluate(()=>!!document.querySelector('#dl-sec-danger [data-del]')),'the Danger Zone has a Delete account button');
 await page.evaluate(()=>document.querySelector('[data-del]').click());await sleep(400);
 const d=await page.evaluate(()=>({dis:document.querySelector('[data-ok]').disabled,t:document.querySelector('.dialog-title').textContent}));
 check(d.dis&&/Delete your account/.test(d.t),'the confirmation starts disabled',d);
 await page.type('[data-in]','wrong@example.com');
 check(await page.evaluate(()=>document.querySelector('[data-ok]').disabled),'a wrong e-mail keeps it disabled');
 const email=await page.evaluate(()=>window.daylightCloud.user.email);
 await page.$eval('[data-in]',e=>{e.value=''});await page.type('[data-in]',email);
 check(await page.evaluate(()=>!document.querySelector('[data-ok]').disabled),'the right e-mail enables it');
 if(process.env.SHOTS)await page.screenshot({path:process.env.SHOTS+'/danger-dialog.png'});
 await page.click('[data-ok]');await sleep(600);
 const inv=await page.evaluate(()=>window.__inv);
 check(inv.length===1&&inv[0].fn==='delete-account'&&inv[0].body.confirm===email,'it calls delete-account with the typed e-mail',inv);
 check(await page.evaluate(()=>/account was deleted/.test(document.body.innerText)),'it says the account was deleted');
 check(app.errors.length===0,'no page errors',app.errors);
}finally{await app.close()}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
