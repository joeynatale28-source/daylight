/* Daylight location field: Photon / OpenStreetMap, behind JWT-gated places proxy.
   A selected result commits the complete address plus OSM reference and coordinates.
   Free text always remains a valid event location. */
(function(){
  'use strict';
  let serial=0;
  const escText=(v)=>String(v==null?'':v);
  const mapURL=(event)=>{
    const lat=Number(event.placeLat),lng=Number(event.placeLng);
    if(event.placeLat!=null&&event.placeLng!=null&&Number.isFinite(lat)&&Number.isFinite(lng)
       &&Math.abs(lat)<=90&&Math.abs(lng)<=180)
      return 'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lng+'#map=18/'+lat+'/'+lng;
    const match=String(event.placeId||'').match(/^osm:(node|way|relation):(\d{1,20})$/);
    return match?'https://www.openstreetmap.org/'+match[1]+'/'+match[2]:null;
  };
  window.daylightLocationURL=mapURL;

  window.daylightAttachPhoton=function(input,draft){
    if(!input||input.dataset.photonBound==='true')return;
    input.dataset.photonBound='true';
    const id='dl-place-'+(++serial);
    const host=document.createElement('span');
    host.className='dl-places-host';
    input.parentNode.insertBefore(host,input);
    host.appendChild(input);
    input.autocomplete='off';
    input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-haspopup','listbox');
    input.setAttribute('aria-controls',id);
    input.setAttribute('aria-expanded','false');
    draft.placeId=draft.placeId||null;
    draft.placeLat=Number.isFinite(Number(draft.placeLat))&&draft.placeLat!=null?Number(draft.placeLat):null;
    draft.placeLng=Number.isFinite(Number(draft.placeLng))&&draft.placeLng!=null?Number(draft.placeLng):null;

    const spinner=document.createElement('span');
    spinner.className='dl-places-spinner';
    spinner.setAttribute('aria-label','Searching locations');
    spinner.hidden=true;
    host.appendChild(spinner);

    const menu=document.createElement('div');
    menu.className='dl-places-menu';
    menu.id=id;
    menu.setAttribute('role','listbox');
    menu.setAttribute('aria-label','Address suggestions');
    menu.hidden=true;
    document.body.appendChild(menu);

    let results=[],timer=null,controller=null,sequence=0,keyboard=-1,selected=false,closed=false;
    const canShow=()=>input.isConnected&&!closed;
    function reduced(){
      return !!(window.state&&window.state.reduceMotion)||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    function place(){
      if(!canShow())return;
      const rect=input.getBoundingClientRect();
      menu.style.left=Math.max(8,rect.left)+'px';
      menu.style.width=Math.max(200,rect.width)+'px';
      const below=window.innerHeight-rect.bottom-10;
      menu.style.top=below<160?Math.max(8,rect.top-Math.min(260,menu.scrollHeight+6))+'px':rect.bottom+6+'px';
    }
    function hide(){
      if(menu.hidden)return;
      menu.hidden=true;input.setAttribute('aria-expanded','false');
      input.removeAttribute('aria-activedescendant');
      keyboard=-1;
    }
    function cleanup(){
      closed=true;hide();clearTimeout(timer);
      if(controller)controller.abort();
      menu.remove();spinner.remove();
      window.removeEventListener('resize',place);
      document.removeEventListener('scroll',place,true);
    }
    function visible(){
      if(!canShow()){cleanup();return false;}
      return true;
    }
    function open(){
      if(!visible()||!results.length)return;
      place();
      menu.hidden=false;
      input.setAttribute('aria-expanded','true');
      menu.classList.remove('dl-places-arriving');
      if(!reduced()&&!document.body.classList.contains('dl-keyboard')){
        void menu.offsetWidth;menu.classList.add('dl-places-arriving');
      }
    }
    function highlight(){
      [...menu.querySelectorAll('[role="option"]')].forEach((node,index)=>{
        node.classList.toggle('dl-key-selected',index===keyboard);
        node.setAttribute('aria-selected',index===keyboard?'true':'false');
      });
      if(keyboard>=0)input.setAttribute('aria-activedescendant',id+'-opt-'+keyboard);
      else input.removeAttribute('aria-activedescendant');
    }
    function emphasized(container,term,value){
      const text=escText(value),lower=text.toLowerCase(),at=lower.indexOf(term.toLowerCase());
      if(!term||at<0){container.textContent=text;return;}
      container.append(document.createTextNode(text.slice(0,at)));
      const strong=document.createElement('strong');
      strong.textContent=text.slice(at,at+term.length);
      container.append(strong,document.createTextNode(text.slice(at+term.length)));
    }
    function select(record){
      selected=true;clearTimeout(timer);
      if(controller)controller.abort();sequence++;
      const full=String(record.address||'').trim();
      if(!full){hide();return;}
      // Set model and control together; do not dispatch "input" (which clears metadata).
      input.value=full;draft.loc=full;
      draft.placeId=String(record.osmRef||'');
      draft.placeLat=Number(record.lat);draft.placeLng=Number(record.lng);
      draft.dirty=true;
      input.dispatchEvent(new Event('change',{bubbles:true}));
      results=[];hide();spinner.hidden=true;input.focus();
    }
    function draw(term){
      if(!visible())return;
      menu.replaceChildren();
      keyboard=-1;
      results.forEach((record,index)=>{
        const option=document.createElement('button');
        option.type='button';option.setAttribute('role','option');
        option.setAttribute('aria-selected','false');option.id=id+'-opt-'+index;
        option.className='dl-place-option';
        option.tabIndex=-1;
        const main=document.createElement('span');main.className='dl-place-primary';
        emphasized(main,term,record.primary||record.address);
        const secondary=document.createElement('span');secondary.className='dl-place-secondary';
        secondary.textContent=record.secondary||record.address;
        option.append(main,secondary);
        // Keep input focus through pointer selection, and don't overwrite keyboard index.
        option.addEventListener('pointerdown',e=>e.preventDefault());
        option.addEventListener('click',()=>select(record));
        option.addEventListener('pointerenter',()=>option.classList.add('dl-mouse-hover'));
        option.addEventListener('pointerleave',()=>option.classList.remove('dl-mouse-hover'));
        menu.appendChild(option);
      });
      const credit=document.createElement('a');
      credit.className='dl-places-credit';credit.textContent='© OpenStreetMap contributors';
      credit.href='https://www.openstreetmap.org/copyright';
      credit.target='_blank';credit.rel='noopener noreferrer';
      menu.appendChild(credit);
      if(results.length)open();else hide();
    }
    async function lookUp(term){
      if(!visible())return;
      const seq=++sequence;
      if(controller)controller.abort();
      controller=new AbortController();
      const signal=controller.signal;
      spinner.hidden=false;
      try{
        const client=window.daylightCloud?.client;
        if(!window.daylightCloud?.ready||!client)throw Error('Not connected');
        const response=await client.functions.invoke('places',{
          body:{action:'autocomplete',input:term,language:navigator.language||'en'},
          signal
        });
        if(signal.aborted||seq!==sequence||!canShow()||input.value.trim()!==term)return;
        if(response.error||response.data?.error)throw Error('Suggestions unavailable');
        results=(Array.isArray(response.data?.suggestions)?response.data.suggestions:[]).slice(0,5);
        draw(term);
      }catch(error){
        // Optional enhancement only; never block typing or saving free text.
        if(!signal.aborted&&seq===sequence){results=[];hide();}
      }finally{
        if(seq===sequence&&canShow())spinner.hidden=true;
      }
    }
    input.addEventListener('input',()=>{
      draft.placeId=null;draft.placeLat=null;draft.placeLng=null;
      selected=false;const term=input.value.trim();
      clearTimeout(timer);sequence++;
      if(controller)controller.abort();
      results=[];hide();spinner.hidden=true;
      if(term.length>=2)timer=setTimeout(()=>lookUp(term),230);
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        if(!menu.hidden){e.stopPropagation();e.preventDefault();hide();}
        return;
      }
      if(menu.hidden||!results.length)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();keyboard=e.key==='ArrowDown'?(keyboard+1)%results.length:
          (keyboard<=0?results.length-1:keyboard-1);
        highlight();return;
      }
      if(e.key==='Enter'&&keyboard>=0){
        e.preventDefault();e.stopPropagation();select(results[keyboard]);
      }
    });
    input.addEventListener('blur',()=>{
      setTimeout(()=>{if(!menu.contains(document.activeElement))hide();},110);
    });
    const ancestor=input.closest('.backdrop');
    if(ancestor){
      const observer=new MutationObserver(()=>{if(!input.isConnected){observer.disconnect();cleanup();}});
      observer.observe(document.body,{subtree:true,childList:true});
    }
    window.addEventListener('resize',place);
    document.addEventListener('scroll',place,true);
  };
})();