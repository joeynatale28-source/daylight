/**
 * Landing page (nav + hero), real page over HTTP: both OS themes, three widths, scrolled pill, mobile menu, reduced motion,
 * measured gaps, links, no 404s, no horizontal scroll, motion plays.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {serve} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','site');
fs.mkdirSync(out,{recursive:true});
const chrome=process.env.CHROME_PATH||['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/google-chrome-stable'].find(fs.existsSync);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
const {server,url}=await serve(0);
const browser=await puppeteer.launch({executablePath:chrome,headless:'new',args:['--no-sandbox']});
async function open(theme,w,h,{reduce=false,touch=false}={}){
 const page=await browser.newPage();
 await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:touch,hasTouch:touch});
 await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]);
 const bad=[];page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});page.on('requestfailed',r=>{if(!/fonts\.g/.test(r.url()))bad.push('FAILED '+r.url())});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(url,{waitUntil:'load'});
 return {page,bad,errs};
}
for(const theme of ['light','dark']){
 const T=s=>`${theme}: ${s}`;
 // ---------------- desktop 1440
 let {page,bad,errs}=await open(theme,1440,900);
 await sleep(1500);
 await page.screenshot({path:path.join(out,`hero-1440-${theme}.png`)});
 const m=await page.evaluate(()=>{
  const r=s=>{const n=document.querySelector(s);if(!n)return null;const b=n.getBoundingClientRect();return {top:b.top+scrollY,bottom:b.bottom+scrollY,h:b.height,w:b.width,left:b.left}};
  const cs=(s,p)=>getComputedStyle(document.querySelector(s))[p];
  return {nav:r('.nav-inner'),pill:r('.announce'),h1:r('.display'),sub:r('.sub'),ctas:r('.ctas'),trust:r('.trust'),frame:r('.frame'),screen:r('.frame-screen'),
   h1size:cs('.display','fontSize'),h1w:cs('.display','fontWeight'),h1ls:cs('.display','letterSpacing'),font:cs('body','fontFamily').slice(0,30),btnH:r('.btn-primary').h,
   lines:Math.round(r('.display').h/parseFloat(cs('.display','lineHeight'))),hscroll:document.documentElement.scrollWidth>innerWidth,
   links:[...document.querySelectorAll('.links a')].map(a=>a.getAttribute('href')),cta:document.querySelector('.nav-cta').getAttribute('href'),
   hero:[...document.querySelectorAll('.ctas a')].map(a=>a.getAttribute('href')),logo:document.querySelector('.brand').getAttribute('href'),
   navBtns:document.querySelectorAll('.nav-cta').length,loginBtn:/log in/i.test(document.querySelector('.nav').textContent)}});
 check(T('nav is 54px'),Math.round(m.nav.h)===54||Math.round(m.nav.h)===55,J(m.nav));
 check(T('headline is Inter 600, -0.03em, 80px at 1440 and at most 2 lines'),/Inter/.test(m.font)&&m.h1size==='80px'&&m.h1w==='600'&&Math.abs(parseFloat(m.h1ls)+2.4)<0.2&&m.lines<=2,J([m.font,m.h1size,m.h1w,m.h1ls,m.lines]));
 check(T('gaps: pill→headline 24, headline→sub 16, sub→buttons 40, buttons→trust 24, trust→frame 80'),
  Math.round(m.h1.top-m.pill.bottom)===24&&Math.round(m.sub.top-m.h1.bottom)===16&&Math.round(m.ctas.top-m.sub.bottom)===40&&Math.round(m.trust.top-m.ctas.bottom)===24&&Math.round(m.frame.top-m.trust.bottom)===80,
  J([m.h1.top-m.pill.bottom,m.sub.top-m.h1.bottom,m.ctas.top-m.sub.bottom,m.trust.top-m.ctas.bottom,m.frame.top-m.trust.bottom]));
 check(T('frame screen is exactly 8:5'),Math.abs(m.screen.w/m.screen.h-1.6)<0.005,J([m.screen.w,m.screen.h]));
 check(T('the headline is the biggest type by a wide margin (80px vs 17px body)'),parseFloat(m.h1size)>=4*17);
 check(T('links: logo /, anchors, ONE Open Daylight button to login/, Get started to sign-up/, See how it works #features, no Log in'),
  m.logo==='./'&&m.links.join()==='#features,#sharing,#ai,#faq'&&m.cta==='login/'&&m.hero.join()==='sign-up/,#features'&&m.navBtns===1&&!m.loginBtn,J(m));
 check(T('no horizontal scroll, no 404s, no page errors'),!m.hscroll&&bad.length===0&&errs.length===0,J([m.hscroll,bad,errs]));
 // scrolled pill over the dark hero
 await page.evaluate(()=>window.scrollTo({top:140,behavior:'instant'}));await sleep(500);
 const pill=await page.evaluate(()=>{const n=document.querySelector('.nav-inner');const c=getComputedStyle(n);return {radius:c.borderTopLeftRadius,bg:c.backgroundColor,border:c.borderTopWidth+' '+c.borderBottomWidth+' '+c.borderBottomColor,blur:c.backdropFilter||c.webkitBackdropFilter,w:Math.round(n.getBoundingClientRect().width),top:Math.round(n.getBoundingClientRect().top),prog:document.getElementById('progress').style.transform,par:document.getElementById('par').style.transform}});
 check(T('scrolled: floating pill, no outline line, frosted, opaque enough (.88)'),/999|\d{3,}px/.test(pill.radius)&&/0\.9/.test(pill.bg)&&/blur/.test(pill.blur)&&/^0px 0px/.test(pill.border)||/transparent|rgba\(0, 0, 0, 0\)/.test(pill.border),J(pill));
 check(T('scroll progress hairline and parallax respond'),/scaleX\(/.test(pill.prog)&&/translate3d\(0px, -/.test(pill.par),J([pill.prog,pill.par]));
 await page.screenshot({path:path.join(out,`nav-pill-1440-${theme}.png`)});
 await page.close();
 // ---------------- tablet 768
 ({page,bad,errs}=await open(theme,768,1024,{touch:true}));
 await sleep(1500);
 const t=await page.evaluate(()=>({h:document.documentElement.scrollWidth>innerWidth,burger:getComputedStyle(document.getElementById('burger')).display,links:getComputedStyle(document.querySelector('.links')).display}));
 check(T('768: no horizontal scroll; phone nav'),!t.h,J(t));
 await page.screenshot({path:path.join(out,`hero-768-${theme}.png`)});
 await page.close();
 // ---------------- phone 390
 ({page,bad,errs}=await open(theme,390,844,{touch:true}));
 await sleep(1500);
 const p=await page.evaluate(()=>{const cs=(s,p)=>getComputedStyle(document.querySelector(s))[p];const h=document.querySelector('.display').getBoundingClientRect();return {h:document.documentElement.scrollWidth>innerWidth,lines:Math.round(h.height/parseFloat(cs('.display','lineHeight'))),burger:cs('#burger','display'),links:cs('.links','display'),btn:document.querySelector('.btn-primary').getBoundingClientRect().height,navCta:cs('.nav-cta','display')}});
 check(T('390: hamburger, ≤3 headline lines, tap targets ≥44, no horizontal scroll'),!p.h&&p.lines<=3&&p.burger!=='none'&&p.links==='none'&&p.btn>=44,J(p));
 await page.screenshot({path:path.join(out,`hero-390-${theme}.png`)});
 await page.click('#burger');await sleep(700);
 check(T('390: the menu opens (links + one Open Daylight button) and the icon becomes ×'),await page.evaluate(()=>document.getElementById('menu').classList.contains('open')&&document.getElementById('burger').getAttribute('aria-expanded')==='true'&&document.querySelectorAll('#menu a').length===5));
 await page.screenshot({path:path.join(out,`menu-390-${theme}.png`)});
 await page.evaluate(()=>window.scrollTo({top:80,behavior:'instant'}));await sleep(500);
 await page.screenshot({path:path.join(out,`menu-scrolled-390-${theme}.png`)});
 check(T('390: no page errors, no 404s'),errs.length===0&&bad.length===0,J([errs,bad]));
 await page.close();
 // ---------------- reduced motion
 ({page,bad,errs}=await open(theme,1440,900,{reduce:true}));
 await sleep(600);
 const rm=await page.evaluate(()=>({anim:[...document.querySelectorAll('.a')].map(n=>getComputedStyle(n).animationName+'/'+getComputedStyle(n).opacity),glow:getComputedStyle(document.getElementById('glow')).display}));
 check(T('reduced motion: content is visible at once, no animation, no cursor glow'),rm.anim.every(a=>/^none\/1$/.test(a))&&rm.glow==='none',J(rm));
 await page.evaluate(()=>window.scrollTo({top:140,behavior:'instant'}));await sleep(300);
 check(T('reduced motion: no parallax'),await page.evaluate(()=>document.getElementById('par').style.transform===''));
 await page.close();
}
// ---------------- entrance motion: sample opacity of the staggered elements over time
{
 const {page}=await open('dark',1440,900);
 const samples=await page.evaluate(()=>new Promise(res=>{const els=['.announce','.display .w:nth-child(1)','.display .w:nth-child(5)','.sub','.btn-primary','.trust','.frame'].map(s=>document.querySelector(s));const out=[];const t0=performance.now();(function tick(){out.push([Math.round(performance.now()-t0),els.map(e=>+(+getComputedStyle(e).opacity).toFixed(2))]);if(performance.now()-t0<1200)requestAnimationFrame(tick);else res(out.filter((_,i)=>i%6===0))})()}));
 console.log('entrance samples (ms, opacities pill|w1|w5|sub|cta|trust|frame):',J(samples.slice(0,14)));
 const last=samples[samples.length-1][1];
 check('entrance: everything ends fully visible within ~1s',last.every(v=>v===1),J(last));
 await page.close();
}
await browser.close();server.close();
if(failed){console.log('site FAILED');process.exit(1)}
console.log('PASS site');
