import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('daylight-places.js','utf8');
function harness(mode='success') {
  const dom=new JSDOM('<!doctype html><body><div class="field"><label>Location</label><input id="loc"></div></body>',{
    url:'https://joeynatale28-source.github.io/daylight/',runScripts:'outside-only'
  });
  const w=dom.window;
  w.HTMLElement.prototype.scrollIntoView=function(){};
  const requests=[];
  w.daylightCloud={ready:true,client:{functions:{invoke:async(name,args)=>{
    requests.push({name,...args.body});
    if(mode==='network-error')return {error:new Error('HERE unavailable')};
    if(mode==='not-configured')return {data:{error:'not_configured'}};
    return {data:{suggestions:[
      {primary:'10833 W Broad St',secondary:'Glen Allen, VA, 23060',
       address:'10833 W Broad St, Glen Allen, VA 23060, United States',lat:37.646,lng:-77.598},
      {primary:'SwimRVA',secondary:'Richmond, VA, 23230',
       address:'SwimRVA, Richmond, VA 23230, United States',lat:37.585,lng:-77.49}
    ],attribution:'© HERE'}};
  }}}};
  w.eval(source);
  const input=w.document.querySelector('#loc');
  const draft={loc:'',placeId:null,locationLat:null,locationLng:null};
  let changes=0;
  w.daylightAttachPlaces(input,draft,()=>changes++);
  return {w,input,draft,requests,get changes(){return changes},dispose:()=>dom.window.close()};
}
const wait=(time=300)=>new Promise(resolve=>setTimeout(resolve,time));
function type(h,value){
  h.input.value=value;
  h.input.dispatchEvent(new h.w.Event('input',{bubbles:true}));
}
function key(h,name){
  h.input.dispatchEvent(new h.w.KeyboardEvent('keydown',{bubbles:true,key:name,cancelable:true}));
}
test('HERE suggestions preserve the places function contract and keyboard selection',async()=>{
  const h=harness();
  try{
    type(h,'10833 W Broad');await wait();
    assert.equal(h.requests.length,1);
    assert.equal(h.requests[0].name,'places');
    assert.equal(h.requests[0].action,'autocomplete');
    assert.equal(h.requests[0].language,'en');
    assert.equal(h.w.document.querySelectorAll('[role=option]').length,2);
    assert.match(h.w.document.querySelector('.dl-place-credit').textContent,/HERE/);
    assert.ok(h.w.document.querySelector('.dl-place-pin svg, svg.dl-place-pin'));
    key(h,'ArrowDown');key(h,'Enter');
    assert.equal(h.input.value,'10833 W Broad St, Glen Allen, VA 23060, United States');
    assert.equal(h.draft.loc,h.input.value);
    assert.equal(h.draft.placeId,null);
    assert.equal(h.draft.locationLat,37.646);
    assert.equal(h.draft.locationLng,-77.598);
    assert.equal(h.input.getAttribute('aria-expanded'),'false');
  }finally{h.dispose();}
});
test('mouse selection commits the full HERE label; free-text editing clears coordinates',async()=>{
  const h=harness();
  try{
    type(h,'10833 W Broad');await wait();
    h.w.document.querySelector('[role=option]').click();
    assert.match(h.input.value,/VA 23060/);
    assert.equal(h.draft.loc,h.input.value);
    assert.equal(h.draft.locationLat,37.646);
    type(h,'Somewhere near the pool');
    assert.equal(h.draft.loc,'Somewhere near the pool');
    assert.equal(h.draft.placeId,null);
    assert.equal(h.draft.locationLat,null);
    assert.equal(h.draft.locationLng,null);
  }finally{h.dispose();}
});
test('pointer hover and keyboard selection share one active row',async()=>{
  const h=harness();
  try{
    type(h,'SwimRVA');await wait();
    const options=h.w.document.querySelectorAll('[role=option]');
    options[1].dispatchEvent(new h.w.Event('pointerenter',{bubbles:true}));
    assert.equal(options[1].getAttribute('aria-selected'),'true');
    key(h,'ArrowDown');key(h,'Enter');
    assert.equal(h.input.value,'10833 W Broad St, Glen Allen, VA 23060, United States');
  }finally{h.dispose();}
});
test('missing HERE secret displays the quiet setup message without breaking the form',async()=>{
  const h=harness('not-configured');
  try{
    type(h,'Hungary Creek Middle School');await wait();
    assert.equal(h.draft.loc,'Hungary Creek Middle School');
    assert.equal(h.w.document.querySelector('.dl-place-state').textContent,"Address search isn't set up yet");
    assert.equal(h.input.getAttribute('aria-expanded'),'true');
  }finally{h.dispose();}
});
test('temporary suggestion failures preserve free-text locations',async()=>{
  const h=harness('network-error');
  try{
    type(h,'swim practice pool');await wait();
    assert.equal(h.draft.loc,'swim practice pool');
    assert.equal(h.draft.placeId,null);
    assert.equal(h.w.document.querySelector('.dl-place-state').textContent,'Address search is temporarily unavailable');
  }finally{h.dispose();}
});
test('the browser client contains no provider endpoint or API credential',()=>{
  assert.equal(source.includes('HERE_API_KEY'),false);
  assert.equal(source.includes('search.hereapi.com'),false);
  assert.equal(source.includes('apiKey'),false);
  assert.equal(source.includes('https://'),false);
});
