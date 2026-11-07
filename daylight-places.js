/* TomTom Search API address suggestions for Daylight. */
(function(){
'use strict';
let instance=0;
const svgNS='http://www.w3.org/2000/svg';
function makePin(){
 const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('class','dl-place-pin');
 svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 const path=document.createElementNS(svgNS,'path');path.setAttribute('d','M13 6.5c0 3.2-5 8-5 8s-5-4.8-5-8a5 5 0 1 1 10 0Z');
 const circle=document.createElementNS(svgNS,'circle');circle.setAttribute('cx','8');circle.setAttribute('cy','6.5');circle.setAttribute('r','1.65');
 svg.append(path,circle);return svg;
}
window.daylightAttachPlaces=function(input,draft,dirty){
 if(!input||input.dataset.tomtomAttached)return;
 input.dataset.tomtomAttached='yes';input.autocomplete='off';
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
 const parent=input.closest('.field')||input.parentElement;
 parent.classList.add('dl-place-field');
 const id='dl-place-list-'+(++instance);
 input.setAttribute('aria-controls',id);
 const list=document.createElement('div');list.className='dl-place-options';list.id=id;
 list.setAttribute('role','listbox');list.hidden=true;parent.append(list);
 let seq=0,timer=0,results=[],active=-1;
 function close(){
  list.hidden=true;results=[];active=-1;list.textContent='';
  input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
 }
 function row(label,kind){
  list.textContent='';
  const item=document.createElement('div');item.className='dl-place-state'+(kind?' '+kind:'');
  item.setAttribute('role','status');item.textContent=label;list.append(item);
  list.hidden=false;input.setAttribute('aria-expanded','true');
 }
 function highlight(index,scroll){
  active=index;
  list.querySelectorAll('[role="option"]').forEach((option,i)=>option.setAttribute('aria-selected',String(i===active)));
  if(active>=0){
   const option=document.getElementById(id+'-'+active);
   if(option){input.setAttribute('aria-activedescendant',option.id);if(scroll)option.scrollIntoView({block:'nearest'});}
  }else input.removeAttribute('aria-activedescendant');
 }
 function commit(index){
  const item=results[index];if(!item||!item.address)return;
  const lat=Number(item.lat),lng=Number(item.lng);
  input.value=item.address;draft.loc=item.address;draft.placeId=null;
  draft.locationLat=Number.isFinite(lat)&&Math.abs(lat)<=90?lat:null;
  draft.locationLng=Number.isFinite(lng)&&Math.abs(lng)<=180?lng:null;
  dirty();seq++;clearTimeout(timer);close();input.focus({preventScroll:true});
 }
 function emphasize(el,value,query){
  const offset=value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if(offset<0){el.textContent=value;return;}
  el.append(document.createTextNode(value.slice(0,offset)));
  const strong=document.createElement('strong');strong.textContent=value.slice(offset,offset+query.length);
  el.append(strong,document.createTextNode(value.slice(offset+query.length)));
 }
 function render(query){
  list.textContent='';active=-1;
  results.forEach((item,index)=>{
   const button=document.createElement('button');button.type='button';button.className='dl-place-option';
   button.id=id+'-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   button.append(makePin());
   const copy=document.createElement('span');copy.className='dl-place-copy';
   const primary=document.createElement('span');primary.className='dl-place-primary';
   emphasize(primary,String(item.primary||item.address),query);
   const secondary=document.createElement('span');secondary.className='dl-place-secondary';
   secondary.textContent=String(item.secondary||'');
   copy.append(primary);if(secondary.textContent)copy.append(secondary);
   button.append(copy);
   button.addEventListener('pointerdown',e=>e.preventDefault());
   button.addEventListener('click',()=>commit(index));
   button.addEventListener('pointerenter',()=>highlight(index,false));
   button.addEventListener('pointerleave',()=>{if(active===index)highlight(-1,false)});
   list.append(button);
  });
  const credit=document.createElement('div');credit.className='dl-place-credit';credit.textContent='© TomTom';list.append(credit);
  list.hidden=!results.length;input.setAttribute('aria-expanded',String(!!results.length));
 }
 function showLoading(){
  list.textContent='';
  const loading=document.createElement('div');loading.className='dl-place-loading';loading.setAttribute('role','status');loading.setAttribute('aria-label','Searching addresses');
  loading.innerHTML='<span></span><span></span>';list.append(loading);
  list.hidden=false;input.setAttribute('aria-expanded','true');
 }
 input.addEventListener('input',()=>{
  draft.loc=input.value;draft.placeId=null;draft.locationLat=null;draft.locationLng=null;dirty();
  clearTimeout(timer);seq++;const request=seq;close();
  const query=input.value.trim();if(query.length<2)return;
  timer=setTimeout(async()=>{
   if(!window.daylightCloud?.ready||!window.daylightCloud?.client)return;
   showLoading();
   try{
    const body={action:'autocomplete',input:query,language:navigator.language||'en'};
    const bias=window.daylightLocationBias||input.dataset.positionBias;
    if(bias&&typeof bias==='object'){
     const lat=Number(bias.lat),lng=Number(bias.lng);
     if(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180)body.bias={lat,lng};
    }else if(typeof bias==='string'&&/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(bias)){
     const parts=bias.split(',').map(Number);if(Math.abs(parts[0])<=90&&Math.abs(parts[1])<=180)body.bias={lat:parts[0],lng:parts[1]};
    }
    const pending=window.daylightCloud.client.functions.invoke('places',{body});
    const result=await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),5500))]);
    if(seq!==request||!input.isConnected)return;
    if(result.error)throw Error('Address search unavailable');
    if(result.data?.error==='not_configured'||result.data?.error==='TOMTOM_API_KEY is not configured'){
     results=[];row("Address search isn't set up yet",'quiet');return;
    }
    if(result.data?.error){
     const message=String(result.data.error);
     results=[];row(message,'quiet');
     console.error('TomTom address lookup failed:',message);
     return;
    }
    results=Array.isArray(result.data?.suggestions)?result.data.suggestions.slice(0,6):[];
    render(query);
    if(!results.length)row('No matching addresses','quiet');
   }catch(error){
    if(seq===request){results=[];row('Address search is temporarily unavailable','quiet');}
    console.debug('Address suggestions unavailable');
   }
  },250);
 });
 input.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!list.hidden){e.preventDefault();close();return;}
  if(list.hidden||!results.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();const next=e.key==='ArrowDown'?(active+1)%results.length:(active<0?results.length-1:(active+results.length-1)%results.length);
   highlight(next,true);
  }else if(e.key==='Enter'&&active>=0){e.preventDefault();e.stopPropagation();commit(active);}
 });
 input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==input)close();},120));
 const watcher=new MutationObserver(()=>{
  if(!input.isConnected){clearTimeout(timer);seq++;watcher.disconnect();}
 });
 watcher.observe(document.body,{subtree:true,childList:true});
};
})();