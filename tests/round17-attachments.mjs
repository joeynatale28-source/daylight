/**
 * Round 17 (Fix 50 A+B): PDFs and captions on event attachments, both themes.
 * Attach a captioned photo and a captioned PDF; the popover shows the captions ABOVE a photo tile and a PDF card;
 * the photo opens in the preview (caption above), the PDF in the in-app viewer; uncaptioned items add no empty space;
 * captions survive Duplicate; an attachment added from outside the app (as the MCP does) renders with its caption.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launch} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','round17');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const J=x=>JSON.stringify(x);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const pdfBytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const fp=path.join(os.tmpdir(),'dl-r17-photo.png'),fd=path.join(os.tmpdir(),'dl-r17-doc.pdf');
fs.writeFileSync(fp,png);fs.writeFileSync(fd,pdfBytes);
const closeBackdrops=page=>page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(b=>b.parentNode&&b.parentNode.removeChild(b))});
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:1000});const {page}=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(out,`${n}-${theme}.png`)});
 try{
  await app.load();await sleep(800);
  await page.evaluate(()=>{state.view='month';state.section='calendar';state.cursor=new Date(2026,10,15);renderAll(false)});await sleep(400);
  const openPop=async t=>{await page.evaluate(t=>{[...document.querySelectorAll('.chip')].find(x=>x.textContent.includes(t)).click()},t);await page.waitForSelector('.popover');await sleep(500)};
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,20)));await page.waitForSelector('#efTitle');await sleep(300);
  await page.type('#efTitle','Docs day');
  const input=await page.$('.field input[type=file]');
  check(T('the picker accepts PDFs as well as images, and the control says "Add attachments"'),await page.evaluate(()=>/application\/pdf/.test(document.querySelector('.field input[type=file]').accept)&&/Add attachments/.test(document.querySelector('[data-add]').textContent)));
  await input.uploadFile(fp,fd);await sleep(600);
  const rows=await page.evaluate(()=>[...document.querySelectorAll('.dl-attach-field .dl-att-item')].map(i=>({pdf:i.classList.contains('is-pdf'),cap:!!i.querySelector('.dl-att-capin'),ph:i.querySelector('.dl-att-capin')&&i.querySelector('.dl-att-capin').placeholder})));
  check(T('each chosen file gets an optional "Caption (optional)" field; the PDF shows as a card'),rows.length===2&&rows.every(r=>r.cap&&r.ph==='Caption (optional)')&&rows.some(r=>r.pdf),J(rows));
  const ins=await page.$$('.dl-attach-field .dl-att-capin');
  await ins[0].type('Front of the building');await ins[1].type('Signed permission slip');await sleep(200);
  await shot('1-form-captions');
  await page.click('[data-save]');await sleep(1000);
  const ev=await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Docs day');return e&&(e.attachments||[]).map(a=>({t:a.type,c:a.caption,n:a.name}))});
  check(T('saving stores both files with their captions (additive field)'),ev&&ev.length===2&&ev.some(a=>a.t==='application/pdf'&&a.c==='Signed permission slip')&&ev.some(a=>/^image/.test(a.t)&&a.c==='Front of the building'),J(ev));
  await openPop('Docs day');
  const pop=await page.evaluate(()=>[...document.querySelectorAll('.popover .pop-attach .dl-att-item')].map(i=>{const cap=i.querySelector('.dl-att-cap'),main=i.querySelector('.dl-att-pdf,.dl-attach-tile');return {pdf:i.classList.contains('is-pdf'),cap:cap&&cap.textContent,capAbove:!!cap&&!!main&&(cap.compareDocumentPosition(main)&Node.DOCUMENT_POSITION_FOLLOWING)>0,name:i.querySelector('.pdf-name')&&i.querySelector('.pdf-name').textContent}}));
  check(T('popover: the PDF is a card (icon, name) and each caption is ABOVE its photo / PDF card'),pop.length===2&&pop.every(p=>p.cap&&p.capAbove)&&pop.some(p=>p.pdf&&/doc\.pdf/.test(p.name||'')),J(pop));
  await shot('2-popover-attachments');
  await page.evaluate(()=>document.querySelector('.popover .dl-attach-tile').click());await page.waitForSelector('.dl-lightbox');await sleep(400);
  const lb=await page.evaluate(()=>({cap:document.querySelector('.lb-cap').textContent,img:!!document.querySelector('.dl-lightbox img'),order:(document.querySelector('.lb-cap').compareDocumentPosition(document.querySelector('.dl-lightbox img'))&Node.DOCUMENT_POSITION_FOLLOWING)>0}));
  check(T('photo preview unchanged, with the caption above the image'),lb.img&&lb.cap==='Front of the building'&&lb.order,J(lb));
  await shot('3-photo-preview');
  await page.keyboard.press('Escape');await sleep(350);
  await page.evaluate(()=>document.querySelector('.popover .dl-att-pdf').click());await page.waitForSelector('.dl-lightbox.is-pdf');await sleep(900);
  const pv=await page.evaluate(()=>({frame:!!document.querySelector('.dl-lightbox iframe.lb-pdf'),src:(document.querySelector('iframe.lb-pdf')||{}).src||'',cap:document.querySelector('.lb-cap').textContent,tab:!!document.querySelector('[data-newtab]'),dl:!!document.querySelector('[data-download]'),close:!!document.querySelector('.dl-lightbox .lb-close')}));
  check(T('PDF opens in the in-app viewer overlay with a caption, close, and open-in-new-tab / download fallbacks'),pv.frame&&/^blob:/.test(pv.src)&&pv.cap==='Signed permission slip'&&pv.tab&&pv.dl&&pv.close,J(pv));
  await shot('4-pdf-viewer');
  await page.keyboard.press('Escape');await sleep(350);
  check(T('Escape closes only the viewer'),await page.evaluate(()=>!document.querySelector('.dl-lightbox')&&!!document.querySelector('.popover')));
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Docs day');e.attachments.forEach(a=>{delete a.caption});renderAll(false)});await sleep(300);
  await openPop('Docs day');
  check(T('no caption, no empty space: uncaptioned attachments add no caption element'),await page.evaluate(()=>document.querySelectorAll('.popover .dl-att-cap').length===0));
  await page.keyboard.press('Escape');await sleep(300);
  await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Docs day');e.attachments.push({path:'u/1/mcp-added.png',name:'mcp-added.png',type:'image/png',size:70,caption:'Added by Claude through the MCP'});renderAll(false)});await sleep(300);
  await openPop('Docs day');
  check(T('an AI-added (MCP) attachment is indistinguishable: it renders with its caption'),await page.evaluate(()=>[...document.querySelectorAll('.popover .dl-att-cap')].some(c=>c.textContent==='Added by Claude through the MCP')));
  await shot('5-mcp-added-in-popover');
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"]').click());await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')][0].click());await page.waitForSelector('#efTitle');await sleep(500);
  const dup=await page.evaluate(()=>[...document.querySelectorAll('.dl-attach-field .dl-att-capin')].map(i=>i.value));
  check(T('Duplicate carries the captions'),dup.includes('Added by Claude through the MCP'),J(dup));
  await page.keyboard.press('Escape');await sleep(300);await closeBackdrops(page);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('round 17 attachments FAILED');process.exit(1)}
console.log('PASS round 17 attachments');
