/**
 * Item 1: identity always comes from the SIGNED-IN account's own record.
 * Accounts (stand-ins at the client boundary; the page's own sign-in code runs for real):
 *   OWNER   - has a name and photo of their own (account record + workspace);
 *   TEST    - an existing account whose stored workspace CARRIES THE OWNER'S NAME AND PHOTO (the contamination case);
 *   FRESH   - a brand-new account with no workspace row at all;
 *   LEGACY  - an older workspace with a name saved before names were stamped (plausible for its own email);
 *   STAMPED - a workspace with a name this account saved itself.
 * For each: the sidebar block, Settings -> Profile and the page as a whole show that account's own name/email and either its
 * own photo or initials, never anything of another account. Run in this order on ONE page without reloading (the leak case).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','identity');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const photo=u=>`https://example.supabase.co/storage/v1/object/public/avatars/${u}/avatar.png?v=1`;
const OWNER_NAME='Morgan Vale', OWNER_ID=id(1);
const OWNER={id:OWNER_ID,email:'morgan.vale@example.com',user_metadata:{full_name:OWNER_NAME,avatar_url:photo(OWNER_ID)}};
const TEST={id:id(2),email:'user@daylightcal.com',user_metadata:{}};
const FRESH={id:id(3),email:'fresh.person@example.com',user_metadata:{}};
const LEGACY={id:id(4),email:'alex.rivera@example.com',user_metadata:{}};
const STAMPED={id:id(5),email:'sam@example.com',user_metadata:{}};
const pl=(settings,cal)=>{const p=busyPayload();p.calendars=[{id:'c9',name:cal,color:'blue'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];p.events=[];p.settings=Object.assign({themeMode:'system'},settings);return p};
const PAY={
 [OWNER_ID]:pl({profileName:OWNER_NAME,firstName:'Morgan',avatarUrl:photo(OWNER_ID),identityOwner:OWNER_ID},'Morgan calendar'),
 [TEST.id]:pl({profileName:OWNER_NAME,firstName:'Morgan',avatarUrl:photo(OWNER_ID)},'Test calendar'),
 [FRESH.id]:null,
 [LEGACY.id]:pl({profileName:'Alex Rivera',firstName:'Alex'},'Legacy calendar'),
 [STAMPED.id]:pl({profileName:'Sam Edited',identityOwner:id(5)},'Stamped calendar')
};
const CASES=[
 {who:OWNER,name:OWNER_NAME,photo:true,label:'the owner (own name and photo)',shot:'owner'},
 {who:TEST,name:'user',photo:false,label:'the test account (its workspace carries the owner identity)',shot:'test-account'},
 {who:FRESH,name:'fresh.person',photo:false,label:'a brand-new account with no data',shot:'fresh-account'},
 {who:LEGACY,name:'Alex Rivera',photo:false,label:'an older workspace whose saved name fits its own email'},
 {who:STAMPED,name:'Sam Edited',photo:false,label:'an account that saved its own name'},
 {who:TEST,name:'user',photo:false,label:'the test account again, right after others'},
 {who:OWNER,name:OWNER_NAME,photo:true,label:'the owner again, right after the others',shot:'owner-again'}
];
const initialsOf=n=>n.trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()).slice(0,2).join('')||'?';
const SNAP=()=>({
 name:(document.querySelector('.profile-name')||{}).textContent||'',email:(document.querySelector('.profile-email')||{}).textContent||'',
 avatarImg:(document.querySelector('.profile-row .avatar img')||{}).src||'',avatarText:(document.querySelector('.profile-row .avatar')||{}).textContent||'',
 text:document.body.innerText,html:document.getElementById('app')?document.getElementById('app').innerHTML+document.getElementById('overlayRoot').innerHTML:''
});
for(const theme of ['dark','light']){
 const app=await launch({theme,width:1440,height:900,payload:pl({},'x'),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  const accounts=Object.fromEntries([OWNER,TEST,FRESH,LEGACY,STAMPED].map(u=>[u.id,{user:u,payload:PAY[u.id]}]));
  await page.evaluateOnNewDocument(a=>{window.__accounts=a},accounts);
  await app.load();
  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);
  let n=0;
  for(const c of CASES){
   n++;
   const T=s=>`${theme} #${n} ${c.label}: ${s}`;
   await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},c.who);
   await page.waitForFunction(()=>document.querySelector('.profile-name')&&!document.getElementById('dlWorkspaceLoading'),{timeout:8000});
   await sleep(900);
   const s=await page.evaluate(SNAP);
   const isOwner=c.who===OWNER;
   check(T('sidebar shows its own name'),s.name===c.name,JSON.stringify(s.name));
   check(T('sidebar shows its own email'),s.email===c.who.email,JSON.stringify(s.email));
   if(c.photo)check(T('its own photo'),s.avatarImg.indexOf('/'+c.who.id+'/')!==-1,s.avatarImg);
   else check(T('a plain initials avatar, no photo'),!s.avatarImg&&s.avatarText.trim()===initialsOf(c.name),JSON.stringify({img:s.avatarImg,t:s.avatarText}));
   if(!isOwner)check(T('nothing of the owner anywhere on the page'),!s.text.includes(OWNER_NAME)&&!s.html.includes(OWNER_NAME)&&!s.html.includes('Morgan')&&!s.html.includes('/'+OWNER_ID+'/'),'owner identity found');
   if(c.shot)await page.screenshot({path:path.join(out,`${c.shot}-app-${theme}.png`)});
   await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('#profileFullName');await sleep(500);
   const p=await page.evaluate(()=>({name:document.querySelector('#profileFullName').value,email:(document.querySelector('[data-email]')||{}).textContent,img:(document.querySelector('.dl-profile-avatar img')||{}).src||'',txt:(document.querySelector('.dl-profile-avatar')||{}).textContent,body:document.body.innerText}));
   check(T('Settings -> Profile shows the same identity'),p.name===c.name&&p.email===c.who.email&&(c.photo?p.img.indexOf('/'+c.who.id+'/')!==-1:(!p.img&&p.txt.trim()===initialsOf(c.name))),JSON.stringify({name:p.name,email:p.email,img:p.img,t:p.txt}));
   if(!isOwner)check(T('Profile has nothing of the owner'),!p.body.includes(OWNER_NAME)&&!p.img.includes(OWNER_ID));
   if(c.shot)await page.screenshot({path:path.join(out,`${c.shot}-profile-${theme}.png`)});
   await page.evaluate(()=>document.querySelector('.settings-close')?.click());await sleep(350);
   await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(500);
   const gone=await page.evaluate(SNAP);
   check(T('after sign-out no identity is left on the page'),!gone.text.includes(c.name)&&!gone.html.includes(c.who.email),'identity left behind');
  }
 }finally{await app.close()}
}
const files=['index.html','daylight-cloud.js','daylight-settings.js','daylight-integrations.js','daylight-enhancements.js','daylight-notifications.js'];
const baked=files.filter(f=>fs.existsSync(f)&&/joeynatale28@|profileName:\s*"Joey|firstName:\s*"Joey/i.test(fs.readFileSync(f,'utf8')));
check('no account name or email is hard-coded in the app files',baked.length===0,baked.join());
if(failed){console.log('identity FAILED');process.exit(1)}
console.log('PASS identity');
