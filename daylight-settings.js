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
    "sidebarRail", "view", "prevView"
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
      return Object.assign({}, t, { due: t.due.toISOString() });
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
      return Object.assign({}, t, { due: new Date(t.due) });
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
      ".settings-savebar:not([hidden]){animation:settingsBarIn 190ms cubic-bezier(0.23,1,0.32,1)}",
      "@keyframes settingsBarIn{from{opacity:0;transform:translate(-50%,8px) scale(.97)}to{opacity:1;transform:translate(-50%,0) scale(1)}}",
      "@media(prefers-reduced-motion:reduce){.settings-savebar{animation:none!important}}",
      ".settings-savebar .savebar-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}",
      ".settings-savebar button{border:0;border-radius:999px;font:inherit;padding:8px 13px;white-space:nowrap;cursor:pointer}",
      ".settings-savebar button[data-discard]{color:var(--muted);background:var(--gray-2)}",
      ".settings-savebar button[data-save]{color:var(--on-accent);background:var(--accent)}",
      ".settings-savebar button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
      "@media(max-width:640px){.settings-savebar{left:12px;right:12px;bottom:12px;transform:none;max-width:none;width:auto;border-radius:18px;padding:10px 11px;gap:8px;justify-content:space-between}.settings-savebar .savebar-message{font-size:11.5px;line-height:1.2}.settings-savebar button{padding:8px 10px}}"
    ].join("\n");
    document.head.appendChild(css);
  }
  makeStyle();

  openSettings = function (section) {
    if (settingsState.transactionActive) return;
    closeMenu(); closePopover();
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
      if (isDirty()) {
        bar.hidden = false;
        toast("Save or discard your changes before leaving Settings.");
        return;
      }
      finish(false);
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
const logo="/daylight/assets/chatgpt-logo-white.svg";
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
   // Audit payloads may be technical. Only include safe display names.
   const name=sub.split(" · ").slice(1,-1).join(" · ").trim();
   const safe=/^[\p{L}\p{N}][\p{L}\p{N} ,.!?'()&:—-]{0,100}$/u.test(name)&&!/(?:[0-9a-f]{8}-){3}[0-9a-f-]+|\b(?:id|table|column|payload|json)\b/i.test(name)?name:"";
   const status=/error|fail/i.test(head)?"Failed":"Success";
   row.setAttribute("data-humanized","true");
   row.classList.add("dl-ai-audit-row");
   row.textContent="";
   const img=document.createElement("img");img.src=logo;img.alt="";
   const who=document.createElement("strong");who.textContent="ChatGPT";
   const summary=document.createElement("span");summary.className="dl-ai-action";summary.textContent=action+(safe?" — "+safe:"");
   const result=document.createElement("span");result.className="dl-ai-status";result.textContent=status;
   row.append(img,who,summary,result);
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
     if(advanced)advanced.remove();
     const title=wrapper.querySelector("#mcpAudit")?.closest(".set-group");
     if(title&&title.nextElementSibling)title.parentElement.append(title);
     humanAudit(wrapper.querySelector("#mcpAudit"));
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
 document.querySelectorAll('[title="Help center"],[aria-label="Help center"]').forEach(el=>el.remove());
}
new MutationObserver(()=>{
 if(queued)return;queued=true;requestAnimationFrame(tidy);
}).observe(document.body,{subtree:true,childList:true});
document.addEventListener("daylight:workspace-ready",tidy);
tidy();
})();
