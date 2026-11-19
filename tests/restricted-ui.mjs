/** Suspended / banned accounts sign in restricted: Support Center + Settings only, notifications show one message, status + reason on the home, a big Appeal button. Harness, stubbed backend. */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
for(const [kind,theme] of [['suspended','light'],['banned','dark']]){
 const app=await launch({width:1440,height:900,theme});const page=app.page;
 try{
  await app.load();await sleep(500);
  await page.evaluate((kind)=>{const c=window.daylightCloud,real=c.client.rpc.bind(c.client);window.__calls=[];
   c.client.rpc=function(n,a){
    if(n==='my_account_status')return Promise.resolve({data:{status:kind,reason:'Repeated abuse of sharing',ends_at:kind==='banned'?null:new Date(Date.now()+7*864e5).toISOString(),appeal:'privacy@daylightcal.com'},error:null});
    if(n==='support_ticket_list')return Promise.resolve({data:[],error:null});
    if(n==='support_ticket_create'){window.__calls.push(a);return Promise.resolve({data:a.p_id,error:null})}
    if(n==='support_ticket_get')return Promise.resolve({data:{ticket:{id:a.p_id,title:'Appeal',kind:'ticket',category:'appeal',status:'open',user_id:window.daylightCloud.user.id,user_email:'x@y.z',user_name:'',created_at:new Date().toISOString(),mine:true},messages:[]},error:null});
    return real(n,a)};
   window.__reload=1;document.dispatchEvent(new Event('daylight:workspace-ready'))},kind);
  await sleep(1200);
  const st=await page.evaluate(()=>({sec:state.section,body:document.body.classList.contains('restricted'),hello:(document.querySelector('.dl-sup-hello')||{}).textContent,reason:(document.querySelector('.dl-restr-r')||{}).textContent,appeal:(document.querySelector('.dl-appeal b')||{}).textContent,greet:/Good (morning|afternoon|evening)/.test(document.body.innerText)||/How can we help you\?/.test((document.querySelector('.dl-sup-sub')||{}).textContent==='How can we help you?'?'How can we help you?':'')}));
  check(st.body&&st.sec==='support','('+kind+') lands in the Support Center',st);
  check(kind==='banned'?st.hello==='Your account is banned':/^Your account is suspended until /.test(st.hello),'('+kind+') the home shows the status instead of the greeting',st.hello);
  check(/Repeated abuse/.test(st.reason||''),'('+kind+') and the reason they were given');
  check(st.appeal===(kind==='banned'?'Appeal your ban':'Appeal your suspension'),'('+kind+') a big Appeal button sits under everything',st.appeal);
  const lock=await page.evaluate(()=>{const lockedOf=sel=>[...document.querySelectorAll(sel)].filter(e=>!e.closest('.profile-wrap')).every(e=>e.hasAttribute('data-lock')||e.closest('[data-lock]'));const open=[...document.querySelectorAll('#sidebar [data-side-support],#sidebar .side-row[title=Settings],#sidebar .profile-row')].every(e=>!e.hasAttribute('data-lock'));
   const cal=document.querySelector('#sidebar .side-row[title=Calendar]'),tasks=document.querySelector('#sidebar .side-row[title=Tasks]'),create=[...document.querySelectorAll('#sidebar button')].find(b=>/Create/.test(b.textContent));
   return {open,cal:cal&&cal.hasAttribute('data-lock'),tasks:tasks&&tasks.hasAttribute('data-lock'),create:create&&create.hasAttribute('data-lock'),opLock:cal&&getComputedStyle(cal).pointerEvents}});
  check(lock.open&&lock.cal&&lock.tasks&&lock.create&&lock.opLock==='none','('+kind+') Calendar, Tasks, Create and the rest are greyed out and unclickable; Support Center, Settings and the account menu stay usable',lock);
  await page.evaluate(()=>{const b=document.querySelector('.dl-notif-btn');b&&b.click()});await sleep(500);
  const nt=await page.evaluate(()=>({m:(document.querySelector('.dl-notif-restricted')||{}).textContent,items:document.querySelectorAll('.dl-notif-item').length,x:!!document.querySelector('.dl-notif-close')}));
  check(nt.m===(kind==='banned'?'Your account is banned — you can’t view your notifications.':'Your account is suspended — you can’t view your notifications.')&&nt.items===0&&nt.x,'('+kind+') notifications show one clear message and have a close button',nt);
  await page.evaluate(()=>{const x=document.querySelector('.dl-notif-close');x&&x.click()});await sleep(300);
  await page.keyboard.press('n');await sleep(300);
  check(await page.evaluate(()=>!document.querySelector('.dialog')),'('+kind+') shortcuts such as N do not open the event form');
  if(theme==='light')await page.screenshot({path:process.env.SHOTS?process.env.SHOTS+'/restricted-'+kind+'.png':undefined}).catch(()=>{});
  await page.click('.dl-appeal');await sleep(500);
  const ap=await page.evaluate(()=>({h:document.querySelector('.dl-sheet-h h2').textContent,cat:!!document.querySelector('#dlTkCat'),catShown:document.querySelector('#dlTkCat').closest('div').style.display!=='none',title:document.querySelector('#dlTkTitle').value}));
  check(ap.h===(kind==='banned'?'Appeal your ban':'Appeal your suspension')&&!ap.catShown,'('+kind+') the Appeal button opens an appeal form (no category to pick)',ap);
  await page.type('#dlTkBody','Please review this decision.');await page.click('[data-ok]');await sleep(900);
  check(await page.evaluate(()=>window.__calls.some(c=>c.p_category==='appeal'&&/Please review/.test(c.p_body))),'('+kind+') sending it creates an appeal ticket');
  // lifting restores everything
  await page.evaluate(()=>{const c=window.daylightCloud,prev=c.client.rpc;c.client.rpc=function(n,a){if(n==='my_account_status')return Promise.resolve({data:{status:'active'},error:null});return prev(n,a)};document.dispatchEvent(new Event('daylight:workspace-ready'))});await sleep(1200);
  check(await page.evaluate(()=>!document.body.classList.contains('restricted')&&!document.querySelector('[data-lock]')&&!window.daylightRestricted),'('+kind+') once lifted, full access returns');
  check(app.errors.length===0,'no page errors',app.errors);
 }finally{await app.close()}
}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
