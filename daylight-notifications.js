/* Notifications: messages the owner sends from the Admin dashboard ("broadcasts"), shown in the header bell's panel with an
   unread badge. Everyone can clear a message from their own list (for themselves only). The data lives behind database
   functions (supabase/sql/20261124_* and 20261125_*); targeting and the owner checks are enforced there, so nothing in
   this file is the protection. If those functions are not installed, everything here quietly shows the usual empty state.
   Sending, banners and removing for everyone live in the Admin dashboard (daylight-admin.js), not here. */
(function () {
  "use strict";
  var items = [], unread = 0, owner = false, loaded = false, buttons = new Set(), pollTimer = null, panelRefresh = null, seq = 0;
  var ownerWaiters = [], ownerKnown = false;

  var css = document.createElement("style");
  css.textContent = [
    ".dl-notif-btn{position:relative}",
    ".dl-notif-badge{position:absolute;top:3px;right:3px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 0 0 2px var(--bg);pointer-events:none;animation:popIn 160ms var(--ease-out)}",
    ".dl-notif-badge[hidden]{display:none}",
    ".dl-notif-empty[hidden]{display:none}",
    ".dl-notif-loading{padding:26px 16px;text-align:center;font-size:12.5px;color:var(--faint)}",
    ".dl-notif-list{display:flex;flex-direction:column;max-height:min(440px,calc(100dvh - 130px));overflow-y:auto;margin:2px -2px 0;padding:0 2px}",
    ".dl-notif-item{position:relative;display:flex;gap:12px;align-items:flex-start;padding:12px 10px 12px 12px;border-radius:12px;transition:background 140ms var(--ease-out)}",
    ".dl-notif-item+.dl-notif-item{margin-top:2px}",
    ".dl-notif-item.is-unread{background:var(--hover)}",
    ".dl-notif-item.is-unread .dl-notif-from::after{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:7px;vertical-align:middle}",
    ".dl-notif-avatar{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--surface2,var(--hover));border:1px solid var(--line-soft)}",
    ".dl-notif-avatar img{width:20px;height:20px;object-fit:contain;display:block}",
    ".dl-notif-avatar .daylight-mark-dark{display:none}",
    "[data-theme=\"dark\"] .dl-notif-avatar .daylight-mark-light{display:none}",
    "[data-theme=\"dark\"] .dl-notif-avatar .daylight-mark-dark{display:block}",
    ".dl-notif-main{flex:1;min-width:0}",
    ".dl-notif-top{display:flex;align-items:baseline;gap:10px}",
    ".dl-notif-from{font-size:12px;font-weight:650;color:var(--muted);letter-spacing:.01em}",
    ".dl-notif-time{margin-left:auto;flex:none;font-size:11.5px;color:var(--faint)}",
    ".dl-notif-title{margin-top:3px;font-size:13.5px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}",
    ".dl-notif-msg{margin-top:3px;font-size:13px;line-height:1.5;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere}",
    ".dl-notif-official{margin-top:8px;font-size:10.5px;line-height:1.3;color:var(--faint);letter-spacing:.02em}",
    ".dl-notif-clear{flex:none;width:26px;height:26px;margin:-2px -2px 0 0;border-radius:8px;display:grid;place-items:center;color:var(--faint);opacity:0;transition:opacity 140ms var(--ease-out),background 140ms var(--ease-out),color 140ms var(--ease-out)}",
    ".dl-notif-item:hover .dl-notif-clear,.dl-notif-clear:focus-visible{opacity:1}",
    "@media (hover:none){.dl-notif-clear{opacity:1}}",
    ".dl-notif-clear:hover{background:var(--hover);color:var(--text)}",
    ".dl-notif-item.is-leaving{overflow:hidden}"
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
  function settleOwner() {
    ownerKnown = true;
    ownerWaiters.splice(0).forEach(function (fn) { fn(owner); });
  }
  async function refresh() {
    var mine = ++seq;
    var list = [], isOwner = false;
    try { list = (await rpc("daylight_list_broadcasts")) || []; } catch (e) { list = []; }
    try { isOwner = (await rpc("daylight_is_owner")) === true; } catch (e) { isOwner = false; }   /* only an exact true shows owner-only UI */
    if (mine !== seq) return;
    items = Array.isArray(list) ? list : [];
    owner = isOwner;
    loaded = true;
    /* ONE source for both the badge and the panel: the same list. */
    unread = items.filter(function (x) { return !x.read; }).length;
    paint();
    settleOwner();
    if (panelRefresh) panelRefresh();
  }
  function reset() {
    seq++; items = []; unread = 0; owner = false; loaded = false; ownerKnown = false;
    clearInterval(pollTimer); pollTimer = null; panelRefresh = null;
    paint();
  }
  function start() {
    loaded = false;
    refresh();
    clearInterval(pollTimer);
    pollTimer = setInterval(refresh, 5 * 60 * 1000);
  }

  function collapse(row) {
    return new Promise(function (resolve) {
      var reduce = document.body.classList.contains("reduce-motion") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (reduce || !row.isConnected) { row.remove(); resolve(); return; }
      var h = row.offsetHeight;
      row.classList.add("is-leaving");
      row.style.height = h + "px"; row.style.boxSizing = "border-box";
      row.style.transition = "height 200ms var(--ease-out), opacity 160ms ease, padding 200ms var(--ease-out), margin 200ms var(--ease-out)";
      row.getBoundingClientRect();
      row.style.height = "0px"; row.style.opacity = "0"; row.style.paddingTop = "0"; row.style.paddingBottom = "0"; row.style.marginTop = "0";
      setTimeout(function () { row.remove(); resolve(); }, 230);
    });
  }

  /* ---- the bell panel ---- */
  function logoPair() {
    var span = document.createElement("span");
    span.className = "dl-notif-avatar";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<img class="daylight-mark daylight-mark-light" src="./assets/daylight-sunarc-light-NOBG.png" alt="" width="20" height="20">' +
      '<img class="daylight-mark daylight-mark-dark" src="./assets/daylight-sunarc-dark-NOBG.png" alt="" width="20" height="20">';
    return span;
  }
  function mount(panel) {
    var wasUnread = {};
    var empty = panel.querySelector(".dl-notif-empty");
    function markSeen() { items.forEach(function (n) { if (!n.read) wasUnread[n.id] = true; }); }
    function render() {
      var old = panel.querySelector(".dl-notif-list"), spin = panel.querySelector(".dl-notif-loading");
      if (old) old.remove();
      if (spin) spin.remove();
      if (!loaded) {
        if (empty) empty.hidden = true;
        var l = document.createElement("div"); l.className = "dl-notif-loading"; l.textContent = "Loading…"; panel.appendChild(l);
        return;
      }
      if (empty) empty.hidden = items.length > 0;
      if (!items.length) return;
      var list = document.createElement("div");
      list.className = "dl-notif-list";
      items.forEach(function (n) {
        var row = document.createElement("div");
        row.className = "dl-notif-item" + (wasUnread[n.id] ? " is-unread" : "");
        row.setAttribute("data-id", n.id);
        row.appendChild(logoPair());
        var main = document.createElement("div"); main.className = "dl-notif-main";
        var top = document.createElement("div"); top.className = "dl-notif-top";
        var from = document.createElement("span"); from.className = "dl-notif-from"; from.textContent = n.sender || "daylight";
        var time = document.createElement("span"); time.className = "dl-notif-time"; time.textContent = when(n.created_at);
        top.appendChild(from); top.appendChild(time);
        var title = document.createElement("div"); title.className = "dl-notif-title"; title.textContent = n.title;
        var msg = document.createElement("div"); msg.className = "dl-notif-msg"; msg.textContent = n.body;
        var official = document.createElement("div"); official.className = "dl-notif-official"; official.textContent = "Official daylight notification";
        main.appendChild(top); main.appendChild(title); main.appendChild(msg); main.appendChild(official);
        row.appendChild(main);
        var clear = document.createElement("button");
        clear.type = "button"; clear.className = "dl-notif-clear"; clear.title = "Clear"; clear.setAttribute("aria-label", "Clear notification: " + n.title);
        clear.innerHTML = typeof icon === "function" ? icon("x", 14) : "×";
        clear.addEventListener("click", async function (e) {
          e.stopPropagation();
          clear.disabled = true;
          try {
            await rpc("daylight_clear_broadcast", { p_id: n.id });
            items = items.filter(function (x) { return x.id !== n.id; });
            unread = items.filter(function (x) { return !x.read; }).length;
            paint();
            await collapse(row);
            if (!panel.querySelector(".dl-notif-item")) render();
          } catch (err) { clear.disabled = false; }
        });
        row.appendChild(clear);
        list.appendChild(row);
      });
      panel.appendChild(list);
    }
    markSeen(); render();
    if (loaded && unread > 0) {
      items.forEach(function (n) { n.read = true; });
      unread = 0; paint();
      rpc("daylight_mark_broadcasts_read").catch(function () {});
    }
    panelRefresh = function () {
      if (!panel.isConnected) { panelRefresh = null; return; }
      markSeen(); render();
    };
    refresh().then(function () {
      if (panel.isConnected && unread > 0) { rpc("daylight_mark_broadcasts_read").catch(function () {}); items.forEach(function (n) { n.read = true; }); unread = 0; paint(); }
    });
  }

  window.daylightNotifications = {
    decorate: function (button) { buttons.add(button); paint(); },
    mount: mount,
    refresh: refresh,
    isOwner: function () { return owner; },
    unread: function () { return unread; },
    items: function () { return items.slice(); }
  };
  /* The Admin dashboard asks this: is the signed-in account an owner? (The database re-checks every admin action itself.) */
  window.daylightAdmin = window.daylightAdmin || {};
  window.daylightAdmin.isOwner = function () { return owner; };
  window.daylightAdmin.whenKnown = function () { return ownerKnown ? Promise.resolve(owner) : new Promise(function (res) { ownerWaiters.push(res); setTimeout(function () { res(owner); }, 6000); }); };
  window.daylightAdmin.rpc = rpc;

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
