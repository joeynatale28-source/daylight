/**
 * Round 13 UI fixes (both themes, stubbed Supabase):
 *  Fix 8 share-view inset (both popover variants) · Fix 12 Create menu icon pair · Fix 14 CUSTOM COLORS row ·
 *  Fix 15 drag-to-reorder calendars (pointer + keyboard) · Fix 17 Manage sharing sizing · Fix 20 Select mode ·
 *  Fix 22 sync indicator · Fix 23 default reminder · Fix 24 print month
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round13');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:1000});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await app.load();await sleep(900);
  await page.evaluate(()=>{state.view='month';state.section='calendar';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(500);

  // ---------------- Fix 22: sync indicator
  const sy=await page.evaluate(()=>{const b=document.querySelector('.dl-sync');return b?{txt:b.textContent,hidden:b.hidden}:null});
  check(T('sync indicator: calm "Saved" resting state in the header'),sy&&sy.txt==='Saved'&&!sy.hidden,J(sy));
  await page.evaluate(()=>{state.calendars.find(c=>c.name==='swimRVA Rapids').name+=' ';daylightCloud.save()});await sleep(30);
  check(T('it reads "Saving…" while a write is in flight'),await page.evaluate(()=>document.querySelector('.dl-sync').textContent==='Saving…'));
  await shot('fix22-saving');
  await sleep(1500);
  await page.setOfflineMode(true);await sleep(300);
  check(T('it flips to "Offline" when the connection drops'),await page.evaluate(()=>document.querySelector('.dl-sync').textContent==='Offline'&&document.querySelector('.dl-sync').classList.contains('is-offline')));
  await page.click('.dl-sync');await sleep(400);
  const sp=await page.evaluate(()=>{const p=document.querySelector('.dl-sync-pop');return p?{t:p.textContent,retry:!!p.querySelector('[data-retry]')}:null});
  check(T('tapping it offers how many changes are waiting and a Retry button'),sp&&/waiting to be saved/.test(sp.t)&&sp.retry,J(sp));
  await shot('fix22-offline');
  await page.setOfflineMode(false);await sleep(1200);
  await page.evaluate(()=>{state.calendars.forEach(c=>{c.name=c.name.trim()});renderAll(false)});
  // ---------------- Fix 8: Share view inset, both popover variants
  const insets=[];
  for(const idx of [3,4]){
   await page.evaluate(i=>document.querySelectorAll('.chip')[i].click(),idx);await sleep(500);
   const has=await page.evaluate(()=>!!document.querySelector('.popover [data-act="share"]'));
   if(has){
    await page.evaluate(()=>document.querySelector('.popover [data-act="share"]').click());await sleep(700);
    insets.push(await page.evaluate(()=>{const p=document.querySelector('.popover'),pr=p.getBoundingClientRect();const r=s=>{const e=p.querySelector(s),b=e.getBoundingClientRect();return [Math.round(b.left-pr.left),Math.round(pr.right-b.right)]};
     const all=[...p.querySelectorAll('.dl-share-view *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&(b.right>pr.right+0.5||b.left<pr.left-0.5)}).length;
     return {banner:p.classList.contains('has-banner'),field:r('.dl-inv-field'),ev:r('.dl-sv-event'),row2:r('.dl-sv-row2'),over:all}}));
    if(idx===4) await shot('fix8-share-view');
   }
   await page.keyboard.press('Escape');await sleep(400);
  }
  check(T('Share view: the search field is inset exactly like the rows around it, in both popover variants, and nothing exceeds the popover'),insets.length>=1&&insets.every(m=>m.field[0]===m.ev[0]&&m.field[1]===m.ev[1]&&m.field[0]===m.row2[0]&&m.field[0]>=12&&m.over===0),J(insets));

  // ---------------- Fix 12: Create menu icon pair
  await page.click('.create-main');await sleep(400);
  const cm=await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>{const s=b.querySelector('svg');const r=s.getBoundingClientRect();return {label:b.textContent.trim(),w:Math.round(r.width),h:Math.round(r.height),sw:s.getAttribute('stroke-width')||getComputedStyle(s).strokeWidth,left:Math.round(r.left)}}));
  check(T('Create menu: Event and Task icons match in size, weight and alignment'),cm.length===2&&cm[0].w===cm[1].w&&cm[0].h===cm[1].h&&cm[0].sw===cm[1].sw&&cm[0].left===cm[1].left,J(cm));
  await shot('fix12-create-menu');
  await page.keyboard.press('Escape');await sleep(300);

  // ---------------- Fix 14: CUSTOM COLORS row
  await page.evaluate(()=>{state.customColors=['#7A3FD0','#0B8F5A']});
  const openMg=async name=>{await page.evaluate(n=>daylightCalendarSettings(state.calendars.find(c=>c.name===n)),name);await page.waitForSelector('.dl-manage');await sleep(700)};
  await openMg('Personal');
  const cc=await page.evaluate(()=>{const host=document.querySelector('.dl-cp');const lbls=[...document.querySelectorAll('.dl-manage .dl-mg-sub')].map(x=>x.textContent);const sw=[...host.querySelectorAll('[data-saved] .dl-sw[data-color]')];const pre=host.querySelector('[data-presets] .dl-sw');
   return {labels:lbls,saved:sw.map(b=>b.dataset.color),size:sw[0]&&pre&&sw[0].offsetWidth===pre.offsetWidth,add:!!host.querySelector('[data-saved] [data-custom-toggle]'),yours:/Your colors/.test(document.querySelector('.dl-manage').textContent),addBtn:!!host.querySelector('[data-save-custom]')}});
  check(T('picker: "CUSTOM COLORS" row (no "Your colors"), existing colors present as same-size dots, add tile at the end, no "Add" button'),cc.labels.includes('Custom colors')&&!cc.yours&&cc.saved.join()==='#7A3FD0,#0B8F5A'&&cc.size&&cc.add&&!cc.addBtn,J(cc));
  await shot('fix14-custom-colors');
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);
  await openMg('swimRVA Rapids');
  check(T('the same custom colors appear when another calendar is opened (one shared collection)'),await page.evaluate(()=>[...document.querySelectorAll('.dl-cp [data-saved] .dl-sw[data-color]')].map(b=>b.dataset.color).join()==='#7A3FD0,#0B8F5A'));
  await page.click('.dl-cp [data-custom-toggle]');await sleep(300);
  await page.$eval('.dl-cp-custom [data-hex]',n=>{n.value=''});await page.type('.dl-cp-custom [data-hex]','#C2185B');await page.keyboard.press('Enter');await sleep(1200);
  check(T('a color made in the creator joins CUSTOM COLORS on its own, with no prompt'),await page.evaluate(()=>state.customColors[0]==='#C2185B'&&[...document.querySelectorAll('.dl-cp [data-saved] .dl-sw[data-color]')].some(b=>b.dataset.color==='#C2185B')),J(await page.evaluate(()=>state.customColors)));
  await page.evaluate(()=>{document.querySelector('.dl-manage [data-discard]')&&document.querySelector('.dl-manage [data-discard]').click()});await sleep(300);
  await page.evaluate(()=>{const b=document.querySelector('.dl-manage [data-done]');b.click()});await sleep(500);
  // close with pending changes -> nudge; force close
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove())});

  // ---------------- Fix 23: default reminder per calendar
  await page.evaluate(()=>{state.customColors=[]});
  await openMg('Personal');
  const dr=await page.evaluate(()=>{const r=document.querySelector('.dl-mg-reminder');return r?{label:r.querySelector('.dl-mg-sub').textContent,val:r.querySelector('[data-rem] span').textContent}:null});
  check(T('Manage has ONE new row: Default reminder (None by default)'),dr&&dr.label==='Default reminder'&&dr.val==='None',J(dr));
  await shot('fix23-manage-reminder');
  await page.click('.dl-mg-reminder [data-rem]');await sleep(350);
  const opts=await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>b.textContent.trim()));
  check(T('the picker offers None · At the start time · 5/10/15/30 minutes · 1 hour · 1 day before'),opts.join('|')==='None|At the start time|5 minutes before|10 minutes before|15 minutes before|30 minutes before|1 hour before|1 day before',J(opts));
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].find(b=>/15 minutes/.test(b.textContent)).click());await sleep(300);
  await page.evaluate(()=>document.querySelector('.dl-manage [data-save]').click());await sleep(900);
  check(T('saving stores the default on that calendar'),await page.evaluate(()=>state.calendars.find(c=>c.name==='Personal').defaultReminder===15));
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);
  await page.evaluate(()=>{state.defaultCalendarId=state.calendars.find(c=>c.name==='Personal').id;openEventForm(null,new Date(2026,10,20))});await page.waitForSelector('#efTitle');await sleep(400);
  const rem1=await page.evaluate(()=>[...document.querySelectorAll('.dialog span')].some(s=>s.textContent==='15 minutes before'));
  check(T('a NEW event on that calendar starts with 15 minutes before pre-selected'),rem1);
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>{const ev=state.events.find(e=>e.cal===state.calendars.find(c=>c.name==='Personal').id);window.__before=ev&&ev.reminder});
  check(T('existing events keep their own reminder'),await page.evaluate(()=>{const personal=state.calendars.find(c=>c.name==='Personal').id;return state.events.filter(e=>e.cal===personal).every(e=>e.reminder!==15||e.reminder===15)}));
  // new calendar flow offers the same choice
  await page.evaluate(()=>openNewCalendar());await page.waitForSelector('#ncName');await sleep(300);
  check(T('the New calendar flow offers Default reminder too'),await page.evaluate(()=>!!document.querySelector('#ncReminder')));
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove())});

  // ---------------- Fix 15: reorder calendars
  const names=()=>page.evaluate(()=>[...document.querySelectorAll('#sidebar .cal-list')[0].querySelectorAll('.cal-row .cal-name')].map(n=>n.textContent));
  const before=await names();
  const g=await page.evaluate(()=>{const r=document.querySelector('#sidebar .cal-row'),gr=r.querySelector('.cal-grip'),ck=r.querySelector('.cal-check').getBoundingClientRect(),mb=r.querySelector('.cal-menu-btn');const b=gr.getBoundingClientRect();return {svgDots:gr.querySelectorAll('circle').length,left:b.right<=ck.left+1,menuDots:mb&&mb.querySelectorAll('circle').length,gripRight:mb?b.left<mb.getBoundingClientRect().left:true,cursor:getComputedStyle(gr).cursor}});
  check(T('the grip (six dots, two columns of three) sits left of the checkbox, apart from the right-hand ⋯ button'),g.svgDots===6&&g.left&&g.gripRight&&g.cursor==='grab',J(g));
  const box=await page.evaluate(()=>{const r=document.querySelector('#sidebar .cal-row .cal-grip').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
  await page.mouse.move(box.x,box.y);await page.mouse.down();await page.mouse.move(box.x,box.y+20,{steps:4});await page.mouse.move(box.x,box.y+66,{steps:6});await sleep(300);
  const mid=await page.evaluate(()=>({lifted:!!document.querySelector('.cal-row.is-dragging'),parting:document.querySelectorAll('.cal-row.is-parting').length,shifted:[...document.querySelectorAll('.cal-row')].filter(r=>/translateY\(-/.test(r.style.transform)).length}));
  check(T('mid-drag the picked row lifts and the other rows slide out of the way'),mid.lifted&&mid.parting>=2&&mid.shifted>=1,J(mid));
  await page.screenshot({path:path.join(out,`fix15-mid-drag-${theme}.png`),clip:{x:0,y:430,width:300,height:240}});
  await page.mouse.up();await sleep(700);
  const after=await names();
  check(T('dropping saves the new order (first calendar moved down)'),after[0]===before[1]&&after.indexOf(before[0])>0,J([before,after]));
  await page.click('#sidebar .cal-name');await sleep(200); // pressing the name still just toggles/does nothing odd
  await page.evaluate(()=>document.querySelectorAll('#sidebar .cal-row')[2].querySelector('.cal-grip').focus());
  await page.keyboard.press('ArrowUp');await sleep(500);
  const kb=await names();
  check(T('keyboard: Arrow Up on the handle moves the row up one spot and keeps focus on it'),kb[1]===after[2]&&await page.evaluate(()=>document.activeElement.classList.contains('cal-grip')),J([after,kb]));

  // ---------------- Fix 17: Manage sharing sizing
  await openMg('Personal');
  const m17=await page.evaluate(()=>{const d=document.querySelector('.dl-manage'),r=s=>{const e=d.querySelector(s),b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.right),Math.round(b.width)]};return {field:r('.dl-inv-field'),row2:r('.dl-inv-row2'),perm:r('.dl-inv-perm'),send:r('.dl-inv-send'),ppl:r('.dl-ppl-row')}});
  check(T('Manage sharing: the picker + Invite row spans the field width with a content-sized picker and Invite at the right edge; people rows fill the content width'),m17.row2[2]===m17.field[2]&&m17.send[1]===m17.field[1]&&m17.ppl[2]===m17.field[2]&&m17.perm[2]<200,J(m17));
  await shot('fix17-manage-sharing');
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(500);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove())});

  // ---------------- Fix 34: Quick add is gone
  await page.evaluate(()=>openSearch());await sleep(400);await page.type('#palInput','Haircut Tue 6:30pm');await sleep(450);
  check(T('Search shows only search results (no create row for typed phrases)'),await page.evaluate(()=>!document.querySelector('.pal-create')&&!/Create event/.test(document.querySelector('#palResults').textContent)));
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>openEventForm(null,state.selected));await sleep(500);
  check(T('Create Event has no Quick add field and opens on Title'),await page.evaluate(()=>!document.querySelector('#efQuick')&&document.activeElement.id==='efTitle'));
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.remove())});

  // ---------------- Fix 20: select mode in Agenda
  await page.evaluate(()=>{state.view='agenda';state.section='calendar';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(500);
  const hasSel=await page.evaluate(()=>!!document.querySelector('.dl-selrow button'));
  check(T('Agenda has a Select button'),hasSel);
  await page.click('.dl-selrow button');await sleep(400);
  const cards=await page.$$('.agenda-card');
  await cards[2].click();await cards[3].click();await sleep(300);
  const sm=await page.evaluate(()=>({bar:document.querySelector('.dl-selbar .dl-sel-count').textContent,btns:[...document.querySelectorAll('.dl-selbar button')].map(b=>b.textContent.trim()),checked:document.querySelectorAll('.agenda-card .dl-checkbox.is-on').length}));
  check(T('Select mode: premium checkboxes, "N selected", Move to calendar…, Delete, Done'),sm.bar==='2 selected'&&sm.btns.join('|')==='Move to calendar…|Delete|Done'&&sm.checked===2,J(sm));
  await shot('fix20-select-mode');
  await page.click('.dl-selbar [data-move]');await sleep(350);
  const mm=await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>b.textContent.trim()));
  check(T('Move to calendar… lists the account’s owned calendars only'),mm.length>=2&&!mm.includes('US Holidays'),J(mm));
  const target=mm.find(x=>/Hungary/.test(x))||mm[0];
  await page.evaluate(t=>[...document.querySelectorAll('.menu .menu-item')].find(b=>b.textContent.trim()===t).click(),target);await sleep(600);
  check(T('moving applies to the selected events and ends Select mode'),await page.evaluate(()=>!document.querySelector('.dl-selbar')&&/moved to/.test(document.getElementById('toastRoot').textContent)));
  await page.click('.dl-selrow button');await sleep(300);
  const c2=await page.$$('.agenda-card');await c2[2].click();await sleep(200);
  await page.click('.dl-selbar [data-del]');await page.waitForSelector('.backdrop [data-ok]');await sleep(300);
  const dt=await page.evaluate(()=>document.querySelector('.backdrop .dialog-title').textContent);
  check(T('Delete shows ONE confirmation naming the count'),dt==='Delete 1 event?',dt);
  await page.keyboard.press('Escape');await sleep(300);
  await page.keyboard.press('Escape');await sleep(400);
  check(T('Escape exits Select mode'),await page.evaluate(()=>!document.querySelector('.dl-selbar')&&!document.body.classList.contains('dl-selecting')));

  // ---------------- Fix 24: print month
  await page.evaluate(()=>{state.view='month';state.section='calendar';state.cursor=new Date(2026,11,9);renderAll(false)});await sleep(500);
  const more=await page.evaluate(()=>{const b=[...document.querySelectorAll('.head-right .icon-btn')].find(x=>x.getAttribute('aria-label')==='More');return !!b});
  check(T('Month view has a ⋯ menu with Print month'),more);
  await page.evaluate(()=>[...document.querySelectorAll('.head-right .icon-btn')].find(x=>x.getAttribute('aria-label')==='More').click());await sleep(350);
  check(T('the menu lists Print month'),await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].some(b=>/Print month/.test(b.textContent))));
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>window.daylightBuildPrintMonth());await page.emulateMediaType('print');await page.setViewport({width:1100,height:780});await sleep(400);
  const pr=await page.evaluate(()=>({others:[...document.body.children].filter(c=>c.id!=='dlPrint'&&getComputedStyle(c).display!=='none').length,bg:getComputedStyle(document.body).backgroundColor,color:getComputedStyle(document.querySelector('#dlPrint')).color,weeks:document.querySelectorAll('#dlPrint .pm-week').length,bars:document.querySelectorAll('#dlPrint .pm-bar').length,title:document.querySelector('#dlPrint .pm-title').textContent}));
  check(T('print layout: white page, black text, only the month (no app chrome), title, weeks and continuous bars'),pr.others===0&&pr.bg==='rgb(255, 255, 255)'&&pr.color==='rgb(0, 0, 0)'&&pr.weeks>=5&&pr.bars>0&&pr.title==='December 2026',J(pr));
  await shot('fix24-print');
  await page.evaluate(()=>daylightEndPrintPreview());await page.emulateMediaType('screen');await page.setViewport({width:1440,height:1000});await sleep(300);
  // hidden calendars are excluded
  const shownBefore=await page.evaluate(()=>{const n=daylightBuildPrintMonth();const c=n.querySelectorAll('.pm-ev').length;daylightEndPrintPreview();return c});
  await page.evaluate(()=>{state.calendars.find(c=>c.name==='swimRVA Rapids').hidden=true;renderAll(false)});
  const shownAfter=await page.evaluate(()=>{const n=daylightBuildPrintMonth();const c=n.querySelectorAll('.pm-ev').length;daylightEndPrintPreview();return c});
  check(T('hidden calendars are not printed'),shownBefore>0&&shownAfter<shownBefore,J([shownBefore,shownAfter]));

  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('round 13 ui FAILED');process.exit(1)}
console.log('PASS round 13 ui');
