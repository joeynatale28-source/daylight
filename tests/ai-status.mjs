/**
 * Item 8d (presentation only): on Settings -> AI access, an app that is NOT connected right now but has activity in "Recent AI
 * activity" says so plainly (the history stays after a disconnect), and the note goes away when the app is connected.
 * The connected/not-connected decision itself is unchanged (it is made by the OAuth code, which this does not touch).
 * Activity rows are injected into the page the way the real list renders them. LIVE_URL runs it on the deployed page.
 */
import fs from 'node:fs';
import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','ai-status');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
for(const theme of ['dark','light']){
 const T=s=>`${theme}: ${s}`;
 const app=await launch({theme,width:1440,height:900,payload:busyPayload(),baseUrl:process.env.LIVE_URL||undefined});
 const {page}=app;
 try{
  await app.load();await sleep(500);
  await page.evaluate(()=>openSettings('ai'));await page.waitForSelector('.dl-ai-app-cards');await sleep(700);
  const base=await page.evaluate(()=>({connect:!!document.querySelector('#dl-chatgpt-connect'),connected:!!document.querySelector('.dl-connected-label'),note:!!document.querySelector('.dl-ai-note:not([hidden])')}));
  check(T('with no activity and no connection there is no extra note'),base.connect&&!base.connected&&!base.note,JSON.stringify(base));
  await page.evaluate(()=>{const g=[...document.querySelectorAll('.dl-ai-wrap .set-group')].pop();const r=document.createElement('div');r.className='dl-ai-audit-row';r.innerHTML='<span class="dl-ai-action">ChatGPT · Created an event</span><span class="dl-ai-status">Nov 5</span>';g.appendChild(r)});
  await sleep(700);
  const stale=await page.evaluate(()=>{const n=document.querySelector('.dl-ai-app-cards .dl-ai-note:not([hidden])');return {text:n&&n.textContent,connect:!!document.querySelector('#dl-chatgpt-connect'),inChatCard:!!(n&&n.closest('.dl-ai-app-card')&&/ChatGPT/.test(n.closest('.dl-ai-app-card').textContent))}});
  check(T('Connect + old ChatGPT activity: the card says it is not connected right now and the activity is from before'),/Not connected right now/.test(stale.text||'')&&/ChatGPT activity/.test(stale.text||'')&&stale.connect&&stale.inChatCard,JSON.stringify(stale));
  await page.screenshot({path:path.join(out,`not-connected-with-history-${theme}.png`)});
  await page.evaluate(()=>{const s=document.querySelector('#dl-chatgpt-status');s.innerHTML='<span class="dl-connected-label" aria-label="Connected">✓ Connected</span>'});
  await sleep(700);
  check(T('once connected, the note is gone'),await page.evaluate(()=>!document.querySelector('.dl-ai-app-cards .dl-ai-note:not([hidden])')));
  await page.screenshot({path:path.join(out,`connected-${theme}.png`)});
 }finally{await app.close()}
}
if(failed){console.log('ai status FAILED');process.exit(1)}
console.log('PASS ai status');
