/* Daylight calendar sharing UI. All privileged operations run in the
 * authenticated Supabase Edge Function; never store full share links. */
(function () {
  "use strict";
  function cloud() {
    if (!window.daylightSupabase) throw new Error("Calendar account is not ready");
    return window.daylightSupabase;
  }
  async function invoke(action, calendarId) {
    const {data,error} = await cloud().functions.invoke("ical-feed",{
      body:{action,calendar_id:calendarId},
    });
    if(error||data?.error) throw new Error(data?.error || error?.message || "Request failed");
    return data;
  }
  async function downloadCalendar(calendar, eventId) {
    try {
      const {data,error} = await cloud().functions.invoke("ical-feed",{
        body:{action:"export",calendar_id:calendar.id,event_id:eventId ?? null},
      });
      if(error||data?.error) throw new Error(data?.error||error?.message||"Could not export");
      const text = typeof data==="string"?data:await data.text?.();
      if(!text?.startsWith("BEGIN:VCALENDAR")) throw new Error("The server did not return an iCalendar file");
      const filename=String(eventId == null?calendar.name:"daylight-event")
        .replace(/[^A-Za-z0-9_-]/g,"-").slice(0,70)+".ics";
      const objectUrl=URL.createObjectURL(new Blob([text],{type:"text/calendar;charset=utf-8"}));
      const a=document.createElement("a");
      a.href=objectUrl;a.download=filename;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),2000);
      toast("iCalendar file exported");
    } catch (error) { toast("Export failed: "+error.message); }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text);toast("Copied to clipboard"); }
    catch { toast("Unable to copy. Select the link and copy it manually."); }
  }
  function openShare(calendar) {
    if(calendar.subscribed || calendar.builtin || calendar.id==="holidays") {
      toast("Only your own calendars can be shared");return;
    }
    closeMenu();
    const bd=el('<div class="backdrop"><div class="dialog" style="width:470px" role="dialog" aria-modal="true" aria-label="Share calendar">' +
      '<div class="dialog-head"><span class="dialog-title">Share '+esc(calendar.name)+'</span><button class="icon-btn" data-x title="Close">'+icon("x",17)+'</button></div>' +
      '<div class="dialog-body" style="display:flex;flex-direction:column;gap:15px">' +
      '<div class="set-row switch-row"><span><span class="sw-label">Subscribe link</span><div class="sw-sub" data-state>Checking sharing status…</div></span>' +
      '<label class="switch"><input type="checkbox" data-enable disabled aria-label="Enable sharing"><span class="track"></span><span class="knob"></span></label></div>' +
      '<div class="inline-note">Anyone with this link can see this calendar&#39;s events. It&#39;s read-only — they can&#39;t change anything.</div>' +
      '<div data-linkarea></div><div style="display:flex;gap:9px;flex-wrap:wrap"><button class="btn-ghost" data-reset disabled>Reset link</button></div>' +
      '</div><div class="dialog-foot"><button class="btn-primary" data-done>Done</button></div></div></div>');
    overlayRoot.appendChild(bd);
    const input=bd.querySelector("[data-enable]");
    const status=bd.querySelector("[data-state]");
    const area=bd.querySelector("[data-linkarea]");
    const reset=bd.querySelector("[data-reset]");
    let enabled=false,prefix="",links=null,busy=false;
    function close(){bd.remove();}
    function draw(){
      input.checked=enabled;input.disabled=busy;
      reset.disabled=busy||!enabled;
      status.textContent=busy?"Updating…":enabled?"Calendar feed enabled":"Only you can see this calendar";
      area.innerHTML="";
      if(!enabled)return;
      const label=el('<div><label class="sw-label">Subscription URL</label><p class="inline-note" style="margin:4px 0 10px">Links can be copied only when first enabled or reset. Reset the link to revoke the previous one.</p></div>');
      area.appendChild(label);
      if(!links) {
        area.appendChild(el('<div class="text-input" style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">••••••••'+esc(prefix||"")+' (link hidden)</div>'));
        return;
      }
      [["HTTPS",links.https],["webcal",links.webcal]].forEach(([name,value])=>{
        const row=el('<div class="set-row" style="display:flex;gap:8px;align-items:center"><span class="sw-label" style="width:50px">'+esc(name)+'</span><input class="text-input" readonly style="min-width:0;flex:1" value="'+esc(value)+'"><button class="btn-ghost">Copy</button></div>');
        row.querySelector("button").addEventListener("click",()=>copy(value));
        area.appendChild(row);
      });
    }
    async function change(action) {
      if(busy)return;
      busy=true;draw();
      try {
        const result=await invoke(action,calendar.id);
        enabled=!!result.enabled;prefix=result.prefix||"";links=result.urls||null;
        draw();
        toast(action==="reset"?"Old link revoked. New link created.":action==="disable"?"Sharing disabled":"Calendar sharing enabled");
      }catch(error){toast(error.message);input.checked=enabled;}finally{busy=false;draw();}
    }
    input.addEventListener("change",()=>change(input.checked?"enable":"disable"));
    reset.addEventListener("click",()=>{
      openConfirm({
        title:"Reset sharing link?",
        body:"Anyone subscribed to the old link will lose access immediately. You'll need to send them the new link.",
        confirmLabel:"Reset link",danger:true,fn:()=>change("reset")
      });
    });
    bd.querySelector("[data-x]").addEventListener("click",close);
    bd.querySelector("[data-done]").addEventListener("click",close);
    bd.addEventListener("mousedown",e=>{if(e.target===bd)close();});
    invoke("status",calendar.id).then(result=>{
      enabled=!!result.enabled;prefix=result.prefix||"";links=null;busy=false;draw();
    }).catch(error=>{status.textContent=error.message;busy=false;draw();});
    draw();
  }
  window.daylightIntegrations={openShare,downloadCalendar};
})();
