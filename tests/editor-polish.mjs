/**
 * Items 7 and 8c on the real page, both themes: the calendar editor (the ⋯ popup) is finished like a Settings page.
 *  (i)   at common laptop and desktop sizes the dialog fits its content: no internal scroll, the Delete row fully visible
 *        (shorter windows scroll with a thin Settings-style scrollbar and still reach it);
 *  (ii)  the color palette fills whole rows (no half-empty last row, no dead gap before "Your colors");
 *  (iii) the Public link switch works for a signed-in owner; if the server says no, the state is calm, plain and retryable;
 *  (iv)  Export and Delete are real buttons in Settings-style rows (same typography and row padding as Settings).
 * Everything the editor did still works (rename, color + Save, sharing on/off, export, delete asks first).
 * Writes side-by-side shots (editor next to a Settings page) to ui-screenshots/editor-polish. LIVE_URL runs it on the deployed page.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','editor-polish');
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
  await app.load();await sleep(600);
  const openEditor=async name=>{await page.evaluate(n=>{const row=[...document.querySelectorAll('.cal-row')].find(r=>r.querySelector('.cal-name')?.textContent===n);row.querySelector('.cal-menu-btn').click()},name);await page.waitForSelector('.dl-calsettings');await sleep(650)};
  const closeEditor=async()=>{await page.evaluate(()=>document.querySelector('.dl-calsettings .settings-close')?.click());await page.waitForFunction(()=>!document.querySelector('.dl-calsettings'),{timeout:4000}).catch(async()=>{await page.evaluate(()=>{document.querySelectorAll('#overlayRoot>*').forEach(n=>n.remove());settingsState.transactionActive=false});});await sleep(350)};
  const measure=()=>page.evaluate(()=>{
   const d=document.querySelector('.dl-calsettings'),b=document.querySelector('.dl-cs2-body'),dr=d.getBoundingClientRect();
   const del=document.querySelector('[data-delete]'),dl=del&&del.getBoundingClientRect();
   const sw=[...document.querySelectorAll('[data-presets] .dl-sw')];const rows={};sw.forEach(x=>{const k=Math.round(x.getBoundingClientRect().top);rows[k]=(rows[k]||0)+1});
   const counts=Object.keys(rows).sort((a,b)=>a-b).map(k=>rows[k]);
   const presets=document.querySelector('[data-presets]').getBoundingClientRect(),yl=[...document.querySelectorAll('.dl-cs2-label')].find(n=>/Your colors/.test(n.textContent)).getBoundingClientRect();
   const saved=document.querySelector('[data-saved]').getBoundingClientRect(),picker=document.querySelector('[data-inline-picker]').getBoundingClientRect();
   const rowPad=el=>{const c=getComputedStyle(el);return c.paddingTop+'/'+c.paddingBottom};
   const actionRow=document.querySelector('[data-section="actions"] .set-row'),shareRow=document.querySelector('[data-section="sharing"] .set-row');
   return {scrolls:b.scrollHeight>b.clientHeight+1,over:b.scrollHeight-b.clientHeight,inside:dr.top>=0&&dr.bottom<=innerHeight,delVisible:!!dl&&dl.bottom<=dr.bottom+0.5&&dl.top>=dr.top,counts,gapToYours:Math.round(yl.top-presets.bottom),savedToPicker:Math.round(picker.top-saved.bottom),
    actionPad:rowPad(actionRow),sharePad:rowPad(shareRow),delTag:del&&del.tagName+'.'+del.className,expTag:document.querySelector('[data-export]').tagName+'.'+document.querySelector('[data-export]').className,
    toggleDisabled:!!(document.querySelector('[aria-label="Public link"]')||{}).disabled,note:(document.querySelector('.dl-cs-note')||{}).textContent,noteErr:!!document.querySelector('.dl-cs-note.is-error'),w:Math.round(dr.width),h:Math.round(dr.height)};
  });
  const settingsPad=await (async()=>{await page.evaluate(()=>openSettings('calendar'));await page.waitForSelector('.settings-dialog');await sleep(500);const r=await page.evaluate(()=>{const row=document.querySelector('.settings-pane .set-row');const c=getComputedStyle(row);return {pad:c.paddingTop+'/'+c.paddingBottom,label:getComputedStyle(row.querySelector('.sw-label')).fontSize+'/'+getComputedStyle(row.querySelector('.sw-label')).fontWeight,sub:getComputedStyle(row.querySelector('.sw-sub')).fontSize}});await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(400);return r})();

  for(const [w,h] of [[1920,1080],[1536,864],[1366,768],[1280,800]]){
   await page.setViewport({width:w,height:h,deviceScaleFactor:1});await sleep(400);
   await openEditor('Personal');
   const m=await measure();
   check(T(`${w}x${h}: the editor fits its content (no internal scroll), inside the window`),!m.scrolls&&m.inside,JSON.stringify(m));
   check(T(`${w}x${h}: "Delete calendar" is fully visible on first open`),m.delVisible,JSON.stringify(m));
   check(T(`${w}x${h}: the palette fills whole rows (${m.counts.join('/')})`),m.counts.length===3&&Math.max(...m.counts)-Math.min(...m.counts)<=1,JSON.stringify(m.counts));
   check(T(`${w}x${h}: no dead gap before "Your colors" or before the picker`),m.gapToYours<=34&&m.savedToPicker<=34,JSON.stringify({a:m.gapToYours,b:m.savedToPicker}));
   check(T(`${w}x${h}: rows use the same padding as Settings (${settingsPad.pad})`),m.actionPad===settingsPad.pad&&m.sharePad===settingsPad.pad,JSON.stringify({m:[m.actionPad,m.sharePad],settings:settingsPad}));
   check(T(`${w}x${h}: Export and Delete are real buttons`),/^BUTTON\.btn-ghost/.test(m.expTag)&&/^BUTTON\.btn-danger-outline/.test(m.delTag),JSON.stringify([m.expTag,m.delTag]));
   check(T(`${w}x${h}: the Public link switch is usable, with no error showing`),!m.toggleDisabled&&!m.noteErr&&!/auth/i.test(m.note||''),JSON.stringify({d:m.toggleDisabled,n:m.note}));
   if(w===1920||w===1280)await page.screenshot({path:path.join(out,`editor-${w}x${h}-${theme}.png`)});
   await closeEditor();
  }
  // a short window scrolls gently and still reaches Delete
  await page.setViewport({width:1280,height:640,deviceScaleFactor:1});await sleep(400);
  await openEditor('Personal');
  const short=await page.evaluate(()=>{const b=document.querySelector('.dl-cs2-body');b.scrollTop=b.scrollHeight;const d=document.querySelector('.dl-calsettings').getBoundingClientRect(),del=document.querySelector('[data-delete]').getBoundingClientRect();return {reach:del.bottom<=d.bottom+0.5&&del.top>=d.top,thin:getComputedStyle(b).scrollbarWidth}});
  check(T('a short window (640 tall) scrolls with a thin scrollbar and still reaches Delete'),short.reach&&short.thin==='thin',JSON.stringify(short));
  await closeEditor();
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await sleep(400);

  // side by side: the editor and a Settings page, same window
  await openEditor('Personal');
  const edBox=await page.evaluate(()=>{const r=document.querySelector('.dl-calsettings').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
  await page.screenshot({path:path.join(out,`side-editor-${theme}.png`),clip:{x:Math.max(0,edBox.x-8),y:Math.max(0,edBox.y-8),width:edBox.w+16,height:edBox.h+16},captureBeyondViewport:false});
  await closeEditor();
  await page.evaluate(()=>openSettings('calendar'));await page.waitForSelector('.settings-dialog');await sleep(600);
  const stBox=await page.evaluate(()=>{const r=document.querySelector('.settings-dialog').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
  await page.screenshot({path:path.join(out,`side-settings-${theme}.png`),clip:{x:Math.max(0,stBox.x-8),y:Math.max(0,stBox.y-8),width:stBox.w+16,height:stBox.h+16},captureBeyondViewport:false});
  await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(400);

  // the unchanged behaviors: rename, color + Save, sharing, export, delete asks first
  await openEditor('Personal');
  await page.click('#calSettingsName',{clickCount:3});await page.type('#calSettingsName','Personal renamed');
  await page.evaluate(()=>document.querySelectorAll('[data-presets] .dl-sw')[5].click());await sleep(300);
  check(T('rename and a color change raise the Save pill'),await page.evaluate(()=>!document.querySelector('.dl-calsettings .settings-savebar').hidden));
  await page.click('.dl-calsettings .settings-savebar [data-save]');await page.waitForFunction(()=>document.querySelector('.dl-calsettings .settings-savebar')?.hidden,{timeout:4000});await sleep(400);
  check(T('Save keeps the new name and color'),await page.evaluate(()=>state.calendars.some(c=>c.name==='Personal renamed')));
  await page.evaluate(()=>{window.__dl=[];const o=window.daylightExportCalendar;window.daylightExportCalendar=function(c){window.__dl.push(c.name);return o&&o.apply(this,arguments)}});
  await page.click('[data-export]');await sleep(300);
  check(T('Export runs for this calendar'),await page.evaluate(()=>window.__dl.length===1&&window.__dl[0]==='Personal renamed'));
  await page.click('[data-delete]');await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok], .backdrop [data-ok]',{timeout:3000});
  check(T('Delete asks for confirmation first (and nothing is deleted yet)'),await page.evaluate(()=>state.calendars.some(c=>c.name==='Personal renamed')));
  await page.evaluate(()=>{const b=[...document.querySelectorAll('.backdrop')].pop();(b.querySelector('[data-cancel]')||b.querySelector('.btn-ghost'))?.click()});await sleep(500);
  await page.evaluate(()=>{document.querySelectorAll('#overlayRoot>*').forEach(n=>n.remove());settingsState.transactionActive=false});await sleep(300);

  // the sharing state when the server says no
  await page.evaluate(()=>{const c=window.daylightCloud.client;const o=c.functions.invoke;window.__inv=o;c.functions.invoke=async function(n,opts){if(n==='ical-feed')return {data:null,error:{message:'Edge Function returned a non-2xx status code',context:{status:401,json:async()=>({error:'Authentication required'})}}};return o.apply(this,arguments)}});
  await openEditor('swimRVA Rapids');
  await page.evaluate(()=>{});
  const bad=await page.evaluate(()=>{const n=document.querySelector('.dl-cs-note');return {text:n.innerText,err:n.classList.contains('is-error'),color:getComputedStyle(n).color,retry:!!n.querySelector('button'),disabled:document.querySelector('[aria-label="Public link"]').disabled}});
  check(T('if sharing can\'t be checked: calm plain message, a Try again button, no red error text'),/couldn.t confirm your sign-in/i.test(bad.text)&&bad.retry&&!bad.err&&!/Authentication required/.test(bad.text),JSON.stringify(bad));
  await page.screenshot({path:path.join(out,`sharing-unavailable-${theme}.png`)});
  await page.evaluate(()=>{window.daylightCloud.client.functions.invoke=window.__inv});
  await page.evaluate(()=>document.querySelector('.dl-cs-note button').click());await sleep(700);
  check(T('Try again recovers: the switch is usable'),await page.evaluate(()=>!document.querySelector('[aria-label="Public link"]').disabled&&!document.querySelector('.dl-cs-note button')));
  await closeEditor();
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }finally{await app.close()}
}
if(failed){console.log('editor polish FAILED');process.exit(1)}
console.log('PASS editor polish');
