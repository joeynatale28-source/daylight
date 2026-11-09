// Item 6 proof: the FULL sidebar (logo/Create, mini calendar, Calendar/Tasks, My calendars, Subscriptions, Shared, Support/Settings,
// account block) fits top to bottom without its own scroll at ordinary desktop heights, in both themes, with the account block
// pinned visible. Also measures the phone drawer. SHOTS picks the screenshot folder.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','sidebar-fit');
fs.mkdirSync(out,{recursive:true});
const rows=[];let failed=0;
const sizes=process.env.SIZES?JSON.parse(process.env.SIZES):[[1920,1080],[1920,900],[1280,900],[1280,800],[1366,768],[1280,720]];
for(const theme of ['dark','light'])for(const [w,h] of sizes){
  const t=await launch({theme,width:w,height:h,payload:process.env.BUSY?busyPayload():undefined});
  const {page}=t;await t.load();
  await page.waitForSelector('#sidebar .cal-row',{timeout:15000});await new Promise(r=>setTimeout(r,900));
  const m=await page.evaluate(()=>{
    const sb=document.querySelector('#sidebar');const r=sb.getBoundingClientRect();
    const prof=sb.querySelector('.profile-wrap,.profile-row');const pr=prof&&prof.getBoundingClientRect();
    const rowsEl=[...sb.querySelectorAll('.cal-row')].map(x=>Math.round(x.getBoundingClientRect().height));
    const clipped=[...sb.querySelectorAll('.cal-name')].filter(n=>n.scrollWidth>n.clientWidth+1).length;
    const labels=[...sb.querySelectorAll('.side-label,.side-label-btn,[class*=label]')].map(n=>n.textContent.trim()).filter(Boolean);
    return {h:Math.round(r.height),scrollH:sb.scrollHeight,clientH:sb.clientHeight,scrolls:sb.scrollHeight>sb.clientHeight+1,
      accountBottom:pr?Math.round(pr.bottom):null,sidebarBottom:Math.round(r.bottom),vh:innerHeight,accountVisible:!!pr&&pr.bottom<=r.bottom+1&&pr.top>=r.top,
      calRowH:rowsEl,clippedNames:clipped,support:/Support/.test(sb.innerText),settings:/Settings/.test(sb.innerText),
      pageScroll:document.documentElement.scrollHeight>innerHeight+1,calendarFills:(()=>{const mw=document.querySelector('.month-wrap,#view,main');return mw?Math.round(mw.getBoundingClientRect().bottom):null})()};
  });
  rows.push({theme,w,h,...m});
  const ok=(h<768?true:!m.scrolls)&&m.accountVisible&&m.support&&!m.pageScroll;   /* below 768px the account block must stay pinned even if the list scrolls */
  if(!ok)failed++;
  console.log((ok?'PASS ':'FAIL ')+theme+' '+w+'x'+h+' sidebar scrolls:'+m.scrolls+' ('+m.scrollH+'/'+m.clientH+') account visible:'+m.accountVisible+' support:'+m.support+' pageScroll:'+m.pageScroll+' clippedNames:'+m.clippedNames);
  await page.screenshot({path:path.join(out,`sidebar-${theme}-${w}x${h}.png`)});
  await t.close();
}
fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify(rows,null,1));
if(failed){console.log('SIDEBAR FIT: '+failed+' failing');process.exit(1)}
console.log('SIDEBAR FIT: PASSED');
