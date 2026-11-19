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
      ".dl-sc{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:24px;background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;animation:dlScFade .25s ease-out both}",
      ".dl-sc[data-t=dark]{--bg:#111;--text:#f4f4f2;--muted:#a3a29b;--faint:#757575;--line:#2c2c2c;--card:#1a1a1a;--tile:#232323;--shadow:0 1px 2px rgba(0,0,0,.32),0 8px 24px rgba(0,0,0,.32),0 24px 56px rgba(0,0,0,.42)}",
      ".dl-sc[data-t=light]{--bg:#f6f5f1;--text:#111;--muted:#6b6a65;--faint:#a3a19a;--line:#ebe9e3;--card:#fff;--tile:#f2f1ec;--shadow:0 1px 2px rgba(20,18,10,.05),0 8px 24px rgba(20,18,10,.06),0 24px 56px rgba(20,18,10,.07)}",
      ".dl-sc-logo{display:flex;align-items:center;gap:10px}.dl-sc-tile{display:grid;place-items:center}.dl-sc-tile svg{width:38px;height:38px;color:var(--text)}",
      ".dl-sc-word{font-size:24px;font-weight:700;letter-spacing:-.025em;line-height:1}",
      ".dl-sc-card{width:100%;max-width:400px;box-sizing:border-box;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:32px 30px 20px;text-align:center;box-shadow:var(--shadow);animation:dlScRise .35s cubic-bezier(.2,.8,.2,1) both}",
      ".dl-sc-badge{width:48px;height:48px;margin:0 auto 16px;border-radius:50%;background:var(--tile);border:1px solid var(--line);display:grid;place-items:center;color:var(--text)}.dl-sc-badge svg{width:22px;height:22px}",
      ".dl-sc-card h1{margin:0 0 6px;font-size:22px;font-weight:650;letter-spacing:-.022em;line-height:1.2}",
      ".dl-sc-card p{margin:0;font-size:14px;line-height:1.5;color:var(--muted)}",
      ".dl-sc-box{min-height:92px;margin:22px 0 4px;padding:16px;border-radius:16px;background:var(--tile);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:14px;color:var(--muted);box-sizing:border-box}",
      ".dl-sc-spin{width:26px;height:26px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--text);animation:dlScSpin .8s linear infinite}",
      ".dl-sc-ok{width:32px;height:32px;border-radius:50%;background:#1e8e5a;color:#fff;display:grid;place-items:center;animation:dlScPop .32s cubic-bezier(.2,.9,.3,1.3) both}.dl-sc-ok svg{width:17px;height:17px}",
      ".dl-sc-box span.t{color:var(--text);font-weight:550;font-size:14px}.dl-sc-err{color:#d4342c;font-weight:550;line-height:1.45}",
      ".dl-sc-act{display:flex;gap:10px;justify-content:center;margin-top:14px}.dl-sc-act[hidden]{display:none}",
      ".dl-sc-btn{height:42px;padding:0 22px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--text);font:600 14px Inter,sans-serif;cursor:pointer;transition:background .14s,transform .14s}.dl-sc-btn:hover{background:var(--tile)}.dl-sc-btn:active{transform:scale(.97)}.dl-sc-btn.p{background:var(--text);color:var(--bg);border-color:var(--text)}.dl-sc-btn.p:hover{opacity:.9;background:var(--text)}.dl-sc-btn:focus-visible{outline:2px solid #1a73e8;outline-offset:2px}",
      ".dl-sc-ref{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--faint);letter-spacing:.01em;font-variant-numeric:tabular-nums}",
      "@keyframes dlScSpin{to{transform:rotate(360deg)}}@keyframes dlScPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}@keyframes dlScFade{from{opacity:0}to{opacity:1}}@keyframes dlScRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion:reduce){.dl-sc,.dl-sc-card,.dl-sc-ok{animation:none}.dl-sc-spin{animation-duration:2.4s}}",
      "@media (max-width:440px){.dl-sc-card{padding:26px 20px 16px;border-radius:22px}.dl-sc-ref{justify-content:center;text-align:center}}"
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
      ov.className = "dl-sc"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Security Check"); ov.setAttribute("data-t", theme());
      ov.innerHTML = '<div class="dl-sc-logo"><span class="dl-sc-tile"><svg viewBox="0 0 498 498" aria-hidden="true"><path fill="currentColor" d="M100 326a149 149 0 0 1 298 0z"/><path fill="currentColor" d="M36 339h426v12H36z"/></svg></span><span class="dl-sc-word">Daylight</span></div>' +
        '<div class="dl-sc-card"><div class="dl-sc-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6Z"/><path d="m9 12 2.2 2.2L15.2 10"/></svg></div><h1>Security Check</h1><p>Verification required to continue</p><div class="dl-sc-box" data-box></div>' +
        '<div class="dl-sc-act" data-act hidden></div><div class="dl-sc-ref"><span data-ray></span><span>Protected by Cloudflare</span></div></div>';
      document.body.appendChild(ov);
      var box = ov.querySelector("[data-box]"), act = ov.querySelector("[data-act]"), mount = document.createElement("div");
      ov.querySelector("[data-ray]").textContent = "Ref " + ray;
      function finish(ok) { if (done) return; done = true; try { if (wid !== null && window.turnstile) window.turnstile.remove(wid); } catch (e) {} ov.remove(); resolve(ok); }
      function working(msg) { act.hidden = true; box.innerHTML = '<span class="dl-sc-spin"></span><span class="t"></span>'; box.lastChild.textContent = msg; }
      function verified() { act.hidden = true; box.innerHTML = '<span class="dl-sc-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><span class="t">Verified</span>'; }
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
          if (v.ok) { mark(); verified(); setTimeout(function () { finish(true); }, 520); } else failed("That check didn’t pass. Please try again.");
        } catch (e) { failed("Couldn’t reach the verification service. Check your connection and try again."); }
      }
      function start() {
        working("Verifying your browser…");
        loadApi().then(function () {
          try {
            if (wid !== null) { window.turnstile.remove(wid); wid = null; }
            mount = document.createElement("div"); ov.querySelector(".dl-sc-card").appendChild(mount);
            wid = window.turnstile.render(mount, { sitekey: SITE_KEY, theme: theme(), appearance: "interaction-only", size: "normal", callback: onToken,
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
