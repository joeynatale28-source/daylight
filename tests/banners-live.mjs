/** Banner placement + dismissal against the REAL project with throwaway accounts (never a real account). The landing strip is checked in a real browser. Needs .env. */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import {serve} from './harness.mjs';
const R=new URL('../',import.meta.url);
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`,ANON=env.NEW_SUPABASE_ANON_KEY;
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mgmt=async q=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:q})});return r.json()};
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
const SVC=keys.find(k=>k.name==='service_role').api_key,SH={apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'};
const stamp=Date.now(),made=[];
const mk=async tag=>{const email=`qa.daylight.${tag}${stamp}@mailinator.com`,password='Qa-'+Math.random().toString(36).slice(2)+'Zz9!';
 const u=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:SH,body:JSON.stringify({email,password,email_confirm:true})})).json();made.push(u.id);
 const t=await (await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify({email,password})})).json();return {id:u.id,email,jwt:t.access_token}};
const rpc=async(u,name,args)=>{const r=await fetch(`${BASE}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+(u?u.jwt:ANON),'content-type':'application/json'},body:JSON.stringify(args||{})});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}return {ok:r.ok,data:j}};
const text='QA banner '+stamp;
const landingHas=async()=>((await rpc(null,'daylight_landing_banner')).data||[]).some(b=>b.body===text);
const appHas=async u=>((await rpc(u,'daylight_list_banners')).data||[]).some(b=>b.body===text);
const srv=await serve(0,'/daylight/');
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox']});
let bid=null;
try{
 const O=await mk('banO'),T=await mk('banT');
 await mgmt(`insert into public.daylight_owners(user_id) values ('${O.id}')`);
 check((await rpc(T,'daylight_send_banner',{p_body:text,p_color:'#2563EB'})).ok===false,'a normal user cannot post a banner');
 check((((await rpc(T,'daylight_list_banners')).data)||[]).length===0&&((await rpc(null,'daylight_landing_banner')).data||[]).length===0,'with no banner posted, nothing shows anywhere (no placeholder)');
 // Both
 const sent=await rpc(O,'daylight_send_banner',{p_body:text,p_color:'#2563EB',p_link:'https://example.com/x',p_emails:null,p_landing:true,p_app:true});bid=sent.data&&sent.data.id;
 check(sent.ok&&bid,'post a banner with placement Both',sent.data);
 check(await landingHas()&&await appHas(T),'Both: it is on the landing page and in the app');
 // landing strip in a real browser
 const page=await browser.newPage();await page.setViewport({width:1280,height:800});
 for(const theme of ['light','dark']){
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
  await page.goto(srv.url+'?cb='+Date.now(),{waitUntil:'networkidle0'});await sleep(800);
  const strip=await page.evaluate(t=>{const s=[...document.querySelectorAll('#banners .strip')].find(x=>x.textContent.includes(t));if(!s)return null;const r=s.getBoundingClientRect(),c=getComputedStyle(s);return {top:Math.round(r.top),h:Math.round(r.height),bg:c.backgroundColor,link:!!s.querySelector('a[href^="https://example.com"]'),x:!!s.querySelector('.strip-x')}},text);
  check(strip&&strip.top<=1&&strip.h<=60&&strip.link&&strip.x&&strip.bg==='rgb(37, 99, 235)',`the landing page shows a slim coloured strip at the top with text, link and dismiss (${theme})`,strip);
  if(theme==='light')await page.screenshot({path:process.env.SHOTS?process.env.SHOTS+'/banner-landing.png':undefined}).catch(()=>{});
 }
 // App only -> leaves landing
 await rpc(O,'daylight_update_banner',{p_id:bid,p_body:text,p_color:'#2563EB',p_link:null,p_landing:false,p_app:true});
 check(!(await landingHas())&&await appHas(T),'App only: gone from the landing page, still in the app');
 await page.goto(srv.url+'?cb='+Date.now(),{waitUntil:'networkidle0'});await sleep(600);
 check(await page.evaluate(t=>![...document.querySelectorAll('#banners .strip')].some(x=>x.textContent.includes(t)),text),'App only: the landing page really shows no strip');
 // Landing only -> leaves app
 await rpc(O,'daylight_update_banner',{p_id:bid,p_body:text,p_color:'#2563EB',p_link:null,p_landing:true,p_app:false});
 check(await landingHas()&&!(await appHas(T)),'Landing page only: on the landing page, gone from the app');
 check((await rpc(O,'daylight_update_banner',{p_id:bid,p_body:text,p_color:'#2563EB',p_link:null,p_landing:false,p_app:false})).ok===false,'a banner must be placed somewhere');
 // dismissal
 await page.goto(srv.url+'?cb='+Date.now(),{waitUntil:'networkidle0'});await sleep(600);
 await page.click('#banners .strip-x');await sleep(300);
 check(await page.evaluate(t=>![...document.querySelectorAll('#banners .strip')].some(x=>x.textContent.includes(t)),text),'dismissing on the landing page removes the strip');
 await page.reload({waitUntil:'networkidle0'});await sleep(700);
 check(await page.evaluate(t=>![...document.querySelectorAll('#banners .strip')].some(x=>x.textContent.includes(t)),text),'and it stays dismissed after a reload');
 await rpc(O,'daylight_update_banner',{p_id:bid,p_body:text,p_color:'#2563EB',p_link:null,p_landing:true,p_app:true});
 check(await appHas(T),'Both again: the app shows it to the test user');
 check((await rpc(T,'daylight_dismiss_banner',{p_id:bid})).ok,'the test user dismisses it');
 check(!(await appHas(T)),'once dismissed it stays dismissed for that user');
 const O2=await mk('banT2');check(await appHas(O2),'another user still sees it (dismissal is per person)');
 const adm=await rpc(O,'daylight_admin_list_banners');check(adm.ok&&adm.data.some(b=>b.id===bid&&b.show_in_app&&b.show_on_landing),'the admin list reports the placement');
}finally{
 if(bid)await mgmt(`delete from public.daylight_banners where id='${bid}'`);
 await mgmt(`delete from public.daylight_banners where body like 'QA banner %'`);
 await mgmt(`delete from public.daylight_owners where user_id = any (array[${made.filter(Boolean).map(i=>`'${i}'`).join(',')||"'00000000-0000-0000-0000-000000000000'"}]::uuid[])`);
 for(const id of made.filter(Boolean))await fetch(`${BASE}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:SH});
 console.log('left:',JSON.stringify(await mgmt(`select (select count(*) from public.daylight_banners where body like 'QA banner %')::int banners, (select count(*) from auth.users where email like 'qa.daylight.ban%${stamp}@mailinator.com')::int users`)));
 await browser.close();srv.server.close();
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
