/**
 * Round 11 audit fixes, measured on the running page in both themes (computed styles and geometry, not source).
 * Items: 2 color picker  3 Manage finish  4 marooned buttons + popover  5 fields and disabled  6 calendar views  7 sidebar/tasks/search/bell
 *        8 auth pages  9 settings-wide  10 create menu.   (Item 1, passkeys, is proven in tests/security-settings.mjs.)
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round11');
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
  await page.evaluateOnNewDocument(()=>{window.__sh={shares:[]};window.__accounts={};window.__bc={owners:['00000000-0000-4000-8000-000000000001'],items:[{id:'n1',title:'Welcome',body:'Hello from Daylight',t:Date.now(),audience:'everyone',recipients:[]}],reads:{},clears:{},banners:[]}});
  await app.load();
  const ownedCal=()=>state.calendars.find(c=>!c.builtin&&!c.subscribed&&c.id!=='holidays');
  const openManage=async(kind)=>{await page.evaluate(k=>{const c=k==='holidays'?state.calendars.find(c=>c.id==='holidays'):state.calendars.find(c=>!c.builtin&&!c.subscribed&&c.id!=='holidays');daylightCalendarSettings(c)},kind);await page.waitForSelector('.dl-manage');await sleep(600)};
  const closeManage=async()=>{await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await page.waitForFunction(()=>!document.querySelector('.dl-manage'),{timeout:3000});await sleep(250)};

  // ================= Item 2: the one color picker
  await openManage();
  await page.click('.dl-cp [data-custom-toggle]');await sleep(300);
  const nums=await page.evaluate(()=>[...document.querySelectorAll('.dl-cp [data-rgb]')].map(i=>{const b=i.getBoundingClientRect(),cs=getComputedStyle(i);return {w:Math.round(b.width),color:cs.color,txt:i.value,fits:i.scrollWidth<=i.clientWidth+1}}));
  check(T('custom color: R, G and B numbers have room and a text color (visible in both themes)'),nums.length===3&&nums.every(n=>n.w>=18&&n.txt!==''&&n.fits&&n.color!=='rgba(0, 0, 0, 0)'),J(nums));
  await shot('2-picker-custom');
  const grid=await page.evaluate(()=>{const g=n=>{const e=document.querySelector(n);const cs=getComputedStyle(e);return {rg:cs.rowGap,cg:cs.columnGap}};const p=[...document.querySelectorAll('[data-presets] .dl-sw')],s=[...document.querySelectorAll('[data-saved] .dl-sw')];
   const lastRow=p.filter(x=>x.getBoundingClientRect().top===p[p.length-1].getBoundingClientRect().top).length;
   const gapsOK=(arr)=>{const r=arr.map(x=>x.getBoundingClientRect());let ok=true;for(let i=1;i<r.length;i++){if(Math.abs(r[i].top-r[i-1].top)<2){ok=ok&&Math.abs((r[i].left-r[i-1].right)-10)<1.5}}return ok};
   return {presets:g('[data-presets]'),saved:g('[data-saved]'),lastRow,cols:p.length,pOK:gapsOK(p),sOK:gapsOK(s),label:document.querySelector('.dl-cp-yourslabel').textContent,tileSize:[...document.querySelectorAll('[data-saved] .dl-sw-add')].map(t=>t.offsetWidth)[0],presetSize:p[0].offsetWidth,savedTop:s[0].getBoundingClientRect().top-p[p.length-1].getBoundingClientRect().bottom}});
  check(T('presets and Your colors use one grid system: the same 10px gap both ways, same cell size, the labeled saved row right under the presets'),grid.presets.rg==='10px'&&grid.presets.cg==='10px'&&grid.saved.rg==='10px'&&grid.saved.cg==='10px'&&grid.pOK&&grid.tileSize===grid.presetSize&&grid.savedTop<60&&grid.lastRow===10,J(grid));
  const dots=await page.evaluate(()=>{const w=[...document.querySelectorAll('[data-presets] .dl-sw')].find(b=>b.classList.contains('edge-light')),k=[...document.querySelectorAll('[data-presets] .dl-sw')].find(b=>b.classList.contains('edge-dark'));return {white:w&&getComputedStyle(w).boxShadow,black:k&&getComputedStyle(k).boxShadow}});
  check(T('the white and black dots carry a visible hairline ring in this theme'),dots.white&&dots.white!=='none'&&dots.black&&dots.black!=='none',J(dots));
  await page.evaluate(()=>{document.querySelector('[data-presets] .dl-sw.edge-light').click()});await sleep(200);
  check(T('a selected white dot shows a dark check'),await page.evaluate(()=>{const b=document.querySelector('[data-presets] .dl-sw.edge-light');return b.getAttribute('aria-pressed')==='true'&&getComputedStyle(b.querySelector('svg')).color==='rgb(17, 17, 17)'}));
  await shot('2-picker-white-selected');
  await page.evaluate(()=>document.querySelector('.settings-savebar [data-discard]')&&document.querySelector('.settings-savebar [data-discard]').click());await sleep(200);
  await closeManage();

  // Admin's banner color is the same component, collapsed the same way
  await page.waitForSelector('[data-side-row="admin"]',{timeout:8000});
  await page.evaluate(()=>document.querySelector('[data-side-row="admin"]').click());await page.waitForSelector('.dl-tabs');await sleep(400);
  await page.evaluate(()=>document.querySelector('.dl-tabs [data-tab="banners"]').click());await sleep(400);
  const adm=await page.evaluate(()=>{const cp=document.querySelector('.dl-page .dl-cp');return {same:!!cp&&!!cp.querySelector('[data-presets]')&&!!cp.querySelector('[data-custom-toggle]'),collapsed:cp&&cp.querySelector('.dl-cp-custom').hidden,oldSwatches:!!document.querySelector('.dl-ad-swatches')}});
  check(T('Admin banner color uses the same picker component, custom editor collapsed behind the add tile'),adm.same&&adm.collapsed&&!adm.oldSwatches,J(adm));
  await shot('2-admin-banner-picker');
  await page.evaluate(()=>document.querySelector('#sidebar .side-row[title="Calendar"]').click());await sleep(500);

  // ================= Item 3: Manage finish
  await openManage();
  const mg=await page.evaluate(()=>{const d=document.querySelector('.dl-manage'),f=d.querySelector('.dialog-foot'),b=d.querySelector('.dl-col-body');const cs=getComputedStyle(f);const lab=d.querySelector('.field > label'),inp=d.querySelector('.field > .text-input');
   return {footBorder:cs.borderTopWidth,footBg:cs.backgroundColor!=='rgba(0, 0, 0, 0)',bodyBottom:Math.round(b.getBoundingClientRect().bottom),footTop:Math.round(f.getBoundingClientRect().top),labelGap:Math.round(inp.getBoundingClientRect().top-lab.getBoundingClientRect().bottom)}});
  check(T('Manage has a real footer: a bottom strip with a top hairline; the content ends at it'),mg.footBorder==='1px'&&mg.footBg&&mg.bodyBottom<=mg.footTop+1,J(mg));
  await closeManage();
  await page.evaluate(()=>openEventForm(null,state.selected));await page.waitForSelector('.event-form-dialog,.dl-std');await sleep(500);
  const efGap=await page.evaluate(()=>{const lab=document.querySelector('.dialog .field > label'),inp=document.querySelector('.dialog .field > .text-input');return Math.round(inp.getBoundingClientRect().top-lab.getBoundingClientRect().bottom)});
  check(T('one label-to-field gap: Manage and the event form agree'),Math.abs(efGap-mg.labelGap)<=1,J([efGap,mg.labelGap]));
  // ================= Item 5: one focus treatment
  await page.focus('#efTitle');await sleep(200);
  const f1=await page.evaluate(()=>{const cs=getComputedStyle(document.querySelector('#efTitle'));return {bg:cs.backgroundColor,ring:cs.boxShadow!=='none',surface:getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()}});
  await page.evaluate(()=>{document.activeElement.blur();const loc=[...document.querySelectorAll('.dialog .text-input')].find(i=>i.id!=='efTitle'&&!i.disabled);loc.focus()});await sleep(200);
  const f2=await page.evaluate(()=>{const cs=getComputedStyle(document.activeElement);return {bg:cs.backgroundColor,ring:cs.boxShadow!=='none'}});
  check(T('every dialog text field gets the same focus treatment (elevated surface + ring), event Title included'),f1.ring&&f2.ring&&f1.bg===f2.bg,J([f1,f2]));
  await shot('5-focus-fields');
  await page.keyboard.press('Escape');await sleep(400);await page.keyboard.press('Escape');await sleep(300);
  await openManage('holidays');
  const hol=await page.evaluate(()=>[...document.querySelectorAll('.dl-manage .set-group-title')].filter(n=>n.offsetParent!==null).map(n=>n.textContent.trim()));
  check(T('US Holidays has no doubled heading (one "Color" title over the picker, then Export)'),hol.join()==='Color,Export',J(hol));
  await shot('3-holidays');
  await closeManage();

  // ================= Item 4: grouped invite controls; popover
  await openManage();
  const grp=await page.evaluate(()=>{const p=document.querySelector('.dl-manage [data-perm]').getBoundingClientRect(),s=document.querySelector('.dl-manage [data-send]').getBoundingClientRect();return {gap:Math.round(s.left-p.right),sameRow:Math.abs(p.top+p.height/2-(s.top+s.height/2))<4,left:Math.round(p.left)}});
  check(T('Manage: the permission picker and Invite sit together (a ~10px gap, left-aligned)'),grp.gap>=6&&grp.gap<=14&&grp.sameRow,J(grp));
  const disabledLook=await page.evaluate(()=>{const b=document.querySelector('.dl-manage [data-send]');const cs=getComputedStyle(b);return {op:+cs.opacity,bg:cs.backgroundColor}});
  check(T('the disabled Invite button still reads as the primary action (primary fill at the one disabled opacity)'),disabledLook.op>=0.5&&disabledLook.op<1,J(disabledLook));
  await shot('4-invite-group');
  await closeManage();
  await page.evaluate(()=>{[...document.querySelectorAll('.chip')].find(c=>/Practice/.test(c.textContent)).click()});await page.waitForSelector('.popover');await sleep(500);
  const pop=await page.evaluate(()=>({calIcon:!!document.querySelector('.popover .pop-rows .pop-ic svg path[d*="M8 2v4"]'),names:[...document.querySelectorAll('.popover')].map(p=>p.innerText.split(/swimRVA Rapids/).length-1)[0]}));
  check(T('the popover names the calendar once (the chip), no bottom calendar row'),pop.names===1&&!pop.calIcon,J(pop));
  await page.evaluate(()=>document.querySelector('[data-act="share"]').click());await page.waitForSelector('.popover.is-sharing');await sleep(600);
  const sg=await page.evaluate(()=>{const p=document.querySelector('.dl-share-view [data-perm]').getBoundingClientRect(),s=document.querySelector('.dl-share-view [data-send]').getBoundingClientRect();return {gap:Math.round(s.left-p.right),left:Math.round(p.left)}});
  check(T('Share view: picker and Send adjacent (~10px), left-aligned'),sg.gap>=6&&sg.gap<=14,J(sg));
  await shot('4-share-group');
  await page.keyboard.press('Escape');await sleep(400);

  // ================= Item 5: disabled means disabled
  await page.evaluate(()=>openSettings('notifications'));await page.waitForSelector('.settings-dialog');await sleep(700);
  const ntOff=await page.evaluate(()=>{const t=document.querySelector('#ntDaily');const sel=document.querySelector('#ntSummary');return {daily:t.checked,summaryDisabled:sel.disabled,op:+getComputedStyle(sel).opacity}});
  check(T('Summary time is disabled while Daily summary is off, at the standard disabled opacity'),!ntOff.daily&&ntOff.summaryDisabled&&ntOff.op>0.5&&ntOff.op<0.7,J(ntOff));
  await page.evaluate(()=>{const lab=document.querySelector('#ntDaily');lab.click()});await sleep(300);
  check(T('turning Daily summary on enables its time'),await page.evaluate(()=>!document.querySelector('#ntSummary').disabled));
  await shot('5-summary-time');
  await page.evaluate(()=>document.querySelector('.settings-savebar [data-discard]')&&document.querySelector('.settings-savebar [data-discard]').click());await sleep(200);
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);
  await page.evaluate(()=>openSettings('calendar'));await page.waitForSelector('.settings-dialog');await sleep(700);
  const tz=await page.evaluate(()=>{const t=document.querySelector('#gsTz');return {dis:t.disabled,op:+getComputedStyle(t).opacity}});
  check(T('the disabled time zone dropdown uses the one standard disabled opacity'),tz.dis&&Math.abs(tz.op-0.55)<0.02,J(tz));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);

  // ================= Item 9: settings-wide
  await page.evaluate(()=>openSettings('shortcuts'));await page.waitForSelector('.settings-dialog');await sleep(700);
  const dv=await page.evaluate(()=>{const sc=getComputedStyle(document.querySelector('.shortcut-row')).borderBottomColor;return {sc,rows:[...document.querySelectorAll('.shortcut-row')].map(r=>getComputedStyle(r).borderBottomWidth)}});
  check(T('Shortcuts rows carry the same hairline dividers as the other panes (all but the last)'),dv.rows.slice(0,-1).every(w=>w==='1px')&&dv.rows[dv.rows.length-1]==='0px',J(dv));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);
  await page.evaluate(()=>openSettings('calendar'));await page.waitForSelector('.settings-dialog');await sleep(700);
  const subs=await page.evaluate(()=>[...document.querySelectorAll('.settings-pane .sw-sub')].filter(n=>/Changes the first column/.test(n.textContent)).map(n=>({t:n.textContent.slice(0,30),lines:Math.round(n.getBoundingClientRect().height/parseFloat(getComputedStyle(n).lineHeight))})));
  check(T('Calendar pane: the "Start week on" subtitle is one line at dialog width'),subs.length===1&&subs[0].lines===1,J(subs));
  await page.evaluate(()=>{const s=document.querySelector('#gsView,#csView');});
  await page.evaluate(()=>{const t=document.querySelectorAll('.settings-pane input[type=checkbox]')[1];t.click()});await sleep(400);
  const pill=await page.evaluate(()=>{const b=document.querySelector('.settings-savebar');const pane=document.querySelector('.settings-pane');return {shown:!b.hidden,pad:parseFloat(getComputedStyle(pane).paddingBottom)}});
  check(T('while the Save pill shows, the pane keeps room under its content (no control sits under it)'),pill.shown&&pill.pad>=96,J(pill));
  await shot('9-pill');
  await page.evaluate(()=>document.querySelector('.settings-savebar [data-save]').click());await sleep(250);
  check(T('the saved state shows Saved without a Discard beside it'),await page.evaluate(()=>{const b=document.querySelector('.settings-savebar');return b.classList.contains('is-saved')&&getComputedStyle(b.querySelector('[data-discard]')).display==='none'}));
  await sleep(900);
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);
  await page.evaluate(()=>openSettings('ai'));await page.waitForSelector('.settings-dialog');await sleep(900);
  const ai=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.settings-pane [data-list] .dl-sec-row')];return {n:rows.length,h:rows.map(r=>Math.round(r.getBoundingClientRect().height))}});
  check(T('AI access: one row per AI, equal height'),ai.n>=2&&Math.abs(ai.h[0]-ai.h[1])<=4,J(ai));
  await shot('9-ai');
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.dl-sec-group');await sleep(700);
  const em=await page.evaluate(()=>{const l=document.querySelector('.dl-idf-lock');const cs=getComputedStyle(l);const n=getComputedStyle(document.querySelector('#profileFullName'));return {lockBg:cs.backgroundColor,nameBg:n.backgroundColor,border:cs.borderTopWidth}});
  check(T('the locked Email field looks different from the editable Name field (quiet, outlined, no fill)'),em.lockBg==='rgba(0, 0, 0, 0)'&&em.nameBg!=='rgba(0, 0, 0, 0)',J(em));
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(500);

  // ================= Item 6: calendar views
  await page.evaluate(()=>{state.cursor=new Date(2026,10,8);state.selected=new Date(2026,10,8);state.view='week';state.section='calendar';renderAll(false)});await sleep(700);
  const wk=await page.evaluate(()=>({title:document.querySelector('#tbMonth').textContent,prev:document.querySelector('#tbPrev').getAttribute('aria-label'),next:document.querySelector('#tbNext').getAttribute('aria-label'),h0:(document.querySelector('.hour-label.is-first')||{}).textContent,labels:document.querySelectorAll('.hour-label').length,gmt:getComputedStyle(document.querySelector('.tg-gutter-head')).alignItems}));
  check(T('Week header names the week range and its arrows say week'),wk.title==='Nov 8–14, 2026'&&wk.prev==='Previous week'&&wk.next==='Next week',J(wk));
  check(T('the time grid has a 12 AM row (24 labels) and the GMT label shares the labels\' right edge'),wk.h0==='12 AM'&&wk.labels===24&&wk.gmt==='flex-end',J(wk));
  await page.evaluate(()=>document.querySelector('#tbNext').click());await sleep(600);
  check(T('Next week moves exactly one week'),await page.evaluate(()=>document.querySelector('#tbMonth').textContent==='Nov 15–21, 2026'));
  await page.evaluate(()=>{state.cursor=new Date();state.view='week';renderAll(false)});await sleep(700);
  const now=await page.evaluate(()=>{const pill=document.querySelector('.now-pill'),labs=[...document.querySelectorAll('.hour-label')];if(!pill)return {skip:true};const pr=pill.getBoundingClientRect();const g=document.querySelector('.tg-gutter').getBoundingClientRect();return {pillLeft:Math.round(pr.left-g.right),overlapsLabel:labs.some(l=>{const r=l.getBoundingClientRect();return r.right>pr.left&&r.left<pr.right&&r.bottom>pr.top&&r.top<pr.bottom})}});
  check(T('the now pill sits in the grid, not over the hour labels'),now.skip||(!now.overlapsLabel&&now.pillLeft>=0),J(now));
  await shot('6-week-now');
  await page.evaluate(()=>{state.view='day';state.cursor=new Date(2026,11,9);renderAll(false)});await sleep(700);
  const dayW=await page.evaluate(()=>{const c=document.querySelector('.ev-card');return c?Math.round(c.getBoundingClientRect().width):0});
  check(T('Day view: a one-hour event is not a screen-wide slab'),dayW>0&&dayW<=720,String(dayW));
  await page.evaluate(()=>{state.view='agenda';state.cursor=new Date(2026,11,9);renderAll(false)});await sleep(700);
  const ag=await page.evaluate(()=>({title:document.querySelector('#tbMonth').textContent,prev:document.querySelector('#tbPrev').getAttribute('aria-label'),end:(document.querySelector('.agenda-end')||{}).textContent,w:Math.round(document.querySelector('.agenda-inner').getBoundingClientRect().width)}));
  check(T('Agenda names its period, says "period" on its arrows and ends with a quiet line'),ag.title==='Dec 9–29, 2026'&&ag.prev==='Previous period'&&/^No more events in/.test(ag.end||''),J(ag));
  await page.evaluate(()=>{state.section='tasks';renderAll(false)});await sleep(700);
  const col=await page.evaluate(()=>{const t=document.querySelector('.tasks-inner').getBoundingClientRect();return [Math.round(t.left),Math.round(t.width)]});
  check(T('Agenda and Tasks share one content column'),col[1]===ag.w,J([col,ag.w]));
  await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,10,9);renderAll(false)});await sleep(700);
  const mo=await page.evaluate(()=>{const cell=[...document.querySelectorAll('.day-cell')].find(c=>c.querySelector('.chip')&&!c.matches(':last-child'));const ch=cell.querySelector('.chip'),cr=cell.getBoundingClientRect(),hr=ch.getBoundingClientRect();const today=document.querySelector('.day-cell.today');return {l:Math.round(hr.left-cr.left),r:Math.round(cr.right-hr.right),todayBg:getComputedStyle(today).backgroundColor,disc:getComputedStyle(today.querySelector('.day-num')).backgroundColor}});
  check(T('Month: chips span the cell with even insets (within 1px, border included)'),Math.abs(mo.l-mo.r)<=2,J(mo));
  check(T('Month: today has ONE highlight (the number disc), no tinted cell'),mo.todayBg==='rgba(0, 0, 0, 0)'&&mo.disc!=='rgba(0, 0, 0, 0)',J(mo));
  await shot('6-month');

  // ================= Item 7
  const sb=await page.evaluate(()=>{const sb=document.querySelector('#sidebar');const q=s=>sb.querySelector(s).getBoundingClientRect();const rows=[...sb.querySelectorAll('.side-row')].map(r=>Math.round(r.getBoundingClientRect().height));const create=q('.create-pill'),mini=q('.mini-head'),nav=q('.side-nav');const lastDay=[...sb.querySelectorAll('.mini-day')].pop().getBoundingClientRect();const supLabel=[...sb.querySelectorAll('.side-label')].find(l=>/Support/.test(l.textContent)).querySelector('span').getBoundingClientRect();const subs=[...sb.querySelectorAll('.cal-list')].pop().getBoundingClientRect();const prof=q('.profile-wrap'),set=[...sb.querySelectorAll('.side-row')].pop().getBoundingClientRect();
   return {rows,gapCreateMini:Math.round(mini.top-create.bottom),gapMiniNav:Math.round(nav.top-lastDay.bottom),gapSubsSupport:Math.round(supLabel.top-subs.bottom),profBottom:Math.round(prof.bottom),sbBottom:Math.round(sb.getBoundingClientRect().bottom),gapSettingsProfile:Math.round(prof.top-set.bottom)}});
  check(T('sidebar: every nav/support row is one height'),new Set(sb.rows).size===1,J(sb));
  check(T('sidebar: Create→mini and mini→nav gaps match, and Subscriptions→Support is a section gap (not a void)'),Math.abs(sb.gapCreateMini-sb.gapMiniNav)<=8&&sb.gapSubsSupport<=64,J(sb));
  check(T('sidebar: the account block stays pinned at the bottom'),sb.sbBottom-sb.profBottom<=16,J(sb));
  await shot('7-sidebar');
  check(T('row action buttons are not invisible-only (visible on keyboard focus; touch media rule present)'),await page.evaluate(()=>{const row=document.querySelector('.cal-row');row.querySelector('.cal-check').focus();return getComputedStyle(row.querySelector('.cal-menu-btn')).opacity==='1'})&&/\(hover: none\)/.test(await page.evaluate(()=>[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join(''))));
  await page.evaluate(()=>{state.section='tasks';state.tasks=[];renderAll(false)});await sleep(700);
  const tk=await page.evaluate(()=>({adds:document.querySelectorAll('.tasks-inner .btn-primary, .empty-state .btn-primary, .empty-state button').length,empty:!!document.querySelector('.empty-state'),emptyBtn:!!document.querySelector('.empty-state button'),headerBtn:!!document.querySelector('.tasks-head .btn-primary,.tasks-head button'),inline:!!document.querySelector('#taskTitleInput')}));
  check(T('Tasks empty screen: header add + inline add only (no third button in the empty state)'),tk.empty&&!tk.emptyBtn&&tk.inline,J(tk));
  await shot('7-tasks-empty');
  await page.evaluate(()=>{state.section='calendar';renderAll(false)});await sleep(500);
  await page.keyboard.down('Control');await page.keyboard.press('k');await page.keyboard.up('Control');await page.waitForSelector('#palInput');await sleep(500);
  check(T('Search has ONE X (the dialog close), no second clear button'),await page.evaluate(()=>document.querySelectorAll('.palette #palClose, .palette #palClear, .palette .palette-clear').length===1));
  await page.keyboard.press('Escape');await sleep(400);
  await page.click('.dl-notif-btn');await page.waitForSelector('.dl-notif-panel');await sleep(600);
  const bell=await page.evaluate(()=>{const p=document.querySelector('.dl-notif-panel').getBoundingClientRect(),g=document.querySelector('.head-right').getBoundingClientRect();const m=document.querySelector('.dl-notif-markall');return {edge:Math.round(g.right-p.right),mark:!!m&&!m.hidden,unreadRows:document.querySelectorAll('.dl-notif-item.is-unread').length}});
  check(T('Notifications panel is flush with the header actions\' right edge and offers Mark all read while unread rows show'),Math.abs(bell.edge)<=2&&bell.mark&&bell.unreadRows>=1,J(bell));
  await shot('7-bell');
  await page.evaluate(()=>document.querySelector('.dl-notif-markall').click());await sleep(300);
  check(T('Mark all read clears the unread markers and hides itself'),await page.evaluate(()=>document.querySelectorAll('.dl-notif-item.is-unread').length===0&&document.querySelector('.dl-notif-markall').hidden));
  await page.keyboard.press('Escape');await sleep(400);

  // ================= Item 10
  await page.click('.create-main');await sleep(500);
  const cm=await page.evaluate(()=>{const m=document.querySelector('.menu').getBoundingClientRect(),n=document.querySelector('#miniWrap .mini-nav:last-of-type,#miniWrap .mini-nav');const nn=[...document.querySelectorAll('#miniWrap .mini-nav')].pop().getBoundingClientRect();return {covers:m.right>=nn.right,w:Math.round(m.width)}});
  check(T('the Create menu is as wide as the sidebar column (no stray arrow beside the Event row)'),cm.covers,J(cm));
  await shot('10-create-menu');
  await page.keyboard.press('Escape');await sleep(300);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}

// ================= Item 8: auth pages (signed out)
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,signedIn:false});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await page.goto(app.url,{waitUntil:'load'});await page.waitForSelector('#authScreen .auth-primary',{timeout:15000});await sleep(1300);
  const hts=await page.evaluate(()=>[...document.querySelectorAll('.auth-primary,.auth-social')].map(b=>Math.round(b.getBoundingClientRect().height)));
  check(T('sign in: one button height for Log in, Google and passkey'),new Set(hts).size===1&&hts.length===3,J(hts));
  const art=await page.evaluate(()=>{const a=document.querySelector('.auth-art');const days=[...a.querySelectorAll('.auth-art-day')];const inM=days.filter(d=>!d.classList.contains('out'));const chip=a.querySelector('.auth-art-chip');const cell=chip&&chip.closest('.auth-art-day');const cr=cell&&cell.getBoundingClientRect(),hr=chip&&chip.getBoundingClientRect();
   const now=new Date();return {dows:a.querySelectorAll('.auth-art-dow').length,inMonth:inM.length,expected:new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),total:days.length,chipInside:!!(cr&&hr.left>=cr.left&&hr.right<=cr.right&&hr.top>=cr.top&&hr.bottom<=cr.bottom),card:!!a.querySelector('.auth-art-card')}});
  check(T('hero preview is a complete month: weekday header, every date, the event chip inside its cell, no floating card'),art.dows===7&&art.inMonth===art.expected&&art.total%7===0&&art.chipInside&&!art.card,J(art));
  await shot('8-signin');
  await page.click('#authToSignup');await sleep(700);
  const su=await page.evaluate(()=>({pills:[...document.querySelectorAll('.auth-methods .auth-social')].map(b=>b.textContent.trim()),terms:(()=>{const t=document.querySelector('.auth-terms');const r=document.createRange();r.selectNodeContents(t);const rects=[...r.getClientRects()];const lines=new Set(rects.map(x=>Math.round(x.top)));return lines.size})(),termsText:document.querySelector('.auth-terms').textContent}));
  check(T('sign-up offers Google and the passkey, same as sign-in'),su.pills.join()==='Continue with Google,Use a passkey',J(su));
  check(T('the terms line does not orphan a single word (balanced wrap)'),await page.evaluate(()=>{const t=document.querySelector('.auth-terms');return getComputedStyle(t).textWrap==='balance'||getComputedStyle(t).textWrapStyle==='balance'}),J(su));
  await shot('8-signup');
  await page.click('#authToLogin');await sleep(700);
  await page.click('#authForgotLink');await sleep(800);
  const fp=await page.evaluate(()=>{const h=document.querySelector('.auth-headline');const lh=parseFloat(getComputedStyle(h).lineHeight)||parseFloat(getComputedStyle(h).fontSize)*1.2;const back=document.querySelector('#authToLogin');const b=back.getBoundingClientRect();return {lines:Math.round(h.getBoundingClientRect().height/lh),text:h.textContent,backH:Math.round(b.height),backBorder:getComputedStyle(back).borderTopWidth}});
  check(T('Forgot password: heading on one line, Back to sign in is a real button'),fp.lines===1&&fp.backH>=40&&fp.backBorder==='1px',J(fp));
  await shot('8-forgot');
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('round 11 fixes FAILED');process.exit(1)}
console.log('PASS round 11 fixes');
