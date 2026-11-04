/* Daylight iCalendar and AI access integration.
 * This module uses the authenticated user's Supabase session only. It never
 * receives a service-role key or stores feed/token secrets in the workspace.
 */
(function () {
  "use strict";

  var BASE = "https://qrqemjgpzoqhtmsowmqv.supabase.co";
  var lastSubscriptions = [];
  var syncing = false;
  var COLORS = ["blue","violet","green","amber","rose","teal","plum","gray"];
  function client() { return window.DaylightCloud && window.DaylightCloud.client; }
  function signedIn() { return window.DaylightCloud && window.DaylightCloud.ready(); }
  function message(error) { return String(error && (error.message || error.error) || error || "Request failed"); }
  function copyText(value) {
    return navigator.clipboard.writeText(value).then(function () { toast("Copied to clipboard"); },
      function () { toast("Could not copy; select and copy the link manually"); });
  }
  function errorToast(error) { toast(message(error)); }
  async function call(name, payload) {
    var c = client();
    if (!c || !signedIn()) throw Error("Sign in before managing calendars.");
    var res = await c.functions.invoke(name, { body: payload });
    if (res.error) {
      var detail = res.error.context && typeof res.error.context.json === "function"
        ? await res.error.context.json().catch(function () { return null; }) : null;
      throw Error(detail && detail.error || res.error.message || "Service unavailable");
    }
    if (res.data && res.data.error) throw Error(res.data.error);
    return res.data;
  }
  function modal(title) {
    var bd = el('<div class="backdrop"><div class="dialog" style="width:490px;max-width:calc(100vw - 24px)">' +
      '<div class="dialog-head"><span class="dialog-title">' + esc(title) + '</span><button class="icon-btn" data-x aria-label="Close">' + icon("x",17) + '</button></div>' +
      '<div class="dialog-body" style="display:flex;flex-direction:column;gap:15px"></div></div></div>');
    overlayRoot.appendChild(bd);
    function close() { bd.remove(); }
    bd.querySelector("[data-x]").addEventListener("click", close);
    bd.addEventListener("mousedown", function (event) { if (event.target === bd) close(); });
    return { root: bd, body: bd.querySelector(".dialog-body"), close: close };
  }

  async function openShare(cal) {
    if (!cal || cal.builtin || cal.subscribed) return toast("Only your own calendars can be shared.");
    var dialog = modal("Share " + cal.name);
    var body = dialog.body, full = null;
    body.innerHTML = '<p style="font-size:13px;color:var(--muted);line-height:1.6;margin:0">' +
      'Anyone with this link can see this calendar&#39;s events. It&#39;s read-only — they can&#39;t change anything.</p>' +
      '<div id="shareContent" aria-live="polite" style="font-size:13px;color:var(--muted)">Loading share settings…</div>';
    var slot = body.querySelector("#shareContent");
    function render(status) {
      if (!slot.isConnected) return;
      var enabled = !!status.enabled, prefix = status.prefix || "";
      slot.innerHTML = '<div class="set-group" style="padding:16px;margin:0"><div class="set-row switch-row">' +
        '<span><span class="sw-label">Share feed</span><span class="sw-sub">Enable a secret iCalendar subscription link.</span></span>' +
        '<label class="switch"><input id="sfEnabled" type="checkbox" ' + (enabled ? "checked" : "") +
        ' aria-label="Share calendar enabled"><span class="track"></span><span class="knob"></span></label></div>' +
        (enabled ? '<p class="inline-note" style="margin:12px 0 9px">' + (full ? "Copy this link now. It will not be shown again." :
          "Current secret link: " + esc(prefix) + "… (hidden after creation)") + '</p>' +
          (full ? '<div class="field"><label>HTTPS subscription</label><input id="shareHttps" class="text-input" readonly value="' +
          esc(full.https) + '"></div><div class="field"><label>webcal subscription</label><input id="shareWebcal" class="text-input" readonly value="' +
          esc(full.webcal) + '"></div><div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn-ghost" id="copyHttps">Copy HTTPS</button><button class="btn-ghost" id="copyWebcal">Copy webcal</button></div>' : '') +
          '<div style="margin-top:12px"><button class="btn-ghost" id="sfReset">Reset link</button></div>' : '') +
        '</div>';
      var toggle = slot.querySelector("#sfEnabled");
      toggle.addEventListener("change", async function () {
        toggle.disabled = true;
        try {
          var result = await call("ical-feed", {action:toggle.checked ? "enable" : "disable", calendar_id:cal.id});
          full = result.urls || null;
          render(result);
          toast(toggle.checked ? "Share link enabled" : "Share link disabled");
        } catch(e) { errorToast(e); render(status); }
      });
      if (full) {
        slot.querySelector("#copyHttps").addEventListener("click",function(){copyText(full.https);});
        slot.querySelector("#copyWebcal").addEventListener("click",function(){copyText(full.webcal);});
      }
      var reset = slot.querySelector("#sfReset");
      if (reset) reset.addEventListener("click", function () {
        openConfirm({title:"Reset share link?",body:"The previous link will stop working immediately. Subscribers will need your new link.",
          confirmLabel:"Reset link",danger:true,fn:async function () {
            try { var result=await call("ical-feed",{action:"reset",calendar_id:cal.id}); full=result.urls||null;render(result);toast("Share link reset"); }
            catch(e){errorToast(e);}
          }});
      });
    }
    try { render(await call("ical-feed",{action:"status",calendar_id:cal.id})); }
    catch(e){ if(slot.isConnected)slot.textContent=message(e); }
  }

  function blobDownload(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  async function exportICS(cal, eventId) {
    if (!cal || cal.builtin || cal.subscribed) return toast("Only writable calendars can be exported here.");
    try {
      var raw=await call("ical-feed", {action:"export",calendar_id:cal.id,
        ...(eventId!=null?{event_id:eventId}:{})});
      var file=raw instanceof Blob ? raw : new Blob([typeof raw==="string"?raw:String(raw)],{type:"text/calendar;charset=utf-8"});
      blobDownload(file,String(cal.name||"daylight").replace(/[^a-z0-9 _-]/gi,"").slice(0,65)+".ics");
      toast("Calendar exported");
    } catch(e) { errorToast(e); }
  }

  function numericId(key) {
    var h=2166136261;
    for(var i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);
    return -(1+(h>>>0));
  }
  function installSubscriptions(rows) {
    /* Keep remote caches out of the user workspace snapshot. Their source of
       truth is the per-user subscriptions table and its last-good cache. */
    state.calendars=state.calendars.filter(function(c){return !c.remoteSubscription;});
    state.events=state.events.filter(function(e){return !e.remoteSubscription;});
    rows.forEach(function(sub) {
      var id="sub:"+sub.id;
      state.calendars.push({
        id:id,name:sub.name||"Subscribed calendar",color:COLORS.includes(sub.color)?sub.color:"teal",
        hidden:false,subscribed:true,shared:false,builtin:false,remoteSubscription:true,
        feedError:sub.last_error||null,sourceUrl:sub.url
      });
      (Array.isArray(sub.cached_events)?sub.cached_events:[]).forEach(function(event,index){
        var start=new Date(event.start),end=new Date(event.end);
        if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)return;
        state.events.push({
          id:numericId(sub.id+":"+(event.occurrence_id||event.external_uid||index)),
          uid:event.external_uid||null,cal:id,title:event.title||"Untitled event",
          start:start,end:end,allDay:!!event.allDay,loc:event.location||"",
          desc:event.description||"",repeat:null,rrule:null,reminder:null,
          declined:event.status==="DECLINED",status:event.status||"CONFIRMED",
          sourceTimezone:event.source_timezone||"",remoteSubscription:true,
          sourceName:sub.name||"Subscribed calendar",feedKey:sub.id
        });
      });
    });
    renderAll(false);
  }
  async function loadSubscriptions(refresh) {
    if(!signedIn()||syncing)return;
    syncing=true;
    try {
      var result=await call("ical-subscribe",{action:"list"});
      lastSubscriptions=Array.isArray(result.subscriptions)?result.subscriptions:[];
      installSubscriptions(lastSubscriptions);
      if(refresh) {
        for (var sub of lastSubscriptions) {
          if (sub.last_fetched_at && Date.now()-new Date(sub.last_fetched_at).getTime()<3*3600000) continue;
          try {
            await call("ical-subscribe",{action:"refresh",id:sub.id});
          }catch(e){console.warn("Subscription refresh failed:",message(e));}
        }
        var updated=await call("ical-subscribe",{action:"list"});
        lastSubscriptions=updated.subscriptions||[];
        installSubscriptions(lastSubscriptions);
      }
    }catch(e){console.warn("Subscription sync failed:",message(e));}
    finally{syncing=false;}
  }

  function replaceFeedPanel(pane) {
    var old=pane.querySelector(".set-group");
    if(!old)return;
    var g=el('<div class="set-group"><div class="set-group-title">Subscribed Calendars</div>' +
      '<p class="pane-sub" style="margin:0 0 12px">Add a public iCalendar URL. Subscriptions are read-only and refresh periodically. Changes here take effect immediately.</p>' +
      '<div id="liveFeeds" aria-live="polite"></div>' +
      '<div class="field"><label for="liveFeedUrl">Feed URL (HTTPS or webcal)</label>' +
      '<input class="text-input" id="liveFeedUrl" placeholder="https://example.com/calendar.ics"></div>' +
      '<div class="field"><label for="liveFeedName">Name (optional)</label><input class="text-input" id="liveFeedName" placeholder="Use calendar name from feed"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-primary" id="liveFeedAdd">Add calendar by URL</button>' +
      '<button class="btn-ghost" id="liveFeedRefresh">Refresh list</button></div></div>');
    old.replaceWith(g);
    var list=g.querySelector("#liveFeeds");
    function renderList() {
      if(!list.isConnected)return;
      list.innerHTML="";
      if(!lastSubscriptions.length)list.appendChild(el('<p class="inline-note">No external subscriptions yet.</p>'));
      lastSubscriptions.forEach(function(sub) {
        var row=el('<div class="feed-row"><span style="min-width:0;flex:1"><b>'+esc(sub.name||"Calendar")+'</b>' +
          '<span class="fr-sub" style="display:block;overflow-wrap:anywhere">'+esc(sub.url||"")+'</span>' +
          (sub.last_error?'<span style="color:var(--danger);font-size:11px">Couldn&#39;t update: '+esc(sub.last_error)+'</span>':
          '<span class="fr-sub" style="display:block">'+(sub.last_fetched_at?"Last updated: "+esc(new Date(sub.last_fetched_at).toLocaleString()):"Not refreshed yet")+
          ' · '+esc((sub.cached_events||[]).length)+" events"+(sub.skipped_count?" · "+sub.skipped_count+" skipped":"")+'</span>') +
          '</span><button class="icon-btn" data-remove title="Remove subscription">'+icon("trash",15)+'</button></div>');
        row.querySelector("[data-remove]").addEventListener("click",function(){
          openConfirm({title:"Remove subscription?",body:"This removes the read-only calendar from Daylight. Your own events will not be deleted.",
            confirmLabel:"Remove",danger:true,fn:async function(){
              try{await call("ical-subscribe",{action:"remove",id:sub.id});await loadSubscriptions(false);renderList();}
              catch(e){errorToast(e);}
            }});
        });
        list.appendChild(row);
      });
    }
    renderList();
    g.querySelector("#liveFeedAdd").addEventListener("click",async function(){
      var button=this,url=g.querySelector("#liveFeedUrl").value.trim(),name=g.querySelector("#liveFeedName").value.trim();
      if(!url) return toast("Enter a calendar URL.");
      button.disabled=true;button.textContent="Importing…";
      try {
        var response=await call("ical-subscribe",{action:"add",url,name});
        await loadSubscriptions(false);renderList();g.querySelector("#liveFeedUrl").value="";
        toast("Subscribed to "+(response.subscription?.name||"calendar")+" ("+(response.imported||0)+" events)");
      }catch(e){errorToast(e);}
      finally {button.disabled=false;button.textContent="Add calendar by URL";}
    });
    g.querySelector("#liveFeedRefresh").addEventListener("click",async function(){
      await loadSubscriptions(true);renderList();toast("Subscription list refreshed");
    });
  }

  function paneAI(pane) {
    paneHead(pane,"AI access","Create and revoke tokens used by MCP clients. Tokens never grant access outside your own calendars.");
    var g=el('<div class="set-group"><div class="set-group-title">Create an access token</div>' +
      '<div class="field"><label for="aiTokenName">Token name</label><input id="aiTokenName" class="text-input" maxlength="80" placeholder="My AI assistant"></div>' +
      '<div style="display:flex;gap:16px;margin:12px 0"><label><input type="checkbox" id="aiRead" checked> Read</label>' +
      '<label><input type="checkbox" id="aiWrite"> Write events and tasks</label></div>' +
      '<button class="btn-primary" id="aiCreate">Create token</button><p class="inline-note">The secret is shown exactly once. Copy and save it securely.</p>' +
      '<div id="aiOneTime" aria-live="polite"></div></div>');
    pane.appendChild(g);
    var show=g.querySelector("#aiOneTime");
    g.querySelector("#aiCreate").addEventListener("click",async function(){
      var name=g.querySelector("#aiTokenName").value.trim(),write=g.querySelector("#aiWrite").checked;
      if(!name)return toast("Give the token a name.");
      if(!g.querySelector("#aiRead").checked&&!write)return toast("Choose a permission.");
      var button=this;button.disabled=true;
      try {
        var bytes=crypto.getRandomValues(new Uint8Array(32));
        var token="dl_mcp_"+Array.from(bytes).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
        var digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
        var hash=Array.from(new Uint8Array(digest)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
        var me=window.DaylightCloud.user();
        var result=await client().from("mcp_tokens").insert({
          user_id:me.id,name:name,token_prefix:token.slice(7,15),
          token_hash:hash,scopes:write?["read","write"]:["read"],revoked:false
        }).select("id").single();
        if(result.error)throw result.error;
        show.innerHTML='<div class="field"><label>Copy your new token now</label><input class="text-input" readonly id="aiSecret" value="'+esc(token)+'"></div>'+
          '<button class="btn-ghost" id="aiCopy">Copy token</button>';
        show.querySelector("#aiCopy").addEventListener("click",function(){copyText(token);});
        g.querySelector("#aiTokenName").value="";toast("Token created. Save it now.");
        refreshAIList(pane);
      }catch(e){errorToast(e);}
      finally{button.disabled=false;}
    });
    var connection=el('<div class="set-group"><div class="set-group-title">MCP connection</div>'+
      '<p class="inline-note">Connect with a token you create above. The deployed endpoint is a Supabase Edge Function; the standalone SDK server is maintained in the /mcp package.</p>'+
      '<input class="text-input" readonly id="aiEndpoint" value="'+esc(BASE+"/functions/v1/daylight-mcp")+'">'+
      '<button class="btn-ghost" id="aiEndpointCopy">Copy server URL</button>'+
      '<pre style="font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted)">'+
      esc(JSON.stringify({mcpServers:{daylight:{url:BASE+"/functions/v1/daylight-mcp",headers:{Authorization:"Bearer YOUR_DAYLIGHT_TOKEN"}}}},null,2))+'</pre></div>');
    pane.appendChild(connection);
    connection.querySelector("#aiEndpointCopy").addEventListener("click",function(){copyText(BASE+"/functions/v1/daylight-mcp");});
    var danger=el('<div class="set-group"><div class="set-group-title">Delete permission</div>' +
      '<p class="pane-sub" style="margin:0 0 10px">Even write tokens cannot delete events unless you also enable this account-wide permission.</p>' +
      '<label class="switch"><input id="aiDelete" type="checkbox"><span class="track"></span><span class="knob"></span></label>' +
      '<span style="font-size:12px;color:var(--danger);padding-left:12px">Allow AI deletion (off by default)</span></div>');
    pane.appendChild(danger);
    var allow=danger.querySelector("#aiDelete");
    async function setDelete(value){
      var result=await client().from("user_settings").upsert({user_id:window.DaylightCloud.user().id,mcp_allow_delete:value},{onConflict:"user_id"});
      if(result.error)throw result.error;
      allow.checked=value;
    }
    allow.addEventListener("change",function(){
      var intended=allow.checked;allow.checked=!intended;
      if(intended){
        openConfirm({title:"Allow AI clients to delete events?",body:"This permits deletion by write-enabled AI tokens until you turn it off again. Deleted events may not be recoverable.",
          confirmLabel:"Allow deletes",danger:true,fn:function(){setDelete(true).catch(errorToast);}});
      }else{setDelete(false).catch(errorToast);}
    });
    client().from("user_settings").select("mcp_allow_delete").eq("user_id",window.DaylightCloud.user().id).maybeSingle()
      .then(function(result){if(!result.error&&allow.isConnected)allow.checked=!!result.data?.mcp_allow_delete;});
    var active=el('<div class="set-group"><div class="set-group-title">Active tokens</div><div id="aiActive" aria-live="polite">Loading…</div></div>');
    pane.appendChild(active);
    var audit=el('<div class="set-group"><div class="set-group-title">Deletion history</div><div id="aiAudit" aria-live="polite">Loading…</div></div>');
    pane.appendChild(audit);
    refreshAIList(pane);
  }
  async function refreshAIList(pane) {
    var uid=window.DaylightCloud && window.DaylightCloud.user()?.id;
    if(!uid)return;
    var res=await client().from("mcp_tokens").select("id,name,token_prefix,scopes,created_at,last_used_at")
      .eq("user_id",uid).eq("revoked",false).order("created_at",{ascending:false});
    var target=pane.querySelector("#aiActive");if(!target)return;
    if(res.error){target.textContent=message(res.error);return;}
    target.innerHTML="";
    if(!res.data.length)target.appendChild(el('<p class="inline-note">No active tokens.</p>'));
    res.data.forEach(function(token){
      var row=el('<div class="feed-row"><div style="min-width:0;flex:1"><b>'+esc(token.name)+'</b><div class="fr-sub">' +
        esc(token.token_prefix||"")+'… · '+esc((token.scopes||[]).join(", "))+
        '<span style="display:block">Created '+esc(new Date(token.created_at).toLocaleString())+
        (token.last_used_at?" · Used "+esc(new Date(token.last_used_at).toLocaleString()):" · Never used")+
        '</span></div></div><button class="btn-ghost" data-revoke>Revoke</button></div>');
      row.querySelector("[data-revoke]").addEventListener("click",function(){
        openConfirm({title:"Revoke token?",body:"This immediately stops this token from accessing your Daylight calendar.",
          confirmLabel:"Revoke",danger:true,fn:async function(){
            var result=await client().from("mcp_tokens").update({revoked:true}).eq("id",token.id).eq("user_id",uid);
            if(result.error)errorToast(result.error);else {toast("Token revoked");refreshAIList(pane);}
          }});
      });
      target.appendChild(row);
    });
    var auditTarget=pane.querySelector("#aiAudit");
    if(!auditTarget)return;
    var history=await client().from("mcp_audit_log").select("tool,token_name,summary,created_at")
      .eq("user_id",uid).order("created_at",{ascending:false}).limit(15);
    if(history.error){auditTarget.textContent="Audit log unavailable";return;}
    auditTarget.innerHTML="";
    if(!history.data.length)auditTarget.appendChild(el('<p class="inline-note">No recorded deletions.</p>'));
    history.data.forEach(function(entry){
      auditTarget.appendChild(el('<p class="inline-note">'+esc(new Date(entry.created_at).toLocaleString())+
        " · "+esc(entry.tool)+" · "+esc(entry.token_name||"token")+"</p>"));
    });
  }

  /* Patch the existing UI rather than redesigning it. */
  var oldCalMenu=openCalMenu;
  openCalMenu=function(anchor,cal,row){
    var answer=oldCalMenu.apply(this,arguments);
    if(!cal||cal.subscribed||cal.builtin||!openMenuEl)return answer;
    var menu=openMenuEl;
    var divider=menu.querySelector(".menu-sep");
    function menuItem(label,iconName,fn){
      var btn=el('<button class="menu-item">'+icon(iconName,16)+'<span>'+esc(label)+'</span></button>');
      btn.addEventListener("click",function(){closeMenu();fn();});
      if(divider)menu.insertBefore(btn,divider);else menu.appendChild(btn);
    }
    menuItem("Share calendar","share",function(){openShare(cal);});
    menuItem("Export .ics","download",function(){exportICS(cal);});
    return answer;
  };
  var oldMini=renderMiniCal;
  renderMiniCal=function(){
    var node=oldMini.apply(this,arguments);
    node.querySelectorAll(".mini-day.edge-month .num").forEach(function(n){n.textContent="1";});
    return node;
  };
  var oldPopover=openPopover;
  openPopover=function(occ,anchor){
    var answer=oldPopover.apply(this,arguments);
    if(occ&&occ.ev&&occ.ev.remoteSubscription&&popEl){
      var target=popEl.querySelector(".pop-rows, .pop-body");
      if(target&&!target.querySelector("[data-source-feed]"))
        target.appendChild(el('<p data-source-feed style="font-size:12px;color:var(--muted);padding:8px 0 0">Subscribed from '+
          esc(occ.ev.sourceName||"external calendar")+
          (occ.ev.sourceTimezone?" · "+esc(occ.ev.sourceTimezone):"")+'</p>'));
    }
    return answer;
  };
  var originalPaneData=paneData;
  paneData=function(pane,close){originalPaneData(pane,close);replaceFeedPanel(pane);};
  window.DaylightExtras={openShare:openShare,exportICS:exportICS,paneAI:paneAI,refreshSubscriptions:loadSubscriptions};
  document.addEventListener("daylight:workspace-ready",function(){loadSubscriptions(true);});
  if(signedIn())loadSubscriptions(true);
})();
