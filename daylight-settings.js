/* Daylight settings transaction.
 * User changes are previewed locally, but are not committed to Supabase
 * until Save is pressed. Discard restores the complete pre-edit workspace.
 */
(function () {
  "use strict";
  settingsState.transactionActive = false;
  settingsState.markDirty = null;
  settingsState.beforeCommit = null;
  settingsState.onDiscard = null;
  settingsState.pendingAvatar = null;
  var savedFields = [
    "weekStart", "timeFormat", "dateFormat", "defaultDuration", "defaultCalendarId",
    "defaultReminder", "density", "showWeekends", "weekNumbers", "showDeclined",
    "tzLabel", "notifSound", "quietEnabled", "quietStart", "quietEnd", "summaryTime",
    "workDays", "workStart", "workEnd", "useDeviceTz", "themeMode",
    "firstName", "profileName", "reduceMotion", "remind15", "dailySummary",
    "sidebarRail", "avatarUrl", "birthday", "customColors", "defaultView", "view"
    /* "view"/"prevView" are deliberately NOT transactional (11.6):
       the Default Calendar View applies the moment it is picked —
       exactly what its pane copy says — so it is never held hostage
       by Save/Discard and X never asks about it. */
  ];

  /* First name = the display name up to the first space. A dash does not split it ("Mary-Kate Lee" gives "Mary-Kate"). */
  function firstNameOf(name) {
    var t = String(name || "").trim();
    var m = /^\S+/.exec(t);
    return m ? m[0] : "";
  }
  /* Birthday events: one all-day event PER YEAR, titled "<FirstName>'s <Ordinal> Birthday" (age = that year - birth year), on the
     account's own default calendar. Each year keeps its own age (2026 stays "12th" once 2027's "13th" exists). The set is created
     when a birthday is set, moved when the date changes, renamed when the first name changes, removed when the birthday is
     cleared, and topped up on load so the window always reaches ten years ahead. Past years from the year after birth are kept. */
  function ordinal(n) {
    var m100 = n % 100, m10 = n % 10;
    var suffix = (m100 >= 11 && m100 <= 13) ? "th" : m10 === 1 ? "st" : m10 === 2 ? "nd" : m10 === 3 ? "rd" : "th";
    return n + suffix;
  }
  window.daylightOrdinal = ordinal;
  window.daylightSyncBirthday = function () {
    var existing = state.events.filter(function (e) { return e.birthday; });
    if (!state.birthday) {
      if (existing.length) { state.events = state.events.filter(function (e) { return !e.birthday; }); return true; }
      return false;
    }
    var p = state.birthday.split("-").map(Number);
    var birthYear = p[0], thisYear = new Date().getFullYear();
    var first = firstNameOf(state.profileName) || "My";
    var firstYear = Math.max(birthYear + 1, thisYear + 10 - 99);   // never more than 100 yearly events
    var owned = function (c) { return c && !c.subscribed && !c.builtin && !c.remoteShareId; };
    var anchor = existing[0] && state.calendars.filter(function (c) { return c.id === existing[0].cal && owned(c); })[0];
    var cal = anchor || (state.calendars.filter(function (c) { return c.id === state.defaultCalendarId && owned(c); })[0]) || state.calendars.filter(owned)[0];
    if (!cal) return false;
    var byYear = {}, changed = false, keepSet = [];
    existing.forEach(function (e) {
      var y = e.start instanceof Date ? e.start.getFullYear() : NaN;
      if (e.repeat || !(y >= firstYear) || byYear[y]) { changed = true; return; }   // legacy repeating event, duplicate, or out of range: rebuilt below
      byYear[y] = e; keepSet.push(e);
    });
    for (var year = firstYear; year <= thisYear + 10; year++) {
      var day = p[2];
      if (p[1] === 2 && day === 29 && new Date(year, 1, 29).getMonth() !== 1) day = 28;   // a leap-day birthday shows on Feb 28 in other years
      var start = new Date(year, p[1] - 1, day), end = new Date(year, p[1] - 1, day, 23, 59);
      var title = (first === "My" ? "My " : first + "'s ") + ordinal(year - birthYear) + " Birthday";
      var ev = byYear[year];
      if (ev) {
        if (ev.title !== title || +ev.start !== +start || +ev.end !== +end || ev.cal !== cal.id) { ev.title = title; ev.start = start; ev.end = end; ev.cal = cal.id; changed = true; }
        ev.allDay = true; ev.repeat = null; ev.repeatEnd = null;
      } else {
        keepSet.push({ id: ++uid, title: title, cal: cal.id, start: start, end: end, allDay: true, loc: "", desc: "", repeat: null, repeatEnd: null, reminder: null, uid: "daylight-birthday-" + year, birthday: true });
        changed = true;
      }
    }
    if (changed) state.events = state.events.filter(function (e) { return !e.birthday; }).concat(keepSet);
    return changed;
  };

  function snapshot() {
    var result = {};
    savedFields.forEach(function (k) {
      result[k] = Array.isArray(state[k]) ? state[k].slice() : state[k];
    });
    return result;
  }

  function restore(s) {
    savedFields.forEach(function (k) {
      state[k] = Array.isArray(s[k]) ? s[k].slice() : s[k];
    });
    applyTheme();
    document.body.classList.toggle("density-compact", state.density === "compact");
    document.body.classList.toggle("reduce-motion", !!state.reduceMotion);
  }

  function makeStyle() {
    var css = document.createElement("style");
    css.textContent = [
      ".settings-dialog{position:relative;overflow:hidden;border-radius:var(--r-xl)}",
      ".settings-pane{position:relative;isolation:isolate;padding-bottom:44px;overflow-y:auto;min-height:0}",
      /* While the save pill shows, the scrolling area ends above it, so the pill never sits on a label, description or control. */
      /* Fix 25: the pane keeps its full height; the strip the pill covers is blurred (bounded, soft edge) and fades in and out with the pill. */
      ".settings-dialog::after{content:\"\";position:absolute;left:236px;right:0;bottom:0;height:96px;z-index:11;pointer-events:none;opacity:0;transition:opacity 190ms cubic-bezier(0.23,1,0.32,1);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);background:linear-gradient(to top,color-mix(in srgb,var(--surface) 60%,transparent),transparent);-webkit-mask-image:linear-gradient(to top,#000 0,#000 52%,transparent 100%);mask-image:linear-gradient(to top,#000 0,#000 52%,transparent 100%)}",
      "[data-theme=\"light\"] .settings-dialog::after{background:linear-gradient(to top,color-mix(in srgb,var(--gray-2) 60%,transparent),transparent)}",
      ".settings-dialog:has(.settings-savebar:not([hidden]))::after{opacity:1}",
      ".settings-dialog:has(.settings-savebar.is-dismissing)::after{opacity:0;transition-duration:180ms;transition-timing-function:ease-in}",
      "body.reduce-motion .settings-dialog::after{transition:none!important}@media (prefers-reduced-motion:reduce){.settings-dialog::after{transition:none!important}}",
      ".settings-savebar{position:absolute;left:calc(50% + 100px);right:auto;bottom:14px;transform:translateX(-50%);z-index:12;display:flex;align-items:center;gap:14px;max-width:calc(100% - 30px);width:max-content;padding:7px 8px 7px 18px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);box-shadow:var(--shadow-pop);font-size:12.5px;font-weight:500}",
      ".settings-savebar{background:var(--surface)!important;border:1px solid var(--line)!important;box-shadow:var(--shadow-pop)!important;isolation:isolate}",
      ".settings-savebar[hidden]{display:none!important}",
      ".settings-savebar:not([hidden]){animation:settingsPillIn 190ms cubic-bezier(0.23,1,0.32,1)}",
      "@keyframes settingsPillIn{from{opacity:0;transform:translate(-50%,5px)}to{opacity:1;transform:translate(-50%,0)}}",
      ".settings-savebar .savebar-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:auto}",
      ".settings-savebar button{border:0;border-radius:999px;font:inherit;padding:8px 13px;white-space:nowrap;cursor:pointer}",
      ".settings-savebar button[data-discard]{color:var(--muted);background:var(--gray-2)}",
      ".settings-savebar button[data-save]{color:var(--on-accent);background:var(--accent)}",
      ".settings-savebar button[data-save]{display:inline-flex;align-items:center;gap:6px}.settings-savebar button[data-save] .save-check{display:none;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30;opacity:0}",
      ".settings-savebar.is-saved button[data-save]{background:#218838!important;color:#fff!important}",
      ".settings-savebar.is-saved button[data-save] .save-check{display:block;opacity:1;animation:settingsCheckDraw 260ms ease forwards}",
      "@keyframes settingsCheckDraw{to{stroke-dashoffset:0}}",
      ".settings-savebar.is-dismissing{animation:settingsPillOut 180ms ease-in forwards}",
      "@keyframes settingsPillOut{to{opacity:0;transform:translate(-50%,7px) scale(.97)}}",
      ".settings-saving .settings-pane,.settings-saving .settings-rail{pointer-events:none}",
      ".settings-saving .settings-pane{opacity:.82}",
      ".settings-dialog>.settings-close,.dl-calsettings>.settings-close{position:absolute;z-index:40;right:12px;top:12px;width:44px;height:44px;min-width:44px;min-height:44px;padding:0;margin:0;display:grid;place-items:center;border:0;border-radius:0;background:transparent!important;color:var(--muted);cursor:pointer;pointer-events:auto;isolation:isolate}.settings-dialog>.settings-close::before,.dl-calsettings>.settings-close::before{content:\"\";position:absolute;inset:3px;border-radius:12px;background:transparent;transition:background 120ms;z-index:-1;pointer-events:none}.settings-dialog>.settings-close:hover,.dl-calsettings>.settings-close:hover{color:var(--text)}.settings-dialog>.settings-close:hover::before,.dl-calsettings>.settings-close:hover::before{background:var(--hover)}.settings-dialog>.settings-close:active::before,.dl-calsettings>.settings-close:active::before{background:var(--selected)}.settings-dialog>.settings-close svg{pointer-events:none}.settings-pane h2,.settings-pane>.pane-sub{padding-right:48px}",
      "",
      /* ONE rhythm for the Profile cards: 36px icon tiles, 14px row padding, the same gap under every card title as the other panes,
         and the "Sign out all other sessions" link on the card text edge. */
      ".settings-pane .dl-sec-row,.settings-pane .dl-session-row{padding:14px 0;gap:14px}",
      /* ONE label column rule: subtitles use the whole label column (no 430px cap, a slimmer gap before the control), so one-line subtitles
         stay on one line at dialog width */
      ".settings-pane .switch-row .sw-sub{max-width:none}",
      ".settings-pane .set-row>span:first-child{padding-right:12px}",
      ".settings-pane .set-row .dd{width:auto!important;min-width:118px;max-width:230px}",
      ".settings-pane .dl-row-stack{flex-direction:column;align-items:flex-start!important;gap:10px}.settings-pane .dl-row-stack>span:first-child{padding-right:0}",
      /* the floating Save pill never covers a control: the pane keeps room under its content while the pill shows; Saved shows no Discard */
      ".settings-dialog .settings-pane{padding-bottom:104px}",
      /* Fix 26: the close X belongs to the dialog frame (not the scrolling pane); it has its own backing and the pane leaves it room */
      ".settings-dialog>.settings-close{top:12px!important;right:12px!important;width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;border-radius:0!important;background:var(--surface)!important;z-index:30!important}",
      "[data-theme=\"light\"] .settings-dialog>.settings-close{background:var(--gray-2)!important}",
      ".settings-dialog>.settings-close::before{inset:0!important;border-radius:10px!important}",
      ".settings-savebar.is-saved [data-discard]{display:none}",
      /* Shortcuts rows use the same divider as every other pane */
      ".settings-pane .shortcut-row{border-bottom:1px solid var(--line-soft)!important}.settings-pane .shortcut-row:last-child{border-bottom:0!important}",
      ".settings-pane .dl-sec-row.is-main:first-of-type,.settings-pane .dl-sec-list .dl-sec-row:first-child{padding-top:14px}",
      ".settings-pane .dl-sec-group .dl-sec-row:last-child,.settings-pane .dl-session-row:last-child{padding-bottom:10px}",
      ".settings-pane .dl-sec-tile,.settings-pane .dl-session-device-icon{width:36px;height:36px;border-radius:10px}",
      ".settings-pane .dl-sec-group>.dl-sec-hint{margin:-2px 0 4px}",
      ".settings-pane .dl-session-signout{width:auto;height:32px;padding:0 13px;border-radius:999px;color:var(--text);display:inline-flex;align-items:center}.settings-pane .dl-session-signout:hover{background:var(--hover)}",
      ".settings-pane .dl-session-all{display:flex;gap:14px;align-items:center;padding:14px 0 10px;border-top:1px solid var(--line-soft)}.settings-pane .dl-session-all:has([data-signout-others][hidden]){display:none}",
      /* locked (read-only) fields: quiet, no hover or focus affordance, anywhere */
      ".dl-idf-lock{background:transparent!important;border:1px solid var(--line-soft);color:var(--faint)!important;cursor:default}.dl-idf-lock span{color:var(--muted)!important}.dl-idf-lock:hover{background:transparent!important}",
      "input:disabled:not([type=checkbox]):not([type=radio]),input[readonly],textarea:disabled{background:transparent!important;border:1px solid var(--line-soft)!important;color:var(--muted)!important;cursor:default;box-shadow:none!important;opacity:1}input:disabled:not([type=checkbox]):hover,input[readonly]:hover{background:transparent!important}",
      ".dl-birthday-ctl{display:inline-flex;align-items:center;gap:8px;flex:none}.dl-birthday-input{width:auto;min-width:150px;height:38px}.dl-birthday-ctl .btn-ghost[hidden]{display:none}",
    ".dl-identity-grid{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1.15fr);gap:14px;align-items:end;padding:4px 0 12px}.dl-idf{display:flex;flex-direction:column;gap:6px;min-width:0}.dl-idf-key{font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}.dl-idf-input{height:40px;border:1px solid transparent;border-radius:10px;background:var(--input-bg);padding:0 12px;font:inherit;font-size:13.5px;color:var(--text);outline:none;min-width:0;width:100%;transition:background 120ms,border-color 120ms,box-shadow 120ms}.dl-idf-input:hover{background:var(--hover)}.dl-idf-input:focus{border-color:color-mix(in srgb,var(--accent) 55%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 14%,transparent)}.dl-idf-lock{height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;background:var(--input-bg);color:var(--muted);font-size:13px;min-width:0}.dl-idf-lock .ic{flex:none}.dl-idf-lock span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}.dl-profile-photo{flex:none}.dl-profile-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--text);color:var(--bg);font-size:14px;font-weight:650;letter-spacing:.01em}.dl-sec-row{display:flex;align-items:center;gap:12px;padding:4px 0 8px}.dl-sec-tile{width:36px;height:36px;border-radius:10px;background:var(--hover);display:grid;place-items:center;color:var(--muted);flex:none}.dl-sec-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.dl-sec-text .sw-label{font-size:14px;font-weight:550}.dl-sec-text .sw-sub{font-size:12.5px;color:var(--muted)}.dl-signout-others{padding:2px 4px 14px}.dl-link-danger{color:var(--danger);font-size:13px;font-weight:600;padding:6px 0;cursor:pointer}.dl-link-danger:hover{text-decoration:underline}.dl-link-danger[hidden]{display:none}@media(max-width:560px){.dl-identity-grid{grid-template-columns:auto 1fr}.dl-identity-grid .dl-idf:last-child{grid-column:1/-1}}.dl-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block}.dl-identity-text{min-width:0;flex:1}.dl-identity-name{font-size:17px;font-weight:650;letter-spacing:-.015em;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dl-identity-email{font-size:13px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dl-profile-photo-actions [hidden]{display:none!important}.dl-profile-photo-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.dl-btn-sm{height:32px;padding:0 13px;font-size:12.5px;border-radius:999px;flex:none}.dl-row-input{width:240px;max-width:48%;flex:none}.dl-readonly-value{font-size:13.5px;color:var(--text);font-weight:500;flex:none;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-top:2px}.dl-profile-status{min-height:0;font-size:12px;color:var(--muted);margin:0}.dl-profile-status:not(:empty){margin:4px 0 8px}.dl-profile-status.is-error{color:var(--danger)}.dl-session-list{display:flex;flex-direction:column}.dl-session-row{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line-soft)}.dl-session-row:last-child{border-bottom:0}.dl-session-device-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:var(--hover);color:var(--muted);flex:none}.dl-session-text{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.dl-session-name{font-size:14px;font-weight:550}.dl-session-badge{display:inline-block;vertical-align:1px;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--hover);color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.01em;line-height:16px}.dl-session-signout{width:36px;height:36px;border-radius:8px;display:inline-grid;place-items:center;color:var(--danger);cursor:pointer;transition:background 140ms}.dl-session-signout:hover{background:color-mix(in srgb,var(--danger) 12%,transparent)}.dl-session-signout:focus-visible{outline:2px solid var(--danger);outline-offset:1px}.dl-session-signout:disabled{opacity:.5;cursor:default}.dl-session-meta{font-size:12.5px;color:var(--muted)}.dl-session-actions{flex:none}.dl-session-loading i{display:block;height:9px;width:46%;border-radius:5px;background:var(--hover)}.dl-session-loading i+i{width:28%;margin-top:6px}",
      ".settings-savebar button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
      ".settings-savebar.is-nudge{animation:dlPillNudge 1100ms cubic-bezier(0.23,1,0.32,1) both;border-color:var(--accent)!important}.settings-savebar.is-nudge [data-save]:not(:disabled){animation:dlPillSave 1100ms cubic-bezier(0.23,1,0.32,1) both}@keyframes dlPillNudge{0%{box-shadow:0 0 0 7px color-mix(in srgb,var(--accent) 48%,transparent),0 10px 28px color-mix(in srgb,var(--accent) 30%,transparent)}65%{box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 36%,transparent),0 10px 28px color-mix(in srgb,var(--accent) 22%,transparent)}100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 0%,transparent),0 10px 28px transparent}}@keyframes dlPillSave{0%,55%{filter:brightness(1.22);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 50%,transparent)}100%{filter:none;box-shadow:0 0 0 0 transparent}}body.reduce-motion .settings-savebar.is-nudge,body.reduce-motion .settings-savebar.is-nudge [data-save]{animation:none!important;box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 36%,transparent)}",,
      "@media(max-width:640px){.settings-savebar{left:50%;right:auto;bottom:12px;transform:translateX(-50%);max-width:calc(100% - 24px);width:max-content;border-radius:999px;padding:7px 9px;gap:7px;justify-content:center}.settings-savebar .savebar-message{font-size:11px;line-height:1.2}.settings-savebar button{padding:7px 9px}}",
      /* ONE clean floating pill: a single border, a single background, no outline or leftover box at any point of its in/out motion */
      ".settings-savebar{box-sizing:border-box;outline:none;background-clip:padding-box;-webkit-tap-highlight-color:transparent;will-change:opacity,transform}",
      ".settings-savebar:focus,.settings-savebar:focus-visible{outline:none}",
      ".settings-savebar.is-nudge{animation:none!important}",
      "body.reduce-motion .settings-savebar,body.reduce-motion .settings-savebar.is-dismissing{animation:none!important}",
      "@media(prefers-reduced-motion:reduce){.settings-savebar{animation:none!important}}"
    ].join("\n");
    document.head.appendChild(css);
  }
  makeStyle();

  openSettings = function (section) {
    if (settingsState.transactionActive) return;
    closeMenu(); closePopover();
    if(section==="general"||section==="about")section="profile";
    if(section==="data")section="calendar";
    if(settingsState.section==="general"||settingsState.section==="about")settingsState.section="profile";
    if(settingsState.section==="data")settingsState.section="calendar";
    settingsState.section = section || "profile";
    settingsState.pendingView = state.view;
    settingsState.transactionActive = true;
    settingsState.beforeCommit = null;
    settingsState.onDiscard = null;
    settingsState.pendingAvatar = null;
    var original = snapshot();
    var originalJSON = JSON.stringify(original);
    var bd = el('<div class="backdrop"></div>');
    var dlg = el('<div class="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings"></div>');
    var rail = el('<div class="settings-rail"><div class="sr-title">Settings</div></div>');
    var pane = el('<div class="settings-pane"></div>');
    var bar = el('<div class="settings-savebar" role="status" aria-live="polite" hidden>' +
      '<span class="savebar-message">You have unsaved changes</span>' +
      '<span class="savebar-actions"><button type="button" data-discard>Discard</button>' +
      '<button type="button" data-save><span class="savebar-save-label">Save changes</span><svg class="save-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3.2 3.2L13 4.5"></path></svg></button></span></div>');

    function isDirty() { return JSON.stringify(snapshot()) !== originalJSON; }
    function markDirty() {
      if (bar.classList.contains("is-saved")) return; // let the Save confirmation play out
      if (!settingsState.transactionActive || !bd.isConnected) return;
      const dirty=isDirty();
      if (dirty) {
        /* the moment anything differs from the saved state the pill animates in (cancelling an out-animation in progress) */
        clearTimeout(bar._hideT);
        bar.classList.remove("is-dismissing");
        if (bar.hidden) bar.hidden=false;
        bar.setAttribute("aria-hidden","false");
        bar.querySelector(".savebar-message").textContent="You have unsaved changes";
      } else if (!bar.hidden && !bar.classList.contains("is-dismissing")) {
        /* undone back to the saved state: it animates out again */
        bar.classList.add("is-dismissing");
        bar.setAttribute("aria-hidden","true");
        clearTimeout(bar._hideT);
        bar._hideT=setTimeout(function(){ if(bar.classList.contains("is-dismissing")){ bar.hidden=true; bar.classList.remove("is-dismissing"); } }, 190);
      }
    }
    settingsState.markDirty = markDirty;

    function closeOnEscape(event) {
      if(event.key!=="Escape"||overlayRoot.lastElementChild!==bd)return;
      event.preventDefault();
      close();
    }
    document.addEventListener("keydown",closeOnEscape,true);

    function finish(save) {
      if (!settingsState.transactionActive) return;
      if (!save) {
        if (settingsState.onDiscard) settingsState.onDiscard();
        restore(original);
      }
      settingsState.transactionActive = false;
      settingsState.markDirty = null;
      settingsState.beforeCommit = null;
      settingsState.onDiscard = null;
      settingsState.viewSelect = null;
      settingsState.redrawPane = null;
      document.removeEventListener("keydown",closeOnEscape,true);
      stopWatch();
      if(window.daylightExit)window.daylightExit(bd);else bd.remove();
      renderAll(false);
      if (save) {
        document.dispatchEvent(new CustomEvent("daylight:settings-committed", {
          detail: { previousName: original.profileName, name: state.profileName }
        }));
      }
    }
    /* Briefly highlight the Save / Discard pill (no shake) so a click on X while changes are pending visibly points at it. */
    function nudgePill() { /* the pill is already visible by the time anyone tries to leave; there is no separate highlight state */ }
    function close() {
      var focused = document.activeElement;
      if (focused && dlg.contains(focused) && focused.tagName === "INPUT") focused.blur();
      markDirty();
      /* Unsaved changes: the pill (Save / Discard) is the ONLY gate. Closing from the X, the backdrop or Esc simply does
         nothing while it is showing: no second popup, no animation. */
      if (isDirty()) { nudgePill(); return; }   /* the pill stays the gate, but a click on X points at it */
      finish(false);
    }

    [
      ["profile", "user", "Profile"],
      ["appearance", "droplet", "Appearance"],
      ["calendar", "calendar", "Calendar"],
      ["notifications", "bell", "Notifications"],
      ["ai", "sparkle", "AI access"],
      ["shortcuts", "keyboard", "Shortcuts"]
    ].forEach(function (s) {
      var btn = el('<button class="sr-item' + (settingsState.section === s[0] ? " active" : "") + '">' +
        icon(s[1], 17) + "<span>" + s[2] + "</span></button>");
      btn.addEventListener("click", function () {
        /* switching sections keeps unsaved changes and the pill exactly as they are (the dirty state belongs to the account's settings, not one pane) */
        markDirty();
        settingsState.section = s[0];
        rail.querySelectorAll(".sr-item").forEach(function (x) { x.classList.remove("active"); });
        btn.classList.add("active");
        drawPane();
        markDirty();
      });
      rail.appendChild(btn);
    });
    /* Admin is its own page now (sidebar, owners only; daylight-adminpage.js), not a Settings section. */
    dlg.appendChild(rail); dlg.appendChild(pane); dlg.appendChild(bar);
    /* Item 11: the close button lives on the dialog itself (not inside the
       scrolling, animating pane) with a 40×40 hit area above everything. */
    var closeButton = el('<button type="button" class="icon-btn settings-close" title="Close settings" aria-label="Close settings">' + icon("x", 18) + "</button>");
    closeButton.addEventListener("click", function (event) { event.stopPropagation(); close(); });
    dlg.appendChild(closeButton);
    bd.appendChild(dlg);
    overlayRoot.appendChild(bd);

    bar.querySelector("[data-save]").addEventListener("click", async function () {
      var saveButton=bar.querySelector("[data-save]");
      if(saveButton.disabled||!isDirty())return;
      saveButton.disabled=true;
      dlg.classList.add("settings-saving");
      try {
        if (settingsState.beforeCommit) await settingsState.beforeCommit();
      } catch (error) {
        dlg.classList.remove("settings-saving");
        saveButton.disabled=false;
        bar.querySelector(".savebar-message").textContent=error.message||"Could not save this change.";
        return;
      }
      var previous=original;
      var committed=snapshot();
      original=committed;
      originalJSON=JSON.stringify(committed);
      bar.classList.add("is-saved");
      bar.querySelector(".savebar-save-label").textContent="Saved";
      bar.querySelector(".savebar-message").textContent="Changes saved";
      /* The birthday event follows the birthday and the first name, but only when one of them actually changed. */
      if(previous.birthday!==committed.birthday||(committed.birthday&&firstNameOf(previous.profileName)!==firstNameOf(committed.profileName))){
        if(window.daylightSyncBirthday)window.daylightSyncBirthday();
        renderAll(false);
      }
      if(window.daylightCloud&&window.daylightCloud.commit)window.daylightCloud.commit();
      document.dispatchEvent(new CustomEvent("daylight:settings-committed",{
        detail:{previousName:previous.profileName,name:state.profileName}
      }));
      setTimeout(function(){
        if(!settingsState.transactionActive)return;
        bar.classList.add("is-dismissing");
        clearTimeout(bar._hideT);
        setTimeout(function(){
          bar.hidden=true;
          bar.setAttribute("aria-hidden","true");
          bar.classList.remove("is-saved","is-dismissing");
          saveButton.disabled=false;
          bar.querySelector(".savebar-save-label").textContent="Save changes";
          bar.querySelector(".savebar-message").textContent="You have unsaved changes";
          dlg.classList.remove("settings-saving");
          markDirty();
        },180);
      },520);
    });
    bar.querySelector("[data-discard]").addEventListener("click", function () {
      if (!isDirty()) return;
      if (settingsState.onDiscard) settingsState.onDiscard();
      restore(original);
      renderAll(false);
      drawPane();
      markDirty();
    });
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    ["input", "change", "click", "keyup", "pointerup"].forEach(function (eventType) {
      dlg.addEventListener(eventType, function () { setTimeout(markDirty, 0); });
    });
    /* Menus (dropdown choices) are drawn outside the dialog, so also watch the whole document while Settings is open. */
    function docWatch() { if (!bd.isConnected) { stopWatch(); return; } setTimeout(markDirty, 0); }
    var watchTimer = setInterval(function () { if (!bd.isConnected) { stopWatch(); return; } markDirty(); }, 160);
    function stopWatch() {
      clearInterval(watchTimer);
      ["input", "change", "click", "keyup", "pointerup"].forEach(function (t) { document.removeEventListener(t, docWatch, true); });
    }
    ["input", "change", "click", "keyup", "pointerup"].forEach(function (t) { document.addEventListener(t, docWatch, true); });

    function drawPane() {
      settingsState.redrawPane = drawPane;
      pane.innerHTML = "";
      var fn = {
        profile: window.daylightProfilePane, appearance: paneAppearance, calendar: paneCalendar,
        notifications: paneNotifications, shortcuts: paneShortcuts,
        ai: window.daylightAiPane, admin: window.daylightAdminPane
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

  /* Settings → Profile (Item 8/16). Identity card, security rows, active
     sessions and Log out. Profile photo changes are part of the Settings
     transaction: they preview instantly and upload only on Save. */
  function initialsOf(name) {
    return String(name || "").trim().split(/\s+/).filter(Boolean).map(function (part) { return part.charAt(0).toUpperCase(); }).slice(0, 2).join("") || "?";
  }
  window.daylightInitials = initialsOf;
  /* Plain device label from a user-agent string: "Chrome on Windows",
     "Safari on iPhone", "macOS", "Linux"… */
  function sessionDevice(ua) {
    ua = String(ua || "");
    var os = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" :
      /CrOS/i.test(ua) ? "ChromeOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh|Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
    var browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\/|FxiOS/.test(ua) ? "Firefox" :
      /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
    var label = browser && os ? browser + " on " + os : (os || browser || "Unknown device");
    var kind = /iPhone|Android.*Mobile/i.test(ua) ? "phone" : /iPad|Android/i.test(ua) ? "tablet" : "monitor";
    return { label: label, icon: kind };
  }
  window.daylightSessionDevice = sessionDevice;
  function relativeTime(date) {
    if (!date || isNaN(date.getTime())) return "Last active: unknown";
    var mins = Math.round((Date.now() - date.getTime()) / 60000);
    if (mins < 2) return "Active now";
    if (mins < 60) return "Last active " + mins + " minutes ago";
    var hours = Math.round(mins / 60);
    if (hours < 24) return "Last active " + hours + (hours === 1 ? " hour ago" : " hours ago");
    return "Last active " + date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  }

  window.daylightProfilePane = function (pane) {
    paneHead(pane, "Profile", "Your name, photo, sign-in security, and the devices signed in to your account.");
    var user = window.daylightCloud && window.daylightCloud.user;
    var client = window.daylightCloud && window.daylightCloud.client;
    var email = (user && user.email) || window.__dlIdentityEmail || "";

    var identity = el('<div class="set-group dl-identity">' +
      '<div class="dl-identity-grid"><div class="dl-profile-photo"><div class="dl-profile-avatar" aria-label="Profile photo"></div></div>' +
      '<label class="dl-idf"><span class="dl-idf-key">Full name</span><input id="profileFullName" class="dl-idf-input" maxlength="80" autocomplete="name" required></label>' +
      '<div class="dl-idf"><span class="dl-idf-key">Email</span><div class="dl-idf-lock" title="Your sign-in address. It can’t be changed here.">' + icon("lock", 14) + '<span data-email></span></div></div></div>' +
      '<div class="dl-profile-photo-actions"><button type="button" class="btn-ghost dl-btn-sm" data-upload>Upload photo</button><button type="button" class="btn-ghost dl-btn-sm" data-remove>Remove photo</button></div>' +
      '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
      '<div class="dl-profile-status" role="status" aria-live="polite"></div>' +
      '</div>');
    var nameInput = identity.querySelector("#profileFullName");
    var photo = identity.querySelector(".dl-profile-avatar");
    var fileInput = identity.querySelector('input[type="file"]');
    var status = identity.querySelector(".dl-profile-status");
    var removeButton = identity.querySelector("[data-remove]");
    function showAvatar() {
      photo.innerHTML = state.avatarUrl ? '<img src="' + esc(state.avatarUrl) + '" alt="">' : esc(initialsOf(state.profileName));
      removeButton.hidden = !state.avatarUrl;
    }
    function setStatus(message, isError) {
      status.textContent = message || "";
      status.classList.toggle("is-error", !!isError);
    }
    function cleanupPending() {
      var pending = settingsState.pendingAvatar;
      if (pending && pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      settingsState.pendingAvatar = null;
    }
    nameInput.value = state.profileName || "";
    identity.querySelector("[data-email]").textContent = email || "Not available";
    showAvatar();
    nameInput.addEventListener("input", function () {
      state.profileName = nameInput.value.trim();
      state.firstName = state.profileName.split(/\s+/)[0] || "";
      showAvatar();
      renderSidebar();
    });
    identity.querySelector("[data-upload]").addEventListener("click", function () { fileInput.click(); });
    removeButton.addEventListener("click", function () {
      cleanupPending();
      settingsState.pendingAvatar = { type: "remove", userId: user && user.id };
      state.avatarUrl = "";
      showAvatar();
      renderSidebar();
      if (settingsState.markDirty) settingsState.markDirty();
      setStatus("Photo will be removed when you save.");
    });
    fileInput.addEventListener("change", async function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type)) { setStatus("That file isn’t a supported image. Choose a PNG, JPEG, WebP, or GIF.", true); return; }
      if (file.size > 20000000) { setStatus("That image is larger than 20 MB. Choose a smaller one.", true); return; }
      if (typeof createImageBitmap !== "function") { setStatus("This browser can’t process photos. Try another browser.", true); return; }
      try {
        var bitmap = await createImageBitmap(file);
        /* Centre-crop to a square, then scale to at most 512×512. */
        var side = Math.min(bitmap.width, bitmap.height);
        var left = (bitmap.width - side) / 2;
        var top = (bitmap.height - side) / 2;
        var blob = null;
        for (var size of [512, 384, 256]) {
          var target = Math.min(size, side);
          var canvas = document.createElement("canvas");
          canvas.width = canvas.height = target;
          var context = canvas.getContext("2d");
          if (!context) throw new Error("Couldn’t prepare that photo.");
          context.imageSmoothingQuality = "high";
          context.drawImage(bitmap, left, top, side, side, 0, 0, target, target);
          blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
          if (blob && blob.size <= 1500000) break;
        }
        bitmap.close();
        if (!blob || blob.size > 1500000) throw new Error("That photo couldn’t be reduced below 1.5 MB. Try a simpler image.");
        cleanupPending();
        var previewUrl = URL.createObjectURL(blob);
        settingsState.pendingAvatar = { type: "upload", blob: blob, previewUrl: previewUrl, userId: user && user.id };
        state.avatarUrl = previewUrl;
        showAvatar();
        renderSidebar();
        if (settingsState.markDirty) settingsState.markDirty();
        setStatus("Photo ready — Save changes to keep it.");
      } catch (error) {
        setStatus(error && error.message && /reduce|prepare/.test(error.message) ? error.message : "That file couldn’t be read as an image. Try a different photo.", true);
      }
    });
    settingsState.onDiscard = cleanupPending;
    settingsState.beforeCommit = async function () {
      if (!state.profileName.trim()) throw new Error("Enter your full name before saving.");
      var pending = settingsState.pendingAvatar;
      if (!pending) return;
      var activeUser = window.daylightCloud && window.daylightCloud.user;
      var activeClient = window.daylightCloud && window.daylightCloud.client;
      if (!activeClient || !activeUser || pending.userId !== activeUser.id) throw new Error("Your session changed. Sign in again before saving this photo.");
      var path = activeUser.id + "/avatar.png";
      var storage = activeClient.storage.from("avatars");
      if (pending.type === "remove") {
        var removed = await storage.remove([path]);
        if (removed.error) throw new Error("Couldn’t remove the photo: " + removed.error.message);
        state.avatarUrl = "";
      } else {
        var uploaded = await storage.upload(path, pending.blob, { upsert: true, contentType: "image/png", cacheControl: "3600" });
        if (uploaded.error) throw new Error("Couldn’t upload the photo: " + uploaded.error.message);
        var publicUrl = storage.getPublicUrl(path).data.publicUrl;
        state.avatarUrl = publicUrl + (publicUrl.indexOf("?") === -1 ? "?" : "&") + "v=" + Date.now();
      }
      await window.daylightCloud.updateProfileMetadata({ avatar_url: state.avatarUrl || null });
      cleanupPending();
      showAvatar();
      renderSidebar();
      setStatus("");
    };
    pane.appendChild(identity);

    /* Birthday: saved with Save; it keeps one yearly all-day "<First name>'s Birthday" event on the account's own default
       calendar in step (created, moved, renamed or removed when the birthday or the first name changes). */
    var birthday = el('<div class="set-group"><div class="set-group-title">Birthday</div>' +
      '<div class="set-row switch-row dl-row-stack"><span><span class="sw-label">Your birthday</span><div class="sw-sub">Adds a yearly all-day event to your calendar. Clear it to remove the event.</div></span>' +
      '<span class="dl-birthday-ctl"><input type="date" class="text-input dl-birthday-input" id="profileBirthday" aria-label="Birthday"><button type="button" class="btn-ghost dl-btn-sm" data-birthday-clear>Clear</button></span></div></div>');
    var birthdayInput = birthday.querySelector("#profileBirthday"), birthdayClear = birthday.querySelector("[data-birthday-clear]");
    birthdayInput.value = state.birthday || "";
    birthdayClear.hidden = !state.birthday;
    birthdayInput.addEventListener("input", function () {
      state.birthday = /^\d{4}-\d{2}-\d{2}$/.test(birthdayInput.value) ? birthdayInput.value : "";
      birthdayClear.hidden = !state.birthday;
      if (settingsState.markDirty) settingsState.markDirty();
    });
    birthdayClear.addEventListener("click", function () {
      state.birthday = ""; birthdayInput.value = ""; birthdayClear.hidden = true;
      if (settingsState.markDirty) settingsState.markDirty();
    });
    pane.appendChild(birthday);

    var security = el('<div class="set-group"><div class="set-group-title">Security</div>' +
      '<div class="dl-sec-row"><span class="dl-sec-tile">' + icon("lock", 18) + '</span><span class="dl-sec-text"><span class="sw-label">Password</span><span class="sw-sub">We’ll email you a secure link to set a new password.</span></span><button type="button" class="btn-ghost dl-btn-sm" data-reset-password aria-label="Change password">Change password</button></div>' +
      '<div class="dl-profile-status" data-security-status role="status" aria-live="polite"></div></div>');
    security.querySelector("[data-reset-password]").addEventListener("click", async function () {
      var securityStatus = security.querySelector("[data-security-status]");
      var button = this;
      if (!client || !email) { securityStatus.textContent = "Sign in with an email address to change your password."; securityStatus.classList.add("is-error"); return; }
      button.disabled = true;
      var result = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      button.disabled = false;
      securityStatus.classList.toggle("is-error", !!result.error);
      securityStatus.textContent = result.error ? "Couldn’t send the link: " + result.error.message : "Check " + email + " for a link to set a new password.";
    });
    pane.appendChild(security);

    var sessions = el('<div class="set-group"><div class="set-group-title">Active sessions</div><div class="dl-session-list" role="list"></div><div class="dl-profile-status" data-session-status role="status" aria-live="polite"></div></div>');
    pane.appendChild(sessions);
    /* "Sign out all other sessions" is a proper row at the bottom of the same card (it shows only when there is another session). */
    var othersRow = el('<div class="dl-session-all"><span class="dl-session-text"><span class="dl-session-name">All other sessions</span><span class="dl-session-meta">Sign out every device except this one.</span></span><span class="dl-session-actions"><button type="button" class="btn-ghost dl-btn-sm" data-signout-others hidden>Sign out all</button></span></div>');
    sessions.querySelector(".dl-session-list").after(othersRow);
    var othersButton = othersRow.querySelector("button");
    var otherSessions = [];
    var listRows = [];
    /* A removed row fades while its height collapses, so the rows below glide up (no instant vanish, no jump).
       Always resolves, and always removes the row, even if the transition never ends. */
    function collapseRow(row) {
      return new Promise(function (resolve) {
        var reduce = document.body.classList.contains("reduce-motion") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
        if (reduce || !row.isConnected) { row.remove(); resolve(); return; }
        var h = row.offsetHeight;
        row.style.height = h + "px"; row.style.overflow = "hidden"; row.style.boxSizing = "border-box";
        row.style.transition = "height 220ms var(--ease-out), opacity 160ms ease, padding 220ms var(--ease-out), margin 220ms var(--ease-out)";
        row.getBoundingClientRect();
        row.classList.add("is-leaving");
        row.style.height = "0px"; row.style.opacity = "0"; row.style.paddingTop = "0"; row.style.paddingBottom = "0"; row.style.marginTop = "0"; row.style.marginBottom = "0"; row.style.borderWidth = "0";
        setTimeout(function () { row.remove(); resolve(); }, 250);
      });
    }
    othersButton.addEventListener("click", function () {
      openConfirm({ title: "Sign out all other sessions?", body: "Every device except this one will need to sign in again.", confirmLabel: "Sign out", danger: true, fn: async function () {
        othersButton.disabled = true;
        var failed = 0, gone = [];
        for (var n = 0; n < otherSessions.length; n++) {
          var res = await client.rpc("daylight_revoke_my_session", { p_session_id: String(otherSessions[n].id) });
          if (res.error) failed++; else gone.push(otherSessions[n]);
        }
        /* Rows leave together, then the list is read back so it matches the server. */
        await Promise.all(listRows.filter(function (ref) { return gone.indexOf(ref.session) !== -1; }).map(function (ref) { return collapseRow(ref.row); }));
        othersButton.disabled = false;
        await loadSessions(true);
        sessionStatus.textContent = failed ? "Couldn’t sign out " + failed + " of the other sessions." : "All other sessions were signed out.";
        sessionStatus.classList.toggle("is-error", !!failed);
      } });
    });
    var list = sessions.querySelector(".dl-session-list");
    var sessionStatus = sessions.querySelector("[data-session-status]");
    async function loadSessions(quiet) {
      if (typeof othersButton !== "undefined") othersButton.hidden = true;
      if (!quiet) list.innerHTML = '<div class="dl-session-row dl-session-loading"><span class="dl-session-device-icon"></span><span class="dl-session-text"><i></i><i></i></span></div>';
      if (!quiet) { sessionStatus.textContent = ""; sessionStatus.classList.remove("is-error"); }
      if (!client || !user) { list.textContent = ""; sessionStatus.textContent = "Sign in to see your active sessions."; return; }
      var result;
      try { result = await client.rpc("daylight_list_my_sessions"); } catch (error) { result = { error: error }; }
      if (!list.isConnected) return;
      list.textContent = "";
      if (result.error) { sessionStatus.textContent = "Couldn’t load active sessions: " + (result.error.message || result.error); sessionStatus.classList.add("is-error"); return; }
      var rows = Array.isArray(result.data) ? result.data.slice() : [];
      rows.sort(function (a, b) { return (b.current ? 1 : 0) - (a.current ? 1 : 0) || new Date(b.last_active) - new Date(a.last_active); });
      if (!rows.length) { sessionStatus.textContent = "No active sessions found."; return; }
      /* One row per device: the server already collapses a device's sign-ins; this keeps the list right even if a
         row for the same registered device slips through. Rows with no device id are never merged. */
      var seenDevices = {};
      rows = rows.filter(function (r) { if (!r.device_id) return true; if (seenDevices[r.device_id]) return false; seenDevices[r.device_id] = true; return true; });
      var rowRefs = [];
      rows.forEach(function (session) {
        var parsed = sessionDevice(session.user_agent);
        var row = el('<div class="dl-session-row" role="listitem"><span class="dl-session-device-icon" aria-hidden="true">' + icon(parsed.icon, 16) + '</span>' +
          '<span class="dl-session-text"><span class="dl-session-name"></span><span class="dl-session-meta"></span></span><span class="dl-session-actions"></span></div>');
        row.querySelector(".dl-session-name").textContent = parsed.label;
        if (session.current) row.querySelector(".dl-session-name").insertAdjacentHTML("beforeend", '<span class="dl-session-badge">This device</span>');
        row.querySelector(".dl-session-meta").textContent = session.current ? "Active now" : relativeTime(session.last_active ? new Date(session.last_active) : null);
        if (!session.current) {
          var revoke = el('<button type="button" class="btn-ghost dl-btn-sm dl-session-signout" aria-label="Sign out ' + esc(parsed.label) + '">Sign out</button>');
          revoke.addEventListener("click", function () {
            openConfirm({ title: "Sign out " + parsed.label + "?", body: "That device will need to sign in again.", confirmLabel: "Sign out", danger: true, fn: async function () {
              revoke.disabled = true;
              /* The sign-out is done first; the animation is only the way the row leaves. */
              var revoked = await client.rpc("daylight_revoke_my_session", { p_session_id: String(session.id) });
              if (revoked.error) { sessionStatus.textContent = "Couldn’t sign out that session: " + revoked.error.message; sessionStatus.classList.add("is-error"); revoke.disabled = false; return; }
              otherSessions = otherSessions.filter(function (r) { return r !== session; });
              othersButton.hidden = !otherSessions.length;
              sessionStatus.textContent = parsed.label + " was signed out.";
              await collapseRow(row);
              if (!list.querySelector(".dl-session-row")) loadSessions(true);
            } });
          });
          row.querySelector(".dl-session-actions").appendChild(revoke);
        }
        list.appendChild(row);
        rowRefs.push({ session: session, row: row });
      });
      listRows = rowRefs;
      otherSessions = rows.filter(function (r) { return !r.current; });
      othersButton.hidden = !otherSessions.length;
    }
    loadSessions();

  };

  var originalAppearance = paneAppearance;
  paneAppearance = function (pane) {
    originalAppearance(pane);
    var intro = pane.querySelector(".pane-sub");
    if (intro && intro.textContent.indexOf("no Save button") !== -1)
      intro.textContent = "Preview changes immediately. Use Save or Discard before leaving Settings.";
    Array.from(pane.querySelectorAll(".set-group")).forEach(function (group) {
      var title = group.querySelector(".set-group-title");
      if (title && title.textContent.trim() === "Calendar colors") group.remove();
    });
  };
  var originalCalendar = paneCalendar;
  paneCalendar = function (pane, close) {
    /* Build the legacy groups off-screen, then re-home their rows (with their
       listeners) into the three Calendar sections. Working hours and the old
       pointer notes are not carried over. */
    var scratch = el("<div></div>");
    originalCalendar(scratch, close);
    var general = el("<div></div>");
    paneGeneral(general, close);
    var pick = function (root, selector) {
      var node = root.querySelector(selector);
      if (!node) return null;
      return node.closest(".set-row") || node.closest(".field") || node;
    };
    pane.appendChild(scratch.querySelector("h2"));
    pane.appendChild(scratch.querySelector(".pane-sub"));
    function group(title, rows) {
      var g = el('<div class="set-group"><div class="set-group-title">' + esc(title) + "</div></div>");
      rows.forEach(function (row) { if (row) g.appendChild(row); });
      return g;
    }
    var viewField = pick(scratch, "#csView");
    if (viewField) {
      var viewSelect = viewField.querySelector(".dd") || viewField.querySelector("#csView");
      var viewRow = el('<div class="set-row switch-row"><span><span class="sw-label">Default Calendar View</span><div class="sw-sub">The view Daylight opens in.</div></span></div>');
      viewRow.appendChild(viewSelect);
      viewField = viewRow;
    }
    pane.appendChild(group("View", [viewField, pick(scratch, "#csWeekStart"), pick(scratch, "#csWeekends"), pick(scratch, "#csWN"), pick(scratch, "#csSD")]));
    var tzRow = pick(general, "#gsTz");
    pane.appendChild(group("Format", [pick(general, "#gsTimeFmt"), pick(general, "#gsDateFmt"), pick(general, "#gsUseDevTz"), tzRow]));
    pane.appendChild(group("New events", [pick(general, "#gsDefCal"), pick(general, "#gsDuration"), pick(general, "#gsDefRem")]));
    pane.querySelectorAll(".inline-note,.set-helper").forEach(function (note) {
      if (/lives under|lives in|right away|instantly/i.test(note.textContent)) note.remove();
    });
  };
})();


/* Settings finish (presentation only). The AI access pane lives in daylight-ai-access.js. */
(function(){
"use strict";
const style=document.createElement("style");
style.textContent=`
.settings-dialog .field input:not([type="checkbox"]),.settings-dialog .field select{max-width:100%;width:100%}
.settings-dialog .settings-pane{overflow:auto;scrollbar-color:var(--line) transparent;scrollbar-width:thin}
.settings-dialog .settings-pane::-webkit-scrollbar{width:6px}
.settings-dialog .settings-pane::-webkit-scrollbar-thumb{background:var(--line);border-radius:5px}
.settings-dialog .set-row{max-width:100%}
.day-num{cursor:pointer}
.day-num:hover{background:var(--gray-2);border-radius:6px}
`;
document.head.append(style);
let queued=false;
function tidy(){
 queued=false;
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
