/** Menus stay inside their dialog, match their trigger, Escape closes the menu first; Settings scroll ends at the last card;
 *  unsaved changes are resolved only by the bar (no second popup); Danger Zone delete flow polish. Real app via the harness. */
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x)))};
const app=await launch({width:+process.env.W||1440,height:+process.env.H||900,theme:process.env.THEME||'light'});const page=app.page;
const SH=process.env.SHOTS;
try{
 await app.load();await sleep(400);
 // ---- Settings: Date format menu flips up and stays in the dialog; width = trigger; Escape order
 await page.evaluate(()=>openSettings('calendar'));await sleep(800);
 const id=await page.evaluate(()=>{const b=[...document.querySelectorAll('#dl-sec-calendar .dd')].find(x=>/Nov 3|3 Nov|11\/3|\d{4}-/.test(x.textContent));if(b)b.scrollIntoView({block:'end'});return b&&b.id});await sleep(300);
 check(!!id,'found the Date format trigger',id);
 await page.click('#'+id);await sleep(300);
 const m=await page.evaluate(id=>{const mm=document.querySelector('.dd-menu').getBoundingClientRect(),d=document.querySelector('.settings-dialog').getBoundingClientRect(),t=document.getElementById(id).getBoundingClientRect();return {inside:mm.top>=d.top&&mm.bottom<=d.bottom,up:mm.bottom<=t.top+1,w:Math.round(mm.width),tw:Math.round(t.width)}},id);
 check(m.inside,'the menu stays inside the Settings dialog',m);
 check(Math.abs(m.w-m.tw)<=2,'the menu is as wide as its trigger',m);
 if(SH)await page.screenshot({path:SH+'/menu-settings.png'});
 await page.keyboard.press('Escape');await sleep(300);
 check(await page.evaluate(()=>!document.querySelector('.dd-menu')&&!!document.querySelector('.settings-dialog')),'first Escape closes only the menu');
 // ---- Settings scroll end
 await page.evaluate(()=>{const p=document.querySelector('.settings-pane');p.scrollTop=p.scrollHeight});await sleep(400);
 const e=await page.evaluate(()=>{const p=document.querySelector('.settings-pane').getBoundingClientRect(),c=document.querySelector('#dl-sec-danger .dl-danger').getBoundingClientRect();return {below:Math.round(p.bottom-c.bottom),top:Math.round(c.top-p.top)}});
 check(e.below>=8&&e.below<=60,'at the bottom the Danger Zone card ends the content (normal padding only)',e);
 if(SH)await page.screenshot({path:SH+'/settings-bottom.png'});
 // ---- section jump lands with the heading fully visible
 await page.evaluate(()=>[...document.querySelectorAll('.sr-item')].find(b=>/Calendar/.test(b.textContent)).click());await sleep(1100);
 const h=await page.evaluate(()=>{const p=document.querySelector('.settings-pane').getBoundingClientRect(),h=document.querySelector('#dl-sec-calendar h2').getBoundingClientRect();return {gap:Math.round(h.top-p.top),vis:h.top>=p.top+8}});
 check(h.vis&&h.gap>=16,'jumping to Calendar leaves the heading fully visible',h);
 // ---- unsaved changes: the bar is the only gate
 await page.evaluate(()=>{const t=document.querySelector('#dl-sec-calendar .switch input[type=checkbox]');t.click()});await sleep(500);
 check(await page.evaluate(()=>!document.querySelector('.settings-savebar').hidden),'changing a setting shows the bar');
 await page.click('.settings-close');await sleep(500);
 check(await page.evaluate(()=>!document.querySelector('.dl-leave')&&!!document.querySelector('.settings-dialog')),'X with unsaved changes: no second popup, Settings stays open');
 await page.keyboard.press('Escape');await sleep(400);
 check(await page.evaluate(()=>!document.querySelector('.dl-leave')&&!!document.querySelector('.settings-dialog')),'Escape with unsaved changes: no popup, stays open');
 if(SH)await page.screenshot({path:SH+'/settings-bar.png'});
 await page.click('[data-discard]');await sleep(700);
 check(await page.evaluate(()=>document.querySelector('.settings-savebar').hidden||document.querySelector('.settings-savebar').classList.contains('is-dismissing')||!document.querySelector('.settings-dialog')),'Discard on the bar resolves the changes');
 await page.evaluate(()=>{const c=document.querySelector('.settings-close');if(c)c.click()});await sleep(600);
 check(await page.evaluate(()=>!document.querySelector('.settings-dialog')&&!document.querySelector('.dl-leave')),'after Discard, X closes Settings with no popup');
 await page.evaluate(()=>openSettings('calendar'));await sleep(700);
 await page.evaluate(()=>{document.querySelector('#dl-sec-calendar .switch input[type=checkbox]').click()});await sleep(400);
 await page.click('[data-save]');await sleep(1500);
 await page.evaluate(()=>{if(document.querySelector('.settings-dialog'))document.querySelector('.settings-close').click()});await sleep(500);
 check(await page.evaluate(()=>!document.querySelector('.settings-dialog')&&!document.querySelector('.dl-leave')),'Save on the bar works; closing with nothing unsaved shows no popup');
 // ---- event editor menus
 await page.evaluate(()=>openEventForm(null,new Date(2026,11,9)));await sleep(700);
 await page.click('#efRepeat');await sleep(300);
 const r=await page.evaluate(()=>{const mm=document.querySelector('.menu').getBoundingClientRect(),t=document.getElementById('efRepeat').getBoundingClientRect(),d=document.querySelector('.dialog').getBoundingClientRect();return {w:Math.round(mm.width),tw:Math.round(t.width),inside:mm.bottom<=d.bottom+1&&mm.top>=d.top}});
 check(Math.abs(r.w-r.tw)<=2&&r.inside,'the Repeats menu is as wide as its field and inside the dialog',r);
 await page.keyboard.press('Escape');await sleep(250);
 await page.click('#efSTime');await sleep(300);
 const st=await page.evaluate(()=>{const m=document.querySelector('.dd-menu'),f=m.querySelector('.dd-search input').getBoundingClientRect(),o=m.querySelector('.menu-item .dd-label').getBoundingClientRect(),d=document.querySelector('.dialog').getBoundingClientRect(),mr=m.getBoundingClientRect(),lab=[...document.querySelectorAll('.dialog label')].filter(l=>{const lr=l.getBoundingClientRect();return lr.top<mr.bottom&&lr.bottom>mr.bottom&&lr.top>mr.top}).length;return {align:Math.round(o.left-f.left),inside:mr.bottom<=d.bottom,cut:lab}});
 check(Math.abs(st.align)<=6&&st.inside&&st.cut===0,'Start time: option text lines up with the Filter text; the menu does not cut a label',st);
 if(SH)await page.screenshot({path:SH+'/menu-start.png'});
 await page.keyboard.press('Escape');await sleep(250);
 check(await page.evaluate(()=>!!document.querySelector('.dialog')),'Escape closes the menu before the editor');
 await page.keyboard.press('Escape');await sleep(400);
 check(app.errors.length===0,'no page errors',app.errors);
}finally{await app.close()}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
