/* Calendars other Daylight accounts have shared with this account.
   - They are read through database functions (one calendar's events at a time) and kept OUT of this account's own workspace
     save, the same way subscribed calendars are.
   - "Can edit": changes made here are sent to the database as a small list of operations; the database checks the permission
     and writes into the owner's single calendar (there is no copy). "View only": the interface offers no editing, and the
     database refuses writes regardless.
   - If the server says no (permission changed, calendar removed), the local view snaps back to what the server has. */
(function () {
  "use strict";
  var shares = [], known = {}, lastEvents = {}, loadedSig = "", pollTimer = null, pushTimer = null, pushing = false, pushAgain = false, seq = 0;

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
    try { localStorage.setItem(cacheKey(), JSON.stringify({ list: list, events: events })); } catch (e) {}
    document.dispatchEvent(new Event("daylight:shared-changed"));
  }

  /* ---- writing ("Can edit") ---- */
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(push, 380); }
  async function push() {
    pushTimer = null;
    if (!own() || !shares.length) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true;
    try {
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

  /* Any change to events ends in a render; a quiet check afterwards sends what changed on shared calendars. */
  function hookRender() {
    if (typeof renderAll !== "function" || renderAll.__shareHooked) return;
    var original = renderAll;
    renderAll = function () { var r = original.apply(this, arguments); if (shares.length) schedulePush(); return r; };
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
    hookRender(); hookRow();
    load();
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (document.hidden) return; load(); if (cloud() && cloud().refreshIfBehind) cloud().refreshIfBehind(); }, 60 * 1000);
  }
  function reset() {
    seq++; shares = []; known = {}; lastEvents = {}; loadedSig = "";
    clearInterval(pollTimer); pollTimer = null; clearTimeout(pushTimer); pushTimer = null; pushing = false; pushAgain = false;
  }

  window.daylightSharing = {
    rpc: rpc, load: function () { return load(true); }, friendly: friendly,
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
