/* Notifications: messages the owner sends from the Admin dashboard ("broadcasts"), shown in the header bell's panel with an
   unread badge. Everyone can clear a message from their own list (for themselves only). The data lives behind database
   functions (supabase/sql/20261124_* and 20261125_*); targeting and the owner checks are enforced there, so nothing in
   this file is the protection. If those functions are not installed, everything here quietly shows the usual empty state.
   Sending, banners and removing for everyone live in the Admin dashboard (daylight-admin.js), not here. */
(function () {
  "use strict";
  var items = [], invites = [], unread = 0, owner = false, loaded = false, buttons = new Set(), pollTimer = null, panelRefresh = null, seq = 0;
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
    ".dl-notif-item.is-leaving{overflow:hidden}",
    ".dl-notif-person{flex:none}",
    ".dl-inv-body{display:block}",
    ".dl-inv-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 6px 0 1px;vertical-align:baseline;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}",
    ".dl-inv-cal{color:var(--text);font-weight:600}",
    ".dl-inv-permline{margin-top:2px;font-size:12px;color:var(--faint)}",
    ".dl-inv-slot{margin-top:10px}",
    ".dl-inv-actions{display:flex;gap:8px}",
    ".dl-inv-actions .btn-primary,.dl-inv-actions .btn-ghost{height:32px;padding:0 16px;font-size:13px;margin:0}",
    ".dl-inv-state{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--muted);animation:dlInvIn 200ms var(--ease-out)}",
    ".dl-inv-error{margin-top:8px;font-size:12px;color:var(--danger)}",
    "@keyframes dlInvIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}"

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
  /* A calendar invite counts toward the badge until it has been added or declined. */
  function pendingInvites() { return invites.filter(function (i) { return i.status === "pending"; }).length; }
  function settleOwner() {
    ownerKnown = true;
    ownerWaiters.splice(0).forEach(function (fn) { fn(owner); });
  }
  async function refresh() {
    var mine = ++seq;
    var list = [], isOwner = false;
    try { list = (await rpc("daylight_list_broadcasts")) || []; } catch (e) { list = []; }
    try { isOwner = (await rpc("daylight_is_owner")) === true; } catch (e) { isOwner = false; }   /* only an exact true shows owner-only UI */
    var inv = [];
    try { inv = (await rpc("daylight_list_my_invites")) || []; } catch (e) { inv = []; }
    if (mine !== seq) return;
    invites = Array.isArray(inv) ? inv : [];
    items = Array.isArray(list) ? list : [];
    owner = isOwner;
    loaded = true;
    /* ONE source for both the badge and the panel: the same list. */
    unread = items.filter(function (x) { return !x.read; }).length + pendingInvites();
    paint();
    settleOwner();
    if (panelRefresh) panelRefresh();
  }
  function reset() {
    seq++; items = []; invites = []; unread = 0; owner = false; loaded = false; ownerKnown = false;
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
  function personAvatar(inv) {
    if (window.daylightSharing && window.daylightSharing.avatar) {
      var a = window.daylightSharing.avatar({ name: inv.owner_name, avatar: inv.owner_avatar }, 36);
      a.classList.add("dl-notif-person");
      return a;
    }
    var d = document.createElement("span"); d.className = "dl-notif-avatar"; d.textContent = (inv.owner_name || "?").charAt(0).toUpperCase(); return d;
  }
  function colorHex(key) { return /^#[0-9a-f]{6}$/i.test(key || "") ? key : (window.PALETTE && PALETTE[key] ? PALETTE[key].dot : "#5B8DEF"); }
  function permissionText(p) { return p === "edit" ? "Can edit" : "View only"; }

  /* One calendar invite: the sender's picture, their name, "<Name> shared <dot> <Calendar> with you", the permission, the
     time, and Add / Decline. Answering updates this same card in place; while pending it cannot be cleared. */
  function inviteRow(inv, highlight, afterChange) {
    var row = document.createElement("div");
    row.className = "dl-notif-item dl-notif-invite" + (highlight ? " is-unread" : "");
    row.setAttribute("data-invite-id", inv.id);
    row.appendChild(personAvatar(inv));
    var main = document.createElement("div"); main.className = "dl-notif-main";
    var top = document.createElement("div"); top.className = "dl-notif-top";
    var from = document.createElement("span"); from.className = "dl-notif-from dl-inv-from"; from.textContent = inv.owner_name || "Someone";
    var time = document.createElement("span"); time.className = "dl-notif-time"; time.textContent = when(inv.created_at);
    top.appendChild(from); top.appendChild(time);
    var body = document.createElement("div"); body.className = "dl-notif-msg dl-inv-body";
    body.appendChild(document.createTextNode((inv.owner_name || "Someone") + " shared "));
    var dot = document.createElement("span"); dot.className = "dl-inv-dot"; dot.style.background = colorHex(inv.calendar_color);
    var cal = document.createElement("b"); cal.className = "dl-inv-cal"; cal.textContent = inv.calendar_name || "a calendar";
    body.appendChild(dot); body.appendChild(cal); body.appendChild(document.createTextNode(" with you"));
    var perm = document.createElement("div"); perm.className = "dl-inv-permline"; perm.textContent = permissionText(inv.permission);
    var slot = document.createElement("div"); slot.className = "dl-inv-slot";
    main.appendChild(top); main.appendChild(body); main.appendChild(perm); main.appendChild(slot);
    row.appendChild(main);
    var clearBtn = null;
    function addClear() {
      if (clearBtn) return;
      clearBtn = document.createElement("button");
      clearBtn.type = "button"; clearBtn.className = "dl-notif-clear"; clearBtn.title = "Clear";
      clearBtn.setAttribute("aria-label", "Clear notification: " + (inv.calendar_name || "calendar invite"));
      clearBtn.innerHTML = typeof icon === "function" ? icon("x", 14) : "×";
      clearBtn.addEventListener("click", async function (e) {
        e.stopPropagation(); clearBtn.disabled = true;
        try {
          await rpc("daylight_clear_calendar_invite", { p_id: inv.id });
          invites = invites.filter(function (x) { return x.id !== inv.id; });
          await collapse(row);
          afterChange(true);
        } catch (err) { clearBtn.disabled = false; }
      });
      row.appendChild(clearBtn);
    }
    function showState(text, icn) {
      slot.innerHTML = "";
      var st = document.createElement("div"); st.className = "dl-inv-state"; st.setAttribute("role", "status");
      st.innerHTML = (icn && typeof icon === "function" ? icon(icn, 14) : "") + "<span></span>";
      st.querySelector("span").textContent = text;
      slot.appendChild(st);
      row.classList.remove("is-unread");
      addClear();
    }
    if (inv.status === "accepted") showState("Added", "check");
    else if (inv.status === "declined") showState("Declined", null);
    else {
      var actions = document.createElement("div"); actions.className = "dl-inv-actions";
      var add = document.createElement("button"); add.type = "button"; add.className = "btn-primary dl-btn-sm"; add.textContent = "Add"; add.setAttribute("data-invite-add", "");
      var dec = document.createElement("button"); dec.type = "button"; dec.className = "btn-ghost dl-btn-sm"; dec.textContent = "Decline"; dec.setAttribute("data-invite-decline", "");
      actions.appendChild(add); actions.appendChild(dec); slot.appendChild(actions);
      var busy = false;
      var respond = async function (accept) {
        if (busy) return;
        busy = true; add.disabled = true; dec.disabled = true;
        try {
          await rpc("daylight_respond_calendar_share", { p_id: inv.id, p_accept: accept });
          inv.status = accept ? "accepted" : "declined";
          unread = items.filter(function (x) { return !x.read; }).length + pendingInvites();
          paint();
          slot.style.minHeight = slot.offsetHeight + "px";
          showState(accept ? "Added" : "Declined", accept ? "check" : null);
          if (accept && window.daylightSharing) window.daylightSharing.load();
        } catch (err) {
          busy = false; add.disabled = false; dec.disabled = false;
          slot.insertAdjacentHTML("beforeend", '<div class="dl-inv-error" role="alert">This invite is no longer available.</div>');
          setTimeout(function () { refresh(); }, 600);
        }
      };
      add.addEventListener("click", function () { respond(true); });
      dec.addEventListener("click", function () { respond(false); });
    }
    return row;
  }

  function mount(panel) {
    var wasUnread = {};
    var empty = panel.querySelector(".dl-notif-empty");
    function markSeen() {
      items.forEach(function (n) { if (!n.read) wasUnread[n.id] = true; });
      invites.forEach(function (i) { if (i.status === "pending") wasUnread["inv:" + i.id] = true; });
    }
    function render() {
      var old = panel.querySelector(".dl-notif-list"), spin = panel.querySelector(".dl-notif-loading");
      if (old) old.remove();
      if (spin) spin.remove();
      if (!loaded) {
        if (empty) empty.hidden = true;
        var l = document.createElement("div"); l.className = "dl-notif-loading"; l.textContent = "Loading…"; panel.appendChild(l);
        return;
      }
      var entries = items.map(function (n) { return { kind: "broadcast", at: n.created_at, n: n }; })
        .concat(invites.map(function (i) { return { kind: "invite", at: i.created_at, n: i }; }));
      entries.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
      if (empty) empty.hidden = entries.length > 0;
      if (!entries.length) return;
      var list = document.createElement("div");
      list.className = "dl-notif-list";
      entries.forEach(function (entry) {
        if (entry.kind === "invite") {
          list.appendChild(inviteRow(entry.n, !!wasUnread["inv:" + entry.n.id], function (removed) { if (removed && !panel.querySelector(".dl-notif-item")) render(); }));
          return;
        }
        var n = entry.n;
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
            unread = items.filter(function (x) { return !x.read; }).length + pendingInvites();
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
    var hasUnreadBroadcast = function () { return items.some(function (n) { return !n.read; }); };
    if (loaded && hasUnreadBroadcast()) {
      items.forEach(function (n) { n.read = true; });
      unread = pendingInvites(); paint();
      rpc("daylight_mark_broadcasts_read").catch(function () {});
    }
    panelRefresh = function () {
      if (!panel.isConnected) { panelRefresh = null; return; }
      markSeen(); render();
    };
    refresh().then(function () {
      if (panel.isConnected && hasUnreadBroadcast()) {
        rpc("daylight_mark_broadcasts_read").catch(function () {});
        items.forEach(function (n) { n.read = true; });
        unread = pendingInvites(); paint();
      }
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
