/* Daylight routes. The same app code runs on three real pages that share one code base:
     /login      -> the sign-in screen          (window.__DL_ROUTE = "login")
     /sign-up    -> the create-account screen   (window.__DL_ROUTE = "sign-up")
     /dashboard  -> the app itself              (window.__DL_ROUTE = "dashboard")
   A signed-out visitor on /dashboard goes to /login. A signed-in visitor on /login or /sign-up goes to /dashboard.
   Everything is relative to this page, so it works under the GitHub Pages project path (/daylight/) and on a domain root alike.
   The OAuth consent parameters ride along so an AI connection that needs a sign-in comes back to its consent step afterwards. */
(function () {
  "use strict";
  var route = window.__DL_ROUTE || "dashboard";
  var here = new URL(".", location.href);
  var siteRoot = new URL("../", here).href;
  function pageUrl(name) { return siteRoot + name + "/"; }
  function carry() {
    var s = new URLSearchParams(location.search), keep = new URLSearchParams();
    ["oauth_consent", "authorization_id", "settings", "support"].forEach(function (k) { if (s.has(k)) keep.set(k, s.get(k)); });
    var q = keep.toString();
    return q ? "?" + q : "";
  }
  /* window.__DL_NO_ROUTING is a test hook (the one-page UI smoke drives sign-in and the app on a single document); it is never set in production. */
  window.daylightRoute = {
    route: route,
    siteRoot: siteRoot,
    url: pageUrl,
    /* where Supabase should send a visitor back to after a provider / email link: the site root forwards to the right page */
    authReturn: siteRoot,
    authMode: function () { return route === "sign-up" ? "signup" : "login"; },
    goDashboard: function () { if (route === "dashboard" || window.__DL_NO_ROUTING) return false; location.replace(pageUrl("dashboard") + carry()); return true; },
    goLogin: function () { if (route !== "dashboard" || window.__DL_NO_ROUTING) return false; location.replace(pageUrl("login") + carry()); return true; }
  };
  /* switching between the two forms keeps the address bar honest (/login <-> /sign-up) without leaving the page */
  if (route !== "dashboard" && typeof transitionAuthTo === "function") {
    var baseTransition = transitionAuthTo;
    transitionAuthTo = function (root, newMode) {
      if ((newMode === "login" || newMode === "signup") && authState.mode !== newMode) authState.dropPw = true;
      baseTransition.apply(this, arguments);
      try {
        if (newMode === "login" || newMode === "signup") {
          var next = newMode === "signup" ? "sign-up" : "login";
          route = next; window.daylightRoute.route = next;
          history.replaceState(null, "", pageUrl(next) + carry());
          document.title = newMode === "signup" ? "Create your Daylight account" : "Sign in to Daylight";
        }
      } catch (e) {}
    };
  }
})();
