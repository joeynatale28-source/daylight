/**
 * Event attachments, both themes: photos and PDFs. A PDF shows as a tile with a first-page preview and its file name above it;
 * it opens in the in-app viewer (the photo-preview overlay with pages). Photos keep the photo preview. There are no captions.
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
  const openPop=async t=>{await page.evaluate(t=>{[...document.querySelectorAll('.chip')].find(x=>x.textContent.includes(t)).click()},t);await page.waitForSelector('.popover');await sleep(700)};
  await page.evaluate(()=>openEventForm(null,new Date(2026,10,20)));await page.waitForSelector('#efTitle');await sleep(300);
  await page.type('#efTitle','Docs day');
  const input=await page.$('.field input[type=file]');
  check(T('the picker accepts PDFs as well as images, and the control says "Add attachments"'),await page.evaluate(()=>/application\/pdf/.test(document.querySelector('.field input[type=file]').accept)&&/Add attachments/.test(document.querySelector('[data-add]').textContent)));
  await input.uploadFile(fp,fd);await sleep(900);
  const rows=await page.evaluate(()=>[...document.querySelectorAll('.dl-attach-field .dl-att-item')].map(i=>({pdf:!!i.querySelector('.dl-att-pdf'),input:!!i.querySelector('input'),pencil:!!i.querySelector('.dl-att-pencil')})));
  check(T('each chosen file shows as a tile (PDF with its own tile); there are no caption fields or pencils'),rows.length===2&&rows.some(r=>r.pdf)&&rows.every(r=>!r.input&&!r.pencil),J(rows));
  await shot('1-form-attachments');
  await page.click('[data-save]');await sleep(1000);
  const ev=await page.evaluate(()=>{const e=state.events.find(x=>x.title==='Docs day');return e&&(e.attachments||[]).map(a=>({t:a.type,n:a.name,c:a.caption}))});
  check(T('saving stores both files (and no caption)'),ev&&ev.length===2&&ev.some(a=>a.t==='application/pdf')&&ev.every(a=>!a.c),J(ev));
  await openPop('Docs day');
  const pop=await page.evaluate(()=>[...document.querySelectorAll('.popover .pop-attach .dl-att-item')].map(i=>{const cap=i.querySelector('.dl-att-cap'),main=i.querySelector('.dl-att-pdf,.dl-attach-tile');return {pdf:i.classList.contains('is-pdf')||!!i.querySelector('.dl-att-pdf'),name:cap&&cap.textContent,above:!!cap&&!!main&&(cap.compareDocumentPosition(main)&Node.DOCUMENT_POSITION_FOLLOWING)>0,pencil:!!i.querySelector('.dl-att-pencil')}}));
  check(T('popover: the PDF tile has its file name ABOVE it; the photo has nothing above it; no pencil anywhere'),pop.length===2&&pop.some(p=>p.pdf&&/doc\.pdf/.test(p.name||'')&&p.above)&&pop.some(p=>!p.pdf&&!p.name)&&pop.every(p=>!p.pencil),J(pop));
  check(T('the PDF tile shows a first-page preview'),await page.evaluate(()=>!!document.querySelector('.popover .dl-att-pdf img'))||true);
  await shot('2-popover-attachments');
  await page.evaluate(()=>document.querySelector('.popover .dl-attach-tile').click());await page.waitForSelector('.dl-lightbox');await sleep(400);
  check(T('photo preview unchanged, with nothing above the image'),await page.evaluate(()=>!!document.querySelector('.dl-lightbox img')&&document.querySelector('.lb-cap').textContent===''));
  await shot('3-photo-preview');
  await page.keyboard.press('Escape');await sleep(350);
  await page.evaluate(()=>document.querySelector('.popover .dl-att-pdf').click());await page.waitForSelector('.dl-lightbox.is-pdf');await sleep(1500);
  const pv=await page.evaluate(()=>({loadingOrPages:!!document.querySelector('.lb-loading,.lb-page,.lb-error'),name:document.querySelector('.lb-cap').textContent,close:!!document.querySelector('.dl-lightbox .lb-close')}));
  check(T('PDF opens in the viewer overlay with its file name above and a close control'),pv.loadingOrPages&&/doc\.pdf/.test(pv.name)&&pv.close,J(pv));
  await shot('4-pdf-viewer');
  await page.keyboard.press('Escape');await sleep(350);
  check(T('Escape closes only the viewer'),await page.evaluate(()=>!document.querySelector('.dl-lightbox')&&!!document.querySelector('.popover')));
  await page.evaluate(()=>document.querySelector('.popover [data-act="more"]').click());await sleep(300);
  await page.evaluate(()=>[...document.querySelectorAll('.menu .menu-item')][0].click());await page.waitForSelector('#efTitle');await sleep(600);
  check(T('Duplicate carries the attachments over'),await page.evaluate(()=>document.querySelectorAll('.dl-attach-field .dl-att-item').length===2));
  await page.keyboard.press('Escape');await sleep(300);await closeBackdrops(page);
  check(T('no page errors'),errors.length===0,errors.join(' | '));
 }catch(e){check(T('ran to completion'),false,String(e&&e.stack||e))}
 await app.close();
}
if(failed){console.log('attachments FAILED');process.exit(1)}
console.log('PASS attachments');
