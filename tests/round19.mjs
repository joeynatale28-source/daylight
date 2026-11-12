/**
 * Round 19, both themes (stubbed Supabase):
 *  66 no attachments in form / popover · 77 English-only Settings ·
 *  78 Day view "..." menu · 79 popover buttons readable on banner art · 82 no banner picker in the event form
 * (the "extras" fixes 68-72, 74, 76, 80 were cancelled: this test also checks that none of them is present)
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round19');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:1000});const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 const go=(view,y,m,d)=>page.evaluate((v,y,m,d)=>{state.section='calendar';state.view=v;state.cursor=new Date(y,m,d);state.selected=new Date(y,m,d);state.prevView=null;renderAll(false)},view,y,m,d);
 try{
  await app.load();await sleep(900);
  await go('month',2026,10,15);await sleep(500);
  check(T('no header view switcher'),await page.evaluate(()=>!document.querySelector('.dl-viewsw')));
  await go('day',2026,10,11);await sleep(600);
  check(T('Day view header has the "..." menu'),await page.evaluate(()=>!!document.querySelector('.head-right [aria-label="More"]')));
  await page.evaluate(()=>document.querySelector('.head-right [aria-label="More"]').click());await sleep(300);
  check(T('Day "..." menu holds Print month'),await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')].map(b=>b.textContent.trim()).join()==='Print month'));
  await shot('78-day-more-menu');
  await page.keyboard.press('Escape');await sleep(300);
  await go('month',2026,10,15);await sleep(400);
  const SPANISH=/\b(solo|afecta|este|dispositivo|vista|recordatorio|cuando|abres|predeterminad[oa]|nuevos|eventos)\b/i;
  for(const sec of ['profile','appearance','calendar','notifications','ai','shortcuts']){
   await page.evaluate(s=>openSettings(s),sec);await sleep(700);
   const txt=await page.evaluate(()=>document.querySelector('.settings-pane').innerText);
   check(T('Settings > '+sec+' has no Spanish strings'),!SPANISH.test(txt),(txt.match(SPANISH)||[])[0]);
   await page.evaluate(()=>document.querySelector('.settings-close').click());await sleep(450);
  }
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,17)));await page.waitForSelector('#efTitle');await sleep(300);
  const form=await page.evaluate(()=>{const d=document.querySelector('.dialog').textContent;return {file:!!document.querySelector('input[type=file]'),att:/ttachment/.test(d),banner:/Banner/.test(d),guests:/Guests/.test(d)}});
  check(T('Create form: no attachments, no banner control, no guests'),!form.file&&!form.att&&!form.banner&&!form.guests,J(form));
  await shot('82-create-form');
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>{const bd=document.querySelector('.backdrop');if(bd)bd.remove()});
  await page.evaluate(()=>{const cal=state.calendars.find(c=>!c.subscribed&&!c.builtin).id;state.events.push({id:777001,title:'Pickup Jeep - Florida',cal,start:new Date(2026,10,18,9),end:new Date(2026,10,18,10),allDay:false,loc:'',desc:'',repeat:null});renderAll(false)});await sleep(400);
  await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(x=>x.textContent.includes('Pickup Jeep')).click());await page.waitForSelector('.popover');await sleep(700);
  const pb=await page.evaluate(()=>{const b=document.querySelector('.pop-banner-btn');return b?{bg:getComputedStyle(b).backgroundColor,n:document.querySelectorAll('.pop-banner-btn').length,img:!!document.querySelector('.pop-banner img'),att:/ttachment/.test(document.querySelector('.popover').textContent)}:null});
  check(T('banner art still shows in the popover, buttons are solid chips, no Attachments section'),pb&&pb.img&&pb.n>=3&&!/rgba\(\d+, \d+, \d+, 0\.\d+\)/.test(pb.bg)&&!pb.att,J(pb));
  await shot('79-popover-buttons');
  await page.evaluate(()=>document.querySelector('.popover [data-act="edit"]').click());await page.waitForSelector('#efTitle');await sleep(500);
  check(T('Edit form has no banner control either'),await page.evaluate(()=>!/Banner/.test(document.querySelector('.dialog').textContent)));
  await shot('82-edit-form');
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('round19 FAILED');process.exit(1)}
console.log('PASS round19');
