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
  // ---- Item 1: chooser
  await page.click('button[aria-label="Add to Subscriptions"]');
  await page.waitForSelector('.dl-std .dl-opt');
  await sleep(350);
  const chooser=await page.evaluate(()=>({title:document.querySelector('.dl-std .dialog-title').textContent,
   rows:[...document.querySelectorAll('.dl-opt')].map(r=>({t:r.querySelector('.dl-opt-title').textContent,s:r.querySelector('.dl-opt-sub').textContent,h:r.offsetHeight,icon:!!r.querySelector('.dl-opt-ic svg')})),
   x:(()=>{const b=document.querySelector('.dl-std .dl-x');return [b.offsetWidth,b.offsetHeight]})(),radius:getComputedStyle(document.querySelector('.dl-std')).borderRadius,width:document.querySelector('.dl-std').offsetWidth}));
  await page.screenshot({path:path.join(out,'stage1-chooser-'+theme+'.png')});
  assert.equal(chooser.title,'Add to Subscriptions');
  assert.deepEqual(chooser.rows.map(r=>[r.t,r.s]),[['CalDAV server','iCloud, Nextcloud, Fastmail and other CalDAV servers · syncs both ways'],['iCal link','Subscribe to a calendar by URL'],['ICS file','Upload an .ics file from your device']]);
  assert.ok(chooser.rows.every(r=>r.h>=56&&r.icon),'option rows are >=56px with a drawn icon: '+JSON.stringify(chooser.rows));
  assert.ok(chooser.x[0]>=36&&chooser.x[1]>=36,'close target >=36px');
  assert.equal(chooser.radius,'12px');
  assert.ok(chooser.width>=440&&chooser.width<=480,'dialog width '+chooser.width);
  await page.click('.dl-std .dl-x');
  await page.waitForFunction(()=>!document.querySelector('.dl-std'),{timeout:2000});
  // My calendars + is unchanged: it opens the new-calendar form directly
  await page.click('button[aria-label="New calendar"]');
  await page.waitForSelector('.dialog .dialog-title');
  assert.equal(await page.$eval('.dialog .dialog-title',n=>n.textContent),'New calendar');
  await page.click('.dialog [data-x]');
  await page.waitForFunction(()=>!document.querySelector('.dialog'),{timeout:2000});

  // ---- Item 2: CalDAV form
  await page.click('button[aria-label="Add to Subscriptions"]');
  await page.click('[data-opt="caldav"]');
  await page.waitForSelector('#dlCdServer');
  await sleep(350);
  const form=await page.evaluate(()=>({title:document.querySelector('.dl-std .dialog-title').textContent,
   labels:[...document.querySelectorAll('.dl-std .field label')].map(l=>l.textContent),helpers:[...document.querySelectorAll('.dl-std .dl-helper')].map(h=>h.textContent),
   connectDisabled:document.querySelector('[data-connect]').disabled,fieldH:document.querySelector('#dlCdServer').offsetHeight,back:!!document.querySelector('.dl-back')}));
  await page.screenshot({path:path.join(out,'stage1-caldav-'+theme+'.png')});
  assert.equal(form.title,'Connect a CalDAV server');
  assert.deepEqual(form.labels,['Server address','Username','Password']);
  assert.deepEqual(form.helpers,['The server’s address — or a link to one of its calendars. Discovery finds the rest.','For iCloud, use an app-specific password.']);
  assert.ok(form.connectDisabled&&form.fieldH>=52&&form.back);
  await page.type('#dlCdServer','not a url');await page.type('#dlCdUser','joey');await page.type('#dlCdPass','s3cret-pass');
  assert.equal(await page.$eval('[data-connect]',b=>b.disabled),true,'invalid address keeps Connect disabled');
  await page.$eval('#dlCdServer',i=>{i.value='';});
  await page.type('#dlCdServer','caldav.icloud.com');
  assert.equal(await page.$eval('[data-connect]',b=>b.disabled),false,'valid form enables Connect');
  await page.click('[data-eye]');assert.equal(await page.$eval('#dlCdPass',i=>i.type),'text');await page.click('[data-eye]');
  // hold the response so the loading state can be inspected
  await page.evaluate(()=>{const c=window.daylightCloud.client;const orig=c.functions.invoke;c.functions.invoke=async function(n,o){if(n==='caldav')await new Promise(r=>setTimeout(r,600));return orig.call(c.functions,n,o)}});
  await page.click('[data-connect]');
  await sleep(150);
  const loading=await page.evaluate(()=>({text:document.querySelector('[data-connect]').textContent,spinner:!!document.querySelector('[data-connect] .dl-btn-spin'),disabled:[...document.querySelectorAll('.dl-std input')].every(i=>i.disabled)}));
  await page.screenshot({path:path.join(out,'stage1-caldav-loading-'+theme+'.png')});
  assert.deepEqual(loading,{text:'Connecting…',spinner:true,disabled:true},'loading state');
  await page.waitForFunction(()=>!document.querySelector('.dl-banner').hidden,{timeout:4000});
  const failed=await page.evaluate(()=>({banner:document.querySelector('.dl-banner').textContent,inputsEnabled:[...document.querySelectorAll('.dl-std input')].every(i=>!i.disabled),connect:document.querySelector('[data-connect]').textContent,
   calls:(window.__calls||[]).filter(c=>c.name==='caldav'&&c.body.action==='test'),stored:JSON.stringify({l:{...localStorage},s:{...sessionStorage}}).includes('s3cret-pass')}));
  await page.screenshot({path:path.join(out,'stage1-caldav-error-'+theme+'.png')});
  assert.equal(failed.banner,'Couldn’t connect to that server. Check the address and your username and password, then try again.');
  assert.ok(failed.inputsEnabled&&failed.connect==='Connect','form re-enabled after the error');
  assert.deepEqual(failed.calls.map(c=>c.body),[{action:'test',server_url:'https://caldav.icloud.com/',username:'joey',password:'s3cret-pass'}],'request contract');
  assert.equal(failed.stored,false,'credentials are never stored');
  await page.click('.dl-back');
  await page.waitForSelector('.dl-opt');

  // ---- Item 3: iCal link (existing ical-subscribe machinery)
  await page.click('[data-opt="ical"]');
  await page.waitForSelector('#dlSubUrl');
  await sleep(350);
  await page.screenshot({path:path.join(out,'stage1-ical-'+theme+'.png')});
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

  // ---- Item 6: account block opens Settings on Profile; the popup is gone
  await page.click('.profile-row');
  await page.waitForSelector('.settings-dialog');
  assert.equal(await page.$eval('.settings-rail .sr-item.active',n=>n.textContent.trim()),'Profile');
  assert.equal(await page.$('.menu'),null,'no account popup');
  await page.evaluate(()=>document.querySelector('.settings-dialog>.settings-close').click());
  await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
  const dots=await page.$eval('.profile-row .icon-btn',n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
  await page.mouse.click(dots.x,dots.y);
  await page.waitForSelector('.settings-dialog');
  assert.equal(await page.$eval('.settings-rail .sr-item.active',n=>n.textContent.trim()),'Profile','the ⋯ opens Profile settings');
  assert.equal(await page.$('.menu'),null);
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
