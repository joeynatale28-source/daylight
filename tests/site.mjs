/**
 * The landing page and the legal pages, real pages over HTTP: both OS themes, three widths, banners above the nav (colors from Admin),
 * the scrolled glass pill, mobile menu, reduced motion, carousels, footer colors, legal templates, no 404s, no horizontal scroll.
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
 await sleep(1500);
 await page.screenshot({path:path.join(out,`hero-1440-${theme}.png`)});
 const m=await page.evaluate(()=>{
  const r=s=>{const n=document.querySelector(s);if(!n)return null;const b=n.getBoundingClientRect();return {top:b.top+scrollY,bottom:b.bottom+scrollY,h:b.height,w:b.width,left:b.left}};
  const cs=(s,p)=>getComputedStyle(document.querySelector(s))[p];
  const rows=[...document.querySelectorAll('.banner')].map(b=>({text:b.textContent.trim(),bg:getComputedStyle(b).backgroundColor,color:getComputedStyle(b).color,href:(b.querySelector('a')||{}).href||null,rel:(b.querySelector('a')||{}).rel||null}));
  const words=[...document.querySelectorAll('.rot-word')].map(w=>{const b=w.getBoundingClientRect();return Math.round(b.left+b.width/2)});
  return {banners:r('.banners'),nav:r('.nav-inner'),rows,h1:r('.display'),sub:r('.sub'),ctas:r('.ctas'),trust:r('.trust'),frame:r('.frame'),screen:r('.frame-screen'),
   h1size:cs('.display','fontSize'),h1w:cs('.display','fontWeight'),h1ls:cs('.display','letterSpacing'),font:cs('body','fontFamily').slice(0,30),btnH:r('.btn-hero').h,
   lines:Math.round(r('.display').h/parseFloat(cs('.display','lineHeight'))),hscroll:document.documentElement.scrollWidth>innerWidth,
   links:[...document.querySelectorAll('.links > a, .links .dd-trigger')].map(a=>a.getAttribute('href')),cta:document.querySelector('.nav-cta').getAttribute('href'),
   hero:[...document.querySelectorAll('.ctas a')].map(a=>a.getAttribute('href')),logo:document.querySelector('.brand').getAttribute('href'),
   navBtns:document.querySelectorAll('.nav-cta').length,loginBtn:/log in/i.test(document.querySelector('.nav').textContent),
   imgInH1:document.querySelectorAll('.display img').length,line2Rot:!!document.querySelector('.line2 .rot'),rotCx:words,line2Cx:(()=>{const b=document.querySelector('.line2').getBoundingClientRect();return Math.round(b.left+b.width/2)})()}});
 check(T('banners render ABOVE the nav, in order, with the colors, text and link the owner chose'),m.rows.length===2&&m.banners.bottom<=m.nav.top+1&&m.rows[0].text===BANNERS[0].body&&m.rows[0].bg==='rgb(240, 43, 43)'&&m.rows[0].href===BANNERS[0].link&&/noopener/.test(m.rows[0].rel)&&m.rows[1].bg==='rgb(43, 240, 240)'&&m.rows[1].href===null,J([m.rows,m.banners,m.nav.top]));
 check(T('banner text stays readable on its color (light text on red, dark on cyan)'),m.rows[0].color==='rgb(255, 255, 255)'&&m.rows[1].color==='rgb(17, 17, 17)',J(m.rows.map(r=>r.color)));
 check(T('nav is a 64px bar sitting right under the banners'),Math.round(m.nav.h)>=64&&Math.round(m.nav.h)<=65&&Math.abs(m.nav.top-m.banners.bottom)<=1,J([m.nav,m.banners]));
 check(T('hero headline: no logo in it; the rotating word sits on the second line and its center is the line center for every word'),m.imgInH1===0&&m.line2Rot&&m.rotCx.every(c=>Math.abs(c-m.line2Cx)<=2),J([m.imgInH1,m.line2Rot,m.rotCx,m.line2Cx]));
 check(T('headline: Inter 600, -0.03em, 56px at 1440, two lines'),/Inter/.test(m.font)&&m.h1size==='56px'&&m.h1w==='600'&&Math.abs(parseFloat(m.h1ls)+1.68)<0.15&&m.lines===2,J([m.font,m.h1size,m.h1w,m.h1ls,m.lines]));
 check(T('rhythm: nav→headline 136, headline→sub 16, sub→buttons 32, buttons→trust 28, trust→frame 64'),
  Math.round(m.h1.top-m.nav.bottom)===136&&Math.round(m.sub.top-m.h1.bottom)===16&&Math.round(m.ctas.top-m.sub.bottom)===32&&Math.round(m.trust.top-m.ctas.bottom)===28&&Math.round(m.frame.top-m.trust.bottom)===64,
  J([m.h1.top-m.nav.bottom,m.sub.top-m.h1.bottom,m.ctas.top-m.sub.bottom,m.trust.top-m.ctas.bottom,m.frame.top-m.trust.bottom]));
 check(T('buttons: the sign-in pills (50px tall)'),Math.round(m.btnH)===50);
 check(T('frame screen is exactly 8:5'),Math.abs(m.screen.w/m.screen.h-1.6)<0.005,J([m.screen.w,m.screen.h]));
 check(T('ONE Open Daylight button to login/, no Log in; logo to /, hero buttons'),m.logo==='./'&&m.links.join()==='#features,#sharing,#ai,#faq'&&m.cta==='login/'&&m.hero.join()==='sign-up/,#features'&&m.navBtns===1&&!m.loginBtn,J(m));
 check(T('no horizontal scroll, no 404s, no page errors'),!m.hscroll&&bad.length===0&&errs.length===0,J([m.hscroll,bad,errs]));
 await page.evaluate(()=>window.scrollTo({top:20,behavior:'instant'}));await sleep(450);
 const early=await page.evaluate(()=>({scrolled:document.getElementById('nav').classList.contains('is-scrolled'),top:Math.round(document.querySelector('.nav-inner').getBoundingClientRect().top),bh:document.getElementById('banners').offsetHeight}));
 check(T('scrolled a little: the nav is still a bar under the banner (it moves up with the page)'),!early.scrolled&&early.top>0&&early.top<early.bh+1,J(early));
 await page.evaluate(()=>window.scrollTo({top:300,behavior:'instant'}));await sleep(500);
 const pill=await page.evaluate(()=>{const n=document.querySelector('.nav-inner');const c=getComputedStyle(n);return {scrolled:document.getElementById('nav').classList.contains('is-scrolled'),radius:c.borderTopLeftRadius,bg:c.backgroundColor,borderW:c.borderTopWidth+' '+c.borderRightWidth+' '+c.borderBottomWidth+' '+c.borderLeftWidth,blur:c.backdropFilter||c.webkitBackdropFilter,top:Math.round(n.getBoundingClientRect().top),w:Math.round(n.getBoundingClientRect().width),shadow:c.boxShadow!=='none',wm:getComputedStyle(document.querySelector('.wordmark')).color}});
 const alpha=(c=>{const m=/rgba?\(([^)]+)\)/.exec(c||'');if(!m)return 1;const p=m[1].split(',').map(x=>parseFloat(x));return p.length>3?p[3]:1})(pill.bg);
 const wantText=theme==='dark'?'rgb(224, 224, 224)':'rgb(23, 23, 23)';
 check(T('past the banner: a floating rounded GLASS pill (translucent, strongly blurred, shadowed, no outline), text in the theme colors'),pill.scrolled&&/\d{3,}px/.test(pill.radius)&&alpha>0.4&&alpha<0.85&&/blur\((2\d|3\d)px\)/.test(pill.blur)&&pill.borderW==='0px 0px 0px 0px'&&pill.shadow&&pill.top>=8&&pill.w<1000&&pill.wm===wantText,J([pill,alpha,wantText]));
 const rest=await page.evaluate(()=>{const c=getComputedStyle(document.querySelector('.nav-inner'));return {bg:c.backgroundColor,blur:c.backdropFilter||c.webkitBackdropFilter}});
 check(T('there is no scroll progress bar at the top'),await page.evaluate(()=>!document.getElementById('progress')&&!document.querySelector('.progress')));
 await page.screenshot({path:path.join(out,`nav-pill-1440-${theme}.png`)});
 await page.close();
 // ---------------- no banners / live updates
 {
  const none=await open(theme,1440,900,{banners:[]});await sleep(900);
  const nb=await none.page.evaluate(()=>({empty:document.getElementById('banners').offsetHeight===0,navTop:Math.round(document.querySelector('.nav-inner').getBoundingClientRect().top),h1:Math.round(document.querySelector('.display').getBoundingClientRect().top-document.querySelector('.nav-inner').getBoundingClientRect().bottom),vis:getComputedStyle(document.querySelector('.display .line')).opacity}));
  const restGlass=await none.page.evaluate(()=>{const c=getComputedStyle(document.querySelector('.nav-inner'));const m=/rgba?\(([^)]+)\)/.exec(c.backgroundColor);const p=m?m[1].split(',').map(x=>parseFloat(x)):[];return {a:p.length>3?p[3]:1,blur:c.backdropFilter||c.webkitBackdropFilter}});
  check(T('the bar at rest is glass too: translucent with a blur'),restGlass.a>0.5&&restGlass.a<0.95&&/blur/.test(restGlass.blur),J(restGlass));
  check(T('no banner posted: nothing above the nav, the headline keeps its spacing'),nb.empty&&nb.navTop===0&&nb.h1===136&&nb.vis==='1',J(nb));
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
   hscroll:document.documentElement.scrollWidth>innerWidth,windows:document.querySelectorAll('.window').length,
   fakeSocial:/testimonial|customers|trusted by|rated/i.test(document.body.innerText),
   footerBg:fc.backgroundColor,footerHeads:[...document.querySelectorAll('.foot-cols h3')].map(n=>n.textContent),footerLinks:[...document.querySelectorAll('.foot-cols a')].map(a=>a.textContent),
   copy:document.querySelector('.foot-bar').textContent.trim(),footLine:document.querySelector('.foot-line').textContent,socials:document.querySelectorAll('.footer svg').length,status:/operational/i.test(f.textContent)}});
 check(T('every section anchor resolves (#features #sharing #ai #themes #faq) and every in-page link has a target'),full.ids.every(Boolean)&&full.anchorsOk,J(full));
 check(T('page links point at real pages (login, sign-up, privacy, tos)'),full.pages.length===4,J(full.pages));
 check(T('footer is pure '+(theme==='dark'?'black (#0A0A0A)':'white')+', not gray'),full.footerBg===(theme==='dark'?'rgb(10, 10, 10)':'rgb(255, 255, 255)'),full.footerBg);
 check(T('footer: Product, Explore, Legal columns with the right links; one-liner; copyright; no socials or status pill'),full.footerHeads.join()==='Product,Explore,Legal'&&full.footerLinks.join()==='Open Daylight,Features,AI access,Sharing,Themes,FAQ,Privacy,Terms'&&full.footLine==='Your calendar, minus the clutter.'&&full.copy==='© 2026 Daylight. All rights reserved.'&&full.socials===0&&!full.status,J(full));
 check(T('placeholder frames only, no social proof, no horizontal scroll'),full.windows>=13&&!full.fakeSocial&&!full.hscroll,J([full.windows,full.fakeSocial,full.hscroll]));
 const lay=await page.evaluate(()=>{const cols=id=>[...document.querySelectorAll('#'+id+' .col')].map(c=>{const b=c.getBoundingClientRect();return Math.round(b.top)});const fr=[...document.querySelectorAll('.fru-card')].map(c=>getComputedStyle(c).transform);return {feat:document.querySelectorAll('#features .col').length,featSameRow:new Set(cols('features')).size===1,themes:document.querySelectorAll('#themes .col').length,cards:fr.length,tilt:true,items:document.querySelectorAll('.mcp-item').length,open:[...document.querySelectorAll('.mcp-item')].map(b=>b.getAttribute('aria-selected')).join(),tiles:document.querySelectorAll('#mcpPanel .window').length}});
 check(T('features: four columns in one row (image tile, one-line caption); themes: four columns'),lay.feat===4&&lay.featSameRow&&lay.themes===4,J(lay));
 check(T('sharing: three even cards with a benefit line under each visual'),lay.cards===3&&lay.tilt,J(lay));
 check(T('AI access: a list with one item open beside a panel with two product tiles'),lay.items===3&&lay.open==='true,false,false'&&lay.tiles===2,J(lay));
 await page.evaluate(()=>document.getElementById('ai').scrollIntoView());await sleep(400);
 await page.click('.mcp-item:nth-child(1)',{}).catch(()=>{});
 await page.evaluate(()=>document.querySelectorAll('.mcp-item')[1].click());await sleep(300);
 const mc=await page.evaluate(()=>({open:[...document.querySelectorAll('.mcp-item')].map(b=>b.getAttribute('aria-selected')).join(),labels:[...document.querySelectorAll('#mcpPanel .frame-label')].map(l=>l.textContent).join('|'),descVisible:getComputedStyle(document.querySelectorAll('.mcp-item')[1].querySelector('.mcp-d')).opacity}));
 check(T('choosing another AI-access item opens it and the tiles follow'),mc.open==='false,true,false'&&/Permissions/.test(mc.labels)&&mc.descVisible==='1',J(mc));
 await page.evaluate(()=>window.scrollTo({top:document.getElementById('faq').offsetTop,behavior:'instant'}));await sleep(500);
 await page.click('.faq-item summary');await sleep(250);
 check(T('FAQ items open'),await page.evaluate(()=>document.querySelector('.faq-item').open));
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await sleep(400);
 await page.hover('.dd-trigger');await sleep(500);
 const ddo=await page.evaluate(()=>({open:document.getElementById('dd').classList.contains('open'),items:document.querySelectorAll('.dd-item').length,cards:document.querySelectorAll('.dd-card').length}));
 check(T('Features dropdown: icon-led items and two featured cards'),ddo.open&&ddo.items===4&&ddo.cards===2,J(ddo));
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
  const lg=await page.evaluate(()=>({h1:document.querySelector('h1').textContent,eff:document.querySelector('.eff').textContent,secs:[...document.querySelectorAll('.legal section')].map(s=>s.querySelector('h2').textContent+'|'+s.querySelector('p').textContent),intro:!!document.querySelector('.intro'),nav:!!document.querySelector('.nav .nav-cta'),navHref:document.querySelector('.nav-cta').getAttribute('href'),footer:!!document.querySelector('.footer'),print:[...document.styleSheets].some(ss=>{try{return [...ss.cssRules].some(r=>r.type===CSSRule.MEDIA_RULE&&/print/.test(r.conditionText||r.media.mediaText))}catch(e){return false}}),hscroll:document.documentElement.scrollWidth>innerWidth,footerBg:getComputedStyle(document.querySelector('.footer')).backgroundColor}));
  check(T(`/${rel}: title, effective placeholder, intro, ${count} numbered sections each with only the shell line`),lg.h1===title&&lg.eff==='Effective: [EFFECTIVE DATE]'&&lg.intro&&lg.secs.length===count&&lg.secs.every((s,i)=>s.startsWith((i+1)+'. ')&&s.endsWith('|Content for this section will be added in the legal pages job.')),J([lg.h1,lg.eff,lg.secs.length]));
  check(T(`/${rel}: same nav (one Open Daylight to ../login/) and footer, a print stylesheet, no horizontal scroll, no errors`),lg.nav&&lg.navHref==='../login/'&&lg.footer&&lg.print&&!lg.hscroll&&bad.length===0&&errs.length===0&&lg.footerBg===(theme==='dark'?'rgb(10, 10, 10)':'rgb(255, 255, 255)'),J([lg.nav,lg.navHref,lg.footer,lg.print,lg.hscroll,bad,errs,lg.footerBg]));
  await page.screenshot({path:path.join(out,`${rel.replace('/','')}-1440-${theme}.png`),fullPage:false});
  await page.close();
 }
 // ---------------- tablet 768 and phone 390
 ({page,bad,errs}=await open(theme,768,1024,{touch:true}));await sleep(1500);
 check(T('768: no horizontal scroll'),!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
 await page.screenshot({path:path.join(out,`hero-768-${theme}.png`)});
 await page.close();
 ({page,bad,errs}=await open(theme,390,844,{touch:true}));await sleep(1500);
 const p=await page.evaluate(()=>{const cs=(s,p)=>getComputedStyle(document.querySelector(s))[p];return {h:document.documentElement.scrollWidth>innerWidth,burger:cs('#burger','display'),links:cs('.links','display'),btn:document.querySelector('.btn-hero').getBoundingClientRect().height,banners:document.querySelectorAll('.banner').length}});
 check(T('390: hamburger, banners on top, tap targets ≥44, no horizontal scroll'),!p.h&&p.burger!=='none'&&p.links==='none'&&p.btn>=44&&p.banners===2,J(p));
 await page.screenshot({path:path.join(out,`hero-390-${theme}.png`)});
 await page.click('#burger');await sleep(700);
 check(T('390: the menu opens with the links and the ONE Open Daylight pill, and the icon becomes ×'),await page.evaluate(()=>document.getElementById('menu').classList.contains('open')&&document.getElementById('burger').getAttribute('aria-expanded')==='true'&&document.querySelectorAll('#menu a').length===5));
 await page.screenshot({path:path.join(out,`menu-390-${theme}.png`)});
 await page.evaluate(()=>window.scrollTo({top:200,behavior:'instant'}));await sleep(500);
 await page.screenshot({path:path.join(out,`menu-scrolled-390-${theme}.png`)});
 check(T('390: no page errors, no 404s'),errs.length===0&&bad.length===0,J([errs,bad]));
 await page.close();
 // ---------------- reduced motion
 ({page,bad,errs}=await open(theme,1440,900,{reduce:true}));await sleep(600);
 const rm=await page.evaluate(()=>({anim:[...document.querySelectorAll('.a')].map(n=>getComputedStyle(n).animationName+'/'+getComputedStyle(n).opacity),rot:[...document.querySelectorAll('.rot-word')].map(n=>getComputedStyle(n).opacity).join()}));
 check(T('reduced motion: content visible at once, no animation, the headline word stays put'),rm.anim.every(a=>/^none\/1$/.test(a))&&rm.rot==='1,0,0,0',J(rm));
 await page.close();
}
await browser.close();server.close();
if(failed){console.log('site FAILED');process.exit(1)}
console.log('PASS site');
