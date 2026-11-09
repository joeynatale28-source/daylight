/**
 * Item 5 on the real page, both themes, signed in as the test account (stand-in):
 *  - change the display name (saved to the account's own record, and it is what the sidebar reads);
 *  - birthday: set -> one all-day "<First name>'s <Ordinal> Birthday" event PER YEAR (age = that year - birth year) on the account's own default calendar;
 *    change the date -> the SAME event moves (never a duplicate); change the name -> the title follows (a dash does not
 *    split a first name: "Mary-Kate"); clear it -> the event is removed;
 *  - Discard leaves the calendar alone;
 *  - change password uses the established email-link flow.
 * LIVE_URL=<deployed build> runs it against the deployed page (stubbed backend).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','profile-extras');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const TEST={id:'00000000-0000-4000-8000-0000000000bb',email:'user@daylightcal.com',user_metadata:{}};
const YEAR=new Date().getFullYear();
const pay=()=>{const p=busyPayload();p.calendars=[{id:'c9',name:'Test calendar',color:'blue'},{id:'c8',name:'Second calendar',color:'green'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];p.events=[];return p};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:pay(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.evaluateOnNewDocument((t,p)=>{window.__accounts={[t.id]:{user:t,payload:p}}},TEST,pay());
  await app.load();
  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);
  await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},TEST);
  await page.waitForFunction(()=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='Test calendar')&&!document.getElementById('dlWorkspaceLoading'),{timeout:8000});await sleep(700);

  const open=async()=>{await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('#profileFullName');await sleep(500)};
  const setName=async n=>{await page.click('#profileFullName',{clickCount:3});await page.keyboard.press('Backspace');await page.type('#profileFullName',n);await page.keyboard.press('Tab');await sleep(250)};
  const setDate=async d=>{await page.$eval('#profileBirthday',(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},d);await sleep(250)};
  const save=async()=>{await page.waitForFunction(()=>{const b=document.querySelector('.settings-savebar');return b&&!b.hidden},{timeout:3000});await page.click('.settings-savebar [data-save]');await page.waitForFunction(()=>document.querySelector('.settings-savebar')?.hidden,{timeout:4000});await sleep(500)};
  const bevents=()=>page.evaluate(()=>state.events.filter(e=>e.birthday).map(e=>({id:e.id,title:e.title,cal:e.cal,allDay:e.allDay,repeat:e.repeat,m:e.start.getMonth()+1,d:e.start.getDate(),y:e.start.getFullYear()})).sort((a,b)=>a.y-b.y));
  const thisYear=l=>l.find(e=>e.y===YEAR);
  const occ=(y)=>page.evaluate(y=>occsInRange(new Date(y,0,1),new Date(y+1,0,1)).filter(o=>o.ev.birthday).map(o=>[o.start.getMonth()+1,o.start.getDate()]),y);
  const close=async()=>{await page.evaluate(()=>document.querySelector('.settings-close')?.click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});await sleep(300)};
  const monthShot=async(m,name)=>{await page.evaluate((y,m)=>{state.section='calendar';state.view='month';state.cursor=new Date(y,m-1,15);renderAll(false)},YEAR,m);await sleep(500);await page.screenshot({path:path.join(out,`${name}-${theme}.png`)})};

  // 1. name + birthday together
  await open();
  check(T('the Profile page has a Birthday field and a Change password button'),await page.evaluate(()=>!!document.querySelector('#profileBirthday')&&!!document.querySelector('[data-reset-password]')&&document.querySelector('[data-reset-password]').textContent.trim()==='Change password'));
  await setName('Dana Whitfield');await setDate(`${YEAR-26}-03-09`);
  await page.screenshot({path:path.join(out,`1-profile-unsaved-${theme}.png`)});
  await save();
  let b=await bevents();
  check(T('set: one all-day birthday event per year, each with its own age ("Dana\'s 26th Birthday" this year, 27th next year)'),b.length>=10&&b.every(e=>e.allDay&&!e.repeat)&&thisYear(b).title==="Dana's 26th Birthday"&&b.find(e=>e.y===YEAR+1).title==="Dana's 27th Birthday"&&new Set(b.map(e=>e.id)).size===b.length,JSON.stringify(b.slice(0,3)));
  check(T('set: it is on the right date (Mar 9) on the account\'s own first calendar'),b.every(e=>e.m===3&&e.d===9&&e.cal==='c9'),JSON.stringify(b.slice(0,3)));
  check(T('set: it recurs every year'),JSON.stringify(await occ(YEAR))==='[[3,9]]'&&JSON.stringify(await occ(YEAR+1))==='[[3,9]]',JSON.stringify([await occ(YEAR),await occ(YEAR+1)]));
  check(T('the new name is on the sidebar and in the account record'),await page.evaluate(()=>document.querySelector('.profile-name').textContent==='Dana Whitfield'&&(window.__metaUpdates||[]).some(m=>m&&m.full_name==='Dana Whitfield')));
  const id1=thisYear(b).id,count1=b.length;
  await close();await monthShot(3,'2-event-march');

  // 2. change the date: the same event moves
  await open();await setDate(`${YEAR-26}-07-21`);await save();
  b=await bevents();
  check(T('moved: the same events (same ids, no duplicates), now on Jul 21'),b.length===count1&&thisYear(b).id===id1&&b.every(e=>e.m===7&&e.d===21)&&thisYear(b).title==="Dana's 26th Birthday",JSON.stringify(b.slice(0,3)));
  check(T('moved: it no longer appears in March'),JSON.stringify(await occ(YEAR))==='[[7,21]]');
  await close();await monthShot(7,'3-event-moved-july');

  // 3. change the name: the title follows; a dash does not split the first name
  await open();await setName('Mary-Kate Olsen');await save();
  b=await bevents();
  check(T('renamed: same events, titles "Mary-Kate\'s 26th Birthday" (a dash does not split the name)'),b.length===count1&&thisYear(b).id===id1&&thisYear(b).title==="Mary-Kate's 26th Birthday",JSON.stringify(b.slice(0,3)));
  await close();await monthShot(7,'4-event-renamed');
  await open();await setName('joey natale');await save();
  b=await bevents();
  check(T('a name is capitalized the way it was typed ("joey natale" gives "joey\'s 26th Birthday")'),thisYear(b).title==="joey's 26th Birthday",JSON.stringify(b.slice(0,3)));
  await setName('Dana Whitfield');await save();

  // 4. discard leaves the calendar alone
  await setDate(`${YEAR-26}-11-30`);
  await page.waitForFunction(()=>{const x=document.querySelector('.settings-savebar');return x&&!x.hidden},{timeout:3000});
  await page.click('.settings-savebar [data-discard]');await sleep(500);
  b=await bevents();
  check(T('discard: nothing changed (still Jul 21, same events, no popup)'),b.length===count1&&b.every(e=>e.m===7&&e.d===21)&&!await page.$('#dlSettingsDiscardConfirm'),JSON.stringify(b.slice(0,3)));

  // 5. clear: the event is removed
  await page.click('[data-birthday-clear]');await save();
  b=await bevents();
  check(T('cleared: the birthday event is gone'),b.length===0&&JSON.stringify(await occ(YEAR))==='[]',JSON.stringify(b));
  await page.screenshot({path:path.join(out,`5-cleared-profile-${theme}.png`)});
  await close();await monthShot(7,'5-event-gone-july');

  // 6. it persists with the account's workspace
  await open();await setDate(`${YEAR-26}-03-09`);await save();
  await page.waitForFunction(()=>window.__lastUpdate&&window.__lastUpdate.payload,{timeout:6000}).catch(()=>{});
  const u=await page.evaluate(()=>JSON.stringify(window.__lastUpdate||{}));
  check(T('the saved workspace carries the birthday and the flagged event'),u.includes('"birthday":"'+(YEAR-26)+'-03-09"')&&u.includes('"birthday":true'),u.slice(0,200));

  // 7. change password: the established email-link flow
  await page.click('[data-reset-password]');await sleep(600);
  const pw=await page.evaluate(()=>({calls:window.__resetCalls||[],msg:(document.querySelector('[data-security-status]')||{}).textContent}));
  check(T('Change password sends the secure link to this account\'s own email'),pw.calls.length===1&&pw.calls[0]==='user@daylightcal.com'&&/Check user@daylightcal\.com/.test(pw.msg),JSON.stringify(pw));
  await page.screenshot({path:path.join(out,`6-password-${theme}.png`)});
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('profile extras FAILED');process.exit(1)}
console.log('PASS profile extras');
