/* Motion only. Keeps Daylight's existing easing, input behavior and reduced motion. */
(function(){
  'use strict';
  const reduced=()=>document.body.classList.contains('reduce-motion')||
    document.body.classList.contains('dl-reduced')||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('keydown',()=>document.body.classList.add('dl-keyboard'),true);
  document.addEventListener('pointerdown',()=>document.body.classList.remove('dl-keyboard'),true);
  window.daylightDismissSurface=function(element,callback){
    if(!element){callback?.();return;}
    if(element.dataset.dlLeaving==='1')return;
    element.dataset.dlLeaving='1';
    if(reduced()||document.body.classList.contains('dl-keyboard')){
      element.remove();callback?.();return;
    }
    element.classList.add('dl-surface-leaving');
    window.setTimeout(()=>{element.remove();callback?.();},125);
  };
  function paintMotion(){
    if(typeof state!=='undefined')
      document.body.classList.toggle('dl-reduced',!!state.reduceMotion);
  }
  const previousRender=renderAll;
  renderAll=function(){
    const result=previousRender.apply(this,arguments);
    paintMotion();return result;
  };
  paintMotion();
  document.addEventListener('daylight:workspace-ready',()=>{
    paintMotion();
    if(sessionStorage.getItem('daylight:import-pending')==='yes'){
      sessionStorage.removeItem('daylight:import-pending');
      const summary=sessionStorage.getItem('daylight:last-ical-import');
      if(summary)toast('iCalendar imported: '+summary);
    }
  });
})();
