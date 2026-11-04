/* Authenticated OpenStreetMap/Photon address suggestions for Daylight. */
(function(){
'use strict';
let instance=0;
window.daylightAttachPlaces=function(input,draft,dirty){
 if(!input || input.dataset.osmAttached)return;
 input.dataset.osmAttached='yes';input.autocomplete='off';
 input.setAttribute('role','combobox');
 input.setAttribute('aria-autocomplete','list');
 input.setAttribute('aria-expanded','false');
 const parent=input.closest('.field')||input.parentElement;
 parent.classList.add('dl-osm-field');
 const id='dl-osm-list-'+(++instance);
 input.setAttribute('aria-controls',id);
 const spinner=document.createElement('span');spinner.className='dl-osm-spinner';spinner.hidden=true;
 const list=document.createElement('div');list.className='dl-osm-options';list.id=id;
 list.setAttribute('role','listbox');list.hidden=true;
 parent.append(spinner,list);
 let seq=0,timer=0,results=[],active=-1,hover=-1;
 function close(){list.hidden=true;results=[];active=-1;hover=-1;list.textContent='';input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
 function highlight(i,keyboard){
  if(keyboard)active=i;else hover=i;
  const visual=hover>=0?hover:active;
  list.querySelectorAll('[role=option]').forEach((option,index)=>option.setAttribute('aria-selected',String(index===visual)));
  if(keyboard){const option=document.getElementById(id+'-'+i);if(option){input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}}
 }
 function commit(i){
  const item=results[i];if(!item||!item.address)return;
  if(!Number.isFinite(Number(item.lat))||!Number.isFinite(Number(item.lng)))return;
  input.value=item.address;draft.loc=item.address;draft.placeId=item.osmRef||null;
  draft.locationLat=Number(item.lat);draft.locationLng=Number(item.lng);dirty();
  seq++;clearTimeout(timer);spinner.hidden=true;close();input.focus({preventScroll:true});
 }
 function emphasize(el,value,query){
  const offset=value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if(offset<0){el.textContent=value;return;}
  el.append(document.createTextNode(value.slice(0,offset)));
  const strong=document.createElement('strong');strong.textContent=value.slice(offset,offset+query.length);
  el.append(strong,document.createTextNode(value.slice(offset+query.length)));
 }
 function render(query){
  list.textContent='';active=-1;hover=-1;
  results.forEach((item,index)=>{
   const button=document.createElement('button');button.type='button';button.className='dl-osm-option';
   button.id=id+'-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   const main=document.createElement('span');main.className='dl-osm-main';
   emphasize(main,String(item.primary||item.address),query);
   const secondary=document.createElement('span');secondary.className='dl-osm-secondary';
   secondary.textContent=String(item.secondary||item.address);
   button.append(main,secondary);
   button.addEventListener('pointerdown',e=>e.preventDefault());
   button.addEventListener('click',()=>commit(index));
   button.addEventListener('pointerenter',()=>highlight(index,false));
   button.addEventListener('pointerleave',()=>highlight(-1,false));
   list.append(button);
  });
  const credit=document.createElement('div');credit.className='dl-osm-credit';
  credit.textContent='© OpenStreetMap contributors';list.append(credit);
  list.hidden=!results.length;input.setAttribute('aria-expanded',String(!!results.length));
 }
 input.addEventListener('input',()=>{
  draft.loc=input.value;draft.placeId=null;draft.locationLat=null;draft.locationLng=null;dirty();
  clearTimeout(timer);seq++;const request=seq;close();spinner.hidden=true;
  const query=input.value.trim();if(query.length<2)return;
  timer=setTimeout(async()=>{
   if(!window.daylightCloud?.ready)return;spinner.hidden=false;
   try{
    const pending=window.daylightCloud.client.functions.invoke('places',{
     body:{action:'autocomplete',input:query,language:navigator.language||'en'}
    });
    const result=await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),5500))]);
    if(seq!==request||!input.isConnected)return;
    if(result.error||result.data?.error)throw Error('Unavailable');
    results=Array.isArray(result.data?.suggestions)?result.data.suggestions.slice(0,5):[];
    render(query);
   }catch(e){if(seq===request)close();console.debug('Location suggestions unavailable');}
   finally{if(seq===request)spinner.hidden=true;}
  },210);
 });
 input.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!list.hidden){e.preventDefault();close();return;}
  if(list.hidden||!results.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();const i=e.key==='ArrowDown'?((active+1)%results.length):
    (active<0?results.length-1:(active+results.length-1)%results.length);
   highlight(i,true);
  }else if(e.key==='Enter'&&active>=0){e.preventDefault();e.stopPropagation();commit(active);}
 });
 input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==input)close();},120));
 const watcher=new MutationObserver(()=>{
  if(!input.isConnected){clearTimeout(timer);seq++;watcher.disconnect();}
 });
 watcher.observe(document.body,{subtree:true,childList:true});
};
})();
