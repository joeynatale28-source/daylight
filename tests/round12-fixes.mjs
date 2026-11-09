/**
 * Round 12 fixes, measured on the running page in both themes:
 *  Fix 2 sidebar bottom cluster order · Fix 3 sharing/public-link alignment + empty "Your colors" · Fix 4 logo goes home ·
 *  Fix 5 today has one highlight · Fix 6 owned-calendar menu · Fix 7 delete calendar: true event count + type-the-name gate.
 * (Fix 1 is in tests/security-settings.mjs; Parts A to C are in tests/ai-access.mjs and tests/consent.mjs.)
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round12');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
const FEED='https://usihrcucnreecynewgbd.supabase.co/functions/v1/ical-feed/9f3c2a7e5b1d4c8aa0e6f2b7d1c3e5a9.ics';

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:1000});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await page.evaluateOnNewDocument((feed)=>{window.__sh={shares:[]};window.__accounts={};window.__feed={public_enabled:true,url:feed};window.__bc={owners:['00000000-0000-4000-8000-000000000001'],items:[],reads:{},clears:{},banners:[]}},FEED);
  await app.load();
  await page.evaluate(()=>{window.__marker='kept'});

  // ================= Fix 3: the sharing / public link alignment
  await page.evaluate(()=>{const c=state.calendars.find(c=>isOwnedCalendar(c));c.publicLink=window.__feed.url;window.daylightCalendarSettings(c)});await page.waitForSelector('.dl-manage');await sleep(1300);
  const geo=await page.evaluate(()=>{const d=document.querySelector('.dl-manage');const R=e=>e.getBoundingClientRect();const ga=[...d.querySelectorAll('.set-group')].find(g=>/General access/.test(g.textContent)).querySelector('.dl-ga-host');const label=d.querySelector('.dl-ga-title'),tog=d.querySelector('.dl-ga-head .switch'),inp=ga.querySelector('.dl-cs-link input'),copy=ga.querySelector('.dl-cs-link [data-copy]'),head=d.querySelector('.dl-ga-title');
   const cards=[...d.querySelectorAll('.dl-col-body > .set-group')].map(g=>[Math.round(R(g).left),Math.round(R(g).right)]);
   return {note:(ga.querySelector('.dl-cs-note')||{}).textContent,calls:window.__fnCalls&&window.__fnCalls.length,feed:JSON.stringify(window.__feed).slice(0,40),on:!ga.querySelector('.dl-cs-public').hidden,labelLeft:Math.round(R(label).left),headLeft:Math.round(R(head).left),inputLeft:Math.round(R(inp).left),inputRight:Math.round(R(inp).right),copyLeft:Math.round(R(copy).left),copyRight:Math.round(R(copy).right),togRight:Math.round(R(tog).right),inputMid:Math.round(R(inp).top+R(inp).height/2),copyMid:Math.round(R(copy).top+R(copy).height/2),labelMid:Math.round(R(d.querySelector('.dl-ga-head > div')).top+R(d.querySelector('.dl-ga-head > div')).height/2),togMid:Math.round(R(tog).top+R(tog).height/2),cardsSame:new Set(cards.map(c=>c.join())).size===1,gap:Math.round(R(copy).left-R(inp).right)}});
  check(T('public link ON: URL field, Copy button and the row label share one grid (same left edge as the title, button on the toggle\'s right edge, centered together)'),geo.on&&geo.inputLeft===geo.labelLeft&&geo.labelLeft===geo.headLeft&&geo.copyRight===geo.togRight&&Math.abs(geo.inputMid-geo.copyMid)<=1&&geo.gap>=6&&geo.gap<=12&&Math.abs(geo.labelMid-geo.togMid)<=2,J(geo));
  check(T('every card in Manage shares the same left and right edges'),geo.cardsSame,J(geo));
  await page.evaluate(()=>{const b=document.querySelector('.dl-col-body');const g=document.querySelector('.dl-ga-host');b.scrollTop=g.getBoundingClientRect().top-b.getBoundingClientRect().top+b.scrollTop-150});await sleep(400);
  await shot('3-public-link-on');
  await page.evaluate(()=>{window.__feed={public_enabled:false};const t=document.querySelector('.dl-ga-head .switch input');t.click()});await sleep(900);
  const off=await page.evaluate(()=>{const ga=document.querySelector('.dl-ga-host');const R=e=>e.getBoundingClientRect();const label=document.querySelector('.dl-ga-title'),tog=document.querySelector('.dl-ga-head .switch'),head=document.querySelector('.dl-ga-title');return {on:!ga.querySelector('.dl-cs-public').hidden,labelLeft:Math.round(R(label).left),headLeft:Math.round(R(head).left),mid:Math.abs((R(document.querySelector('.dl-ga-head > div')).top+R(document.querySelector('.dl-ga-head > div')).height/2)-(R(tog).top+R(tog).height/2))}});
  check(T('public link OFF: label, description and toggle sit on one clean line, label on the title\'s left edge'),!off.on&&off.labelLeft===off.headLeft&&off.mid<=2,J(off));
  await shot('3-public-link-off');
  await page.evaluate(()=>{window.__feed={public_enabled:true,url:'x'}});
  const ycs=await page.evaluate(()=>{const d=document.querySelector('.dl-manage');const card=d.querySelector('.set-group');const tile=d.querySelector('[data-saved] .dl-sw');const rc=card.getBoundingClientRect();const lab=d.querySelector('.dl-cp-yourslabel').getBoundingClientRect();return {count:d.querySelectorAll('[data-saved] .dl-sw[data-color]').length,tileBottomToCard:Math.round(rc.bottom-tile.getBoundingClientRect().bottom),labelToTile:Math.round(tile.getBoundingClientRect().top-lab.bottom)}});
  check(T('"Your colors" with none saved takes only its label + the add tile on the color grid, then normal card spacing'),ycs.count===0&&ycs.tileBottomToCard<=26&&ycs.labelToTile<=12,J(ycs));
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);

  // ================= Fix 2: Support section directly above the account block
  const sb=await page.evaluate(()=>{const sb=document.querySelector('#sidebar');const q=s=>sb.querySelector(s).getBoundingClientRect();const lists=[...sb.querySelectorAll('.cal-list')];const subs=lists[lists.length-1].getBoundingClientRect();const lab=[...sb.querySelectorAll('.side-label')].find(l=>/Support/.test(l.textContent)).querySelector('span').getBoundingClientRect();const rows=[...sb.querySelectorAll('.side-row')];const set=rows[rows.length-1].getBoundingClientRect();const prof=q('.profile-wrap');
   return {order:rows.map(r=>r.getAttribute('title')).slice(-3),gapAboveSupport:Math.round(lab.top-subs.bottom),gapSettingsProfile:Math.round(prof.top-set.bottom),profBottom:Math.round(prof.bottom),sbBottom:Math.round(sb.getBoundingClientRect().bottom)}});
  check(T('sidebar: the Support section sits right above the account block; the leftover space is ABOVE it'),sb.gapSettingsProfile<=40&&sb.gapAboveSupport>=sb.gapSettingsProfile+20&&sb.sbBottom-sb.profBottom<=16&&sb.order.join()==='Admin,Documentation,Settings',J(sb));
  await shot('2-sidebar');
  await page.evaluate(()=>{state.sidebarRail=true;renderSidebar()});await sleep(500);
  const rail=await page.evaluate(()=>{const sb=document.querySelector('#sidebar');const rows=[...sb.querySelectorAll('.side-row')];const set=rows[rows.length-1].getBoundingClientRect(),prof=sb.querySelector('.profile-wrap').getBoundingClientRect();return {last:rows[rows.length-1].getAttribute('title'),gap:Math.round(prof.top-set.bottom),bottoms:sb.getBoundingClientRect().bottom-prof.bottom}});
  check(T('collapsed rail: the same rows stay bottom-anchored above the account block'),rail.gap<=40&&rail.bottoms<=16,J(rail));
  await shot('2-sidebar-rail');
  await page.evaluate(()=>{state.sidebarRail=false;renderSidebar()});await sleep(400);

  // ================= Fix 4: the logo goes home
  await page.evaluate(()=>{state.cursor=new Date(2026,11,9);state.selected=new Date(2026,11,9);state.view='week';state.section='tasks';renderAll(false)});await sleep(500);
  const home=await page.evaluate(()=>{const b=document.querySelector('.brand-home');const cs=getComputedStyle(b);return {label:b.getAttribute('aria-label'),tag:b.tagName,cursor:cs.cursor,hasMark:!!b.querySelector('.logo-tile img'),hasWord:/Daylight/.test(b.textContent)}});
  check(T('the logo is a real button labeled "Daylight home" with the pointer cursor, holding the mark and the wordmark'),home.label==='Daylight home'&&home.tag==='BUTTON'&&home.cursor==='pointer'&&home.hasMark&&home.hasWord,J(home));
  await page.hover('.brand-home');await sleep(250);
  check(T('it has a hover treatment'),await page.evaluate(()=>getComputedStyle(document.querySelector('.brand-home')).backgroundColor!=='rgba(0, 0, 0, 0)'));
  await page.click('.brand-home');await sleep(600);
  const back=await page.evaluate(()=>({section:state.section,view:state.view,cursor:state.cursor.toDateString(),marker:window.__marker,month:document.querySelector('#tbMonth')&&document.querySelector('#tbMonth').textContent}));
  check(T('from Tasks the logo returns to the calendar without a reload: same view and date, no state reset'),back.section==='calendar'&&back.view==='week'&&back.cursor==='Wed Dec 09 2026'&&back.marker==='kept'&&/Dec 6–12, 2026/.test(back.month),J(back));
  await page.evaluate(()=>{state.section='admin';renderAll(false)});await sleep(900);
  await page.focus('.brand-home');await page.keyboard.press('Enter');await sleep(600);
  check(T('from the Admin page it works too, from the keyboard'),await page.evaluate(()=>state.section==='calendar'&&!document.querySelector('.dl-tabs')));
  await page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,10,9);state.selected=new Date(2026,10,9);renderAll(false)});await sleep(500);
  await page.evaluate(()=>{state.section='tasks';state.sidebarRail=true;renderAll(false)});await sleep(500);
  await page.click('.brand-home');await sleep(500);
  check(T('collapsed rail: the mark alone goes home'),await page.evaluate(()=>state.section==='calendar'&&window.__marker==='kept'));
  await page.evaluate(()=>{state.sidebarRail=false;renderAll(false)});await sleep(400);
  const calendarKept=await page.evaluate(()=>{const t=document.querySelector('.month-title,#tbMonth').textContent;document.querySelector('.brand-home').click();return t===document.querySelector('#tbMonth').textContent});
  check(T('already on the calendar, the logo changes nothing'),calendarKept);

  // ================= Fix 5: today has ONE highlight
  await page.evaluate(()=>{state.view='month';state.cursor=new Date(TODAY);state.selected=new Date(TODAY);renderAll(false)});await sleep(600);
  const td=await page.evaluate(()=>{const c=document.querySelector('.day-cell.today');return {cell:getComputedStyle(c).backgroundColor,disc:getComputedStyle(c.querySelector('.day-num')).backgroundColor,sel:c.classList.contains('sel')}});
  check(T('Month: today (even when selected) keeps the number disc and has NO tinted cell'),td.cell==='rgba(0, 0, 0, 0)'&&td.disc!=='rgba(0, 0, 0, 0)'&&td.sel,J(td));
  await shot('5-today');

  // ================= Fix 6: the owned-calendar menu
  const ids=await page.evaluate(()=>{const owned=state.calendars.filter(c=>isOwnedCalendar(c)).map(c=>c.name);state.calendars.push({id:'shr1',name:'Soccer (shared)',color:'blue',remoteShareId:'s1',sharedFrom:{ownerName:'Sam Lee',ownerEmail:'sam@example.com',permission:'view'}});renderSidebar();return owned});
  check(T('owned calendars are recognized (not shared, subscribed or US Holidays)'),ids.length>=3&&!ids.includes('US Holidays')&&!ids.includes('Soccer (shared)'),J(ids));
  await sleep(300);
  await page.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name').textContent==='Personal');row.scrollIntoView();});
  const rowBox=await page.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name').textContent==='Personal');const b=row.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}});
  await page.mouse.move(rowBox.x,rowBox.y);await sleep(300);
  await page.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name').textContent==='Personal');row.querySelector('.cal-menu-btn').click()});await sleep(500);
  const menu=await page.evaluate(()=>({items:[...document.querySelectorAll('.menu .menu-item')].map(i=>i.textContent.trim()),danger:[...document.querySelectorAll('.menu .menu-item.danger')].map(i=>i.textContent.trim())}));
  check(T('an owned calendar row opens a standard menu with Manage and Delete calendar (danger)'),menu.items.join()==='Manage,Delete calendar'&&menu.danger.join()==='Delete calendar',J(menu));
  await shot('6-owned-menu');
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')][0].click());await page.waitForSelector('.dl-manage');await sleep(500);
  const viaMenu=await page.evaluate(()=>({title:document.querySelector('.dl-manage .dialog-title').textContent,groups:[...document.querySelectorAll('.dl-manage .set-group-title')].filter(n=>n.offsetParent).map(n=>n.textContent.trim()).join()}));
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);
  const gearRow=await page.evaluate(()=>{window.daylightCalendarSettings(state.calendars.find(c=>c.name==='Personal'));return null});await page.waitForSelector('.dl-manage');await sleep(500);
  const viaGear=await page.evaluate(()=>({title:document.querySelector('.dl-manage .dialog-title').textContent,groups:[...document.querySelectorAll('.dl-manage .set-group-title')].filter(n=>n.offsetParent).map(n=>n.textContent.trim()).join()}));
  check(T('Manage from the menu opens the identical Manage dialog as the gear always did'),J(viaMenu)===J(viaGear)&&viaMenu.title==='Personal',J([viaMenu,viaGear]));
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);
  await page.evaluate(()=>{[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name').textContent==='Soccer (shared)').querySelector('.cal-menu-btn').click()});await sleep(500);
  check(T('a shared calendar keeps its existing behavior (opens its info dialog, no Delete calendar)'),await page.evaluate(()=>!!document.querySelector('.dl-manage')&&!document.querySelector('.menu')&&![...document.querySelectorAll('.dl-manage .set-group-title')].some(n=>/Delete calendar/.test(n.textContent))));
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);
  await page.evaluate(()=>{[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name').textContent==='US Holidays').querySelector('.cal-menu-btn').click()});await sleep(500);
  check(T('US Holidays keeps its existing behavior (its own settings dialog, no delete)'),await page.evaluate(()=>!!document.querySelector('.dl-manage')&&!document.querySelector('.menu')&&!document.querySelector('.dl-manage [data-delete]')));
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);

  // ================= Fix 7: the true count + the typed-name gate (disposable calendars)
  await page.evaluate(()=>{
   const mk=(id,t)=>({id:id,title:t,cal:null,start:new Date(2026,10,20,9),end:new Date(2026,10,20,10),allDay:false,repeat:null});
   state.calendars.push({id:'dispA',name:'Empty calendar',color:'violet',hidden:false},{id:'dispB',name:'One event',color:'amber',hidden:false},{id:'dispC',name:'Several events',color:'rose',hidden:false});
   state.events.push(Object.assign(mk(9001,'Only one'),{cal:'dispB'}));
   for(let i=0;i<4;i++)state.events.push(Object.assign(mk(9010+i,'Several '+i),{cal:'dispC'}));
   window.__global=state.events.length;renderAll(false)});await sleep(500);
  const real=await page.evaluate(()=>({A:state.events.filter(e=>e.cal==='dispA').length,B:state.events.filter(e=>e.cal==='dispB').length,C:state.events.filter(e=>e.cal==='dispC').length,global:state.events.length}));
  const openDelete=async name=>{await page.evaluate(n=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name').textContent===n);row.querySelector('.cal-menu-btn').click()},name);await sleep(400);await page.evaluate(()=>document.querySelector('.menu .menu-item.danger').click());await page.waitForSelector('.dl-delcal');await sleep(450)};
  const dialog=()=>page.evaluate(()=>{const d=document.querySelector('.dl-delcal');const ok=d.querySelector('[data-ok]');return {body:d.querySelector('.dl-delcal-body').textContent.replace(/ /g,' '),label:d.querySelector('.dl-delcal-label').textContent,boldBody:d.querySelector('.dl-delcal-body b').textContent,boldLabel:d.querySelector('.dl-delcal-label b').textContent,okShown:getComputedStyle(ok).display!=='none',value:d.querySelector('#delCalName').value,focused:document.activeElement===d.querySelector('#delCalName'),cancel:!!d.querySelector('[data-cancel]'),footBtns:[...d.querySelectorAll('.dialog-foot button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim())}});
  const results=[];
  for(const [name,expected,phrase] of [['Empty calendar',real.A,'This calendar has 0 events'],['One event',real.B,'has 1 event'],['Several events',real.C,'has 4 events']]){
   await openDelete(name);const d=await dialog();
   results.push([name,expected,d.body]);
   check(T(name+': the popup says the true count ('+expected+'), grammatically, with the name in bold'),d.body.indexOf(phrase.replace('This calendar ',''))>=0&&d.boldBody===name&&/permanent and cannot be undone/.test(d.body)&&d.body.indexOf('22')===-1,J(d));
   if(name==='Several events'){await shot('7-delete-before-typing');}
   await page.keyboard.press('Escape');await sleep(450);
  }
  console.log('count test (calendar, real events on it, shown):',J(results),'global total was',real.global);
  await openDelete('Several events');
  let d=await dialog();
  check(T('the field is labeled with the calendar name in bold, starts empty and focused, and only Cancel shows (no Delete button)'),d.label==='To confirm, type the calendar name Several events below:'&&d.boldLabel==='Several events'&&d.value===''&&d.focused&&d.footBtns.join()==='Cancel'&&!d.okShown,J(d));
  await page.type('#delCalName','Several');await sleep(150);d=await dialog();
  check(T('a partial match does not reveal Delete'),!d.okShown&&d.footBtns.join()==='Cancel');
  await page.$eval('#delCalName',n=>{n.value=''});await page.type('#delCalName','several events');await sleep(150);d=await dialog();
  check(T('the match is exact (case matters)'),!d.okShown);
  await page.keyboard.press('Enter');await sleep(300);
  check(T('Enter does nothing while it does not match'),await page.evaluate(()=>!!document.querySelector('.dl-delcal')&&state.calendars.some(c=>c.id==='dispC')));
  await page.$eval('#delCalName',n=>{n.value=''});await page.type('#delCalName','  Several events  ');await sleep(150);d=await dialog();
  check(T('an exact match (spaces at the ends ignored) shows Delete beside Cancel in the danger treatment'),d.okShown&&d.footBtns.join()==='Cancel,Delete calendar'&&await page.evaluate(()=>/btn-danger/.test(document.querySelector('.dl-delcal [data-ok]').className)),J(d));
  await shot('7-delete-after-match');
  await page.keyboard.type('x');await sleep(150);d=await dialog();
  check(T('if the text stops matching, Delete disappears again'),!d.okShown);
  await page.keyboard.press('Escape');await sleep(450);
  await openDelete('Several events');d=await dialog();
  check(T('closing clears the field: the popup reopens empty'),d.value===''&&!d.okShown);
  await page.keyboard.press('Escape');await sleep(450);
  // the same gate from Manage -> Danger zone
  await page.evaluate(()=>window.daylightCalendarSettings(state.calendars.find(c=>c.id==='dispC')));await page.waitForSelector('.dl-manage');await sleep(500);
  await page.evaluate(()=>{const b=document.querySelector('.dl-manage [data-delete]');b.scrollIntoView();b.click()});await page.waitForSelector('.dl-delcal');await sleep(450);
  d=await dialog();
  check(T('Manage -> Danger zone -> Delete calendar opens the SAME popup and gate (no path skips the typed name)'),d.footBtns.join()==='Cancel'&&d.value===''&&/has 4 events/.test(d.body),J(d));
  await page.type('#delCalName','Several events');await sleep(150);
  await page.keyboard.press('Enter');await sleep(700);
  const gone=await page.evaluate(()=>({cal:state.calendars.some(c=>c.id==='dispC'),events:state.events.filter(e=>e.cal==='dispC').length,others:state.events.filter(e=>e.cal==='dispB').length,row:[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='Several events'),global:state.events.length}));
  check(T('Enter on a match deletes the calendar and exactly its own events; other calendars are untouched'),!gone.cal&&gone.events===0&&gone.others===1&&!gone.row&&gone.global===real.global-4,J([gone,real]));

  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('round 12 fixes FAILED');process.exit(1)}
console.log('PASS round 12 fixes');
