/* Support and the Admin page.
   - Sidebar (Support section, above Settings): "Documentation" (no link yet), "Support ticket", and, for owners only, "Admin".
   - Support ticket: a popup in the Create Event dialog language. A person who already has an open ticket gets their Support window instead.
   - The Support window and the owner's Admin page swap into the main area exactly like Tasks does (the sidebar stays).
   - Admin page: Notifications / Banners / Support. The first two reuse the dashboard that used to live in Settings (daylight-admin.js).
   - Support threads are one chat UI used by both sides. Everything is stored and permission-checked by the database functions in
     supabase/sql/20261129_support_tickets.sql; a support reply notifies exactly ONE person (the ticket's owner). */
(function () {
  "use strict";
  var myTickets = [], pollTimer = null, activeBoard = null, adminKnown = false;

  /* ---- icons used here ---- */
  if (window.ICONS) {
    ICONS.book = '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>';
    ICONS.send = '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>';
    ICONS.ticket = '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>';
    ICONS.chat = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';
  }

  var css = document.createElement("style");
  css.textContent = [
    /* the page shell (Support window and Admin page) */
    ".dl-page{flex:1;min-height:0;overflow-y:auto;padding:28px 36px 44px;animation:viewFade 200ms var(--ease-out)}",
    ".dl-page-inner{max-width:1040px;margin:0 auto}",
    ".dl-page-head{display:flex;align-items:center;gap:16px;margin:0 0 20px}",
    ".dl-page-title{font-size:24px;font-weight:650;letter-spacing:-.024em;margin:0;flex:1;min-width:0}",
    ".dl-page .set-group{margin-bottom:20px;padding:22px 26px}",
    ".dl-page .set-group:last-child{margin-bottom:0}",
    ".dl-tabs{display:inline-flex;background:var(--surface2);border:1px solid var(--line-soft);border-radius:999px;padding:3px;gap:2px;margin:0 0 20px;max-width:100%;overflow-x:auto}",
    ".dl-tabs button{padding:7px 18px;border-radius:999px;font-size:13.5px;font-weight:550;color:var(--muted);white-space:nowrap;position:relative;transition:background 160ms var(--ease-out),color 160ms var(--ease-out)}",
    ".dl-tabs button:hover{color:var(--text)}",
    ".dl-tabs button[aria-selected=true]{background:var(--selected);color:var(--text)}",
    ".dl-tabs .dl-tab-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-left:7px;vertical-align:middle}",
    /* the board: ticket list + chat */
    ".dl-board{display:grid;grid-template-columns:minmax(240px,320px) minmax(0,1fr);gap:20px;align-items:start}",
    ".dl-board .set-group{margin:0;padding:0;overflow:hidden}",
    ".dl-tk-list{display:flex;flex-direction:column;max-height:min(620px,calc(100dvh - 250px));overflow-y:auto}",
    ".dl-tk-row{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;padding:14px 18px;transition:background 160ms var(--ease-out)}",
    ".dl-tk-row:hover{background:var(--hover)}",
    ".dl-tk-row[aria-current=true]{background:var(--selected)}",
    ".dl-tk-main{flex:1;min-width:0}",
    ".dl-tk-top{display:flex;align-items:baseline;gap:8px}",
    ".dl-tk-subject{flex:1;min-width:0;font-size:14px;font-weight:600;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-tk-time{flex:none;font-size:11.5px;color:var(--faint)}",
    ".dl-tk-who{font-size:12.5px;color:var(--muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-tk-snip{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".dl-tk-state{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11.5px;font-weight:600;color:var(--muted)}",
    ".dl-tk-state i{width:7px;height:7px;border-radius:50%;background:#22a06b;display:inline-block}",
    ".dl-tk-state.is-closed i{background:var(--faint)}",
    ".dl-tk-unread{width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none;margin-top:6px}",
    ".dl-tk-empty{padding:26px 20px;font-size:13.5px;color:var(--faint);line-height:1.55}",
    /* chat */
    ".dl-chat{display:flex;flex-direction:column;min-height:420px;max-height:min(680px,calc(100dvh - 210px))}",
    ".dl-chat-head{display:flex;align-items:center;gap:12px;padding:18px 22px 14px}",
    ".dl-chat-title{flex:1;min-width:0}",
    ".dl-chat-title b{display:block;font-size:16px;font-weight:620;letter-spacing:-.012em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-chat-title span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-chat-scroll{flex:1;min-height:0;overflow-y:auto;padding:6px 22px 14px;display:flex;flex-direction:column;gap:18px}",
    ".dl-msg{display:flex;gap:12px;align-items:flex-start;animation:dlMsgIn 200ms var(--ease-out) both}",
    "@keyframes dlMsgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    ".dl-msg-av{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--surface2);border:1px solid var(--line-soft);overflow:hidden}",
    ".dl-msg-av img.mark{width:20px;height:20px;object-fit:contain}",
    ".dl-msg-av .daylight-mark-dark{display:none}",
    "[data-theme=\"dark\"] .dl-msg-av .daylight-mark-light{display:none}[data-theme=\"dark\"] .dl-msg-av .daylight-mark-dark{display:block}",
    ".dl-msg-body{flex:1;min-width:0}",
    ".dl-msg-meta{display:flex;align-items:baseline;gap:9px}",
    ".dl-msg-name{font-size:13.5px;font-weight:650}",
    ".dl-msg-time{font-size:11.5px;color:var(--faint)}",
    ".dl-msg-text{margin-top:3px;font-size:14px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".dl-typing{display:flex;gap:12px;align-items:center;animation:dlMsgIn 200ms var(--ease-out) both}",
    ".dl-dots{display:inline-flex;gap:4px;align-items:center;height:20px}",
    ".dl-dots i{width:6px;height:6px;border-radius:50%;background:var(--muted);opacity:.35;animation:dlDot 900ms ease-in-out infinite}",
    ".dl-dots i:nth-child(2){animation-delay:150ms}.dl-dots i:nth-child(3){animation-delay:300ms}",
    "@keyframes dlDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}",
    ".dl-chat-compose{display:flex;align-items:flex-end;gap:12px;padding:14px 22px 20px}",
    ".dl-chat-compose textarea{flex:1;min-height:44px;max-height:160px;resize:none;line-height:1.5;padding:11px 16px;border-radius:12px}",
    ".dl-chat-compose .btn-primary{height:44px;padding:0 20px;margin:0;flex:none}",
    ".dl-chat-note{padding:0 22px 20px;font-size:13px;color:var(--muted)}",
    ".dl-chat-empty{flex:1;display:grid;place-items:center;text-align:center;color:var(--faint);font-size:14px;line-height:1.55;padding:40px 24px}",
    "@media (max-width:820px){.dl-page{padding:20px 16px 36px}.dl-board{grid-template-columns:1fr}.dl-tk-list{max-height:260px}.dl-chat{max-height:none;min-height:380px}}",
    /* sidebar rows */
    /* the ticket popup */
    ".dl-ticket .text-area{border-radius:12px;min-height:128px;padding:12px 16px;line-height:1.5}",
    ".dl-ticket .dl-tk-ok{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:18px 0 10px}",
    ".dl-ticket .dl-tk-ok-ic{width:44px;height:44px;border-radius:50%;background:color-mix(in srgb,#22a06b 16%,transparent);color:#22a06b;display:grid;place-items:center}",
    ".dl-ticket .dl-tk-ok b{font-size:17px;font-weight:620}",
    ".dl-ticket .dl-tk-ok span{font-size:14px;color:var(--muted);line-height:1.5}"
  ].join("\n");
  document.head.appendChild(css);

  /* ---------------------------------------------------------------- helpers */
  function cloud() { return window.daylightCloud; }
  async function rpc(name, args) {
    var c = cloud();
    if (!c || !c.client || !c.user) throw new Error("signed out");
    if (c.ensureSession) await c.ensureSession();
    var r = await c.client.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function reduced() { return !!((window.state && state.reduceMotion) || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  }
  function exactTime(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function logoAvatar() {
    var s = document.createElement("span"); s.className = "dl-msg-av"; s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<img class="mark daylight-mark daylight-mark-light" src="./assets/daylight-sunarc-light-NOBG.png" alt="" width="20" height="20"><img class="mark daylight-mark daylight-mark-dark" src="./assets/daylight-sunarc-dark-NOBG.png" alt="" width="20" height="20">';
    return s;
  }
  function personAvatar(name, url) {
    if (window.daylightSharing && window.daylightSharing.avatar) { var a = window.daylightSharing.avatar({ name: name, avatar: url }, 34); a.classList.add("dl-msg-av"); return a; }
    var d = document.createElement("span"); d.className = "dl-msg-av"; d.textContent = (name || "?").charAt(0).toUpperCase(); return d;
  }
  function friendly(e, fallback) {
    var m = String((e && e.message) || "");
    if (/valid email|Enter your name|Enter a subject|Write a message|several open requests/i.test(m)) return m.replace(/^error:\s*/i, "");
    return fallback || "Something went wrong. Please try again.";
  }
  function isOwner() { return !!(window.daylightAdmin && window.daylightAdmin.isOwner && window.daylightAdmin.isOwner()); }

  /* ---------------------------------------------------------------- my tickets (for the sidebar row) */
  async function refreshMine() {
    try { myTickets = (await rpc("daylight_support_my_tickets")) || []; } catch (e) { myTickets = []; }
    return myTickets;
  }
  function hasOpen() { return myTickets.some(function (t) { return t.status === "open"; }); }

  /* ---------------------------------------------------------------- the chat */
  /* One chat for both sides. cfg: { mode: "user"|"admin", ticket, onChanged() }. */
  function buildChat(cfg) {
    var t = cfg.ticket, admin = cfg.mode === "admin";
    var root = make('<div class="dl-chat"><div class="dl-chat-head"><div class="dl-chat-title"><b></b><span></span></div><span data-actions></span></div>' +
      '<div class="dl-chat-scroll" role="log" aria-live="polite" aria-label="Conversation"></div><div data-foot></div></div>');
    var scroll = root.querySelector(".dl-chat-scroll"), actions = root.querySelector("[data-actions]"), foot = root.querySelector("[data-foot]");
    root.querySelector(".dl-chat-title b").textContent = t.subject;
    var shown = {}, busy = false, closed = t.status === "closed";
    function sub() { root.querySelector(".dl-chat-title span").textContent = (admin ? t.name + " · " + t.email + " · " : "") + (closed ? "Closed" : "Open") + " · started " + when(t.created_at); }
    sub();
    function addMessage(m, instant) {
      if (shown[m.id]) return; shown[m.id] = true;
      var row = document.createElement("div"); row.className = "dl-msg"; if (instant || reduced()) row.style.animation = "none";
      var support = m.sender === "support";
      row.appendChild(support ? logoAvatar() : personAvatar(m.name || t.name, m.avatar_url || (!admin ? (window.state && state.avatarUrl) : null)));
      var body = make('<div class="dl-msg-body"><div class="dl-msg-meta"><span class="dl-msg-name"></span><span class="dl-msg-time"></span></div><div class="dl-msg-text"></div></div>');
      var nm = body.querySelector(".dl-msg-name"); nm.textContent = support ? "Daylight Support" : (m.name || t.name);
      if (support && window.daylightVerifiedBadge) nm.appendChild(window.daylightVerifiedBadge());
      var tm = body.querySelector(".dl-msg-time"); tm.textContent = exactTime(m.created_at); tm.title = new Date(m.created_at).toLocaleString();
      body.querySelector(".dl-msg-text").textContent = m.body;
      row.appendChild(body);
      var typing = scroll.querySelector(".dl-typing");
      scroll.insertBefore(row, typing || null);
    }
    function toBottom() { scroll.scrollTop = scroll.scrollHeight; }
    async function load(first) {
      var rows;
      try { rows = (await rpc("daylight_support_thread", { p_ticket: t.id })) || []; } catch (e) { return; }
      var nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
      var before = Object.keys(shown).length;
      rows.forEach(function (m) { addMessage(m, first); });
      if (first || nearBottom || Object.keys(shown).length !== before) toBottom();
    }
    function setTyping(on) {
      var ex = scroll.querySelector(".dl-typing");
      if (on && !ex) {
        var row = make('<div class="dl-typing" aria-label="Sending"><span class="dl-msg-av"></span><span class="dl-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>');
        scroll.appendChild(row); toBottom();
      } else if (!on && ex) ex.remove();
    }
    function drawFoot() {
      foot.innerHTML = "";
      if (admin && closed) { foot.appendChild(make('<div class="dl-chat-note">This ticket is closed. Replying reopens it for the person.</div>')); }
      var box = make('<div class="dl-chat-compose"><textarea class="text-input" rows="1" placeholder="Write a reply" aria-label="Write a reply" maxlength="5000"></textarea><button type="button" class="btn-primary" disabled>Send</button></div>');
      var ta = box.querySelector("textarea"), btn = box.querySelector("button");
      function grow() { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; btn.disabled = busy || !ta.value.trim(); }
      ta.addEventListener("input", grow);
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!btn.disabled) btn.click(); } });
      btn.addEventListener("click", async function () {
        var text = ta.value.trim(); if (!text || busy) return;
        busy = true; btn.disabled = true; ta.disabled = true; setTyping(true);
        try {
          var jobs = [rpc(admin ? "daylight_support_admin_reply" : "daylight_support_send", admin ? { p_ticket: t.id, p_body: text } : { p_ticket: t.id, p_body: text })];
          if (!reduced()) jobs.push(sleep(520));
          await Promise.all(jobs);
          ta.value = ""; setTyping(false);
          closed = false; t.status = "open"; sub(); drawActions();
          await load(false);
          if (cfg.onChanged) cfg.onChanged();
        } catch (e) {
          setTyping(false);
          toast(friendly(e, "Couldn’t send that. Check your connection and try again."));
        }
        busy = false; ta.disabled = false; grow(); ta.focus();
      });
      foot.appendChild(box);
    }
    function drawActions() {
      actions.innerHTML = "";
      if (!admin) return;
      var b = make('<button type="button" class="btn-ghost dl-btn-sm"></button>');
      b.textContent = closed ? "Reopen" : "Close ticket";
      b.addEventListener("click", async function () {
        b.disabled = true;
        try { await rpc("daylight_support_admin_set_status", { p_ticket: t.id, p_status: closed ? "open" : "closed" }); closed = !closed; t.status = closed ? "closed" : "open"; sub(); drawActions(); drawFoot(); if (cfg.onChanged) cfg.onChanged(); }
        catch (e) { b.disabled = false; toast("Couldn’t update the ticket."); }
      });
      actions.appendChild(b);
    }
    drawActions(); drawFoot();
    load(true);
    root._poll = function () { load(false); };
    return root;
  }

  /* ---------------------------------------------------------------- the board (ticket list + chat), both sides */
  function buildBoard(cfg) {
    var admin = cfg.mode === "admin", tickets = [], current = null, chatHost, listHost;
    var root = make('<div class="dl-board"><div class="set-group"><div class="dl-tk-list" data-list></div></div><div class="set-group" data-chat></div></div>');
    listHost = root.querySelector("[data-list]"); chatHost = root.querySelector("[data-chat]");
    function snippet(tk) { return (tk.last_sender === "support" ? (admin ? "You: " : "Daylight Support: ") : (admin ? "" : "You: ")) + (tk.last_body || ""); }
    function drawList() {
      listHost.innerHTML = "";
      if (!tickets.length) { listHost.appendChild(make('<div class="dl-tk-empty">' + (admin ? "No support tickets yet." : "You have no support tickets yet. Use New ticket to ask for help.") + "</div>")); return; }
      tickets.forEach(function (tk) {
        var row = make('<button type="button" class="dl-tk-row"><span class="dl-tk-main"><span class="dl-tk-top"><span class="dl-tk-subject"></span><span class="dl-tk-time"></span></span><span class="dl-tk-who" hidden></span><span class="dl-tk-snip"></span><span class="dl-tk-state"><i></i><em></em></span></span></button>');
        row.setAttribute("aria-current", String(current && current.id === tk.id));
        row.querySelector(".dl-tk-subject").textContent = tk.subject;
        row.querySelector(".dl-tk-time").textContent = when(tk.updated_at);
        if (admin) { var w = row.querySelector(".dl-tk-who"); w.hidden = false; w.textContent = tk.name; }
        row.querySelector(".dl-tk-snip").textContent = snippet(tk);
        var st = row.querySelector(".dl-tk-state"); st.classList.toggle("is-closed", tk.status === "closed"); st.querySelector("em").textContent = tk.status === "closed" ? "Closed" : "Open";
        if (admin && tk.unread) { var dot = document.createElement("span"); dot.className = "dl-tk-unread"; dot.title = "New reply from the user"; dot.setAttribute("aria-label", "Unread"); row.insertBefore(dot, row.firstChild); }
        row.addEventListener("click", function () { select(tk); });
        listHost.appendChild(row);
      });
    }
    function select(tk) {
      current = tk; drawList(); chatHost.innerHTML = "";
      var chat = buildChat({ mode: cfg.mode, ticket: tk, onChanged: function () { reload(false); } });
      chatHost.appendChild(chat); root._chat = chat;
      if (admin && tk.unread) rpc("daylight_support_admin_seen", { p_ticket: tk.id }).then(function () { tk.unread = false; drawList(); if (cfg.onSeen) cfg.onSeen(); }, function () {});
    }
    async function reload(pick) {
      try { tickets = (await rpc(admin ? "daylight_support_admin_list" : "daylight_support_my_tickets")) || []; } catch (e) { if (!tickets.length) { listHost.innerHTML = ""; listHost.appendChild(make('<div class="dl-tk-empty">Couldn’t load tickets right now.</div>')); } return; }
      if (!admin) myTickets = tickets;
      if (cfg.onList) cfg.onList(tickets);
      var keep = current && tickets.filter(function (x) { return x.id === current.id; })[0];
      if (keep) { current = keep; drawList(); }
      else if (pick !== false) {
        var first = (cfg.focusTicket && tickets.filter(function (x) { return x.id === cfg.focusTicket; })[0]) || tickets[0];
        if (first) select(first); else { drawList(); chatHost.innerHTML = '<div class="dl-chat-empty">' + (admin ? "Select a ticket to read the conversation." : "Start a conversation with Daylight Support.<br>Choose New ticket above.") + "</div>"; }
      } else drawList();
    }
    root._reload = reload;
    root._poll = function () { reload(false); if (root._chat && root._chat._poll) root._chat._poll(); };
    reload(true);
    return root;
  }

  /* ---------------------------------------------------------------- pages (swap into the main area like Tasks) */
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; activeBoard = null; }
  function startPolling(board) {
    stopPolling(); activeBoard = board;
    pollTimer = setInterval(function () { if (document.hidden || !board.isConnected) { if (!board.isConnected) stopPolling(); return; } board._poll(); }, 8000);
  }
  function pageShell(title, extra) {
    var page = make('<div class="dl-page"><div class="dl-page-inner"><div class="dl-page-head"><h1 class="dl-page-title"></h1></div></div></div>');
    page.querySelector(".dl-page-title").textContent = title;
    if (extra) page.querySelector(".dl-page-head").appendChild(extra);
    return page;
  }
  function supportPage() {
    var newBtn = make('<button type="button" class="btn-primary" style="margin:0">New ticket</button>');
    var page = pageShell("Support", newBtn);
    var board = buildBoard({ mode: "user", onList: function () { refreshBadgeSoon(); } });
    newBtn.addEventListener("click", function () { openTicketDialog({ onSent: function (id) { board._reload(false); selectAfter(board, id); } }); });
    page.querySelector(".dl-page-inner").appendChild(board);
    startPolling(board);
    return page;
  }
  function selectAfter(board, id) { setTimeout(function () { board._reload(true); }, 150); }
  function adminPage() {
    var page = pageShell("Admin");
    var inner = page.querySelector(".dl-page-inner");
    var tabs = make('<div class="dl-tabs" role="tablist" aria-label="Admin sections"><button type="button" role="tab" data-tab="notifications">Notifications</button><button type="button" role="tab" data-tab="banners">Banners</button><button type="button" role="tab" data-tab="support">Support</button></div>');
    inner.appendChild(tabs);
    var panels = { notifications: make('<div data-panel="notifications"></div>'), banners: make('<div data-panel="banners" hidden></div>'), support: make('<div data-panel="support" hidden></div>') };
    /* the old dashboard builds all four cards; split them between the first two tabs */
    var tmp = document.createElement("div");
    if (window.daylightAdminPane) {
      var realHead = window.paneHead;
      window.daylightAdminPane(tmp);
      var kids = [].slice.call(tmp.children).filter(function (c) { return c.classList.contains("set-group"); });
      if (kids[0]) panels.notifications.appendChild(kids[0]);
      if (kids[2]) panels.notifications.appendChild(kids[2]);
      if (kids[1]) panels.banners.appendChild(kids[1]);
      if (kids[3]) panels.banners.appendChild(kids[3]);
    }
    Object.keys(panels).forEach(function (k) { inner.appendChild(panels[k]); });
    var boardBuilt = false, unreadCount = 0;
    function paintTabDot() {
      var b = tabs.querySelector('[data-tab="support"]'); var d = b.querySelector(".dl-tab-dot");
      if (unreadCount && !d) { d = document.createElement("span"); d.className = "dl-tab-dot"; d.setAttribute("aria-label", "New replies"); b.appendChild(d); }
      else if (!unreadCount && d) d.remove();
    }
    function show(name) {
      tabs.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === name)); });
      Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== name; });
      if (name === "support") {
        if (!boardBuilt) {
          boardBuilt = true;
          var board = buildBoard({ mode: "admin", onList: function (list) { unreadCount = list.filter(function (x) { return x.unread; }).length; paintTabDot(); }, onSeen: function () { } });
          panels.support.appendChild(board); panels.support._board = board;
        }
        startPolling(panels.support._board);
      } else stopPolling();
      try { sessionStorage.setItem("daylight-admin-tab", name); } catch (e) {}
    }
    tabs.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); }); });
    var start = "notifications";
    try { start = sessionStorage.getItem("daylight-admin-tab") || start; } catch (e) {}
    show(start in panels ? start : "notifications");
    /* the unread dot works before the Support tab is opened */
    rpc("daylight_support_admin_list").then(function (list) { unreadCount = (list || []).filter(function (x) { return x.unread; }).length; paintTabDot(); }, function () {});
    page._show = show;
    return page;
  }

  /* renderView: the Support window and the Admin page replace the calendar/tasks view, the sidebar stays */
  var originalRenderView = renderView;
  renderView = function (animate, dir) {
    if (state.section === "support" || (state.section === "admin" && isOwner())) {
      closePopover(); closeMenu();
      stopPolling();
      var host = document.getElementById("viewWrap");
      host.innerHTML = "";
      host.appendChild(state.section === "support" ? supportPage() : adminPage());
      return;
    }
    if (state.section === "admin") state.section = "calendar";   /* non-owners never see the page */
    stopPolling();
    return originalRenderView.apply(this, arguments);
  };
  var originalPageBy = pageBy;
  pageBy = function () { if (state.section === "support" || state.section === "admin") return; return originalPageBy.apply(this, arguments); };
  function openSection(name) { state.section = name; renderAll(true, 1); closeDrawer(); if (name === "support") markSupportRead(); }
  async function markSupportRead() {
    try { await rpc("daylight_mark_broadcasts_read"); } catch (e) {}
    if (window.daylightNotifications) window.daylightNotifications.refresh();
  }
  function refreshBadgeSoon() { if (window.daylightNotifications) window.daylightNotifications.refresh(); }

  /* ---------------------------------------------------------------- the Support ticket popup */
  function openTicketDialog(opts) {
    opts = opts || {};
    var c = cloud(), me = (c && c.user) || {};
    var meta = me.user_metadata || {};
    var bd = el('<div class="backdrop"><div class="dialog dl-std dl-look dl-ticket" role="dialog" aria-modal="true" aria-label="Support ticket">' +
      '<div class="dialog-head"><span class="dialog-title">Support ticket</span><button type="button" class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
      '<div class="dialog-body" data-body style="overflow-y:auto">' +
      '<div class="field dl-std-field"><label for="stName">Name</label><input class="text-input" id="stName" maxlength="120" autocomplete="name"></div>' +
      '<div class="field dl-std-field"><label for="stEmail">Email</label><input class="text-input" id="stEmail" type="email" maxlength="200" autocomplete="email"></div>' +
      '<div class="field dl-std-field"><label for="stSubject">Subject</label><input class="text-input" id="stSubject" maxlength="200" autocomplete="off"></div>' +
      '<div class="field dl-std-field"><label for="stMessage">Message</label><textarea class="text-area" id="stMessage" maxlength="5000" rows="5"></textarea></div>' +
      '<div class="dl-banner" role="alert" hidden></div></div>' +
      '<div class="dialog-foot" data-foot><button type="button" class="btn-ghost" data-cancel>Cancel</button><button type="button" class="btn-primary" style="margin-left:0" data-go disabled>Send request</button></div></div></div>');
    overlayRoot.appendChild(bd);
    var name = bd.querySelector("#stName"), email = bd.querySelector("#stEmail"), subject = bd.querySelector("#stSubject"), message = bd.querySelector("#stMessage"),
        go = bd.querySelector("[data-go]"), banner = bd.querySelector(".dl-banner");
    name.value = (window.state && state.profileName && state.profileName !== "Account" ? state.profileName : "") || meta.full_name || meta.name || "";
    email.value = me.email || "";
    function valid() { return name.value.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()) && subject.value.trim() && message.value.trim(); }
    function sync() { go.disabled = !valid(); }
    [name, email, subject, message].forEach(function (n) { n.addEventListener("input", function () { banner.hidden = true; sync(); }); });
    function close() { document.removeEventListener("keydown", onKey, true); if (window.daylightExit) window.daylightExit(bd); else bd.remove(); }
    function onKey(e) { if (e.key === "Escape" && overlayRoot.lastElementChild === bd && !document.querySelector(".menu")) { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelector("[data-x]").addEventListener("click", close);
    bd.querySelector("[data-cancel]").addEventListener("click", close);
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    go.addEventListener("click", async function () {
      if (go.disabled) return;
      go.disabled = true; go.textContent = "Sending…"; banner.hidden = true;
      try {
        var res = await rpc("daylight_support_create_ticket", { p_name: name.value.trim(), p_email: email.value.trim(), p_subject: subject.value.trim(), p_message: message.value.trim() });
        await refreshMine();
        var body = bd.querySelector("[data-body]"), foot = bd.querySelector("[data-foot]");
        body.innerHTML = '<div class="dl-tk-ok"><span class="dl-tk-ok-ic">' + icon("check", 22) + '</span><b>Request sent</b><span>We’ll reply right here in Daylight.</span></div>';
        foot.innerHTML = '<button type="button" class="btn-primary" style="margin-left:0" data-done>Done</button>';
        foot.querySelector("[data-done]").addEventListener("click", close); foot.querySelector("[data-done]").focus();
        if (opts.onSent) opts.onSent(res && res.id);
      } catch (e) {
        go.textContent = "Send request"; sync();
        banner.textContent = friendly(e, "Couldn’t send your request. Check your connection and try again."); banner.hidden = false;
      }
    });
    sync(); subject.focus();
  }

  /* ---------------------------------------------------------------- sidebar rows */
  function decorateSidebar() {
    var sb = document.getElementById("sidebar");
    if (!sb) return;
    var settings = [].slice.call(sb.querySelectorAll(".side-row")).filter(function (b) { return b.getAttribute("title") === "Settings"; })[0];
    if (!settings || sb.querySelector("[data-support-row]")) return;
    function row(title, ic, fn, flag, active) {
      var b = el('<button class="side-row' + (active ? " active" : "") + '" title="' + title + '" data-support-row="' + flag + '">' + icon(ic, 18) + '<span class="rail-hide">' + title + "</span></button>");
      b.addEventListener("click", fn);
      sb.insertBefore(b, settings);
    }
    if (isOwner()) row("Admin", "shield", function () { openSection("admin"); }, "admin", state.section === "admin");
    /* Documentation: a normal-looking row; the link comes later, so clicking does nothing for now */
    row("Documentation", "book", function (e) { e.preventDefault(); }, "docs", false);
    row("Support ticket", "ticket", function () { closeDrawer(); if (hasOpen()) openSection("support"); else openTicketDialog({ onSent: function () { /* stay where they are; the success state offers Done */ } }); }, "ticket", state.section === "support");
  }
  var originalRenderSidebar = renderSidebar;
  renderSidebar = function () {
    var r = originalRenderSidebar.apply(this, arguments);
    try { decorateSidebar(); } catch (e) { /* the sidebar works without these rows */ }
    return r;
  };

  /* ---------------------------------------------------------------- lifecycle */
  function start() {
    refreshMine();
    if (window.daylightAdmin && window.daylightAdmin.whenKnown) window.daylightAdmin.whenKnown().then(function (owner) { if (owner) { adminKnown = true; renderSidebar(); } });
  }
  function reset() { myTickets = []; stopPolling(); adminKnown = false; if (window.state && (state.section === "support" || state.section === "admin")) state.section = "calendar"; }
  document.addEventListener("daylight:workspace-ready", start);
  document.addEventListener("daylight:workspace-signed-out", reset);
  if (cloud() && cloud().ready) start();
  window.daylightSupport = { openWindow: function () { openSection("support"); }, openTicket: openTicketDialog, openAdmin: function () { openSection("admin"); }, tickets: function () { return myTickets.slice(); } };
})();
