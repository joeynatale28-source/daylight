/* Notifications: messages the owner sends to everyone ("broadcasts"), shown in the header bell's panel with an unread
   badge. The data lives behind database functions (supabase/sql/20261124_broadcast_notifications.sql); the owner check is
   enforced there, so the composer below is only a convenience and never the protection. If those functions are not
   installed yet, everything here quietly shows the usual empty state. */
(function () {
  "use strict";
  var items = [], unread = 0, owner = false, buttons = new Set(), pollTimer = null, panelRefresh = null, seq = 0;

  var css = document.createElement("style");
  css.textContent = [
    ".dl-notif-btn{position:relative}",
    ".dl-notif-badge{position:absolute;top:3px;right:3px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 0 0 2px var(--bg);pointer-events:none;animation:popIn 160ms var(--ease-out)}",
    ".dl-notif-badge[hidden]{display:none}",
    ".dl-notif-empty[hidden]{display:none}",
    ".dl-notif-list{display:flex;flex-direction:column;max-height:min(420px,calc(100dvh - 190px));overflow-y:auto;margin:2px -2px 0;padding:0 2px}",
    ".dl-notif-item{position:relative;padding:12px 12px 12px 16px;border-radius:10px}",
    ".dl-notif-item+.dl-notif-item{margin-top:2px}",
    ".dl-notif-item.is-unread{background:var(--hover)}",
    ".dl-notif-item.is-unread::before{content:'';position:absolute;left:6px;top:19px;width:6px;height:6px;border-radius:50%;background:var(--accent)}",
    ".dl-notif-top{display:flex;align-items:baseline;gap:10px}",
    ".dl-notif-title{flex:1;min-width:0;font-size:13.5px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}",
    ".dl-notif-time{flex:none;font-size:11.5px;color:var(--faint)}",
    ".dl-notif-msg{margin-top:3px;font-size:13px;line-height:1.5;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere}",
    ".dl-notif-from{display:inline-block;margin-top:7px;font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--faint)}",
    ".dl-notif-foot{padding:8px 4px 0;border-top:1px solid var(--line-soft);margin-top:8px}",
    ".dl-notif-send{width:100%;justify-content:center;height:38px}",
    ".dl-bc-field{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}",
    ".dl-bc-field label{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}",
    ".dl-bc-field textarea{min-height:110px;resize:vertical;line-height:1.5}",
    ".dl-bc-count{align-self:flex-end;font-size:11.5px;color:var(--faint);margin-top:-3px}",
    ".dl-bc-note{font-size:12.5px;color:var(--muted);line-height:1.5;margin:-4px 0 16px}",
    ".dl-bc-error{margin:0 0 12px;padding:10px 12px;border-radius:10px;font-size:13px;color:var(--danger);background:color-mix(in srgb,var(--danger) 10%,transparent);border:1px solid color-mix(in srgb,var(--danger) 24%,transparent)}",
    ".dl-bc-error[hidden]{display:none}",
    ".dl-bc-sent-title{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:20px 0 8px}",
    ".dl-bc-sent{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line-soft)}",
    ".dl-bc-sent-text{flex:1;min-width:0;font-size:13px}",
    ".dl-bc-sent-text b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-bc-sent-text span{color:var(--faint);font-size:12px}"
  ].join("\n");
  document.head.appendChild(css);

  function cloud() { return window.daylightCloud; }
  async function rpc(name, args) {
    var c = cloud();
    if (!c || !c.client || !c.user) throw new Error("signed out");
    if (c.ensureSession) await c.ensureSession();
    var result = await c.client.rpc(name, args || {});
    if (result.error) throw result.error;
    return result.data;
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + " min ago";
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  }
  function paint() {
    /* The bell may have been drawn before this script ran (cached first paint), so find it here too. */
    document.querySelectorAll(".dl-notif-btn").forEach(function (b) { buttons.add(b); });
    buttons.forEach(function (b) {
      if (!b.isConnected) { buttons.delete(b); return; }
      var badge = b.querySelector(".dl-notif-badge");
      if (!badge) { badge = document.createElement("span"); badge.className = "dl-notif-badge"; badge.setAttribute("aria-hidden", "true"); b.appendChild(badge); }
      badge.hidden = unread < 1;
      badge.textContent = unread > 9 ? "9+" : String(unread);
      b.setAttribute("aria-label", unread ? "Notifications, " + unread + " unread" : "Notifications");
    });
  }
  async function refresh() {
    var mine = ++seq;
    var list = [], isOwner = false;
    try { list = (await rpc("daylight_list_broadcasts")) || []; } catch (e) { list = []; }
    try { isOwner = !!(await rpc("daylight_is_owner")); } catch (e) { isOwner = false; }
    if (mine !== seq) return;
    items = Array.isArray(list) ? list : [];
    owner = isOwner;
    unread = items.filter(function (x) { return !x.read; }).length;
    paint();
    if (panelRefresh) panelRefresh();
  }
  function reset() {
    seq++; items = []; unread = 0; owner = false;
    clearInterval(pollTimer); pollTimer = null; panelRefresh = null;
    paint();
  }
  function start() {
    refresh();
    clearInterval(pollTimer);
    pollTimer = setInterval(refresh, 5 * 60 * 1000);
  }

  /* ---- the bell panel ---- */
  function mount(panel) {
    var wasUnread = {};
    function render() {
      var old = panel.querySelector(".dl-notif-list"), oldFoot = panel.querySelector(".dl-notif-foot");
      if (old) old.remove();
      if (oldFoot) oldFoot.remove();
      var empty = panel.querySelector(".dl-notif-empty");
      if (empty) empty.hidden = items.length > 0;
      if (items.length) {
        var list = document.createElement("div");
        list.className = "dl-notif-list";
        items.forEach(function (n) {
          var row = document.createElement("div");
          row.className = "dl-notif-item" + (wasUnread[n.id] ? " is-unread" : "");
          var top = document.createElement("div"); top.className = "dl-notif-top";
          var title = document.createElement("span"); title.className = "dl-notif-title"; title.textContent = n.title;
          var time = document.createElement("span"); time.className = "dl-notif-time"; time.textContent = when(n.created_at);
          top.appendChild(title); top.appendChild(time);
          var msg = document.createElement("div"); msg.className = "dl-notif-msg"; msg.textContent = n.body;
          var from = document.createElement("span"); from.className = "dl-notif-from"; from.textContent = "From " + (n.sender || "daylight");
          row.appendChild(top); row.appendChild(msg); row.appendChild(from);
          list.appendChild(row);
        });
        panel.appendChild(list);
      }
      if (owner) {
        var foot = document.createElement("div"); foot.className = "dl-notif-foot";
        var send = document.createElement("button"); send.type = "button"; send.className = "btn-ghost dl-notif-send"; send.textContent = "Send notification to everyone";
        send.addEventListener("click", function () { if (window.closeNotifPanel) window.closeNotifPanel(); openComposer(); });
        foot.appendChild(send); panel.appendChild(foot);
      }
    }
    function markUnreadSeen() {
      items.forEach(function (n) { if (!n.read) wasUnread[n.id] = true; });
    }
    markUnreadSeen(); render();
    var openedWithUnread = unread > 0;
    if (openedWithUnread) {
      items.forEach(function (n) { n.read = true; });
      unread = 0; paint();
      rpc("daylight_mark_broadcasts_read").catch(function () {});
    }
    panelRefresh = function () {
      if (!panel.isConnected) { panelRefresh = null; return; }
      markUnreadSeen(); render();
    };
    refresh().then(function () {
      if (panel.isConnected && unread > 0) { rpc("daylight_mark_broadcasts_read").catch(function () {}); items.forEach(function (n) { n.read = true; }); unread = 0; paint(); }
    });
  }

  /* ---- the owner's composer ---- */
  function openComposer() {
    var root = document.getElementById("overlayRoot") || document.body;
    var bd = document.createElement("div");
    bd.className = "backdrop";
    bd.innerHTML = '<div class="dialog" role="dialog" aria-modal="true" aria-label="Send notification to everyone" style="width:min(480px,calc(100vw - 32px))">' +
      '<div class="dialog-head"><span class="dialog-title">Send notification to everyone</span></div>' +
      '<div class="dialog-body">' +
        '<p class="dl-bc-note">This appears in every daylight user’s notifications, marked as from daylight. Only your account can send it.</p>' +
        '<div class="dl-bc-error" role="alert" hidden></div>' +
        '<div class="dl-bc-field"><label for="dlBcTitle">Title</label><input class="text-input" id="dlBcTitle" maxlength="120" autocomplete="off" placeholder="What is this about?"></div>' +
        '<div class="dl-bc-field"><label for="dlBcBody">Message</label><textarea class="text-input" id="dlBcBody" maxlength="1000" placeholder="Write the message"></textarea><span class="dl-bc-count">0 / 1000</span></div>' +
        '<div data-sent></div>' +
      '</div>' +
      '<div class="dialog-foot"><button type="button" class="btn-ghost" data-cancel>Cancel</button><button type="button" class="btn-primary" data-send disabled>Send to everyone</button></div></div>';
    root.appendChild(bd);
    var dlg = bd.querySelector(".dialog"), title = bd.querySelector("#dlBcTitle"), body = bd.querySelector("#dlBcBody"),
        send = bd.querySelector("[data-send]"), err = bd.querySelector(".dl-bc-error"), count = bd.querySelector(".dl-bc-count"), sent = bd.querySelector("[data-sent]");
    var busy = false;
    function close() { document.removeEventListener("keydown", onKey, true); if (window.daylightExit) window.daylightExit(bd); else bd.remove(); }
    function onKey(e) { if (e.key === "Escape" && bd.isConnected) { e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    function sync() { count.textContent = body.value.length + " / 1000"; send.disabled = busy || !title.value.trim() || !body.value.trim(); }
    function say(m) { err.hidden = !m; err.textContent = m || ""; }
    function drawSent() {
      sent.innerHTML = "";
      var recent = items.slice(0, 5);
      if (!recent.length) return;
      var h = document.createElement("div"); h.className = "dl-bc-sent-title"; h.textContent = "Sent"; sent.appendChild(h);
      recent.forEach(function (n) {
        var row = document.createElement("div"); row.className = "dl-bc-sent";
        var t = document.createElement("div"); t.className = "dl-bc-sent-text";
        var b = document.createElement("b"); b.textContent = n.title; var s = document.createElement("span"); s.textContent = when(n.created_at);
        t.appendChild(b); t.appendChild(s);
        var rm = document.createElement("button"); rm.type = "button"; rm.className = "btn-ghost dl-btn-sm"; rm.textContent = "Remove"; rm.setAttribute("aria-label", "Remove " + n.title);
        rm.addEventListener("click", async function () {
          rm.disabled = true;
          try { await rpc("daylight_delete_broadcast", { p_id: n.id }); await refresh(); drawSent(); }
          catch (e) { rm.disabled = false; say("Couldn’t remove that notification. Try again."); }
        });
        row.appendChild(t); row.appendChild(rm); sent.appendChild(row);
      });
    }
    title.addEventListener("input", function () { say(""); sync(); });
    body.addEventListener("input", function () { say(""); sync(); });
    bd.querySelector("[data-cancel]").addEventListener("click", close);
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    send.addEventListener("click", async function () {
      if (busy || send.disabled) return;
      busy = true; sync(); send.textContent = "Sending…"; say("");
      try {
        await rpc("daylight_send_broadcast", { p_title: title.value.trim(), p_body: body.value.trim() });
        if (typeof toast === "function") toast("Notification sent to everyone.");
        close();
        refresh();
      } catch (e) {
        busy = false; send.textContent = "Send to everyone"; sync();
        say(/only the owner/i.test(String(e && e.message)) ? "Only the owner account can send notifications." : "Couldn’t send that. Check your connection and try again.");
      }
    });
    drawSent();
    title.focus();
  }

  window.daylightNotifications = {
    decorate: function (button) { buttons.add(button); paint(); },
    mount: mount,
    refresh: refresh,
    isOwner: function () { return owner; },
    unread: function () { return unread; }
  };
  /* The header is redrawn from time to time (view changes, cached first paint); keep the badge on whichever bell is there. */
  (function watchHeader() {
    var queued = false;
    var observer = new MutationObserver(function () {
      if (queued || !unread) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; var b = document.querySelector(".dl-notif-btn"); if (b && !b.querySelector(".dl-notif-badge")) paint(); });
    });
    var host = document.getElementById("app") || document.body;
    observer.observe(host, { childList: true, subtree: true });
  })();
  document.addEventListener("daylight:workspace-ready", start);
  document.addEventListener("daylight:workspace-signed-out", reset);
  if (cloud() && cloud().ready) start();
  window.addEventListener("focus", function () { if (cloud() && cloud().user && !document.hidden) refresh(); });
})();
