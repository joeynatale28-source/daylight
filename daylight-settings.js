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
    "sidebarRail", "avatarUrl", "customColors", "defaultView", "view"
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
      ".settings-dialog:has(.settings-savebar:not([hidden])) .settings-pane{margin-bottom:68px}",
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
      ".dl-identity-grid{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1.15fr);gap:14px;align-items:end;padding:4px 0 12px}.dl-idf{display:flex;flex-direction:column;gap:6px;min-width:0}.dl-idf-key{font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}.dl-idf-input{height:40px;border:1px solid transparent;border-radius:10px;background:var(--input-bg);padding:0 12px;font:inherit;font-size:13.5px;color:var(--text);outline:none;min-width:0;width:100%;transition:background 120ms,border-color 120ms,box-shadow 120ms}.dl-idf-input:hover{background:var(--hover)}.dl-idf-input:focus{border-color:color-mix(in srgb,var(--accent) 55%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 14%,transparent)}.dl-idf-lock{height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;background:var(--input-bg);color:var(--muted);font-size:13px;min-width:0}.dl-idf-lock .ic{flex:none}.dl-idf-lock span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}.dl-profile-photo{flex:none}.dl-profile-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--text);color:var(--bg);font-size:14px;font-weight:650;letter-spacing:.01em}.dl-sec-row{display:flex;align-items:center;gap:12px;padding:4px 0 8px}.dl-sec-tile{width:36px;height:36px;border-radius:10px;background:var(--hover);display:grid;place-items:center;color:var(--muted);flex:none}.dl-sec-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.dl-sec-text .sw-label{font-size:14px;font-weight:550}.dl-sec-text .sw-sub{font-size:12.5px;color:var(--muted)}.dl-signout-others{padding:2px 4px 14px}.dl-link-danger{color:var(--danger);font-size:13px;font-weight:600;padding:6px 0;cursor:pointer}.dl-link-danger:hover{text-decoration:underline}.dl-link-danger[hidden]{display:none}@media(max-width:560px){.dl-identity-grid{grid-template-columns:auto 1fr}.dl-identity-grid .dl-idf:last-child{grid-column:1/-1}}.dl-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block}.dl-identity-text{min-width:0;flex:1}.dl-identity-name{font-size:17px;font-weight:650;letter-spacing:-.015em;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dl-identity-email{font-size:13px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dl-profile-photo-actions [hidden]{display:none!important}.dl-profile-photo-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.dl-btn-sm{height:32px;padding:0 13px;font-size:12.5px;border-radius:999px;flex:none}.dl-row-input{width:240px;max-width:48%;flex:none}.dl-readonly-value{font-size:13.5px;color:var(--text);font-weight:500;flex:none;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-top:2px}.dl-profile-status{min-height:0;font-size:12px;color:var(--muted);margin:0}.dl-profile-status:not(:empty){margin:4px 0 8px}.dl-profile-status.is-error{color:var(--danger)}.dl-session-list{display:flex;flex-direction:column}.dl-session-row{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line-soft)}.dl-session-row:last-child{border-bottom:0}.dl-session-device-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:var(--hover);color:var(--muted);flex:none}.dl-session-text{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.dl-session-name{font-size:14px;font-weight:550}.dl-session-badge{display:inline-block;vertical-align:1px;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--hover);color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.01em;line-height:16px}.dl-session-signout{width:36px;height:36px;border-radius:8px;display:inline-grid;place-items:center;color:var(--danger);cursor:pointer;transition:background 140ms}.dl-session-signout:hover{background:color-mix(in srgb,var(--danger) 12%,transparent)}.dl-session-signout:focus-visible{outline:2px solid var(--danger);outline-offset:1px}.dl-session-signout:disabled{opacity:.5;cursor:default}.dl-session-meta{font-size:12.5px;color:var(--muted)}.dl-session-actions{flex:none}.dl-session-loading i{display:block;height:9px;width:46%;border-radius:5px;background:var(--hover)}.dl-session-loading i+i{width:28%;margin-top:6px}.dl-profile-logout-row{padding:4px 0 8px}.dl-profile-logout{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:999px;border:1px solid color-mix(in srgb,var(--danger) 40%,var(--line));background:transparent;color:var(--danger);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;transition:background 120ms}.dl-profile-logout:hover{background:color-mix(in srgb,var(--danger) 10%,transparent)}",
      ".settings-savebar button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
      "@media(max-width:640px){.settings-savebar{left:50%;right:auto;bottom:12px;transform:translateX(-50%);max-width:calc(100% - 24px);width:max-content;border-radius:999px;padding:7px 9px;gap:7px;justify-content:center}.settings-savebar .savebar-message{font-size:11px;line-height:1.2}.settings-savebar button{padding:7px 9px}}",
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
      bar.hidden=!dirty;
      bar.setAttribute("aria-hidden",String(!dirty));
      if (dirty) bar.querySelector(".savebar-message").textContent="You have unsaved changes";
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
        settingsState.section = s[0];
        rail.querySelectorAll(".sr-item").forEach(function (x) { x.classList.remove("active"); });
        btn.classList.add("active");
        drawPane();
        markDirty();
      });
      rail.appendChild(btn);
    });
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
      if(window.daylightCloud&&window.daylightCloud.commit)window.daylightCloud.commit();
      document.dispatchEvent(new CustomEvent("daylight:settings-committed",{
        detail:{previousName:previous.profileName,name:state.profileName}
      }));
      setTimeout(function(){
        if(!settingsState.transactionActive)return;
        bar.classList.add("is-dismissing");
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
      if (!isDirty() || document.getElementById("dlSettingsDiscardConfirm")) return;
      var confirm = el('<div class="backdrop" id="dlSettingsDiscardConfirm"><div class="dialog" role="alertdialog" aria-modal="true" aria-label="Discard changes?" style="width:min(400px,92vw)"><div class="dialog-head"><span class="dialog-title">Discard changes?</span></div><div class="dialog-body"><p>Unsaved settings changes will be lost.</p></div><div class="dialog-foot"><button type="button" class="btn-ghost" data-keep>Keep editing</button><button type="button" class="btn-primary" data-confirm-discard>Discard changes</button></div></div></div>');
      overlayRoot.appendChild(confirm);
      var dismiss = function(){ if(window.daylightExit)window.daylightExit(confirm);else confirm.remove(); };
      confirm.querySelector("[data-keep]").addEventListener("click",dismiss);
      confirm.querySelector("[data-confirm-discard]").addEventListener("click",function(){
        dismiss();
        if (settingsState.onDiscard) settingsState.onDiscard();
        restore(original);
        renderAll(false);
        drawPane();
        markDirty();
      });
      confirm.addEventListener("mousedown",function(e){if(e.target===confirm)dismiss();});
      confirm.querySelector("[data-keep]").focus();
    });
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    ["input", "change", "click"].forEach(function (eventType) {
      dlg.addEventListener(eventType, function () { setTimeout(markDirty, 0); });
    });

    function drawPane() {
      settingsState.redrawPane = drawPane;
      pane.innerHTML = "";
      var fn = {
        profile: window.daylightProfilePane, appearance: paneAppearance, calendar: paneCalendar,
        notifications: paneNotifications, shortcuts: paneShortcuts,
        ai: window.daylightAiPane
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

    var security = el('<div class="set-group"><div class="set-group-title">Security</div>' +
      '<div class="dl-sec-row"><span class="dl-sec-tile">' + icon("lock", 18) + '</span><span class="dl-sec-text"><span class="sw-label">Password</span><span class="sw-sub">We’ll email you a secure link to set a new password.</span></span><button type="button" class="btn-ghost dl-btn-sm" data-reset-password>Change</button></div>' +
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
    var othersRow = el('<div class="dl-signout-others"><button type="button" class="dl-link-danger" data-signout-others hidden>Sign out all other sessions</button></div>');
    pane.appendChild(othersRow);
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
          var revoke = el('<button type="button" class="dl-session-signout" title="Sign out" aria-label="Sign out ' + esc(parsed.label) + '">' + icon("logout", 18) + "</button>");
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

    var logout = el('<div class="dl-profile-logout-row"><button type="button" class="dl-profile-logout">' + icon("logout", 16) + '<span>Log out</span></button></div>');
    logout.querySelector("button").addEventListener("click", function () { logOut(); });
    pane.appendChild(logout);
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
      var viewRow = el('<div class="set-row switch-row"><span><span class="sw-label">Default Calendar View</span><div class="sw-sub">The view daylight opens in.</div></span></div>');
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
.dl-ai-app-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.dl-ai-app-card{min-width:0;margin:0!important;padding:14px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--surface)}
.dl-ai-app-card>.set-group-title{margin-bottom:12px}
.dl-claude-state{font-size:12px;font-weight:600;color:var(--muted);margin:0 0 10px}
.dl-claude-instructions{font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 12px}
.dl-ai-app-card .dl-connected-item{border-top:1px solid var(--line);padding-top:10px}
.dl-ai-app-card .dl-connected-item label{display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:12px}
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
/* Item 9(b): ChatGPT registers a new OAuth client on every reconnect, so one
   app can hold several active mcp_grants rows. The MCP function checks the
   grant of the client in the token, so the card must show the newest grant
   and apply scope changes to every active grant for that app. */
async function syncAppGrantRow(card,pattern){
 const rows=[...card.querySelectorAll(".dl-connected-item")];
 if(!rows.length)return;
 const row=rows[0];rows.slice(1).forEach(extra=>extra.remove());
 if(row.dataset.grantSynced)return;
 row.dataset.grantSynced="1";
 const db=window.daylightCloud?.client,uid=window.daylightCloud?.user?.id;
 if(!db||!uid||!db.auth?.oauth?.listGrants)return;
 const status=row.querySelector("[role=status]");
 const boxes=[...row.querySelectorAll("[data-perm]")];
 boxes.forEach(box=>{box.disabled=true});
 try{
  const [auth,grants]=await Promise.all([db.auth.oauth.listGrants(),db.from("mcp_grants").select("*").eq("user_id",uid).is("revoked_at",null)]);
  if(auth.error)throw auth.error;if(grants.error)throw grants.error;
  const entries=Array.isArray(auth.data)?auth.data:(auth.data?.grants||[]);
  const names=new Map(entries.map(entry=>[entry.client_id||entry.client?.id,entry.client?.name||entry.client_name||""]));
  const app=(grants.data||[]).filter(grant=>names.has(grant.client_id)&&pattern.test((grant.client_name||"")+" "+names.get(grant.client_id)))
   .sort((a,b)=>new Date(b.granted_at||0)-new Date(a.granted_at||0));
  if(!app.length)return;
  const newest=app[0];
  boxes.forEach(box=>{box.checked=!!newest[box.dataset.perm];box.onchange=null});
  const since=row.querySelector(".dl-row+div");
  if(since)since.textContent="Connected "+new Date(newest.granted_at).toLocaleDateString()+(app.length>1?" · "+app.length+" linked connections, kept in sync":"");
  boxes.forEach(box=>box.addEventListener("change",async function(){
   let read=boxes[0].checked,write=boxes[1].checked,del=boxes[2].checked;
   if(box.dataset.perm==="can_delete"&&del){read=true;write=true}
   if(box.dataset.perm==="can_write"&&!write)del=false;
   if(!read){write=false;del=false}
   boxes[0].checked=read;boxes[1].checked=write;boxes[2].checked=del;
   boxes.forEach(b=>{b.disabled=true});
   const ids=app.map(grant=>grant.client_id);
   let error=null;
   for(const id of ids){
    const result=await db.from("mcp_grants").update({can_read:read,can_write:write,can_delete:del}).eq("user_id",uid).eq("client_id",id);
    if(result.error){error=result.error;break}
   }
   if(!error)app.forEach(grant=>Object.assign(grant,{can_read:read,can_write:write,can_delete:del}));
   else boxes.forEach(b=>{b.checked=!!newest[b.dataset.perm]});
   if(status)status.textContent=error?(error.message||"Could not update permissions"):"Permissions updated";
   boxes.forEach(b=>{b.disabled=false});
  }));
 }catch(error){if(status)status.textContent="Could not read permissions: "+(error.message||error)}
 finally{boxes.forEach(box=>{box.disabled=false})}
}
function organizeAiCards(wrapper){
 const area=wrapper.querySelector("#dl-oauth-connected");
 const primary=area?.closest(".set-group");
 const featured=wrapper.querySelector(".dl-chatgpt-featured");
 if(!area||!primary||!featured)return;
 let cards=wrapper.querySelector(".dl-ai-app-cards");
 if(!cards){
  cards=document.createElement("div");cards.className="dl-ai-app-cards";
  const chat=document.createElement("div");chat.className="dl-ai-app-card";
  chat.innerHTML='<div class="set-group-title">ChatGPT</div>';
  chat.appendChild(featured);
  const claude=document.createElement("div");claude.className="dl-ai-app-card";
  claude.innerHTML='<div class="set-group-title">Claude</div><div class="dl-claude-state" role="status">Not connected</div><p class="dl-claude-instructions">In Claude, add a custom connector with the Daylight server URL. Leave OAuth Client ID and Secret blank, then approve the requested permissions.</p><button class="btn-ghost" type="button" data-copy-claude-url>Copy server URL</button>';
  const url=window.DAYLIGHT_MCP_URL||wrapper.querySelector("#mcpUrl")?.value||"";
  claude.querySelector("[data-copy-claude-url]").addEventListener("click",function(){
   if(!url){toast("The Daylight server URL is unavailable.");return}
   navigator.clipboard.writeText(url).then(()=>toast("Copied Daylight server URL")).catch(()=>toast("Unable to copy the server URL"));
  });
  cards.append(chat,claude);
  wrapper.insertBefore(cards,primary);
  cards.dataset.organized="true";
  cards._chatCard=chat;
  cards._claudeCard=claude;
 }
 const chat=cards._chatCard||cards.querySelector(".dl-ai-app-card");
 const claude=cards._claudeCard||cards.querySelectorAll(".dl-ai-app-card")[1];
 const rows=Array.from(area.querySelectorAll(".dl-connected-item"));
 if(rows.length){
  chat.querySelectorAll(".dl-connected-item").forEach(row=>row.remove());
  claude.querySelectorAll(".dl-connected-item").forEach(row=>row.remove());
  rows.forEach(row=>{
   const name=row.querySelector("strong")?.textContent||"";
   if(/chatgpt/i.test(name))chat.appendChild(row);
   else if(/claude/i.test(name))claude.appendChild(row);
  });
 }
 const connectedChat=chat.querySelector(".dl-connected-item");
 const connectedClaude=claude.querySelector(".dl-connected-item");
 const noConnections=/No connected apps yet|OAuth connections unavailable/i.test(area.textContent||"");
 if(noConnections&&!rows.length){
  chat.querySelectorAll(".dl-connected-item").forEach(row=>row.remove());
  claude.querySelectorAll(".dl-connected-item").forEach(row=>row.remove());
 }
 claude.querySelector(".dl-claude-state").textContent=connectedClaude?"Connected":"Not connected";
 syncAppGrantRow(chat,/chatgpt|openai/i);
 syncAppGrantRow(claude,/claude|anthropic/i);
 const otherRows=Array.from(area.querySelectorAll(".dl-connected-item"));
 primary.style.display=otherRows.length?"":"none";
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
     organizeAiCards(wrapper);
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

/* Item 13: a calendar's ⋯ button opens this settings-style popup.
   Save model = the Settings capsule: name, colour and "Your colors" edits
   preview live and are kept only on Save; Discard (one confirm) reverts and
   the popup stays open. Share, Export and Delete are immediate actions. */
(function () {
  "use strict";
  var css = document.createElement("style");
  css.textContent = [
    ".dialog.dl-calsettings:focus{outline:none}",
    ".dialog.dl-calsettings{width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:min(780px,calc(100dvh - 32px));display:flex;flex-direction:column;position:relative;overflow:hidden;padding:0;border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.1)}",
    ".dl-cs2-head{display:flex;align-items:center;gap:10px;padding:22px 56px 6px 24px;min-height:56px;flex:none}",
    ".dl-cs2-dot{width:12px;height:12px;border-radius:50%;flex:none}",
    ".dl-cs2-name,.dl-cs2-title{flex:1;min-width:0;font:inherit;font-size:15px;font-weight:600;letter-spacing:-.01em;line-height:1.3;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".dl-cs2-name{display:block;background:var(--input-bg);border:1px solid var(--line);border-radius:10px;padding:0 12px;height:40px;margin:0;width:100%;font-size:14px;font-weight:500;letter-spacing:0}",
    ".dl-cs2-name:hover{border-color:var(--faint)}.dl-cs2-name:focus{outline:none;background:var(--input-bg);border-color:color-mix(in srgb,var(--accent) 55%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 14%,transparent)}",
    ".dialog.dl-calsettings>.settings-close{right:8px;top:8px;width:36px;height:36px;min-width:36px;min-height:36px}.dialog.dl-calsettings>.settings-close::before{inset:2px;border-radius:8px}",
    ".dl-cs2-body{overflow-y:auto;padding:8px 24px 24px;min-height:0}.dl-cs2-body.has-pill{margin-bottom:64px}",
    ".dl-cs2-section+.dl-cs2-section{margin-top:26px}.dl-cs2-section>.dl-cs2-label:first-child{margin-top:0}.dl-cs2-label.is-sub{margin:18px 0 10px}",
    ".dl-cs2-label{font-size:11px;font-weight:650;letter-spacing:.09em;color:var(--muted);text-transform:uppercase;margin:0 0 12px}",
    ".dl-cs2-swatches{display:flex;flex-wrap:wrap;gap:12px;align-items:center}",
    ".dl-sw-wrap{position:relative;width:26px;height:26px}",
    ".dl-sw{width:26px;height:26px;border-radius:50%;border:0;padding:0;background:var(--c);position:relative;display:grid;place-items:center;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.14);transition:transform 120ms var(--ease-out)}",
    "[data-theme=dark] .dl-sw{box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}",
    ".dl-sw:hover{transform:scale(1.08)}.dl-sw:focus-visible{outline:2px solid var(--accent);outline-offset:3px}",
    ".dl-sw[aria-pressed=true]{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--c)}",
    ".dl-sw svg{color:#fff;filter:drop-shadow(0 0 1.5px rgba(0,0,0,.55));display:none}.dl-sw[aria-pressed=true] svg{display:block}",
    ".dl-sw-add{background:transparent;border:1.5px dashed color-mix(in srgb,var(--muted) 75%,transparent);color:var(--muted);box-shadow:none!important}.dl-sw-add:hover{color:var(--text);border-color:var(--text);transform:none}",
    ".dl-sw-wrap .dl-color-remove{position:absolute;right:-5px;top:-5px;width:15px;height:15px;font-size:11px;line-height:13px;opacity:0;transition:opacity 120ms;z-index:2}",
    ".dl-sw-wrap:hover .dl-color-remove,.dl-sw-wrap:focus-within .dl-color-remove{opacity:1}",
    ".dl-cs2-empty{font-size:12.5px;color:var(--muted);margin-right:4px}",
    ".dl-cs2-divider{height:1px;background:var(--line-soft);margin:14px 0}",
    ".dl-cs2-row{display:flex;align-items:center;gap:12px;width:100%;height:44px;padding:0 10px;margin-left:-10px;width:calc(100% + 20px);border-radius:8px;font-size:14px;font-weight:500;text-align:left;color:var(--text);cursor:pointer;transition:background 120ms var(--ease-out)}",
    ".dl-cs2-row:hover{background:var(--hover)}.dl-cs2-row:disabled{opacity:.55;cursor:default}.dl-cs2-row .ic{flex:none;color:var(--muted)}",
    ".dl-cs2-right{margin-left:auto;color:var(--muted);font-weight:400;font-size:13px;display:inline-flex;align-items:center;gap:6px}",
    ".dl-cs2-row.is-danger,.dl-cs2-row.is-danger .ic{color:var(--danger)}.dl-cs2-row.is-danger:hover{background:color-mix(in srgb,var(--danger) 10%,transparent)}",
    ".dl-cs2-chev{transition:transform 160ms var(--ease-out)}.dl-cs2-row[aria-expanded=true] .dl-cs2-chev{transform:rotate(90deg)}",
    ".dl-cs2-panel{padding:0}.dl-cs2-panel[hidden]{display:none}.dl-cs2-panel .set-group-title{display:none}.dl-cs2-panel .set-row{padding:6px 0}",
    ".dl-cs2-account{font-size:12px;color:var(--muted);padding:2px 8px 0}",
    ".dialog.dl-calsettings .settings-savebar{left:50%!important;bottom:12px;gap:10px;padding:6px 6px 6px 14px;font-size:12px;white-space:nowrap}",
    ".dl-cs-link{display:flex;gap:8px;align-items:center;margin-top:10px}",
    ".dl-cs-link .text-input{flex:1;min-width:0;height:36px;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-radius:8px}",
    ".dl-cs-share-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}",
    ".dl-cs-note{font-size:12px;color:var(--muted);margin:8px 0 2px;line-height:1.5}",
    ".dl-cs-note.is-error{color:var(--danger)}.dl-cd-error{margin:6px 0 4px;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.45;color:var(--danger);background:color-mix(in srgb,var(--danger) 10%,transparent);border:1px solid color-mix(in srgb,var(--danger) 24%,transparent)}.dl-cd-error[hidden]{display:none}",
    ".dl-btn-danger-ghost{color:var(--danger)!important;border-color:color-mix(in srgb,var(--danger) 40%,var(--line))!important}"
  ].join("\n");
  document.head.appendChild(css);

  function sameList(a, b) { return JSON.stringify(a || []) === JSON.stringify(b || []); }

  window.daylightCalendarSettings = function (cal) {
    if (!cal || settingsState.transactionActive) return;
    var builtin = cal.id === "holidays" || !!cal.builtin;
    var original = { name: cal.name, color: cal.color, customColors: (state.customColors || []).slice() };
    settingsState.transactionActive = true;
    settingsState.markDirty = null;
    window.daylightCalendarOriginal = function (c) { return c === cal ? original : null; };

    var bd = el('<div class="backdrop"></div>');
    var dlg = el('<div class="dialog dl-calsettings" role="dialog" aria-modal="true" aria-label="Calendar settings"></div>');
    var chev = icon("chevR", 16);
    dlg.innerHTML =
      '<div class="dl-cs2-head"><span class="dl-cs2-dot"></span><span class="dl-cs2-title"></span></div>' +
      '<div class="dl-cs2-body">' +
        (builtin ? "" : '<div class="dl-cs2-section" data-section="name"><div class="dl-cs2-label">Name</div><input id="calSettingsName" class="dl-cs2-name" maxlength="80" autocomplete="off" aria-label="Calendar name"></div>') +
        '<div class="dl-cs2-section" data-section="color"><div class="dl-cs2-label">Color</div><div class="dl-cs2-swatches" data-presets></div>' +
          '<div class="dl-cs2-label is-sub">Your colors</div><div class="dl-cs2-swatches" data-saved></div>' +
          '<div data-inline-picker style="margin-top:14px"></div></div>' +
        ((builtin || cal.caldav) ? "" : '<div class="dl-cs2-section" data-section="sharing"><div class="dl-cs2-label">Sharing</div><div class="dl-cs2-panel" data-share></div></div>') +
        '<div class="dl-cs2-section" data-section="actions"><div class="dl-cs2-label">Actions</div>' +
          (cal.caldav ? '<div data-caldav></div>' :
            '<button type="button" class="dl-cs2-row" data-export>' + icon("download", 18) + "<span>Export .ics</span></button>" +
            (builtin ? "" : '<div class="dl-cs2-divider"></div><button type="button" class="dl-cs2-row is-danger" data-delete>' + icon("trash", 18) + "<span>Delete calendar</span></button>")) +
        "</div>" +
      "</div>";
    var bar = el('<div class="settings-savebar" role="status" aria-live="polite" hidden><span class="savebar-message">Unsaved changes</span>' +
      '<span class="savebar-actions"><button type="button" data-discard>Discard</button><button type="button" data-save><span class="savebar-save-label">Save</span><svg class="save-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3.2 3.2L13 4.5"></path></svg></button></span></div>');
    var closeButton = el('<button type="button" class="icon-btn settings-close" title="Close" aria-label="Close calendar settings">' + icon("x", 18) + "</button>");
    dlg.appendChild(bar);
    dlg.appendChild(closeButton);
    bd.appendChild(dlg);
    overlayRoot.appendChild(bd);

    var nameInput = dlg.querySelector("#calSettingsName");
    var titleEl = dlg.querySelector(".dl-cs2-title");
    var bodyEl = dlg.querySelector(".dl-cs2-body");
    if (nameInput) nameInput.value = cal.name;
    var inline = null;
    var hexOf = function (key) { return /^#/.test(key) ? key : (window.PALETTE && PALETTE[key] ? PALETTE[key].dot : "#FF7A00"); };

    function currentName() { return nameInput ? nameInput.value.trim() : cal.name; }
    function isDirty() {
      return (nameInput && currentName() !== original.name) || cal.color !== original.color || !sameList(state.customColors, original.customColors);
    }
    function paintHeader() {
      if (titleEl) titleEl.textContent = currentName() || original.name;
      dlg.querySelector(".dl-cs2-dot").style.background = dotOf(cal);
      dlg.style.setProperty("--cs-thumb", dotOf(cal));
    }
    function markDirty() {
      if (bar.classList.contains("is-saved")) return;
      var dirty = isDirty();
      bar.hidden = !dirty;
      bodyEl.classList.toggle("has-pill", dirty);
      bar.setAttribute("aria-hidden", String(!dirty));
      bar.querySelector("[data-save]").disabled = !!(nameInput && !currentName());
      bar.querySelector(".savebar-message").textContent = nameInput && !currentName() ? "Enter a name" : "Unsaved changes";
    }
    function previewColor(key) {
      if (!key) return;
      cal.color = key;
      paintHeader(); drawSwatches();
      if (inline && key !== inline.value) inline.set(hexOf(key));
      renderSidebar(); renderView(false);
      markDirty();
    }
    function swatchButton(key, label) {
      var b = el('<button type="button" class="dl-sw" aria-pressed="' + (cal.color === key) + '" title="' + esc(label || key) + '" aria-label="Color ' + esc(label || key) + '" data-color="' + esc(key) + '">' + icon("check", 14) + "</button>");
      b.style.setProperty("--c", hexOf(key));
      b.addEventListener("click", function () { previewColor(key); });
      return b;
    }
    function drawSwatches() {
      var presets = dlg.querySelector("[data-presets]"), saved = dlg.querySelector("[data-saved]");
      presets.innerHTML = ""; saved.innerHTML = "";
      var list = (window.daylightPresetColors || []).slice();
      /* A named palette color (or any color not in the list) shows as the selected swatch too. */
      if (list.indexOf(cal.color) === -1 && (state.customColors || []).indexOf(cal.color) === -1) list.unshift(cal.color);
      list.forEach(function (key) { presets.appendChild(swatchButton(key, key === cal.color && !/^#/.test(key) ? colorName(key) : null)); });
      var mine = (state.customColors || []).filter(function (c) { return /^#[0-9A-F]{6}$/i.test(c); });
      mine.forEach(function (key) {
        var wrap = el('<span class="dl-sw-wrap"></span>');
        wrap.appendChild(swatchButton(key));
        var remove = el('<button type="button" class="dl-color-remove" title="Remove saved color" aria-label="Remove saved color ' + esc(key) + '">×</button>');
        remove.addEventListener("click", function (event) {
          event.preventDefault(); event.stopPropagation();
          state.customColors = (state.customColors || []).filter(function (c) { return c !== key; });
          drawSwatches(); markDirty();
        });
        wrap.appendChild(remove);
        saved.appendChild(wrap);
      });
      var add = el('<button type="button" class="dl-sw dl-sw-add" data-save-custom title="Save this color to Your colors" aria-label="Add the current color to Your colors">' + icon("plus", 14) + "</button>");
      add.querySelector("svg").style.cssText = "display:block;color:inherit;filter:none";
      add.addEventListener("click", function () {
        var hex = inline.value;
        state.customColors = [hex].concat((state.customColors || []).filter(function (c) { return c !== hex; })).slice(0, 30);
        previewColor(hex);
      });
      saved.appendChild(add);
    }
    inline = window.daylightInlineColorPicker(dlg.querySelector("[data-inline-picker]"), hexOf(cal.color), function (hex) { previewColor(hex); }, { compact: true });
    drawSwatches();
    paintHeader();
    if (nameInput) nameInput.addEventListener("input", function () { paintHeader(); markDirty(); });
    var exportButton = dlg.querySelector("[data-export]");
    if (exportButton) exportButton.addEventListener("click", function () { window.daylightExportCalendar(cal); });
    var caldavHost = dlg.querySelector("[data-caldav]");
    if (caldavHost && window.daylightCaldavPopup) window.daylightCaldavPopup(cal, caldavHost, { close: function () { finish(false); } });
    var deleteButton = dlg.querySelector("[data-delete]");
    if (deleteButton) deleteButton.addEventListener("click", function () { finish(false); confirmDeleteCalendar(cal); });
    var sharePanel = dlg.querySelector("[data-share]");
    if (sharePanel && window.daylightShareCalendar) window.daylightShareCalendar(cal, sharePanel);

    function revert() {
      cal.color = original.color;
      state.customColors = original.customColors.slice();
      if (nameInput) nameInput.value = original.name;
      inline.set(hexOf(cal.color));
      drawSwatches(); paintHeader();
      renderSidebar(); renderView(false);
    }
    function persist() {
      settingsState.transactionActive = false;
      if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
    }
    function finish(save) {
      if (save) { if (nameInput && currentName()) cal.name = currentName(); }
      else revert();
      window.daylightCalendarOriginal = null;
      persist();
      document.removeEventListener("keydown", onKey, true);
      renderSidebar(); renderView(false);
      if (window.daylightExit) window.daylightExit(bd); else bd.remove();
    }
    function confirmDiscard(onConfirm) {
      if (document.getElementById("dlSettingsDiscardConfirm")) return;
      var confirmEl = el('<div class="backdrop" id="dlSettingsDiscardConfirm"><div class="dialog" role="alertdialog" aria-modal="true" aria-label="Discard changes?" style="width:min(400px,92vw)"><div class="dialog-head"><span class="dialog-title">Discard changes?</span></div><div class="dialog-body"><p>Your unsaved calendar changes will be lost.</p></div><div class="dialog-foot"><button type="button" class="btn-ghost" data-keep>Keep editing</button><button type="button" class="btn-primary" data-confirm-discard>Discard changes</button></div></div></div>');
      overlayRoot.appendChild(confirmEl);
      var dismiss = function () { if (window.daylightExit) window.daylightExit(confirmEl); else confirmEl.remove(); };
      confirmEl.querySelector("[data-keep]").addEventListener("click", dismiss);
      confirmEl.querySelector("[data-confirm-discard]").addEventListener("click", function () { dismiss(); onConfirm(); });
      confirmEl.addEventListener("mousedown", function (e) { if (e.target === confirmEl) dismiss(); });
      confirmEl.querySelector("[data-keep]").focus();
    }
    function requestClose() {
      if (!isDirty()) { finish(false); return; }
      confirmDiscard(function () { finish(false); });
    }
    function onKey(e) {
      if (e.key !== "Escape" || overlayRoot.lastElementChild !== bd) return;
      e.preventDefault(); e.stopPropagation(); requestClose();
    }
    document.addEventListener("keydown", onKey, true);
    closeButton.addEventListener("click", requestClose);
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) requestClose(); });
    bar.querySelector("[data-discard]").addEventListener("click", function () {
      if (!isDirty()) return;
      confirmDiscard(function () { revert(); bar.hidden = true; bar.setAttribute("aria-hidden", "true"); });
    });
    bar.querySelector("[data-save]").addEventListener("click", function () {
      var saveButton = this;
      if (saveButton.disabled || !isDirty()) return;
      if (nameInput && !currentName()) return;
      if (nameInput) cal.name = currentName();
      original = { name: cal.name, color: cal.color, customColors: (state.customColors || []).slice() };
      if (cal.caldav && window.daylightCaldavUpdateCalendar) window.daylightCaldavUpdateCalendar(cal);
      if (window.daylightCloud && window.daylightCloud.commit) window.daylightCloud.commit();
      renderSidebar(); renderView(false);
      saveButton.disabled = true;
      bar.classList.add("is-saved");
      bar.querySelector(".savebar-save-label").textContent = "Saved";
      bar.querySelector(".savebar-message").textContent = "Saved";
      setTimeout(function () {
        bar.classList.add("is-dismissing");
        setTimeout(function () {
          bar.hidden = true; bar.setAttribute("aria-hidden", "true");
          bar.classList.remove("is-saved", "is-dismissing");
          saveButton.disabled = false;
          bar.querySelector(".savebar-save-label").textContent = "Save";
          bar.querySelector(".savebar-message").textContent = "Unsaved changes";
          markDirty();
        }, 180);
      }, 520);
    });
    dlg.setAttribute("tabindex", "-1");
    dlg.focus({ preventScroll: true });
  };
})();
