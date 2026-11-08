/**
 * Reduce motion must switch cleanly in BOTH directions: nothing already on screen may start or restart an
 * animation at the moment of the switch, and normal 160-260ms animations must be back for the next interaction.
 * Runs against the real page (HARNESS_ROOT selects the build to test).
 */
import assert from 'node:assert/strict';
import {launch} from './harness.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// The Save pill's own entrance (settingsPillIn) is legitimate: the pill appears BECAUSE the toggle just changed a setting.
const running=()=>document.getAnimations().filter(a=>a.animationName&&a.animationName!=='settingsPillIn'&&a.playState==='running'&&a.effect&&a.effect.getComputedTiming().duration>1&&a.effect.getComputedTiming().iterations<Infinity)
  .map(a=>(a.animationName||'')+'@'+(a.effect.target&&(a.effect.target.className||a.effect.target.id||a.effect.target.tagName)).toString().slice(0,40));
let failed=false;
for(const theme of (process.env.THEMES||'dark,light').split(',')){
 const app=await launch({theme,width:1440,height:900});
 const {page}=app;
 try{
  await app.load();
  await page.evaluate(()=>openSettings('appearance'));
  await page.waitForSelector('#apReduceMotion');
  await sleep(700); // let the dialog's own entrance finish
  const toggle=async(label)=>{
   await page.evaluate(()=>{const i=document.querySelector('#apReduceMotion');i.checked=!i.checked;i.dispatchEvent(new Event('change',{bubbles:true}))});
   const at0=await page.evaluate(running);          // same task: what is animating at the switch?
   await sleep(60);
   const at60=await page.evaluate(running);
   // a change that re-renders the calendar behind Settings (this is what used to replay the backdrop later)
   await page.evaluate(()=>{const i=document.querySelector('#apDensity');if(i)i.click()});
   await page.keyboard.press('Escape');await sleep(30);
   return {label,at0,at60};
  };
  const report=[];
  // OFF -> ON -> OFF as one session
  const on=await toggle('ON');
  await sleep(300);
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(n=>n.remove());settingsState.transactionActive=false});
  await page.evaluate(()=>openSettings('appearance'));await page.waitForSelector('#apReduceMotion');await sleep(400);
  const off=await page.evaluate(()=>{const i=document.querySelector('#apReduceMotion');return i.checked});
  assert.equal(off,true,'setting stayed ON');
  await page.evaluate(()=>{const i=document.querySelector('#apReduceMotion');i.checked=false;i.dispatchEvent(new Event('change',{bubbles:true}))});
  const offAt0=await page.evaluate(running);
  await sleep(80);
  const offAt80=await page.evaluate(running);
  // a re-render while Settings stays open (the second place the old glitch showed up)
  await page.evaluate(()=>{renderAll(false)});
  await sleep(40);
  const afterRender=await page.evaluate(running);
  const clean={onAtSwitch:on.at0,offAtSwitch:offAt0,off80ms:offAt80,renderWhileOpen:afterRender};
  console.log(theme,JSON.stringify(clean));
  const bad=[...on.at0,...offAt0,...offAt80,...afterRender];
  if(bad.length){failed=true;console.log('FAIL '+theme+': animations started/restarted at the switch: '+JSON.stringify(bad))}
  // animations are really back for the next interaction
  await page.evaluate(()=>{document.querySelectorAll('.backdrop').forEach(n=>n.remove());settingsState.transactionActive=false});
  await page.evaluate(()=>openConfirm({title:'Check',body:'x',confirmLabel:'OK',fn(){}}));
  const next=await page.evaluate(()=>{const names=document.getAnimations().filter(a=>a.playState==='running').map(a=>a.effect.getComputedTiming().duration);return names});
  if(!next.some(d=>d>=150&&d<=300)){failed=true;console.log('FAIL '+theme+': normal 160-260ms animations did not return: '+JSON.stringify(next))}
  else console.log('PASS '+theme+' animations restored for the next interaction ('+next.join(', ')+' ms)');
  const persisted=await page.evaluate(()=>({flag:state.reduceMotion,cls:document.body.classList.contains('reduce-motion'),cls2:document.body.classList.contains('dl-reduce-motion')}));
  if(persisted.flag||persisted.cls||persisted.cls2){failed=true;console.log('FAIL '+theme+' state after OFF: '+JSON.stringify(persisted))}
 }finally{await app.close()}
}
console.log(failed?'FAILED':'PASSED');
process.exit(failed?1:0);
