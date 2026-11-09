/* Sign-in methods on the auth screen: Google, passkey, a real Create-account page and a real Forgot-password page.
   Layered on top of the screen built in index.html and daylight-cloud.js (nothing is rebuilt; Supabase Auth does every real step).
   - Google: supabase.auth.signInWithOAuth. The provider has to be switched on in the Supabase dashboard; we ask the
     project's public /auth/v1/settings first so a provider that is not set up says so politely instead of landing on an error page.
   - Passkey: supabase.auth.signInWithPasskey (needs the experimental passkey flag on the client, set in daylight-cloud.js, and
     Authentication -> Passkeys switched on in the dashboard). Hidden when this browser has no WebAuthn.
   - Create account: supabase.auth.signUp (name goes into the account's metadata; onboarding prefills from it).
   - Forgot password: supabase.auth.resetPasswordForEmail with a generic confirmation (never says whether the email has an account).
   Nothing here touches the MCP / AI-access OAuth (daylight-oauth.js). */
(function () {
  "use strict";
  if (typeof buildAuthFormInner !== "function") return;

  var css = document.createElement("style");
  css.textContent = [
    ".auth-methods .auth-divider{margin:20px 0 12px}",
    ".auth-methods .auth-social{height:50px;margin-bottom:9px}",
    ".auth-methods .auth-social:disabled{opacity:.6;cursor:default}",
    ".auth-social .auth-social-ic svg{display:block}",
    ".auth-footer-row{text-align:center;font-size:13.5px;color:var(--auth-muted);margin:22px 0 0}",
    ".auth-footer-row button{color:var(--auth-text);font-size:13.5px;font-weight:600;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--auth-faint);margin-left:4px;transition:text-decoration-color 120ms}",
    ".auth-footer-row button:hover{text-decoration-color:var(--auth-text)}",
    ".auth-msg{display:flex;align-items:flex-start;gap:9px;font-size:13.5px;line-height:1.45;border-radius:18px;padding:11px 16px;margin:14px 2px 0;border:1px solid transparent}",
    ".auth-msg .m-ic{flex:none;width:18px;height:18px;margin-top:1px;display:inline-flex;align-items:center;justify-content:center}",
    ".auth-msg.is-error{color:var(--auth-text);background:color-mix(in srgb,#e5484d 12%,var(--auth-field));border-color:color-mix(in srgb,#e5484d 38%,transparent)}",
    ".auth-msg.is-error .m-ic{color:#e5484d}",
    ".auth-msg.is-info{color:var(--auth-text);background:var(--auth-field);border-color:var(--auth-hairline)}",
    ".auth-sent{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;margin:6px 0 4px}",
    ".auth-sent-ic{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,#22a06b 16%,transparent);color:#22a06b}",
    ".auth-sent p{margin:0;font-size:14.5px;line-height:1.55;color:var(--auth-muted)}",
    ".auth-sent p b{color:var(--auth-text);font-weight:600;overflow-wrap:anywhere}",
    ".auth-form-wrap .auth-sent+.auth-primary{margin-top:22px}"
  ].join("\n");
  document.head.appendChild(css);

  var base = buildAuthFormInner;
  var baseBind = bindAuthFormInner;
  var baseEnter = enterApp;
  var SETTINGS_URL = "https://usihrcucnreecynewgbd.supabase.co/auth/v1/settings";
  var KEY = "sb_publishable_rFlNj3ZOQtyO-CTftzUhwQ_l9dkfFjM";
  var flash = null;      /* { kind: "error"|"info", text } shown once under the form's fields, then cleared */
  var busy = false;

  function client() { return window.daylightCloud && window.daylightCloud.client; }
  function mark() { return '<div class="auth-mark"><img class="daylight-mark daylight-mark-light" src="./assets/daylight-sunarc-light-NOBG.png" alt=""><img class="daylight-mark daylight-mark-dark" src="./assets/daylight-sunarc-dark-NOBG.png" alt=""></div>'; }
  function passkeyAvailable() {
    var c = client();
    return !!(window.PublicKeyCredential && c && c.auth && typeof c.auth.signInWithPasskey === "function");
  }
  function msgHtml() {
    if (!flash) return "";
    var m = flash; flash = null;
    return '<div class="auth-msg is-' + m.kind + '" role="' + (m.kind === "error" ? "alert" : "status") + '"><span class="m-ic">' + icon(m.kind === "error" ? "alert" : "check", 16) + "</span><span>" + esc(m.text) + "</span></div>";
  }
  function methodsHtml(withPasskey) {
    return '<div class="auth-methods"><div class="auth-divider"><span>or</span></div>' +
      '<button type="button" class="auth-social" id="authGoogle"><span class="auth-social-ic">' + googleGlyph() + "</span><span>Continue with Google</span></button>" +
      (withPasskey && passkeyAvailable() ? '<button type="button" class="auth-social" id="authPasskey"><span class="auth-social-ic">' + icon("key", 18) + "</span><span>Use a passkey</span></button>" : "") +
      "</div>";
  }
  function footerHtml(login) {
    return login
      ? '<p class="auth-footer-row">New to Daylight?<button type="button" id="authToSignup">Create an account</button></p>'
      : '<p class="auth-footer-row">Already have an account?<button type="button" id="authToLogin">Sign in</button></p>';
  }

  /* ---------------------------------------------------------------- markup */
  buildAuthFormInner = function () {
    var mode = authState.mode;
    if (mode === "forgot-email") {
      return mark() + '<h1 class="auth-headline">Forgot your password?</h1>' +
        '<p class="auth-subline">Enter the email for your account and we’ll send you a link to reset it.</p>' +
        '<div class="auth-fields">' + authPillHtml("authEmail", "Email",
          '<input class="auth-pill-input" id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" value="' + esc(authState.email) + '" aria-invalid="false" aria-describedby="authEmailErr">',
          "authEmailErr", "authEmailTip") + "</div>" + msgHtml() +
        '<button type="submit" class="auth-primary">Send reset link</button>' +
        '<div class="auth-back-row"><button type="button" class="auth-back" id="authToLogin">Back to sign in</button></div>';
    }
    if (mode === "forgot-sent") {
      return mark() + '<h1 class="auth-headline">Check your email</h1>' +
        '<div class="auth-sent"><span class="auth-sent-ic">' + icon("check", 24) + '</span><p>If an account exists for <b>' + esc(authState.email) + "</b>, we’ve sent a link to reset the password. It can take a minute to arrive.</p></div>" +
        '<button type="button" class="auth-primary" id="authToLogin">Back to sign in</button>' +
        '<div class="auth-back-row"><button type="button" class="auth-back" id="authResendReset">Send it again</button></div>';
    }
    if (mode === "signup-sent") {
      return mark() + '<h1 class="auth-headline">Confirm your email</h1>' +
        '<div class="auth-sent"><span class="auth-sent-ic">' + icon("check", 24) + '</span><p>We sent a confirmation link to <b>' + esc(authState.email) + "</b>. Open it to finish creating your account, then sign in.</p></div>" +
        '<button type="button" class="auth-primary" id="authToLogin">Back to sign in</button>';
    }
    var html = base();
    if (mode === "login") {
      html = html.replace('id="authForgot"', 'id="authForgotLink"');
      var forgotRow = html.indexOf('<div class="auth-forgot-row">');
      var tail = msgHtml() + methodsHtml(true) + footerHtml(true);
      html = html.replace(/(<div class="auth-forgot-row">[\s\S]*?<\/div>)/, "$1" + tail);
      if (forgotRow < 0) html += tail;
    } else if (mode === "signup") {
      var pre = msgHtml();
      if (pre) html = html.replace(/(<button type="submit" class="auth-primary">)/, pre + "$1");
      html = html.replace(/(<p class="auth-terms">[\s\S]*?<\/p>)/, function (m) { return m + methodsHtml(false) + footerHtml(false); });
    }
    return html;
  };

  /* ---------------------------------------------------------------- wiring */
  bindAuthFormInner = function (root) {
    baseBind(root);
    function on(id, fn) { var n = root.querySelector("#" + id); if (n) n.addEventListener("click", fn); return n; }
    on("authToSignup", function () { authState.justReset = false; transitionAuthTo(root, "signup"); });
    on("authToLogin", function () { transitionAuthTo(root, "login"); });
    on("authForgotLink", function (e) { e.preventDefault(); authState.justReset = false; captureAuthInputs(root); transitionAuthTo(root, "forgot-email"); });
    on("authResendReset", function () { requestReset(root, true); });
    on("authGoogle", function () { social(root, "google", "Google"); });
    on("authPasskey", function () { passkey(root); });
  };
  /* "or create an account" (the old toggle) and any caller of switchAuthMode */
  switchAuthMode = function (root) { authState.justReset = false; transitionAuthTo(root, authState.mode === "login" ? "signup" : "login"); };
  authPanelLabel = function () {
    var m = authState.mode;
    if (m === "login") return "Log in";
    if (m === "signup" || m === "signup-sent") return "Create account";
    if (m === "forgot-email" || m === "forgot-sent") return "Forgot password";
    return "Reset password";
  };

  function showFlash(root, kind, text) {
    /* put the message straight into the visible form (no re-render, so typed values stay) */
    flash = { kind: kind, text: text };
    var holder = root.querySelector(".auth-form-inner");
    if (!holder) return;
    var old = holder.querySelector(".auth-msg"); if (old) old.remove();
    var tmp = document.createElement("div"); tmp.innerHTML = msgHtml();
    var node = tmp.firstElementChild; if (!node) return;
    var anchor = holder.querySelector(".auth-primary");
    if (holder.querySelector(".auth-methods") && authState.mode === "login") anchor = holder.querySelector(".auth-methods");
    if (anchor && anchor.parentNode === holder) holder.insertBefore(node, anchor); else holder.appendChild(node);
  }
  function setBusy(root, on, label) {
    busy = on;
    root.querySelectorAll(".auth-primary, .auth-social").forEach(function (b) { b.disabled = on; });
    var p = root.querySelector("button.auth-primary[type=submit]");
    if (p) { if (on) { p.dataset.was = p.textContent; p.textContent = label || "Working…"; } else if (p.dataset.was) { p.textContent = p.dataset.was; delete p.dataset.was; } }
  }

  /* ---- Google ---- */
  async function providerOn(name) {
    try {
      var r = await fetch(SETTINGS_URL, { headers: { apikey: KEY } });
      if (!r.ok) return true;                       /* cannot tell: let the provider answer */
      var s = await r.json();
      return !s || !s.external || s.external[name] !== false;
    } catch (e) { return true; }
  }
  async function social(root, name, label) {
    if (busy) return;
    var c = client();
    if (!c) { showFlash(root, "error", "Sign-in isn’t available right now. Check your connection and reload."); return; }
    setBusy(root, true, "Working…");
    try {
      if (!(await providerOn(name))) { setBusy(root, false); showFlash(root, "error", label + " sign-in isn’t available yet. Use your email and password for now."); return; }
      var res = await c.auth.signInWithOAuth({ provider: name, options: { redirectTo: location.origin + location.pathname } });
      if (res && res.error) throw res.error;
      /* the browser is now on its way to the provider: the buttons stay disabled until the page changes (or the person comes back to it) */
      setTimeout(function () { if (busy) setBusy(root, false); }, 6000);
    } catch (e) {
      setBusy(root, false);
      showFlash(root, "error", "We couldn’t start " + label + " sign-in. Please try again.");
    }
  }

  /* ---- passkey ---- */
  async function passkey(root) {
    if (busy) return;
    var c = client();
    if (!passkeyAvailable()) { showFlash(root, "error", "Passkeys aren’t available in this browser."); return; }
    setBusy(root, true, "Working…");
    try {
      var res = await c.auth.signInWithPasskey();
      if (res && res.error) throw res.error;
      /* onAuthStateChange (daylight-cloud.js) loads the workspace */
      setBusy(root, false);
    } catch (e) {
      setBusy(root, false);
      var m = String((e && (e.name || "")) + " " + (e && e.message || "")).toLowerCase();
      if (/notallowed|abort|cancel|timed out/.test(m)) showFlash(root, "info", "Passkey sign-in was cancelled.");
      else if (/not enabled|disabled|not supported|unsupported|passkey.*(off|enable)/.test(m)) showFlash(root, "error", "Passkeys aren’t turned on yet.");
      else showFlash(root, "error", "We couldn’t sign you in with that passkey. Try again or use your password.");
    }
  }

  /* ---- Create account ---- */
  async function signUp(root) {
    var c = client();
    if (!c) { showFlash(root, "error", "Sign-up isn’t available right now. Check your connection and reload."); return; }
    captureAuthInputs(root);
    var name = (authState.name || "").replace(/\s+/g, " ").trim(), email = (authState.email || "").trim(), password = authState.password || "";
    if (!name || !validEmail(email) || !password || pwRuleError(password)) return;
    setBusy(root, true, "Creating account…");
    try {
      var res = await c.auth.signUp({ email: email, password: password, options: { data: { full_name: name }, emailRedirectTo: location.origin + location.pathname } });
      if (res.error) throw res.error;
      var u = res.data && res.data.user;
      if (res.data && res.data.session) { setBusy(root, false); return; }      /* confirmations are off: onAuthStateChange signs in */
      if (u && Array.isArray(u.identities) && u.identities.length === 0) {       /* Supabase's quiet "this email already exists" */
        setBusy(root, false);
        showFlash(root, "error", "An account with this email already exists. Sign in instead, or reset your password.");
        return;
      }
      setBusy(root, false);
      authState.password = "";
      transitionAuthTo(root, "signup-sent");
    } catch (e) {
      setBusy(root, false);
      var m = String(e && e.message || "");
      if (/not allowed|signups? (are )?(not allowed|disabled)|signup.*disabled/i.test(m)) showFlash(root, "error", "New accounts aren’t open yet. Please check back soon.");
      else if (/already (been )?registered|already exists/i.test(m)) showFlash(root, "error", "An account with this email already exists. Sign in instead, or reset your password.");
      else if (/password/i.test(m)) showFlash(root, "error", "That password isn’t accepted. Choose a longer one with a mix of characters.");
      else if (/rate|too many|seconds/i.test(m)) showFlash(root, "error", "Too many attempts. Wait a minute and try again.");
      else showFlash(root, "error", "We couldn’t create your account. Check your connection and try again.");
    }
  }

  /* ---- Forgot password ---- */
  async function requestReset(root, again) {
    var c = client();
    if (!c) { showFlash(root, "error", "Reset isn’t available right now. Check your connection and reload."); return; }
    if (!again) captureAuthInputs(root);
    var email = (authState.email || "").trim();
    if (!validEmail(email)) return;
    setBusy(root, true, "Sending…");
    try {
      var res = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      /* never reveal whether the account exists: a "user not found" style answer looks the same as success */
      var m = String(res && res.error && res.error.message || "");
      if (res && res.error && /rate|too many|seconds/i.test(m)) { setBusy(root, false); showFlash(root, "error", "Too many requests. Wait a minute and try again."); return; }
      setBusy(root, false);
      if (again) { showFlash(root, "info", "Sent again."); return; }
      transitionAuthTo(root, "forgot-sent");
    } catch (e) {
      setBusy(root, false);
      showFlash(root, "error", "We couldn’t send that. Check your connection and try again.");
    }
  }

  enterApp = async function () {
    var root = document.getElementById("authRoot");
    if (authState.mode === "signup") return signUp(root);
    if (authState.mode === "forgot-email") return requestReset(root, false);
    return baseEnter.apply(this, arguments);
  };

  /* coming back to this page (browser Back from a provider) leaves nothing stuck */
  window.addEventListener("pageshow", function () { var r = document.getElementById("authRoot"); if (busy && r) setBusy(r, false); });
  /* a sign-in that finished (any method) leaves nothing behind */
  document.addEventListener("daylight:workspace-signed-out", function () { flash = null; busy = false; });
  /* ROOT CAUSE of "the social buttons only appear after signing out": daylight-cloud.js resolves the saved session while it loads and,
     with no session, paints the sign-in screen right away (showSignedOut -> renderAuth), which can happen BEFORE this file has replaced
     buildAuthFormInner. A sign-out later rebuilt the screen with the new builder, so the buttons showed up then and vanished on reload.
     Fix: the moment these overrides are installed, rebuild any sign-in screen that was already painted with the old builder. The result
     is the same on a cold load, a reload and after signing out. */
  (function repaintIfPainted() {
    var root = document.getElementById("authRoot");
    if (root && root.querySelector("#authScreen") && typeof renderAuth === "function") renderAuth();
  })();
  window.daylightAuthMethods = { passkeyAvailable: passkeyAvailable };
})();
