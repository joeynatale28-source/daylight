/** Stage 1 checks on the real page: Subscriptions chooser + forms, account block, event calendar field. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// American spelling in everything the app ships (comments excluded; daylight-banners.js matches user-typed titles on purpose).
{
 const british=/colour|behaviour|centre|favourite|organis(e|er|ation)|recognis|licence|customis|personalis|analyse|grey/i;
 const offenders=[];
 const files=['index.html','daylight-settings.js','daylight-integrations.js','daylight-enhancements.js','daylight-cloud.js','daylight-oauth.js','daylight-places.js','404.html'];
 for(const file of files){
  const text=fs.readFileSync(path.join(process.env.HARNESS_ROOT||process.cwd(),file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  text.split(String.fromCharCode(10)).filter(l=>!/^\s*\/\//.test(l)).forEach(line=>{if(british.test(line)&&!/--gray|gray-/.test(line))offenders.push(file+': '+line.trim().slice(0,100))});
 }
 assert.deepEqual(offenders,[],'British spellings remain in shipped code');
}
for(const theme of (process.env.THEMES||'dark,light').split(',')){
 const app=await launch({theme,width:1440,height:900,baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await app.load();
  // ---- Sidebar: Support section is back (with Settings); no copyright / version text anywhere
  const side=await page.evaluate(()=>{const sb=document.getElementById('sidebar');
   return {labels:[...sb.querySelectorAll('.side-label')].map(n=>n.textContent.trim()),settingsRow:!!sb.querySelector('.side-row[title="Settings"]'),legal:!!sb.querySelector('.dl-sidebar-legal')}});
  assert.deepEqual(side.labels,['My calendars','Subscriptions','Support'],'sidebar sections: '+JSON.stringify(side));
  assert.ok(side.settingsRow&&!side.legal,'Support section with its Settings entry is back; the copyright block is gone');
  await page.click('#sidebar .side-row[title="Settings"]');
  await page.waitForSelector('.settings-dialog');
  assert.equal(await page.$eval('.settings-rail .sr-item.active',n=>n.textContent.trim()),'Profile','Support → Settings opens Settings (on Profile) as before');
  const NO_LEGAL=/All rights reserved|Version\s*1\.0|v1\.0|© 2026/i;
  for(const section of ['profile','appearance','calendar','notifications','ai','shortcuts']){
   await page.evaluate(sec=>{const b=[...document.querySelectorAll('.settings-rail .sr-item')];b.find(x=>x.textContent.trim().toLowerCase().replace(' access','').startsWith(sec==='ai'?'ai':sec)).click()},section);
   await sleep(250);
   assert.ok(!NO_LEGAL.test(await page.evaluate(()=>document.body.innerText)),'no copyright/version text in Settings → '+section);
  }
  await page.evaluate(()=>document.querySelector('.settings-dialog>.settings-close').click());
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
  assert.ok(!NO_LEGAL.test(await page.evaluate(()=>document.body.innerText)),'no copyright/version text in the app shell');
  await page.click('.profile-row');await page.waitForSelector('.dl-account-menu');await page.click('.dl-account-menu [data-menu-id="settings"]');await page.waitForSelector('.settings-dialog');
  assert.equal(await page.$eval('.settings-rail .sr-item.active',n=>n.textContent.trim()),'Profile','Settings from the account menu opens on Profile');
  await page.evaluate(()=>document.querySelector('.settings-dialog>.settings-close').click());
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
  // ---- Item 2: Profile pane (mockup)
  await page.evaluate(()=>openSettings('profile'));
  await page.waitForSelector('.dl-session-signout');
  await sleep(500);
  const prof=await page.evaluate(()=>({rail:[...document.querySelectorAll('.settings-rail .sr-item')].map(b=>b.textContent.trim()),active:document.querySelector('.settings-rail .sr-item.active').textContent.trim(),
   avatar:!!document.querySelector('.dl-profile-avatar'),name:document.querySelector('#profileFullName').value,lock:!!document.querySelector('.dl-idf-lock svg'),emailText:document.querySelector('.dl-idf-lock [data-email]').textContent,emailEditable:!!document.querySelector('.dl-idf-lock input'),
   sec:{tile:!!document.querySelector('.dl-sec-tile svg'),button:document.querySelector('.dl-sec-row [data-reset-password]').textContent},
   badge:document.querySelector('.dl-session-badge')?.textContent,others:!document.querySelector('[data-signout-others]').hidden}));
  assert.deepEqual(prof.rail,['Profile','Appearance','Calendar','Notifications','AI access','Shortcuts']);
  assert.equal(prof.active,'Profile');
  assert.ok(prof.avatar&&prof.lock&&!prof.emailEditable&&prof.emailText==='demo@example.com'&&prof.name==='Calendar Demo','identity card: '+JSON.stringify(prof));
  assert.deepEqual([prof.sec.tile,prof.sec.button,prof.badge,prof.others],[true,'Change password','This device',true],'security + sessions: '+JSON.stringify(prof));
  await page.click('[data-signout-others]');
  await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');
  await page.click('#overlayRoot > .backdrop:last-child [data-ok]');
  await page.waitForFunction(()=>document.querySelectorAll('.dl-session-row').length===1&&document.querySelector('[data-signout-others]').hidden,{timeout:3000});
  await page.evaluate(()=>{window.__revoked=false;document.querySelector('.settings-dialog>.settings-close').click()});
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
  // ---- Item 1: chooser
  await page.click('button[aria-label="Add to Subscriptions"]');
  await page.waitForSelector('.dl-std .dl-opt');
  await sleep(350);
  const chooser=await page.evaluate(()=>({title:document.querySelector('.dl-std .dialog-title').textContent,
   rows:[...document.querySelectorAll('.dl-opt')].map(r=>({t:r.querySelector('.dl-opt-title').textContent,s:r.querySelector('.dl-opt-sub').textContent,h:r.offsetHeight,icon:!!r.querySelector('.dl-opt-ic svg')})),
   x:(()=>{const b=document.querySelector('.dl-std .dl-x');return [b.offsetWidth,b.offsetHeight]})(),radius:getComputedStyle(document.querySelector('.dl-std')).borderRadius,width:document.querySelector('.dl-std').offsetWidth}));
  await page.screenshot({path:path.join(out,'stage1-chooser-'+theme+'.png')});
  assert.equal(chooser.title,'Add to Subscriptions');
  assert.deepEqual(chooser.rows.map(r=>[r.t,r.s]),[['iCal link','Subscribe to a calendar by URL'],['ICS file','Upload an .ics file from your device']]);
  assert.ok(chooser.rows.every(r=>r.h>=56&&r.icon),'option rows are >=56px with a drawn icon: '+JSON.stringify(chooser.rows));
  assert.ok(chooser.x[0]>=36&&chooser.x[1]>=36,'close target >=36px');
  const rowStyle=await page.evaluate(()=>{const r=document.querySelector('.dl-opt'),rows=[...document.querySelectorAll('.dl-opt')],cs=getComputedStyle(r),tile=r.querySelector('.dl-opt-ic');
   return {pad:cs.paddingLeft,radius:cs.borderRadius,border:cs.borderTopWidth,tile:[tile.offsetWidth,tile.offsetHeight],svgs:r.querySelectorAll('svg').length,
    gap:Math.round(rows[1].getBoundingClientRect().top-rows[0].getBoundingClientRect().bottom),title:getComputedStyle(r.querySelector('.dl-opt-title')).fontSize,dialogPad:getComputedStyle(document.querySelector('.dl-std .dialog-body')).paddingLeft}});
  assert.deepEqual([rowStyle.pad,rowStyle.radius,rowStyle.border,rowStyle.tile.join('x'),rowStyle.svgs,rowStyle.title,rowStyle.dialogPad],['14px','14px','1px','40x40',1,'15px','24px'],'chooser rows: '+JSON.stringify(rowStyle));
  assert.ok(rowStyle.gap>=10&&rowStyle.gap<=12,'rows are separated by a 10-12px gap, not hairlines: '+rowStyle.gap);
  assert.equal(chooser.radius,'16px');
  assert.equal(chooser.width,480,'chooser shares the calendar popup shell: 480px wide');
  await page.click('.dl-std .dl-x');
  await page.waitForFunction(()=>!document.querySelector('.dl-std'),{timeout:2000});
  // My calendars + is unchanged: it opens the new-calendar form directly
  await page.click('button[aria-label="New calendar"]');
  await page.waitForSelector('.dialog .dialog-title');
  assert.equal(await page.$eval('.dialog .dialog-title',n=>n.textContent),'New calendar');
  await page.click('.dialog [data-x]');
  await page.waitForFunction(()=>!document.querySelector('.dialog'),{timeout:2000});

  await page.click('button[aria-label="Add to Subscriptions"]');
  await page.waitForSelector('.dl-opt');

  // ---- Item 3: iCal link (existing ical-subscribe machinery)
  await page.click('[data-opt="ical"]');
  await page.waitForSelector('#dlSubUrl');
  await sleep(350);
  await page.screenshot({path:path.join(out,'stage1-ical-'+theme+'.png')});
  assert.deepEqual(await page.evaluate(()=>{const d=document.querySelector('.dl-std');return [d.offsetWidth,getComputedStyle(d).borderRadius,getComputedStyle(document.querySelector('#dlSubUrl')).borderRadius,document.querySelector('[data-sub]').offsetHeight]}),[480,'16px','10px',36],'iCal form uses the same shell');
  assert.equal(await page.$eval('[data-sub]',b=>b.disabled),true);
  await page.type('#dlSubUrl','webcal://example.com/TEST-feed.ics');await page.type('#dlSubName','TEST feed');
  await page.evaluate(()=>{window.__calls=[]});
  await page.click('[data-sub]');
  await page.waitForFunction(()=>!document.querySelector('.dl-std'),{timeout:4000});
  const sub=await page.evaluate(()=>window.__calls.filter(c=>c.name==='ical-subscribe').map(c=>c.body));
  assert.deepEqual(sub.slice(0,2),[{action:'preview',url:'https://example.com/TEST-feed.ics'},{action:'add',url:'https://example.com/TEST-feed.ics',name:'TEST feed',color:'teal'}],'iCal link uses ical-subscribe preview + add');

  // ---- Item 4: ICS file (existing ical-import machinery)
  const ics=path.join(os.tmpdir(),'stage1-test.ics');
  fs.writeFileSync(ics,'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TEST//EN\r\nBEGIN:VEVENT\r\nUID:test-1@example.com\r\nDTSTART:20261215T150000Z\r\nDTEND:20261215T160000Z\r\nSUMMARY:TEST import\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
  await page.click('button[aria-label="Add to Subscriptions"]');
  await page.click('[data-opt="ics"]');
  await page.waitForSelector('[data-drop]');
  await sleep(350);
  await page.screenshot({path:path.join(out,'stage1-ics-'+theme+'.png')});
  assert.deepEqual(await page.evaluate(()=>{const d=document.querySelector('.dl-std');return [d.offsetWidth,getComputedStyle(d).borderRadius,document.querySelector('[data-import]').offsetHeight]}),[480,'16px',36],'ICS form uses the same shell');
  assert.equal(await page.$eval('[data-import]',b=>b.disabled),true);
  assert.match(await page.$eval('[data-drop]',n=>n.textContent),/Drop an \.ics file here, or browse/);
  await (await page.$('[data-picker]')).uploadFile(ics);
  await page.waitForFunction(()=>!document.querySelector('[data-import]').disabled,{timeout:2000});
  await page.evaluate(()=>{window.__calls=[]});
  await page.click('[data-import]');
  await page.waitForSelector('.dl-done',{timeout:4000});
  await page.screenshot({path:path.join(out,'stage1-ics-done-'+theme+'.png')});
  const imp=await page.evaluate(()=>({title:document.querySelector('.dl-done-title').textContent,calls:window.__calls.filter(c=>c.name==='ical-import').map(c=>({action:c.body.action,calendar:c.body.calendar_id,hasEvent:/SUMMARY:TEST import/.test(c.body.ics)})),done:!!document.querySelector('[data-done]')}));
  assert.equal(imp.title,'Imported 4 events');
  assert.equal(imp.calls.length,1);assert.ok(imp.calls[0].action==='import'&&imp.calls[0].hasEvent&&imp.calls[0].calendar);assert.ok(imp.done);
  fs.unlinkSync(ics);
  await page.reload();await app.ready();

  // ---- Item 6 (now superseded by the account menu): the account block, and its ⋯, open a menu with exactly Settings + Log out
  await page.click('.profile-row');
  await page.waitForSelector('.dl-account-menu');
  assert.deepEqual(await page.$$eval('.dl-account-menu [role=menuitem]',n=>n.map(x=>x.textContent.trim())),['Settings','Log out'],'account menu rows');
  assert.equal(await page.$('.settings-dialog'),null,'the account block no longer jumps straight into Settings');
  await page.keyboard.press('Escape');await sleep(300);
  assert.equal(await page.$('.dl-account-menu'),null,'Escape closes the account menu');
  const dots=await page.$eval('.profile-row .icon-btn',n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
  await page.mouse.click(dots.x,dots.y);
  await page.waitForSelector('.dl-account-menu');
  assert.equal(await page.$('.settings-dialog'),null,'the ⋯ opens the menu, not Settings');
  await page.click('.dl-account-menu [data-menu-id="settings"]');
  await page.waitForSelector('.settings-dialog');
  assert.equal(await page.$eval('.settings-rail .sr-item.active',n=>n.textContent.trim()),'Profile','Settings opens on Profile');
  await page.evaluate(()=>document.querySelector('.settings-dialog>.settings-close').click());
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});

  // ---- Item 7: sessions: tiny badge, red leave icon; signing out through the icon updates the list
  await page.evaluate(()=>openSettings('profile'));
  await page.waitForSelector('.dl-session-signout');
  await sleep(500);
  await page.evaluate(()=>document.querySelector('.dl-session-list').scrollIntoView({block:'center'}));
  await sleep(300);
  const box=await page.$eval('.dl-session-list',n=>{const r=n.getBoundingClientRect();return {x:Math.max(0,r.left-30),y:Math.max(0,r.top-60),width:r.width+60,height:r.height+90}});
  await page.screenshot({path:path.join(out,'stage1-sessions-'+theme+'.png'),clip:box});
  await page.click('.dl-session-signout');
  await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]');
  await page.click('#overlayRoot > .backdrop:last-child [data-ok]');
  await page.waitForFunction(()=>document.querySelectorAll('.dl-session-row').length===1&&!document.querySelector('.dl-session-signout'),{timeout:3000});
  await page.evaluate(()=>{window.__revoked=false;document.querySelector('.settings-dialog>.settings-close').click()});
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
  // ---- Item 9: the event dialog's calendar field stays one line
  const LONG='USA Swimming — Following (Richmond Area Masters and Age Group Championship Meets)';
  await page.evaluate(long=>{
   state.calendars.push({id:'long1',name:long,color:'violet',hidden:false});
   for(let i=0;i<14;i++)state.calendars.push({id:'x'+i,name:'Calendar number '+(i+1)+' with a fairly long descriptive name',color:'teal',hidden:false});
   renderAll(false);
  },LONG);
  const dialogMetrics=()=>page.evaluate(()=>{const b=document.querySelector('#efCal'),n=document.querySelector('.dl-cal-field-name'),d=b.closest('.dialog');
   return {fieldH:b.offsetHeight,dialogH:d.offsetHeight,name:n&&n.textContent,truncated:!!n&&n.scrollWidth>n.clientWidth,oneLine:!!n&&getComputedStyle(n).whiteSpace==='nowrap'}});
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,10)));
  await page.waitForSelector('#efCal');await sleep(350);
  const fits=await page.evaluate(()=>{const b=document.querySelector('.event-form-dialog .dialog-body');return {scroll:b.scrollHeight,client:b.clientHeight}});
  assert.ok(fits.scroll<=fits.client+1,'the whole event dialog (including the Calendar field) is visible at 900px high without scrolling: '+JSON.stringify(fits));
  const shortCase=await dialogMetrics();
  await page.click('#efCal');await page.waitForSelector('.menu');
  await page.evaluate(()=>{[...document.querySelectorAll('.menu .menu-item')].find(b=>b.textContent.includes('USA Swimming')).click()});
  await sleep(250);
  const longCase=await dialogMetrics();
  await page.screenshot({path:path.join(out,'stage1-event-create-longname-'+theme+'.png')});
  assert.ok(longCase.fieldH<=48,'calendar field is one row: '+JSON.stringify(longCase));
  assert.ok(longCase.truncated&&longCase.oneLine&&longCase.name===LONG,'long name truncates with an ellipsis on one line: '+JSON.stringify(longCase));
  assert.ok(Math.abs(longCase.dialogH-shortCase.dialogH)<=2,'dialog does not grow: '+JSON.stringify([shortCase,longCase]));
  await page.click('#efCal');
  await page.waitForSelector('.menu');
  const menu=await page.evaluate(()=>{const m=document.querySelector('.menu');const items=[...m.querySelectorAll('.menu-item')];const sel=items.find(i=>i.textContent.includes('USA Swimming'));
   return {max:parseFloat(getComputedStyle(m).maxHeight),scrolls:m.scrollHeight>m.clientHeight,rowH:items[0].offsetHeight,labelEllipsis:getComputedStyle(items[0].querySelector('.mi-label')).textOverflow,
    check:!!sel.querySelector('.mi-right svg'),checkAtRight:sel.lastElementChild.classList.contains('mi-right'),dialogH:document.querySelector('#efCal').closest('.dialog').offsetHeight}});
  await sleep(400);
  await page.screenshot({path:path.join(out,'stage1-event-picker-open-'+theme+'.png')});
  assert.ok(menu.max<=280&&menu.scrolls&&menu.rowH>=36&&menu.rowH<=44&&menu.labelEllipsis==='ellipsis'&&menu.check,'picker popover: '+JSON.stringify(menu));
  assert.ok(menu.checkAtRight,'selected row carries its check at the right');
  assert.ok(Math.abs(menu.dialogH-longCase.dialogH)<=2,'opening the picker does not resize the dialog');
 }finally{await app.close()}
}
console.log('stage1 checks passed');
