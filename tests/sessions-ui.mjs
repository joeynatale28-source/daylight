/**
 * Item 1 on the real page (harness stand-in for the server functions; LIVE_URL runs it against the deployed build).
 *  - signing in again and again from the same browser keeps ONE row for this device;
 *  - the device id is created once and re-sent every time;
 *  - signing out another session animates the row out (fade + height collapse) while the rows below glide up;
 *  - "Sign out all other sessions" does the same for every row.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','sessions');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CHROME='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SAFARI='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const FIREFOX='Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
const rowsOf=page=>page.evaluate(()=>[...document.querySelectorAll('.dl-session-list .dl-session-row:not(.dl-session-loading)')].map(r=>({name:r.querySelector('.dl-session-name').textContent.replace(/\s+/g,' ').trim(),meta:r.querySelector('.dl-session-meta').textContent})));
const openProfile=async page=>{await page.evaluate(()=>openSettings('profile'));await page.waitForFunction(()=>document.querySelectorAll('.dl-session-list .dl-session-row:not(.dl-session-loading)').length>0,{timeout:4000});await sleep(300)};
const closeSettings=async page=>{await page.evaluate(()=>{document.querySelector('.settings-close')?.click()});await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:3000});await sleep(250)};
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

for(const theme of ['dark','light']){
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await page.evaluateOnNewDocument(()=>{try{if(!sessionStorage.__seeded){sessionStorage.__seeded=1}}catch(e){}});
  await app.load();
  // The account already has the duplicate rows the old bug made, plus another real device.
  await page.evaluate((c,sf)=>{window.__srv={current:'s-1',sessions:[
    {id:'s-1',ua:c,updated:Date.now()},
    {id:'s-0a',ua:c,updated:Date.now()-3600e3*5},{id:'s-0b',ua:c,updated:Date.now()-3600e3*3},
    {id:'s-ph',ua:sf,updated:Date.now()-3600e3*2}]}},CHROME,SAFARI);
  await openProfile(page);
  const before=await rowsOf(page);
  check(theme+': legacy duplicates are left alone (cannot be told apart safely)',before.length===4,JSON.stringify(before));
  await page.screenshot({path:path.join(out,`before-${theme}.png`)});
  await closeSettings(page);

  // sign out and back in, twice, in this same browser -> a new session each time, the same device id
  const ids=[];
  for(let n=2;n<=3;n++){
   await page.evaluate((n,ua)=>{const S=window.__srv;S.sessions.push({id:'s-'+n,ua,updated:Date.now()});S.current='s-'+n;
     window.__authCb('SIGNED_OUT',null)},n,CHROME);
   await sleep(200);
   // the signed-out screen is a real state; coming back signs in again
   await page.evaluate(n=>{window.__authCb('SIGNED_IN',{user:{id:'00000000-0000-4000-8000-000000000001',email:'demo@example.com'},access_token:'t'})},n);
   await page.waitForFunction(n=>(window.__srv.registered||[]).length>=n-1,{timeout:6000},n).catch(()=>{});
   await sleep(500);
   ids.push(await page.evaluate(()=>(window.__srv.registered||[]).slice()));
  }
  const reg=await page.evaluate(()=>window.__srv.registered||[]);
  check(theme+': this browser registered after each sign-in (initial + two more)',reg.length>=2,JSON.stringify(reg));
  check(theme+': it always sends the SAME device id',new Set(reg).size===1&&/^[A-Za-z0-9-]{16,64}$/.test(reg[0]||''),JSON.stringify(reg));
  await page.evaluate(()=>{state.section='calendar';renderAll(false)});
  await openProfile(page);
  const after=await rowsOf(page);
  const mine=after.filter(r=>/This device/.test(r.name));
  check(theme+': one row marked "This device"',mine.length===1,JSON.stringify(after));
  check(theme+': two more sign-ins from this browser added ONE row (the registered device), not two',after.length===before.length+1,JSON.stringify({before:before.length,after:after.length}));
  check(theme+': row label reads "Chrome on Windows"',/Chrome on Windows/.test(mine[0].name));
  await page.screenshot({path:path.join(out,`after-${theme}.png`)});

  // removal animation: confirm the sign-out of the phone and sample the row while it leaves
  const h0=await page.evaluate(()=>({n:document.querySelectorAll('.dl-session-row').length,listH:document.querySelector('.dl-session-list').offsetHeight}));
  await page.evaluate(()=>{[...document.querySelectorAll('.dl-session-signout')].find(b=>/iPhone/.test(b.getAttribute('aria-label'))).click()});
  await page.waitForSelector('#overlayRoot [data-ok], .backdrop [data-ok]',{timeout:2000});
  await page.evaluate(()=>{(document.querySelector('#overlayRoot > .backdrop:last-child [data-ok]')||document.querySelector('.backdrop:last-child [data-ok]')).click()});
  const samples=[];
  for(let i=0;i<8;i++){
    samples.push(await page.evaluate(()=>{const r=[...document.querySelectorAll('.dl-session-row')].find(x=>/iPhone/.test(x.textContent));const l=document.querySelector('.dl-session-list');
      return r?{h:Math.round(r.getBoundingClientRect().height),o:+getComputedStyle(r).opacity.slice(0,4),list:l.offsetHeight}:{gone:true,list:l.offsetHeight}}));
    if(i===2)await page.screenshot({path:path.join(out,`mid-animation-${theme}.png`)});
    await sleep(35);
  }
  const live=samples.filter(s=>!s.gone);
  const hs=live.map(s=>s.h),os=live.map(s=>s.o),ls=samples.map(s=>s.list);
  check(theme+': the row collapses over several frames (not an instant vanish)',live.length>=3&&Math.max(...hs)>Math.min(...hs)+8,JSON.stringify(samples));
  check(theme+': it fades while collapsing',live.length>=3&&Math.min(...os)<0.9,JSON.stringify(os));
  check(theme+': the list shrinks smoothly so the rows below glide up',new Set(ls).size>=3,JSON.stringify(ls));
  await sleep(500);
  const gone=await rowsOf(page);
  check(theme+': the sign-out completed (row gone, server told)',!gone.some(r=>/iPhone/.test(r.name))&&(await page.evaluate(()=>window.__srv.revokeLog.includes('s-ph'))),JSON.stringify(gone));
  check(theme+': "Sign out all other" button follows the list',await page.evaluate(()=>{const b=document.querySelector('[data-signout-others]');return !b||!b.hidden===(document.querySelectorAll('.dl-session-signout').length>0)}));
  await page.screenshot({path:path.join(out,`after-signout-${theme}.png`)});

  // sign out all the others (legacy rows + a second device)
  await page.evaluate(ua=>{window.__srv.sessions.push({id:'s-fx',ua,updated:Date.now()-1000})},FIREFOX);
  await closeSettings(page);await openProfile(page);
  await page.evaluate(()=>document.querySelector('[data-signout-others]').click());
  await page.waitForSelector('.backdrop [data-ok]',{timeout:2000});
  await page.evaluate(()=>{(document.querySelector('#overlayRoot > .backdrop:last-child [data-ok]')||document.querySelector('.backdrop:last-child [data-ok]')).click()});
  await sleep(1000);
  const last=await rowsOf(page);
  check(theme+': "Sign out all other sessions" leaves only this device',last.length===1&&/This device/.test(last[0].name),JSON.stringify(last));
  await page.screenshot({path:path.join(out,`only-this-device-${theme}.png`)});
 }finally{await app.close()}
}
if(failed){console.log('sessions UI FAILED');process.exit(1)}
console.log('PASS sessions UI');
