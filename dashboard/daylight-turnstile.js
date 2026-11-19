/* Daylight security check (Cloudflare Turnstile, invisible). One implementation for two uses:
   - window.daylightTurnstile.check(reason, { cancel }) opens the full-page check over the app and resolves true when it passes
     (false only if the person cancels, which is offered for actions, never for sign-in);
   - the /security-check/ page runs the same check, then sends the person on to where they were going.
   The widget token is verified by the turnstile-verify Edge Function, which reads TURNSTILE_SECRET_KEY from the Supabase secrets. While that
   secret is not set the function says "not configured" and the check passes at once, so nobody is ever locked out. */
(function () {
  "use strict";
  var SITE_KEY = "0x4AAAAAAGIfeIbpHfLEL4Jo";
  var VERIFY_URL = "https://usihrcucnreecynewgbd.supabase.co/functions/v1/turnstile-verify";
  var PUBLISHABLE_KEY = "sb_publishable_rFlNj3ZOQtyO-CTftzUhwQ_l9dkfFjM";
  var FRESH_MS = 5 * 60 * 1000, RANDOM_CHANCE = 0.03;
  var scriptP = null, styled = false;

  function fresh() { try { return Date.now() - Number(sessionStorage.getItem("daylight-sc-ok") || 0) < FRESH_MS; } catch (e) { return false; } }
  function mark() { try { sessionStorage.setItem("daylight-sc-ok", String(Date.now())); } catch (e) {} }
  function theme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function loadApi() {
    if (window.turnstile) return Promise.resolve();
    if (scriptP) return scriptP;
    scriptP = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = function () { res(); }; s.onerror = function () { scriptP = null; rej(new Error("load")); };
      document.head.appendChild(s);
    });
    return scriptP;
  }
  function css() {
    if (styled) return; styled = true;
    var st = document.createElement("style");
    st.textContent = [
      ".dl-sc{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
      ".dl-sc[data-t=dark]{--bg:#0f0f10;--text:#f4f4f2;--muted:#a3a29b;--line:#2a2a2c;--card:#171718}.dl-sc[data-t=light]{--bg:#f6f5f2;--text:#111;--muted:#6b6a65;--line:#e3e1db;--card:#fff}",
      ".dl-sc-logo{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:700;letter-spacing:-.02em}.dl-sc-logo svg{width:34px;height:34px;color:var(--text)}",
      ".dl-sc-card{width:100%;max-width:420px;box-sizing:border-box;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:34px 30px 22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.08)}",
      ".dl-sc-card h1{margin:0 0 8px;font-size:22px;font-weight:650;letter-spacing:-.02em;text-transform:lowercase}",
      ".dl-sc-card p{margin:0;font-size:14px;line-height:1.5;color:var(--muted)}",
      ".dl-sc-box{min-height:70px;margin:22px 0 4px;display:flex;align-items:center;justify-content:center;font-size:13.5px;color:var(--muted)}",
      ".dl-sc-spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--text);animation:dlScSpin .8s linear infinite;margin-right:10px}@keyframes dlScSpin{to{transform:rotate(360deg)}}",
      ".dl-sc-err{color:#d4342c;font-weight:550}",
      ".dl-sc-act{display:flex;gap:10px;justify-content:center;margin-top:6px}",
      ".dl-sc-btn{height:42px;padding:0 22px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--text);font:600 14px Inter,sans-serif;cursor:pointer}.dl-sc-btn.p{background:var(--text);color:var(--bg);border-color:var(--text)}",
      ".dl-sc-ref{margin-top:20px;padding-top:14px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted);letter-spacing:.02em;font-variant-numeric:tabular-nums}",
      "@media (prefers-reduced-motion:reduce){.dl-sc-spin{animation:none}}"
    ].join("\n");
    document.head.appendChild(st);
  }
  function rayId() {
    var a = new Uint8Array(8);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  async function verify(token) {
    var r = await fetch(VERIFY_URL, { method: "POST", headers: { "content-type": "application/json", apikey: PUBLISHABLE_KEY }, body: JSON.stringify({ token: token }) });
    if (!r.ok && r.status !== 400) throw new Error("verify " + r.status);
    var j = await r.json();
    return { ok: j.ok === true, configured: j.configured !== false };
  }

  function check(reason, opts) {
    opts = opts || {};
    if (!opts.force && fresh()) return Promise.resolve(true);
    css();
    return new Promise(function (resolve) {
      var ray = rayId(), fails = 0, soft = 0, wid = null, done = false;
      var ov = document.createElement("div");
      ov.className = "dl-sc"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Security check"); ov.setAttribute("data-t", theme());
      ov.innerHTML = '<div class="dl-sc-logo"><svg viewBox="0 0 498 498" aria-hidden="true"><path fill="currentColor" d="M100 326a149 149 0 0 1 298 0z"/><path fill="currentColor" d="M36 339h426v12H36z"/></svg>Daylight</div>' +
        '<div class="dl-sc-card"><h1>security check</h1><p>verification required to continue</p><div class="dl-sc-box" data-box></div>' +
        '<div class="dl-sc-act" data-act hidden></div><div class="dl-sc-ref" data-ref></div></div>';
      document.body.appendChild(ov);
      var box = ov.querySelector("[data-box]"), act = ov.querySelector("[data-act]"), mount = document.createElement("div");
      ov.querySelector("[data-ref]").textContent = "Ref " + ray + " · Protected by Cloudflare";
      function finish(ok) { if (done) return; done = true; try { if (wid !== null && window.turnstile) window.turnstile.remove(wid); } catch (e) {} ov.remove(); resolve(ok); }
      function working(msg) { act.hidden = true; box.innerHTML = '<span class="dl-sc-spin"></span><span></span>'; box.lastChild.textContent = msg; }
      /* a check that cannot run at all (blocked script, widget error) is not a failed check: after two of those, sign-in is let through rather
         than locking the person out of their own account. A token Cloudflare rejects is never let through. */
      function failed(msg, cannotRun) {
        if (cannotRun && !opts.cancel && ++soft >= 2) { try { console.warn("Daylight security check unavailable; continuing"); } catch (e) {} finish(true); return; }
        fails++; box.innerHTML = ""; var m = document.createElement("span"); m.className = "dl-sc-err"; m.textContent = msg; box.appendChild(m);
        act.hidden = false; act.innerHTML = "";
        var retry = document.createElement("button"); retry.type = "button"; retry.className = "dl-sc-btn p"; retry.textContent = "Try again"; retry.addEventListener("click", start); act.appendChild(retry);
        if (opts.cancel || fails >= 3) { var c = document.createElement("button"); c.type = "button"; c.className = "dl-sc-btn"; c.textContent = opts.cancel ? "Cancel" : "Back"; c.addEventListener("click", function () { finish(false); }); act.appendChild(c); }
        retry.focus();
      }
      async function onToken(token) {
        working("Verifying…");
        try {
          var v = await verify(token);
          if (v.ok) { mark(); finish(true); } else failed("That check didn’t pass. Please try again.");
        } catch (e) { failed("Couldn’t reach the verification service. Check your connection and try again."); }
      }
      function start() {
        working("Checking your browser…");
        loadApi().then(function () {
          try {
            if (wid !== null) { window.turnstile.remove(wid); wid = null; }
            mount = document.createElement("div"); ov.querySelector(".dl-sc-card").appendChild(mount);
            wid = window.turnstile.render(mount, { sitekey: SITE_KEY, theme: theme(), appearance: "interaction-only", callback: onToken,
              "error-callback": function () { failed("The check couldn’t run. Please try again.", true); }, "expired-callback": function () { failed("The check expired. Please try again."); }, "timeout-callback": function () { failed("The check timed out. Please try again.", true); } });
          } catch (e) { failed("The check couldn’t start. Please try again.", true); }
        }).catch(function () { failed("Couldn’t load the security check. Check your connection and try again.", true); });
      }
      start();
      document.addEventListener("keydown", function esc(e) { if (done) { document.removeEventListener("keydown", esc, true); return; } if (e.key === "Escape" && opts.cancel) { e.preventDefault(); finish(false); } }, true);
    });
  }
  /* a rare, small chance on a signed-in visit, at most once per browser session */
  function maybeRandom() {
    try { if (sessionStorage.getItem("daylight-sc-rand")) return; sessionStorage.setItem("daylight-sc-rand", "1"); } catch (e) { return; }
    if (Math.random() < RANDOM_CHANCE) check("random", { force: true, cancel: true });
  }
  window.daylightTurnstile = { check: check, maybeRandom: maybeRandom, siteKey: SITE_KEY };
})();
