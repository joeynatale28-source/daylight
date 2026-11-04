/* External iCalendar subscription UI/cache integration.
 * The edge service fetches, validates and parses URLs; browser never fetches external hosts. */
(function () {
  "use strict";
  var subscriptions=[];
  var generation=0;
  function client(){ if(!window.daylightSupabase)throw new Error("You must be signed in"); return window.daylightSupabase; }
  async function call(action,fields) {
    const {data,error}=await client().functions.invoke("ical-subscribe",{body:Object.assign({action},fields||{})});
    if(error||data?.error)throw new Error(data?.error||error?.message||"Subscription request failed");
    return data;
  }
  function removeDerived() {
    state.calendars=state.calendars.filter(c=>!c.source_subscription_id);
    state.events=state.events.filter(e=>!e.source_subscription_id);
  }
  function apply() {
    removeDerived();
    subscriptions.forEach(function (f) {
      var calId="subscription:"+f.id;
      state.calendars.push({
        id:calId,name:f.name||"External calendar",color:PALETTE[f.color]?f.color:"teal",
        hidden:false,subscribed:true,shared:false,builtin:false,
        source_subscription_id:f.id,source_url:f.url,last_error:f.last_error,
      });
      (Array.isArray(f.cached_events)?f.cached_events:[]).forEach(function (e) {
        if(e.status==="CANCELLED")return;
        const start=new Date(e.start),end=new Date(e.end);
        if(!isFinite(+start)||!isFinite(+end)||end<=start)return;
        state.events.push({
          id:++uid,uid:e.external_uid,feedKey:e.occurrence_id||e.external_uid,
          cal:calId,title:e.title,start,end,allDay:!!e.allDay,
          loc:e.location||"",desc:e.description||"",repeat:null,reminder:null,
          declined:e.status==="DECLINED",source_subscription_id:f.id,
          timezone:e.source_timezone,
        });
      });
    });
    if(!document.getElementById("app").hidden)renderAll(false);
  }
  function refreshOne(f) {
    if(f.last_fetched_at && Date.now()-Date.parse(f.last_fetched_at)<3*3600000)return Promise.resolve();
    return call("refresh",{id:f.id}).then(res=>{
      if(res.subscription)Object.assign(f,res.subscription);
      apply();
    }).catch(error=>{
      f.last_error=error.message;
      apply();
    });
  }
  async function load() {
    const seq=++generation;
    try{
      const result=await call("list");
      if(seq!==generation)return;
      subscriptions=result.subscriptions||[];
      apply();
      for(const f of subscriptions){
        if(seq!==generation)break;
        await refreshOne(f);
      }
    }catch(error){console.warn("Subscription cache unavailable:",error.message);}
  }
  function addSettings(pane) {
    const list=pane.querySelector("#feedList"),add=pane.querySelector("#fdAdd");
    if(!list||!add)return;
    const input=pane.querySelector("#fdUrl");
    // Replace the preview-only click handler so a URL can't be silently accepted
    // without being fetched, parsed and checked by the server.
    const button=add.cloneNode(true);add.replaceWith(button);
    const nameRow=el('<div class="field" style="margin-top:10px"><label for="fdName">Name (optional)</label><input class="text-input" id="fdName" placeholder="Use the calendar name from the feed"></div>');
    list.parentElement.insertBefore(nameRow,list.nextSibling);
    const nameInput=nameRow.querySelector("input");
    function renderList() {
      list.innerHTML="";
      if(!subscriptions.length) {
        list.appendChild(el('<div class="empty-state" style="padding:18px"><p>No subscriptions yet</p></div>'));
        return;
      }
      subscriptions.forEach(function (f) {
        const meta=f.last_error?"Couldn’t update · Last saved copy shown":
          f.last_fetched_at?"Updated "+new Date(f.last_fetched_at).toLocaleString():"Not refreshed yet";
        const row=el('<div class="feed-row"><span class="fr-url" style="min-width:0;flex:1">'+esc(f.name||"Calendar")+
          '<br><span class="fr-sub">'+esc(meta)+'</span></span>' +
          '<button class="icon-btn" data-refresh title="Refresh subscription">'+icon("sync",15)+'</button>' +
          '<button class="icon-btn" data-remove title="Remove subscription">'+icon("trash",15)+'</button></div>');
        row.querySelector("[data-refresh]").addEventListener("click",()=>{
          refreshOne(f).then(renderList);
        });
        row.querySelector("[data-remove]").addEventListener("click",async()=>{
          try {
            await call("remove",{id:f.id});
            subscriptions=subscriptions.filter(x=>x.id!==f.id);
            apply();renderList();
            toast("Subscription removed");
          }catch(error){toast(error.message);}
        });
        list.appendChild(row);
      });
    }
    button.addEventListener("click",async()=>{
      const url=input.value.trim();
      if(!url){toast("Enter a calendar URL");return;}
      button.disabled=true;button.textContent="Adding…";
      try{
        const result=await call("add",{url,name:nameInput.value.trim()});
        subscriptions.push(result.subscription);
        apply();renderList();input.value="";nameInput.value="";
        toast("Calendar subscribed: "+result.imported+" events, "+result.skipped+" skipped");
      }catch(error){toast("Could not subscribe: "+error.message);}
      finally{button.disabled=false;button.textContent="Add feed";}
    });
    renderList();
  }
  const oldPane=paneData;
  paneData=function(pane,close) {
    oldPane(pane,close);
    addSettings(pane);
  };
  document.addEventListener("daylight:workspace-loaded",load);
  document.addEventListener("daylight:signed-out",function () {
    generation++;subscriptions=[];removeDerived();
  });
  window.daylightSubscriptions={refresh:load};
})();
