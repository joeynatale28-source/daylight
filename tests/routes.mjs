/**
 * The site's routes, served under a project path (/daylight/) the way GitHub Pages serves it:
 *   /  landing · /login · /sign-up · /dashboard (signed out -> /login) · /oauth/consent · unknown path -> branded 404
 * and that no asset 404s on any of them. Supabase is the stand-in client (signed in or out).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','routes');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
const P='/daylight/';
async function visit(opts,rel,waitFor){
 const app=await launch({width:1440,height:900,theme:'light',prefix:P,routing:true,...opts});
 const {page}=app;const base=app.url.replace(/(dashboard|login)\/$/,'');
 const bad=[];page.on('response',r=>{if(r.status()>=400&&!/fonts\.g/.test(r.url()))bad.push(r.status()+' '+r.url().replace(base,'/'))});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 const resp=await page.goto(base+rel,{waitUntil:'load'});
 if(waitFor)try{await page.waitForSelector(waitFor,{timeout:12000})}catch(e){errs.push('TIMEOUT '+waitFor)}
 await sleep(1200);
 const where=await page.evaluate(()=>location.pathname+location.search+location.hash);
 return {app,page,base,bad,errs,where,status:resp.status()};
}
// ---- landing
let r=await visit({signedIn:false},'','.hero');
check('/ is the landing page',r.where===P&&await r.page.evaluate(()=>!!document.querySelector('.display')),r.where);
check('/ has no broken assets or errors',r.bad.length===0&&r.errs.length===0,J([r.bad,r.errs]));
await r.app.close();
// ---- login / sign-up
for(const [route,head] of [['login/','Sign in'],['sign-up/','Create account']]){
 r=await visit({signedIn:false},route,'#authScreen .auth-primary');
 check(`/${route} renders its form`,r.where===P+route&&await r.page.evaluate(h=>document.querySelector('.auth-headline').textContent===h,head),r.where);
 check(`/${route} has no broken assets or errors`,r.bad.length===0&&r.errs.length===0,J([r.bad,r.errs]));
 await r.page.screenshot({path:path.join(out,route.replace('/','')+'.png')});
 await r.app.close();
}
// ---- dashboard
r=await visit({signedIn:false},'dashboard/','#authScreen .auth-primary');
check('/dashboard signed out goes to /login',r.where===P+'login/',r.where);
await r.app.close();
r=await visit({},'dashboard/','.month-grid');
check('/dashboard signed in loads the calendar',r.where===P+'dashboard/'&&await r.page.evaluate(()=>!!document.querySelector('.month-grid')),r.where);
check('/dashboard has no broken assets or errors',r.bad.length===0&&r.errs.length===0,J([r.bad,r.errs]));
await r.app.close();
r=await visit({},'login/');
check('signed in, /login goes to /dashboard',r.where===P+'dashboard/',r.where);
await r.app.close();
r=await visit({},'sign-up/');
check('signed in, /sign-up goes to /dashboard',r.where===P+'dashboard/',r.where);
await r.app.close();
// ---- consent
r=await visit({},'oauth/consent?authorization_id=az1');
check('/oauth/consent hands off to the app page with its parameters',r.where===P+'dashboard/?oauth_consent=1&authorization_id=az1',r.where);
await r.app.close();
r=await visit({signedIn:false},'dashboard/?oauth_consent=1&authorization_id=az1','#authScreen .auth-primary');
check('signed out on the consent step: /login keeps the consent parameters',r.where===P+'login/?oauth_consent=1&authorization_id=az1',r.where);
await r.app.close();
// ---- provider / email returns land on the right page
for(const [rel,expect,label] of [['?code=abc','dashboard/?code=abc','a finished Google / email-confirm return goes to /dashboard'],['#type=recovery&access_token=x','login/#type=recovery&access_token=x','a password-reset link goes to /login'],['?error=access_denied&error_code=bad','login/?error=access_denied&error_code=bad','a failed provider return goes to /login']]){
 r=await visit({signedIn:rel.startsWith('?code')},rel);
 check(label,r.where.startsWith(P+expect.split('?')[0].split('#')[0]),r.where);
 await r.app.close();
}
// ---- unknown path
r=await visit({signedIn:false},'nonsense');
check('an unknown path is a real 404 with the branded page',r.status===404&&await r.page.evaluate(()=>/doesn.t exist/.test(document.querySelector('h1').textContent)&&!!document.getElementById('mL').naturalWidth),String(r.status));
check('the 404 page uses the site base for its logo and home link',await r.page.evaluate(()=>document.getElementById('home').getAttribute('href')==='/daylight/'),'');
await r.page.screenshot({path:path.join(out,'404-light.png')});
await r.app.close();
r=await visit({signedIn:false,theme:'dark'},'deep/nonsense/path');
check('an unknown path at any depth works too',r.status===404&&await r.page.evaluate(()=>!!document.getElementById('mD').naturalWidth),String(r.status));
await r.page.screenshot({path:path.join(out,'404-dark.png')});
await r.app.close();
if(failed){console.log('routes FAILED');process.exit(1)}
console.log('PASS routes');
