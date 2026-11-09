/**
 * Settings -> Profile -> Security (Password, Passkeys) and Sign-in methods, both themes, Supabase Auth stubbed at the client boundary.
 *  - Password row; Passkeys row with a "New" badge; the passkey setup dialog (name, device prompt, success) calls registerPasskey
 *    and names the passkey; the list can rename and remove (remove asks twice);
 *  - Sign-in methods lists Email and password / Google / Passkeys with Connect and Disconnect;
 *  - the last remaining method cannot be disconnected (no button, an explanation instead);
 *  - none of this touches the Save / Discard bar (these are instant account actions).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','security');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await app.load();
  const calls=()=>page.evaluate(()=>window.__authCalls||[]);
  const openProfile=async()=>{await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.dl-sec-group');await sleep(700)};
  const closeSettings=async()=>{await page.evaluate(()=>document.querySelector('.settings-close').click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});await sleep(300)};
  const methods=()=>page.evaluate(()=>[...document.querySelectorAll('[data-methods] .dl-sec-row')].map(r=>({name:r.querySelector('.sw-label').textContent,sub:r.querySelector('.sw-sub').textContent,btn:[...r.querySelectorAll('button')].map(b=>b.textContent.trim()),note:(r.querySelector('.dl-sec-note')||{}).textContent||''})));
  const barHidden=()=>page.evaluate(()=>document.querySelector('.settings-savebar').hidden);
  await openProfile();
  const sec=await page.evaluate(()=>{const g=document.querySelector('.dl-sec-group');return {title:g.querySelector('.set-group-title').textContent,rows:[...g.querySelectorAll('.dl-sec-row.is-main .sw-label')].map(n=>n.textContent.replace(/\s+/g,' ').trim()),badge:(g.querySelector('.dl-new-badge')||{}).textContent,groups:[...document.querySelectorAll('.settings-pane .set-group-title')].map(n=>n.textContent.trim())}});
  check(T('Security has a Password row and a Passkeys row with a New badge'),sec.title==='Security'&&sec.rows.join('|')==='Password|PasskeysNew'&&sec.badge==='New',JSON.stringify(sec));
  check(T('Sign-in methods follows Security'),sec.groups.indexOf('Sign-in methods')===sec.groups.indexOf('Security')+1,JSON.stringify(sec.groups));
  let m=await methods();
  check(T('methods: email, Google, passkeys'),m.map(x=>x.name).join('|')==='Email and password|Google|Passkeys'&&m[1].btn.join()==='Connect'&&/demo@example.com/.test(m[0].sub),JSON.stringify(m));
  await page.screenshot({path:path.join(out,`1-security-${theme}.png`)});

  // ---- add a passkey
  await page.click('[data-add-passkey]');await page.waitForSelector('.dl-pk-steps');await sleep(400);
  await page.screenshot({path:path.join(out,`2-passkey-dialog-${theme}.png`)});
  const pre=await page.evaluate(()=>({title:document.querySelector('.dialog-title').textContent,name:document.querySelector('#pkName').value,steps:document.querySelectorAll('.dl-pk-steps li').length}));
  check(T('the setup dialog explains 3 steps and suggests a device name'),pre.title==='Set up a passkey'&&pre.steps===3&&pre.name.length>2,JSON.stringify(pre));
  await page.$eval('#pkName',n=>{n.value=''});await page.type('#pkName','Work laptop');
  await page.click('[data-go]');await page.waitForSelector('.dl-pk-ok');await sleep(300);
  let c=await calls();
  check(T('creating calls registerPasskey and names it'),c.some(x=>x.fn==='register')&&c.some(x=>x.fn==='pkUpdate'&&x.a.friendlyName==='Work laptop'),JSON.stringify(c));
  await page.screenshot({path:path.join(out,`3-passkey-added-${theme}.png`)});
  await page.click('[data-done]');await sleep(500);
  const list=await page.evaluate(()=>[...document.querySelectorAll('[data-pk-list] [data-pk]')].map(r=>r.querySelector('[data-name]').textContent+' / '+r.querySelector('[data-meta]').textContent));
  check(T('the passkey is listed with when it was added and "Never used"'),list.length===1&&/^Work laptop \/ Added .+ · Never used$/.test(list[0]),JSON.stringify(list));
  m=await methods();
  check(T('Sign-in methods counts the passkey'),/1 passkey added/.test(m[2].sub),JSON.stringify(m[2]));

  // rename
  await page.click('[data-pk] [data-rename]');await sleep(200);
  await page.$eval('.dl-sec-rename input',n=>{n.value=''});await page.type('.dl-sec-rename input','Phone');await page.click('.dl-sec-rename .btn-primary');await sleep(500);
  check(T('renaming saves the new name'),(await page.evaluate(()=>document.querySelector('[data-pk] [data-name]').textContent))==='Phone'&&(await calls()).some(x=>x.fn==='pkUpdate'&&x.a.friendlyName==='Phone'));
  // remove asks twice
  await page.click('[data-pk] [data-remove]');await sleep(150);
  check(T('Remove asks for confirmation first'),(await page.evaluate(()=>document.querySelector('[data-pk] [data-remove]').textContent))==='Confirm remove'&&!(await calls()).some(x=>x.fn==='pkDelete'));
  await page.click('[data-pk] [data-remove]');await sleep(600);
  check(T('confirming removes it'),(await calls()).some(x=>x.fn==='pkDelete')&&(await page.evaluate(()=>document.querySelectorAll('[data-pk]').length))===0);
  check(T('none of this raised the Save / Discard bar'),await barHidden());

  // ---- connect Google
  await page.evaluate(()=>{[...document.querySelectorAll('[data-methods] .dl-sec-row')][1].querySelector('button').click()});await sleep(300);
  check(T('Connect calls linkIdentity for that provider'),(await calls()).some(x=>x.fn==='link'&&x.a.provider==='google'));
  await closeSettings();

  // ---- disconnect, and the last-method protection
  await page.evaluate(()=>{window.__ids=[{provider:'email',identity_data:{email:'demo@example.com'}},{provider:'google',identity_data:{email:'demo@gmail.com'}}]});
  await openProfile();
  m=await methods();
  check(T('a connected provider shows its email and a Disconnect button'),/Connected · demo@gmail.com/.test(m[1].sub)&&m[1].btn.join()==='Disconnect',JSON.stringify(m[1]));
  await page.screenshot({path:path.join(out,`4-connected-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('[data-methods] .dl-sec-row')][1].querySelector('.btn-danger-outline').click());await sleep(150);
  check(T('Disconnect asks for confirmation'),!(await calls()).some(x=>x.fn==='unlink'));
  await page.evaluate(()=>[...document.querySelectorAll('[data-methods] .dl-sec-row')][1].querySelector('.btn-danger-outline').click());await sleep(700);
  check(T('confirming unlinks Google and the row returns to Connect'),(await calls()).some(x=>x.fn==='unlink'&&x.a==='google')&&(await methods())[1].btn.join()==='Connect');
  await closeSettings();
  await page.evaluate(()=>{window.__ids=[{provider:'google',identity_data:{email:'demo@gmail.com'}}]});
  await openProfile();
  m=await methods();
  check(T('the only remaining method cannot be disconnected (explanation, no button)'),m[1].btn.length===0&&/only sign-in method/.test(m[1].note)&&/Not set up/.test(m[0].sub),JSON.stringify(m));
  await page.screenshot({path:path.join(out,`5-last-method-${theme}.png`)});
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('security settings FAILED');process.exit(1)}
console.log('PASS security settings');
