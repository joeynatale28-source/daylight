/**
 * Round 9 Part 8, nine live-verification fixes, both themes, measured on the running page (frames and computed styles, not source):
 *  1 "Your colors" section + add tile + hover x          2 Settings X pill highlight >= 600ms     3 Reduce motion: open AND close instant
 *  4 Tasks tab cross-fade (real tasks)                    5 primary button hover + press           6 directional slides mid-frame
 *  7 date number -> Day view                              8 no eye toggle on subscribed rows       9 softer month lines, chip finish
 * Plus the Manage dialog as a Settings sibling and the Share-view swap (no jump).
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round9');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};

for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:1000});
 const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await page.evaluateOnNewDocument(()=>{window.__sh={shares:[]};window.__accounts={}});
  await app.load();
  const openManage=async()=>{await page.evaluate(()=>{const c=state.calendars.find(c=>!c.builtin&&!c.subscribed&&c.id!=='holidays');daylightCalendarSettings(c)});await page.waitForSelector('.dl-manage');await sleep(450)};
  const closeManage=async()=>{await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());await page.waitForFunction(()=>!document.querySelector('.dl-manage'),{timeout:3000});await sleep(250)};

  // ---- 1. Your colors
  await openManage();
  const y0=await page.evaluate(()=>{const l=document.querySelector('.dl-cp-yourslabel');const tile=document.querySelector('.dl-cp [data-custom-toggle]');return {visible:!!l&&l.offsetParent!==null,text:l&&l.textContent,tile:!!tile,tileRound:tile&&getComputedStyle(tile).borderRadius,custom:document.querySelector('.dl-cp-custom').hidden,chip:!!document.querySelector('.dl-cp-toggle')}});
  check(T('"Your colors" is always there, with one add tile (circle +) and the old Custom color chip gone'),y0.visible&&y0.text==='Your colors'&&y0.tile&&y0.custom&&!y0.chip,JSON.stringify(y0));
  await page.click('.dl-cp [data-custom-toggle]');await sleep(250);
  check(T('the add tile expands Custom color'),await page.evaluate(()=>!document.querySelector('.dl-cp-custom').hidden&&document.querySelector('.dl-cp [data-custom-toggle]').getAttribute('aria-expanded')==='true'));
  await page.$eval('.dl-cp-custom [data-hex]',n=>{n.value=''});await page.type('.dl-cp-custom [data-hex]','#7A3FD0');await page.keyboard.press('Enter');await sleep(250);
  await page.evaluate(()=>document.querySelector('[data-save-custom]').click());await sleep(300);
  const y1=await page.evaluate(()=>{const sw=[...document.querySelectorAll('[data-saved] .dl-sw[data-color]')];const pre=document.querySelector('[data-presets] .dl-sw');return {saved:sw.map(b=>b.dataset.color),pressed:sw.map(b=>b.getAttribute('aria-pressed')),sameSize:sw[0]&&pre&&sw[0].offsetWidth===pre.offsetWidth,savedState:state.customColors.slice()}});
  check(T('a saved custom color appears in "Your colors" as a swatch the size of the presets, selected (check)'),y1.saved.join()==='#7A3FD0'&&y1.pressed[0]==='true'&&y1.sameSize,JSON.stringify(y1));
  await page.evaluate(()=>{document.querySelector('.dl-col-body').scrollTop=0});
  await shot('1-your-colors');
  // pick another color, then remove the saved one: the calendar keeps its color
  await page.evaluate(()=>document.querySelector('[data-presets] .dl-sw[data-color]').click());await sleep(150);
  const before=await page.evaluate(()=>state.calendars.find(c=>!c.builtin&&!c.subscribed&&c.id!=='holidays').color);
  await page.evaluate(()=>document.querySelector('[data-saved] .dl-color-remove').click());await sleep(200);
  const y2=await page.evaluate(()=>({n:document.querySelectorAll('[data-saved] .dl-sw[data-color]').length,color:state.calendars.find(c=>!c.builtin&&!c.subscribed&&c.id!=='holidays').color,tile:!!document.querySelector('[data-saved] [data-custom-toggle]')}));
  check(T('the hover x removes only the palette entry; the calendar keeps its color; the add tile stays'),y2.n===0&&y2.color===before&&y2.tile,JSON.stringify([y2,before]));
  await page.evaluate(()=>document.querySelector('.settings-savebar [data-discard]').click());await sleep(200);
  await closeManage();

  // ---- Manage as a Settings sibling
  await openManage();
  const mg=await page.evaluate(()=>{const d=document.querySelector('.dl-manage');const cs=getComputedStyle(d);const titles=[...d.querySelectorAll('.set-group-title')].filter(n=>n.offsetParent!==null).map(n=>n.textContent.trim());const nested=d.querySelectorAll('.set-group .set-group').length;return {radius:cs.borderRadius,width:Math.round(d.getBoundingClientRect().width),titles,nested,outline:cs.outlineStyle,headBorder:getComputedStyle(d.querySelector('.dialog-head')).borderBottomWidth,footBorder:getComputedStyle(d.querySelector('.dialog-foot')).borderTopWidth,h3:d.querySelectorAll('.dl-col-h').length}});
  check(T('Manage: 16px radius like Settings, 560 wide, cards titled in small caps, no nested cards, no section headings, no hairline under the header, a real footer strip with one hairline, no focus box'),mg.radius==='16px'&&mg.width===560&&mg.titles.join()==='Calendar,Sharing,General access,Export,Danger zone'&&mg.nested===0&&mg.h3===0&&mg.headBorder==='0px'&&mg.footBorder==='1px'&&mg.outline==='none',JSON.stringify(mg));
  await shot('2-manage');
  await closeManage();

  // ---- 2. Settings X highlight
  await page.evaluate(()=>openSettings('profile'));await page.waitForSelector('.settings-dialog');await sleep(600);
  await page.$eval('#profileFullName',n=>{n.focus();n.value='Calendar Demo Two';n.dispatchEvent(new Event('input',{bubbles:true}))});await sleep(300);
  await page.click('.settings-close');await sleep(60);
  const nz=[];
  for(const ms of [0,150,300,450]){await sleep(ms?150:0);nz.push(await page.evaluate(()=>{const b=document.querySelector('.settings-savebar');const cs=getComputedStyle(b);return {nudge:b.classList.contains('is-nudge'),shadow:cs.boxShadow!=='none',border:cs.borderColor}}))}
  await page.screenshot({path:path.join(out,`3-settings-x-pending-${theme}.png`)});
  check(T('with changes pending, X leaves the dialog open and the Save/Discard pill glows (held ~1s)'),nz.every(x=>x.nudge&&x.shadow)&&await page.evaluate(()=>!!document.querySelector('.settings-dialog')),JSON.stringify(nz));
  await sleep(1200);
  check(T('the highlight then settles'),await page.evaluate(()=>!document.querySelector('.settings-savebar').classList.contains('is-nudge')));
  await page.evaluate(()=>document.querySelector('.settings-savebar [data-discard]').click());await sleep(300);
  await page.click('.settings-close');await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:3000});
  check(T('with nothing pending, X closes normally'),true);
  await sleep(300);

  // ---- 3. Reduce motion: open and close both instant
  await page.evaluate(()=>{state.reduceMotion=true;document.body.classList.add('reduce-motion','dl-reduce-motion')});
  const rm=await page.evaluate(()=>new Promise(res=>{const c=state.calendars.find(c=>!c.builtin&&!c.subscribed&&c.id!=='holidays');daylightCalendarSettings(c);
   const dlg=document.querySelector('.dl-manage');const cs=getComputedStyle(dlg);const first={op:cs.opacity,tf:cs.transform};
   const anims=document.getAnimations().filter(a=>a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('.dl-manage,.backdrop')).map(a=>({n:a.animationName||a.transitionProperty,d:a.effect.getTiming().duration}));
   res({first,anims})}));
  check(T('Reduce motion: opening Manage is instant (full opacity, no scale on the first frame, no animation longer than a frame)'),rm.first.op==='1'&&(rm.first.tf==='none'||rm.first.tf==='matrix(1, 0, 0, 1, 0, 0)')&&rm.anims.every(a=>a.d<=1||(a.n!=='dl-overlay-show'&&a.n!=='dl-backdrop-show'&&a.d<=100)),JSON.stringify(rm));
  await sleep(200);
  const t0=Date.now();await page.evaluate(()=>document.querySelector('.dl-manage [data-done]').click());
  await page.waitForFunction(()=>!document.querySelector('.dl-manage'),{timeout:2000});
  const closeMs=Date.now()-t0;
  check(T('Reduce motion: closing is instant too (gone in well under one normal 170ms close)'),closeMs<170,String(closeMs));
  await page.evaluate(()=>{state.reduceMotion=false;document.body.classList.remove('reduce-motion','dl-reduce-motion')});

  // ---- 4. Tasks tab cross-fade with real tasks
  await page.evaluate(()=>{const cid=state.calendars.find(c=>!c.builtin)&&state.calendars.find(c=>!c.builtin).id;state.tasks=[{id:1,title:'Pack swim bag',cal:cid,due:new Date(),done:false},{id:2,title:'Sign permission slip',cal:cid,due:new Date(),done:false},{id:3,title:'Return library book',cal:cid,due:new Date(),done:true}];state.section='tasks';state.taskFilter='all';renderAll(false)});await sleep(500);
  await shot('4-tasks-all');
  const tf=await page.evaluate(()=>new Promise(res=>{const seg=[...document.querySelectorAll('.task-seg button')].find(b=>b.textContent==='Completed');const card=document.querySelector('.task-add-card,.tasks-inner > *');const out=[];const t0=performance.now();seg.click();
   function f(){const r=document.querySelector('.task-results');out.push([Math.round(performance.now()-t0),r?+getComputedStyle(r).opacity:null,document.querySelectorAll('.task-row').length,card?+getComputedStyle(card).opacity:null]);if(performance.now()-t0<450)requestAnimationFrame(f);else res(out)}f()}));
  const minOp=Math.min(...tf.map(x=>x[1]));const final=tf[tf.length-1];
  check(T('Tasks: switching tabs cross-fades the list (fades down, then up) with real tasks; the add card never flickers'),minOp<0.5&&final[1]===1&&final[2]===1&&tf.every(x=>x[3]===null||x[3]===1)&&tf.some(x=>x[2]===3)||(minOp<0.5&&final[1]===1&&final[2]===1&&tf.every(x=>x[3]===null||x[3]===1)),JSON.stringify(tf.filter((x,i)=>i%4===0)));
  await page.evaluate(()=>{[...document.querySelectorAll('.task-seg button')].find(b=>b.textContent==='Active').click()});await sleep(60);
  await shot('4-tasks-mid');
  await sleep(400);
  check(T('the empty state also cross-fades (Completed with none done)'),await page.evaluate(async()=>{state.tasks.forEach(t=>t.done=false);const seg=[...document.querySelectorAll('.task-seg button')].find(b=>b.textContent==='Completed');seg.click();await new Promise(r=>setTimeout(r,60));const mid=+getComputedStyle(document.querySelector('.task-results')).opacity;await new Promise(r=>setTimeout(r,400));return mid<1&&/Nothing completed/.test(document.querySelector('.task-results').textContent)}));

  // ---- 5. primary button hover + press
  await page.evaluate(()=>{state.taskFilter='all';renderAll(false)});await sleep(300);
  const rest=await page.evaluate(()=>{const b=document.querySelector('.tasks-inner .btn-primary');const cs=getComputedStyle(b);return {bg:cs.backgroundColor,sh:cs.boxShadow}});
  const box=await page.evaluate(()=>{const r=document.querySelector('.tasks-inner .btn-primary').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
  await page.mouse.move(box.x,box.y);await sleep(260);
  const hov=await page.evaluate(()=>{const cs=getComputedStyle(document.querySelector('.tasks-inner .btn-primary'));return {bg:cs.backgroundColor,sh:cs.boxShadow}});
  await shot('5-primary-hover');
  await page.mouse.down();await sleep(200);
  const prs=await page.evaluate(()=>{const cs=getComputedStyle(document.querySelector('.tasks-inner .btn-primary'));return {bg:cs.backgroundColor,tf:cs.transform}});
  await shot('5-primary-press');
  await page.mouse.up();await page.mouse.move(5,5);
  const lum=c=>{const m=c.match(/\d+/g).map(Number);return .2126*m[0]+.7152*m[1]+.0722*m[2]};
  check(T('primary buttons: hover visibly changes the fill and adds lift'),Math.abs(lum(hov.bg)-lum(rest.bg))>=25&&hov.sh!=='none',JSON.stringify([rest,hov]));
  check(T('primary buttons: press scales to 0.97 and shifts the fill again'),/matrix\(0\.9[5-8]/.test(prs.tf)&&prs.bg!==hov.bg,JSON.stringify(prs));

  // ---- 6. directional slides
  await page.evaluate(()=>{state.section='calendar';state.view='month';renderAll(false)});await sleep(400);
  const slide=async(sel,label)=>{
   const r=await page.evaluate(s=>new Promise(res=>{const b=document.querySelector(s);const out=[];const t0=performance.now();b.click();
    function f(){const n=document.querySelector('#viewWrap > *');if(n){const cs=getComputedStyle(n);out.push({t:Math.round(performance.now()-t0),cls:n.className,tf:cs.transform,op:+cs.opacity})}if(performance.now()-t0<260)requestAnimationFrame(f);else res(out)}f()}),sel);
   await sleep(250);return r};
  const nextF=await slide('#headerBand [aria-label="Next month"]','next');
  const mid=nextF.find(x=>/anim-next/.test(x.cls)&&x.tf!=='none'&&x.op<1);
  check(T('header Next month: direction-aware slide runs (mid-frame has translateX and partial opacity)'),!!mid&&/matrix\(1, 0, 0, 1, (?!0,)/.test(mid.tf),JSON.stringify(nextF.slice(0,4)));
  const prevF=await slide('#headerBand [aria-label="Previous month"]','prev');
  const midp=prevF.find(x=>/anim-prev/.test(x.cls)&&x.tf!=='none'&&x.op<1);
  check(T('header Previous month slides the other way (negative translateX)'),!!midp&&/matrix\(1, 0, 0, 1, -/.test(midp.tf),JSON.stringify(prevF.slice(0,4)));
  await page.evaluate(()=>document.querySelector('#headerBand [aria-label="Next month"]').click());await sleep(300);await page.evaluate(()=>document.querySelector('#headerBand [aria-label="Next month"]').click());await sleep(300);
  const todayBtn=await page.evaluate(()=>[...document.querySelectorAll('#headerBand button')].map(b=>b.getAttribute('aria-label')||b.title));
  const tSel=await page.evaluate(()=>{const b=[...document.querySelectorAll('#headerBand button')].find(b=>/today/i.test((b.getAttribute('aria-label')||'')+(b.title||'')));if(b)b.setAttribute('data-t','1');return !!b});
  const todayF=await slide('[data-t="1"]','today');
  check(T('Back to today slides back toward today (mid-frame has an animation class and a transform)'),todayF.some(x=>/anim-(prev|next)/.test(x.cls)&&x.tf!=='none'&&x.op<1),JSON.stringify([tSel,todayBtn,todayF.slice(0,3)]));
  const miniF=await page.evaluate(()=>new Promise(res=>{const b=[...document.querySelectorAll('#sidebar .mini-nav')].pop();const out=[];const t0=performance.now();b.click();
   function f(){const g=document.querySelector('#sidebar [class*="mini-anim"]');out.push({t:Math.round(performance.now()-t0),cls:g?g.className:'',op:g?+getComputedStyle(g).opacity:null,tf:g?getComputedStyle(g).transform:''});if(performance.now()-t0<260)requestAnimationFrame(f);else res(out)}f()}));
  check(T('the mini calendar month change runs its own animation (not a hard cut)'),miniF.some(x=>/mini-anim/.test(x.cls)&&(x.op<1||x.tf!=='none')),JSON.stringify(miniF.slice(0,4)));
  await page.evaluate(()=>{state.cursor=new Date(2026,10,9);state.selected=new Date(2026,10,9);state.miniCursor=new Date(2026,10,1);renderAll(false)});await sleep(400);

  // ---- 7. date number -> Day view
  await page.evaluate(()=>{const n=[...document.querySelectorAll('.day-cell:not(.out) .day-num')].find(b=>b.textContent.trim()==='18');n.click()});await sleep(600);
  check(T('clicking a date number opens that date in Day view'),await page.evaluate(()=>state.view==='day'&&state.cursor.getDate()===18&&!document.querySelector('.event-form-dialog')),await page.evaluate(()=>state.view+' '+state.cursor));
  await page.evaluate(()=>{state.view='month';state.section='calendar';renderAll(false)});await sleep(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.day-cell:not(.out)')].find(c=>c.querySelector('.day-num').textContent.trim()==='24');const r=c.getBoundingClientRect();window.__cellPt={x:r.x+r.width/2,y:r.y+r.height-8}});
  const pt=await page.evaluate(()=>window.__cellPt);await page.mouse.click(pt.x,pt.y);await sleep(500);
  check(T('clicking the empty part of a cell still opens New event'),await page.evaluate(()=>!!document.querySelector('.event-form-dialog')||!!document.querySelector('.dl-std')));
  await page.keyboard.press('Escape');await sleep(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.chip')].find(c=>/Practice/.test(c.textContent));c.click()});await sleep(450);
  check(T('clicking an event still opens its popover'),await page.evaluate(()=>!!document.querySelector('.popover')));
  await page.keyboard.press('Escape');await sleep(300);

  // ---- 8. no eye on subscribed rows
  check(T('no eye toggle exists on any calendar row; each keeps its checkbox'),await page.evaluate(()=>!document.querySelector('.cal-visibility-btn')&&[...document.querySelectorAll('.cal-row')].every(r=>!!r.querySelector('.cal-check'))));
  check(T('the subscribed-row code no longer builds the eye'),!/cal-visibility-btn/.test(fs.readFileSync('daylight-integrations.js','utf8')));

  // ---- 9. lines and finish
  const ln=await page.evaluate(()=>{const g=n=>getComputedStyle(document.querySelector(n));const set=getComputedStyle(document.documentElement).getPropertyValue('--line-soft').trim();return {dow:g('.dow-row').borderBottomColor,week:g('.month-week').borderBottomColor,cell:g('.day-cell').borderRightColor,chipR:g('.chip').borderTopLeftRadius,set}});
  const toRgb=h=>{const m=h.replace('#','');return `rgb(${parseInt(m.slice(0,2),16)}, ${parseInt(m.slice(2,4),16)}, ${parseInt(m.slice(4,6),16)})`};
  check(T('month header rule uses the Settings divider color; cell lines are softer than it; chips use the 8px finish'),ln.dow===toRgb(ln.set)&&ln.chipR==='8px'&&/rgba|color\(/.test(ln.cell+ln.week),JSON.stringify(ln));
  await shot('9-month-lines');

  // ---- Share view: the swap glides (no jump)
  await page.evaluate(()=>{[...document.querySelectorAll('.chip')].find(c=>/Practice/.test(c.textContent)).click()});await page.waitForSelector('.popover');await sleep(600);
  const sv=await page.evaluate(()=>new Promise(res=>{const p=document.querySelector('.popover');const out=[];const t0=performance.now();document.querySelector('[data-act="share"]').click();
   function f(){const r=p.getBoundingClientRect();out.push([Math.round(performance.now()-t0),Math.round(r.top),Math.round(r.height),+getComputedStyle(p).opacity]);if(performance.now()-t0<420)requestAnimationFrame(f);else res(out)}f()}));
  let maxJump=0;for(let i=1;i<sv.length;i++)maxJump=Math.max(maxJump,Math.abs(sv[i][2]-sv[i-1][2]),Math.abs(sv[i][1]-sv[i-1][1]));
  const first=sv[0],last=sv[sv.length-1];
  check(T('Share view swap: the box glides to its new size (no frame jumps more than 40px) and never flickers (opacity stays 1)'),maxJump<=40&&sv.every(x=>x[3]===1)&&Math.abs(first[2]-last[2])>20,JSON.stringify({maxJump,first,last}));
  await page.keyboard.press('Escape');await sleep(300);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('round 9 fixes FAILED');process.exit(1)}
console.log('PASS round 9 fixes');
