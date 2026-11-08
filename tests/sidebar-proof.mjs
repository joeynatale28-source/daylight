// B0 proof: sidebar geometry + Support/copyright state at four widths, both themes. HARNESS_ROOT picks the build.
import fs from 'node:fs';import path from 'node:path';
import {launch,busyPayload} from './harness.mjs';
const out=process.env.SHOTS||path.join(process.cwd(),'ui-screenshots','sidebar-'+(process.env.TAG||'after'));
fs.mkdirSync(out,{recursive:true});
const rows=[];
for(const theme of ['dark','light'])for(const [w,h] of [[1920,1080],[1512,945],[1366,768],[1280,720]]){
  const t=await launch({theme,width:w,height:h,payload:busyPayload()});
  const {page}=t;await t.load();
  await page.waitForSelector('#sidebar .cal-row',{timeout:15000});await new Promise(r=>setTimeout(r,900));
  const m=await page.evaluate(()=>{
    const sb=document.querySelector('#sidebar');const r=sb.getBoundingClientRect();
    const labels=[...document.querySelectorAll('#sidebar [class*=label]')].map(n=>n.textContent.trim()).filter(Boolean);
    const body=document.body.innerText;
    return {x:r.x,y:r.y,w:r.width,h:r.height,support:/Support/.test(sb.innerText),copyright:/All rights reserved|Version\s*1\.0|© 2026/.test(body)};
  });
  rows.push({theme,w,h,...m});
  await page.screenshot({path:path.join(out,`sidebar-${theme}-${w}.png`)});
  await t.close();
}
fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify(rows,null,1));
console.log(JSON.stringify(rows));
