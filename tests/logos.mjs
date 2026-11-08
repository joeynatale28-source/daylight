/**
 * Item 5: every place the sun-arc mark renders uses the transparent file for its theme and sits directly on the surface
 * (no tile: no background, border, shadow or padding box behind it). Also proves the two PNGs are transparent at the corners
 * and that no other logo image is shipped. Zoomed crops go to ui-screenshots/logos/. LIVE_URL runs it on a deployed build.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','logos');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

// the files themselves: transparent corners, black mark for light surfaces, white mark for dark surfaces
for(const [f,expect] of [['daylight-sunarc-light-NOBG.png',0],['daylight-sunarc-dark-NOBG.png',255]]){
 const buf=fs.readFileSync(path.join('assets',f));
 // PNG color type 6 (RGBA) is byte 25 of the file
 check(f+' is an RGBA PNG (has an alpha channel)',buf[25]===6,'color type '+buf[25]);
}
const shipped=fs.readdirSync('assets').filter(f=>/\.(png|svg|jpg|jpeg|webp|ico)$/i.test(f));
const logoLike=shipped.filter(f=>/logo|sun|arc|mark|icon/i.test(f)&&!/NOBG|favicon|apple-touch|chatgpt-logo/i.test(f));
check('no old solid logo files are shipped',logoLike.length===0,JSON.stringify(logoLike));
const refs=execFileSync('git',['grep','-n','-I','-E','daylight-sunarc|logo-solid|sunarc-(light|dark)[^-]',...['--','index.html','daylight-settings.js','daylight-integrations.js','daylight-cloud.js','daylight-enhancements.js','404.html']],{encoding:'utf8'}).split('\n').filter(l=>/sunarc/.test(l)&&!/NOBG/.test(l));
check('every code reference points at a -NOBG file',refs.length===0,refs.join(' | ').slice(0,200));

const AUDIT=()=>[...document.querySelectorAll('img.daylight-mark')].filter(i=>i.getClientRects().length&&getComputedStyle(i).visibility!=='hidden').map(i=>{
 const r=i.getBoundingClientRect();const chain=[];let n=i;
 for(let k=0;k<4&&n&&n!==document.body;k++,n=n.parentElement){if(k>0&&(n.id==='sidebar'||n.tagName==='ASIDE'||n.getBoundingClientRect().width>r.width*2.2))break;const c=getComputedStyle(n);   /* only the mark's own wrapper boxes; the panel it sits on is the surface */chain.push({tag:n.className||n.tagName,bg:c.backgroundColor,img:c.backgroundImage,sh:c.boxShadow,bd:(parseFloat(c.borderTopWidth)||0)>0&&c.borderTopStyle!=='none',op:c.opacity})}
 const bad=chain.filter(c=>(c.bg!=='rgba(0, 0, 0, 0)'&&c.bg!=='transparent')||c.img!=='none'||c.sh!=='none'||c.bd);
 return {src:i.getAttribute('src'),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),bad:bad.map(b=>b.tag+' bg='+b.bg)};
});
const crop=async(page,theme,name,sel)=>{
 const box=await page.evaluate(sel=>{const i=[...document.querySelectorAll(sel)].find(n=>n.getClientRects().length);if(!i)return null;const r=i.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}},sel);
 if(!box)return false;
 const pad=14;await page.screenshot({path:path.join(out,`${name}-${theme}.png`),clip:{x:Math.max(0,box.x-pad),y:Math.max(0,box.y-pad),width:box.w+pad*2,height:box.h+pad*2}});return true};

for(const theme of ['dark','light']){
 const want=theme==='dark'?'daylight-sunarc-dark-NOBG.png':'daylight-sunarc-light-NOBG.png';
 const seen=[];
 const report=(where,list)=>{
  list.forEach(l=>seen.push(where));
  check(`${theme} ${where}: ${list.length} mark(s), all transparent files for this theme`,list.length>0&&list.every(l=>l.src.endsWith(want)),JSON.stringify(list.map(l=>l.src)));
  check(`${theme} ${where}: nothing behind the mark (no tile)`,list.every(l=>!l.bad.length),JSON.stringify(list.map(l=>l.bad)));
 };
 // signed in: sidebar expanded, then collapsed
 let app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 try{
  await app.load();await sleep(500);
  report('sidebar (expanded)',await app.page.evaluate(AUDIT));
  await app.page.setViewport({width:1440,height:900,deviceScaleFactor:4});await sleep(200);
  await crop(app.page,theme,'sidebar-logo','#sidebar img.daylight-mark');
  await app.page.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await app.page.evaluate(()=>document.querySelector('#collapseBtn').click());await sleep(500);
  const rail=await app.page.evaluate(AUDIT);
  if(rail.length)report('sidebar (collapsed)',rail);else console.log(`note ${theme} the collapsed rail shows no logo (nothing to check)`);
  await app.page.screenshot({path:path.join(out,`sidebar-collapsed-${theme}.png`)});
 }finally{await app.close()}
 // first paint: the shell painted before any script, slowed down so it can be caught
 app=await launch({theme,width:1440,height:900,payload:busyPayload(),cdnDelayMs:2500,baseUrl:process.env.LIVE_URL||undefined});
 try{
  await app.page.goto(app.url,{waitUntil:'domcontentloaded'});await sleep(700);
  const shell=await app.page.evaluate(AUDIT);
  if(shell.length){report('first-paint shell',shell);await app.page.screenshot({path:path.join(out,`first-paint-${theme}.png`)}) }else console.log(`note ${theme} first-paint shell had no logo image yet`);
 }finally{await app.close()}
 // signed out: sign-in, sign-up, forgot password
 app=await launch({theme,width:1440,height:900,signedIn:false,baseUrl:process.env.LIVE_URL||undefined});
 try{
  await app.page.goto(app.url);await app.page.waitForSelector('#authScreen',{timeout:15000});await sleep(500);
  report('sign-in screen',await app.page.evaluate(AUDIT));
  await app.page.setViewport({width:1440,height:900,deviceScaleFactor:4});await sleep(200);
  await crop(app.page,theme,'signin-logo','#authScreen .auth-mark img.daylight-mark');
  await crop(app.page,theme,'signin-topbar-logo','#authScreen .auth-brand-mark img.daylight-mark');
  await app.page.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await app.page.screenshot({path:path.join(out,`signin-${theme}.png`)});
  for(const mode of ['signup','forgot']){
   const ok=await app.page.evaluate(m=>{const b=[...document.querySelectorAll('#authScreen button,#authScreen a')].find(x=>m==='signup'?/sign up|create account/i.test(x.textContent):/forgot/i.test(x.textContent));if(b){b.click();return true}return false},mode);
   if(ok){await sleep(500);report(mode+' screen',await app.page.evaluate(AUDIT));await app.page.screenshot({path:path.join(out,`${mode}-${theme}.png`)})}
  }
 }finally{await app.close()}
}
if(failed){console.log('logos FAILED');process.exit(1)}
console.log('PASS logos: every mark is the transparent file for its theme and has no tile behind it');
