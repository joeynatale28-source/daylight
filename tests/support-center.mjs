/** Support Center UI through the harness (Supabase stubbed in-page): sidebar link, greeting, new-ticket panel, chat both ways with photos,
 *  Open tickets for owners, Give data, close, expired download. The real database/functions are covered by tests/support-center-live.mjs. */
import {launch} from './harness.mjs';
import fs from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};
const SHOTS=process.env.SHOTS||null;
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVR4nGNkYGD4z0AEYBxVSF/F/6EQ0EQoAwMDQ/wnQL+KA1QAAHlwBwWfHfMQAAAAAElFTkSuQmCC','base64');
fs.writeFileSync(new URL('./_pic.png',import.meta.url),PNG);
const LIVE=process.env.LIVE_URL?process.env.LIVE_URL.replace(/\/?$/,'/'):null;
const app=await launch(Object.assign({width:+process.env.W||1440,height:+process.env.H||900,theme:process.env.THEME||'light'},LIVE?{baseUrl:LIVE+'dashboard/?cb='+Date.now()}:{}));
const page=app.page;page.on('console',m=>{if(/rror|nhandled/i.test(m.text()))console.log('CONSOLE',m.text().slice(0,300))});page.on('pageerror',e=>console.log('PAGEERR',e.message));
try{
 await app.load();await sleep(500);
 await page.evaluate(()=>{
  const c=window.daylightCloud,db=window.__sup={tickets:[],msgs:[],calls:[],viewing:{},owner:false,uid:c.user.id};
  const real=c.client.rpc.bind(c.client);
  const now=()=>new Date().toISOString();
  const other=()=>db.asAdmin?'user':'admin';
  const viewerOf=t=>db.asAdmin&&t.user_id!==db.uid?'admin':'user';
  c.client.rpc=function(name,a){
   const ok=d=>Promise.resolve({data:d,error:null}),fail=m=>Promise.resolve({data:null,error:{message:m}});
   if(name==='support_ticket_create'){const t={id:a.p_id,user_id:db.uid,user_email:'demo@example.com',user_name:'Calendar Demo',title:a.p_title,kind:a.p_kind,status:'open',created_at:now(),last_message_at:now(),last_sender:'user'};db.tickets.unshift(t);db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:'user',kind:'text',body:a.p_body||'Please send me a copy of my data.',attachments:a.p_atts||[],created_at:now()});return ok(t.id)}
   if(name==='support_ticket_list')return ok(db.tickets.filter(t=>t.user_id===db.uid).map(t=>Object.assign({},t,{unread:t.last_sender!=='user'})));
   if(name==='support_admin_list')return ok(db.tickets.filter(t=>t.status===a.p_status).map(t=>Object.assign({},t,{unread:t.last_sender==='user'})));
   if(name==='support_ticket_get'){const t=db.tickets.find(x=>x.id===a.p_id);if(!t)return fail('That ticket does not exist.');const side=t.user_id===db.uid?'user':'admin';db.calls.push({n:'get',side,viewing:a.p_viewing});return ok({ticket:Object.assign({},t,{mine:t.user_id===db.uid}),messages:db.msgs.filter(m=>m.ticket_id===t.id)})}
   if(name==='support_send'){const t=db.tickets.find(x=>x.id===a.p_id);db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:t.user_id===db.uid?'user':'admin',kind:'text',body:a.p_body,attachments:a.p_atts||[],created_at:now()});t.last_message_at=now();return ok('x')}
   if(name==='support_close'){const t=db.tickets.find(x=>x.id===a.p_id);t.status='closed';db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:'system',kind:'system',body:'The ticket was closed.',attachments:[],created_at:now()});return ok(null)}
   return real(name,a);
  };
  c.client.storage={from:()=>({upload:async(p,f)=>{db.calls.push({n:'upload',p});return {data:{path:p},error:null}},createSignedUrls:async ps=>({data:ps.map(p=>({path:p,signedUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVR4nGNkYGD4z0AEYBxVSF/F/6EQ0EQoAwMDQ/wnQL+KA1QAAHlwBwWfHfMQAAAAAElFTkSuQmCC'})),error:null}),createSignedUrl:async()=>({data:{signedUrl:'data:text/plain,zip'},error:null})})};
  c.client.functions={invoke:async(fn,o)=>{db.calls.push({n:'fn',fn,body:o.body});const t=db.tickets.find(x=>x.id===o.body.ticket_id);db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:'admin',kind:'export',body:'Here is a copy of your data. The download is available for 24 hours.',attachments:[{path:'u/t/export-1.zip',name:'daylight-data-export.zip',type:'application/zip',size:5440,expires_at:new Date(Date.now()+864e5).toISOString()}],created_at:now()});return {data:{ok:true},error:null}}};
  window.daylightAdmin.isOwner=()=>db.owner;
  c.user.user_metadata=Object.assign({},c.user.user_metadata,{full_name:'Maya Rivera'});
 });
 // sidebar link
 await page.evaluate(()=>renderAll(false));await sleep(300);
 const row=await page.evaluate(()=>{const b=document.querySelector('[data-side-support]');return b?{t:b.textContent.trim(),prev:b.closest('#sidebar')&&[...document.querySelectorAll('#sidebar .side-title,#sidebar .side-label,#sidebar h3,#sidebar .section-title')].map(x=>x.textContent.trim())}:null});
 check(row&&row.t==='Support Center','sidebar has a Support Center link',row);
 await page.evaluate(()=>document.querySelector('[data-side-support]').click());await sleep(500);
 const home=await page.evaluate(()=>({h:document.querySelector('.dl-sup-hello').textContent,sub:document.querySelector('.dl-sup-sub').textContent,btns:[...document.querySelectorAll('.dl-sup-cta button')].map(b=>b.textContent.trim()),cal:!!document.querySelector('.month-grid'),side:!!document.getElementById('sidebar'),active:document.querySelector('[data-side-support]').classList.contains('active'),open:!!document.querySelector('.dl-sup-open')}));
 const hr=new Date().getHours(),part=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
 check(home.h===part+', Maya'&&home.sub==='How can we help you?','greeting by time of day + first name',home);
 check(home.btns.join()==='Create new ticket,Request your data'&&!home.cal&&home.side&&home.active,'buttons, calendar replaced, sidebar stays',home);
 check(!home.open,'no Open tickets button for a normal account');
 // greeting without a name
 await page.evaluate(()=>{window.daylightCloud.user.user_metadata.full_name='';window.daylightCloud.user.user_metadata.name='';renderAll(false)});await sleep(300);
 check(await page.evaluate(()=>/^Good (morning|afternoon|evening)$/.test(document.querySelector('.dl-sup-hello').textContent)),'greeting with no name has no comma');
 await page.evaluate(()=>{window.daylightCloud.user.user_metadata.full_name='Maya Rivera';renderAll(false)});await sleep(300);
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-home.png'});
 // new ticket: side panel, not a centered window
 await page.click('[data-new]');await sleep(400);
 const sh=await page.evaluate(()=>{const s=document.querySelector('.dl-sheet');const r=s.getBoundingClientRect();return {right:Math.round(innerWidth-r.right),w:Math.round(r.width),h:Math.round(r.height),fields:!!document.querySelector('#dlTkTitle')&&!!document.querySelector('#dlTkBody')&&!!document.querySelector('[data-add]')}});
 check(sh.right===0&&sh.fields&&sh.h>=(+process.env.H||900)-20,'new ticket opens as a right-side panel with title, details, photos',sh);
 await page.click('[data-ok]');await sleep(150);
 check(await page.evaluate(()=>document.querySelector('[data-err]').textContent)==='Add a title.','submitting empty asks for a title');
 await page.type('#dlTkTitle','Calendar will not load');await page.type('#dlTkBody','The month view is blank after I sign in.');
 // photo attach
 const [fc]=await Promise.all([page.waitForFileChooser(),page.click('.dl-sheet [data-add]')]);
 await fc.accept([new URL('./_pic.png',import.meta.url).pathname.replace(/^\//,'')]);await sleep(300);
 check(await page.evaluate(()=>document.querySelectorAll('.dl-sheet .dl-thumb').length)===1,'a photo can be attached');
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-sheet.png'});
 await page.click('[data-ok]');await sleep(900);
 const chat=await page.evaluate(()=>({h:(document.querySelector('.dl-chat-head h1')||{}).textContent,msgs:document.querySelectorAll('.dl-bub').length,pics:document.querySelectorAll('.dl-pics img').length,calls:window.__sup.calls.filter(c=>c.n==='upload').length}));
 console.log('HTML',(await page.evaluate(()=>document.querySelector('.dl-sup').innerHTML)).slice(0,900));check(chat.h==='Calendar will not load'&&chat.msgs===1&&chat.pics===1&&chat.calls===1,'submitting creates the ticket and opens its chat (message + photo)',chat);
 // user sends a message
 await page.type('.dl-compose textarea','Any update?');await page.keyboard.press('Enter');await sleep(800);
 check(await page.evaluate(()=>document.querySelectorAll('.dl-msg.me .dl-bub').length)===2,'user can send a message (Enter)');
 // chat keeps "viewing" heartbeats
 await sleep(4500);
 check(await page.evaluate(()=>window.__sup.calls.filter(c=>c.n==='get'&&c.viewing===true).length)>=2,'the open chat reports that the ticket is being viewed');
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-chat.png'});
 // admin reply arrives (as if sent by support) and shows with Daylight Support + seal
 await page.evaluate(()=>{const t=window.__sup.tickets[0];window.__sup.msgs.push({id:'ma1',ticket_id:t.id,sender:'admin',kind:'text',body:'Thanks, looking into it now.',attachments:[],created_at:new Date().toISOString()});t.last_sender='admin'});
 await sleep(4800);
 const adm=await page.evaluate(()=>({from:[...document.querySelectorAll('.dl-msg-from')].map(x=>x.textContent.trim()),seal:document.querySelectorAll('.dl-msg-from .dl-verified').length,last:[...document.querySelectorAll('.dl-bub')].pop().textContent}));
 check(adm.from.includes('Daylight Support')&&adm.seal>=1&&/looking into it/.test(adm.last),'a support reply shows up live as "Daylight Support" with the verified seal',adm);
 // close from the user side
 await page.evaluate(()=>[...document.querySelectorAll('.dl-chat-actions button')].find(b=>/Close ticket/.test(b.textContent)).click());await sleep(300);
 await page.evaluate(()=>document.querySelector('.dl-confirm [data-ok]').click());await sleep(900);
 check(await page.evaluate(()=>!!document.querySelector('.dl-closed-note')&&!document.querySelector('.dl-compose')),'closing a ticket ends the conversation (composer replaced)');
 // home lists open and closed
 await page.click('.dl-sup-back');await sleep(700);
 const lists=await page.evaluate(()=>({h:[...document.querySelectorAll('.dl-sup-h2')].map(x=>x.textContent),rows:document.querySelectorAll('.dl-sup-row').length}));
 check(lists.h.includes('Closed')&&lists.rows===1,'closed tickets stay in the list',lists);
 // data request
 await page.click('[data-data]');await sleep(300);await page.evaluate(()=>document.querySelector('.dl-confirm [data-ok]').click());await sleep(900);
 check(await page.evaluate(()=>/Data request/.test(document.querySelector('.dl-chat-meta').textContent)),'Request your data opens a data-request ticket');
 // owner view
 await page.evaluate(()=>{window.__sup.owner=true;window.__sup.asAdmin=true;window.__sup.uid='someone-else'});
 // pretend the data ticket belongs to the user and the admin is a different account
 await page.evaluate(()=>{window.__sup.tickets.forEach(t=>t.user_id='user-1');window.__sup.tickets.forEach(t=>{t.user_name='Alex Kim';t.user_email='alex@example.com'});renderAll(false)});await sleep(300);
 await page.evaluate(()=>{state.section='support';renderAll(false)});await sleep(400);
 await page.evaluate(()=>document.querySelector('[data-side-support]').click());await sleep(500);
 check(await page.evaluate(()=>/Open tickets/.test((document.querySelector('.dl-sup-open')||{}).textContent||'')),'owner sees an "Open tickets" button');
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-admin-home.png'});
 await page.click('.dl-sup-open');await sleep(600);
 const ol=await page.evaluate(()=>[...document.querySelectorAll('.dl-sup-row')].map(r=>r.innerText.replace(/\s+/g,' ')));
 check(ol.length===1&&/Data request/.test(ol[0])&&/Alex Kim/.test(ol[0]),'Open tickets lists open tickets with who asked',ol);
 await page.click('.dl-sup-row');await sleep(900);
 const ac=await page.evaluate(()=>({btns:[...document.querySelectorAll('.dl-chat-actions button')].map(b=>b.textContent),from:[...document.querySelectorAll('.dl-msg-from')].map(x=>x.textContent.trim()),back:document.querySelector('.dl-sup-back').textContent.trim()}));
 check(ac.btns.includes('Give data')&&ac.btns.includes('Close ticket')&&ac.from.includes('Alex Kim')&&ac.back==='Open tickets','admin chat: Give data, Close, user named, back goes to Open tickets',ac);
 await page.evaluate(()=>[...document.querySelectorAll('.dl-chat-actions button')].find(b=>b.textContent==='Give data').click());await sleep(300);
 await page.evaluate(()=>document.querySelector('.dl-confirm [data-ok]').click());await sleep(1200);
 const ex=await page.evaluate(()=>({file:!!document.querySelector('.dl-file'),dl:!!document.querySelector('.dl-file button'),txt:(document.querySelector('.dl-file small')||{}).textContent,fn:window.__sup.calls.filter(c=>c.n==='fn').length}));
 check(ex.file&&ex.dl&&/available until/.test(ex.txt)&&ex.fn===1,'Give data posts a downloadable export with an expiry',ex);
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-admin-chat.png'});
 // admin sends with a photo
 const [fc2]=await Promise.all([page.waitForFileChooser(),page.click('.dl-compose [data-add]')]);
 await fc2.accept([new URL('./_pic.png',import.meta.url).pathname.replace(/^\//,'')]);await sleep(300);
 await page.type('.dl-compose textarea','Here you go.');await page.keyboard.press('Enter');await sleep(1000);
 check(await page.evaluate(()=>document.querySelectorAll('.dl-msg.me .dl-pics img').length)>=1,'admin can reply with a photo');
 // expired export reads as expired
 await page.evaluate(()=>{window.__sup.msgs.forEach(m=>{if(m.kind==='export')m.attachments[0].expires_at=new Date(Date.now()-1000).toISOString()})});await sleep(6500);
 console.log('DBG',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.dl-file')].map(f=>f.innerText))));
 check(await page.evaluate(()=>/Expired/.test((document.querySelector('.dl-file small')||{}).textContent||'')&&!document.querySelector('.dl-file button')),'an expired download says so and has no button');
 check(app.errors.length===0,'no page errors',app.errors);
}finally{await app.close();try{fs.unlinkSync(new URL('./_pic.png',import.meta.url))}catch(e){}}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
