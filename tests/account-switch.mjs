/**
 * Item 7 on the real page: account A signs in, opens Settings, signs out through the account menu, account B signs in,
 * then A again. At EVERY step (including the instant after each switch, while data loads) nothing from the other account
 * may be on screen, Settings must be closed after a sign-in, and the app lands on the normal calendar view.
 * Two accounts are simulated at the client boundary (the page's own sign-in/out code runs for real).
 * LIVE_URL=<deployed build> runs the same cycle against the deployed page (still with the stand-in accounts).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','account-switch');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

const A={id:'00000000-0000-4000-8000-0000000000aa',email:'alex.rivera@example.com',user_metadata:{full_name:'Alex Rivera'}};
const B={id:'00000000-0000-4000-8000-0000000000bb',email:'blake.chen@example.org',user_metadata:{full_name:'Blake Chen'}};
const payloadFor=(name,calName,evTitle)=>{const p=busyPayload();p.calendars=[{id:'c9',name:calName,color:'blue'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];
 p.events=[{id:1,cal:'c9',title:evTitle,start:new Date(2026,10,10,10).toISOString(),end:new Date(2026,10,10,11).toISOString(),allDay:false,loc:'',desc:''}];p.settings={themeMode:'system',avatarUrl:''};return p};

/** Everything on the page that could name an account, gathered as text (hidden parts included). */
const SNAP=()=>({
 app:document.getElementById('app')?!document.getElementById('app').hidden:false,
 auth:!!document.getElementById('authScreen'),
 text:[document.getElementById('app'),document.getElementById('authRoot'),document.getElementById('overlayRoot')].map(n=>n?n.innerText:'').join('\n'),
 html:[document.getElementById('app'),document.getElementById('overlayRoot')].map(n=>n?n.innerHTML:'').join('\n'),
 settingsOpen:!!document.querySelector('.settings-dialog'),
 overlays:document.getElementById('overlayRoot')?document.getElementById('overlayRoot').children.length:0,
 view:window.state&&state.view,section:window.state&&state.section,
 name:(document.querySelector('.profile-name')||{}).textContent||'',email:(document.querySelector('.profile-email')||{}).textContent||'',
 cals:[...document.querySelectorAll('.cal-name')].map(n=>n.textContent),
 emailField:(document.querySelector('#authEmail')||{}).value||'',
 globalEmail:window.__dlIdentityEmail||''
});
const mentions=(snap,who)=>[who.user_metadata.full_name,who.email,who.user_metadata.full_name.split(' ')[0]].filter(t=>snap.text.includes(t)||snap.html.includes(t));

for(const theme of ['dark','light']){
 const app=await launch({theme,width:1440,height:900,payload:payloadFor('A','Alex calendar','Alex dentist'),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await page.evaluate((a,b,pa,pb)=>{},A,B,{},{});
  await page.evaluateOnNewDocument((a,b,pa,pb)=>{window.__accounts={[a.id]:{user:a,payload:pa},[b.id]:{user:b,payload:pb}}},A,B,payloadFor('A','Alex calendar','Alex dentist'),payloadFor('B','Blake calendar','Blake recital'));
  await app.load();
  // the stub signs in as its default user; replace that with account A through the real code path
  const signIn=async who=>{
    await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},who);
    await page.waitForFunction(t=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent===t),{timeout:8000},who===A?'Alex calendar':'Blake calendar');
    await sleep(500);
  };
  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);
  await signIn(A);
  let s=await page.evaluate(SNAP);
  check(`${theme}: A signed in: sidebar shows A's name and calendar`,s.name==='Alex Rivera'&&s.cals.includes('Alex calendar'),JSON.stringify({n:s.name,c:s.cals}));
  check(`${theme}: A lands on the calendar, Settings closed`,s.section==='calendar'&&!s.settingsOpen&&s.overlays===0,JSON.stringify({sec:s.section,o:s.overlays}));
  await page.screenshot({path:path.join(out,`1-A-in-${theme}.png`)});

  // open Settings -> Profile as A, then sign out the way a user does
  await page.evaluate(()=>openSettings('profile'));await sleep(500);
  s=await page.evaluate(SNAP);
  check(`${theme}: A's Settings shows A`,s.settingsOpen&&/Alex Rivera|alex\.rivera/i.test(s.text));
  await page.screenshot({path:path.join(out,`2-A-settings-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-settings-close,.settings-close')?.click());await sleep(400);
  // the account menu: exactly Settings + Log out (red), above the account block, closes on Escape / outside click
  await page.click('#sidebar .profile-row');await page.waitForSelector('.dl-account-menu');await sleep(250);
  const menu=await page.evaluate(()=>{const m=document.querySelector('.dl-account-menu'),r=document.querySelector('#sidebar .profile-row').getBoundingClientRect(),b=m.getBoundingClientRect();
    const items=[...m.querySelectorAll('[role=menuitem]')];return {labels:items.map(i=>i.textContent.trim()),danger:items.map(i=>i.classList.contains('danger')),color:items.map(i=>getComputedStyle(i).color),h:items.map(i=>Math.round(i.getBoundingClientRect().height)),above:b.bottom<=r.top,aligned:Math.abs(b.left-r.left)<=2,inside:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,radius:getComputedStyle(m).borderRadius}});
  check(`${theme}: the account menu has exactly Settings and Log out`,JSON.stringify(menu.labels)==='["Settings","Log out"]',JSON.stringify(menu.labels));
  check(`${theme}: Log out is red, Settings is not`,menu.danger[1]===true&&menu.danger[0]===false&&menu.color[1]!==menu.color[0],JSON.stringify(menu.color));
  check(`${theme}: the menu sits directly above the account block, inside the window`,menu.above&&menu.aligned&&menu.inside,JSON.stringify(menu));
  check(`${theme}: rows are comfortable to hit (>=36px)`,menu.h.every(h=>h>=36),JSON.stringify(menu.h));
  await page.screenshot({path:path.join(out,`menu-${theme}.png`),clip:{x:0,y:Math.max(0,900-330),width:340,height:330}});
  await page.keyboard.press('Escape');await sleep(300);
  check(`${theme}: Escape closes the menu`,!(await page.$('.dl-account-menu')));
  await page.click('#sidebar .profile-row');await page.waitForSelector('.dl-account-menu');await page.mouse.click(760,24);await sleep(300);
  check(`${theme}: an outside click closes the menu`,!(await page.$('.dl-account-menu')));
  await page.click('#sidebar .profile-row');await page.waitForSelector('.dl-account-menu');
  await page.click('.dl-account-menu [data-menu-id="settings"]');await page.waitForSelector('.settings-dialog');await sleep(400);
  s=await page.evaluate(SNAP);
  check(`${theme}: Settings from the menu opens on Profile for A, and Profile has no Log out`,/Alex Rivera/.test(s.text)&&!/Log out/i.test(s.text),'');
  await page.evaluate(()=>document.querySelector('.settings-close')?.click());await sleep(400);
  await page.click('#sidebar .profile-row');await page.waitForSelector('.dl-account-menu');
  await page.click('.dl-account-menu [data-menu-id="logout"]');
  await sleep(700);
  s=await page.evaluate(SNAP);
  check(`${theme}: after sign-out the sign-in screen shows`,s.auth&&!s.app,JSON.stringify({auth:s.auth,app:s.app}));
  check(`${theme}: nothing of A is left anywhere on the page`,mentions(s,A).length===0&&!s.cals.includes('Alex calendar'),JSON.stringify({found:mentions(s,A),cals:s.cals}));
  check(`${theme}: no Settings or dialog survives the sign-out`,!s.settingsOpen&&s.overlays===0,JSON.stringify({settings:s.settingsOpen,overlays:s.overlays}));
  check(`${theme}: the sign-in form does not carry A's email or the cached identity`,s.emailField===''&&s.globalEmail==='',JSON.stringify({f:s.emailField,g:s.globalEmail}));
  await page.screenshot({path:path.join(out,`3-signed-out-${theme}.png`)});

  // B signs in: sample the page on every frame for the first moments (loading included)
  await page.evaluate(()=>{window.__sampled=[];const t0=performance.now();(function tick(){const t=document.body.innerText;window.__sampled.push({t:Math.round(performance.now()-t0),a:/Alex|alex\.rivera/.test(t)});if(performance.now()-t0<1500)requestAnimationFrame(tick)})()});
  await signIn(B);
  s=await page.evaluate(SNAP);
  const samples=await page.evaluate(()=>window.__sampled);
  check(`${theme}: not one frame mentioned A while B was signing in (${samples.length} frames)`,samples.every(x=>!x.a),JSON.stringify(samples.filter(x=>x.a).slice(0,3)));
  check(`${theme}: B signed in: B's name, email and calendars`,s.name==='Blake Chen'&&s.email==='blake.chen@example.org'&&s.cals.includes('Blake calendar')&&!s.cals.includes('Alex calendar'),JSON.stringify({n:s.name,e:s.email,c:s.cals}));
  check(`${theme}: B lands on the normal calendar view with Settings closed`,s.section==='calendar'&&s.view==='month'&&!s.settingsOpen&&s.overlays===0,JSON.stringify({sec:s.section,view:s.view,settings:s.settingsOpen,overlays:s.overlays}));
  check(`${theme}: nothing of A anywhere`,mentions(s,A).length===0,JSON.stringify(mentions(s,A)));
  await page.screenshot({path:path.join(out,`4-B-in-${theme}.png`)});
  await page.evaluate(()=>openSettings('profile'));await sleep(500);
  s=await page.evaluate(SNAP);
  check(`${theme}: B's Settings -> Profile shows B only`,/Blake Chen/.test(s.text)&&/blake\.chen/.test(s.text)&&mentions(s,A).length===0);
  await page.screenshot({path:path.join(out,`5-B-settings-${theme}.png`)});

  await page.evaluate(()=>{logOut()});await sleep(700);
  s=await page.evaluate(SNAP);
  check(`${theme}: B signed out: nothing of B, nothing of A`,mentions(s,B).length===0&&mentions(s,A).length===0&&s.auth&&!s.settingsOpen,JSON.stringify({b:mentions(s,B),a:mentions(s,A)}));
  await signIn(A);
  s=await page.evaluate(SNAP);
  check(`${theme}: A again: A's identity, no B, Settings closed`,s.name==='Alex Rivera'&&s.cals.includes('Alex calendar')&&mentions(s,B).length===0&&!s.settingsOpen&&s.section==='calendar',JSON.stringify({n:s.name,c:s.cals,b:mentions(s,B),settings:s.settingsOpen}));
  await page.screenshot({path:path.join(out,`6-A-again-${theme}.png`)});
 }finally{await app.close()}
}
if(failed){console.log('account switch FAILED');process.exit(1)}
console.log('PASS account switch');
