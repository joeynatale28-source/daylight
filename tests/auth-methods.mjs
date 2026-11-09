/**
 * The auth screen (signed out), both themes, at the client boundary (Supabase is stubbed; the real providers are owner setup):
 *  - sign in: email + password, then Google / "Use a passkey" pills, and a "New to Daylight? Create an account" footer;
 *  - each pill makes the right Supabase call; a provider the project has not switched on gets a polite message and NO redirect;
 *  - passkey: a cancelled prompt and a missing setup both say so in plain words;
 *  - Create account is a real page (name, email, password rules) with its own footer; closed sign-ups, an existing email and the
 *    "check your email" state each read correctly;
 *  - Forgot password is a real page with a generic confirmation, and a resend.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','auth');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,signedIn:false});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(app.url,{waitUntil:'load'});
  await page.waitForSelector('#authScreen .auth-primary',{timeout:15000});await sleep(1300);
  const calls=()=>page.evaluate(()=>window.__authCalls||[]);
  const go=async sel=>{await page.click(sel);await sleep(700)};
  const text=sel=>page.evaluate(s=>{const n=document.querySelector(s);return n?n.textContent.trim():null},sel);
  const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});

  // ---- sign in
  const login=await page.evaluate(()=>({h:document.querySelector('.auth-headline').textContent,pills:[...document.querySelectorAll('.auth-methods .auth-social')].map(b=>b.textContent.trim()),footer:(document.querySelector('.auth-footer-row')||{}).textContent,forgot:!!document.querySelector('#authForgotLink'),overflow:document.querySelector('.auth-form-wrap').scrollHeight>document.querySelector('.auth-form-wrap').clientHeight+2}));
  check(T('sign in shows Google and passkey pills and the Create-account footer'),login.h==='Sign in'&&JSON.stringify(login.pills)==='["Continue with Google","Use a passkey"]'&&/New to Daylight\?\s*Create an account/.test(login.footer)&&login.forgot,JSON.stringify(login));
  await shot('1-signin');
  // the screen is identical on a reload in the same fresh context (the real client fires INITIAL_SESSION, never SIGNED_OUT, on load)
  await page.reload({waitUntil:'load'});await page.waitForSelector('#authScreen .auth-primary',{timeout:15000});await sleep(1300);
  const again=await page.evaluate(()=>[...document.querySelectorAll('.auth-methods .auth-social')].map(b=>b.textContent.trim()));
  check(T('after a reload the same buttons are there immediately'),JSON.stringify(again)==='["Continue with Google","Use a passkey"]',JSON.stringify(again));
  await shot('1b-signin-after-reload');

  // Google: a provider the project has switched on starts OAuth with the right redirect
  await page.evaluate(()=>{window.__realFetch=window.fetch;window.fetch=function(u){if(/auth\/v1\/settings/.test(String(u)))return Promise.resolve(new Response(JSON.stringify({external:{google:true}}),{status:200}));return window.__realFetch.apply(this,arguments)}});
  await go('#authGoogle');
  let c=await calls();
  check(T('Google starts Supabase OAuth for google with a same-page redirect'),c.some(x=>x.fn==='oauth'&&x.a.provider==='google'&&x.a.options.redirectTo.indexOf(app.url)===0),JSON.stringify(c));
  // Google switched OFF in the project settings: a polite message, no redirect call
  await page.evaluate(()=>{window.__authCalls=[];window.dispatchEvent(new Event('pageshow'));window.fetch=function(u){if(/auth\/v1\/settings/.test(String(u)))return Promise.resolve(new Response(JSON.stringify({external:{google:false}}),{status:200}));return window.__realFetch.apply(this,arguments)}});
  await go('#authGoogle');
  c=await calls();
  check(T('a provider that is not switched on explains itself and does not redirect'),c.length===0&&/Google sign-in isn’t available yet/.test(await text('.auth-msg.is-error')||''),JSON.stringify(c)+(await text('.auth-msg')));
  await shot('2-provider-off');

  // Passkey
  await page.evaluate(()=>{window.__authCalls=[];window.__passkeyError={name:'NotAllowedError',message:'The operation either timed out or was not allowed.'}});
  await go('#authPasskey');
  check(T('a cancelled passkey prompt says so, quietly'),/cancelled/i.test(await text('.auth-msg.is-info')||''));
  await page.evaluate(()=>{window.__passkeyError={message:'Passkeys are not enabled for this project'}});
  await go('#authPasskey');
  check(T('passkeys not switched on says so'),/aren’t turned on yet/.test(await text('.auth-msg.is-error')||''));
  await page.evaluate(()=>{window.__passkeyError=null});await go('#authPasskey');
  check(T('a good passkey sign-in calls signInWithPasskey'),(await calls()).filter(x=>x.fn==='passkey').length===3);

  // Forgot password page
  await go('#authForgotLink');
  const fp=await page.evaluate(()=>({h:document.querySelector('.auth-headline').textContent,fields:[...document.querySelectorAll('.auth-pill-input')].length,btn:document.querySelector('.auth-primary').textContent}));
  check(T('Forgot password opens its own page (email only)'),fp.h==='Forgot your password?'&&fp.fields===1&&fp.btn==='Send reset link',JSON.stringify(fp));
  await shot('3-forgot');
  await page.click('.auth-primary');await sleep(300);
  check(T('an empty email is refused with a plain message'),/can't be empty|valid email/i.test(await text('.auth-error')||''));
  await page.type('#authEmail','nobody@example.com');await page.click('.auth-primary');await sleep(900);
  const sent=await page.evaluate(()=>({h:document.querySelector('.auth-headline').textContent,t:document.querySelector('.auth-sent p').textContent,reset:window.__resetCalls}));
  check(T('the confirmation is generic and the reset email was requested'),sent.h==='Check your email'&&/If an account exists for nobody@example\.com/.test(sent.t)&&JSON.stringify(sent.reset)==='["nobody@example.com"]',JSON.stringify(sent));
  await shot('4-forgot-sent');
  await go('#authResendReset');
  check(T('Send it again requests another email'),(await page.evaluate(()=>window.__resetCalls.length))===2&&/Sent again/.test(await text('.auth-msg.is-info')||''));
  await go('#authToLogin');
  check(T('Back to sign in returns to sign in'),(await text('.auth-headline'))==='Sign in');

  // ---- Create account
  await go('#authToSignup');
  const su=await page.evaluate(()=>({h:document.querySelector('.auth-headline').textContent,fields:[...document.querySelectorAll('.auth-pill-label')].map(n=>n.textContent),btn:document.querySelector('.auth-primary').textContent,footer:(document.querySelector('.auth-footer-row')||{}).textContent,pills:[...document.querySelectorAll('.auth-methods .auth-social')].length}));
  check(T('Create account page: Name, Email, Password, its own footer and Google'),su.h==='Create account'&&su.fields.join()==='Name,Email,Password'&&su.btn==='Create account'&&/Already have an account\?\s*Sign in/.test(su.footer)&&su.pills===1,JSON.stringify(su));
  await shot('5-signup');
  await page.click('.auth-primary');await sleep(300);
  check(T('empty fields are flagged and nothing is sent'),(await calls()).filter(x=>x.fn==='signUp').length===0&&(await page.evaluate(()=>document.querySelectorAll('.auth-pill.err').length))>=2);
  await page.type('#authName','Ada Lovelace');await page.$eval('#authEmail',n=>{n.value=''});await page.type('#authEmail','ada@example.com');await page.type('#authPassword','weak');
  await page.click('.auth-primary');await sleep(300);
  check(T('a weak password is refused by the rules before anything is sent'),(await calls()).filter(x=>x.fn==='signUp').length===0);
  await page.$eval('#authPassword',n=>{n.value=''});await page.type('#authPassword','Str0ng!Passw0rd');
  await page.evaluate(()=>{window.__signUpMode='closed'});
  await page.click('.auth-primary');await sleep(800);
  check(T('sign-ups switched off in Supabase says so politely'),/New accounts aren’t open yet/.test(await text('.auth-msg.is-error')||''),JSON.stringify(await page.evaluate(()=>({c:window.__authCalls.slice(-2),msg:(document.querySelector('.auth-msg')||{}).textContent,name:document.querySelector('#authName').value,pw:document.querySelector('#authPassword').value,errs:[...document.querySelectorAll('.auth-error')].map(n=>n.textContent)}))));
  await page.evaluate(()=>{window.__signUpMode='exists'});
  await page.click('.auth-primary');await sleep(800);
  check(T('an email that already has an account says so'),/already exists/.test(await text('.auth-msg.is-error')||''));
  await page.evaluate(()=>{window.__signUpMode='confirm'});
  await page.click('.auth-primary');await sleep(900);
  const sc=await calls();const sg=sc.filter(x=>x.fn==='signUp').pop();
  check(T('a good sign-up sends name in metadata and shows Confirm your email'),sg&&sg.a.email==='ada@example.com'&&sg.a.options.data.full_name==='Ada Lovelace'&&(await text('.auth-headline'))==='Confirm your email',JSON.stringify(sg));
  await shot('6-signup-sent');
  await go('#authToLogin');
  check(T('Sign in from the confirmation returns to sign in'),(await text('.auth-headline'))==='Sign in');
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('auth methods FAILED');process.exit(1)}
console.log('PASS auth methods');
