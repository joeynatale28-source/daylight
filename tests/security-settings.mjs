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
const J=x=>JSON.stringify(x);
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await app.load();
  const calls=()=>page.evaluate(()=>window.__authCalls||[]);
  const openProfile=async()=>{await page.evaluate(()=>openSettings('signin'));await page.waitForSelector('[data-methods] .dl-sec-row');await sleep(700)};
  const closeSettings=async()=>{await page.evaluate(()=>document.querySelector('.settings-close').click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:4000});await sleep(300)};
  const methods=()=>page.evaluate(()=>[...document.querySelectorAll('[data-methods] .dl-sec-row')].map(r=>({name:r.querySelector('.sw-label').textContent,sub:r.querySelector('.sw-sub').textContent,btn:[...r.querySelectorAll('button')].map(b=>b.textContent.trim()),note:(r.querySelector('.dl-sec-note')||{}).textContent||'',status:(r.querySelector('.dl-sec-status')||{}).textContent||''})));
  const barHidden=()=>page.evaluate(()=>document.querySelector('.settings-savebar').hidden);
  await openProfile();
  const sec=await page.evaluate(()=>({groups:[...document.querySelectorAll('.settings-pane .set-group-title')].map(n=>n.textContent)}));
  check(T('the Sign-in methods pane holds the Sign-in methods card (and no Security card)'),sec.groups.join('|')==='Sign-in methods',JSON.stringify(sec));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.dl-sec-group');await sleep(800);
  const prof=await page.evaluate(()=>{const g=[...document.querySelectorAll('.settings-pane .set-group')].find(x=>/^Security/.test((x.querySelector('.set-group-title')||{textContent:''}).textContent));return {rows:g?[...g.querySelectorAll('.dl-sec-row.is-main .sw-label')].map(n=>n.textContent.replace(/\s+/g,' ').trim()):null,pk:!!document.querySelector('.settings-pane [data-pk-list],.settings-pane [data-add-passkey]'),methods:!!document.querySelector('.settings-pane [data-methods]')}});
  check(T('Profile keeps Security with the Password row only: no passkeys and no sign-in methods there'),prof.rows&&prof.rows.join('|')==='Password'&&!prof.pk&&!prof.methods,JSON.stringify(prof));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);
  await openProfile();
  let m=await methods();
  check(T('every method row has a right-side status or action (Email On, Passkeys Not connected)'),m[0].status==='On'&&m[2].status==='Not connected'&&m[1].btn.length===1,JSON.stringify(m));
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
  check(T('Sign-in methods shows the Passkeys row as connected through its Disconnect button (the count lives only in the Passkeys section)'),m[2].btn.includes('Disconnect'),JSON.stringify(m[2]));

  // rename: in place, full-width, only Save and Cancel while editing
  await page.click('[data-pk] [data-rename]');await sleep(200);
  const ed=await page.evaluate(()=>{const r=document.querySelector('[data-pk]');const i=r.querySelector('.dl-pk-input');const ib=i.getBoundingClientRect(),tb=r.querySelector('.dl-sec-text').getBoundingClientRect(),sb=r.querySelector('[data-meta]').getBoundingClientRect();
   return {w:Math.round(ib.width),textW:Math.round(tb.width),value:i.value,fullyVisible:i.scrollWidth<=i.clientWidth,view:getComputedStyle(r.querySelector('[data-view]')).display==='none',edit:!r.querySelector('[data-edit]').hidden,metaBelow:sb.top>=ib.bottom-1,gap:Math.round(tb.left-ib.left),tile:!!r.querySelector('.dl-sec-tile'),indent:Math.round(r.querySelector('.dl-pk-glyph').getBoundingClientRect().left-document.querySelector('.dl-sec-group .dl-sec-tile').getBoundingClientRect().left)}});
  check(T('rename editor: the name becomes a field the full width of the name area, pre-filled and fully visible, subtitle stays on its own line under it'),ed.w>=ed.textW-4&&ed.w>=200&&ed.value==='Work laptop'&&ed.fullyVisible&&ed.metaBelow&&Math.abs(ed.gap)<=1,JSON.stringify(ed));
  check(T('while editing Rename and Remove are hidden; only Save and Cancel show'),ed.view&&ed.edit);
  check(T('passkey entries have no icon tile and are indented under the Passkeys row'),!ed.tile&&ed.indent>=40,JSON.stringify(ed));
  await page.screenshot({path:path.join(out,`2b-rename-editing-${theme}.png`)});
  await page.$eval('.dl-pk-input',n=>{n.value=''});await page.type('.dl-pk-input','Phone');await page.click('[data-pk] [data-save]');await sleep(500);
  check(T('renaming saves the new name'),(await page.evaluate(()=>document.querySelector('[data-pk] [data-name]').textContent))==='Phone'&&(await calls()).some(x=>x.fn==='pkUpdate'&&x.a.friendlyName==='Phone'));
  // remove asks twice
  await page.click('[data-pk] [data-remove]');await sleep(150);
  check(T('Remove asks for confirmation first'),(await page.evaluate(()=>document.querySelector('[data-pk] [data-remove]').textContent))==='Confirm remove'&&!(await calls()).some(x=>x.fn==='pkDelete'));
  await page.click('[data-pk] [data-remove]');await sleep(600);
  check(T('confirming removes it'),(await calls()).some(x=>x.fn==='pkDelete')&&(await page.evaluate(()=>document.querySelectorAll('[data-pk]').length))===0);
  check(T('none of this raised the Save / Discard bar'),await barHidden());

  // ---- Passkeys row: a real Disconnect, same family as Google's
  await page.evaluate(()=>{window.__pks=[{id:'pkA',friendly_name:'One',created_at:new Date().toISOString(),last_used_at:null},{id:'pkB',friendly_name:'Two',created_at:new Date().toISOString(),last_used_at:null}];window.__ids=[{provider:'email',identity_data:{email:'demo@example.com'}},{provider:'google',identity_data:{email:'demo@gmail.com'}}];window.__authCalls=[]});
  await closeSettings();await openProfile();await page.waitForFunction(()=>document.querySelectorAll('[data-methods] .dl-sec-row').length>=3&&document.querySelectorAll('[data-pk]').length>=2,{timeout:5000});await sleep(300);
  const geo=await page.evaluate(()=>{const rows=[...document.querySelectorAll('[data-methods] .dl-sec-row')];const g=rows[1].querySelector('button'),p=rows[2].querySelector('.btn-danger-outline');const gb=g&&g.getBoundingClientRect(),pb=p&&p.getBoundingClientRect();const cs=x=>getComputedStyle(x);return {has:!!p,sameRight:!!pb&&Math.round(gb.right)===Math.round(pb.right),sameH:!!pb&&Math.round(gb.height)===Math.round(pb.height),sameBorder:!!pb&&cs(g).borderTopColor===cs(p).borderTopColor&&cs(g).color===cs(p).color&&cs(g).borderRadius===cs(p).borderRadius,label:p&&p.textContent.trim(),entries:document.querySelectorAll('[data-pk]').length}});
  check(T('with passkeys, the Passkeys method row has a Disconnect button: same height, radius, red outline and right edge as the Google row'),geo.has&&geo.sameRight&&geo.sameH&&geo.sameBorder&&geo.label==='Disconnect'&&geo.entries===2,J(geo));
  await page.screenshot({path:path.join(out,`6-passkey-disconnect-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('[data-methods] .dl-sec-row')][2].querySelector('.btn-danger-outline').click());await sleep(150);
  check(T('the first click only asks to confirm; nothing was removed yet'),!(await calls()).some(x=>x.fn==='pkDelete'));
  await page.evaluate(()=>[...document.querySelectorAll('[data-methods] .dl-sec-row')][2].querySelector('.btn-danger-outline').click());await sleep(900);
  const gone=await page.evaluate(()=>({entries:document.querySelectorAll('[data-pk]').length,status:[...document.querySelectorAll('[data-methods] .dl-sec-row')][2].querySelector('.dl-sec-status')&&[...document.querySelectorAll('[data-methods] .dl-sec-row')][2].querySelector('.dl-sec-status').textContent,btn:[...document.querySelectorAll('[data-methods] .dl-sec-row')][2].querySelectorAll('button').length,pkSub:document.querySelector('[data-pk-sub]').textContent}));
  check(T('confirming removes every passkey: the Security list empties and the row reads Not connected with no button'),(await calls()).filter(x=>x.fn==='pkDelete').length===2&&gone.entries===0&&gone.status==='Not connected'&&gone.btn<=1,J(gone));
  // the standing guard: never remove the last sign-in method
  await page.evaluate(()=>{window.__pks=[{id:'pkC',friendly_name:'Only',created_at:new Date().toISOString(),last_used_at:null}];window.__ids=[];window.__authCalls=[]});
  await closeSettings();await openProfile();await page.waitForFunction(()=>document.querySelectorAll('[data-methods] .dl-sec-row').length>=3&&document.querySelectorAll('[data-pk]').length>=1,{timeout:5000});await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('[data-methods] .dl-sec-row')][2].querySelector('.btn-danger-outline').click());await sleep(400);
  const guard=await page.evaluate(()=>({msg:document.querySelector('[data-method-status]').textContent,entries:document.querySelectorAll('[data-pk]').length}));
  check(T('if passkeys are the only sign-in method, Disconnect is blocked with a plain explanation and nothing is removed'),/only sign-in method/.test(guard.msg)&&guard.entries===1&&!(await calls()).some(x=>x.fn==='pkDelete'),J(guard));
  await page.evaluate(()=>{window.__pks=[];window.__ids=[{provider:'email',identity_data:{email:'demo@example.com'}}];window.__authCalls=[]});
  await closeSettings();await openProfile();await page.waitForFunction(()=>document.querySelectorAll('[data-methods] .dl-sec-row').length>=3,{timeout:5000});await sleep(300);
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
