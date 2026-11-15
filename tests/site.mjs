/**
 * The homepage (Resend-style structure) and the legal pages, real pages over HTTP: both OS themes, three widths, banners above the nav
 * (colors from Admin), the scrolled glass pill, the drawn product mocks and their tabs, the mobile menu, reduced motion, the unchanged footer,
 * legal templates, no 404s, no horizontal scroll.
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
const BANNERS=[{id:'1',body:'Scheduled maintenance tonight at 9 PM Eastern',color:'#F02B2B',link:'https://example.com/status'},{id:'2',body:'A second banner',color:'#2BF0F0',link:null}];
async function open(theme,w,h,{reduce=false,touch=false,banners=BANNERS,rel=''}={}){
 const page=await browser.newPage();
 await page.setRequestInterception(true);
 const state={banners};
 page.on('request',r=>{if(/rpc\/daylight_landing_banner/.test(r.url())){const hd={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};if(r.method()==='OPTIONS')r.respond({status:204,headers:hd});else r.respond({status:200,contentType:'application/json',headers:hd,body:JSON.stringify(state.banners||[])})}else r.continue()});
 await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:touch,hasTouch:touch});
 await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]);
 const bad=[];page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});page.on('requestfailed',r=>{if(!/fonts\.g/.test(r.url()))bad.push('FAILED '+r.url())});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(url+rel,{waitUntil:'load'});
 return {page,bad,errs,state};
}
for(const theme of ['light','dark']){
 const T=s=>`${theme}: ${s}`;
 // ---------------- desktop 1440, with two banners posted
 let {page,bad,errs}=await open(theme,1440,900);
 const first=await page.evaluate(()=>({h1:getComputedStyle(document.querySelector('.display .w')).opacity,sub:getComputedStyle(document.querySelector('.sub')).opacity,btn:getComputedStyle(document.querySelector('.hero .ctas')).opacity,app:getComputedStyle(document.querySelector('.hero-visual')).opacity,t:Math.round(performance.now())}));
 check(T('hero is visible at first paint (headline, subcopy, buttons, app all opaque on the first frame)'),first.h1==='1'&&first.sub==='1'&&first.btn==='1'&&first.app==='1',J(first));
 await sleep(2200);
 await page.screenshot({path:path.join(out,`hero-1440-${theme}.png`)});
 const m=await page.evaluate(()=>{
  const r=s=>{const n=document.querySelector(s);if(!n)return null;const b=n.getBoundingClientRect();return {top:b.top+scrollY,bottom:b.bottom+scrollY,h:b.height,w:b.width,left:b.left}};
  const rows=[...document.querySelectorAll('.banner')].map(b=>({text:b.textContent.trim(),bg:getComputedStyle(b).backgroundColor,color:getComputedStyle(b).color,href:(b.querySelector('a')||{}).href||null,rel:(b.querySelector('a')||{}).rel||null}));
  const h1=document.querySelector('.display');
  return {banners:r('.banners'),nav:r('.nav-inner'),rows,h1:r('.display'),h1text:h1.getAttribute('aria-label'),h1font:getComputedStyle(h1).fontFamily.slice(0,20),h1op:getComputedStyle(h1.querySelector('.w')).opacity,
   hscroll:document.documentElement.scrollWidth>innerWidth,links:[...document.querySelectorAll('.links > a, .links .dd-trigger')].map(a=>a.getAttribute('href')),
   cta:document.querySelector('.nav-cta').getAttribute('href'),ctaText:document.querySelector('.nav-cta').textContent.trim(),navBtns:[...document.querySelectorAll('.nav .btn')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden'&&b.getBoundingClientRect().height>0&&!b.closest('.menu')).length,loginLink:/log in/i.test(document.querySelector('.nav').textContent)||/get started/i.test(document.querySelector('.nav').textContent),
   heroBtns:[...document.querySelectorAll('.hero .ctas a')].map(a=>a.getAttribute('href')),logo:document.querySelector('.brand').getAttribute('href'),
   cells:document.querySelectorAll('#heroApp .cal .d').length,today:document.querySelectorAll('#heroApp .n.today').length,evs:document.querySelectorAll('#heroApp .ev').length,
   visual:r('.hero-visual'),copy:r('.hero-copy')}});
 check(T('banners render ABOVE the nav, in order, with the colors, text and link the owner chose'),m.rows.length===2&&m.banners.bottom<=m.nav.top+1&&m.rows[0].text===BANNERS[0].body&&m.rows[0].bg==='rgb(240, 43, 43)'&&m.rows[0].href===BANNERS[0].link&&/noopener/.test(m.rows[0].rel)&&m.rows[1].bg==='rgb(43, 240, 240)'&&m.rows[1].href===null,J([m.rows,m.banners,m.nav.top]));
 check(T('banner text stays readable on its color (light text on red, dark on cyan)'),m.rows[0].color==='rgb(255, 255, 255)'&&m.rows[1].color==='rgb(17, 17, 17)',J(m.rows.map(r=>r.color)));
 check(T('nav is a 64px bar sitting right under the banners'),Math.round(m.nav.h)>=64&&Math.round(m.nav.h)<=65&&Math.abs(m.nav.top-m.banners.bottom)<=1,J([m.nav,m.banners]));
 check(T('hero: the Daylight headline in Inter like the rest of the app, words revealed; headline left, the app drawn on the right'),m.h1text==='Your calendar, minus the clutter.'&&/Inter/.test(m.h1font)&&m.h1op==='1'&&m.visual.left>m.copy.left+300,J([m.h1text,m.h1font,m.h1op,m.visual,m.copy]));
 check(T('hero app: a real month grid for this month with today marked and events in it'),m.cells>=28&&m.today===1&&m.evs>=10,J([m.cells,m.today,m.evs]));
 check(T('nav: logo to /, Features Sharing AI access FAQ, and exactly ONE button: Open Daylight to login/ (no Log in, no Get started)'),m.logo==='./'&&m.links.join()==='#features,#sharing,#ai,#faq'&&m.cta==='login/'&&m.ctaText==='Open Daylight'&&m.navBtns===1&&!m.loginLink,J(m));
 check(T('no horizontal scroll, no 404s, no page errors'),!m.hscroll&&bad.length===0&&errs.length===0,J([m.hscroll,bad,errs]));
 await page.evaluate(()=>window.scrollTo({top:20,behavior:'instant'}));await sleep(450);
 const early=await page.evaluate(()=>({scrolled:document.getElementById('nav').classList.contains('is-scrolled'),top:Math.round(document.querySelector('.nav-inner').getBoundingClientRect().top),bh:document.getElementById('banners').offsetHeight}));
 check(T('scrolled a little: the nav is still a bar under the banner (it moves up with the page)'),!early.scrolled&&early.top>0&&early.top<early.bh+1,J(early));
 await page.evaluate(()=>window.scrollTo({top:300,behavior:'instant'}));await sleep(500);
 const pill=await page.evaluate(()=>{const n=document.querySelector('.nav-inner');const c=getComputedStyle(n);return {scrolled:document.getElementById('nav').classList.contains('is-scrolled'),radius:c.borderTopLeftRadius,bg:c.backgroundColor,borderW:c.borderTopWidth+' '+c.borderRightWidth+' '+c.borderBottomWidth+' '+c.borderLeftWidth,blur:c.backdropFilter||c.webkitBackdropFilter,top:Math.round(n.getBoundingClientRect().top),w:Math.round(n.getBoundingClientRect().width),shadow:c.boxShadow!=='none',wm:getComputedStyle(document.querySelector('.wordmark')).color}});
 const alpha=(c=>{const m=/rgba?\(([^)]+)\)/.exec(c||'');if(!m)return 1;const p=m[1].split(',').map(x=>parseFloat(x));return p.length>3?p[3]:1})(pill.bg);
 const wantText=theme==='dark'?'rgb(224, 224, 224)':'rgb(23, 23, 23)';
 check(T('past the banner: a floating rounded glass pill (blurred, shadowed, no outline), text in the theme colors'),pill.scrolled&&/\d{3,}px/.test(pill.radius)&&alpha>0.4&&alpha<0.9&&/blur\((2\d|3\d)px\)/.test(pill.blur)&&pill.borderW==='0px 0px 0px 0px'&&pill.shadow&&pill.top>=8&&pill.w<1000&&pill.wm===wantText,J([pill,alpha,wantText]));
 {
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await sleep(300);
  const ch=[];
  for(const y of [0,40,90,120,160,200,260]){await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);await sleep(380);ch.push(await page.evaluate(()=>{const c=document.querySelector('.pill-chip').getBoundingClientRect(),n=document.querySelector('.nav-inner').getBoundingClientRect();const overlap=c.top<n.bottom&&c.bottom>n.top;return {overlap,op:parseFloat(getComputedStyle(document.querySelector('.pill-chip')).opacity)}}))}
  check(T('the announcement chip never sits half-covered by the nav: whenever they overlap it has faded out'),ch.every(c=>!c.overlap||c.op<0.05),J(ch));
 }
 check(T('there is no scroll progress bar at the top'),await page.evaluate(()=>!document.getElementById('progress')&&!document.querySelector('.progress')));
 await page.screenshot({path:path.join(out,`nav-pill-1440-${theme}.png`)});
 await page.close();
 // ---------------- no banners / live updates
 {
  const none=await open(theme,1440,900,{banners:[]});await sleep(1200);
  const nb=await none.page.evaluate(()=>({empty:document.getElementById('banners').offsetHeight===0,navTop:Math.round(document.querySelector('.nav-inner').getBoundingClientRect().top),vis:getComputedStyle(document.querySelector('.hero-copy')).opacity}));
  check(T('no banner posted: nothing above the nav'),nb.empty&&nb.navTop===0,J(nb));
  none.state.banners=[{id:'9',body:'Fresh banner',color:'#111111',link:null}];
  await none.page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await sleep(700);
  const added=await none.page.evaluate(()=>[...document.querySelectorAll('.banner')].map(b=>b.textContent.trim()+'|'+getComputedStyle(b).backgroundColor));
  none.state.banners=[{id:'9',body:'Fresh banner',color:'#2B6BF0',link:null}];
  await none.page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await sleep(700);
  const edited=await none.page.evaluate(()=>[...document.querySelectorAll('.banner')].map(b=>b.textContent.trim()+'|'+getComputedStyle(b).backgroundColor));
  none.state.banners=[];
  await none.page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await sleep(700);
  const gone=await none.page.evaluate(()=>document.querySelectorAll('.banner').length);
  check(T('a banner posted later shows up, an edit changes its color, and deleting it removes it (no stale banner)'),added.join()==='Fresh banner|rgb(17, 17, 17)'&&edited.join()==='Fresh banner|rgb(43, 107, 240)'&&gone===0,J([added,edited,gone]));
  await none.page.close();
 }
 // ---------------- the whole page
 ({page,bad,errs}=await open(theme,1440,900));
 await sleep(800);
 const total=await page.evaluate(()=>document.documentElement.scrollHeight);
 for(let y=0;y<total;y+=500){await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);await sleep(110)}
 const full=await page.evaluate(()=>{
  const ids=['features','sharing','ai','themes','faq'];
  const hrefs=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
  const anchors=hrefs.filter(h=>h.startsWith('#')&&h.length>1);
  const f=document.querySelector('.footer'),fc=getComputedStyle(f);
  return {ids:ids.map(i=>!!document.getElementById(i)),anchorsOk:anchors.every(h=>!!document.querySelector(h)),pages:[...new Set(hrefs.filter(h=>/^(login|sign-up|privacy|tos)\/$/.test(h)))],
   hscroll:document.documentElement.scrollWidth>innerWidth,placeholders:/screenshot goes here/i.test(document.body.innerText),
   fakeSocial:/testimonial|customers|trusted by|rated/i.test(document.body.innerText),
   footerBg:fc.backgroundColor,footerHeads:[...document.querySelectorAll('.foot-cols h3')].map(n=>n.textContent),footerLinks:[...document.querySelectorAll('.foot-cols a')].map(a=>a.textContent),
   copy:document.querySelector('.foot-bar').textContent.trim(),footLine:document.querySelector('.foot-line').textContent,socials:document.querySelectorAll('.footer svg').length,status:/operational/i.test(f.textContent),
   grid:document.querySelectorAll('.fgi').length,tiles:document.querySelectorAll('.tile').length,marq:document.querySelectorAll('.mq').length,faq:document.querySelectorAll('.faq-item').length,
   reveal:[...document.querySelectorAll('.reveal')].every(n=>n.classList.contains('in')),watermark:!!document.querySelector('.watermark'),pills:document.querySelectorAll('.pl,.pills').length,rows:[...document.querySelectorAll('.cal')].map(c=>{const last=[...c.querySelectorAll('.d')].pop().getBoundingClientRect();let n=c.parentElement;while(n&&!/hidden|clip/.test(getComputedStyle(n).overflowY))n=n.parentElement;return Math.round(n.getBoundingClientRect().bottom-last.bottom)})}});
 check(T('no half-cut watermark; the themes line is plain text, not a control; every month grid has room under its last week row'),!full.watermark&&full.pills===0&&full.rows.length>=4&&full.rows.every(g=>g>=8),J([full.watermark,full.pills,full.rows]));
 check(T('every section anchor resolves (#features #sharing #ai #themes #faq) and every in-page link has a target'),full.ids.every(Boolean)&&full.anchorsOk,J(full));
 check(T('page links point at real pages (login, sign-up, privacy, tos)'),full.pages.length===4,J(full.pages));
 check(T('footer is unchanged: '+(theme==='dark'?'black (#0A0A0A)':'white')),full.footerBg===(theme==='dark'?'rgb(10, 10, 10)':'rgb(255, 255, 255)'),full.footerBg);
 check(T('footer: Product, Explore, Legal columns with the same links; one-liner; copyright; no socials or status pill'),full.footerHeads.join()==='Product,Explore,Legal'&&full.footerLinks.join()==='Open Daylight,Features,AI access,Sharing,Themes,FAQ,Privacy,Terms'&&full.footLine==='Your calendar, minus the clutter.'&&full.copy==='© 2026 Daylight. All rights reserved.'&&full.socials===0&&!full.status,J(full));
 check(T('no empty "screenshot goes here" frames, no social proof, no horizontal scroll, everything revealed'),!full.placeholders&&!full.fakeSocial&&!full.hscroll&&full.reveal,J([full.placeholders,full.fakeSocial,full.hscroll,full.reveal]));
 check(T('sections: 3x3 feature grid, glossy icon tiles, small-card marquee, five FAQ items'),full.grid===9&&full.tiles>=4&&full.marq>=6&&full.faq===5,J([full.grid,full.tiles,full.marq,full.faq]));
 // views tabs
 await page.evaluate(()=>document.getElementById('features').scrollIntoView());await sleep(500);
 const views={};
 for(const v of ['month','week','day','agenda','tasks']){
  await page.click(`.tab[data-v="${v}"]`);await sleep(200);
  views[v]=await page.evaluate(()=>({sel:document.querySelector('.tab[aria-selected="true"]').dataset.v,name:document.getElementById('viewName').textContent,len:document.getElementById('viewBody').innerText.length,cells:document.querySelectorAll('#vGrid .d').length}));
 }
 check(T('views panel: Month, Week, Day, Agenda and Tasks each draw their own content'),Object.entries(views).every(([k,v])=>v.sel===k&&v.name.toLowerCase()===k&&v.len>20)&&views.month.cells===0===false||views.month.cells>=28,J(views));
 // AI tabs
 await page.evaluate(()=>document.getElementById('ai').scrollIntoView());await sleep(500);
 const ai={};
 for(const k of ['connect','permissions','activity']){
  await page.click(`.ftab[data-a="${k}"]`);await sleep(200);
  ai[k]=await page.evaluate(()=>({sel:document.querySelector('.ftab[aria-selected="true"]').dataset.a,txt:document.getElementById('aiBody').innerText.length}));
 }
 check(T('AI access window: connect, permissions and activity tabs switch the content'),Object.entries(ai).every(([k,v])=>v.sel===k&&v.txt>20),J(ai));
 await page.evaluate(()=>window.scrollTo({top:document.getElementById('faq').offsetTop,behavior:'instant'}));await sleep(500);
 await page.click('.faq-item summary');await sleep(250);
 check(T('FAQ items open'),await page.evaluate(()=>document.querySelector('.faq-item').open));
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await sleep(400);
 await page.hover('.dd-trigger');await sleep(500);
 const ddo=await page.evaluate(()=>{const p=getComputedStyle(document.getElementById('ddPanel'));const m=/rgba?\(([^)]+)\)/.exec(p.backgroundColor);const a=m?(m[1].split(',').length>3?parseFloat(m[1].split(',')[3]):1):1;return {open:document.getElementById('dd').classList.contains('open'),items:document.querySelectorAll('.dd-item').length,cards:document.querySelectorAll('.dd-card').length,alpha:a}});
 check(T('Features dropdown: solid panel, four items and two featured cards'),ddo.open&&ddo.items===4&&ddo.cards===2&&ddo.alpha===1,J(ddo));
 await page.click('.dd-trigger');await sleep(300);
 check(T('clicking Features keeps the menu open (it does not close the menu that hover just opened)'),await page.evaluate(()=>document.getElementById('dd').classList.contains('open')));
 await page.screenshot({path:path.join(out,`dropdown-1440-${theme}.png`)});
 await page.keyboard.press('Escape');await sleep(400);
 check(T('Escape closes the dropdown'),await page.evaluate(()=>!document.getElementById('dd').classList.contains('open')));
 check(T('full page: no 404s, no errors'),bad.length===0&&errs.length===0,J([bad,errs]));
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await sleep(500);
 await page.screenshot({path:path.join(out,`page-full-1440-${theme}.png`),fullPage:true});
 await page.close();
 // ---------------- the Daylight logo: homepage when signed out, dashboard when signed in
 {
  const lo=await open(theme,1440,900,{rel:'privacy/'});await sleep(600);
  await lo.page.click('.nav .brand');await sleep(700);
  check(T('signed out: the nav logo on a legal page goes to the homepage'),new URL(lo.page.url()).pathname==='/','');
  await lo.page.evaluate(()=>localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify({access_token:'t',refresh_token:'r',user:{id:'u'}})));
  await lo.page.goto(url+'privacy/',{waitUntil:'load'});await sleep(500);
  const seen=[];lo.page.on('framenavigated',f=>seen.push(new URL(f.url()).pathname));
  await lo.page.click('.nav .brand');await sleep(1200);
  check(T('signed in: the nav logo goes to the dashboard (the stand-in session is then refused by the real server, which is why the page ends on /login)'),seen.includes('/dashboard/'),J(seen));
  await lo.page.close();
  const lf=await open(theme,1440,900);await sleep(600);
  await lf.page.evaluate(()=>localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify({access_token:'t',refresh_token:'r',user:{id:'u'}})));
  await lf.page.goto(url,{waitUntil:'load'});await sleep(500);
  const seen2=[];lf.page.on('framenavigated',f=>seen2.push(new URL(f.url()).pathname));
  await lf.page.evaluate(()=>document.querySelector('.footer .brand').click());await sleep(1200);
  check(T('signed in: the footer logo goes to the dashboard as well'),seen2.includes('/dashboard/'),J(seen2));
  await lf.page.close();
 }
 // ---------------- legal pages
 for(const [rel,count,title] of [['privacy/',11,'Privacy Policy'],['tos/',17,'Terms of Service']]){
  ({page,bad,errs}=await open(theme,1440,900,{rel}));await sleep(700);
  const lg=await page.evaluate(()=>({h1:document.querySelector('h1').textContent,eff:document.querySelector('.eff').textContent,secs:[...document.querySelectorAll('.legal section')].map(s=>s.querySelector('h2').textContent+'|'+s.querySelector('p').textContent),intro:!!document.querySelector('.intro'),cta:(document.querySelector('.nav-cta')||{getAttribute:()=>null}).getAttribute('href'),navBtns:[...document.querySelectorAll('.nav .btn')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden'&&b.getBoundingClientRect().height>0&&!b.closest('.menu')).length,footer:!!document.querySelector('.footer'),print:[...document.styleSheets].some(ss=>{try{return [...ss.cssRules].some(r=>r.type===CSSRule.MEDIA_RULE&&/print/.test(r.conditionText||r.media.mediaText))}catch(e){return false}}),hscroll:document.documentElement.scrollWidth>innerWidth,footerBg:getComputedStyle(document.querySelector('.footer')).backgroundColor}));
  check(T(`/${rel}: title, effective placeholder, intro, ${count} numbered sections each with only the shell line`),lg.h1===title&&lg.eff==='Effective: [EFFECTIVE DATE]'&&lg.intro&&lg.secs.length===count&&lg.secs.every((s,i)=>s.startsWith((i+1)+'. ')&&s.endsWith('|Content for this section will be added in the legal pages job.')),J([lg.h1,lg.eff,lg.secs.length]));
  check(T(`/${rel}: same nav (one Open Daylight button) and footer, a print stylesheet, no horizontal scroll, no errors`),lg.cta==='../login/'&&lg.navBtns===1&&lg.footer&&lg.print&&!lg.hscroll&&bad.length===0&&errs.length===0&&lg.footerBg===(theme==='dark'?'rgb(10, 10, 10)':'rgb(255, 255, 255)'),J([lg.cta,lg.navBtns,lg.footer,lg.print,lg.hscroll,bad,errs,lg.footerBg]));
  await page.screenshot({path:path.join(out,`${rel.replace('/','')}-1440-${theme}.png`),fullPage:false});
  await page.close();
 }
 // ---------------- tablet 768 and phone 390
 ({page,bad,errs}=await open(theme,768,1024,{touch:true}));await sleep(1800);
 check(T('768: no horizontal scroll'),!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
 await page.screenshot({path:path.join(out,`hero-768-${theme}.png`)});
 await page.close();
 ({page,bad,errs}=await open(theme,390,844,{touch:true}));await sleep(1800);
 const p=await page.evaluate(()=>{const cs=(s,p)=>getComputedStyle(document.querySelector(s))[p];return {h:document.documentElement.scrollWidth>innerWidth,burger:cs('#burger','display'),links:cs('.links','display'),btn:document.querySelector('.hero .btn').getBoundingClientRect().height,banners:document.querySelectorAll('.banner').length}});
 check(T('390: hamburger, banners on top, tap targets ≥44, no horizontal scroll'),!p.h&&p.burger!=='none'&&p.links==='none'&&p.btn>=44&&p.banners===2,J(p));
 await page.screenshot({path:path.join(out,`hero-390-${theme}.png`)});
 await page.click('#burger');await sleep(700);
 check(T('390: the menu opens with the links and the one Open Daylight button, and the icon becomes ×'),await page.evaluate(()=>document.getElementById('menu').classList.contains('open')&&document.getElementById('burger').getAttribute('aria-expanded')==='true'&&document.querySelectorAll('#menu a').length===5));
 await page.screenshot({path:path.join(out,`menu-390-${theme}.png`)});
 await page.evaluate(()=>window.scrollTo({top:200,behavior:'instant'}));await sleep(500);
 await page.screenshot({path:path.join(out,`menu-scrolled-390-${theme}.png`)});
 check(T('390: no page errors, no 404s'),errs.length===0&&bad.length===0,J([errs,bad]));
 await page.close();
 // ---------------- reduced motion
 ({page,bad,errs}=await open(theme,1440,900,{reduce:true}));await sleep(600);
 const rm=await page.evaluate(()=>({a:[...document.querySelectorAll('.a')].map(n=>getComputedStyle(n).opacity),w:[...document.querySelectorAll('.w')].map(n=>getComputedStyle(n).opacity+'/'+getComputedStyle(n).filter),rev:[...document.querySelectorAll('.reveal')].map(n=>getComputedStyle(n).opacity),loops:[...document.querySelectorAll('.track,.tile,.f1')].map(n=>getComputedStyle(n).animationName)}));
 check(T('reduced motion: content visible at once, nothing loops'),rm.a.every(x=>x==='1')&&rm.w.every(x=>x==='1/none')&&rm.rev.every(x=>x==='1')&&rm.loops.every(x=>x==='none'),J(rm));
 await page.close();
}
await browser.close();server.close();
if(failed){console.log('site FAILED');process.exit(1)}
console.log('PASS site');
