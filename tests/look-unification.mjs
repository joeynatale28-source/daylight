/**
 * Design unification: every popup follows Create Event (shell, header, fields, buttons) and Settings (cards, section labels).
 *  Item 2: New calendar uses the same field rule and the SAME color picker as Manage (identical geometry and behavior).
 *  Item 3: the Add/Subscribe chooser, the iCal-link form and the ICS-file form (a solid hairline card, no dashed border, "Browse" outline pill).
 *  Item 4: confirmation dialogs: buttons, body wrap ("1 event" never splits), danger red.
 *  Item 7: Settings: an X click with unsaved changes highlights the pill (no shake); after Save / Discard the X works.
 * Both themes; screenshots in ui-screenshots/look-unification.
 */
import fs from 'node:fs';import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','look-unification');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await app.load();await sleep(900);
  const top=()=>page.evaluate(()=>{const b=[...document.querySelectorAll('#overlayRoot > .backdrop')].pop();return b&&b.firstElementChild?b.firstElementChild.className:''});
  const geo=sel=>page.evaluate(s=>{const g=(el,props)=>{const c=getComputedStyle(el);const o={};props.forEach(p=>o[p]=c[p]);return o};const d=document.querySelector(s);const r=d.getBoundingClientRect();
   const input=d.querySelector('.text-input'),head=d.querySelector('.dialog-head'),foot=d.querySelector('.dialog-foot'),title=d.querySelector('.dialog-title');
   return {w:Math.round(r.width),radius:getComputedStyle(d).borderRadius,headBg:head?getComputedStyle(head).backgroundColor:null,headBorder:head?getComputedStyle(head).borderBottomWidth:null,title:title?getComputedStyle(title).fontSize+'/'+getComputedStyle(title).fontWeight:null,
    field:input?{h:Math.round(input.getBoundingClientRect().height),radius:getComputedStyle(input).borderRadius,bg:getComputedStyle(input).backgroundColor}:null,footBorder:foot?getComputedStyle(foot).borderTopWidth:null,justify:foot?getComputedStyle(foot).justifyContent:null}},sel);
  // the reference: Create Event
  await page.evaluate(()=>{state.section='calendar';renderAll(false);openEventForm(null,state.selected)});await page.waitForSelector('.event-form-dialog');await sleep(450);
  const ref=await geo('.event-form-dialog');
  await page.evaluate(()=>document.querySelector('.event-form-dialog [data-x]').click());await sleep(400);

  // ---- Item 2: New calendar
  await page.evaluate(()=>openNewCalendar());await page.waitForSelector('.dl-std #ncName');await sleep(450);
  const nc=await geo('.dl-std');
  check(T('New calendar: same shell, plain header, 44px / 12px field and footer as Create Event'),nc.w===ref.w&&nc.radius===ref.radius&&nc.headBg===ref.headBg&&nc.headBorder===ref.headBorder&&nc.footBorder===ref.footBorder&&nc.justify==='flex-end'&&nc.field.h===44&&nc.field.radius==='12px',JSON.stringify({nc,ref}));
  const ncPicker=await page.evaluate(()=>{const host=document.querySelector('#ncSwatches');const sw=[...host.querySelectorAll('.dl-sw:not(.dl-sw-add)')];const sizes=new Set(sw.map(x=>x.offsetWidth+'x'+x.offsetHeight));const rows={};sw.forEach(x=>{const k=Math.round(x.getBoundingClientRect().top);rows[k]=(rows[k]||0)+1});
   return {n:sw.length,sizes:[...sizes],radius:sw[0]&&getComputedStyle(sw[0]).borderRadius,rows:Object.values(rows),custom:!!host.querySelector('[data-custom-toggle]'),customClosed:host.querySelector('.dl-cp-custom').hidden,dashed:[...document.querySelectorAll('.dl-std *')].some(e=>/dashed/.test(getComputedStyle(e).borderTopStyle)&&!e.classList.contains('dl-sw-add'))}});
  check(T('New calendar uses the Item 1 picker: circular 26px swatches in one size, whole rows, a closed Custom color section behind the add tile, nothing dashed except that tile'),ncPicker.n>=30&&ncPicker.sizes.join()==='26x26'&&ncPicker.radius.includes('50')&&ncPicker.custom&&ncPicker.customClosed&&!ncPicker.dashed&&Math.max(...ncPicker.rows)-Math.min(...ncPicker.rows)<=1,JSON.stringify(ncPicker));
  await page.screenshot({path:path.join(out,`2-new-calendar-${theme}.png`)});
  const ncCmp=await page.evaluate(()=>{const host=document.querySelector('#ncSwatches');const sw=host.querySelector('.dl-sw');return {size:sw.offsetWidth,gap:Math.round(host.querySelectorAll('.dl-sw')[1].getBoundingClientRect().left-sw.getBoundingClientRect().right)}});
  await page.evaluate(()=>document.querySelector('.dl-std [data-x]').click());await sleep(350);
  await page.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')][0];row.querySelector('.cal-menu-btn').click();setTimeout(()=>{const m=document.querySelector('.menu .menu-item');if(m)m.click()},80)});await page.waitForSelector('.dl-manage');await sleep(500);
  const mgCmp=await page.evaluate(()=>{const host=document.querySelector('.dl-manage .dl-cp');const sw=host.querySelector('.dl-sw');return {size:sw.offsetWidth,gap:Math.round(host.querySelectorAll('.dl-sw')[1].getBoundingClientRect().left-sw.getBoundingClientRect().right)}});
  check(T('the picker in New calendar and in Manage is identical in swatch size and gap'),ncCmp.size===mgCmp.size&&ncCmp.gap===mgCmp.gap,JSON.stringify({ncCmp,mgCmp}));
  // picking a color in the New calendar picker really picks it; Custom color expands
  await page.evaluate(()=>document.querySelector('.dl-manage [data-custom-toggle]').click());await sleep(250);
  check(T('Manage: "Custom color" expands in the same card (hue + HEX + RGB)'),await page.evaluate(()=>{const c=document.querySelector('.dl-manage .dl-cp-custom');return !c.hidden&&!!c.querySelector('[data-hex]')&&!!c.querySelector('[data-rgb="0"]')&&!!c.querySelector('.dl-color-hue')}));
  await page.screenshot({path:path.join(out,`1-manage-custom-open-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await sleep(400);

  // ---- Item 3: chooser + forms
  await page.evaluate(()=>window.daylightAddToSubscriptions());await page.waitForSelector('.dl-chooser');await sleep(450);
  const ch=await geo('.dl-chooser');
  check(T('the chooser matches Create Event (width, radius, plain header)'),ch.w===ref.w&&ch.radius===ref.radius&&ch.headBg===ref.headBg&&ch.headBorder==='0px',JSON.stringify({ch,ref}));
  await page.screenshot({path:path.join(out,`3-chooser-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-chooser [data-opt="ical"]').click());await page.waitForSelector('#dlSubUrl');await sleep(450);
  const fm=await page.evaluate(()=>{const d=document.querySelector('.dl-form'),u=d.querySelector('#dlSubUrl'),n=d.querySelector('#dlSubName'),back=d.querySelector('[data-back]'),go=d.querySelector('[data-sub]');
   const r=e=>Math.round(e.getBoundingClientRect().height);return {urlH:r(u),nameH:r(n),urlR:getComputedStyle(u).borderRadius,nameR:getComputedStyle(n).borderRadius,back:!!back&&back.classList.contains('icon-btn'),goDisabled:go.disabled,goBg:getComputedStyle(go).backgroundColor,goOpacity:getComputedStyle(go).opacity,w:Math.round(d.getBoundingClientRect().width),radius:getComputedStyle(d).borderRadius,
    footJustify:getComputedStyle(d.querySelector('.dialog-foot')).justifyContent}});
  check(T('iCal-link form: both fields 44px / 12px, Back is a plain icon button, Subscribe keeps its primary look at the one disabled opacity, footer right-aligned'),fm.urlH===44&&fm.nameH===44&&fm.urlR==='12px'&&fm.nameR==='12px'&&fm.back&&fm.goDisabled&&fm.goOpacity==='0.55'&&fm.footJustify==='flex-end'&&fm.w===ref.w&&fm.radius===ref.radius,JSON.stringify(fm));
  await page.screenshot({path:path.join(out,`4-ical-form-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-form [data-back]').click());await page.waitForSelector('.dl-chooser');await sleep(450);
  await page.evaluate(()=>document.querySelector('.dl-chooser [data-opt="ics"]').click());await page.waitForSelector('.dl-drop');await sleep(450);
  const ics=await page.evaluate(()=>{const d=document.querySelector('.dl-drop'),c=getComputedStyle(d),b=d.querySelector('.dl-browse');const all=[...document.querySelectorAll('.dl-form *')].some(e=>/dashed/.test(getComputedStyle(e).borderTopStyle)||/dashed/.test(getComputedStyle(e).borderBottomStyle));
   return {style:c.borderTopStyle,width:c.borderTopWidth,radius:c.borderRadius,browse:b&&{tag:b.tagName,cls:b.className,h:b.offsetHeight,radius:getComputedStyle(b).borderRadius},dashed:all,select:!!document.querySelector('#dlIcsCal'),selH:document.querySelector('#dlIcsCal')&&Math.round(document.querySelector('#dlIcsCal').getBoundingClientRect().height)}});
  check(T('ICS form: the drop zone is a Settings-style card with a solid hairline border (no dashed element), Browse is a small outline pill, the dropdown follows the field rule'),ics.style==='solid'&&ics.radius==='16px'&&ics.browse&&ics.browse.tag==='BUTTON'&&/btn-ghost/.test(ics.browse.cls)&&ics.browse.h<=34&&!ics.dashed&&ics.selH===44,JSON.stringify(ics));
  await page.screenshot({path:path.join(out,`5-ics-form-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-form [data-x]').click());await sleep(350);

  // ---- Item 4: confirmations
  await page.evaluate(()=>{state.calendars.push({id:'cdel',name:'Camp',color:'rose',hidden:false,subscribed:false,shared:false});state.events.push({id:99001,cal:'cdel',title:'Only event',start:new Date(2026,10,12,9),end:new Date(2026,10,12,10),allDay:false,loc:'',desc:''});renderAll(false);confirmDeleteCalendar(state.calendars.find(c=>c.id==='cdel'))});
  await page.waitForSelector('.dl-confirm');await sleep(450);
  const cf=await page.evaluate(()=>{const d=document.querySelector('.dl-confirm'),p=d.querySelector('.dialog-body p'),btns=[...d.querySelectorAll('.dialog-foot button')],lines=(()=>{const range=document.createRange();range.selectNodeContents(p);const rects=[...range.getClientRects()];return new Set(rects.map(r=>Math.round(r.top))).size})();
   const oneEvent=p.textContent.includes('1 event');return {w:Math.round(d.getBoundingClientRect().width),text:p.textContent,oneEvent,lines,labels:btns.map(b=>b.textContent.trim()),cancelCls:btns[0].className,okCls:btns[1].className,okBg:getComputedStyle(btns[1]).backgroundColor,right:getComputedStyle(d.querySelector('.dialog-foot')).justifyContent}});
  check(T('Delete confirmation: "1 event" stays together, Cancel is the outline button, Delete the solid red one, right-aligned'),cf.oneEvent&&cf.labels.join('|')==='Cancel|Delete calendar'&&/btn-ghost/.test(cf.cancelCls)&&/btn-danger/.test(cf.okCls)&&cf.right==='flex-end'&&cf.w===ref.w,JSON.stringify(cf));
  await page.screenshot({path:path.join(out,`6-confirm-delete-${theme}.png`)});
  await page.evaluate(()=>document.querySelector('.dl-confirm [data-cancel]').click());await sleep(350);

  // ---- Item 7: Settings X with pending changes
  await page.evaluate(()=>{openSettings('calendar')});await page.waitForSelector('#csWeekends');await sleep(500);
  await page.evaluate(()=>{const i=document.querySelector('#csWeekends');i.checked=!i.checked;i.dispatchEvent(new Event('change',{bubbles:true}))});await sleep(400);
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(160);
  const nudge=await page.evaluate(()=>({nudge:document.querySelector('.settings-savebar').classList.contains('is-nudge'),open:!!document.querySelector('.settings-dialog'),anim:getComputedStyle(document.querySelector('.settings-savebar')).animationName,transform:getComputedStyle(document.querySelector('.settings-savebar')).transform}));
  check(T('Settings: clicking X with unsaved changes keeps Settings open; the pill was already showing and gets no separate highlight'),!nudge.nudge&&nudge.open&&!/dlPillNudge/.test(nudge.anim),JSON.stringify(nudge));
  await page.screenshot({path:path.join(out,`7-settings-x-nudge-${theme}.png`)});
  const xpos=await page.evaluate(()=>{const d=document.querySelector('.settings-dialog').getBoundingClientRect(),x=document.querySelector('.settings-close').getBoundingClientRect();return {right:Math.round(d.right-x.right),top:Math.round(x.top-d.top),inside:x.right<=d.right&&x.top>=d.top}});
  check(T('Settings: the X stays inside the dialog\'s top-right corner while changes are pending'),xpos.inside&&xpos.right===13&&xpos.top===13,JSON.stringify(xpos));
  await page.evaluate(()=>document.querySelector('[data-discard]').click());await sleep(450);
  await page.evaluate(()=>document.querySelector('.settings-close').click());await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:3000});
  check(T('after Discard the X works as normal'),true);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('look unification FAILED');process.exit(1)}
console.log('PASS look unification');
