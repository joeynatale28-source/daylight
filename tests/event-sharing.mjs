/**
 * Item 9: sharing ONE event between accounts, on the real page, both themes. Two accounts at the client boundary: the OWNER (sender)
 * and the TEST account (recipient). The page's own code runs for real; the database is a stand-in that follows the same rules as
 * supabase/sql/20261128_event_sharing.sql (those rules are proven in real Postgres by tests/event-sharing-sql.mjs).
 *  - the share surface from an event (empty, person cards, selected + Send enabled, permission menu, pending row, accepted row);
 *  - the invite card on the recipient (anatomy, Accept / Decline, in-place morph, badge);
 *  - the accepted event: on the grid, NO sidebar calendar, "Shared by" sublabel, no delete; view only refused; edit works and the
 *    owner sees it; Leave; owner delete; owner removes a person.
 * LIVE_URL=<deployed build> runs the same flow against the deployed page (stubbed backend).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload,TINY_AVATAR} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','event-sharing');
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
 p.events=[{id:1,cal:'c1',title:'Family dinner',start:d(11,17,19),end:d(11,17,20),allDay:false,loc:'',desc:''},{id:2,cal:'c1',title:'Beach day',start:d(11,19,10),end:d(11,19,15),allDay:false,loc:'',desc:''},{id:3,cal:'c2',title:'Secret work thing',start:d(11,18,9),end:d(11,18,10),allDay:false,loc:'',desc:''}];
 p.tasks=[];p.settings={themeMode:'system',profileName:'Olivia Owner',identityOwner:OWNER.id};return p};
const testPayload=()=>{const p=busyPayload();p.calendars=[{id:'c9',name:'Test calendar',color:'violet'},{id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}];p.events=[];p.tasks=[];p.settings={themeMode:'system',profileName:'Test Account',identityOwner:TEST.id};return p};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:ownerPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.evaluateOnNewDocument((acc,po,pt)=>{window.__accounts=acc;acc[po.k].payload=po.p;acc[pt.k].payload=pt.p;window.__ws={};window.__sh={shares:[],eshares:[]}},
   Object.fromEntries([OWNER,TEST,SAM1,SAM2].map(u=>[u.id,{user:u,payload:{calendars:[{id:'x',name:'x'}],events:[]}}])),{k:OWNER.id,p:ownerPayload()},{k:TEST.id,p:testPayload()});
  await app.load();
  const idle=()=>page.waitForFunction(()=>!document.getElementById('dlWorkspaceLoading'),{timeout:8000});
  const signIn=async(who,cal)=>{await page.evaluate(u=>{window.__authCb('SIGNED_IN',{user:u,access_token:'t'})},who);
   await page.waitForFunction(t=>[...document.querySelectorAll('.cal-name')].some(n=>n.textContent===t),{timeout:8000},cal);await idle();await sleep(1100);
   await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(400)};
  const signOut=async()=>{await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(500)};
  const bell=()=>page.evaluate(()=>{const g=document.querySelector('.dl-notif-btn .dl-notif-badge');return g&&!g.hidden?g.textContent:''});
  const openBell=async()=>{await page.click('.dl-notif-btn');await page.waitForSelector('.dl-notif-panel');await sleep(600)};
  const closeBell=async()=>{await page.keyboard.press('Escape');await sleep(350)};
  const eshares=()=>page.evaluate(()=>window.__sh.eshares.map(s=>({event:s.event,permission:s.permission,status:s.status,recipient:s.recipient})));
  const ownerEvent=(n)=>page.evaluate((oid,n)=>{const w=window.__ws[oid];return w?w.payload.events.find(e=>e.id===n)||null:null},OWNER.id,n);
  const chipFor=t=>page.evaluate(t=>[...document.querySelectorAll('.chip,.dl-continuous-bar')].some(c=>c.textContent.includes(t)),t);
  const clickChip=async t=>{await page.evaluate(t=>[...document.querySelectorAll('.chip')].find(c=>c.textContent.includes(t)).click(),t);await page.waitForSelector('.popover');await sleep(500)};
  const menuItems=()=>page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>({label:b.querySelector('.mi-label')?.textContent,sub:b.querySelector('.mi-sub')?.textContent||'',danger:b.classList.contains('danger')})));
  const sidebar=()=>page.evaluate(()=>({names:[...document.querySelectorAll('#sidebar .cal-name')].map(n=>n.textContent),labels:[...document.querySelectorAll('#sidebar .side-label span')].map(n=>n.textContent)}));
  const sendTo=async(q,who,perm)=>{await page.type('.dl-inv-input',q);await page.waitForSelector('.dl-person');await sleep(350);
   await page.evaluate(w=>[...document.querySelectorAll('.dl-person')].find(c=>c.textContent.includes(w)).click(),who);await sleep(200);
   if(perm==='edit'){await page.click('[data-perm]');await page.waitForSelector('.menu');await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Can edit/.test(b.textContent)).click());await sleep(250)}
   await page.click('[data-send]');await sleep(900)};

  await page.evaluate(()=>{window.__authCb('SIGNED_OUT',null)});await sleep(300);

  // =================================================================== the owner shares an event (the Share view lives INSIDE the popover)
  const openShare=async title=>{await clickChip(title);await page.evaluate(()=>document.querySelector('.popover [data-act="share"]').click());await page.waitForSelector('.popover.is-sharing .dl-share-view');await sleep(450)};
  const backToEvent=async()=>{await page.evaluate(()=>document.querySelector('.dl-share-view [data-sv-back]').click());await sleep(350)};
  const overlays=()=>page.evaluate(()=>document.querySelectorAll('#overlayRoot > .backdrop').length);
  await signIn(OWNER,'Family');
  await clickChip('Family dinner');
  const order=await page.evaluate(()=>[...document.querySelectorAll('.popover .pop-top .icon-btn')].map(b=>b.getAttribute('data-act')));
  check(T('the popover top row is Edit, Share (person icon), more, Close'),order.join('|')==='edit|share|more|close',JSON.stringify(order));
  const chip=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.popover .pop-rows .pop-row')];const c=document.querySelector('.popover .pop-rows .pop-cal-chip');const idx=c?rows.indexOf(c.closest('.pop-row')):-1;const descIdx=rows.findIndex(r=>r.querySelector('.pop-desc'));return {inRow:idx>=0,idx,descIdx,headChip:!!document.querySelector('.popover .pop-head .pop-cal-chip')}});
  check(T('the calendar chip is its own row in the popover (below the description, not under the title)'),chip.inRow&&!chip.headChip&&(chip.descIdx<0||chip.idx>chip.descIdx),JSON.stringify(chip));
  check(T('the bottom row is gone: no lone people icon and no separate "Share event" pill'),await page.evaluate(()=>!document.querySelector('.popover [data-share-event],.popover .dl-pop-share-row,.popover .dl-pop-people')));
  await page.screenshot({path:path.join(out,`1-popover-share-button-${theme}.png`)});
  // the ... menu sits beside the popover and never over its date/time
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"]').click());await sleep(350);
  const mm=await page.evaluate(()=>{const m=document.querySelector('.menu').getBoundingClientRect(),p=document.querySelector('.popover').getBoundingClientRect(),when=[...document.querySelectorAll('.popover .pop-row .pr-strong,.popover .pop-date-line')][0];const w=when?when.getBoundingClientRect():null;
   const overlap=w&&!(m.right<=w.left||m.left>=w.right||m.bottom<=w.top||m.top>=w.bottom);return {menuLeft:Math.round(m.left),popRight:Math.round(p.right),overlap:!!overlap}});
  check(T('the \u22ef menu anchors to the popover\'s right edge and does not cover the date or time'),mm.menuLeft>=mm.popRight-1&&!mm.overlap,JSON.stringify(mm));
  await page.screenshot({path:path.join(out,`1b-more-menu-${theme}.png`)});
  await page.keyboard.press('Escape');await sleep(250);if(await page.$('.menu'))await page.mouse.click(5,5);await sleep(200);
  const popBefore=await page.evaluate(()=>{const p=document.querySelector(".popover"),r=p.getBoundingClientRect();window.__popNode=p;return {w:Math.round(r.width),left:Math.round(r.left)}});
  const nOverlays=await overlays();
  await page.evaluate(()=>document.querySelector('.popover [data-act="share"]').click());await page.waitForSelector('.popover.is-sharing .dl-share-view');await sleep(450);
  const sv=await page.evaluate(()=>{const p=document.querySelector('.popover'),r=p.getBoundingClientRect(),v=document.querySelector('.dl-share-view');return {same:p===window.__popNode,w:Math.round(r.width),left:Math.round(r.left),title:v.querySelector('.dl-sv-title').textContent,back:!!v.querySelector('[data-sv-back]'),close:!!v.querySelector('[data-sv-close]'),ev:v.querySelector('.dl-sv-event b').textContent,when:v.querySelector('.dl-sv-event .when').textContent,ph:v.querySelector('.dl-inv-input').placeholder,
   fieldH:Math.round(v.querySelector('.dl-inv-field').getBoundingClientRect().height),fieldW:Math.round(v.querySelector('.dl-inv-field').getBoundingClientRect().width),permText:v.querySelector('[data-perm]').textContent.trim(),sendDisabled:v.querySelector('[data-send]').disabled,
   rows:[...v.querySelectorAll('.dl-ppl-row')].map(x=>x.querySelector('.dl-ppl-name').textContent+':'+x.querySelector('.dl-ppl-sub').textContent),quiet:(v.querySelector('.dl-sv-quiet')||{}).textContent,inView:r.bottom<=innerHeight&&r.top>=0}});
  check(T('tapping Share swaps the SAME popover to the Share view in place: same node, same width and position, no second modal, no second backdrop'),sv.same&&sv.w===popBefore.w&&sv.left===popBefore.left&&(await overlays())===nOverlays,JSON.stringify({sv,popBefore,nOverlays}));
  check(T('the Share view: back chevron + "Share event" + Close; the event line; a full-width search field; the permission picker (View only) with a grey Send'),sv.title==='Share event'&&sv.back&&sv.close&&sv.ev==='Family dinner'&&/7:00/.test(sv.when)&&sv.ph==='Search people to share with…'&&sv.fieldW>=300&&sv.fieldH===44&&/View only/.test(sv.permText)&&sv.sendDisabled,JSON.stringify(sv));
  check(T('People with access: the owner row first ("Owner"), then the quiet "Not shared with anyone yet"'),sv.rows.length===1&&/Owner$/.test(sv.rows[0])&&sv.quiet==='Not shared with anyone yet'&&sv.inView,JSON.stringify(sv));
  await page.screenshot({path:path.join(out,`2-share-view-empty-${theme}.png`)});
  await page.type('.dl-inv-input','sam');await page.waitForSelector('.dl-person');await sleep(450);
  const cards=await page.evaluate(()=>[...document.querySelectorAll('.dl-share-view .dl-person')].map(c=>({name:c.querySelector('b').textContent,email:c.querySelector('.sub').textContent,avatar:!!c.querySelector('.dl-person-avatar')})));
  check(T('person cards: picture, name in bold, email in grey; same names told apart by email'),cards.length===2&&cards.every(c=>c.avatar&&c.email.includes('@'))&&new Set(cards.map(c=>c.email)).size===2,JSON.stringify(cards));
  await page.screenshot({path:path.join(out,`3-share-cards-${theme}.png`)});
  await page.evaluate(()=>{const i=document.querySelector('.dl-share-view .dl-inv-input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))});await page.type('.dl-inv-input','zzzzzz');await sleep(500);
  check(T('not found: "No results found — check the spelling" and nothing can be sent'),await page.evaluate(()=>/No results found — check the spelling/.test(document.querySelector('.dl-share-view .dl-inv-results').textContent)&&document.querySelector('.dl-share-view [data-send]').disabled));
  await page.evaluate(()=>{const i=document.querySelector('.dl-share-view .dl-inv-input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))});await page.type('.dl-inv-input','sam');await page.waitForSelector('.dl-person');await sleep(450);
  await page.evaluate(()=>[...document.querySelectorAll('.dl-share-view .dl-person')].find(c=>c.textContent.includes('Sam Lee')).click());await sleep(250);
  check(T('picking a person fills the row and Send becomes active'),await page.evaluate(()=>!document.querySelector('.dl-share-view [data-send]').disabled&&/Sam Lee/.test(document.querySelector('.dl-share-view .dl-inv-chip').textContent)));
  await page.evaluate(()=>document.querySelector('.dl-share-view [data-perm]').click());await page.waitForSelector('.menu');await sleep(300);
  const items=await menuItems();
  const geo=await page.evaluate(()=>{const m=document.querySelector('.menu').getBoundingClientRect(),perm=document.querySelector('.dl-share-view [data-perm]').getBoundingClientRect(),send=document.querySelector('.dl-share-view [data-send]').getBoundingClientRect(),people=document.querySelector('.dl-share-view [data-people]').getBoundingClientRect();
   const hit=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);return {above:m.bottom<=perm.top+2,coversSend:hit(m,send),coversList:hit(m,people),stillOpen:!!document.querySelector('.popover.is-sharing')}});
  check(T('the permission menu: Can edit "Can change this event", View only "Can only see this event"'),items.length===2&&items[0].label==='Can edit'&&items[0].sub==='Can change this event'&&items[1].label==='View only'&&items[1].sub==='Can only see this event',JSON.stringify(items));
  check(T('the permission menu opens upward: it never covers Send or the people list, and the popover stays open'),geo.above&&!geo.coversSend&&!geo.coversList&&geo.stillOpen,JSON.stringify(geo));
  await page.screenshot({path:path.join(out,`4-share-selected-menu-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/View only/.test(b.textContent)).click());await sleep(250);
  await page.click('.dl-share-view [data-send]');await sleep(900);
  let rows=await page.evaluate(()=>[...document.querySelectorAll('.dl-share-view .dl-ppl-row')].map(r=>({name:r.querySelector('.dl-ppl-name').textContent,ctl:r.querySelector('.dl-ppl-ctl')?.textContent.trim()||''})));
  check(T('the person appears as "Invited" under People with access (after the owner row)'),rows.length===2&&/Owner|Olivia|Calendar/.test(rows[0].name+rows[0].ctl)&&rows[1].name==='Sam Lee'&&rows[1].ctl==='Invited',JSON.stringify(rows));
  // the TEST account also gets this event, with Can edit
  await page.type('.dl-inv-input','daylightcal');await page.waitForSelector('.dl-person');await sleep(350);
  await page.evaluate(()=>[...document.querySelectorAll('.dl-share-view .dl-person')].find(c=>c.textContent.includes('Test Account')).click());await sleep(200);
  await page.evaluate(()=>document.querySelector('.dl-share-view [data-perm]').click());await page.waitForSelector('.menu');await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Can edit/.test(b.textContent)).click());await sleep(250);
  await page.click('.dl-share-view [data-send]');await sleep(900);
  await page.screenshot({path:path.join(out,`5-share-pending-${theme}.png`)});
  const sh=await eshares();
  check(T('two invites exist: Sam (view) and the test account (edit), both pending'),sh.length===2&&sh.every(s=>s.status==='pending')&&sh.some(s=>s.permission==='edit')&&sh.some(s=>s.permission==='view'),JSON.stringify(sh));
  await backToEvent();
  check(T('the back chevron returns to the event view (same popover)'),await page.evaluate(()=>document.querySelector('.popover')===window.__popNode&&!document.querySelector('.popover.is-sharing')&&!!document.querySelector('.popover [data-act="share"]')));
  await page.keyboard.press('Escape');await sleep(250);await page.evaluate(()=>closePopover&&closePopover());
  // a second event for the decline path
  await openShare('Beach day');
  await page.type('.dl-inv-input','daylightcal');await page.waitForSelector('.dl-person');await sleep(350);
  await page.evaluate(()=>[...document.querySelectorAll('.dl-share-view .dl-person')].find(c=>c.textContent.includes('Test Account')).click());await sleep(200);
  await page.click('.dl-share-view [data-send]');await sleep(900);
  await page.evaluate(()=>closePopover&&closePopover());await sleep(250);
  await signOut();

  // =================================================================== the recipient: the invite cards
  await signIn(TEST,'Test calendar');
  check(T('the bell badge counts the two pending event invites'),(await bell())==='2',await bell());
  await openBell();
  const n1=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.dl-notif-event-invite')];const r=rows.find(x=>/Family dinner/.test(x.textContent));window.__inviteNode=r;const q=s=>r.querySelector(s);
   return {count:rows.length,from:q('.dl-inv-from').textContent,body:q('.dl-inv-body').textContent,perm:q('.dl-inv-permline').textContent,time:q('.dl-notif-time').textContent,avatar:!!q('.dl-person-avatar'),dot:getComputedStyle(q('.dl-inv-dot')).backgroundColor,add:q('[data-invite-add]').textContent,addCls:q('[data-invite-add]').className,dec:q('[data-invite-decline]').textContent,decCls:q('[data-invite-decline]').className,clear:!!q('.dl-notif-clear')}});
  check(T('the invite card: sender picture + name, "<Name> shared <event> with you", the permission and the event\'s date/time, the arrival time'),n1.count===2&&n1.from==='Olivia Owner'&&n1.body==='Olivia Owner shared Family dinner with you'&&/^Can edit · /.test(n1.perm)&&/7:00/.test(n1.perm)&&!!n1.time&&n1.avatar&&n1.dot!=='rgba(0, 0, 0, 0)',JSON.stringify(n1));
  check(T('Accept is a filled primary button and Decline a real secondary button; nothing to clear it with while pending'),n1.add==='Accept'&&/btn-primary/.test(n1.addCls)&&n1.dec==='Decline'&&/btn-ghost/.test(n1.decCls)&&!n1.clear,JSON.stringify(n1));
  await page.screenshot({path:path.join(out,`7-invite-card-${theme}.png`)});
  await page.evaluate(()=>window.__inviteNode.querySelector('[data-invite-add]').click());await sleep(1100);
  const n2=await page.evaluate(()=>{const r=window.__inviteNode;return {same:r.isConnected&&document.querySelector('.dl-notif-event-invite[data-invite-id="'+r.getAttribute('data-invite-id')+'"]')===r,buttons:r.querySelectorAll('[data-invite-add],[data-invite-decline]').length,state:(r.querySelector('.dl-inv-state')||{}).textContent,panelOpen:!!document.querySelector('.dl-notif-panel')}});
  check(T('Accept: the SAME card morphs in place to a quiet "Accepted" (buttons gone, no navigation)'),n2.same&&n2.buttons===0&&n2.state==='Accepted'&&n2.panelOpen,JSON.stringify(n2));
  check(T('the badge now counts only the remaining pending invite'),(await bell())==='1',await bell());
  await page.screenshot({path:path.join(out,`8-invite-accepted-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('.dl-notif-event-invite')].find(x=>/Beach day/.test(x.textContent)).querySelector('[data-invite-decline]').click());await sleep(900);
  const n3=await page.evaluate(()=>{const r=[...document.querySelectorAll('.dl-notif-event-invite')].find(x=>/Beach day/.test(x.textContent));return {state:(r.querySelector('.dl-inv-state')||{}).textContent,buttons:r.querySelectorAll('[data-invite-add],[data-invite-decline]').length}});
  check(T('Decline: the card settles to a quiet "Declined" and nothing is added'),n3.state==='Declined'&&n3.buttons===0&&(await bell())==='',JSON.stringify(n3));
  await page.screenshot({path:path.join(out,`9-invite-declined-${theme}.png`)});
  await closeBell();
  check(T('the declined event is not on the calendar'),!(await chipFor('Beach day')));

  // =================================================================== the accepted event (Can edit)
  check(T('the accepted event is on the recipient\'s grid'),await chipFor('Family dinner'));
  const sb=await sidebar();
  check(T('it does NOT create a calendar or a Shared section in the sidebar'),!sb.names.includes('Family')&&!sb.labels.includes('Shared'),JSON.stringify(sb));
  check(T('the owner\'s other events never reach the recipient'),await page.evaluate(()=>!state.events.some(e=>/Secret work thing|Beach day/.test(e.title))));
  await clickChip('Family dinner');
  const pop=await page.evaluate(()=>({by:(document.querySelector('.dl-pop-by')||{}).textContent,perm:(document.querySelector('.dl-pop-perm')||{}).textContent,del:!!document.querySelector('.popover [data-act="del"]'),edit:!!document.querySelector('.popover [data-act="edit"]'),leave:!!document.querySelector('.popover [data-leave-event]')}));
  check(T('the popover says "Shared by Olivia Owner" with the permission; Leave is offered; Can edit offers edit but NO delete'),pop.by==='Shared by Olivia Owner'&&/Can edit/.test(pop.perm)&&pop.leave&&pop.edit&&!pop.del,JSON.stringify(pop));
  await page.screenshot({path:path.join(out,`10-accepted-popover-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"],.popover [data-act="menu"],.popover .pop-more')?.click());await sleep(250);
  check(T('Can edit: the "more" menu has no Delete event either'),await page.evaluate(()=>![...document.querySelectorAll('.menu .menu-item')].some(b=>/Delete event/.test(b.textContent))));
  await page.keyboard.press('Escape');await sleep(250);if(await page.$('.menu'))await page.keyboard.press('Escape');await page.evaluate(()=>closePopover&&closePopover());await sleep(250);
  // edit as the recipient: the change lands in the owner's one event
  const before=await ownerEvent(1);
  await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Family dinner'&&x.feedEventShareId);e.title='Family dinner at Ria\'s';e.loc='Ria\'s place';renderAll(false)});
  await sleep(1600);
  const afterEdit=await ownerEvent(1);
  check(T('EDIT: the recipient\'s change is written to the owner\'s one event (same id, same calendar)'),afterEdit&&afterEdit.title==='Family dinner at Ria\'s'&&afterEdit.loc==='Ria\'s place'&&afterEdit.id===1&&afterEdit.cal==='c1',JSON.stringify(afterEdit));
  check(T('EDIT: still ONE event for the recipient (no copy)'),await page.evaluate(()=>state.events.filter(e=>/Family dinner/.test(e.title)).length===1));
  // a forced move to another calendar is undone
  await page.evaluate(()=>{const e=state.events.find(x=>x.feedEventShareId);e.cal='c9';renderAll(false)});await sleep(1500);
  check(T('EDIT: moving it to another calendar is not allowed (the event stays on its own calendar, no copy is made)'),await page.evaluate(()=>{const e=state.events.filter(x=>/Family dinner/.test(x.title));return e.length===1&&String(e[0].cal).startsWith('evs:')})&&(await ownerEvent(1)).cal==='c1');
  // a forced delete is refused: it comes back
  await page.evaluate(()=>{state.events=state.events.filter(e=>!e.feedEventShareId);renderAll(false)});await sleep(1500);
  check(T('EDIT: a forced delete is not possible: the event comes straight back and the owner still has it'),await chipFor('Family dinner')&&!!(await ownerEvent(1)));
  await page.screenshot({path:path.join(out,`11-edit-applied-${theme}.png`)});
  await signOut();

  // =================================================================== the owner sees the recipient's change, then downgrades to View only
  await signIn(OWNER,'Family');
  check(T('the owner\'s app shows the change made by the recipient'),await chipFor('Family dinner at Ria'));
  await openShare('Family dinner at Ria');
  await page.evaluate(()=>[...document.querySelectorAll('.dl-share-view .dl-ppl-row')].find(r=>/Test Account/.test(r.textContent)).querySelector('.dl-ppl-ctl').click());await page.waitForSelector('.menu');await sleep(250);
  const om=await menuItems();
  check(T('an accepted person\'s dropdown: permission choices, then Remove access at the bottom in danger styling'),om.length===3&&om[0].label==='Can edit'&&om[1].label==='View only'&&om[2].label==='Remove access'&&om[2].danger,JSON.stringify(om));
  await page.screenshot({path:path.join(out,`12-accepted-dropdown-${theme}.png`)});
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/View only/.test(b.textContent)).click());await sleep(900);
  check(T('the owner switched the test account to View only'),(await eshares()).some(s=>s.recipient===TEST.id&&s.permission==='view'&&s.status==='accepted'));
  await page.keyboard.press('Escape');await sleep(250);await page.evaluate(()=>closePopover&&closePopover());
  await signOut();

  // =================================================================== VIEW ONLY on the recipient
  await signIn(TEST,'Test calendar');
  await clickChip('Family dinner at Ria');
  const vp=await page.evaluate(()=>({edit:!!document.querySelector('.popover [data-act="edit"]'),del:!!document.querySelector('.popover [data-act="del"]'),text:document.querySelector('.popover').innerText.replace(/\s+/g,' ')}));
  check(T('VIEW ONLY: no edit and no delete, and the popover says so'),!vp.edit&&!vp.del&&/View only/.test(vp.text)&&!/Subscribed calendar/.test(vp.text),JSON.stringify(vp));
  await page.screenshot({path:path.join(out,`13-view-only-popover-${theme}.png`)});
  await page.keyboard.press('Escape');await sleep(250);await page.evaluate(()=>closePopover&&closePopover());
  const snap=JSON.stringify(await ownerEvent(1));
  await page.evaluate(()=>{const e=state.events.find(x=>x.feedEventShareId);e.title='Hacked';renderAll(false)});await sleep(1500);
  const refusal=await page.evaluate(()=>({title:(state.events.find(x=>x.feedEventShareId)||{}).title,toast:[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | '),writes:window.__sh.calls.filter(c=>c.name==='daylight_apply_shared_event_changes').length}));
  check(T('VIEW ONLY: a forced edit is refused, the screen snaps back, the user is told, and the owner\'s event is unchanged'),refusal.title==='Family dinner at Ria\'s'&&/view this event but not change it/i.test(refusal.toast)&&JSON.stringify(await ownerEvent(1))===snap,JSON.stringify(refusal));
  const direct=await page.evaluate(async()=>{try{await daylightSharing.rpc('daylight_apply_shared_event_changes',{p_share_id:window.__sh.eshares.find(s=>s.recipient===daylightCloud.user.id&&s.status==='accepted').id,p_event:{title:'Sneaky'}});return 'allowed'}catch(e){return e.message}});
  check(T('VIEW ONLY: calling the write function directly is refused too'),/view this event but not change it/.test(direct)&&JSON.stringify(await ownerEvent(1))===snap,direct);
  await page.screenshot({path:path.join(out,`14-view-only-refused-${theme}.png`)});
  // leave
  await clickChip('Family dinner at Ria');
  await page.evaluate(()=>document.querySelector('.popover [data-leave-event]').click());await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');await sleep(350);
  await page.screenshot({path:path.join(out,`15-leave-confirm-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('#overlayRoot > .backdrop:last-child [data-ok]').click());await sleep(1400);
  check(T('Leave: the event disappears for the recipient and the share ends'),!(await chipFor('Family dinner at Ria'))&&(await eshares()).some(s=>s.recipient===TEST.id&&s.status==='revoked'));
  await signOut();

  // =================================================================== the owner's side after a leave, then delete
  await signIn(OWNER,'Family');
  await openShare('Family dinner at Ria');
  check(T('the owner\'s people list no longer shows the person who left'),await page.evaluate(()=>![...document.querySelectorAll('.dl-share-view .dl-ppl-row')].some(r=>/Test Account/.test(r.textContent))));
  // Sam never signed in: cancel Sam's pending invite from the Share view
  await page.evaluate(()=>[...document.querySelectorAll('.dl-share-view .dl-ppl-row')].find(r=>/Sam Lee/.test(r.textContent)).querySelector('.dl-ppl-ctl').click());await page.waitForSelector('.menu');await sleep(250);
  const pm=await menuItems();
  check(T('a pending person\'s dropdown: change permission, Resend invite, Cancel invite'),pm.map(x=>x.label).join('|')==='Can edit|View only|Resend invite|Cancel invite',JSON.stringify(pm));
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/Cancel invite/.test(b.textContent)).click());await sleep(900);
  check(T('Cancel invite on a pending person deletes the invite'),!(await eshares()).some(s=>s.recipient===SAM1.id));
  await page.keyboard.press('Escape');await sleep(250);await page.evaluate(()=>closePopover&&closePopover());
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('event sharing FAILED');process.exit(1)}
console.log('PASS event sharing');
