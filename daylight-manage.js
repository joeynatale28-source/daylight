/* Manage calendar: the dialog behind a calendar's ⋯ button. ONE centered Daylight dialog with a single scrolling column (no rail,
   no tabs): sections stack in one scroll and a slim footer (Done) stays visible. Name and color are saved with the pill; sharing
   and the public link act immediately.
     owned calendar   : Calendar (name + color) -> Sharing -> Export -> Danger zone (Delete calendar, last)
     subscribed       : Calendar -> Source -> Danger zone (Unsubscribe, last)
     shared with me   : Calendar -> Danger zone (Leave calendar, last)
     US Holidays      : Calendar (color) -> Export                                                                        */
(function () {
  "use strict";
  var css = document.createElement("style");
  css.textContent = [
    ".settings-dialog.dl-manage:focus,.dialog.dl-manage:focus{outline:none}",
    /* single-column shell: the standard Daylight dialog (same shell as Create Event) */
    ".dialog.dl-col{position:relative;display:flex;flex-direction:column;max-height:min(92dvh,840px)}",
    ".dl-col .dialog-head{flex:none}",
    ".dl-col .dialog-head .dl-mg-dot{width:12px;height:12px;margin-top:2px}",
    ".dl-col .dialog-head .dialog-title{display:block;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-col .dialog-head{align-items:center;gap:12px}",
    ".dl-col .dialog-head .settings-close{position:static;flex:none;width:36px;height:36px;margin:0}",
    ".dl-col-body{flex:1;min-height:0;overflow-y:auto;padding:2px 28px 12px}",
    ".dl-col-body .set-group{padding:20px 24px 18px;margin-bottom:18px}",
    ".dl-col-body .set-group:last-child{margin-bottom:4px}",
    /* a sibling of Settings: its 16px radius, its width, its header size; no hairlines under the header or above the footer */
    ".dialog.dl-manage.dl-col{width:min(560px,calc(100vw - 32px))!important;max-width:none!important;border-radius:16px!important}",
    ".dl-manage .dialog-head{border-bottom:0;padding:22px 28px 12px}",
    ".dl-manage .dialog-head .dialog-title{font-size:22px;font-weight:650;letter-spacing:-.02em}",
    ".dl-manage .dialog-foot{border-top:0;padding:6px 28px 20px}",
    ".dl-manage .set-group.is-danger{border-color:var(--line-soft)!important}",
    ".dl-manage .dl-ppl-row,.dl-manage .dl-ppl-row:first-child{border-top:0;padding:9px 0}",
    ".dl-manage .dl-cp-custom{border-top:0;padding-top:0}",
    ".dl-manage .dl-ga-host .set-row{border-bottom:0;padding:12px 0 4px}",
    ".dl-manage .dl-mg-sub{margin:16px 0 8px}",
    ".dl-manage .set-group-title{margin-bottom:10px}",
    ".dl-manage .set-row{padding:12px 0;align-items:center}.dl-manage .set-row:last-child{padding-bottom:2px}",
    ".dl-manage .set-row .dl-ppl-row{padding:0}",
    ".dl-manage .dl-cp-yours .dl-mg-sub,.dl-manage .dl-cp .dl-cp-yours{margin-top:14px}",
    ".dl-manage .dl-mg-note{margin:10px 0 0}",
    ".dl-manage .dl-ga-host .set-row{padding:10px 0 2px}",
    ".dl-manage .dl-inv-status:empty{display:none}",
    ".dl-manage .dl-mg-lead{font-size:13px;color:var(--muted);line-height:1.5;margin:-2px 0 12px}",
    ".dl-manage .dl-mg-name-field{margin:0 0 4px}",
    ".dl-col-h{font-size:15px;font-weight:620;letter-spacing:-.012em;margin:22px 0 4px}",
    ".dl-col-h:first-child{margin-top:0}",
    ".dl-col-sub{font-size:13px;color:var(--muted);line-height:1.5;margin:0 0 14px}",
    ".dl-col .dialog-foot{flex:none}",
    ".dialog.dl-col .settings-savebar{position:absolute;left:50%;right:auto;bottom:70px;transform:translateX(-50%)}",
    ".dialog.dl-col:has(.settings-savebar:not([hidden])) .dl-col-body{padding-bottom:76px}",
    /* the one color picker */
    ".dl-cp-yours[hidden]{display:none}",
    ".dl-cp-yours .dl-mg-sub{margin:16px 0 10px}",
    ".dl-cp-toggle{display:inline-flex;align-items:center;gap:8px;margin-top:16px;height:36px;padding:0 14px 0 10px;border:1px solid var(--line);border-radius:999px;font-size:13.5px;font-weight:550;color:var(--text);background:transparent;transition:background 120ms var(--ease-out)}",
    ".dl-cp-toggle:hover{background:var(--hover)}",
    ".dl-cp-toggle .dl-cp-chev{color:var(--muted);display:inline-grid;transition:transform 160ms var(--ease-out)}",
    ".dl-cp-toggle.is-open .dl-cp-chev{transform:rotate(180deg)}",
    ".dl-cp-plus{display:inline-grid;place-items:center;color:var(--muted)}",
    ".dl-cp-custom{margin-top:14px;padding-top:14px;border-top:1px solid var(--line-soft)}",
    ".dl-cp-custom[hidden]{display:none}",
    ".dl-cp-add{margin-top:12px}",
    ".dl-cp .dl-mg-swatches{gap:12px 10px}",
    /* the invite: the search field on its own full-width row, then the permission picker (left) and the Invite pill (right) */
    ".dl-invite .dl-inv-field{height:44px;border-radius:12px;width:100%;flex:none}",
    ".dl-invite .dl-inv-row2{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}",
    ".dl-invite .dl-inv-perm{height:40px;border-radius:12px;flex:0 1 auto}",
    ".dl-invite .dl-inv-send{height:36px;border-radius:8px;padding:0 20px;margin:0}",
    ".dl-invite .dl-inv-send:disabled{background:var(--surface2);color:var(--faint);opacity:1}",
    ".dl-invite .dl-inv-results{margin-top:8px}",
    ".dl-ppl-text{display:flex;flex-direction:column}",
    ".dl-manage .sr-title{display:flex;align-items:center;gap:9px;min-width:0}",
    ".dl-manage .sr-title .dl-mg-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
    ".dl-mg-dot{width:11px;height:11px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.16)}",
    ".dl-manage .sr-item.is-danger,.dl-manage .sr-item.is-danger svg{color:var(--danger)}",
    ".dl-manage .set-group.is-danger{border-color:color-mix(in srgb,var(--danger) 32%,var(--line-soft))}",
    ".dl-manage .set-group.is-danger .set-group-title{color:var(--danger)}",
    ".dl-manage .set-row .btn-ghost,.dl-manage .set-row .btn-danger-outline{flex:none}",
    ".dl-mg-name-input{width:100%;height:44px}",
    ".dl-mg-name-field{margin:0 0 20px}",
    ".dl-mg-sub{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:18px 0 10px}",
    ".dl-mg-swatches{display:flex;flex-wrap:wrap;gap:12px;align-items:center}",
    ".dl-mg-swatches[data-presets]{display:grid;grid-template-columns:repeat(var(--cols,10),26px);justify-content:start;gap:12px 10px}",
    ".dl-mg-saved{display:grid;grid-template-columns:repeat(var(--cols,10),26px);justify-content:start;gap:12px 10px;min-height:26px}",
    ".dl-sw-add svg{display:block!important;color:color-mix(in srgb,var(--text) 70%,transparent);filter:none}.dl-sw-add[aria-expanded=true]{color:var(--text);border-color:var(--text);border-style:solid}.dl-sw-add[aria-expanded=true] svg{color:var(--text)}",
    ".dl-mg-picker{margin-top:14px}",
    ".dl-mg-note{font-size:12.5px;color:var(--muted);line-height:1.5;margin:12px 0 0}",
    ".dl-sw-wrap{position:relative;width:26px;height:26px}",
    ".dl-sw{width:26px;height:26px;border-radius:50%;border:0;padding:0;background:var(--c);position:relative;display:grid;place-items:center;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.14);transition:transform 120ms var(--ease-out)}",
    "[data-theme=dark] .dl-sw{box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}",
    ".dl-sw:hover{transform:scale(1.08)}.dl-sw:focus-visible{outline:2px solid var(--accent);outline-offset:3px}",
    ".dl-sw[aria-pressed=true]{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--c)}",
    ".dl-sw svg{color:#fff;filter:drop-shadow(0 0 1.5px rgba(0,0,0,.55));display:none}.dl-sw[aria-pressed=true] svg{display:block}",
    ".dl-sw-add{background:transparent;border:1.5px dashed color-mix(in srgb,var(--muted) 75%,transparent);color:var(--muted);box-shadow:none!important}.dl-sw-add:hover{color:var(--text);border-color:var(--text);transform:none}",
    ".dl-sw-wrap .dl-color-remove{position:absolute;right:-5px;top:-5px;width:15px;height:15px;font-size:11px;line-height:13px;opacity:0;transition:opacity 120ms;z-index:2}",
    ".dl-sw-wrap:hover .dl-color-remove,.dl-sw-wrap:focus-within .dl-color-remove{opacity:1}",
    ".dl-mg-kv{font-size:13px;color:var(--muted);text-align:right;min-width:0;overflow-wrap:anywhere}",
    ".dl-mg-url{font:500 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);overflow-wrap:anywhere;margin-top:3px}",
    /* people */
    ".dl-person-avatar{display:inline-grid;place-items:center;flex:none;border-radius:50%;background:var(--surface2,var(--hover));border:1px solid var(--line-soft);color:var(--muted);font-weight:650;overflow:hidden;line-height:1}",
    ".dl-person-avatar img{width:100%;height:100%;object-fit:cover;display:block}",
    ".dl-inv-lead{font-size:12.5px;color:var(--muted);line-height:1.55;margin:-4px 0 14px}",
    ".dl-inv-row{display:flex;align-items:center;gap:8px}",
    ".dl-inv-field{flex:1;min-width:0;position:relative;display:flex;align-items:center;height:44px;border:1px solid var(--line);border-radius:12px;background:var(--input-bg);padding:0 12px;transition:border-color 140ms var(--ease-out),box-shadow 140ms var(--ease-out)}",
    ".dl-inv-field:focus-within{border-color:color-mix(in srgb,var(--accent) 55%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 14%,transparent)}",
    ".dl-inv-input{flex:1;min-width:0;background:none;border:0;outline:none;font-size:14px;color:var(--text);height:100%}",
    ".dl-inv-input::placeholder{color:var(--faint)}",
    ".dl-inv-chip{display:flex;align-items:center;gap:9px;min-width:0;flex:1}",
    ".dl-inv-chip[hidden],.dl-inv-input[hidden]{display:none}",
    ".dl-inv-chip .dl-person-text{display:flex;flex-direction:column;min-width:0;line-height:1.25}",
    ".dl-inv-chip b{font-size:13.5px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-inv-chip span.sub{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-inv-chip .dl-inv-x{margin-left:auto;flex:none;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:var(--muted)}",
    ".dl-inv-chip .dl-inv-x:hover{background:var(--hover);color:var(--text)}",
    ".dl-inv-perm{flex:none;display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);font-size:13.5px;font-weight:550;color:var(--text);white-space:nowrap}",
    ".dl-inv-perm:hover{background:var(--hover)}",
    ".dl-inv-perm .ic{color:var(--muted)}",
    ".dl-inv-send{flex:none;height:44px;padding:0 20px;margin:0}",
    ".dl-inv-results{margin-top:8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden;animation:popIn 160ms var(--ease-out)}",
    ".dl-inv-results[hidden]{display:none}",
    ".dl-person{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;text-align:left;transition:background 120ms var(--ease-out)}",
    ".dl-person+.dl-person{border-top:1px solid var(--line-soft)}",
    ".dl-person:hover:not(:disabled),.dl-person.is-active{background:var(--hover)}",
    ".dl-person:disabled{opacity:.6;cursor:default}",
    ".dl-person-text{display:flex;flex-direction:column;min-width:0;flex:1;line-height:1.3}",
    ".dl-person-text b{font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-person-text .sub{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-person-tag{flex:none;font-size:12px;color:var(--faint)}",
    ".dl-inv-none{padding:14px;font-size:13.5px;color:var(--muted)}",
    ".dl-inv-status{font-size:12.5px;margin:10px 0 0;min-height:0;color:var(--muted)}",
    ".dl-inv-status:empty{display:none}",
    ".dl-inv-status.is-error{color:var(--danger)}.dl-inv-status.is-ok{color:#238b59}",
    ".dl-ppl-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line-soft)}",
    ".dl-ppl-row:first-child{border-top:0}",
    ".dl-ppl-text{flex:1;min-width:0;line-height:1.3}",
    ".dl-ppl-name{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-ppl-name .dl-you{font-weight:400;color:var(--faint);margin-left:4px}",
    ".dl-ppl-sub{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-ppl-ctl{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 10px 0 12px;border-radius:9px;font-size:13px;font-weight:550;color:var(--text);transition:background 120ms var(--ease-out)}",
    ".dl-ppl-ctl:hover{background:var(--hover)}",
    ".dl-ppl-ctl.is-pending{color:var(--muted)}",
    ".dl-ppl-ctl .ic{color:var(--muted)}",
    ".dl-ppl-empty{font-size:13px;color:var(--faint);padding:8px 0 4px}",
    ".dl-perm-menu{width:272px}",
    ".dl-ga-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}",
    ".dl-ga-ic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--surface2,var(--hover));border:1px solid var(--line-soft);color:var(--muted)}",
    ".dl-ga-title{font-size:14px;font-weight:600;line-height:1.3}",
    ".dl-ga-sub{font-size:12.5px;color:var(--muted);line-height:1.4}",
    ".dl-ga-host .set-group-title{display:none}.dl-ga-host .switch-row .sw-sub{display:none}",
    "@media (max-width:639px){.dl-inv-row{flex-wrap:wrap}.dl-inv-field{flex-basis:100%}.dl-inv-perm{flex:1;justify-content:space-between}.dl-inv-send{flex:none}.dl-perm-menu{width:min(272px,calc(100vw - 24px))}}"
  ].join("\n");
  document.head.appendChild(css);

  /* Section heading inside the single column (replaces the Settings pane heading). */
  function paneHead(host, title, sub) {
    host.appendChild(make('<h3 class="dl-col-h"></h3>')).textContent = title;
    if (sub) host.appendChild(make('<p class="dl-col-sub"></p>')).textContent = sub;
  }
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function hexOf(key) { return /^#/.test(key) ? key : (window.PALETTE && PALETTE[key] ? PALETTE[key].dot : "#FF7A00"); }
  function sameList(a, b) { return JSON.stringify(a || []) === JSON.stringify(b || []); }
  function sharing() { return window.daylightSharing; }
  function permText(p) { return p === "edit" ? "Can edit" : "View only"; }
  var PERMS = [["edit", "Can edit", "Can add and change events"], ["view", "View only", "Can only see events"]];


  /* ===== The ONE calendar color picker =====
     Circular 26px swatches in one grid (the selected one shows a white check), "Your colors" (saved colors) right under it, and the
     custom editor (hue + HEX / RGB) as an expandable "Custom color" section that is closed by default. Used everywhere a calendar
     color is chosen: Manage, New calendar, onboarding. opts: value (palette key or #hex), onChange(key), deferSaved (saving the
     list waits for a Save pill) and onSavedChange() (called when "Your colors" changed). Returns {setValue, inline}. */
  function swatchHex(key) { return /^#/.test(key) ? key : (window.PALETTE && PALETTE[key] ? PALETTE[key].dot : "#FF7A00"); }
  window.daylightCalendarColorPicker = function (host, opts) {
    opts = opts || {};
    var value = opts.value;
    host.textContent = ""; host.classList.add("dl-cp");
    host.innerHTML = '<div class="dl-mg-swatches" data-presets></div>' +
      '<div class="dl-cp-yours"><div class="dl-mg-sub dl-cp-yourslabel">Your colors</div><div class="dl-mg-swatches dl-mg-saved" data-saved></div></div>' +
      '<div class="dl-cp-custom" hidden><div data-inline-picker></div><button type="button" class="btn-ghost dl-btn-sm dl-cp-add" data-save-custom>Add to Your colors</button></div>';
    var presets = host.querySelector("[data-presets]"), saved = host.querySelector("[data-saved]"), label = host.querySelector(".dl-cp-yourslabel"),
        yours = host.querySelector(".dl-cp-yours"), custom = host.querySelector(".dl-cp-custom");
    var inline = null;
    function savedList() { return (state.customColors || []).filter(function (c) { return /^#[0-9A-F]{6}$/i.test(c); }); }
    function swatch(key, name) {
      var b = make('<button type="button" class="dl-sw" aria-pressed="' + (value === key) + '" title="' + esc(name || key) + '" aria-label="Color ' + esc(name || key) + '" data-color="' + esc(key) + '">' + icon("check", 14) + "</button>");
      b.style.setProperty("--c", swatchHex(key));
      b.addEventListener("click", function () { pick(key); });
      return b;
    }
    function savedChanged() {
      if (opts.onSavedChange) opts.onSavedChange();
      else if (window.settingsState && settingsState.transactionActive) { if (settingsState.markDirty) settingsState.markDirty(); }
      else if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
    }
    function draw() {
      presets.innerHTML = ""; saved.innerHTML = "";
      var list = (window.daylightPresetColors || []).slice(), mine = savedList();
      /* A named palette color (or any color not in the list) shows as the selected swatch too. */
      if (value && list.indexOf(value) === -1 && mine.indexOf(value) === -1) list.unshift(value);
      host.style.setProperty("--cols", String(Math.max(6, Math.ceil(list.length / 3))));   /* saved colors flow in the very same grid */
      list.forEach(function (key) { presets.appendChild(swatch(key, key === value && !/^#/.test(key) && typeof colorName === "function" ? colorName(key) : null)); });
      mine.forEach(function (key) {
        var wrap = make('<span class="dl-sw-wrap"></span>');
        wrap.appendChild(swatch(key));
        var remove = make('<button type="button" class="dl-color-remove" title="Remove saved color" aria-label="Remove saved color ' + esc(key) + '">\u00d7</button>');
        remove.addEventListener("click", function (event) {
          event.preventDefault(); event.stopPropagation();
          state.customColors = savedList().filter(function (c) { return c !== key; });
          draw(); savedChanged();
        });
        wrap.appendChild(remove);
        saved.appendChild(wrap);
      });
      /* the one add tile: a dashed circle with a plus, at the end of "Your colors"; it opens / closes the custom editor */
      var addWrap = make('<span class="dl-sw-wrap"></span>');
      var tile = make('<button type="button" class="dl-sw dl-sw-add" data-custom-toggle aria-expanded="' + (!custom.hidden) + '" title="Add a custom color" aria-label="Add a custom color">' + icon("plus", 14) + "</button>");
      tile.style.setProperty("--c", "transparent");
      tile.addEventListener("click", toggleCustom);
      addWrap.appendChild(tile); saved.appendChild(addWrap);
      yours.hidden = false;
    }
    function toggleCustom() {
      var open = custom.hidden;
      custom.hidden = !open;
      var t = host.querySelector("[data-custom-toggle]"); if (t) { t.setAttribute("aria-expanded", String(open)); t.classList.toggle("is-open", open); }
    }
    function pick(key) {
      if (!key) return;
      value = key; draw();
      if (inline && key !== inline.value) inline.set(swatchHex(key));
      if (opts.onChange) opts.onChange(key);
    }
    host.querySelector("[data-save-custom]").addEventListener("click", function () {
      var hex = inline ? inline.value : swatchHex(value);
      state.customColors = [hex].concat(savedList().filter(function (c) { return c !== hex; })).slice(0, 30);
      pick(hex); savedChanged();
    });
    if (window.daylightInlineColorPicker) inline = window.daylightInlineColorPicker(host.querySelector("[data-inline-picker]"), swatchHex(value), function (hex) { pick(hex); }, { compact: true });
    draw();
    return { setValue: function (key) { value = key; draw(); if (inline && inline.value !== swatchHex(key)) inline.set(swatchHex(key)); }, get inline() { return inline; } };
  };

  window.daylightCalendarSettings = function (calArg) {
    if (!calArg || settingsState.transactionActive) return;
    var cal = calArg;
    var kind = (cal.id === "holidays" || cal.builtin) ? "holidays" : cal.remoteShareId ? "shared" : cal.remoteSubscriptionId ? "subscribed" : "owned";
    var original = { name: cal.name, color: cal.color, customColors: (state.customColors || []).slice() };
    settingsState.transactionActive = true;
    settingsState.markDirty = null;
    window.daylightCalendarOriginal = function (c) { return c === cal ? original : null; };

    var bd = el('<div class="backdrop"></div>');
    var dlg = el('<div class="dialog dl-look dl-manage dl-col" role="dialog" aria-modal="true" aria-label="Manage calendar"></div>');
    var head = el('<div class="dialog-head"><span class="dl-mg-dot"></span><span class="dialog-title dl-mg-name"></span></div>');
    var pane = el('<div class="dialog-body dl-col-body"></div>');
    var foot = el('<div class="dialog-foot"><button type="button" class="btn-primary" style="margin-left:0" data-done>Done</button></div>');
    var bar = el('<div class="settings-savebar" role="status" aria-live="polite" hidden><span class="savebar-message">You have unsaved changes</span>' +
      '<span class="savebar-actions"><button type="button" data-discard>Discard</button><button type="button" data-save><span class="savebar-save-label">Save changes</span>' +
      '<svg class="save-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3.2 3.2L13 4.5"></path></svg></button></span></div>');
    var closeButton = el('<button type="button" class="icon-btn settings-close" data-x title="Close" aria-label="Close calendar settings">' + icon("x", 17) + "</button>");
    var nameInput = null, inline = null;

    function currentName() { return nameInput ? nameInput.value.trim() : cal.name; }
    function isDirty() {
      return (nameInput && currentName() !== original.name) || cal.color !== original.color || !sameList(state.customColors, original.customColors);
    }
    function paintHeader() {
      head.querySelector(".dl-mg-name").textContent = currentName() || original.name;
      head.querySelector(".dl-mg-dot").style.background = dotOf(cal);
      dlg.style.setProperty("--cs-thumb", dotOf(cal));
    }
    function markDirty() {
      if (bar.classList.contains("is-saved")) return;
      var dirty = isDirty();
      bar.hidden = !dirty;
      bar.setAttribute("aria-hidden", String(!dirty));
      var empty = !!(nameInput && !currentName());
      bar.querySelector("[data-save]").disabled = empty;
      bar.querySelector(".savebar-message").textContent = empty ? "Enter a name" : "You have unsaved changes";
    }

    /* ------------------------------------------------------------ Calendar section (name + color) */
    function colorGroup(host, note, inCard) {
      /* name + color share ONE card (a card inside a card is what made this feel boxed in) */
      var group = inCard
        ? make('<div class="dl-mg-colorpart"><div class="dl-mg-sub">Color</div><div data-cp></div></div>')
        : make('<div class="set-group"><div class="set-group-title">Calendar</div><div class="dl-mg-sub" style="margin-top:0">Color</div><div data-cp></div>' + (note ? '<p class="dl-mg-note">' + esc(note) + "</p>" : "") + "</div>");
      host.appendChild(group);
      var cp = window.daylightCalendarColorPicker(group.querySelector("[data-cp]"), { value: cal.color, deferSaved: true, onSavedChange: function () { markDirty(); }, onChange: function (key) { previewColor(key); } });
      inline = cp.inline;
      colorRedraw = function () { cp.setValue(cal.color); };
    }
    var colorRedraw = null;
    function previewColor(key) {
      if (!key) return;
      cal.color = key;
      paintHeader();
      renderSidebar(); renderView(false);
      markDirty();
    }
    function drawCalendar() {
      nameInput = null;
      var calCard = null;
      if (kind === "owned" || kind === "subscribed") {
        calCard = make('<div class="set-group"><div class="set-group-title">Calendar</div></div>');
        var g = make('<div class="field dl-mg-name-field"><label for="calSettingsName">Name</label><input id="calSettingsName" class="text-input dl-mg-name-input dl-cs2-name" maxlength="80" autocomplete="off" aria-label="Calendar name"></div>');
        nameInput = g.querySelector("input");
        nameInput.value = pendingName !== null ? pendingName : cal.name;
        nameInput.addEventListener("input", function () { pendingName = nameInput.value; paintHeader(); markDirty(); });
        calCard.appendChild(g);
        pane.appendChild(calCard);
      }
      if (kind === "shared") {
        var info = cal.sharedFrom || {};
        var g2 = make('<div class="set-group"><div class="set-group-title">Shared with you</div>' +
          '<div class="set-row switch-row"><span><span class="sw-label">Calendar</span></span><span class="dl-mg-kv" data-k="name"></span></div>' +
          '<div class="set-row switch-row"><span><span class="sw-label">Shared by</span></span><span class="dl-ppl-row" style="padding:0;border:0" data-by></span></div>' +
          '<div class="set-row switch-row"><span><span class="sw-label">Your access</span><div class="sw-sub" data-perm-sub></div></span><span class="dl-mg-kv" data-k="perm"></span></div></div>');
        g2.querySelector('[data-k="name"]').textContent = cal.name;
        var by = g2.querySelector("[data-by]");
        if (sharing() && sharing().avatar) by.appendChild(sharing().avatar({ name: info.ownerName, avatar: info.ownerAvatar }, 30));
        by.appendChild(make('<span class="dl-ppl-text"><span class="dl-ppl-name"></span><span class="dl-ppl-sub"></span></span>'));
        by.querySelector(".dl-ppl-name").textContent = "Shared by " + (info.ownerName || "someone");
        by.querySelector(".dl-ppl-sub").textContent = info.ownerEmail || "";
        g2.querySelector('[data-k="perm"]').textContent = permText(info.permission);
        g2.querySelector("[data-perm-sub]").textContent = info.permission === "edit" ? "You can add and change events." : "You can only see events.";
        pane.appendChild(g2);
      }
      colorGroup(calCard || pane, kind === "shared" ? "This only changes how the calendar looks in your sidebar." : "", !!calCard);
      paintHeader();
    }
    var pendingName = null;

    /* ------------------------------------------------------------ Export / Danger */
    function drawExport() {
      var g = make('<div class="set-group"><div class="set-group-title">Export</div><div class="set-row switch-row"><span><span class="sw-label">Export calendar</span><div class="sw-sub">Download every event as an .ics file.</div></span>' +
        '<button type="button" class="btn-ghost dl-btn-sm" data-export>Export .ics</button></div></div>');
      g.querySelector("[data-export]").addEventListener("click", function () { window.daylightExportCalendar(cal); });
      pane.appendChild(g);
    }
    function drawDanger() {
      var title, sub, label;
      if (kind === "subscribed") { title = "Unsubscribe"; sub = "Removes the subscribed calendar and its cached events. The source calendar is not affected."; label = "Unsubscribe"; }
      else if (kind === "shared") { title = "Leave calendar"; sub = "You will no longer see this calendar. " + ((cal.sharedFrom && cal.sharedFrom.ownerName) || "The owner") + " can invite you again."; label = "Leave calendar"; }
      else { title = "Delete calendar"; sub = "Removes this calendar and all its events. This can’t be undone."; label = "Delete calendar"; }
      var g = make('<div class="set-group is-danger"><div class="set-group-title">Danger zone</div><div class="set-row switch-row"><span><span class="sw-label"></span><div class="sw-sub"></div></span>' +
        '<button type="button" class="btn-danger-outline dl-btn-sm" data-danger></button></div></div>');
      g.querySelector(".sw-label").textContent = title;
      g.querySelector(".sw-sub").textContent = sub;
      var btn = g.querySelector("[data-danger]"); btn.textContent = label;
      if (kind === "owned") btn.setAttribute("data-delete", "");
      btn.addEventListener("click", function () {
        if (kind === "owned") { finish(); confirmDeleteCalendar(cal); return; }
        if (kind === "subscribed") {
          var subs = window.daylightSubscriptions, row = subs && subs.row(cal.remoteSubscriptionId);
          openConfirm({ title: "Unsubscribe from " + cal.name + "?", body: "This removes the subscribed calendar and all cached events from Daylight. The source calendar is not affected.", confirmLabel: "Unsubscribe", danger: true, fn: async function () {
            try { await subs.call("ical-subscribe", { action: "remove", id: cal.remoteSubscriptionId }); await subs.reload(); toast("Calendar unsubscribed"); finish(); }
            catch (e) { toast((e && e.message) || "Could not unsubscribe"); }
          } });
          return;
        }
        openConfirm({ title: "Leave " + cal.name + "?", body: "You will no longer see this calendar. " + ((cal.sharedFrom && cal.sharedFrom.ownerName) || "The owner") + " can invite you again.", confirmLabel: "Leave calendar", danger: true, fn: async function () {
          try { await sharing().rpc("daylight_leave_calendar_share", { p_id: cal.remoteShareId }); await sharing().load(); toast("You left " + cal.name); finish(); }
          catch (e) { toast(sharing().friendly(e)); }
        } });
      });
      pane.appendChild(g);
    }

    /* ------------------------------------------------------------ Source (subscribed) */
    function drawSource() {
      var subs = window.daylightSubscriptions, row = subs && subs.row(cal.remoteSubscriptionId) || {};
      var g = make('<div class="set-group"><div class="set-group-title">Source</div>' +
        '<div class="set-row switch-row"><span><span class="sw-label">Source</span><div class="dl-mg-url" data-url></div></span><button type="button" class="btn-ghost dl-btn-sm" data-copy>Copy</button></div>' +
        '<div class="set-row switch-row"><span><span class="sw-label">Last updated</span></span><span class="dl-mg-kv" data-updated></span></div>' +
        '<div class="set-row switch-row"><span><span class="sw-label">Status</span></span><span class="dl-mg-kv" data-status></span></div>' +
        '<div class="set-row switch-row"><span><span class="sw-label">Refresh now</span><div class="sw-sub">Check the source for changes.</div></span><button type="button" class="btn-ghost dl-btn-sm" data-refresh>Refresh now</button></div>' +
        '<div class="dl-inv-status" role="status" data-note></div></div>');
      g.querySelector("[data-url]").textContent = row.url || "Unavailable";
      g.querySelector("[data-updated]").textContent = row.last_fetched_at ? new Date(row.last_fetched_at).toLocaleString() : "Never";
      g.querySelector("[data-status]").textContent = row.last_error || "Up to date";
      g.querySelector("[data-copy]").addEventListener("click", function () {
        if (!row.url) return;
        navigator.clipboard.writeText(row.url).then(function () { toast("Copied to clipboard"); }, function () { toast("Copy failed"); });
      });
      g.querySelector("[data-refresh]").addEventListener("click", async function () {
        var note = g.querySelector("[data-note]"), b = this; b.disabled = true; note.className = "dl-inv-status"; note.textContent = "Checking the source…";
        try {
          await subs.call("ical-subscribe", { action: "refresh", id: cal.remoteSubscriptionId, force: true });
          await subs.reload();
          var fresh = subs.row(cal.remoteSubscriptionId) || {};
          g.querySelector("[data-updated]").textContent = fresh.last_fetched_at ? new Date(fresh.last_fetched_at).toLocaleString() : new Date().toLocaleString();
          g.querySelector("[data-status]").textContent = fresh.last_error || "Up to date";
          note.className = "dl-inv-status is-ok"; note.textContent = "Calendar refreshed.";
        } catch (e) { note.className = "dl-inv-status is-error"; note.textContent = (e && e.message) || "Couldn’t refresh."; }
        b.disabled = false;
      });
      pane.appendChild(g);
    }

    /* ------------------------------------------------------------ Sharing (owned) */
    function drawSharing() {
      var shareCard = make('<div class="set-group"><div class="set-group-title">Sharing</div><p class="dl-mg-lead">Invite other Daylight accounts. They choose whether to add the calendar.</p></div>');
      pane.appendChild(shareCard);
      var s = sharing();
      var people = [], listLoaded = false, listFailed = false;
      var picked = null, perm = "view", resultsSeq = 0, searchTimer = null;

      /* invite row */
      var inviteGroup = make('<div class="dl-invite">' +
        '<div class="dl-inv-field"><input class="dl-inv-input" type="text" placeholder="Search people to share with…" aria-label="Search people to share with" autocomplete="off" spellcheck="false">' +
        '<div class="dl-inv-chip" hidden></div></div>' +
        '<div class="dl-inv-row2"><button type="button" class="dl-inv-perm" aria-haspopup="menu" data-perm><span class="dl-inv-perm-label">View only</span>' + icon("chevD", 14) + "</button>" +
        '<button type="button" class="btn-primary dl-inv-send" data-send disabled>Invite</button></div>' +
        '<div class="dl-inv-results" role="listbox" aria-label="People" hidden></div><div class="dl-inv-status" role="status" data-status></div></div>');
      var input = inviteGroup.querySelector(".dl-inv-input"), chip = inviteGroup.querySelector(".dl-inv-chip"), results = inviteGroup.querySelector(".dl-inv-results"),
          permBtn = inviteGroup.querySelector("[data-perm]"), sendBtn = inviteGroup.querySelector("[data-send]"), status = inviteGroup.querySelector("[data-status]");
      function say(msg, kind2) { status.textContent = msg || ""; status.className = "dl-inv-status" + (kind2 ? " is-" + kind2 : ""); }
      function syncSend() { sendBtn.disabled = !picked || listFailed; }
      function relation(userId) {
        var p = people.filter(function (x) { return x.recipient_id === userId; })[0];
        return p ? (p.status === "pending" ? "Invited" : "Has access") : "";
      }
      function showResults(list, q) {
        results.innerHTML = "";
        results.hidden = false;
        if (!list.length) { results.appendChild(make('<div class="dl-inv-none" role="status">No results found — check the spelling</div>')); return; }
        list.forEach(function (p) {
          var rel = relation(p.user_id);
          var card = make('<button type="button" class="dl-person" role="option"' + (rel ? " disabled" : "") + '><span class="dl-person-text"><b></b><span class="sub"></span></span>' + (rel ? '<span class="dl-person-tag"></span>' : "") + "</button>");
          card.insertBefore(s.avatar(p, 36), card.firstChild);
          card.querySelector("b").textContent = p.name;
          card.querySelector(".sub").textContent = p.email;
          if (rel) card.querySelector(".dl-person-tag").textContent = rel;
          card.addEventListener("click", function () { pick(p); });
          results.appendChild(card);
        });
      }
      function pick(p) {
        picked = p;
        results.hidden = true; results.innerHTML = "";
        input.hidden = true; input.value = "";
        chip.hidden = false; chip.innerHTML = "";
        chip.appendChild(s.avatar(p, 30));
        chip.appendChild(make('<span class="dl-person-text"><b></b><span class="sub"></span></span>'));
        chip.querySelector("b").textContent = p.name;
        chip.querySelector(".sub").textContent = p.email;
        var x = make('<button type="button" class="dl-inv-x" aria-label="Choose someone else">' + icon("x", 14) + "</button>");
        x.addEventListener("click", function () { picked = null; chip.hidden = true; input.hidden = false; input.focus(); syncSend(); say(""); });
        chip.appendChild(x);
        say(""); syncSend();
      }
      input.addEventListener("input", function () {
        clearTimeout(searchTimer);
        var q = input.value.trim();
        say("");
        if (q.length < 2) { results.hidden = true; results.innerHTML = ""; return; }
        searchTimer = setTimeout(async function () {
          var mine = ++resultsSeq;
          try {
            var res = await s.rpc("daylight_search_people", { p_query: q });
            if (mine !== resultsSeq || input.value.trim() !== q) return;
            showResults(Array.isArray(res) ? res : [], q);
          } catch (e) { if (mine === resultsSeq) { results.hidden = true; say("Search isn’t available right now.", "error"); } }
        }, 250);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !results.hidden) { e.stopPropagation(); results.hidden = true; return; }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          var cards = [].slice.call(results.querySelectorAll(".dl-person:not(:disabled)"));
          if (!cards.length) return;
          e.preventDefault();
          var i = cards.findIndex(function (c) { return c.classList.contains("is-active"); });
          if (i >= 0) cards[i].classList.remove("is-active");
          i = e.key === "ArrowDown" ? (i + 1) % cards.length : (i <= 0 ? cards.length - 1 : i - 1);
          cards[i].classList.add("is-active");
        }
        if (e.key === "Enter") {
          var a = results.querySelector(".dl-person.is-active") || (results.querySelectorAll(".dl-person:not(:disabled)").length === 1 ? results.querySelector(".dl-person:not(:disabled)") : null);
          if (a) { e.preventDefault(); a.click(); }
        }
      });
      function permMenu(anchor, current, onPick, extra) {
        var items = PERMS.map(function (p) { return { label: p[1], sub: p[2], checkRight: true, selected: current === p[0], fn: function () { onPick(p[0]); } }; });
        if (extra && extra.length) { items.push({ sep: true }); extra.forEach(function (x) { items.push(x); }); }
        openMenu(anchor, items, { align: "right", className: "dl-perm-menu", above: true });
      }
      permBtn.addEventListener("click", function () {
        permMenu(permBtn, perm, function (v) { perm = v; permBtn.querySelector(".dl-inv-perm-label").textContent = permText(v); });
      });
      sendBtn.addEventListener("click", async function () {
        if (sendBtn.disabled || !picked) return;
        sendBtn.disabled = true; sendBtn.textContent = "Sending…"; say("");
        try {
          await s.rpc("daylight_send_calendar_share", { p_calendar_id: cal.id, p_recipient: picked.user_id, p_permission: perm });
          toast("Invite sent to " + picked.name);
          picked = null; chip.hidden = true; input.hidden = false; input.value = "";
          await loadPeople();
        } catch (e) {
          var m = String((e && e.message) || "");
          say(/already has access/i.test(m) ? "That person already has access." : /Only calendars you own|Calendar not found/i.test(m) ? "This calendar can’t be shared." : "Couldn’t send that invite. Try again.", "error");
        }
        sendBtn.textContent = "Invite"; syncSend();
      });
      shareCard.appendChild(inviteGroup);

      /* people with access */
      var peopleGroup = make('<div class="dl-mg-peoplepart"><div class="dl-mg-sub">People with access</div><div data-people></div></div>');
      var peopleHost = peopleGroup.querySelector("[data-people]");
      function ownerRow() {
        var me = (window.daylightCloud && window.daylightCloud.user) || {};
        var row = make('<div class="dl-ppl-row"><span class="dl-ppl-text"><span class="dl-ppl-name"><span class="n"></span><span class="dl-you">(You)</span></span><span class="dl-ppl-sub"></span></span></div>');
        row.insertBefore(s.avatar({ name: state.profileName, avatar: state.avatarUrl }, 36), row.firstChild);
        row.querySelector(".n").textContent = state.profileName || "You";
        row.querySelector(".dl-ppl-sub").textContent = me.email || "";
        return row;
      }
      function drawPeople() {
        peopleHost.innerHTML = "";
        peopleHost.appendChild(ownerRow());
        if (listFailed) { peopleHost.appendChild(make('<div class="dl-ppl-empty">Sharing isn’t available right now.</div>')); return; }
        if (!listLoaded) { peopleHost.appendChild(make('<div class="dl-ppl-empty">Loading…</div>')); return; }
        people.forEach(function (p) {
          var pending = p.status === "pending";
          var row = make('<div class="dl-ppl-row" data-share-id="' + esc(p.id) + '"><span class="dl-ppl-text"><span class="dl-ppl-name"></span><span class="dl-ppl-sub"></span></span>' +
            '<button type="button" class="dl-ppl-ctl' + (pending ? " is-pending" : "") + '" aria-haspopup="menu"><span class="lbl"></span>' + icon("chevD", 14) + "</button></div>");
          row.insertBefore(s.avatar(p, 36), row.firstChild);
          row.querySelector(".dl-ppl-name").textContent = p.name;
          row.querySelector(".dl-ppl-sub").textContent = p.email;
          var ctl = row.querySelector(".dl-ppl-ctl");
          ctl.querySelector(".lbl").textContent = pending ? "Invited" : permText(p.permission);
          ctl.setAttribute("aria-label", p.name + ": " + (pending ? "Invited" : permText(p.permission)));
          ctl.addEventListener("click", function () {
            var extra = pending
              ? [{ label: "Resend invite", fn: async function () { try { await s.rpc("daylight_send_calendar_share", { p_calendar_id: cal.id, p_recipient: p.recipient_id, p_permission: p.permission }); toast("Invite sent again"); loadPeople(); } catch (e) { toast("Couldn’t resend that invite."); } } },
                 { label: "Cancel invite", fn: async function () { try { await s.rpc("daylight_revoke_calendar_share", { p_id: p.id }); toast("Invite canceled"); loadPeople(); } catch (e) { toast("Couldn’t cancel that invite."); } } }]
              : [{ label: "Remove access", danger: true, fn: async function () { try { await s.rpc("daylight_revoke_calendar_share", { p_id: p.id }); toast(p.name + " can no longer see this calendar"); loadPeople(); } catch (e) { toast("Couldn’t remove access."); } } }];
            permMenu(ctl, p.permission, async function (v) {
              if (v === p.permission) return;
              try { await s.rpc("daylight_set_calendar_share_permission", { p_id: p.id, p_permission: v }); toast(p.name + ": " + permText(v)); loadPeople(); }
              catch (e) { toast("Couldn’t change that permission."); }
            }, extra);
          });
          peopleHost.appendChild(row);
        });
      }
      async function loadPeople() {
        try { people = (await s.rpc("daylight_list_calendar_shares", { p_calendar_id: cal.id })) || []; listFailed = false; }
        catch (e) { people = []; listFailed = true; }
        listLoaded = true;
        if (peopleHost.isConnected) { drawPeople(); syncSend(); if (listFailed) say("Sharing isn’t available right now.", "error"); }
      }
      shareCard.appendChild(peopleGroup);
      drawPeople();

      /* general access (the public link) */
      var ga = make('<div class="set-group"><div class="set-group-title">General access</div><div class="dl-ga-head"><span class="dl-ga-ic">' + icon("lock", 17) + '</span><div><div class="dl-ga-title" data-ga-title>Restricted</div><div class="dl-ga-sub" data-ga-sub>Only people you share with can access this calendar</div></div></div><div class="dl-ga-host" data-share></div></div>');
      var host = ga.querySelector("[data-share]");
      host.addEventListener("dl-share-state", function (e) {
        var on = !!(e.detail && e.detail.enabled);
        ga.querySelector("[data-ga-title]").textContent = on ? "Anyone with the link" : "Restricted";
        ga.querySelector("[data-ga-sub]").textContent = on ? "Anyone with the link can view this calendar" : "Only people you share with can access this calendar";
      });
      pane.appendChild(ga);
      if (window.daylightShareCalendar) window.daylightShareCalendar(cal, host);
      loadPeople();
    }

    /* ------------------------------------------------------------ sections stack in ONE column */
    var sections = {
      owned: [drawCalendar, drawSharing, drawExport, drawDanger],
      holidays: [drawCalendar, drawExport],
      subscribed: [drawCalendar, drawSource, drawDanger],
      shared: [drawCalendar, drawDanger]
    }[kind];
    function drawPane() {
      var top = pane.scrollTop;
      pane.innerHTML = "";
      nameInput = null; inline = null; colorRedraw = null;
      sections.forEach(function (draw) { draw(); });
      pane.scrollTop = top;
      markDirty();
    }
    head.appendChild(closeButton);
    dlg.appendChild(head); dlg.appendChild(pane); dlg.appendChild(foot); dlg.appendChild(bar);
    bd.appendChild(dlg);
    overlayRoot.appendChild(bd);
    dlg.setAttribute("tabindex", "-1");

    function revert() {
      cal.color = original.color;
      state.customColors = original.customColors.slice();
      pendingName = null;
      renderSidebar(); renderView(false);
      drawPane(); paintHeader();
    }
    function finish() {
      settingsState.transactionActive = false;
      window.daylightCalendarOriginal = null;
      document.removeEventListener("keydown", onKey, true);
      if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
      renderSidebar(); renderView(false);
      if (window.daylightExit) window.daylightExit(bd); else bd.remove();
    }
    /* Unsaved changes: the pill is the ONLY gate. Closing does nothing while it is showing. */
    function requestClose() {
      var f = document.activeElement;
      if (f && dlg.contains(f) && f.tagName === "INPUT") f.blur();
      markDirty();
      if (isDirty()) { bar.classList.remove("is-nudge"); void bar.offsetWidth; bar.classList.add("is-nudge"); clearTimeout(bar._nudge); bar._nudge = setTimeout(function () { bar.classList.remove("is-nudge"); }, 1200); return; }
      finish();
    }
    function onKey(e) {
      if (e.key !== "Escape" || overlayRoot.lastElementChild !== bd) return;
      if (document.querySelector(".menu")) return;
      e.preventDefault(); e.stopPropagation(); requestClose();
    }
    document.addEventListener("keydown", onKey, true);
    closeButton.addEventListener("click", function (e) { e.stopPropagation(); requestClose(); });
    foot.querySelector("[data-done]").addEventListener("click", function () { requestClose(); });
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) requestClose(); });
    bar.querySelector("[data-discard]").addEventListener("click", function () { if (isDirty()) revert(); });
    bar.querySelector("[data-save]").addEventListener("click", async function () {
      var saveButton = this;
      if (saveButton.disabled || !isDirty()) return;
      if (nameInput && !currentName()) return;
      saveButton.disabled = true;
      var newName = nameInput ? currentName() : cal.name;
      try {
        if (kind === "subscribed") {
          var changes = { action: "update", id: cal.remoteSubscriptionId };
          if (newName !== original.name) changes.name = newName;
          if (cal.color !== original.color) changes.color = cal.color;
          var subs = window.daylightSubscriptions;
          await subs.call("ical-subscribe", changes);
          await subs.reload();
          cal = state.calendars.filter(function (c) { return c.remoteSubscriptionId === cal.remoteSubscriptionId; })[0] || cal;
          window.daylightCalendarOriginal = function (c) { return c === cal ? original : null; };
        } else if (kind === "shared") {
          state.shareColors = Object.assign({}, state.shareColors || {}); state.shareColors[cal.id] = cal.color;
          if (window.daylightCloud && window.daylightCloud.commit) window.daylightCloud.commit();
        } else {
          if (nameInput) cal.name = newName;
          if (window.daylightCloud && window.daylightCloud.commit) window.daylightCloud.commit();
        }
      } catch (e) {
        saveButton.disabled = false;
        bar.querySelector(".savebar-message").textContent = (e && e.message) || "Couldn’t save that change.";
        return;
      }
      original = { name: cal.name, color: cal.color, customColors: (state.customColors || []).slice() };
      pendingName = null;
      renderSidebar(); renderView(false); paintHeader();
      bar.classList.add("is-saved");
      bar.querySelector(".savebar-save-label").textContent = "Saved";
      bar.querySelector(".savebar-message").textContent = "Changes saved";
      setTimeout(function () {
        bar.classList.add("is-dismissing");
        setTimeout(function () {
          bar.hidden = true; bar.setAttribute("aria-hidden", "true");
          bar.classList.remove("is-saved", "is-dismissing");
          saveButton.disabled = false;
          bar.querySelector(".savebar-save-label").textContent = "Save changes";
          bar.querySelector(".savebar-message").textContent = "You have unsaved changes";
          markDirty();
        }, 180);
      }, 520);
    });
    drawPane();
    paintHeader();
    dlg.focus({ preventScroll: true });
  };
})();
