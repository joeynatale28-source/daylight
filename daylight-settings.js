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
    settingsState.section = section || settingsState.section || "general";
    settingsState.pendingView = state.view;
    settingsState.transactionActive = true;
    var original = snapshot();
    var originalJSON = JSON.stringify(original);
    var bd = el('<div class="backdrop"></div>');
    var dlg = el('<div class="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings"></div>');
    var rail = el('<div class="settings-rail"><div class="sr-title">Settings</div></div>');
    var pane = el('<div class="settings-pane"></div>');
    var bar = el('<div class="settings-savebar" role="status" aria-live="polite" hidden>' +
      '<span class="savebar-message">You haven&#39;t saved your changes</span>' +
      '<span class="savebar-actions"><button type="button" data-discard>Discard</button>' +
      '<button type="button" data-save>Save changes</button></span></div>');

    function isDirty() { return JSON.stringify(snapshot()) !== originalJSON; }
    function markDirty() {
      if (!settingsState.transactionActive || !bd.isConnected) return;
      bar.hidden = !isDirty();
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
      ["data", "sync", "Data & sync"],
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
        data: paneData, ai: window.daylightAiPane, about: paneAbout
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
