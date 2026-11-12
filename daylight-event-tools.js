/* Round 14: Select mode. */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function mk(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  var CHECK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.4 6.3l2.4 2.4 4.8-5.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var css = document.createElement("style");
  css.textContent = [
    ".dl-checkbox.is-on .dl-cb-box{background:var(--text);border-color:var(--text)}.dl-checkbox.is-on .dl-cb-box svg path{stroke-dashoffset:0;opacity:1}",
    ".dl-selrow{display:flex;align-items:center;justify-content:flex-end;padding:6px 14px 0}",
    ".dl-selrow .btn-ghost{height:32px;padding:0 12px;font-size:13px}",
    ".dl-sel-cb{flex:none;margin-right:12px;pointer-events:none}",
    ".dl-selecting .agenda-card,.dl-selecting .pal-item{cursor:pointer}",
    ".dl-selecting .is-picked{background:color-mix(in srgb,var(--accent) 9%,transparent)}",
    ".dl-selbar{display:flex;align-items:center;gap:8px;margin:8px 14px 12px;padding:8px 10px 8px 16px;border-radius:12px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-pop);animation:dl-overlay-show .19s cubic-bezier(.23,1,.32,1) both;position:sticky;bottom:12px;z-index:3}",
    ".dl-selbar .dl-sel-count{flex:1;font-size:13.5px;font-weight:600;min-width:0;white-space:nowrap}",
    ".dl-selbar button{height:34px;padding:0 14px;font-size:13px;white-space:nowrap}",
    ".dl-selbar button:disabled{opacity:var(--dl-disabled-opacity,.55);cursor:default}",
    "@media (max-width:560px){.dl-selbar{flex-wrap:wrap}.dl-selbar .dl-sel-count{flex-basis:100%}}",
    "body.reduce-motion .dl-selbar{animation:none!important}",
    "body.dl-selecting .palette-results,body.dl-selecting .agenda-inner{padding-bottom:88px}",
  ].join("\n");
  document.head.appendChild(css);

  /* ===================================================================== Select mode */
  var sel = { surface: null, picked: [], rerender: null, host: null };
  function editable(ev) { try { return !isReadOnlyEvent(ev) && !ev.feedSubscriptionId && !ev.feedShareId && !ev.feedEventShareId && String(ev.cal).indexOf("share:") !== 0 && String(ev.cal).indexOf("evs:") !== 0 && ev.cal !== "holidays" && !(ev.builtin); } catch (e) { return true; } }
  function ownedCals() { return state.calendars.filter(function (c) { return typeof isOwnedCalendar === "function" ? isOwnedCalendar(c) : (!c.subscribed && !c.remoteShareId); }); }
  function count() { return sel.picked.length; }
  function refreshBar() {
    document.querySelectorAll(".dl-selbar").forEach(function (bar) {
      var n = count();
      bar.querySelector(".dl-sel-count").textContent = n + " selected";
      bar.querySelectorAll("[data-needs]").forEach(function (b) { b.disabled = n === 0; });
    });
  }
  function exit() {
    var was = sel.surface; sel.surface = null; sel.picked = [];
    document.body.classList.remove("dl-selecting");
    if (was && sel.rerender) sel.rerender();
  }
  function bar() {
    var b = mk('<div class="dl-selbar" role="toolbar" aria-label="Selected events"><span class="dl-sel-count" aria-live="polite">0 selected</span>' +
      '<button type="button" class="btn-ghost" data-move data-needs aria-haspopup="menu">Move to calendar…</button>' +
      '<button type="button" class="btn-danger-outline" data-del data-needs>Delete</button>' +
      '<button type="button" class="btn-primary" style="margin-left:0" data-done>Done</button></div>');
    b.querySelector("[data-done]").addEventListener("click", exit);
    b.querySelector("[data-move]").addEventListener("click", function () {
      var anchor = this, list = ownedCals();
      openMenu(anchor, [{ label2: "Move to calendar" }].concat(list.map(function (c) {
        return { label: c.name, title: c.name, dot: dotOf(c), fn: function () { moveTo(c); } };
      })), { above: true });
    });
    b.querySelector("[data-del]").addEventListener("click", function () {
      var n = count(); if (!n) return;
      openConfirm({ title: "Delete " + n + (n === 1 ? " event?" : " events?"), body: "This can’t be undone. You can undo right after.", confirmLabel: "Delete", danger: true, fn: function () {
        var list = sel.picked.slice(); sel.picked = [];
        window.daylightDeleteEvents(list);
        exit();
      } });
    });
    refreshBarSoon();
    return b;
  }
  function refreshBarSoon() { setTimeout(refreshBar, 0); }
  function moveTo(cal) {
    var list = sel.picked.slice(); if (!list.length) return;
    list.forEach(function (e) { e.cal = cal.id; });
    sel.picked = [];
    renderAll(false); renderSidebar();
    if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
    toast(list.length === 1 ? "Event moved to " + cal.name : list.length + " events moved to " + cal.name);
    exit();
  }
  window.daylightSelect = {
    active: function (surface) { return sel.surface === surface; },
    /* the "Select" button row (or nothing while selecting) */
    entry: function (surface, rerender) {
      if (sel.surface === surface) return null;
      var row = mk('<div class="dl-selrow"><button type="button" class="btn-ghost" data-select>Select</button></div>');
      row.querySelector("button").addEventListener("click", function () {
        sel.surface = surface; sel.picked = []; sel.rerender = rerender;
        document.body.classList.add("dl-selecting");
        rerender();
      });
      return row;
    },
    bar: function (surface) { return sel.surface === surface ? bar() : null; },
    /* a result row in Select mode: premium checkbox on the left, tap toggles; returns true when the row was handled */
    decorate: function (row, ev, surface) {
      if (sel.surface !== surface) return false;
      var ok = editable(ev);
      var on = sel.picked.indexOf(ev) !== -1;
      var cb = mk('<span class="dl-checkbox dl-sel-cb' + (on ? " is-on" : "") + '"><span class="dl-cb-box">' + CHECK + "</span></span>");
      if (!ok) cb.style.opacity = "var(--dl-disabled-opacity,.55)";
      row.insertBefore(cb, row.firstChild);
      row.setAttribute("role", "checkbox"); row.setAttribute("aria-checked", String(on));
      if (on) row.classList.add("is-picked");
      row.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (!ok) { toast("This event can’t be changed — it comes from a calendar you don’t own."); return; }
        var i = sel.picked.indexOf(ev);
        if (i === -1) sel.picked.push(ev); else sel.picked.splice(i, 1);
        var now = i === -1;
        cb.classList.toggle("is-on", now); row.classList.toggle("is-picked", now); row.setAttribute("aria-checked", String(now));
        refreshBar();
      }, true);
      return true;
    },
    exit: exit
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sel.surface && !document.querySelector(".menu,.backdrop")) { e.preventDefault(); e.stopPropagation(); exit(); }
  }, true);
})();
