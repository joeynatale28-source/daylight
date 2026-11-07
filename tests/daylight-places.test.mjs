import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('daylight-places.js','utf8');
function harness() {
  const dom=new JSDOM('<!doctype html><body><div class="field"><label>Location</label><input id="loc"></div></body>',{
    url:'https://joeynatale28-source.github.io/daylight/',runScripts:'outside-only'
  });
  const w=dom.window;
  w.HTMLElement.prototype.scrollIntoView=function(){};
  const requests=[];
  let fail=false;
  w.daylightCloud={ready:true,client:{functions:{invoke:async (name,args)=>{
    requests.push({name,...args.body});
    if(fail)return {error:new Error('Photon unavailable')};
    if(args.body.input==='Hungary Creek Middle School')return {data:{suggestions:[
      {primary:'Hungary Creek Middle School',secondary:'Covewood Road · Glen Allen, VA 23060 · United States',
       address:'Covewood Road, Glen Allen, VA 23060, United States',hasHouseNumber:false,
       osmRef:'osm:way:9750',lat:37.675,lng:-77.56}
    ],attribution:'© OpenStreetMap contributors'}};
    if(args.body.input==='4909 Francistown Road')return {data:{suggestions:[
      {primary:'Hungary Creek Middle School',secondary:'Glen Allen, VA 23060 · United States',
       address:'Hungary Creek Middle School, Glen Allen, VA 23060, United States',hasHouseNumber:false,
       osmRef:'osm:way:9750',lat:37.675,lng:-77.56},
      {primary:'4909 Francistown Road',secondary:'Glen Allen, VA 23060 · United States',
       address:'4909 Francistown Road, Glen Allen, VA 23060, United States',hasHouseNumber:true,
       osmRef:'osm:node:4909',lat:37.675,lng:-77.56}
    ],attribution:'© OpenStreetMap contributors'}};
    return {data:{suggestions:[
      {primary:'10833 W Broad St',secondary:'Glen Allen, VA 23060, United States',
       address:'10833 W Broad St, Glen Allen, VA 23060, United States',
       osmRef:'osm:way:12345',lat:37.646,lng:-77.598},
      {primary:'10833 Broad',secondary:'Elsewhere',
       address:'10833 Broad, Elsewhere',osmRef:'osm:node:5678',lat:38,lng:-77}
    ],attribution:'© OpenStreetMap contributors'}};
  }}}};
  w.eval(source);
  const input=w.document.querySelector('#loc');
  const draft={loc:'',placeId:null,locationLat:null,locationLng:null};
  let changes=0;
  w.daylightAttachPlaces(input,draft,()=>changes++);
  return {w,input,draft,requests,setFail:()=>{fail=true},get changes(){return changes},dispose:()=>dom.window.close()};
}
const wait=(time=280)=>new Promise(resolve=>setTimeout(resolve,time));
function type(h,value){
  h.input.value=value;
  h.input.dispatchEvent(new h.w.Event('input',{bubbles:true}));
}
function key(h,name){
  h.input.dispatchEvent(new h.w.KeyboardEvent('keydown',{bubbles:true,key:name,cancelable:true}));
}
test('ArrowDown and Enter commit the Photon canonical address and coordinates',async()=>{
  const h=harness();
  try {
    type(h,'10833 W Broad');await wait();
    assert.equal(h.requests.length,1);
    assert.equal(h.requests[0].name,'places');
    assert.equal(h.requests[0].action,'autocomplete');
    assert.equal(h.w.document.querySelectorAll('[role=option]').length,2);
    assert.match(h.w.document.querySelector('.dl-osm-credit').textContent,/OpenStreetMap/);
    key(h,'ArrowDown');key(h,'Enter');
    assert.equal(h.input.value,'10833 W Broad St, Glen Allen, VA 23060, United States');
    assert.equal(h.draft.loc,h.input.value);
    assert.equal(h.draft.placeId,'osm:way:12345');
    assert.equal(h.draft.locationLat,37.646);
    assert.equal(h.draft.locationLng,-77.598);
    assert.equal(h.input.getAttribute('aria-expanded'),'false');
  } finally {h.dispose();}
});
test('mouse click commits full address; later free-text editing clears place reference',async()=>{
  const h=harness();
  try{
    type(h,'10833 W Broad');await wait();
    h.w.document.querySelector('[role=option]').click();
    assert.match(h.input.value,/VA 23060/);
    assert.equal(h.draft.placeId,'osm:way:12345');
    type(h,'Somewhere near the pool');
    assert.equal(h.draft.loc,'Somewhere near the pool');
    assert.equal(h.draft.placeId,null);
    assert.equal(h.draft.locationLat,null);
    assert.equal(h.draft.locationLng,null);
  }finally{h.dispose();}
});
test('mouse hover does not override keyboard selection index',async()=>{
  const h=harness();
  try{
    type(h,'10833 W Broad');await wait();
    const options=h.w.document.querySelectorAll('[role=option]');
    options[1].dispatchEvent(new h.w.Event('pointerenter',{bubbles:true}));
    key(h,'ArrowDown');key(h,'Enter');
    assert.equal(h.draft.placeId,'osm:way:12345');
  }finally{h.dispose();}
});
test('failed suggestions do not block saving a free-text location',async()=>{
  const h=harness();
  try{
    h.setFail();
    type(h,'swim practice pool');await wait();
    assert.equal(h.draft.loc,'swim practice pool');
    assert.equal(h.draft.placeId,null);
    assert.equal(h.w.document.querySelector('.dl-osm-options').hidden,true);
  }finally{h.dispose();}
});
test('school suggestions do not display a street inherited from a nearby road',async()=>{
  const h=harness();
  try{
    type(h,'Hungary Creek Middle School');await wait();
    const option=h.w.document.querySelector('[role=option]');
    assert.doesNotMatch(option.textContent,/Covewood Road/);
    assert.match(option.textContent,/Glen Allen, VA 23060/);
    option.click();
    assert.equal(h.draft.loc,'Hungary Creek Middle School, Glen Allen, VA 23060, United States');
  }finally{h.dispose();}
});
test('address-style queries prioritize results with house numbers',async()=>{
  const h=harness();
  try{
    type(h,'4909 Francistown Road');await wait();
    assert.equal(h.w.document.querySelector('.dl-osm-main').textContent,'4909 Francistown Road');
  }finally{h.dispose();}
});
test('address client contains no Google key, Google Places URL, or Photon direct request',()=>{
  assert.equal(source.includes('GOOGLE_MAPS_API_KEY'),false);
  assert.equal(source.includes('places.googleapis.com'),false);
  assert.equal(source.includes('photon.komoot.io'),false);
});
