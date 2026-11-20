/** Legal pages and footers: sections, exact wording of the edited paragraphs, no cookie banner anywhere, footer layout. */
import puppeteer from 'puppeteer-core';
import {serve} from './harness.mjs';
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const LIVE=process.env.LIVE_URL?process.env.LIVE_URL.replace(/\/?$/,'/'):null;
const srv=LIVE?null:await serve(0,'/daylight/');const BASE=LIVE||srv.url,cb=LIVE?'?cb='+Date.now():'';
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const p=await browser.newPage();await p.setViewport({width:1280,height:800});
 for(const [path,secs] of [['privacy/',14],['tos/',16]]){
  await p.goto(BASE+path+cb,{waitUntil:'load'});await sleep(500);
  const r=await p.evaluate(()=>({n:document.querySelectorAll('.legal h2').length,upd:document.querySelector('.updated').textContent,text:document.querySelector('.legal').innerText,links:[...document.querySelectorAll('.legal a')].map(a=>a.getAttribute('href')),foot:[...document.querySelectorAll('.foot a')].map(a=>a.textContent.trim())}));
  check(r.n===secs&&r.upd==='Last updated: November 17, 2026',`/${path}: ${secs} sections and date`,[r.n,r.upd]);
  check(!/\[CONTACT EMAIL\]/.test(r.text),`/${path}: no placeholder`);
  check(!r.foot.includes('Cookie settings')&&!await p.evaluate(()=>!!document.getElementById('dlCookie')||!!window.daylightConsent),`/${path}: no cookie banner or Cookie settings link`);
  if(path==='privacy/'){
   check(r.text.includes('We do not set advertising or analytics cookies. Daylight only uses strictly necessary cookies and local storage — your sign-in session, security, and preferences — so no cookie consent banner is needed. You can clear them at any time in your browser settings; doing so will sign you out.'),'Section 5 reads as specified');
   check(!/When you first visit Daylight, a banner/.test(r.text),'the old banner sentences are gone');
   check(r.text.includes('To exercise these rights, use the Support Center (signed in), or email us at privacy@daylightcal.com. Here is how a data request works:')
     &&r.text.includes('For a data export, we prepare your full data as a ZIP file (your account data in readable JSON files, your calendars as ICS files, and a readable summary) and send it to you in your support ticket chat. The download expires after 24 hours.')
     &&r.text.includes('For a deletion request, we delete your data as described in Section 6 and confirm by email.'),'Section 7 reads as specified');
   check(r.text.includes('To exercise these rights, use the Support Center or email privacy@daylightcal.com.')&&!/data request flow in Settings/.test(r.text),'Section 8 says Support Center');
   check(r.links.filter(h=>/dashboard\/support$/.test(h)).length===2,'both Support Center links open the Support Center',r.links);
  }
 }
 // no cookie banner anywhere
 for(const path of ['','status/','login/','sign-up/','dashboard/']){
  await p.goto(BASE+path+cb,{waitUntil:'load'});await sleep(path==='dashboard/'||path.includes('in')?1500:600);
  check(await p.evaluate(()=>!document.getElementById('dlCookie')&&!window.daylightConsent&&!/cookie settings/i.test(document.body.innerText)),`/${path}: no cookie banner, link or choice`);
 }
 // footer layout, light and dark, desktop and phone
 for(const theme of ['light','dark'])for(const [w,h] of [[1440,900],[820,900],[390,800]]){
  const q=await browser.newPage();await q.setViewport({width:w,height:h});await q.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
  for(const path of ['','privacy/','tos/']){
   await q.goto(BASE+path+cb,{waitUntil:'load'});await sleep(400);
   const f=await q.evaluate(()=>{const r=e=>e?e.getBoundingClientRect():null,foot=document.querySelector('.foot'),cols=[...document.querySelectorAll('.ft-cols>div')].map(r),brand=r(document.querySelector('.ft-brand')),copy=r(document.querySelector('.ft-copy')),top=r(document.querySelector('.ft-top'));
    const links=[...document.querySelectorAll('.foot a')].map(r);
    const overlap=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
    let ov=0;for(let i=0;i<links.length;i++)for(let j=i+1;j<links.length;j++)if(overlap(links[i],links[j]))ov++;
    const tops=cols.map(c=>Math.round(c.top));
    return {ov,over:document.documentElement.scrollWidth>innerWidth,colsAligned:new Set(tops.slice(0,Math.min(3,tops.length))).size<=(innerWidth<=560?2:1),bottomRow:copy&&top&&(innerWidth>560?Math.abs((copy.top+copy.height/2)-(top.top+top.height/2))<4:true),inside:foot.getBoundingClientRect().right<=innerWidth+1,gap:cols.length>1?Math.round(cols[1].left-cols[0].right):0}});
   check(!f.ov&&!f.over&&f.colsAligned&&f.bottomRow&&f.inside&&f.gap>=16,`footer /${path} ${theme} ${w}px: no overlap, columns aligned, copyright and Back to top share a row, even gaps`,f);
  }
  await q.close();
 }
}finally{await browser.close();if(srv)srv.server.close()}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
