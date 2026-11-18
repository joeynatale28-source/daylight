/* Daylight cookie notice. One small file used by every public page and by the app.
   - Shows a small card in the bottom-left corner until the person chooses Accept or Deny.
   - The choice is remembered ("accepted" / "denied") in this browser, in localStorage and a first-party cookie.
   - Strictly necessary storage (the sign-in session, security, theme) always works: it is not governed by this choice.
     Daylight has no advertising or analytics cookies; anything optional added later must ask window.daylightConsent.allowed() first.
   - Reopen it from a "Cookie settings" link in a footer (any element with data-cookie-settings) or from Settings -> Your data.
   - It never covers the page: it is small, sits in a corner, and is not a modal. */
(function () {
  "use strict";
  if (window.daylightConsent) return;
  var KEY = "daylight-cookie-consent";
  var script = document.currentScript;
  var base = script && script.src ? new URL("../", script.src) : new URL("./", location.href);   // the site root
  var privacyUrl = new URL("privacy/", base).href;
  var cookiePath = base.pathname || "/";

  function readCookie() {
    var m = document.cookie.match(/(?:^|;\s*)daylight_consent=(accepted|denied)/);
    return m ? m[1] : null;
  }
  function get() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    if (v !== "accepted" && v !== "denied") v = readCookie();
    return v === "accepted" || v === "denied" ? v : null;
  }
  function store(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    try { document.cookie = "daylight_consent=" + v + "; max-age=31536000; path=" + cookiePath + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch (e) {}
  }

  var css = document.createElement("style");
  css.textContent = [
    ".dlck{--ck-bg:#fff;--ck-fg:#171717;--ck-mute:#525252;--ck-line:#e5e5e5;--ck-btn:#171717;--ck-btn-fg:#fff;--ck-ghost:#f5f5f5;--ck-shadow:0 10px 36px rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.06);",
    "position:fixed;left:20px;bottom:20px;z-index:2147483000;box-sizing:border-box;width:min(380px,calc(100vw - 32px));padding:16px 16px 14px 18px;border-radius:20px;background:var(--ck-bg);color:var(--ck-fg);border:1px solid var(--ck-line);box-shadow:var(--ck-shadow);font:400 13.5px/1.5 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:-.005em;animation:dlckIn 280ms cubic-bezier(.16,1,.3,1) both}",
    ".dlck[hidden]{display:none}",
    ".dlck p{margin:0 0 12px;color:var(--ck-fg)}",
    ".dlck a{color:inherit;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;white-space:nowrap}",
    ".dlck a:hover{text-decoration-thickness:2px}",
    ".dlck-b{display:flex;gap:8px;justify-content:flex-end}",
    ".dlck button{font:600 13px/1 Inter,system-ui,sans-serif;height:34px;padding:0 18px;border-radius:999px;border:1px solid var(--ck-line);background:transparent;color:var(--ck-fg);cursor:pointer;transition:background 140ms ease,transform 140ms ease}",
    ".dlck button:hover{background:var(--ck-ghost)}",
    ".dlck button:active{transform:scale(.97)}",
    ".dlck button[data-accept]{background:var(--ck-btn);color:var(--ck-btn-fg);border-color:var(--ck-btn)}",
    ".dlck button[data-accept]:hover{opacity:.88;background:var(--ck-btn)}",
    ".dlck button[aria-pressed=true]{box-shadow:0 0 0 2px var(--ck-bg),0 0 0 3.5px var(--ck-fg)}",
    ".dlck button:focus-visible,.dlck a:focus-visible{outline:2px solid var(--ck-fg);outline-offset:2px}",
    "@keyframes dlckIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    "@media (prefers-reduced-motion:reduce){.dlck{animation:none}}",
    "@media (max-width:520px){.dlck{left:12px;right:12px;bottom:12px;width:auto}}",
    /* the sign-in / create-account pages: the form is on the left, so the notice sits over the picture on the right; on a phone the form
       gets room under it instead (the notice never covers a field or a button) */
    "@media (min-width:900px){.dlck.dlck-auth{left:auto;right:20px}}",
    "html.dlck-on #authScreen{padding-bottom:var(--dlck-h,0px)}",
    "@media (min-width:900px){html.dlck-on #authScreen{padding-bottom:0}}",
    /* black in dark theme: follows the system on the public pages, and the app's own theme switch inside the app */
    "@media (prefers-color-scheme:dark){:root:not([data-theme]) .dlck{--ck-bg:#000;--ck-fg:#f5f5f5;--ck-mute:#a3a3a3;--ck-line:#2e2e2e;--ck-btn:#f5f5f5;--ck-btn-fg:#000;--ck-ghost:#1a1a1a;--ck-shadow:0 10px 36px rgba(0,0,0,.6),0 1px 3px rgba(0,0,0,.4)}}",
    "[data-theme=dark] .dlck{--ck-bg:#000;--ck-fg:#f5f5f5;--ck-mute:#a3a3a3;--ck-line:#2e2e2e;--ck-btn:#f5f5f5;--ck-btn-fg:#000;--ck-ghost:#1a1a1a;--ck-shadow:0 10px 36px rgba(0,0,0,.6),0 1px 3px rgba(0,0,0,.4)}"
  ].join("\n");
  document.head.appendChild(css);

  var root = null, listeners = [];
  function room() {   /* tell the page how tall the notice is (only the phone-size sign-in screen uses it) */
    var on = root && !root.hidden;
    document.documentElement.classList.toggle("dlck-on", !!on);
    if (on) document.documentElement.style.setProperty("--dlck-h", (root.offsetHeight + 24) + "px");
  }
  function paint() {
    if (!root) return;
    var v = get();
    root.querySelector("[data-accept]").setAttribute("aria-pressed", String(v === "accepted"));
    root.querySelector("[data-deny]").setAttribute("aria-pressed", String(v === "denied"));
  }
  function build() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "dlck" + (window.__DL_ROUTE && window.__DL_ROUTE !== "dashboard" ? " dlck-auth" : ""); root.id = "dlCookie"; root.hidden = true;
    root.setAttribute("role", "region"); root.setAttribute("aria-label", "Cookie notice");
    root.innerHTML = '<p>We use cookies to keep you signed in and remember your preferences. <a href="' + privacyUrl + '">Privacy Policy</a></p>' +
      '<div class="dlck-b"><button type="button" data-deny>Deny</button><button type="button" data-accept>Accept</button></div>';
    root.querySelector("[data-deny]").addEventListener("click", function () { set("denied"); });
    root.querySelector("[data-accept]").addEventListener("click", function () { set("accepted"); });
    document.body.appendChild(root);
    return root;
  }
  function set(v) {
    if (v !== "accepted" && v !== "denied") return;
    store(v); paint();
    if (root) root.hidden = true;
    room();
    listeners.forEach(function (fn) { try { fn(v); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent("daylight:consent", { detail: v })); } catch (e) {}
  }
  function open() {
    build(); paint(); root.hidden = false; room();
    root.style.animation = "none"; void root.offsetWidth; root.style.animation = "";
    var b = root.querySelector(get() === "accepted" ? "[data-accept]" : "[data-deny]"); if (b) try { b.focus({ preventScroll: true }); } catch (e) {}
  }
  window.daylightConsent = {
    get: get,                                        // "accepted" | "denied" | null (not chosen yet)
    allowed: function () { return get() === "accepted"; },   // optional, non-essential things may run only when this is true
    set: set, open: open,
    onChange: function (fn) { listeners.push(fn); }
  };

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("[data-cookie-settings]");
    if (!a) return;
    e.preventDefault(); open();
  });
  function start() { if (!get()) { build(); root.hidden = false; paint(); room(); } }
  window.addEventListener("resize", room);
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
