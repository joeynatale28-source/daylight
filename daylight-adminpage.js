/* Sidebar rows above Settings (Documentation for everyone, Admin for owners only) and the owner's Admin page.
   - Documentation: a normal-looking row with no link yet; clicking it does nothing for now.
   - Admin: an owner-only row. The page swaps into the main area exactly like Tasks does (the sidebar stays). It carries the
     notification and banner tools (the cards come from daylight-admin.js) on two tabs: Notifications and Banners.
     Owners are decided by the database (daylight_is_owner); a non-owner never gets the row or the page. */
(function () {
  "use strict";

  if (window.ICONS && !ICONS.book) ICONS.book = '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>';

  var css = document.createElement("style");
  css.textContent = [
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
    "@media (max-width:820px){.dl-page{padding:20px 16px 36px}}"
  ].join("\n");
  document.head.appendChild(css);

  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function isOwner() { return !!(window.daylightAdmin && window.daylightAdmin.isOwner && window.daylightAdmin.isOwner()); }

  /* ---------------------------------------------------------------- the Admin page */
  function adminPage() {
    var page = make('<div class="dl-page"><div class="dl-page-inner"><div class="dl-page-head"><h1 class="dl-page-title">Admin</h1></div></div></div>');
    var inner = page.querySelector(".dl-page-inner");
    var tabs = make('<div class="dl-tabs" role="tablist" aria-label="Admin sections"><button type="button" role="tab" data-tab="notifications">Notifications</button><button type="button" role="tab" data-tab="banners">Banners</button></div>');
    inner.appendChild(tabs);
    var panels = { notifications: make('<div data-panel="notifications"></div>'), banners: make('<div data-panel="banners" hidden></div>') };
    /* daylight-admin.js builds four cards (send notification, banner, notifications sent, active banners): split them over the two tabs */
    var tmp = document.createElement("div");
    if (window.daylightAdminPane) {
      window.daylightAdminPane(tmp);
      var kids = [].slice.call(tmp.children).filter(function (c) { return c.classList.contains("set-group"); });
      if (kids[0]) panels.notifications.appendChild(kids[0]);
      if (kids[2]) panels.notifications.appendChild(kids[2]);
      if (kids[1]) panels.banners.appendChild(kids[1]);
      if (kids[3]) panels.banners.appendChild(kids[3]);
    }
    Object.keys(panels).forEach(function (k) { inner.appendChild(panels[k]); });
    function show(name) {
      tabs.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === name)); });
      Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== name; });
      try { sessionStorage.setItem("daylight-admin-tab", name); } catch (e) {}
    }
    tabs.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); }); });
    var start = "notifications";
    try { start = sessionStorage.getItem("daylight-admin-tab") || start; } catch (e) {}
    show(start in panels ? start : "notifications");
    return page;
  }

  /* renderView: the Admin page replaces the calendar/tasks view; the sidebar stays */
  var originalRenderView = renderView;
  renderView = function (animate, dir) {
    if (state.section === "admin" && isOwner()) {
      closePopover(); closeMenu();
      var host = document.getElementById("viewWrap");
      host.innerHTML = "";
      host.appendChild(adminPage());
      return;
    }
    if (state.section === "admin") state.section = "calendar";   /* non-owners never see the page */
    return originalRenderView.apply(this, arguments);
  };
  var originalPageBy = pageBy;
  pageBy = function () { if (state.section === "admin") return; return originalPageBy.apply(this, arguments); };
  function openAdmin() { state.section = "admin"; renderAll(true, 1); closeDrawer(); }

  /* ---------------------------------------------------------------- sidebar rows */
  function decorateSidebar() {
    var sb = document.getElementById("sidebar");
    if (!sb) return;
    var settings = [].slice.call(sb.querySelectorAll(".side-row")).filter(function (b) { return b.getAttribute("title") === "Settings"; })[0];
    if (!settings || sb.querySelector("[data-side-row]")) return;
    function row(title, ic, fn, flag, active) {
      var b = el('<button class="side-row' + (active ? " active" : "") + '" title="' + title + '" data-side-row="' + flag + '">' + icon(ic, 18) + '<span class="rail-hide">' + title + "</span></button>");
      b.addEventListener("click", fn);
      sb.insertBefore(b, settings);
    }
    if (isOwner()) row("Admin", "shield", openAdmin, "admin", state.section === "admin");
    /* Documentation: a normal-looking row; the link comes later, so clicking does nothing for now */
    row("Documentation", "book", function (e) { e.preventDefault(); }, "docs", false);
  }
  var originalRenderSidebar = renderSidebar;
  renderSidebar = function () {
    var r = originalRenderSidebar.apply(this, arguments);
    try { decorateSidebar(); } catch (e) { /* the sidebar works without these rows */ }
    return r;
  };

  /* ---------------------------------------------------------------- lifecycle */
  document.addEventListener("daylight:workspace-ready", function () {
    if (window.daylightAdmin && window.daylightAdmin.whenKnown) window.daylightAdmin.whenKnown().then(function (owner) { if (owner) renderSidebar(); });
  });
  document.addEventListener("daylight:workspace-signed-out", function () { if (window.state && state.section === "admin") state.section = "calendar"; });
})();
