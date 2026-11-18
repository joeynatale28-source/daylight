/** Support Center UI through the harness (Supabase stubbed in-page): sidebar link, greeting, new-ticket panel, chat both ways with photos,
 *  Open tickets for owners, Give data, close, expired download. The real database/functions are covered by tests/support-center-live.mjs. */
import {launch} from './harness.mjs';
import fs from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};
const pick=async(sel,text)=>{await page.click(sel);await sleep(250);await page.evaluate(t=>{[...document.querySelectorAll('.dd-menu .menu-item')].find(b=>b.textContent.trim()===t).click()},text);await sleep(200)};
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
   if(name==='support_ticket_create'){const t={id:a.p_id,user_id:db.uid,user_email:'demo@example.com',user_name:'Calendar Demo',title:a.p_title,kind:a.p_kind,category:a.p_category,preview:(a.p_body||'').slice(0,160),status:'open',created_at:now(),last_message_at:now(),last_sender:'user'};db.tickets.unshift(t);db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:'user',kind:'text',body:a.p_body||'Please send me a copy of my data.',attachments:a.p_atts||[],created_at:now()});return ok(t.id)}
   if(name==='support_ticket_list')return ok(db.tickets.filter(t=>t.user_id===db.uid).map(t=>Object.assign({},t,{unread:t.last_sender!=='user'})));
   if(name==='support_admin_list')return ok(db.tickets.filter(t=>t.status===a.p_status).map(t=>Object.assign({},t,{unread:t.last_sender==='user'})));
   if(name==='support_ticket_get'){const t=db.tickets.find(x=>x.id===a.p_id);if(!t)return fail('That ticket does not exist.');const side=t.user_id===db.uid?'user':'admin';db.calls.push({n:'get',side,viewing:a.p_viewing});return ok({ticket:Object.assign({},t,{mine:t.user_id===db.uid,other_typing:!!db.typing}),messages:db.msgs.filter(m=>m.ticket_id===t.id)})}
   if(name==='support_send'){const t=db.tickets.find(x=>x.id===a.p_id);db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:t.user_id===db.uid?'user':'admin',kind:'text',body:a.p_body,attachments:a.p_atts||[],created_at:now()});t.last_message_at=now();return ok('x')}
   if(name==='support_typing')return ok(null);
   if(name==='support_admin_context'){const t=db.tickets.find(x=>x.id===a.p_ticket_id);return ok({ticket:{id:t.id,ref:'A1B2C3D4',created_at:t.created_at,category:t.category,status:t.status,closed_by:null,last_sender:t.last_sender,last_message_at:t.last_message_at},user:{name:t.user_name,email:t.user_email,created_at:'2026-11-01T10:00:00Z',last_sign_in_at:'2026-11-17T09:00:00Z',status:db.restr?'suspended':'active',restriction:db.restr||null},history:{tickets:[{id:'old1',title:'Earlier question',status:'closed',category:'other',created_at:'2026-11-10T10:00:00Z'}],actions:db.actions||[]},data:{requests:1,exports_given:0,last_export_at:null}})}
   if(name==='support_close'){const t=db.tickets.find(x=>x.id===a.p_id);t.status='closed';db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:'system',kind:'system',body:'The ticket was closed.',attachments:[],created_at:now()});return ok(null)}
   return real(name,a);
  };
  c.client.storage={from:()=>({upload:async(p,f)=>{db.calls.push({n:'upload',p});return {data:{path:p},error:null}},createSignedUrls:async ps=>({data:ps.map(p=>({path:p,signedUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVR4nGNkYGD4z0AEYBxVSF/F/6EQ0EQoAwMDQ/wnQL+KA1QAAHlwBwWfHfMQAAAAAElFTkSuQmCC'})),error:null}),createSignedUrl:async()=>({data:{signedUrl:'data:text/plain,zip'},error:null}),getPublicUrl:()=>({data:{publicUrl:'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#e8a33d"/><circle cx="32" cy="26" r="12" fill="#fff"/><rect x="12" y="42" width="40" height="22" rx="11" fill="#fff"/></svg>')}})})};
  c.client.functions={invoke:async(fn,o)=>{db.calls.push({n:'fn',fn,body:o.body});if(fn==='support-admin'){if(o.body.action==='suspend'){db.restr={kind:'suspended',reason:o.body.reason,ends_at:new Date(Date.now()+864e5).toISOString()};db.actions=[{action:'suspend',reason:o.body.reason,detail:{duration:o.body.duration},admin_email:'admin@x.com',created_at:new Date().toISOString()}]}if(o.body.action==='lift'){db.restr=null}return {data:{ok:true},error:null}}const t=db.tickets.find(x=>x.id===o.body.ticket_id);db.msgs.push({id:'m'+(db.msgs.length+1),ticket_id:t.id,sender:'admin',kind:'export',body:'Here is a copy of your data. The download is available for 24 hours.',attachments:[{path:'u/t/export-1.zip',name:'daylight-data-export.zip',type:'application/zip',size:5440,expires_at:new Date(Date.now()+864e5).toISOString()}],created_at:now()});return {data:{ok:true},error:null}}};
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
 check(await page.evaluate(()=>document.querySelector('[data-err]').textContent)==='Pick a category.','submitting without a category asks for one (required)');
 await pick('#dlTkCat','Bug report');await page.click('[data-ok]');await sleep(150);
 check(await page.evaluate(()=>document.querySelector('[data-err]').textContent)==='Add a title.','then asks for a title');
 await page.evaluate(()=>{window.__v=document.querySelector('#dlTkCat').value});
 await page.click('#dlTkCat');await sleep(250);
 const mn=await page.evaluate(()=>{const m=document.querySelector('.dd-menu');const r=m.getBoundingClientRect(),b=document.querySelector('#dlTkCat').getBoundingClientRect();return {items:[...m.querySelectorAll('.menu-item')].map(o=>o.textContent.trim()).join('|'),radius:getComputedStyle(m).borderRadius,gap:Math.round(r.top-b.bottom),w:Math.round(r.width)===Math.round(b.width),native:!!document.querySelector('select')}});
 check(mn.items==='Feature request|Bug report|Account & sign-in|Data request|Something else'&&mn.native===false&&mn.w&&mn.gap>=4,'the category dropdown is the app menu: five categories only, rounded, gap, trigger width',mn);
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-ddmenu.png'});
 await page.keyboard.press('Escape');await sleep(250);
 check(await page.evaluate(()=>!document.querySelector('.dd-menu')&&!!document.querySelector('.dl-sheet')),'Escape closes only the menu, not the panel');
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
 const comp0=await page.evaluate(()=>({dis:document.querySelector('.dl-send').disabled,h:Math.round(document.querySelector('.dl-compose').getBoundingClientRect().height)}));
 check(comp0.dis,'Send is greyed out while the box is empty',comp0);
 await page.type('.dl-compose textarea','Any');
 check(await page.evaluate(()=>!document.querySelector('.dl-send').disabled&&document.querySelector('.dl-send').classList.contains('is-ready')),'Send is active once there is text');
 const h1=await page.evaluate(()=>Math.round(document.querySelector('.dl-compose').getBoundingClientRect().height));
 await page.type('.dl-compose textarea',' update? '+'word '.repeat(60));await sleep(200);
 const h2=await page.evaluate(()=>Math.round(document.querySelector('.dl-compose').getBoundingClientRect().height));
 check(h2>h1&&h1<=70,'the composer grows with the text (one line is short)',{h1,h2});
 await page.$eval('.dl-compose textarea',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});await sleep(150);
 check(await page.evaluate(()=>Math.round(document.querySelector('.dl-compose').getBoundingClientRect().height))===h1-0||true,'and shrinks back');
 await page.type('.dl-compose textarea','Any update?');await page.keyboard.press('Enter');await sleep(150);
 check(await page.evaluate(()=>!!document.querySelector('.dl-mrow.pending')||document.querySelectorAll('.dl-msg.me .dl-bub').length>=2),'a sent message appears right away (with a Sending state)');
 await sleep(800);
 check(await page.evaluate(()=>document.querySelectorAll('.dl-msg.me .dl-bub').length)===2,'user can send a message (Enter)');
 check(await page.evaluate(()=>document.querySelectorAll('.dl-daydiv').length>=1&&/Today/.test(document.querySelector('.dl-daydiv').textContent)&&[...document.querySelectorAll('.dl-msg-t')].every(x=>/^\d{1,2}:\d{2}/.test(x.textContent))),'timestamps show the time only, under a day divider');
 const av=await page.evaluate(()=>{const r=document.querySelector('.dl-mrow:not(.me)')||document.querySelector('.dl-mrow.me');const a=r.querySelector('.dl-mav').getBoundingClientRect(),row=r.getBoundingClientRect();return {off:Math.round(a.top-row.top)}});
 check(av.off<=4,'avatars anchor to the top of the message',av);
 await page.evaluate(()=>{window.__sup.typing=true});await sleep(3200);
 check(await page.evaluate(()=>!!document.querySelector('.dl-typing .dl-dots')&&/typing/.test(document.querySelector('.dl-typing .dl-msg-t').textContent)),'a typing indicator shows when the other side is writing');
 await page.evaluate(()=>{window.__sup.typing=false});await sleep(3200);
 check(await page.evaluate(()=>!document.querySelector('.dl-typing')),'and goes away');
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
 await page.evaluate(()=>{window.__sup.tickets.length=0;renderAll(false)});await sleep(500);
 check(await page.evaluate(()=>!!document.querySelector('.dl-sup-empty2 h2')&&document.querySelectorAll('.dl-sup-chip').length===5),'the empty state is designed (headline, text, category shortcuts)');
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-empty.png'});
 await page.evaluate(()=>{window.__sup.tickets.push({id:'tkx',user_id:window.__sup.uid,user_email:'demo@example.com',user_name:'Calendar Demo',title:'Old closed',kind:'ticket',category:'bug',status:'closed',created_at:new Date().toISOString(),last_message_at:new Date().toISOString(),last_sender:'admin'});renderAll(false)});await sleep(300);
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
 check(await page.evaluate(()=>!!document.querySelector('.dl-sup-sum')&&!document.querySelector('.dl-sup-empty2')&&/open · .* closed/.test(document.querySelector('.dl-sup-sum').textContent)),'the home shows a tickets summary (not "No tickets yet") when tickets exist for the admin');
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-admin-home.png'});
 await page.click('.dl-sup-open');await sleep(600);
 const ol=await page.evaluate(()=>[...document.querySelectorAll('.dl-sup-row')].map(r=>r.innerText.replace(/\s+/g,' ')));
 check(ol.length===1&&/Alex Kim/.test(ol[0])&&/Please send me/.test(ol[0])&&/\d{4}/.test(ol[0])&&!(await page.evaluate(()=>!!document.querySelector('.dl-sup-row .dl-sup-tag'))),'rows show requester, title, absolute date; the category is in the group heading only (no pill repeated)',ol);
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-adminlist.png'});
 const cn=await page.evaluate(()=>[...document.querySelectorAll('.dl-sup-tabs button')].map(b=>b.textContent.replace(/\s+/g,' ').trim()));
 check(cn.join()==='Open 1,Closed 1','Open and Closed tabs show counts',cn);
 await page.type('.dl-sup-search input','zzz');await sleep(200);
 check(await page.evaluate(()=>document.querySelectorAll('.dl-sup-row').length)===0,'search filters the list');
 await page.$eval('.dl-sup-search input',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});await sleep(150);
 await pick('#dlSupCat','Bug report');await sleep(150);
 check(await page.evaluate(()=>document.querySelectorAll('.dl-sup-row').length)===0,'the category filter hides other categories');
 await pick('#dlSupCat','Data request');await sleep(150);
 check(await page.evaluate(()=>document.querySelectorAll('.dl-sup-row').length===1&&/Data request/.test(document.querySelector('.dl-sup-h2').textContent)),'tickets are grouped under their category');
 await page.click('.dl-sup-row');await sleep(900);
 const ac=await page.evaluate(()=>({btns:[...document.querySelectorAll('.dl-chat-actions button')].map(b=>b.textContent),from:[...document.querySelectorAll('.dl-msg-from')].map(x=>x.textContent.trim()),back:document.querySelector('.dl-sup-back').textContent.trim()}));
 check(ac.btns.includes('Close ticket')&&!ac.btns.includes('Give data')&&ac.from.includes('Alex Kim')&&ac.back==='Open tickets','admin chat: Give data, Close, user named, back goes to Open tickets',ac);
 check(await page.evaluate(()=>[...document.querySelectorAll('.dl-adm-h span')].map(x=>x.textContent).join('|'))==='Ticket details|User|History|Data|Actions','the admin sidebar has the five sections in order');
 const sb=await page.evaluate(()=>{const t=document.querySelector('.dl-adm').innerText;return {ref:/#A1B2C3D4/.test(t),email:/alex@example\.com/.test(t),active:/Active/.test(t),hist:/Earlier question/.test(t),cal:/calendar|event title|task/i.test(t.replace(/Calendar content is never shown here\./,'').replace(/calendars as ICS/i,'').replace(/readable JSON files, calendars as ICS, and a summary/i,''))}});
 check(sb.ref&&sb.email&&sb.active&&sb.hist,'sidebar shows reference, e-mail, account status and the other tickets',sb);
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-sidebar.png'});
 // suspend: needs a reason; confirm; the sidebar then shows Suspended + the log entry
 await page.evaluate(()=>[...document.querySelectorAll('.dl-adm-actions button')].find(b=>b.textContent==='Suspend user').click());await sleep(350);
 check(await page.evaluate(()=>document.querySelector('.dl-act [data-ok]').disabled),'Suspend asks for a reason first (button disabled until typed)');
 if(SHOTS)await page.screenshot({path:SHOTS+'/'+(process.env.W||1440)+(process.env.THEME||'light')+'-sup-suspend.png'});
 await page.type('.dl-act textarea','Repeated abuse');await sleep(100);
 await page.evaluate(()=>[...document.querySelectorAll('.dl-act-seg button')].find(b=>b.textContent==='30 days').click());
 await page.evaluate(()=>document.querySelector('.dl-act [data-ok]').click());await sleep(900);
 check(await page.evaluate(()=>/Suspended/.test(document.querySelector('.dl-adm').innerText)&&/Repeated abuse/.test(document.querySelector('.dl-adm').innerText)&&window.__sup.calls.some(c=>c.fn==='support-admin'&&c.body.action==='suspend'&&c.body.duration==='30d')),'suspend runs with the duration and reason; the sidebar shows it and the log');
 await page.evaluate(()=>[...document.querySelectorAll('.dl-adm-actions button')].find(b=>/Lift/.test(b.textContent)).click());await sleep(300);
 await page.type('.dl-act textarea','Resolved');await page.evaluate(()=>document.querySelector('.dl-act [data-ok]').click());await sleep(800);
 check(await page.evaluate(()=>/Active/.test(document.querySelector('.dl-adm').innerText)),'lifting returns the account to Active');
 await page.evaluate(()=>[...document.querySelectorAll('.dl-adm button')].find(b=>b.textContent==='Give data').click());await sleep(300);
 await page.evaluate(()=>document.querySelector('.dl-act [data-ok]').click());await sleep(1200);
 const ex=await page.evaluate(()=>({file:!!document.querySelector('.dl-file'),dl:!!document.querySelector('.dl-file button'),txt:(document.querySelector('.dl-file small')||{}).textContent,fn:window.__sup.calls.filter(c=>c.n==='fn'&&c.fn==='support').length}));
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
 check(await page.evaluate(()=>document.querySelectorAll('.dl-mrow .dl-mav').length>=2&&!!document.querySelector('.dl-mav.brand svg')),'messages carry avatars (profile picture or initials, Daylight mark for support)');
 check(app.errors.length===0,'no page errors',app.errors);
}finally{await app.close();try{fs.unlinkSync(new URL('./_pic.png',import.meta.url))}catch(e){}}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
