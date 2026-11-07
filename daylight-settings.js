/* Daylight settings transaction.
 * User changes are previewed locally, but are not committed to Supabase
 * until Save is pressed. Discard restores the complete pre-edit workspace.
 */
(function () {
  "use strict";
  settingsState.transactionActive = false;
  settingsState.markDirty = null;
  var savedFields = [
    "weekStart", "timeFormat", "dateFormat", "defaultDuration", "defaultCalendarId",
    "defaultReminder", "density", "showWeekends", "weekNumbers", "showDeclined",
    "tzLabel", "notifSound", "quietEnabled", "quietStart", "quietEnd", "summaryTime",
    "workDays", "workStart", "workEnd", "useDeviceTz", "themeMode",
    "firstName", "profileName", "reduceMotion", "remind15", "dailySummary",
    "sidebarRail"
    /* "view"/"prevView" are deliberately NOT transactional (11.6):
       the Default Calendar View applies the moment it is picked —
       exactly what its pane copy says — so it is never held hostage
       by Save/Discard and X never asks about it. */
  ];

  function snapshot() {
    var result = {};
    savedFields.forEach(function (k) {
      result[k] = Array.isArray(state[k]) ? state[k].slice() : state[k];
    });
    result.feeds = state.feeds.map(function (f) { return Object.assign({}, f); });
    result.calendars = state.calendars.map(function (c) { return Object.assign({}, c); });
    result.events = state.events.map(function (e) {
      return Object.assign({}, e, {
        start: e.start.toISOString(), end: e.end.toISOString()
      });
    });
    result.tasks = state.tasks.map(function (t) {
      return Object.assign({}, t, { due: t.due ? t.due.toISOString() : null });
    });
    return result;
  }

  function restore(s) {
    savedFields.forEach(function (k) {
      state[k] = Array.isArray(s[k]) ? s[k].slice() : s[k];
    });
    state.feeds = s.feeds.map(function (f) { return Object.assign({}, f); });
    state.calendars = s.calendars.map(function (c) { return Object.assign({}, c); });
    state.events = s.events.map(function (e) {
      return Object.assign({}, e, { start: new Date(e.start), end: new Date(e.end) });
    });
    state.tasks = s.tasks.map(function (t) {
      return Object.assign({}, t, { due: t.due ? new Date(t.due) : null });
    });
    applyTheme();
    document.body.classList.toggle("density-compact", state.density === "compact");
    document.body.classList.toggle("reduce-motion", !!state.reduceMotion);
  }

  function makeStyle() {
    var css = document.createElement("style");
    css.textContent = [
      ".settings-dialog{position:relative}",
      ".settings-pane{padding-bottom:104px}",
      ".settings-savebar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:12;display:flex;align-items:center;gap:14px;max-width:calc(100% - 30px);width:max-content;padding:7px 8px 7px 18px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);box-shadow:var(--shadow-pop);font-size:12.5px;font-weight:500}",
      ".settings-savebar[hidden]{display:none!important}",
      ".settings-savebar:not([hidden]){animation:settingsPillIn 190ms cubic-bezier(0.23,1,0.32,1)}",
      "@keyframes settingsPillIn{from{opacity:0;transform:translate(-50%,5px)}to{opacity:1;transform:translate(-50%,0)}}",
      ".settings-savebar .savebar-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:auto}",
      ".settings-savebar button{border:0;border-radius:999px;font:inherit;padding:8px 13px;white-space:nowrap;cursor:pointer}",
      ".settings-savebar button[data-discard]{color:var(--muted);background:var(--gray-2)}",
      ".settings-savebar button[data-save]{color:var(--on-accent);background:var(--accent)}",
      ".settings-savebar button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
      "@media(max-width:640px){.settings-savebar{left:12px;right:12px;bottom:12px;transform:none;max-width:none;width:auto;border-radius:18px;padding:10px 11px;gap:8px;justify-content:space-between}.settings-savebar .savebar-message{font-size:11.5px;line-height:1.2}.settings-savebar button{padding:8px 10px}}",
      "@media(prefers-reduced-motion:reduce){.settings-savebar{animation:none!important}}"
    ].join("\\n");
    document.head.appendChild(css);
  }
  makeStyle();

  openSettings = function (section) {
    if (settingsState.transactionActive) return;
    closeMenu(); closePopover();
    /* Settings reopens on the last-used pane (11.18): an explicit
       argument wins; otherwise the pane remembered from last time
       (localStorage, then this session's state). */
    if (!section) {
      try { section = localStorage.getItem("dl-settings-section") || null; } catch (e) {}
    }
    settingsState.section = (section === "data" ? "calendar" : section) || (settingsState.section === "data" ? "calendar" : settingsState.section) || "general";
    settingsState.pendingView = state.view;
    settingsState.transactionActive = true;
    var original = snapshot();
    var originalJSON = JSON.stringify(original);
    var bd = el('<div class="backdrop"></div>');
    var dlg = el('<div class="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings"></div>');
    var rail = el('<div class="settings-rail"><div class="sr-title">Settings</div></div>');
    var pane = el('<div class="settings-pane"></div>');
    var bar = el('<div class="settings-savebar" role="status" aria-live="polite" hidden>' +
      '<span class="savebar-message">You have unsaved changes</span>' +
      '<span class="savebar-actions"><button type="button" data-discard>Discard</button>' +
      '<button type="button" data-save>Save changes</button></span></div>');

    function isDirty() { return JSON.stringify(snapshot()) !== originalJSON; }
    function markDirty() {
      if (!settingsState.transactionActive || !bd.isConnected) return;
      const dirty=isDirty();
      bar.hidden=!dirty;
      bar.setAttribute("aria-hidden",String(!dirty));
    }
    settingsState.markDirty = markDirty;

    function finish(save) {
      if (!settingsState.transactionActive) return;
      if (!save) restore(original);
      settingsState.transactionActive = false;
      settingsState.markDirty = null;
      settingsState.viewSelect = null;
      settingsState.redrawPane = null;
      if(window.daylightExit)window.daylightExit(bd);else bd.remove();
      renderAll(false);
      if (save) {
        document.dispatchEvent(new CustomEvent("daylight:settings-committed", {
          detail: { previousName: original.profileName, name: state.profileName }
        }));
      }
    }
    function close() {
      var focused = document.activeElement;
      if (focused && dlg.contains(focused) && focused.tagName === "INPUT") focused.blur();
      markDirty();
      if (!isDirty()) { finish(false); return; }
      // One confirm, not a toast or a second save bar.
      if (document.getElementById("dlSettingsDiscardConfirm")) return;
      var confirm = el('<div class="backdrop" id="dlSettingsDiscardConfirm"><div class="dialog" role="alertdialog" aria-modal="true" aria-label="Discard changes?" style="width:min(400px,92vw)"><div class="dialog-head"><span class="dialog-title">Discard changes?</span></div><div class="dialog-body"><p>Unsaved settings changes will be lost.</p></div><div class="dialog-foot"><button type="button" class="btn-ghost" data-keep>Keep editing</button><button type="button" class="btn-primary" data-confirm-discard>Discard changes</button></div></div></div>');
      overlayRoot.appendChild(confirm);
      var dismiss = function(){ if(window.daylightExit)window.daylightExit(confirm);else confirm.remove(); };
      confirm.querySelector("[data-keep]").addEventListener("click",dismiss);
      confirm.querySelector("[data-confirm-discard]").addEventListener("click",function(){ dismiss();finish(false); });
      confirm.addEventListener("mousedown",function(e){if(e.target===confirm)dismiss();});
      confirm.querySelector("[data-keep]").focus();
    }

    [
      ["general", "sliders", "General"],
      ["appearance", "droplet", "Appearance"],
      ["calendar", "calendar", "Calendar"],
      ["notifications", "bell", "Notifications"],
      ["shortcuts", "keyboard", "Shortcuts"],
      ["ai", "settings", "AI access"],
      ["about", "info", "About"]
    ].forEach(function (s) {
      var btn = el('<button class="sr-item' + (settingsState.section === s[0] ? " active" : "") + '">' +
        icon(s[1], 17) + "<span>" + s[2] + "</span></button>");
      btn.addEventListener("click", function () {
        settingsState.section = s[0];
        try { localStorage.setItem("dl-settings-section", s[0]); } catch (e) {}
        rail.querySelectorAll(".sr-item").forEach(function (x) { x.classList.remove("active"); });
        btn.classList.add("active");
        drawPane();
        markDirty();
      });
      rail.appendChild(btn);
    });
    dlg.appendChild(rail); dlg.appendChild(pane); dlg.appendChild(bar);
    bd.appendChild(dlg);
    overlayRoot.appendChild(bd);

    bar.querySelector("[data-save]").addEventListener("click", function () { finish(true); });
    bar.querySelector("[data-discard]").addEventListener("click", function () { finish(false); });
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    ["input", "change", "click"].forEach(function (eventType) {
      dlg.addEventListener(eventType, function () { setTimeout(markDirty, 0); });
    });

    function drawPane() {
      settingsState.redrawPane = drawPane;
      pane.innerHTML = "";
      var x = el('<button class="icon-btn settings-close" title="Close settings">' + icon("x", 17) + "</button>");
      x.addEventListener("click", close);
      pane.appendChild(x);
      var fn = {
        general: paneGeneral, appearance: paneAppearance, calendar: paneCalendar,
        notifications: paneNotifications, shortcuts: paneShortcuts,
        ai: window.daylightAiPane, about: paneAbout
      }[settingsState.section];
      fn(pane, close);
      bindDropdowns(pane);
      pane.querySelectorAll('label.switch input[type="checkbox"]').forEach(function (input) {
        if (input.getAttribute("aria-label")) return;
        var row = input.closest(".switch-row");
        var label = row && row.querySelector(".sw-label");
        if (label) input.setAttribute("aria-label", label.textContent.trim());
      });
      pane.classList.remove("pane-in");
      void pane.offsetWidth;
      pane.classList.add("pane-in");
    }
    drawPane();
  };

  var originalAppearance = paneAppearance;
  paneAppearance = function (pane) {
    originalAppearance(pane);
    var intro = pane.querySelector(".pane-sub");
    if (intro && intro.textContent.indexOf("no Save button") !== -1)
      intro.textContent = "Preview changes immediately. Use Save or Discard before leaving Settings.";
  };
})();


/* Presentation-only finish: no OAuth, MCP, grant, or authentication handlers touched. */
(function(){
"use strict";
const logo=new URL("assets/chatgpt-logo-white.svg",document.querySelector('script[src*="daylight-settings.js"]')?.src||document.baseURI).href;
const style=document.createElement("style");
style.textContent=`
.dl-chatgpt-logo{object-fit:contain!important;background:#17191b!important;padding:8px!important;border-radius:12px}
#dl-oauth-client-logo img[src*="chatgpt-logo-white"]{object-fit:contain!important;padding:10px}
.dl-ai-advanced{display:none!important}
.dl-ai-wrap .set-group{margin-bottom:18px}
.dl-ai-audit-row{display:flex!important;align-items:center;gap:8px;min-height:33px;font-size:12px!important;color:var(--text)!important}
.dl-ai-audit-row img{width:16px;height:16px;flex:none;background:#17191b;border-radius:4px;padding:2px}
.dl-ai-audit-row strong,.dl-ai-audit-row span{font-size:12px!important}
.dl-ai-audit-row .dl-ai-action{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.dl-ai-audit-row .dl-ai-status{font-size:11px!important;color:var(--muted)}
.settings-dialog .field input:not([type="checkbox"]),.settings-dialog .field select{max-width:100%;width:100%}
.settings-dialog .settings-pane{overflow:auto;scrollbar-color:var(--line) transparent;scrollbar-width:thin}
.settings-dialog .settings-pane::-webkit-scrollbar{width:6px}
.settings-dialog .settings-pane::-webkit-scrollbar-thumb{background:var(--line);border-radius:5px}
.settings-dialog .set-row{max-width:100%}
.day-num{cursor:pointer}
.day-num:hover{background:var(--gray-2);border-radius:6px}
@media(prefers-reduced-motion:reduce){.dl-ai-audit-row,.dl-chatgpt-logo{transition:none!important}}
`;
document.head.append(style);
function phrase(raw){
 const t=String(raw||"").toLowerCase();
 if(/complete.*task|task.*complet/.test(t))return "Completed a task";
 if(/creat.*calendar|calendar.*creat/.test(t))return "Created a calendar";
 if(/edit.*calendar|updat.*calendar/.test(t))return "Edited a calendar";
 if(/delet.*calendar|remov.*calendar/.test(t))return "Deleted a calendar";
 if(/creat.*event|event.*creat/.test(t))return "Created an event";
 if(/updat.*event|edit.*event/.test(t))return "Edited an event";
 if(/delet.*event|remov.*event/.test(t))return "Deleted an event";
 if(/creat.*task/.test(t))return "Created a task";
 if(/edit.*task|updat.*task/.test(t))return "Edited a task";
 if(/delet.*task/.test(t))return "Deleted a task";
 if(/list|search|read|get_/.test(t))return "Viewed calendar information";
 return "Used calendar access";
}
function humanAudit(history){
 if(!history)return;
 history.querySelectorAll(".feed-row:not([data-humanized])").forEach(row=>{
   const text=row.innerText||row.textContent||"";
   const head=text.split("\n")[0]||"";
   const raw=head.split("·");
   const action=phrase(raw.join(" "));
   const sub=row.querySelector(".fr-sub")?.textContent||"";
   const subParts=sub.split(" · ");
   /* The last sub segment is the entry's timestamp (11.15) — keep
      it as a muted time instead of dropping it, so identical-looking
      rows are distinguishable. */
   let timeLabel="";
   if(subParts.length>=3){
     const parsed=new Date(subParts[subParts.length-1].trim());
     if(!Number.isNaN(+parsed)) timeLabel=parsed.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
   }
   // Audit payloads may be technical. Only include safe display names.
   const rawName=(timeLabel?subParts.slice(1,-1):subParts.slice(1)).join(" · ").trim();
   const namedEvent=state?.events?.find(e=>String(e.id)===rawName||String(e.uid)===rawName);
   const namedCalendar=state?.calendars?.find(c=>String(c.id)===rawName);
   const namedTask=state?.tasks?.find(t=>String(t.id)===rawName);
   const name=namedEvent?.title||namedCalendar?.name||namedTask?.title||rawName;
   const safe=/^[\p{L}\p{N}][\p{L}\p{N} ,.!?'()&:—-]{0,100}$/u.test(name)&&!/(?:[0-9a-f]{8}-){3}[0-9a-f-]+|^\d+$|\b(?:id|table|column|payload|json)\b/i.test(name)?name:"";
   const eventAction=/\bevent\b/i.test(action);
   const eventCalendar=namedEvent?state?.calendars?.find(c=>String(c.id)===String(namedEvent.cal)):namedCalendar;
   const eventTitle=namedEvent?.title||(!namedCalendar&&!namedTask?safe:"");
   const displayDetail=eventAction
     ? (eventTitle||"Event")+(eventCalendar?" · "+eventCalendar.name:"")
     : (namedTask?.title||namedCalendar?.name||safe||"");
   const status=/error|fail/i.test(head)?"Failed":"Success";
   row.setAttribute("data-humanized","true");
   row.classList.add("dl-ai-audit-row");
   row.textContent="";
   const img=document.createElement("img");img.src=logo;img.alt="";
   const who=document.createElement("strong");who.textContent="ChatGPT";
   const summary=document.createElement("span");summary.className="dl-ai-action";summary.textContent=action+(eventAction?" — "+displayDetail:(displayDetail?" — "+displayDetail:""));
   const result=document.createElement("span");result.className="dl-ai-status";result.textContent=status;
   if(timeLabel){
     const when=document.createElement("span");when.className="dl-ai-status";when.textContent=timeLabel;
     row.append(img,who,summary,when,result);
   } else row.append(img,who,summary,result);
 });
}
let queued=false;
function tidy(){
 queued=false;
 const pane=document.querySelector(".settings-dialog .settings-pane");
 if(pane){
   const wrapper=pane.querySelector(".dl-ai-wrap");
   if(wrapper){
     const img=wrapper.querySelector(".dl-chatgpt-logo");
     if(img&&img.getAttribute("src")!==logo)img.setAttribute("src",logo);
     const advanced=wrapper.querySelector(".dl-ai-advanced");
     if(advanced){advanced.hidden=true;advanced.style.display="none";}
     const title=wrapper.querySelector("#mcpAudit")?.closest(".set-group");
     if(title&&title.nextElementSibling)title.parentElement.append(title);
     const history=wrapper.querySelector("#mcpAudit");
     humanAudit(history);
     if(history){
       history.querySelectorAll(".feed-row").forEach((entry,i)=>{if(i>=5)entry.remove();});
       history.querySelectorAll("button").forEach(button=>{if(/show more/i.test(button.textContent))button.remove();});
       if(/No AI actions recorded yet/i.test(history.textContent||""))history.textContent="No AI activity yet";
     }
     wrapper.querySelectorAll(".dl-connected-item").forEach(row=>{
       if(/chatgpt/i.test(row.querySelector("strong")?.textContent||"")){
         row.querySelector(".dl-row button")?.remove();
       }
     });
   }
 }
 const consent=document.querySelector("#daylightOAuthConsent");
 if(consent&&/chatgpt/i.test(consent.querySelector("#dl-oauth-heading")?.textContent||"")){
   const tile=consent.querySelector("#dl-oauth-client-logo");
   if(tile && !tile.querySelector('img[src*="chatgpt-logo-white"]')){
     const img=document.createElement("img");img.src=logo;img.alt="ChatGPT logo";
     tile.replaceChildren(img);
   }
 }
 document.querySelectorAll('button,a,[role="menuitem"]').forEach(el=>{
   const label=(el.getAttribute("aria-label")||el.getAttribute("title")||el.textContent||"").trim();
   if(/^help\s*center$/i.test(label)||/^open help center$/i.test(label))el.remove();
 });
}
new MutationObserver(()=>{
 if(queued)return;queued=true;requestAnimationFrame(tidy);
}).observe(document.body,{subtree:true,childList:true});
document.addEventListener("daylight:workspace-ready",tidy);
tidy();
})();
