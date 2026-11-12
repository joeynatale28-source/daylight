/* Calendars other Daylight accounts have shared with this account.
   - They are read through database functions (one calendar's events at a time) and kept OUT of this account's own workspace
     save, the same way subscribed calendars are.
   - "Can edit": changes made here are sent to the database as a small list of operations; the database checks the permission
     and writes into the owner's single calendar (there is no copy). "View only": the interface offers no editing, and the
     database refuses writes regardless.
   - If the server says no (permission changed, calendar removed), the local view snaps back to what the server has.
   Single EVENTS other accounts have shared with this account work the same way (daylight_event_shares): each accepted event is the
   owner's one event, shown here on its own quiet, sidebar-less calendar entry; "Can edit" sends field changes only (never a delete or a
   move), "View only" offers no editing, and the database refuses writes regardless. The owner's share dialog and people list live here too. */
(function () {
  "use strict";
  var shares = [], known = {}, lastEvents = {}, loadedSig = "", pollTimer = null, pushTimer = null, pushing = false, pushAgain = false, seq = 0;
  var evShares = [], evKnown = {}, evRows = [], evSig = "";
  var css = document.createElement("style");
  css.textContent = [
    ".dl-share-view{animation:dlSvIn 190ms var(--ease-out) both}.popover.dl-returning>*{animation:dlSvIn 190ms var(--ease-out) both}@keyframes dlSvIn{from{opacity:0}to{opacity:1}}",
    "body.reduce-motion .dl-share-view,body.reduce-motion .popover.dl-returning>*{animation:none!important}@media (prefers-reduced-motion:reduce){.dl-share-view,.popover.dl-returning>*{animation:none!important}}",
    ".dl-evshare .dialog-body{padding-top:4px}",
    ".dl-ev-sum{display:flex;flex-direction:column;gap:2px;margin:0 0 16px;padding:12px 14px;border:1px solid var(--line-soft);border-radius:12px;background:var(--gray-2)}",
    ".dl-ev-sum-t{font-size:14px;font-weight:620;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-ev-sum-w{font-size:12.5px;color:var(--muted)}",
    ".dl-ev-group{margin-bottom:18px}.dl-ev-group:last-child{margin-bottom:6px}",
    ".dl-ev-group .set-group-title{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin-bottom:10px}",
    ".dl-pop-share-row .pop-main{display:flex;flex-direction:column;align-items:flex-start;gap:8px}",
    ".dl-pop-people{width:100%}",
    ".dl-pop-people .dl-ppl-row{padding:7px 0}",
    ".dl-pop-share{height:32px;padding:0 14px;margin:0}",
    ".dl-pop-leave .pop-main{display:flex}",
    ".dl-pop-shared .pr-strong{display:block}"
  ].join("\n");
  document.head.appendChild(css);

  function cloud() { return window.daylightCloud; }
  function own() { var c = cloud(); return !!(c && c.ready && c.user); }
  async function rpc(name, args) {
    var c = cloud();
    if (!c || !c.client || !c.user) throw new Error("signed out");
    if (c.ensureSession) await c.ensureSession();
    var result = await c.client.rpc(name, args || {});
    if (result.error) throw result.error;
    return result.data;
  }
  function friendly(e) {
    var m = String((e && e.message) || "");
    if (/view this calendar but not change/i.test(m)) return "You can view this calendar but not change it.";
    if (/view this event but not change/i.test(m)) return "You can view this event but not change it.";
    if (/no longer exists/i.test(m)) return "That event was changed or removed by someone else.";
    if (/no longer available|Share not found/i.test(m)) return "This calendar isn’t shared with you anymore.";
    if (/too long|needs a title/i.test(m)) return m.replace(/^error:\s*/i, "");
    return "Couldn’t save that change. It was not applied.";
  }
  function hashId(source) {
    var v = 2166136261;
    for (var i = 0; i < source.length; i++) v = Math.imul(v ^ source.charCodeAt(i), 16777619);
    return -1 - (v >>> 0);
  }
  var FIELDS = ["title", "start", "end", "allDay", "loc", "desc", "repeat", "repeatEnd", "accent", "weekdaysOnly", "reminder", "declined",
    "uid", "rrule", "exdates", "timezone", "recurrenceId", "status", "placeId", "locationLat", "locationLng"];
  /* What is sent to the database for one event (dates as ISO text). */
  function toServer(ev) {
    var out = {
      title: String(ev.title || ""), start: new Date(ev.start).toISOString(), end: new Date(ev.end).toISOString(), allDay: !!ev.allDay,
      loc: ev.loc || "", desc: ev.desc || "", repeat: ev.repeat || null, repeatEnd: ev.repeatEnd || null, accent: ev.accent || null,
      weekdaysOnly: !!ev.weekdaysOnly, reminder: ev.reminder == null ? null : ev.reminder, declined: !!ev.declined,
      uid: ev.uid || ("daylight-" + String(ev.id).replace("-", "n") + "-" + Date.now().toString(36)), rrule: ev.rrule || null, exdates: ev.exdates || null,
      timezone: ev.timezone || null, recurrenceId: ev.recurrenceId || null, status: ev.status || null,
      placeId: ev.placeId || null, locationLat: ev.locationLat == null ? null : ev.locationLat, locationLng: ev.locationLng == null ? null : ev.locationLng
    };
    return JSON.parse(JSON.stringify(out));
  }
  function sig(ev) { var s = toServer(Object.assign({}, ev, { uid: ev.uid || "x" })); return JSON.stringify(FIELDS.map(function (k) { return s[k]; })); }
  function fromServer(e, shareId, calId) {
    var start = new Date(e.start), end = new Date(e.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    return {
      id: hashId("share:" + shareId + ":" + e.id), title: String(e.title || "Untitled"), cal: calId, start: start, end: end, allDay: !!e.allDay,
      loc: String(e.loc || ""), desc: String(e.desc || ""), repeat: e.repeat || null, repeatEnd: e.repeatEnd || null, accent: e.accent || null,
      weekdaysOnly: !!e.weekdaysOnly, reminder: e.reminder == null ? null : Number(e.reminder), declined: !!e.declined, uid: e.uid, rrule: e.rrule,
      exdates: e.exdates, timezone: e.timezone, recurrenceId: e.recurrenceId, status: e.status, placeId: e.placeId || null,
      locationLat: e.locationLat == null ? null : e.locationLat, locationLng: e.locationLng == null ? null : e.locationLng, feedShareId: shareId
    };
  }
  function prefsKey() { return "daylight-feed-visibility:" + (cloud() && cloud().user && cloud().user.id); }
  function cacheKey() { return "daylight-shared-cache:" + (cloud() && cloud().user && cloud().user.id); }

  /* Put the shared calendars (and their events) into the page's state, replacing whatever was there from before. */
  function materialize(list, events) {
    var prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(prefsKey()) || "{}"); } catch (e) {}
    var former = {};
    state.calendars.forEach(function (c) { if (c.remoteShareId) former[c.id] = c.hidden; });
    state.calendars = state.calendars.filter(function (c) { return !c.remoteShareId; });
    state.events = state.events.filter(function (e) { return !e.feedShareId && String(e.cal).indexOf("share:") !== 0; });
    shares = list; known = {}; lastEvents = {};
    list.forEach(function (s) {
      var calId = "share:" + s.share_id;
      var colors = state.shareColors || {};
      state.calendars.push({
        id: calId, name: s.calendar_name || "Shared calendar", color: colors[calId] || s.calendar_color || "blue",
        hidden: former[calId] !== undefined ? former[calId] : !!prefs[calId], subscribed: false, builtin: false, remoteShareId: s.share_id,
        sharedFrom: { ownerName: s.owner_name || "", ownerEmail: s.owner_email || "", ownerAvatar: s.owner_avatar || "", permission: s.permission, calendarId: s.calendar_id }
      });
      var map = new Map();
      lastEvents[s.share_id] = events[s.share_id] || [];
      (events[s.share_id] || []).forEach(function (e) {
        var ev = fromServer(e, s.share_id, calId);
        if (!ev) return;
        state.events.push(ev);
        map.set(ev.id, { serverId: e.id, sig: sig(ev) });
      });
      known[s.share_id] = map;
    });
    renderAll(false);
  }

  async function load(force) {
    if (!own()) return;
    var mine = ++seq;
    if (!force && (pushTimer || pushing)) return;       // local edits are on their way out; don't overwrite them
    var list;
    try { list = await rpc("daylight_list_my_shared_calendars"); } catch (e) { return; }
    list = Array.isArray(list) ? list : [];
    var events = {};
    await Promise.all(list.map(async function (s) {
      try { events[s.share_id] = await rpc("daylight_shared_calendar_events", { p_share_id: s.share_id }); }
      catch (e) { events[s.share_id] = lastEvents[s.share_id] || []; }
    }));
    if (mine !== seq || !own()) return;
    if (!force && (pushTimer || pushing)) return;
    var signature = JSON.stringify([list, events]);
    var changedCalendars = JSON.stringify(list.map(function (s) { return [s.share_id, s.calendar_name, s.permission, s.owner_name]; }));
    if (signature === loadedSig && changedCalendars === JSON.stringify(shares.map(function (s) { return [s.share_id, s.calendar_name, s.permission, s.owner_name]; }))) return;
    loadedSig = signature;
    materialize(list, events);
    if (evRows.length) { evSig = ""; loadEvents(true); }     /* re-check which shared events a calendar share now covers */
    try { localStorage.setItem(cacheKey(), JSON.stringify({ list: list, events: events })); } catch (e) {}
    document.dispatchEvent(new Event("daylight:shared-changed"));
  }

  /* ---- writing ("Can edit") ---- */
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(push, 380); }
  async function push() {
    pushTimer = null;
    if (!own() || (!shares.length && !evShares.length)) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true;
    try {
      await pushEvents();
      for (var i = 0; i < shares.length; i++) {
        var s = shares[i], calId = "share:" + s.share_id, map = known[s.share_id];
        if (!map) continue;
        var local = state.events.filter(function (e) { return e.cal === calId; });
        var ops = [], seen = new Set();
        local.forEach(function (ev) {
          seen.add(ev.id);
          var k = map.get(ev.id);
          if (!k) ops.push({ op: "create", client_id: String(ev.id), event: toServer(ev) });
          else if (k.sig !== sig(ev)) ops.push({ op: "update", event: Object.assign({ id: k.serverId }, toServer(ev)) });
        });
        map.forEach(function (k, localId) { if (!seen.has(localId)) ops.push({ op: "delete", event: { id: k.serverId } }); });
        if (!ops.length) continue;
        if (s.permission !== "edit") { toast("You can view this calendar but not change it."); await load(true); continue; }
        try {
          var res = await rpc("daylight_apply_shared_event_ops", { p_share_id: s.share_id, p_ops: ops });
          var evs = {}; evs[s.share_id] = (res && res.events) || [];
          var rest = {};
          shares.forEach(function (x) { rest[x.share_id] = x.share_id === s.share_id ? evs[s.share_id] : lastEvents[x.share_id]; });
          loadedSig = "";
          materialize(shares.slice(), rest);
        } catch (e) {
          toast(friendly(e));
          await load(true);
        }
      }
    } finally {
      pushing = false;
      if (pushAgain) { pushAgain = false; schedulePush(); }
    }
  }

  /* ---- single events shared with me ---- */
  function evCalId(shareId) { return "evs:" + shareId; }
  function materializeEvents(rows) {
    /* rows: one per event record (the shared event + any same-series exception copies). */
    state.calendars = state.calendars.filter(function (c) { return !c.eventShare; });
    state.events = state.events.filter(function (e) { return !e.feedEventShareId; });
    evShares = []; evKnown = {}; evRows = rows;
    /* If the whole calendar is also shared with me, the calendar share governs: no second copy of its events here. */
    rows = rows.filter(function (r) { return !shares.some(function (cs) { return cs.owner_id === r.owner_id && cs.calendar_id === (r.event && r.event.cal); }); });
    var byShare = {};
    rows.forEach(function (r) { (byShare[r.share_id] = byShare[r.share_id] || []).push(r); });
    Object.keys(byShare).forEach(function (shareId) {
      var list = byShare[shareId], head = list.filter(function (r) { return r.is_main; })[0] || list[0];
      var calId = evCalId(shareId);
      evShares.push({ share_id: shareId, permission: head.permission, owner_name: head.owner_name, owner_email: head.owner_email, owner_avatar: head.owner_avatar, event_id: head.event && head.event.id });
      state.calendars.push({ id: calId, name: head.calendar_name || "Shared event", color: head.calendar_color || "blue", hidden: false, subscribed: false, builtin: false, eventShare: true,
        sharedFrom: { ownerName: head.owner_name || "", ownerEmail: head.owner_email || "", ownerAvatar: head.owner_avatar || "", permission: head.permission, eventShare: true } });
      list.forEach(function (r) {
        var e = r.event, ev = fromServer(e, shareId, calId);
        if (!ev) return;
        delete ev.feedShareId;
        ev.feedEventShareId = shareId; ev.eventShareMain = !!r.is_main; ev.id = hashId("evshare:" + shareId + ":" + e.id);
        state.events.push(ev);
        if (r.is_main) evKnown[shareId] = { serverId: e.id, sig: sig(ev), localId: ev.id, calId: calId };
      });
    });
    renderAll(false);
  }
  async function loadEvents(force) {
    if (!own()) return;
    var rows;
    try { rows = await rpc("daylight_list_my_shared_events"); } catch (e) { return; }
    rows = Array.isArray(rows) ? rows : [];
    if (!force && (pushTimer || pushing)) return;
    var signature = JSON.stringify(rows);
    if (signature === evSig) return;
    evSig = signature;
    materializeEvents(rows);
    try { localStorage.setItem(cacheKey() + ":ev", JSON.stringify(rows)); } catch (e) {}
    document.dispatchEvent(new Event("daylight:shared-changed"));
  }
  async function pushEvents() {
    for (var i = 0; i < evShares.length; i++) {
      var s = evShares[i], k = evKnown[s.share_id];
      if (!k) continue;
      var local = state.events.filter(function (e) { return e.feedEventShareId === s.share_id && e.eventShareMain; })[0];
      if (!local) { toast("A shared event can\u2019t be deleted. Use Leave event to remove it from your calendar."); evSig = ""; await loadEvents(true); continue; }
      if (local.cal !== k.calId) { toast("A shared event stays on its own calendar."); evSig = ""; await loadEvents(true); continue; }
      if (sig(local) === k.sig) continue;
      if (s.permission !== "edit") { toast("You can view this event but not change it."); evSig = ""; await loadEvents(true); continue; }
      try {
        var res = await rpc("daylight_apply_shared_event_changes", { p_share_id: s.share_id, p_event: toServer(local) });
        if (res) { evSig = ""; await loadEvents(true); }
      } catch (e) { toast(friendly(e)); evSig = ""; await loadEvents(true); }
    }
  }

  /* Any change to events ends in a render; a quiet check afterwards sends what changed on shared calendars. */
  function hookRender() {
    if (typeof renderAll !== "function" || renderAll.__shareHooked) return;
    var original = renderAll;
    renderAll = function () { var r = original.apply(this, arguments); if (shares.length || evShares.length) schedulePush(); return r; };
    renderAll.__shareHooked = true;
  }
  function hookRow() {
    if (typeof calRow !== "function" || calRow.__shareHooked) return;
    var original = calRow;
    calRow = function (cal) {
      var row = original(cal);
      if (cal.remoteShareId) {
        var chk = row.querySelector(".cal-check");
        if (chk) chk.addEventListener("click", function () {
          var prefs = {};
          try { prefs = JSON.parse(localStorage.getItem(prefsKey()) || "{}"); } catch (e) {}
          setTimeout(function () { prefs[cal.id] = !!cal.hidden; try { localStorage.setItem(prefsKey(), JSON.stringify(prefs)); } catch (e) {} }, 0);
        });
      }
      return row;
    };
    calRow.__shareHooked = true;
  }

  function start() {
    hookRender(); hookRow(); hookPopover();
    load(); loadEvents();
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (document.hidden) return; load(); loadEvents(); if (cloud() && cloud().refreshIfBehind) cloud().refreshIfBehind(); }, 60 * 1000);
  }
  function reset() {
    seq++; shares = []; known = {}; lastEvents = {}; loadedSig = ""; evShares = []; evKnown = {}; evRows = []; evSig = "";
    clearInterval(pollTimer); pollTimer = null; clearTimeout(pushTimer); pushTimer = null; pushing = false; pushAgain = false;
  }

  /* ================= the owner's side: share ONE event ================= */
  var PERMS = [["edit", "Can edit", "Can change this event"], ["view", "View only", "Can only see this event"]];
  function permText(p) { return p === "edit" ? "Can edit" : "View only"; }
  function mk(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function avatarOf(person, size) { return window.daylightSharing.avatar(person, size); }
  function ico(name, size) { return typeof icon === "function" ? icon(name, size) : ""; }
  function evWhen(ev) {
    try { return new Date(ev.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ((window.daylightIsAllDayLike ? window.daylightIsAllDayLike(ev) : ev.allDay) ? " · All day" : " · " + new Date(ev.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })); }
    catch (e) { return ""; }
  }
  function isOwnedEvent(ev) {
    if (!ev || typeof ev.id !== "number" || ev.id <= 0 || ev.birthday || ev.feedShareId || ev.feedEventShareId || ev.feedSubscriptionId) return false;
    var cal = calOf(ev.cal);
    return !!cal && !isSubscribed(cal) && !cal.builtin && !cal.remoteShareId && !cal.eventShare && !cal.remoteSubscriptionId;
  }
  async function listEventPeople(ev) {
    try { return (await rpc("daylight_list_event_shares", { p_event_id: ev.id })) || []; } catch (e) { return null; }
  }
  function permMenu(anchor, current, onPick, extra, mo) {
    var items = PERMS.map(function (p) { return { label: p[1], sub: p[2], checkRight: true, selected: current === p[0], fn: function () { onPick(p[0]); } }; });
    if (extra && extra.length) { items.push({ sep: true }); extra.forEach(function (x) { items.push(x); }); }
    openMenu(anchor, items, { align: "right", className: "dl-perm-menu", keepPopover: !!(mo && mo.keepPopover) });
  }
  /* The people list: avatar, name, the identifier in grey, and the permission dropdown ("Invited" while pending). */
  function drawPeople(host, ev, people, reload, mo) {
    mo = mo || {};
    host.innerHTML = "";
    if (people === null) { host.appendChild(mk('<div class="dl-ppl-empty">Sharing isn\u2019t available right now.</div>')); return; }
    people.forEach(function (p) {
      var pending = p.status === "pending";
      var row = mk('<div class="dl-ppl-row" data-share-id="' + esc(p.id) + '"><span class="dl-ppl-text"><span class="dl-ppl-name"></span><span class="dl-ppl-sub"></span></span>' +
        '<button type="button" class="dl-ppl-ctl' + (pending ? " is-pending" : "") + '" aria-haspopup="menu"><span class="lbl"></span>' + ico("chevD", 14) + "</button></div>");
      row.insertBefore(avatarOf(p, 32), row.firstChild);
      row.querySelector(".dl-ppl-name").textContent = p.name;
      row.querySelector(".dl-ppl-sub").textContent = p.email;
      var ctl = row.querySelector(".dl-ppl-ctl");
      ctl.querySelector(".lbl").textContent = pending ? "Invited" : permText(p.permission);
      ctl.setAttribute("aria-label", p.name + ": " + (pending ? "Invited" : permText(p.permission)));
      ctl.addEventListener("click", function (e) {
        e.stopPropagation();
        var extra = pending
          ? [{ label: "Resend invite", fn: async function () { try { await rpc("daylight_send_event_share", { p_event_id: ev.id, p_recipient: p.recipient_id, p_permission: p.permission }); toast("Invite sent again"); reload(); } catch (err) { toast("Couldn\u2019t resend that invite."); } } },
             { label: "Cancel invite", fn: async function () { try { await rpc("daylight_revoke_event_share", { p_id: p.id }); toast("Invite canceled"); reload(); } catch (err) { toast("Couldn\u2019t cancel that invite."); } } }]
          : [{ label: "Remove access", danger: true, fn: async function () { try { await rpc("daylight_revoke_event_share", { p_id: p.id }); toast(p.name + " can no longer see this event"); reload(); } catch (err) { toast("Couldn\u2019t remove access."); } } }];
        permMenu(ctl, p.permission, async function (v) {
          if (v === p.permission) return;
          try { await rpc("daylight_set_event_share_permission", { p_id: p.id, p_permission: v }); toast(p.name + ": " + permText(v)); reload(); }
          catch (err) { toast("Couldn\u2019t change that permission."); }
        }, extra, mo);
      });
      host.appendChild(row);
    });
  }

  /* The Share view: it replaces the event popover's content in place (same popover, same width and position, no second surface). */
  function ownerRow() {
    var me = (window.daylightCloud && window.daylightCloud.user) || {};
    var row = mk('<div class="dl-ppl-row dl-sv-owner"><span class="dl-ppl-text"><span class="dl-ppl-name"></span><span class="dl-ppl-sub">Owner</span></span></div>');
    row.insertBefore(avatarOf({ name: state.profileName, avatar: state.avatarUrl }, 32), row.firstChild);
    row.querySelector(".dl-ppl-name").textContent = state.profileName || me.email || "You";
    return row;
  }
  /* Moving the popover to fit new content. The content swaps instantly, so the box used to JUMP (e.g. the people list arriving
     a moment later grew it by 86px and pulled it up). It now glides from where it was to where it belongs: height and top
     animate (transform-free, 200ms ease-out), the new content fades in, and reduced motion skips it. */
  function motionOff() { return !!((window.state && state.reduceMotion) || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)); }
  function placePopover(p) {
    var a = p._anchor, r = a && a.getBoundingClientRect ? a.getBoundingClientRect() : null;
    if (!r) return;
    var live = p._settle ? p.getBoundingClientRect() : null;   /* a glide is in progress: continue from where the box is right now */
    clearTimeout(p._settle); p.style.transition = "none"; p.style.height = ""; p.style.overflow = "";   /* measure the natural size */
    var pw = p.offsetWidth, ph = p.offsetHeight;
    var left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
    var top = r.bottom + 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, Math.min(r.top - ph - 8, window.innerHeight - ph - 8));
    if (top + ph > window.innerHeight - 8) top = Math.max(8, window.innerHeight - ph - 8);
    var from = live ? { height: live.height, top: live.top } : p._r;
    p.style.left = left + "px"; p.style.top = top + "px";
    if (from && !motionOff() && (Math.abs(from.height - ph) > 1 || Math.abs(from.top - top) > 1)) {
      p.style.height = from.height + "px"; p.style.top = from.top + "px"; p.style.overflow = "hidden";
      void p.offsetHeight;
      p.style.transition = "height 200ms var(--ease-out), top 200ms var(--ease-out)";
      p.style.height = ph + "px"; p.style.top = top + "px";
      clearTimeout(p._settle);
      p._settle = setTimeout(function () { p.style.transition = ""; p.style.height = ""; p.style.overflow = ""; p._r = p.getBoundingClientRect(); }, 230);
    } else { p.style.transition = ""; }
    p._r = { height: ph, top: top };
  }
  function markFrom(p) { var r = p.getBoundingClientRect(); p._r = { height: r.height, top: r.top }; }
  function showShareView(p, ev) {
    if (!p || p.classList.contains("is-sharing")) return;
    markFrom(p);
    var saved = [].slice.call(p.children);
    saved.forEach(function (c) { p.removeChild(c); });
    p.classList.add("is-sharing");
    var cal = calOf(ev.cal);
    var view = mk('<div class="dl-share-view dl-invite">' +
      '<div class="dl-sv-head"><button type="button" class="icon-btn" data-sv-back title="Back" aria-label="Back to the event">' + ico("chevL", 18) + '</button><span class="dl-sv-title">Share event</span>' +
      '<button type="button" class="icon-btn" data-sv-close title="Close" aria-label="Close">' + ico("x", 17) + "</button></div>" +
      '<div class="dl-sv-event"><span class="dl-sv-dot"></span><b></b><span class="when"></span></div>' +
      '<div class="dl-sv-scroll">' +
      '<div class="dl-inv-field"><input class="dl-inv-input" type="text" placeholder="Search people to share with\u2026" aria-label="Search people to share with" autocomplete="off" spellcheck="false"><div class="dl-inv-chip" hidden></div></div>' +
      '<div class="dl-inv-results" role="listbox" aria-label="People" hidden></div>' +
      '<div class="dl-sv-row2"><button type="button" class="dl-inv-perm" aria-haspopup="menu" data-perm><span class="dl-inv-perm-label">View only</span>' + ico("chevD", 14) + "</button>" +
      '<button type="button" class="btn-primary dl-inv-send" data-send disabled>Send</button></div>' +
      '<div class="dl-inv-status" role="status" data-status></div>' +
      '<div class="dl-sv-label">People with access</div><div data-people></div></div></div>');
    p.appendChild(view);
    view.querySelector(".dl-sv-dot").style.background = dotOf(cal);
    view.querySelector(".dl-sv-event b").textContent = ev.title || "Untitled";
    view.querySelector(".dl-sv-event .when").textContent = evWhen(ev) + (ev.repeat ? " \u00b7 shared as a series" : "");
    placePopover(p);
    var picked = null, perm = "view", seqSearch = 0, searchTimer = null, people = null;
    var input = view.querySelector(".dl-inv-input"), chip = view.querySelector(".dl-inv-chip"), results = view.querySelector(".dl-inv-results"),
        permBtn = view.querySelector("[data-perm]"), sendBtn = view.querySelector("[data-send]"), status = view.querySelector("[data-status]"), host = view.querySelector("[data-people]");
    function say(msg, kind) { status.textContent = msg || ""; status.className = "dl-inv-status" + (kind ? " is-" + kind : ""); }
    function syncSend() { sendBtn.disabled = !picked || people === null; }
    function relation(userId) { var q = (people || []).filter(function (x) { return x.recipient_id === userId; })[0]; return q ? (q.status === "pending" ? "Invited" : "Has access") : ""; }
    function back() {
      if (!p.isConnected) return;
      markFrom(p);
      view.remove(); p.classList.remove("is-sharing");
      saved.forEach(function (c) { p.appendChild(c); });
      p.classList.add("dl-returning"); setTimeout(function () { p.classList.remove("dl-returning"); }, 230);
      placePopover(p);
    }
    view.querySelector("[data-sv-back]").addEventListener("click", back);
    view.querySelector("[data-sv-close]").addEventListener("click", function () { closePopover(); });
    function drawList() {
      host.innerHTML = "";
      host.appendChild(ownerRow());
      if (people === null) { host.appendChild(mk('<div class="dl-sv-quiet">Sharing isn\u2019t available right now.</div>')); return; }
      var rowsHost = mk("<div></div>");
      drawPeople(rowsHost, ev, people, reload, { keepPopover: true });
      [].slice.call(rowsHost.children).forEach(function (r) { host.appendChild(r); });
      if (!people.length) host.appendChild(mk('<div class="dl-sv-quiet">Not shared with anyone yet</div>'));
    }
    async function reload() { people = await listEventPeople(ev); if (!view.isConnected) return; drawList(); if (people === null) say("Sharing isn\u2019t available right now.", "error"); syncSend(); placePopover(p); }
    function showResults(list) {
      results.innerHTML = ""; results.hidden = false;
      if (!list.length) { results.appendChild(mk('<div class="dl-inv-none" role="status">No results found \u2014 check the spelling</div>')); return; }
      list.forEach(function (q) {
        var rel = relation(q.user_id);
        var card = mk('<button type="button" class="dl-person" role="option"' + (rel ? " disabled" : "") + '><span class="dl-person-text"><b></b><span class="sub"></span></span>' + (rel ? '<span class="dl-person-tag"></span>' : "") + "</button>");
        card.insertBefore(avatarOf(q, 36), card.firstChild);
        card.querySelector("b").textContent = q.name; card.querySelector(".sub").textContent = q.email;
        if (rel) card.querySelector(".dl-person-tag").textContent = rel;
        card.addEventListener("click", function () { pick(q); });
        results.appendChild(card);
      });
    }
    function pick(q) {
      picked = q; results.hidden = true; results.innerHTML = ""; input.hidden = true; input.value = "";
      chip.hidden = false; chip.innerHTML = "";
      chip.appendChild(avatarOf(q, 30));
      chip.appendChild(mk('<span class="dl-person-text"><b></b><span class="sub"></span></span>'));
      chip.querySelector("b").textContent = q.name; chip.querySelector(".sub").textContent = q.email;
      var x = mk('<button type="button" class="dl-inv-x" aria-label="Choose someone else">' + ico("x", 14) + "</button>");
      x.addEventListener("click", function () { picked = null; chip.hidden = true; input.hidden = false; input.focus(); syncSend(); say(""); });
      chip.appendChild(x); say(""); syncSend(); placePopover(p);
    }
    input.addEventListener("input", function () {
      clearTimeout(searchTimer);
      var q = input.value.trim(); say("");
      if (q.length < 2) { results.hidden = true; results.innerHTML = ""; return; }
      searchTimer = setTimeout(async function () {
        var mine = ++seqSearch;
        try { var res = await rpc("daylight_search_people", { p_query: q }); if (mine !== seqSearch || input.value.trim() !== q) return; showResults(Array.isArray(res) ? res : []); placePopover(p); }
        catch (e) { if (mine === seqSearch) { results.hidden = true; say("Search isn\u2019t available right now.", "error"); } }
      }, 250);
    });
    permBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var items = PERMS.map(function (q) { return { label: q[1], sub: q[2], checkRight: true, selected: perm === q[0], fn: function () { perm = q[0]; permBtn.querySelector(".dl-inv-perm-label").textContent = permText(q[0]); } }; });
      openMenu(permBtn, items, { align: "left", className: "dl-perm-menu", above: true, keepPopover: true });
    });
    sendBtn.addEventListener("click", async function () {
      if (sendBtn.disabled || !picked) return;
      sendBtn.disabled = true; sendBtn.textContent = "Sending\u2026"; say("");
      try {
        await rpc("daylight_send_event_share", { p_event_id: ev.id, p_recipient: picked.user_id, p_permission: perm });
        toast("Invite sent to " + picked.name);
        picked = null; chip.hidden = true; input.hidden = false; input.value = "";
        await reload();
      } catch (e) {
        var m = String((e && e.message) || "");
        say(/already has access/i.test(m) ? "That person already has access." : /already sees this calendar/i.test(m) ? "That person already sees this event\u2019s calendar." : /Only events on your own/i.test(m) ? "This event can\u2019t be shared." : "Couldn\u2019t send that invite. Try again.", "error");
      }
      sendBtn.textContent = "Send"; syncSend();
    });
    reload();
    input.focus();
  }
  function openEventShare(ev) { var p = typeof popEl !== "undefined" ? popEl : null; if (p && p._occId === ev.id) showShareView(p, ev); }

  /* ================= the event's own popover ================= */
  function hookPopover() {
    if (typeof openPopover === "function" && !openPopover.__shareHooked) {
      var orig = openPopover;
      openPopover = function (occ, anchor) {
        var r = orig.apply(this, arguments);
        try { decoratePopover(occ); } catch (e) { /* the popover works without the sharing rows */ }
        return r;
      };
      openPopover.__shareHooked = true;
    }
    if (typeof openPopMenu === "function" && !openPopMenu.__shareHooked) {
      var origMenu = openPopMenu;
      openPopMenu = function (anchor, ev, occ) {
        var r = origMenu.apply(this, arguments);
        if (ev && ev.feedEventShareId && typeof popMenuEl !== "undefined" && popMenuEl) { var d = popMenuEl.querySelector(".menu-item.danger"); if (d) d.remove(); }   /* no delete on a shared event */
        return r;
      };
      openPopMenu.__shareHooked = true;
    }
  }
  function decoratePopover(occ) {
    var p = typeof popEl !== "undefined" ? popEl : null, ev = occ && occ.ev;
    if (!p || !ev || p._occId !== ev.id) return;
    var rows = p.querySelector(".pop-rows");
    if (!rows) return;
    if (ev.feedEventShareId) {
      var share = window.daylightSharing.eventShareFor(ev);
      p.querySelectorAll('[data-act="del"]').forEach(function (b) { b.remove(); });
      rows.querySelectorAll(".pr-sub").forEach(function (n) { if (/Subscribed calendar/.test(n.textContent)) n.textContent = "Shared with you"; });
      rows.querySelectorAll(".pop-main").forEach(function (n) { if (/^Read-only/.test(n.textContent)) n.textContent = "View only \u2014 you can\u2019t change this event."; });
      var info = share || {};
      var by = mk('<div class="pop-row dl-pop-shared"><span class="pop-ic">' + ico("users", 18) + '</span><span class="pop-main"><span class="pr-strong dl-pop-by"></span><span class="pr-sub dl-pop-perm"></span></span></div>');
      by.querySelector(".dl-pop-by").textContent = "Shared by " + (info.owner_name || "someone");
      by.querySelector(".dl-pop-perm").textContent = permText(info.permission) + (info.owner_email ? " \u00b7 " + info.owner_email : "");
      rows.appendChild(by);
      var leave = mk('<div class="pop-row dl-pop-leave"><span class="pop-ic">' + ico("logout", 18) + '</span><span class="pop-main"><button type="button" class="btn-danger-outline dl-btn-sm" data-leave-event>Leave event</button></span></div>');
      leave.querySelector("button").addEventListener("click", function () {
        openConfirm({ title: "Leave this event?", body: "\u201c" + ev.title + "\u201d will disappear from your calendar. " + (info.owner_name || "The owner") + " can invite you again.", confirmLabel: "Leave event", danger: true, fn: async function () {
          try { await rpc("daylight_leave_event_share", { p_id: ev.feedEventShareId }); closePopover(); evSig = ""; await loadEvents(true); toast("You left " + ev.title); }
          catch (e) { toast(friendly(e)); }
        } });
      });
      rows.appendChild(leave);
      return;
    }
    if (!isOwnedEvent(ev)) return;
    /* Edit, Share (person), more, Close: the share button sits between Edit and the more menu. */
    var edit = p.querySelector('[data-act="edit"]');
    if (edit) {
      var shareBtn = mk('<button type="button" class="icon-btn" data-act="share" title="Share event" aria-label="Share event">' + ico("user", 16) + "</button>");
      /* take the exact button treatment of its neighbor: plain popovers use icon-btn, banner popovers use the dark pop-banner-btn circles */
      shareBtn.className = edit.className;
      edit.parentNode.insertBefore(shareBtn, edit.nextSibling);
      shareBtn.addEventListener("click", function (e) { e.stopPropagation(); showShareView(p, ev); });
    }
  }

  window.daylightSharing = {
    rpc: rpc, load: function () { return Promise.all([load(true), loadEvents(true)]); }, friendly: friendly,
    eventShareFor: function (ev) { return ev && ev.feedEventShareId ? evShares.filter(function (s) { return s.share_id === ev.feedEventShareId; })[0] || null : null; },
    openEventShare: function (ev) { return openEventShare(ev); },
    list: function () { return shares.slice(); },
    shareFor: function (calId) { return shares.filter(function (s) { return "share:" + s.share_id === calId; })[0] || null; },
    /* the person's picture (or initials) as an element used on every sharing surface */
    avatar: function (person, size) {
      var d = document.createElement("span");
      d.className = "dl-person-avatar";
      d.style.width = d.style.height = (size || 36) + "px";
      d.style.fontSize = Math.round((size || 36) * 0.38) + "px";
      var url = person && (person.avatar_url || person.avatar || person.owner_avatar);
      var name = (person && (person.name || person.owner_name)) || "";
      var initials = name.trim().split(/\s+/).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join("") || "?";
      if (url) { var img = document.createElement("img"); img.alt = ""; img.src = url; img.onerror = function () { img.remove(); d.textContent = initials; }; d.appendChild(img); }
      else d.textContent = initials;
      return d;
    }
  };
  document.addEventListener("daylight:workspace-preview-ready", function () {
    if (!cloud() || !cloud().user) return;
    try { var ce = JSON.parse(localStorage.getItem(cacheKey() + ":ev") || "null"); if (Array.isArray(ce) && ce.length) { evSig = JSON.stringify(ce); materializeEvents(ce); } } catch (e) {}
    try {
      var c = JSON.parse(localStorage.getItem(cacheKey()) || "null");
      if (c && Array.isArray(c.list) && c.list.length) { loadedSig = JSON.stringify([c.list, c.events]); materialize(c.list, c.events || {}); }
    } catch (e) {}
  });
  document.addEventListener("daylight:workspace-ready", start);
  document.addEventListener("daylight:workspace-signed-out", reset);
  if (cloud() && cloud().ready) start();
  window.addEventListener("focus", function () { if (own() && !document.hidden) { load(); if (cloud().refreshIfBehind) cloud().refreshIfBehind(); } });
})();
