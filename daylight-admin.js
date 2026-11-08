/* Admin dashboard (Settings, owners only) and the banners it posts.
   - Banners: a colored strip at the very top of the app for exactly the people it was aimed at. They cannot be dismissed;
     only the owner removes them. (Listing is per account in the database, not in this file.)
   - Dashboard: send a notification (everyone, or specific people by email), post a banner, and manage / force-remove what
     was sent. The entry is only shown to owners, and every action is refused again by the database for anyone else. */
(function () {
  "use strict";
  /* Banners list only this account's own announcements; every owner action is re-checked by the database. */
  var banners = [], pollTimer = null, bannerSeq = 0, host = null;

  /* ------------------------------------------------------------------ banners (everyone) */
  var css = document.createElement("style");
  css.textContent = [
    "#dlBanners{position:relative;z-index:60;flex:none}",
    "#dlBanners:empty{display:none}",
    ".dl-banner{display:flex;align-items:center;justify-content:center;min-height:38px;padding:9px 18px;text-align:center;font-size:13.5px;font-weight:600;line-height:1.4;letter-spacing:-.005em;overflow-wrap:anywhere}",
    ".dl-banner+.dl-banner{border-top:1px solid rgba(0,0,0,.14)}",
    ".dl-banner a{color:inherit;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}",
    ".dl-banner a:hover{text-decoration-thickness:2px}",
    ".dl-banner a:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:3px}",
    /* dashboard */
    ".dl-ad-lead{font-size:12.5px;color:var(--muted);line-height:1.55;margin:-4px 0 14px}",
    ".dl-ad-field{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}",
    ".dl-ad-field>label,.dl-ad-label{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}",
    ".dl-ad-field textarea{min-height:104px;resize:vertical;line-height:1.5}",
    ".dl-ad-count{align-self:flex-end;font-size:11.5px;color:var(--faint);margin-top:-2px}",
    ".dl-ad-aud{display:inline-flex;background:var(--surface2);border:1px solid var(--line-soft);border-radius:999px;padding:3px;gap:2px;align-self:flex-start}",
    ".dl-ad-aud button{padding:6px 15px;border-radius:999px;font-size:13px;font-weight:550;color:var(--muted);transition:background 130ms var(--ease-out),color 130ms var(--ease-out)}",
    ".dl-ad-aud button:hover{color:var(--text)}",
    ".dl-ad-aud button[aria-checked=true]{background:var(--selected);color:var(--text)}",
    ".dl-ad-emails[hidden]{display:none}",
    ".dl-ad-note{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.5}",
    ".dl-ad-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:2px 0 6px}",
    ".dl-ad-status{font-size:13px;line-height:1.5;color:var(--muted);margin:0 0 8px}",
    ".dl-ad-status.is-ok{color:#238b59}.dl-ad-status.is-warn{color:var(--danger)}",
    ".dl-ad-status b{font-weight:650}",
    ".dl-ad-swatches{display:grid;grid-template-columns:repeat(10,1fr);justify-items:center;gap:10px 0}",
    ".dl-ad-preview{margin-top:14px;border-radius:10px;overflow:hidden;border:1px solid var(--line-soft)}",
    ".dl-ad-preview .dl-banner{min-height:36px}",
    ".dl-ad-list-empty{font-size:13px;color:var(--faint);padding:6px 0 10px}",
    ".dl-ad-item{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--line-soft)}",
    ".dl-ad-item:first-of-type{border-top:0}",
    ".dl-ad-item-text{flex:1;min-width:0}",
    ".dl-ad-item-title{font-size:14px;font-weight:550;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-ad-item-meta{margin-top:2px;font-size:12.5px;color:var(--muted);line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-ad-dot{flex:none;width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}",
    ".dl-ad-item .btn-danger-outline,.dl-ad-item .btn-ghost{flex:none}",
    "@media (max-width:639px){.dl-ad-item{align-items:flex-start;flex-wrap:wrap}.dl-ad-item-text{flex-basis:calc(100% - 30px)}.dl-ad-swatches{grid-template-columns:repeat(8,1fr)}}"
  ].join("\n");
  document.head.appendChild(css);

  function cloud() { return window.daylightCloud; }
  function api() { return window.daylightAdmin && window.daylightAdmin.rpc; }
  function hexOf(key) { return /^#[0-9a-f]{6}$/i.test(key) ? key.toUpperCase() : (window.PALETTE && PALETTE[key] ? PALETTE[key].dot : "#2563EB"); }
  /* Readable text for a background color: dark on light colors, white on dark ones. */
  function textOn(hex) {
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) return "#ffffff";
    var lin = function (v) { v = parseInt(v, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
    return L > 0.5 ? "#141414" : "#ffffff";
  }
  window.daylightBannerTextColor = textOn;

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function bannerNode(b) {
    var row = document.createElement("div");
    row.className = "dl-banner";
    row.setAttribute("role", "status");
    row.style.background = b.color;
    row.style.color = textOn(b.color);
    if (b.link && /^https?:\/\//i.test(b.link)) {
      var a = document.createElement("a");
      a.href = b.link; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = b.body;
      row.appendChild(a);
    } else row.textContent = b.body;
    return row;
  }
  function container() {
    if (host && host.isConnected) return host;
    host = document.getElementById("dlBanners");
    if (!host) {
      host = document.createElement("div");
      host.id = "dlBanners";
      host.setAttribute("role", "region");
      host.setAttribute("aria-label", "Announcements");
      var app = document.getElementById("app");
      if (app && app.parentNode) app.parentNode.insertBefore(host, app); else document.body.insertBefore(host, document.body.firstChild);
      if (window.ResizeObserver) new ResizeObserver(syncHeight).observe(host);
    }
    return host;
  }
  function syncHeight() {
    var h = host && host.isConnected ? Math.round(host.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--dl-banner-h", h + "px");
  }
  function drawBanners() {
    var h = container();
    h.innerHTML = "";
    banners.forEach(function (b) { h.appendChild(bannerNode(b)); });
    syncHeight();
  }
  async function refreshBanners() {
    var mine = ++bannerSeq;
    var list = [];
    try {
      var c = cloud();
      if (c && c.user && c.client) {
        if (c.ensureSession) await c.ensureSession();
        var res = await c.client.rpc("daylight_list_banners");
        if (!res.error && Array.isArray(res.data)) list = res.data;
      }
    } catch (e) { list = []; }
    if (mine !== bannerSeq) return;
    banners = list.filter(function (b) { return b && typeof b.body === "string" && /^#[0-9a-f]{6}$/i.test(b.color || ""); });
    drawBanners();
  }
  function startBanners() {
    refreshBanners();
    clearInterval(pollTimer);
    pollTimer = setInterval(refreshBanners, 60 * 1000);
  }
  function resetBanners() {
    bannerSeq++; banners = [];
    clearInterval(pollTimer); pollTimer = null;
    if (host && host.isConnected) { host.innerHTML = ""; }
    syncHeight();
  }
  window.daylightBanners = { refresh: refreshBanners, list: function () { return banners.slice(); } };
  document.addEventListener("daylight:workspace-ready", startBanners);
  document.addEventListener("daylight:workspace-signed-out", resetBanners);
  if (cloud() && cloud().ready) startBanners();
  window.addEventListener("focus", function () { if (cloud() && cloud().user && !document.hidden) refreshBanners(); });

  /* ------------------------------------------------------------------ the dashboard (owners) */
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function emailsFrom(text) {
    return String(text || "").split(/[,;\n]/).map(function (t) { return t.trim(); }).filter(Boolean).filter(function (e, i, a) { return a.indexOf(e) === i; });
  }
  function audienceControl(label) {
    var wrap = make('<div class="dl-ad-field"><span class="dl-ad-label">' + label + '</span>' +
      '<div class="dl-ad-aud" role="radiogroup" aria-label="' + label + '"><button type="button" role="radio" aria-checked="true" data-aud="everyone">Everyone</button><button type="button" role="radio" aria-checked="false" data-aud="specific">Specific people</button></div>' +
      '<div class="dl-ad-emails" hidden><input class="text-input" data-emails type="text" autocomplete="off" spellcheck="false" placeholder="name@example.com, other@example.com" aria-label="Email addresses"><div class="dl-ad-note">Separate addresses with commas. Only people with a daylight account can receive it.</div></div></div>');
    var mode = "everyone", input = wrap.querySelector("[data-emails]"), box = wrap.querySelector(".dl-ad-emails");
    wrap.querySelectorAll("[data-aud]").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.dataset.aud;
        wrap.querySelectorAll("[data-aud]").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        box.hidden = mode !== "specific";
        if (mode === "specific") input.focus();
        if (wrap._onChange) wrap._onChange();
      });
    });
    input.addEventListener("input", function () { if (wrap._onChange) wrap._onChange(); });
    wrap.value = function () { return mode === "specific" ? emailsFrom(input.value) : null; };
    wrap.valid = function () { return mode === "everyone" || emailsFrom(input.value).length > 0; };
    wrap.reset = function () { input.value = ""; };
    return wrap;
  }
  function report(statusEl, res, noun, everyoneWord) {
    statusEl.className = "dl-ad-status";
    var missing = (res && res.not_found) || [], matched = (res && res.matched) || [];
    var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    if (!res || !res.sent) {
      statusEl.classList.add("is-warn");
      statusEl.innerHTML = "<b>Nothing was sent.</b> No account matches " + (missing.length ? missing.map(esc).join(", ") : "those addresses") + ".";
      return;
    }
    statusEl.classList.add(missing.length ? "is-warn" : "is-ok");
    var who = res.audience === "everyone" ? (everyoneWord || "everyone") : (matched.length === 1 ? matched[0] : matched.length + " people");
    statusEl.innerHTML = noun + " sent to <b>" + esc(who) + "</b>." + (missing.length ? " <b>Not found:</b> " + missing.map(esc).join(", ") + " (nothing was sent to them)." : "");
  }
  function errorText(e, fallback) {
    var m = String((e && e.message) || "");
    if (/only the owner/i.test(m)) return "Only the owner account can do this.";
    if (/Title must|Message must|Banner text|banner color|link must|Too many/i.test(m)) return m.replace(/^error:\s*/i, "");
    return fallback;
  }

  window.daylightAdminPane = function (pane) {
    paneHead(pane, "Admin dashboard", "Send notifications and banners to the people using daylight. Only owner accounts see this page.");
    var call = function (name, args) { return window.daylightAdmin.rpc(name, args); };

    /* a) send a notification */
    var send = make('<div class="set-group"><div class="set-group-title">Send notification</div>' +
      '<p class="dl-ad-lead">Appears in the bell for the people you choose, marked as an official daylight notification.</p>' +
      '<div class="dl-ad-field"><label for="adTitle">Title</label><input class="text-input" id="adTitle" maxlength="120" autocomplete="off" placeholder="What is this about?"></div>' +
      '<div class="dl-ad-field"><label for="adBody">Message</label><textarea class="text-input" id="adBody" maxlength="1000" placeholder="Write the message"></textarea><span class="dl-ad-count">0 / 1000</span></div>' +
      '<div data-aud-host></div>' +
      '<div class="dl-ad-status" role="status" aria-live="polite" data-status></div>' +
      '<div class="dl-ad-actions"><button type="button" class="btn-primary" data-send disabled>Send notification</button></div></div>');
    var aud = audienceControl("Audience");
    send.querySelector("[data-aud-host]").appendChild(aud);
    var title = send.querySelector("#adTitle"), body = send.querySelector("#adBody"), sendBtn = send.querySelector("[data-send]"), st = send.querySelector("[data-status]");
    var syncSend = function () { send.querySelector(".dl-ad-count").textContent = body.value.length + " / 1000"; sendBtn.disabled = !title.value.trim() || !body.value.trim() || !aud.valid(); };
    [title, body].forEach(function (n) { n.addEventListener("input", function () { st.textContent = ""; syncSend(); }); });
    aud._onChange = function () { st.textContent = ""; syncSend(); };
    sendBtn.addEventListener("click", async function () {
      if (sendBtn.disabled) return;
      sendBtn.disabled = true; sendBtn.textContent = "Sending…"; st.textContent = "";
      try {
        var res = await call("daylight_send_notification", { p_title: title.value.trim(), p_body: body.value.trim(), p_emails: aud.value() });
        report(st, res, "Notification");
        if (res && res.sent) { title.value = ""; body.value = ""; aud.reset(); if (window.daylightNotifications) window.daylightNotifications.refresh(); drawManage(); }
      } catch (e) { st.className = "dl-ad-status is-warn"; st.textContent = errorText(e, "Couldn’t send that. Check your connection and try again."); }
      sendBtn.textContent = "Send notification"; syncSend();
    });
    pane.appendChild(send);

    /* b) post a banner */
    var presets = (window.daylightPresetColors || []).slice(0, 30);
    var picked = hexOf(presets[0] || "#2563EB");
    var ban = make('<div class="set-group"><div class="set-group-title">Banner</div>' +
      '<p class="dl-ad-lead">A colored strip at the very top of the app. People cannot dismiss it; it stays until you remove it below.</p>' +
      '<div class="dl-ad-field"><label for="adBanner">Banner text</label><input class="text-input" id="adBanner" maxlength="200" autocomplete="off" placeholder="What should it say?"></div>' +
      '<div class="dl-ad-field"><span class="dl-ad-label">Color</span><div class="dl-ad-swatches" data-swatches></div><div data-picker></div></div>' +
      '<div class="dl-ad-field"><label for="adLink">Link (optional)</label><input class="text-input" id="adLink" type="url" autocomplete="off" spellcheck="false" placeholder="https://"><div class="dl-ad-note">If set, clicking the banner text opens it in a new tab.</div></div>' +
      '<div data-aud-host></div>' +
      '<div class="dl-ad-field"><span class="dl-ad-label">Preview</span><div class="dl-ad-preview" data-preview></div></div>' +
      '<div class="dl-ad-status" role="status" aria-live="polite" data-status></div>' +
      '<div class="dl-ad-actions"><button type="button" class="btn-primary" data-post disabled>Post banner</button></div></div>');
    var baud = audienceControl("Audience");
    ban.querySelector("[data-aud-host]").appendChild(baud);
    var btext = ban.querySelector("#adBanner"), blink = ban.querySelector("#adLink"), post = ban.querySelector("[data-post]"), bst = ban.querySelector("[data-status]"), prev = ban.querySelector("[data-preview]"), sw = ban.querySelector("[data-swatches]");
    var picker = null;
    function drawPreview() { prev.innerHTML = ""; prev.appendChild(bannerNode({ body: btext.value.trim() || "Your banner text", color: picked, link: null })); }
    function drawSwatches() {
      sw.innerHTML = "";
      presets.forEach(function (key) {
        var hex = hexOf(key);
        var b = make('<button type="button" class="dl-sw" aria-pressed="' + (picked === hex) + '" title="' + hex + '" aria-label="Color ' + hex + '">' + (typeof icon === "function" ? icon("check", 14) : "") + "</button>");
        b.style.setProperty("--c", hex);
        b.addEventListener("click", function () { picked = hex; if (picker) picker.set(hex); drawSwatches(); drawPreview(); });
        sw.appendChild(b);
      });
    }
    if (window.daylightInlineColorPicker) picker = window.daylightInlineColorPicker(ban.querySelector("[data-picker]"), picked, function (hex) { picked = String(hex).toUpperCase(); drawSwatches(); drawPreview(); }, { compact: true });
    var syncPost = function () { post.disabled = !btext.value.trim() || !baud.valid(); };
    btext.addEventListener("input", function () { bst.textContent = ""; drawPreview(); syncPost(); });
    blink.addEventListener("input", function () { bst.textContent = ""; });
    baud._onChange = function () { bst.textContent = ""; syncPost(); };
    post.addEventListener("click", async function () {
      if (post.disabled) return;
      var link = blink.value.trim();
      if (link && !/^https?:\/\/\S+$/i.test(link)) { bst.className = "dl-ad-status is-warn"; bst.textContent = "The link must start with http:// or https://"; return; }
      post.disabled = true; post.textContent = "Posting…"; bst.textContent = "";
      try {
        var res = await call("daylight_send_banner", { p_body: btext.value.trim(), p_color: picked, p_link: link || null, p_emails: baud.value() });
        report(bst, res, "Banner", "everyone");
        if (res && res.sent) { btext.value = ""; blink.value = ""; baud.reset(); drawPreview(); if (window.daylightBanners) window.daylightBanners.refresh(); drawManage(); }
      } catch (e) { bst.className = "dl-ad-status is-warn"; bst.textContent = errorText(e, "Couldn’t post that. Check your connection and try again."); }
      post.textContent = "Post banner"; syncPost();
    });
    drawSwatches(); drawPreview();
    pane.appendChild(ban);

    /* c) manage */
    var manage = make('<div class="set-group"><div class="set-group-title">Notifications sent</div><div data-notes><div class="dl-ad-list-empty">Loading…</div></div></div>');
    var manageB = make('<div class="set-group"><div class="set-group-title">Active banners</div><div data-banners><div class="dl-ad-list-empty">Loading…</div></div></div>');
    pane.appendChild(manage); pane.appendChild(manageB);
    function audienceText(x) { return x.audience === "everyone" ? "Everyone" : "To " + ((x.recipients && x.recipients.length) ? x.recipients.join(", ") : "specific people"); }
    function removeRow(btn, label, name, args, after) {
      btn.addEventListener("click", function () {
        openConfirm({ title: label.title, body: label.body, confirmLabel: label.confirm, danger: true, fn: async function () {
          btn.disabled = true;
          try { await call(name, args); } catch (e) { btn.disabled = false; return; }
          await after();
        } });
      });
    }
    async function drawManage() {
      var notes = manage.querySelector("[data-notes]"), bans = manageB.querySelector("[data-banners]");
      var list = [], blist = [];
      try { list = (await call("daylight_admin_list_notifications")) || []; } catch (e) { list = null; }
      try { blist = (await call("daylight_admin_list_banners")) || []; } catch (e) { blist = null; }
      if (!notes.isConnected) return;
      notes.innerHTML = "";
      if (list === null) notes.appendChild(make('<div class="dl-ad-list-empty">Couldn’t load this list.</div>'));
      else if (!list.length) notes.appendChild(make('<div class="dl-ad-list-empty">Nothing sent yet.</div>'));
      else list.forEach(function (n) {
        var row = make('<div class="dl-ad-item"><div class="dl-ad-item-text"><div class="dl-ad-item-title"></div><div class="dl-ad-item-meta"></div></div><button type="button" class="btn-danger-outline dl-btn-sm" data-force>Force remove</button></div>');
        row.querySelector(".dl-ad-item-title").textContent = n.title;
        row.querySelector(".dl-ad-item-meta").textContent = audienceText(n) + " · " + when(n.created_at);
        var btn = row.querySelector("[data-force]"); btn.setAttribute("aria-label", "Force remove " + n.title);
        removeRow(btn, { title: "Force remove this notification?", body: "“" + n.title + "” disappears from everyone’s notifications right away, including people who already read it.", confirm: "Force remove" }, "daylight_delete_broadcast", { p_id: n.id }, async function () { await drawManage(); if (window.daylightNotifications) window.daylightNotifications.refresh(); });
        notes.appendChild(row);
      });
      bans.innerHTML = "";
      if (blist === null) bans.appendChild(make('<div class="dl-ad-list-empty">Couldn’t load this list.</div>'));
      else if (!blist.length) bans.appendChild(make('<div class="dl-ad-list-empty">No banners are showing.</div>'));
      else blist.forEach(function (b) {
        var row = make('<div class="dl-ad-item"><span class="dl-ad-dot" aria-hidden="true"></span><div class="dl-ad-item-text"><div class="dl-ad-item-title"></div><div class="dl-ad-item-meta"></div></div><button type="button" class="btn-ghost dl-btn-sm" data-remove>Remove</button></div>');
        row.querySelector(".dl-ad-dot").style.background = b.color;
        row.querySelector(".dl-ad-item-title").textContent = b.body;
        row.querySelector(".dl-ad-item-meta").textContent = audienceText(b) + (b.link ? " · links to " + b.link : "") + " · " + when(b.created_at);
        var btn = row.querySelector("[data-remove]"); btn.setAttribute("aria-label", "Remove banner " + b.body);
        removeRow(btn, { title: "Remove this banner?", body: "It disappears from everyone’s screen.", confirm: "Remove" }, "daylight_delete_banner", { p_id: b.id }, async function () { await drawManage(); if (window.daylightBanners) window.daylightBanners.refresh(); });
        bans.appendChild(row);
      });
    }
    drawManage();
  };
})();
