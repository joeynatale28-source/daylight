/** App banner strip: coloured strip with a dismiss button; dismissing removes it and tells the server (stubbed here; real storage is tests/banners-live.mjs). */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};
for(const theme of ['light','dark']){
 const app=await launch({width:1280,height:800,theme});const page=app.page;
 try{
  await app.load();await sleep(400);
  await page.evaluate(()=>{const c=window.daylightCloud,real=c.client.rpc.bind(c.client);window.__d=[];window.__gone=false;
   c.client.rpc=function(n,a){if(n==='daylight_list_banners')return Promise.resolve({data:window.__gone?[]:[{id:'b1',body:'Maintenance tonight',color:'#2563EB',link:'https://example.com',created_at:new Date().toISOString()}],error:null});
    if(n==='daylight_dismiss_banner'){window.__d.push(a.p_id);window.__gone=true;return Promise.resolve({data:null,error:null})}return real(n,a)};window.daylightBanners.refresh()});await sleep(500);
  const s=await page.evaluate(()=>{const b=document.querySelector('#dlBanners .dl-banner');return b?{x:!!b.querySelector('.dl-banner-x'),h:Math.round(b.getBoundingClientRect().height),bg:getComputedStyle(b).backgroundColor}:null});
  check(s&&s.x&&s.h<=60,`(${theme}) the app shows the strip with a dismiss button`,s);
  await page.click('.dl-banner-x');await sleep(500);
  check(await page.evaluate(()=>!document.querySelector('#dlBanners .dl-banner')&&window.__d.join()==='b1'),`(${theme}) dismissing removes it and tells the server`);
  await page.evaluate(()=>window.daylightBanners.refresh());await sleep(400);
  check(await page.evaluate(()=>!document.querySelector('#dlBanners .dl-banner')),`(${theme}) it stays dismissed after a refresh`);
  check(app.errors.length===0,'no page errors',app.errors);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
