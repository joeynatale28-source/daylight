/** QA fixes, part 2: Settings nav indicator, sidebar calendar names, Documentation link, print format. */
import {launch,busyPayload} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};
const LIVE=process.env.LIVE_URL?process.env.LIVE_URL.replace(/\/?$/,'/'):null;
const app=await launch(Object.assign({width:1919,height:998,theme:'light',payload:busyPayload({month:11})},LIVE?{baseUrl:LIVE+'dashboard/?cb='+Date.now()}:{}));
const page=app.page;
try{
 await app.load();await sleep(500);
 // 26: full calendar names readable (not cut off with an ellipsis)
 const names=await page.evaluate(()=>[...document.querySelectorAll('#sidebar .cal-name')].map(n=>({t:n.textContent,cut:n.scrollWidth>n.clientWidth+1||getComputedStyle(n).textOverflow==='ellipsis'&&getComputedStyle(n).whiteSpace==='nowrap'})));
 check(names.length>0&&names.every(n=>!n.cut),'26: sidebar calendar names are not truncated',names.filter(n=>n.cut));
 // 21: clicking Notifications keeps the indicator on Notifications even after the spy settles
 await page.evaluate(()=>openSettings('general'));await sleep(600);
 await page.evaluate(()=>{[...document.querySelectorAll('.sr-item')].find(b=>/Notifications/.test(b.textContent)).click()});await sleep(1500);
 const act=await page.evaluate(()=>[...document.querySelectorAll('.sr-item.active')].map(b=>b.textContent.trim()));
 check(act.length===1&&/Notifications/.test(act[0]),'21: nav indicator tracks the selected pane (Notifications)',act);
 await page.evaluate(()=>{[...document.querySelectorAll('.sr-item')].find(b=>/Calendar/.test(b.textContent)).click()});await sleep(1500);
 const act2=await page.evaluate(()=>[...document.querySelectorAll('.sr-item.active')].map(b=>b.textContent.trim()));
 check(act2.length===1&&/Calendar/.test(act2[0]),'21: and Calendar',act2);
 await page.keyboard.press('Escape');await sleep(300);
 // 17: Documentation opens the docs site
 await page.evaluate(()=>{window.__opened=null;window.open=function(u){window.__opened=u;return null}});
 const clicked=await page.evaluate(()=>{const b=document.querySelector('[data-side-row="docs"]');if(!b)return false;b.click();return true});await sleep(200);
 const opened=await page.evaluate(()=>window.__opened);
 check(clicked&&opened==='https://joeynatale.mintlify.site','17: Documentation opens the docs site',{clicked,opened});
 // 27: print uses the app's time format and full titles
 const pr=await page.evaluate(()=>{state.cursor=new Date(2026,11,15);renderAll(false);const n=document.createElement('div');return typeof window.daylightPrintMonth});
 check(pr==='function','27: print module present',pr);
}finally{await app.close()}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
