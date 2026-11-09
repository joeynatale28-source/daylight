/**
 * Item 2 (first-run onboarding), Item 8a (the single Create button) and Item 1 (branding), on the real page, both themes.
 *  - a brand-new account (no saved workspace) gets the "Welcome to Daylight!" popup: first name, last name, optional birthday (with
 *    the year), first calendar name + color; nothing is saved until "Get started"; closing it saves nothing and it returns on the
 *    next sign-in; completing it leaves ONLY US Holidays + the created calendar (+ birthday events), the combined display name and
 *    onboarded=true on the account record;
 *  - an account that already has a workspace never sees it;
 *  - Create is ONE button: clicking its left edge, its right edge or its label opens the Event / Task menu;
 *  - the wordmark reads "Daylight" (no period) in the sidebar and on the sign-in screen.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','onboarding-create');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NEW={id:id(21),email:'brand.new@example.com',user_metadata:{}};
const OLD={id:id(22),email:'existing@example.com',user_metadata:{full_name:'Existing Person'}};
const oldPayload=()=>{const p=busyPayload();p.settings={themeMode:'system',profileName:'Existing Person',identityOwner:OLD.id};return p};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:oldPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.evaluateOnNewDocument((n,o,op)=>{window.__accounts={[n.id]:{user:n,payload:null},[o.id]:{user:o,payload:op}};window.__ws={}},NEW,OLD,oldPayload());
  await app.load();
  const signIn=async who=>{await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},who);await sleep(1800)};
  const signOut=async()=>{await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(500)};
  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(400);

  // ---- branding on the sign-in screen
  const auth=await page.evaluate(()=>({word:document.querySelector('.auth-wordmark')?.textContent,visual:document.querySelector('.auth-visual-word')?.textContent,title:document.title}));
  check(T('the sign-in screen says "Daylight" (no period) and the page title is Daylight'),auth.word==='Daylight'&&auth.visual==='Daylight'&&/^Daylight/.test(auth.title),JSON.stringify(auth));
  await page.screenshot({path:path.join(out,`0-signin-${theme}.png`)});

  // ---- an existing account never sees onboarding
  await signIn(OLD);
  check(T('an account that already has its profile set up never sees the popup'),!(await page.$('.dl-onb')));
  const brand=await page.evaluate(()=>document.querySelector('#sidebar .brand-name').textContent);
  check(T('the sidebar wordmark reads "Daylight" with no period'),brand==='Daylight',brand);
  await signOut();

  // ---- a brand-new account
  await signIn(NEW);
  await page.waitForSelector('.dl-onb',{timeout:6000});await sleep(500);
  const w=await page.evaluate(()=>({title:document.querySelector('.dl-onb .dialog-title').textContent,intro:document.querySelector('.dl-onb-intro').textContent,labels:[...document.querySelectorAll('.dl-onb .field > label')].map(l=>l.textContent.replace('Optional','').trim()),
   birthdayType:document.querySelector('#onbBirthday').type,go:document.querySelector('[data-go]').disabled,cals:state.calendars.map(c=>c.name),width:Math.round(document.querySelector('.dl-onb').getBoundingClientRect().width)}));
  check(T('"Welcome to Daylight!" with a short intro and the fields in order: First name, Last name, Birthday, Calendar name, Color'),w.title==='Welcome to Daylight!'&&w.intro.length>40&&w.labels.join('|')==='First name|Last name|Birthday|Calendar name|Color'&&w.birthdayType==='date',JSON.stringify(w));
  check(T('the new account starts with ONLY the built-in US Holidays calendar (no default calendars)'),w.cals.join('|')==='US Holidays',JSON.stringify(w.cals));
  check(T('Get started stays disabled until the required fields are filled; the popup uses the standard dialog shell'),w.go&&w.width===480);
  await page.screenshot({path:path.join(out,`1-welcome-${theme}.png`)});
  // close halfway: nothing saved, and it returns on the next sign-in
  await page.type('#onbFirst','Half');await page.keyboard.press('Escape');await sleep(500);
  check(T('closing halfway (Esc) saves nothing'),!(await page.$('.dl-onb'))&&await page.evaluate(()=>state.calendars.length===1&&state.profileName!=='Half'&&!(window.__metaUpdates||[]).some(m=>m&&m.onboarded)));
  await signOut();await signIn(NEW);await page.waitForSelector('.dl-onb',{timeout:6000});
  check(T('it appears again on the next sign-in until onboarding is completed'),true);
  await page.type('#onbFirst','Dana');await page.type('#onbLast','Whitfield');await page.type('#onbCal','Family');
  await page.$eval('#onbBirthday',el=>{el.value='2014-11-12';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.screenshot({path:path.join(out,`2-fields-${theme}.png`)});
  check(T('Get started is enabled once first name, last name and calendar name are filled'),await page.evaluate(()=>!document.querySelector('[data-go]').disabled));
  await page.click('[data-go]');await sleep(1800);
  const done=await page.evaluate(()=>({popup:!!document.querySelector('.dl-onb'),cals:state.calendars.map(c=>c.name),name:state.profileName,meta:(window.__metaUpdates||[]).filter(Boolean).pop(),b:state.events.filter(e=>e.birthday).sort((a,b)=>a.start-b.start).map(e=>e.title),
   sidebar:[...document.querySelectorAll('#sidebar .cal-name')].map(n=>n.textContent),dflt:state.defaultCalendarId}));
  check(T('completing it: only US Holidays + the created calendar, in the sidebar too'),!done.popup&&done.cals.join('|')==='US Holidays|Family'&&done.sidebar.join('|')==='Family|US Holidays',JSON.stringify(done));
  check(T('the combined display name is saved to the account record with onboarded=true'),done.name==='Dana Whitfield'&&done.meta&&done.meta.full_name==='Dana Whitfield'&&done.meta.onboarded===true,JSON.stringify(done.meta));
  check(T('the birthday creates its events with the right age ("Dana\'s 12th Birthday" in 2026, 13th in 2027)'),done.b.includes("Dana's 12th Birthday")&&done.b.includes("Dana's 13th Birthday"),JSON.stringify(done.b.slice(0,4)));
  await page.screenshot({path:path.join(out,`3-result-${theme}.png`)});

  // ---- the single Create button
  await signOut();await signIn(OLD);
  const box=await page.evaluate(()=>{const r=document.querySelector('.create-pill').getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,caret:!!document.querySelector('.create-caret'),buttons:document.querySelectorAll('.create-pill button').length}});
  check(T('Create is ONE button (no separate caret segment)'),!box.caret&&box.buttons===1,JSON.stringify(box));
  for(const [label,x] of [['left edge',box.l+4],['label',box.l+55],['right edge',box.r-4]]){
   await page.mouse.click(x,(box.t+box.b)/2);await sleep(350);
   const items=await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>b.textContent.trim()));
   check(T(`clicking the ${label} opens the menu with exactly Event and Task`),items.join('|')==='Event|Task',JSON.stringify(items));
   if(label==='label')await page.screenshot({path:path.join(out,`4-create-menu-${theme}.png`),clip:{x:0,y:0,width:420,height:260},captureBeyondViewport:false});
   await page.keyboard.press('Escape');await sleep(250);
   if(await page.$('.menu'))await page.mouse.click(900,500);await sleep(200);
  }
  await page.mouse.click(box.l+30,(box.t+box.b)/2);await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/^Event/.test(b.textContent)).click());await sleep(500);
  check(T('Event opens the existing event editor'),await page.evaluate(()=>!!document.querySelector('.event-form-dialog')));
  await page.keyboard.press('Escape');await sleep(300);if(await page.$('.event-form-dialog'))await page.evaluate(()=>document.querySelector('.event-form-dialog [data-x]').click());await sleep(300);
  await page.mouse.click(box.l+30,(box.t+box.b)/2);await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/^Task/.test(b.textContent)).click());await sleep(500);
  check(T('Task opens the task creation flow'),await page.evaluate(()=>state.section==='tasks'&&document.activeElement&&document.activeElement.id==='taskTitleInput'));
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('onboarding/create FAILED');process.exit(1)}
console.log('PASS onboarding and create');
