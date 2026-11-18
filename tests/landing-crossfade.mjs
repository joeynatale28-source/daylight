/** Landing animations: paired states never show superimposed (old fully gone before new appears); Tasks card sized to its content. */
import puppeteer from 'puppeteer-core';
import {serve} from './harness.mjs';
let bad=0;const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,300)))};
const srv=await serve(0,'/daylight/');
const b=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox']});
try{
 const p=await b.newPage();await p.setViewport({width:1440,height:900});
 await p.goto(srv.url,{waitUntil:'networkidle0'});await new Promise(r=>setTimeout(r,800));
 const pairs=[['s3pe','s3pv'],['s3a','s3b'],['s5c0','s5c1'],['s5c1','s5c2'],['s5c0','s5c2'],['s5ra','s5rb'],['s5today','s5fd'],['s4p1','s4p2'],['s4p2','s4p3'],['s4p1','s4p3'],['s3ta','s3cha'],['s3cha','s3ph']];
 const res=await p.evaluate(pairs=>{
  document.querySelectorAll('.rv').forEach(e=>e.classList.add('in','now'));
  const out={};
  const els={};
  document.querySelectorAll('*').forEach(e=>{const n=getComputedStyle(e).animationName;if(n&&n!=='none')n.split(',').forEach(x=>{x=x.trim();(els[x]=els[x]||[]).push(e)})});
  const anims=document.getAnimations();anims.forEach(a=>a.pause());
  const dur={s3:10000,s4:10000,s5:11000};
  for(const [a,b] of pairs){
   const ea=els[a]||[],eb=els[b]||[];
   if(!ea.length||!eb.length){out[a+'/'+b]='missing';continue}
   let worst=0,at=0;const D=a.startsWith('s5')?11000:10000;
   for(let t=0;t<D;t+=40){
    anims.forEach(an=>{try{an.currentTime=t}catch(e){}});
    // all anims were started at different times; align each element-animation on the same clock
    const oa=Math.min(...ea.map(e=>+getComputedStyle(e).opacity)),ob=Math.min(...eb.map(e=>+getComputedStyle(e).opacity));
    const m=Math.min(+getComputedStyle(ea[0]).opacity,+getComputedStyle(eb[0]).opacity);
    if(m>worst){worst=m;at=t}
   }
   out[a+'/'+b]=+worst.toFixed(2)+'@'+at;
  }
  return out;
 },pairs);
 for(const [k,v] of Object.entries(res))check(v!=='missing'&&parseFloat(v)<=0.06,'no superimposed states: '+k,v);
 // tasks card height follows content
 const h=await p.evaluate(()=>{const mk=document.querySelector('.mk.sc5'),fp=mk.parentElement.getBoundingClientRect();const r=mk.getBoundingClientRect();return {card:Math.round(r.height),panel:Math.round(fp.height),bottom:Math.round(fp.bottom-r.bottom)}});
 check(h.card<h.panel-60,'the Tasks card is sized to its content (not stretched to the panel)',h);
 // the floating pill never covers a heading or FAQ row at a scroll stop (every 170px down the page)
 await p.evaluate(()=>{document.querySelectorAll('.rv').forEach(e=>e.classList.add('in','now'))});
 const H=await p.evaluate(()=>document.documentElement.scrollHeight);
 const covered=[];
 for(let y=200;y<H-900;y+=170){
  await p.evaluate(y=>scrollTo(0,y),y);await new Promise(r=>setTimeout(r,1250));
  const c=await p.evaluate(()=>{const bar=document.querySelector('.nav .bar').getBoundingClientRect();return [...document.querySelectorAll('main h1,main h2,main h3,.fx-text h2,.qa-q,.cta2 h2')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.bottom>bar.top+10&&r.top<bar.bottom-2&&r.right>bar.left&&r.left<bar.right}).map(e=>e.textContent.trim().slice(0,24))});
  if(c.length)covered.push([y,c[0]]);
 }
 check(covered.length===0,'no heading or FAQ row rests under the pill at any scroll stop',covered.slice(0,5));
}finally{await b.close();srv.server.close()}
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
