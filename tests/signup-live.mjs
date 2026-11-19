/** Fresh sign-up, live: a brand-new account is created through the real sign-up endpoint, confirmed, signed in, and opened on the DEPLOYED site:
 *  onboarding appears, then an empty calendar, Tasks and Support Center with clean empty states and no console errors. Throwaway account only. */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const R=new URL('../',import.meta.url);
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`,SITE=process.env.SITE||'https://joeynatale28-source.github.io/daylight/';
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
const SVC=keys.find(k=>k.name==='service_role').api_key,ANON=keys.find(k=>k.name==='anon').api_key;
const stamp=Date.now(),email=`qa.daylight.su${stamp}@mailinator.com`,pw=`Qa-${stamp}Zz9!`;let uid=null;
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome'].find(fs.existsSync);
try{
 const su=await fetch(BASE+'/auth/v1/signup',{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify({email,password:pw,data:{}})});
 const sj=await su.json();uid=sj.id||sj.user?.id;
 if(su.status===429){console.log('NOTE the built-in mailer allows 2 sign-up e-mails an hour and has hit it: creating the account already confirmed, which is the state a new user is in after clicking the e-mail link');
  const cu=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:{apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'},body:JSON.stringify({email,password:pw,email_confirm:true,user_metadata:{}})})).json();uid=cu.id}
 else check(su.status===200&&uid,'sign-up accepted by the real endpoint',{status:su.status,sj});
 if(!uid)throw new Error('no account');
 await fetch(`${BASE}/auth/v1/admin/users/${uid}`,{method:'PUT',headers:{apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'},body:JSON.stringify({email_confirm:true})});
 const tk=await (await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify({email,password:pw})})).json();
 check(!!tk.access_token,'the new account signs in');
 const browser=await puppeteer.launch({executablePath:chrome,headless:'new',args:['--no-sandbox']});
 for(const [w,h,tag] of [[1440,900,'desktop'],[390,844,'phone']]){
  const page=await browser.newPage();await page.setViewport({width:w,height:h});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/.test(m.text()))errs.push(m.text().slice(0,160))});
  await page.goto(SITE+'login/',{waitUntil:'domcontentloaded'});
  await page.evaluate((s)=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));sessionStorage.setItem('daylight-sc-ok',String(Date.now()+864e5))},tk);
  await page.goto(SITE+'dashboard/',{waitUntil:'load'});await sleep(5000);
  check(await page.evaluate(()=>!!document.querySelector('.dl-onb')||/Welcome to Daylight/.test(document.body.innerText)),`${tag}: a new user is welcomed with onboarding`);
  await page.keyboard.press('Escape');await sleep(600);
  {const r=await page.evaluate(()=>({grid:!!document.querySelector('.month-grid'),rows:document.querySelectorAll('.month-week').length,own:state.events.filter(e=>!e.subscribed&&!e.holiday&&!e.builtin).length,cals:state.calendars.map(c=>c.name)}));check(r.grid&&r.rows===6&&r.own===0,`${tag}: a working month calendar with none of your own events`,r)}
  await page.evaluate(()=>[...document.querySelectorAll('.side-row')].find(b=>b.title==='Tasks').click());await sleep(900);
  check(await page.evaluate(()=>/No tasks yet/.test(document.body.innerText)&&!document.querySelector('.tasks-side')),`${tag}: Tasks has a clean empty state`);
  await page.evaluate(()=>window.daylightSupport.open());await sleep(1500);
  check(await page.evaluate(()=>!!document.querySelector('.dl-sup')&&!/undefined|\[object|NaN/.test(document.querySelector('.dl-sup').innerText)),`${tag}: Support Center opens cleanly`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${tag}: nothing scrolls sideways`);
  if(tag==='phone'){await page.evaluate(()=>[...document.querySelectorAll('.side-row')].find(b=>b.title==='Tasks')?.click()).catch(()=>{});await page.evaluate(()=>{state.section='tasks';renderAll(false)});await page.evaluate(()=>{state.tasks.push(mkTask('Neutral check',state.calendars[0].id,sod(TODAY),false,false,''));refreshTasks(false)});await sleep(500);
  {const t=await page.evaluate(()=>{const r=document.querySelector('.task-row'),c=getComputedStyle(r);return {left:c.borderLeftWidth,same:c.borderLeftColor===c.borderTopColor,tag:!!r.querySelector('.tm-cal'),side:!!document.querySelector('.tasks-side')}});check(t.left==='1px'&&t.same&&t.tag&&t.side,`${tag}: live: a task row is neutral (no calendar tint), keeps its calendar tag, and the Overview panel appears`,t)}}
  check(errs.length===0,`${tag}: no console or page errors`,errs);
  await page.close();
 }
 await browser.close();
}catch(e){bad++;console.log('FAIL exception: '+String(e.message).slice(0,200))}finally{
 if(uid)await fetch(`${BASE}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:{apikey:SVC,authorization:'Bearer '+SVC}});
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
