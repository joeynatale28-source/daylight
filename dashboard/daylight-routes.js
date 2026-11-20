/* Every full dashboard page has its own address under /dashboard:
     Calendar  /dashboard/        Tasks  /dashboard/tasks        Support Center  /dashboard/support        Admin  /dashboard/admin
   Moving between them updates the address (back / forward work), and opening or refreshing a link lands on the right page. Dialogs and panels
   (Settings, event details, notifications) are not pages and have no route. The deploy serves the app page from each of these folders. */
(function () {
  "use strict";
  if (window.__DL_NO_ROUTING) return;
  var m0 = location.pathname.match(/^(.*\/dashboard\/)/);
  if (!m0 || !/^https?:/.test(location.protocol)) return;
  var BASE = m0[1];
  var SLUG = { calendar: "", tasks: "tasks", support: "support", admin: "admin" };
  var ready = false, applying = false;

  function secFromPath() {
    var rest = location.pathname.slice(BASE.length).replace(/\/+$/, "");
    return rest === "tasks" ? "tasks" : rest === "support" ? "support" : (rest === "admin" || rest === "admin/users") ? "admin" : "calendar";
  }
  function pathFor(sec) { return BASE + (SLUG[sec] || ""); }
  function norm(p) { return p.replace(/\/+$/, ""); }
  function isOwner() { return !!(window.daylightAdmin && window.daylightAdmin.isOwner && window.daylightAdmin.isOwner()); }

  function sync() {
    if (!ready || applying || !window.state || !(state.section in SLUG)) return;
    var want = pathFor(state.section);
    if (norm(location.pathname) === norm(want) && (state.section === "calendar" || location.pathname === want)) return;
    if (/oauth_consent|authorization_id/.test(location.search)) return;   /* the AI-access consent step keeps its own address */
    try { history.pushState({ dlSection: state.section }, "", want); } catch (e) {}
  }

  var baseRenderAll = renderAll;
  renderAll = function () { var r = baseRenderAll.apply(this, arguments); sync(); return r; };

  function go(sec, replace) {
    applying = true;
    try {
      if (sec === "support" && window.daylightSupport) window.daylightSupport.open();
      else { state.section = sec; renderAll(true, 1); }
    } finally { applying = false; }
    if (replace) { try { history.replaceState({ dlSection: state.section }, "", pathFor(state.section)); } catch (e) {} }
    else sync();
  }

  window.addEventListener("popstate", function () {
    if (!ready || !window.state) return;
    var sec = secFromPath();
    if (sec === "admin" && !isOwner()) { go("calendar", true); return; }
    applying = true;
    try {
      if (sec === "support" && window.daylightSupport) window.daylightSupport.open();
      else { state.section = sec; renderAll(true, 1); }
    } finally { applying = false; }
  });

  function start() {
    if (ready) return;
    ready = true;
    var sec = secFromPath();
    if (sec === "calendar") { try { history.replaceState({ dlSection: "calendar" }, "", BASE); } catch (e) {} return; }
    if (sec === "admin") {
      /* who the owner is arrives a moment after the workspace (it is asked again if the first answer fails): wait for the real answer,
         open Admin with the Users tab for an owner, and send everyone else to the calendar */
      if (/\/admin\/users\/?$/.test(location.pathname)) { try { sessionStorage.setItem("daylight-admin-tab", "users"); } catch (e) {} }
      var done = false, finish = function (owner) {
        if (done) return; done = true;
        if (owner) go("admin", true); else { try { history.replaceState(null, "", BASE); } catch (e) {} }
      };
      if (window.daylightAdmin && window.daylightAdmin.whenKnown) window.daylightAdmin.whenKnown().then(finish);
      else finish(isOwner());
      return;
    }
    go(sec, true);   /* also drops the trailing slash the static host adds */
  }
  document.addEventListener("daylight:workspace-ready", start);
  document.addEventListener("daylight:workspace-signed-out", function () { ready = false; });
  var c = window.daylightCloud; if (c && c.ready && c.user) start();
})();
