/**
 * Calendar sharing between accounts, on the real page, both themes. Two accounts at the client boundary: the OWNER (the sender)
 * and the TEST account (the recipient). The page's own code runs for real; the database is a stand-in that follows the same
 * rules as supabase/sql/20261126_calendar_sharing.sql (those rules are proven in real Postgres by tests/sharing-sql.mjs).
 *  - Item 3: the invite row in every state; person cards; permission menu; pending and accepted rows;
 *  - Item 4: the invite notification, Add morphing in place, Decline settling quietly, no clearing while pending;
 *  - Item 5: the shared calendar in the recipient's sidebar with the owner's name; view-only vs can-edit; revoke; leave.
 * LIVE_URL=<deployed build> runs the same flow against the deployed page (stubbed backend).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload,TINY_AVATAR} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','sharing');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const OWNER={id:id(10),email:'owner@example.com',user_metadata:{full_name:'Olivia Owner'}};
const TEST={id:id(11),email:'user@daylightcal.com',user_metadata:{full_name:'Test Account'}};
const SAM1={id:id(12),email:'sam.lee@example.com',user_metadata:{full_name:'Sam Lee',avatar_url:TINY_AVATAR.split('#')[0]+'#/'+id(12)+'/'}};
const SAM2={id:id(13),email:'sam.park@example.org',user_metadata:{full_name:'Sam Park'}};
const d=(m,dd,h)=>new Date(2026,m-1,dd,h||0).toISOString();
const ownerPayload=()=>{const p=busyPayload();p.calendars=[{id:'c1',name:'Family',color:'blue'},{id:'c2',name:'Work',color:'green'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];
 p.events=[{id:1,cal:'c1',title:'Family dinner',start:d(11,17,19),end:d(11,17,20),allDay:false,loc:'',desc:''},{id:2,cal:'c1',title:'Beach day',start:d(11,19,0),end:new Date(2026,10,19,23,59).toISOString(),allDay:true,loc:'',desc:''},{id:3,cal:'c2',title:'Secret work thing',start:d(11,18,10),end:d(11,18,11),allDay:false,loc:'',desc:''}];
 p.settings={themeMode:'system',profileName:'Olivia Owner',identityOwner:OWNER.id};return p};
const testPayload=()=>{const p=busyPayload();p.calendars=[{id:'c9',name:'Test calendar',color:'violet'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];p.events=[];p.settings={themeMode:'system'};return p};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:ownerPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.evaluateOnNewDocument((acc,po,pt)=>{window.__accounts=acc;acc[po.k].payload=po.p;acc[pt.k].payload=pt.p;window.__ws={};window.__sh={shares:[]}},
   Object.fromEntries([OWNER,TEST,SAM1,SAM2].map(u=>[u.id,{user:u,payload:{calendars:[{id:'x',name:'x'}],events:[]}}])),{k:OWNER.id,p:ownerPayload()},{k:TEST.id,p:testPayload()});
  await app.load();
  const idle=()=>page.waitForFunction(()=>!document.getElementById('dlWorkspaceLoading'),{timeout:8000});
  const signIn=async(who,cal)=>{await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},who);
   await page.waitForFunction(t=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent===t),{timeout:8000},cal);await idle();await sleep(900);
   await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(300)};
  const signOut=async()=>{await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(400)};
  const openManage=async(name)=>{await page.evaluate(n=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent===n);row.querySelector('.cal-menu-btn').click()},name);await page.waitForSelector('.dl-manage');await sleep(500)};
  const goSection=async s=>{await page.evaluate(s=>{const map={sharing:'.dl-inv-input',export:'[data-export]',danger:'[data-danger]',calendar:'#calSettingsName'};const body=document.querySelector('.dl-manage .dl-col-body');body.style.scrollBehavior='auto';const t=document.querySelector('.dl-manage '+map[s]);if(t)t.scrollIntoView({block:'center'})},s);await sleep(400)};
  const closeManage=async()=>{await page.evaluate(()=>document.querySelector('.dl-manage .settings-close')?.click());await page.waitForFunction(()=>!document.querySelector('.dl-manage'),{timeout:4000});await sleep(300)};
  const bell=()=>page.evaluate(()=>{const g=document.querySelector('.dl-notif-btn .dl-notif-badge');return g&&!g.hidden?g.textContent:''});
  const openBell=async()=>{await page.click('.dl-notif-btn');await page.waitForSelector('.dl-notif-panel');await sleep(600)};
  const closeBell=async()=>{await page.keyboard.press('Escape');await sleep(350)};
  const menuItems=()=>page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>({label:b.querySelector('.mi-label')?.textContent,sub:b.querySelector('.mi-sub')?.textContent||'',danger:b.classList.contains('danger')})));
  const sepCount=()=>page.evaluate(()=>document.querySelectorAll('.menu .menu-sep').length);
  const shares=()=>page.evaluate(()=>window.__sh.shares.map(s=>({cal:s.cal,recipient:s.recipient,permission:s.permission,status:s.status})));
  const wsEvents=()=>page.evaluate(oid=>(window.__ws[oid]?window.__ws[oid].payload.events:[]).map(e=>({id:e.id,cal:e.cal,title:e.title})),OWNER.id);
  const sidebar=()=>page.evaluate(()=>({labels:[...document.querySelectorAll('#sidebar .side-label span')].map(n=>n.textContent),shared:[...document.querySelectorAll('#sidebar .cal-row.has-owner')].map(r=>({name:r.querySelector('.cal-name').textContent,owner:r.querySelector('.cal-owner').textContent}))}));

  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);

  // =================================================================== ITEM 3: the owner's invite row
  await signIn(OWNER,'Family');
  await openManage('Family');await goSection('sharing');
  const empty=await page.evaluate(()=>({ph:document.querySelector('.dl-inv-input').placeholder,perm:document.querySelector('[data-perm]').textContent.trim(),send:document.querySelector('[data-send]').disabled,
    rows:[...document.querySelectorAll('.dl-ppl-row')].map(r=>({name:r.querySelector('.dl-ppl-name').textContent,sub:r.querySelector('.dl-ppl-sub').textContent,ctl:!!r.querySelector('.dl-ppl-ctl')})),
    ga:document.querySelector('[data-ga-sub]').textContent,groups:[...document.querySelectorAll('.dl-col-body .set-group-title')].filter(n=>n.offsetParent!==null).map(n=>n.textContent.trim())}));
  check(T('invite row: a search field, the permission picker inside the row (View only), and Send disabled until someone is chosen'),empty.ph==='Search people to share with…'&&/View only/.test(empty.perm)&&empty.send,JSON.stringify(empty));
  check(T('the owner\'s own row says "(You)" in grey and has no control'),empty.rows.length===1&&/\(You\)/.test(empty.rows[0].name)&&!empty.rows[0].ctl&&empty.rows[0].sub==='owner@example.com',JSON.stringify(empty.rows));
  check(T('General access is its own area: lock row, "Only people you share with can access this calendar" while off'),empty.ga==='Only people you share with can access this calendar'&&empty.groups.filter(g=>['Invite people','People with access','General access'].includes(g)).join('|')==='Invite people|People with access|General access',JSON.stringify(empty));
  await page.screenshot({path:path.join(out,`1-invite-empty-${theme}.png`)});
  await page.type('.dl-inv-input','sam');await page.waitForSelector('.dl-person');await sleep(400);
  const cards=await page.evaluate(()=>[...document.querySelectorAll('.dl-person')].map(c=>({name:c.querySelector('b').textContent,bold:getComputedStyle(c.querySelector('b')).fontWeight,email:c.querySelector('.sub').textContent,emailColor:getComputedStyle(c.querySelector('.sub')).color,avatar:!!c.querySelector('.dl-person-avatar'),img:!!c.querySelector('.dl-person-avatar img')})));
  check(T('typing shows person cards: picture, name in bold, email in grey beneath; same names are told apart by email'),cards.length===2&&cards.every(c=>c.avatar&&Number(c.bold)>=600&&c.email.includes('@'))&&new Set(cards.map(c=>c.email)).size===2&&cards.some(c=>c.img),JSON.stringify(cards));
  await page.screenshot({path:path.join(out,`2-invite-typing-cards-${theme}.png`)});
  await page.click('.dl-inv-input',{clickCount:3});await page.keyboard.type('zzzzq');await page.waitForFunction(()=>/No results found/.test((document.querySelector('.dl-inv-results')||{}).innerText||''),{timeout:3000});
  check(T('no match: a plain "No results found — check the spelling" line, and nothing can be sent'),await page.evaluate(()=>document.querySelector('.dl-inv-results').innerText.trim()==='No results found — check the spelling'&&document.querySelector('[data-send]').disabled));
  await page.screenshot({path:path.join(out,`3-invite-no-results-${theme}.png`)});
  await page.click('.dl-inv-input',{clickCount:3});await page.keyboard.type('sam');await page.waitForSelector('.dl-person');await sleep(350);
  await page.evaluate(()=>[...document.querySelectorAll('.dl-person')].find(c=>c.querySelector('b').textContent==='Sam Lee').click());await sleep(300);
  const picked=await page.evaluate(()=>({chip:!document.querySelector('.dl-inv-chip').hidden,text:document.querySelector('.dl-inv-chip').innerText.replace(/\s+/g,' ').trim(),inputHidden:document.querySelector('.dl-inv-input').hidden,send:document.querySelector('[data-send]').disabled,results:document.querySelector('.dl-inv-results').hidden}));
  check(T('picking a person fills the row with exactly who they are about to invite, and only then Send is enabled'),picked.chip&&/Sam Lee/.test(picked.text)&&/sam\.lee@example\.com/.test(picked.text)&&picked.inputHidden&&!picked.send&&picked.results,JSON.stringify(picked));
  await page.screenshot({path:path.join(out,`4-invite-selected-send-enabled-${theme}.png`)});
  await page.click('[data-perm]');await page.waitForSelector('.menu');await sleep(300);
  const pm=await menuItems();
  check(T('the permission menu: Can edit and View only, each with a one-line description'),pm.length===2&&pm[0].label==='Can edit'&&pm[0].sub==='Can add and change events'&&pm[1].label==='View only'&&pm[1].sub==='Can only see events',JSON.stringify(pm));
  await page.screenshot({path:path.join(out,`5-permission-menu-${theme}.png`)});
  await page.keyboard.press('Escape');await sleep(250);
  // invite Sam, then cancel it from the Invited menu (a pending invite is deleted)
  await page.click('[data-send]');await sleep(900);
  let people=await page.evaluate(()=>[...document.querySelectorAll('.dl-ppl-row')].map(r=>({name:r.querySelector('.dl-ppl-name').textContent,ctl:r.querySelector('.dl-ppl-ctl')?r.querySelector('.dl-ppl-ctl').textContent.trim():null})));
  check(T('Send is immediate: the person appears right away as "Invited"'),people.length===2&&people[1].name==='Sam Lee'&&people[1].ctl==='Invited',JSON.stringify(people));
  await page.evaluate(()=>[...document.querySelectorAll('.dl-ppl-row')].find(r=>/Sam Lee/.test(r.textContent)).querySelector('.dl-ppl-ctl').click());await page.waitForSelector('.menu');await sleep(250);
  const inv=await menuItems();const seps=await sepCount();
  check(T('the Invited menu holds: change permission, resend invite, cancel invite (divider between)'),inv.map(i=>i.label).join('|')==='Can edit|View only|Resend invite|Cancel invite'&&seps===1,JSON.stringify(inv));
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Cancel invite/.test(b.textContent)).click());await sleep(800);
  check(T('cancelling a pending invite deletes it'),(await shares()).length===0);
  // the real invite: test account, view only
  await page.type('.dl-inv-input','daylightcal');await page.waitForSelector('.dl-person');await sleep(350);
  await page.evaluate(()=>document.querySelector('.dl-person').click());await sleep(250);
  await page.click('[data-send]');await sleep(900);
  await page.evaluate(()=>[...document.querySelectorAll('.dl-ppl-row')].find(r=>/Test Account/.test(r.textContent)).scrollIntoView());
  await page.screenshot({path:path.join(out,`6-pending-row-${theme}.png`)});
  check(T('the invite exists server-side as pending, View only'),JSON.stringify(await shares())==='[{"cal":"c1","recipient":"'+TEST.id+'","permission":"view","status":"pending"}]',JSON.stringify(await shares()));
  await closeManage();
  // a second invite for later (Work, Can edit)
  await openManage('Work');await goSection('sharing');
  await page.type('.dl-inv-input','daylightcal');await page.waitForSelector('.dl-person');await sleep(350);
  await page.evaluate(()=>document.querySelector('.dl-person').click());await sleep(200);
  await page.click('[data-perm]');await page.waitForSelector('.menu');await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Can edit/.test(b.textContent)).click());await sleep(250);
  await page.click('[data-send]');await sleep(900);
  await closeManage();await signOut();

  // =================================================================== ITEM 4: the notification, Add (morph) and Decline
  await signIn(TEST,'Test calendar');
  check(T('the pending invites count on the bell'),(await bell())==='2',await bell());
  await openBell();
  const n1=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.dl-notif-invite')];const r=rows.find(x=>/Family/.test(x.textContent));window.__inviteNode=r;
   const q=s=>r.querySelector(s);const dot=q('.dl-inv-dot');return {count:rows.length,from:q('.dl-inv-from').textContent,body:q('.dl-inv-body').textContent,cal:q('.dl-inv-cal').textContent,perm:q('.dl-inv-permline').textContent,time:q('.dl-notif-time').textContent,
    avatar:!!q('.dl-person-avatar'),dotColor:getComputedStyle(dot).backgroundColor,addTag:q('[data-invite-add]').tagName,addCls:q('[data-invite-add]').className,decTag:q('[data-invite-decline]').tagName,decCls:q('[data-invite-decline]').className,clear:!!q('.dl-notif-clear'),sender:q('.dl-notif-top').textContent}});
  check(T('the invite shows the sender\'s name, "<Name> shared <calendar> with you", its color dot, the permission and the time'),n1.count===2&&n1.from==='Olivia Owner'&&n1.body==='Olivia Owner shared Family with you'&&n1.cal==='Family'&&n1.perm==='View only'&&!!n1.time&&n1.avatar&&n1.dotColor!=='rgba(0, 0, 0, 0)',JSON.stringify(n1));
  check(T('Add is a filled primary button and Decline a real secondary button; while pending there is nothing to clear it with'),n1.addTag==='BUTTON'&&/btn-primary/.test(n1.addCls)&&n1.decTag==='BUTTON'&&/btn-ghost/.test(n1.decCls)&&!n1.clear,JSON.stringify(n1));
  await page.screenshot({path:path.join(out,`7-invite-notification-${theme}.png`)});
  await page.evaluate(()=>window.__inviteNode.querySelector('[data-invite-add]').click());await sleep(900);
  const n2=await page.evaluate(()=>{const r=window.__inviteNode;return {same:r.isConnected&&document.querySelector('.dl-notif-invite[data-invite-id="'+r.getAttribute('data-invite-id')+'"]')===r,buttons:r.querySelectorAll('[data-invite-add],[data-invite-decline]').length,state:(r.querySelector('.dl-inv-state')||{}).textContent,clear:!!r.querySelector('.dl-notif-clear'),panelOpen:!!document.querySelector('.dl-notif-panel')}});
  check(T('Add: the SAME card morphs in place to a quiet "Added" (buttons gone, no navigation)'),n2.same&&n2.buttons===0&&n2.state==='Added'&&n2.panelOpen,JSON.stringify(n2));
  check(T('after acting, the finished card can be cleared like an ordinary notification'),n2.clear);
  check(T('the badge now counts only the remaining pending invite'),(await bell())==='1',await bell());
  await page.screenshot({path:path.join(out,`8-invite-added-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('.dl-notif-invite')].find(x=>/Work/.test(x.textContent)).querySelector('[data-invite-decline]').click());await sleep(800);
  const n3=await page.evaluate(()=>{const r=[...document.querySelectorAll('.dl-notif-invite')].find(x=>/Work/.test(x.textContent));return {state:(r.querySelector('.dl-inv-state')||{}).textContent,buttons:r.querySelectorAll('[data-invite-add],[data-invite-decline]').length}});
  check(T('Decline: the card settles to a quiet "Declined", buttons gone'),n3.state==='Declined'&&n3.buttons===0,JSON.stringify(n3));
  check(T('nothing was added for the declined invite; the bell badge is clear'),(await bell())===''&&!(await sidebar()).shared.some(x=>x.name==='Work'));
  await page.screenshot({path:path.join(out,`9-invite-declined-${theme}.png`)});
  await closeBell();

  // =================================================================== ITEM 5: the shared calendar, view only
  const sb=await sidebar();
  check(T('the calendar sits in a Shared section, with the owner\'s name under it'),sb.labels.includes('Shared')&&sb.shared.length===1&&sb.shared[0].name==='Family'&&sb.shared[0].owner==='Olivia Owner',JSON.stringify(sb));
  await page.screenshot({path:path.join(out,`10-shared-sidebar-${theme}.png`)});
  check(T('its events show up in the recipient\'s month view'),await page.evaluate(()=>[...document.querySelectorAll('.chip,.dl-continuous-bar')].some(c=>/Family dinner/.test(c.textContent))));
  check(T('the owner\'s other calendar and private data never reach the recipient'),await page.evaluate(()=>!state.events.some(e=>/Secret work thing/.test(e.title))&&!state.calendars.some(c=>c.name==='Work')));
  await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>/Family dinner/.test(c.textContent)).click());await page.waitForSelector('.popover');await sleep(350);
  check(T('VIEW ONLY: the event popover has no edit or delete'),await page.evaluate(()=>!document.querySelector('.popover [data-act="edit"]')&&!document.querySelector('.popover [data-act="del"]')));
  await page.keyboard.press('Escape');await sleep(250);
  check(T('VIEW ONLY: the shared calendar is not offered when creating an event'),await page.evaluate(()=>!writableCalendars().some(c=>c.name==='Family')));
  const before=(await wsEvents()).length;
  // force a change anyway: the database refuses it and the screen snaps back
  await page.evaluate(()=>{state.events=state.events.filter(e=>!/Family dinner/.test(e.title));renderAll(false)});
  await sleep(1400);
  const refusal=await page.evaluate(()=>({back:state.events.some(e=>/Family dinner/.test(e.title)),toast:[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | '),calls:window.__sh.calls.filter(c=>c.name==='daylight_apply_shared_event_ops').length}));
  check(T('VIEW ONLY: a forced delete is refused by the database, the event comes straight back, and the user is told'),refusal.back&&/view this calendar but not change it/i.test(refusal.toast)&&refusal.calls===0,JSON.stringify(refusal));
  const direct=await page.evaluate(async()=>{try{await daylightSharing.rpc('daylight_apply_shared_event_ops',{p_share_id:window.__sh.shares[0].id,p_ops:[{op:'create',event:{title:'Sneaky',start:new Date().toISOString(),end:new Date().toISOString()}}]});return 'allowed'}catch(e){return e.message}});
  check(T('VIEW ONLY: calling the write function directly is refused too, and the owner\'s calendar is unchanged'),/view this calendar but not change it/.test(direct)&&(await wsEvents()).length===before,direct);
  await page.screenshot({path:path.join(out,`11-view-only-refused-${theme}.png`)});

  // the recipient's Manage dialog for a shared calendar
  await openManage('Family');
  const mg=await page.evaluate(()=>({rail:[...document.querySelectorAll('.dl-manage .dl-col-h,.dl-manage .set-group-title')].map(b=>b.textContent.trim()),text:document.querySelector('.dl-col-body').innerText.replace(/\s+/g,' '),name:!!document.querySelector('#calSettingsName')}));
  check(T('the shared calendar\'s Manage dialog is an information view: Calendar and Danger zone only'),mg.rail.includes('Calendar')&&mg.rail.includes('Danger zone')&&!mg.rail.includes('Sharing')&&/Shared by Olivia Owner/.test(mg.text)&&/owner@example\.com/.test(mg.text)&&/View only/.test(mg.text)&&!mg.name,JSON.stringify(mg));
  await page.screenshot({path:path.join(out,`12-shared-manage-${theme}.png`)});
  await page.evaluate(()=>document.querySelectorAll('[data-presets] .dl-sw')[5].click());await sleep(300);
  check(T('a local color override raises the Save pill'),await page.evaluate(()=>!document.querySelector('.dl-manage .settings-savebar').hidden));
  await page.click('.dl-manage .settings-savebar [data-save]');await page.waitForFunction(()=>document.querySelector('.dl-manage .settings-savebar')?.hidden,{timeout:4000});await sleep(400);
  const ov=await page.evaluate(()=>({mine:state.calendars.find(c=>c.name==='Family').color,saved:state.shareColors}));
  check(T('the override is saved for this account only (the owner\'s calendar keeps its color)'),Object.values(ov.saved||{}).length===1&&Object.values(ov.saved)[0]===ov.mine&&ov.mine!=='blue'&&await page.evaluate(oid=>window.__ws[oid]?window.__ws[oid].payload.calendars.find(c=>c.id==='c1').color==='blue':true,OWNER.id),JSON.stringify(ov));
  await closeManage();

  // =================================================================== owner: pending -> accepted row, then Can edit
  await signOut();await signIn(OWNER,'Family');
  await openManage('Family');await goSection('sharing');await sleep(500);
  people=await page.evaluate(()=>[...document.querySelectorAll('.dl-ppl-row')].map(r=>({name:r.querySelector('.dl-ppl-name').textContent,ctl:r.querySelector('.dl-ppl-ctl')?r.querySelector('.dl-ppl-ctl').textContent.trim():null})));
  check(T('the owner now sees the person as an accepted row with their permission'),people.length===2&&people[1].name==='Test Account'&&people[1].ctl==='View only',JSON.stringify(people));
  await page.evaluate(()=>[...document.querySelectorAll('.dl-ppl-row')].find(r=>/Test Account/.test(r.textContent)).scrollIntoView());
  await page.screenshot({path:path.join(out,`13-accepted-row-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('.dl-ppl-row')].find(r=>/Test Account/.test(r.textContent)).querySelector('.dl-ppl-ctl').click());await page.waitForSelector('.menu');await sleep(250);
  const acc=await menuItems();
  check(T('an accepted person\'s menu: change permission, then (after a divider) Remove access in danger styling'),acc.map(i=>i.label).join('|')==='Can edit|View only|Remove access'&&acc[2].danger&&!acc[0].danger&&(await sepCount())===1,JSON.stringify(acc));
  await page.screenshot({path:path.join(out,`14-accepted-menu-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Can edit/.test(b.textContent)).click());await sleep(900);
  check(T('the owner switched the person to Can edit'),(await shares())[0].permission==='edit');
  await closeManage();await signOut();

  // =================================================================== CAN EDIT: the same account can write
  await signIn(TEST,'Test calendar');await page.evaluate(()=>daylightSharing.load());await sleep(900);
  check(T('CAN EDIT: the permission change reached the recipient (the calendar is now editable)'),await page.evaluate(()=>{const c=state.calendars.find(x=>x.name==='Family');return c&&c.sharedFrom.permission==='edit'&&!isSubscribed(c)&&writableCalendars().some(x=>x.name==='Family')}));
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,20)));await page.waitForSelector('#efTitle');await sleep(400);
  await page.type('#efTitle','Added by Test Account');
  await page.click('#efCal');await page.waitForSelector('.menu');await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>b.querySelector('.mi-label')?.textContent==='Family').click());await sleep(300);
  await page.click('[data-save]');await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:5000});await sleep(1600);
  let ev=await wsEvents();
  check(T('CAN EDIT: the new event is written into the ONE shared calendar (the owner\'s), with no copy'),ev.some(e=>e.title==='Added by Test Account'&&e.cal==='c1')&&ev.filter(e=>e.title==='Added by Test Account').length===1,JSON.stringify(ev));
  check(T('CAN EDIT: it is not in the recipient\'s own workspace'),await page.evaluate(()=>!JSON.stringify(window.__lastUpdate||{}).includes('Added by Test Account')));
  await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Added by Test Account');editOccurrence(e,{ev:e,start:e.start,end:e.end})});await page.waitForSelector('.event-form-dialog #efTitle');await sleep(300);
  await page.click('#efTitle',{clickCount:3});await page.type('#efTitle','Renamed by Test Account');await page.click('[data-save]');await page.waitForFunction(()=>!document.querySelector('.event-form-dialog'),{timeout:5000});await sleep(1600);
  ev=await wsEvents();
  check(T('CAN EDIT: an edit changes that same event'),ev.some(e=>e.title==='Renamed by Test Account')&&!ev.some(e=>e.title==='Added by Test Account'),JSON.stringify(ev));
  await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Beach day');confirmDeleteEvent(e,{ev:e,start:e.start,end:e.end})});await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(1600);
  ev=await wsEvents();
  check(T('CAN EDIT: a delete removes it from the shared calendar, and the owner\'s other calendars stay untouched'),!ev.some(e=>e.title==='Beach day')&&ev.some(e=>e.title==='Secret work thing')&&ev.some(e=>e.title==='Family dinner'),JSON.stringify(ev));
  await page.screenshot({path:path.join(out,`15-can-edit-${theme}.png`)});
  await signOut();

  // =================================================================== the change is visible in the owner's app
  await signIn(OWNER,'Family');
  check(T('the owner sees the recipient\'s change in their own app'),await page.evaluate(()=>state.events.some(e=>e.title==='Renamed by Test Account')&&!state.events.some(e=>e.title==='Beach day')));
  await page.screenshot({path:path.join(out,`16-owner-sees-change-${theme}.png`)});

  // =================================================================== revoke
  await openManage('Family');await goSection('sharing');await sleep(500);
  await page.evaluate(()=>[...document.querySelectorAll('.dl-ppl-row')].find(r=>/Test Account/.test(r.textContent)).querySelector('.dl-ppl-ctl').click());await page.waitForSelector('.menu');await sleep(250);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Remove access/.test(b.textContent)).click());await sleep(900);
  check(T('the owner removed access'),(await shares())[0].status==='revoked');
  await closeManage();await signOut();
  await signIn(TEST,'Test calendar');await page.evaluate(()=>daylightSharing.load());await sleep(900);
  const gone=await sidebar();
  check(T('REVOKED: the calendar leaves the recipient\'s sidebar (and its events with it)'),!gone.labels.includes('Shared')&&gone.shared.length===0&&await page.evaluate(()=>!state.events.some(e=>/Family dinner|Renamed by/.test(e.title))),JSON.stringify(gone));
  await page.screenshot({path:path.join(out,`17-revoked-${theme}.png`)});

  // =================================================================== leave
  await signOut();await signIn(OWNER,'Family');
  await openManage('Work');await goSection('sharing');
  await page.type('.dl-inv-input','daylightcal');await page.waitForSelector('.dl-person');await sleep(350);
  await page.evaluate(()=>document.querySelector('.dl-person').click());await sleep(200);
  await page.click('[data-send]');await sleep(900);await closeManage();await signOut();
  await signIn(TEST,'Test calendar');await openBell();
  await page.evaluate(()=>[...document.querySelectorAll('.dl-notif-invite')].find(x=>/Work/.test(x.textContent)&&x.querySelector('[data-invite-add]')).querySelector('[data-invite-add]').click());await sleep(900);await closeBell();
  await page.evaluate(()=>daylightSharing.load());await sleep(700);
  await openManage('Work');await goSection('danger');
  check(T('the shared calendar\'s Danger zone offers Leave calendar'),await page.evaluate(()=>/Leave calendar/.test(document.querySelector('.dl-col-body').innerText)));
  await page.click('[data-danger]');await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await page.click('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(1000);
  check(T('LEAVE: the calendar leaves the recipient\'s sidebar and the owner\'s people list updates'),!(await sidebar()).shared.some(x=>x.name==='Work')&&(await shares()).filter(s=>s.cal==='c2'&&s.status==='accepted').length===0);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('sharing FAILED');process.exit(1)}
console.log('PASS sharing');
