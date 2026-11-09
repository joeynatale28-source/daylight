/* Settings -> Profile -> Security: Password, Passkeys and Sign-in methods.
   These are account actions that happen on the server at the moment you do them (a passkey is registered by your device, a
   provider is linked by a redirect), so they apply instantly: they are not part of the Save / Discard transaction.
   Everything is a real Supabase Auth call and every state reflects what Supabase returns:
     passkeys   auth.registerPasskey(), auth.passkey.list / update / delete   (experimental flag set in daylight-cloud.js)
     providers  auth.getUserIdentities(), auth.linkIdentity({provider}), auth.unlinkIdentity(identity)
   If a call is not available (project setting off, old browser) the row says so instead of pretending. */
(function () {
  "use strict";
  if (typeof window.daylightProfilePane !== "function") return;
  var baseProfile = window.daylightProfilePane;

  if (window.ICONS && !ICONS.mail) ICONS.mail = '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>';

  var css = document.createElement("style");
  css.textContent = [
    ".dl-new-badge{display:inline-block;vertical-align:1px;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--accent);color:var(--accent-fg,#fff);font-size:11px;font-weight:650;letter-spacing:.01em;line-height:16px}",
    ".dl-sec-list{display:flex;flex-direction:column}",
    ".dl-sec-list .dl-sec-row{padding:12px 0;border-top:1px solid var(--line-soft)}",
    ".dl-sec-list .dl-sec-row:first-child{border-top:0}",
    ".dl-sec-group .dl-sec-row.is-main{padding:4px 0 10px}",
    ".dl-sec-actions{display:inline-flex;gap:8px;flex:none;align-items:center}",
    ".dl-sec-actions .btn-danger-outline{height:32px;padding:0 13px;font-size:12.5px;border-radius:999px}",
    ".dl-sec-rename{display:flex;gap:8px;align-items:center;flex:1;min-width:0}",
    ".dl-sec-rename input{height:36px;flex:1;min-width:0;border-radius:10px}",
    ".dl-sec-hint{font-size:12.5px;color:var(--muted);line-height:1.5;margin:0 0 10px}",
    ".dl-sec-note{font-size:12.5px;color:var(--muted);flex:none;max-width:210px;text-align:right;line-height:1.4}",
    ".dl-sec-sep{height:1px;background:var(--line-soft);margin:6px 0 10px}",
    ".dl-sec-sub-title{font-size:13px;font-weight:600;margin:12px 0 2px}",
    /* the setup dialog */
    ".dl-pk-steps{margin:0 0 18px;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px}",
    ".dl-pk-steps li{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.5;color:var(--muted)}",
    ".dl-pk-steps li b{color:var(--text);font-weight:600}",
    ".dl-pk-steps .n{flex:none;width:24px;height:24px;border-radius:50%;background:var(--hover);display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--text)}",
    ".dl-pk-ok{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:14px 0 6px}",
    ".dl-pk-ok-ic{width:44px;height:44px;border-radius:50%;background:color-mix(in srgb,#22a06b 16%,transparent);color:#22a06b;display:grid;place-items:center}",
    ".dl-pk-ok b{font-size:17px;font-weight:620}.dl-pk-ok span{font-size:14px;color:var(--muted);line-height:1.5}"
  ].join("\n");
  document.head.appendChild(css);

  function client() { return window.daylightCloud && window.daylightCloud.client; }
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function dateText(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function passkeysApi() {
    var c = client();
    return !!(window.PublicKeyCredential && c && c.auth && typeof c.auth.registerPasskey === "function" && c.auth.passkey && typeof c.auth.passkey.list === "function");
  }
  function deviceName() { try { return (window.daylightSessionDevice ? window.daylightSessionDevice(navigator.userAgent).label : "") || "This device"; } catch (e) { return "This device"; } }
  function errText(e, what) {
    var n = String((e && e.name) || ""), m = String((e && e.message) || "");
    if (/NotAllowed|Abort/i.test(n) || /cancel|timed out|not allowed/i.test(m)) return "That was cancelled. Nothing was changed.";
    if (/not enabled|disabled|not supported|unsupported/i.test(m)) return what + " isn’t turned on for this project yet.";
    if (/manual linking|linking is disabled/i.test(m)) return "Linking sign-in methods isn’t turned on yet.";
    if (/at least two|minimum|last identity/i.test(m)) return "That’s your only sign-in method. Add another one first.";
    return "Something went wrong. Please try again.";
  }

  /* ---------------------------------------------------------------- the setup dialog */
  function openPasskeyDialog(onDone) {
    var bd = el('<div class="backdrop"><div class="dialog dl-std dl-look" role="dialog" aria-modal="true" aria-label="Set up a passkey">' +
      '<div class="dialog-head"><span class="dialog-title">Set up a passkey</span><button type="button" class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
      '<div class="dialog-body" data-body>' +
      '<ul class="dl-pk-steps"><li><span class="n">1</span><span><b>Name it.</b> Pick something you will recognize later, like the device it lives on.</span></li>' +
      '<li><span class="n">2</span><span><b>Confirm on your device.</b> Use your fingerprint, face, screen lock or a security key when your browser asks.</span></li>' +
      '<li><span class="n">3</span><span><b>Sign in without a password.</b> Next time choose “Use a passkey” on the sign-in page.</span></li></ul>' +
      '<div class="field dl-std-field"><label for="pkName">Passkey name</label><input class="text-input" id="pkName" maxlength="60" autocomplete="off"></div>' +
      '<div class="dl-banner" role="alert" hidden></div></div>' +
      '<div class="dialog-foot" data-foot><button type="button" class="btn-ghost" data-cancel>Cancel</button><button type="button" class="btn-primary" style="margin-left:0" data-go>Create passkey</button></div></div></div>');
    overlayRoot.appendChild(bd);
    var name = bd.querySelector("#pkName"), go = bd.querySelector("[data-go]"), banner = bd.querySelector(".dl-banner");
    name.value = deviceName();
    function close() { document.removeEventListener("keydown", onKey, true); if (window.daylightExit) window.daylightExit(bd); else bd.remove(); }
    function onKey(e) { if (e.key === "Escape" && overlayRoot.lastElementChild === bd) { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelector("[data-x]").addEventListener("click", close);
    bd.querySelector("[data-cancel]").addEventListener("click", close);
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    name.addEventListener("input", function () { go.disabled = !name.value.trim(); banner.hidden = true; });
    name.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go.click(); } });
    go.addEventListener("click", async function () {
      if (go.disabled) return;
      var friendly = name.value.trim();
      go.disabled = true; go.textContent = "Waiting for your device…"; banner.hidden = true;
      try {
        var res = await client().auth.registerPasskey();
        if (res && res.error) throw res.error;
        var created = res && res.data;
        var id = created && (created.id || (created.passkey && created.passkey.id));
        if (id && friendly && typeof client().auth.passkey.update === "function") { try { await client().auth.passkey.update({ passkeyId: id, friendlyName: friendly }); } catch (e) { /* the passkey exists; the name is cosmetic */ } }
        bd.querySelector("[data-body]").innerHTML = '<div class="dl-pk-ok"><span class="dl-pk-ok-ic">' + icon("check", 22) + '</span><b>Passkey added</b><span>You can now sign in with “' + esc(friendly) + "”.</span></div>";
        var foot = bd.querySelector("[data-foot]");
        foot.innerHTML = '<button type="button" class="btn-primary" style="margin-left:0" data-done>Done</button>';
        foot.querySelector("[data-done]").addEventListener("click", close); foot.querySelector("[data-done]").focus();
        if (onDone) onDone();
      } catch (e) {
        go.disabled = false; go.textContent = "Create passkey";
        banner.textContent = errText(e, "Passkeys"); banner.hidden = false;
      }
    });
    name.focus(); name.select();
  }

  /* ---------------------------------------------------------------- the Security group */
  function buildSecurity(email) {
    var group = make('<div class="set-group dl-sec-group"><div class="set-group-title">Security</div>' +
      '<div class="dl-sec-row is-main"><span class="dl-sec-tile">' + icon("lock", 18) + '</span><span class="dl-sec-text"><span class="sw-label">Password</span><span class="sw-sub" data-pw-sub>We’ll email you a secure link to set a new password.</span></span><button type="button" class="btn-ghost dl-btn-sm" data-reset-password aria-label="Change password">Change password</button></div>' +
      '<div class="dl-sec-sep"></div>' +
      '<div class="dl-sec-row is-main"><span class="dl-sec-tile">' + icon("key", 18) + '</span><span class="dl-sec-text"><span class="sw-label">Passkeys<span class="dl-new-badge">New</span></span><span class="sw-sub" data-pk-sub>Sign in with your fingerprint, face or screen lock. No password to remember.</span></span><button type="button" class="btn-ghost dl-btn-sm" data-add-passkey>Add a passkey</button></div>' +
      '<div class="dl-sec-list" data-pk-list></div>' +
      '<div class="dl-profile-status" data-security-status role="status" aria-live="polite"></div></div>');
    var status = group.querySelector("[data-security-status]");
    function say(msg, bad) { status.textContent = msg || ""; status.classList.toggle("is-error", !!bad); }
    group.querySelector("[data-reset-password]").addEventListener("click", async function () {
      var c = client(), button = this;
      if (!c || !email) { say("Sign in with an email address to change your password.", true); return; }
      button.disabled = true;
      var result = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      button.disabled = false;
      say(result.error ? "Couldn’t send the link: " + result.error.message : "Check " + email + " for a link to set a new password.", !!result.error);
    });

    var list = group.querySelector("[data-pk-list]"), addBtn = group.querySelector("[data-add-passkey]"), sub = group.querySelector("[data-pk-sub]");
    var supported = passkeysApi();
    if (!supported) { addBtn.disabled = true; sub.textContent = window.PublicKeyCredential ? "Passkeys aren’t available for this account yet." : "This browser doesn’t support passkeys."; }
    addBtn.addEventListener("click", function () { openPasskeyDialog(refresh); });

    function row(pk) {
      var r = make('<div class="dl-sec-row" data-pk><span class="dl-sec-tile">' + icon("key", 17) + '</span><span class="dl-sec-text"><span class="sw-label" data-name></span><span class="sw-sub" data-meta></span></span><span class="dl-sec-actions"><button type="button" class="btn-ghost dl-btn-sm" data-rename>Rename</button><button type="button" class="btn-danger-outline" data-remove>Remove</button></span></div>');
      var nm = pk.friendly_name || pk.friendlyName || "Passkey";
      r.querySelector("[data-name]").textContent = nm;
      var added = dateText(pk.created_at || pk.createdAt), used = dateText(pk.last_used_at || pk.lastUsedAt);
      r.querySelector("[data-meta]").textContent = "Added " + (added || "recently") + " · " + (used ? "Last used " + used : "Never used");
      var pid = pk.id;
      r.querySelector("[data-rename]").addEventListener("click", function () {
        var text = r.querySelector(".dl-sec-text"), actions = r.querySelector(".dl-sec-actions");
        var box = make('<span class="dl-sec-rename"><input class="text-input" maxlength="60" aria-label="Passkey name"><button type="button" class="btn-primary dl-btn-sm" style="margin:0;height:32px">Save</button><button type="button" class="btn-ghost dl-btn-sm">Cancel</button></span>');
        var input = box.querySelector("input"); input.value = nm;
        text.hidden = true; actions.hidden = true; r.appendChild(box); input.focus(); input.select();
        function back() { box.remove(); text.hidden = false; actions.hidden = false; }
        box.querySelector(".btn-ghost").addEventListener("click", back);
        async function save() {
          var v = input.value.trim(); if (!v) return;
          if (v === nm) { back(); return; }
          try { var res = await client().auth.passkey.update({ passkeyId: pid, friendlyName: v }); if (res && res.error) throw res.error; say("Passkey renamed."); refresh(); }
          catch (e) { say(errText(e, "Passkeys"), true); back(); }
        }
        box.querySelector(".btn-primary").addEventListener("click", save);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { e.stopPropagation(); back(); } });
      });
      var rm = r.querySelector("[data-remove]");
      rm.addEventListener("click", async function () {
        if (!rm.dataset.sure) {
          rm.dataset.sure = "1"; rm.textContent = "Confirm remove";
          setTimeout(function () { if (rm.isConnected) { delete rm.dataset.sure; rm.textContent = "Remove"; } }, 4000);
          return;
        }
        rm.disabled = true;
        try { var res = await client().auth.passkey.delete({ passkeyId: pid }); if (res && res.error) throw res.error; say("Passkey removed."); refresh(); }
        catch (e) { rm.disabled = false; delete rm.dataset.sure; rm.textContent = "Remove"; say(errText(e, "Passkeys"), true); }
      });
      return r;
    }
    var passkeyCount = 0;
    async function refresh() {
      if (!supported) return;
      try {
        var res = await client().auth.passkey.list();
        if (res && res.error) throw res.error;
        var items = (res && res.data) || [];
        if (items && !Array.isArray(items)) items = items.passkeys || [];
        passkeyCount = items.length;
        list.innerHTML = "";
        items.forEach(function (pk) { list.appendChild(row(pk)); });
        sub.textContent = items.length ? items.length + (items.length === 1 ? " passkey" : " passkeys") + " on this account." : "Sign in with your fingerprint, face or screen lock. No password to remember.";
        group.dispatchEvent(new CustomEvent("dl:passkeys", { bubbles: true, detail: { count: items.length } }));
      } catch (e) {
        sub.textContent = /not enabled|disabled/i.test(String(e && e.message)) ? "Passkeys aren’t turned on for this project yet." : "Couldn’t load your passkeys right now.";
        addBtn.disabled = /not enabled|disabled/i.test(String(e && e.message));
      }
    }
    group._count = function () { return passkeyCount; };
    refresh();
    return group;
  }

  /* ---------------------------------------------------------------- Sign-in methods */
  var PROVIDERS = [{ id: "google", label: "Google", glyph: function () { return typeof googleGlyph === "function" ? googleGlyph() : icon("user", 18); } }, { id: "apple", label: "Apple", glyph: function () { return typeof appleGlyph === "function" ? appleGlyph() : icon("user", 18); } }];
  function buildMethods(securityGroup, email) {
    var group = make('<div class="set-group dl-sec-group"><div class="set-group-title">Sign-in methods</div><p class="dl-sec-hint">The ways you can get into this account. You can’t disconnect your last one.</p><div class="dl-sec-list" data-methods></div><div class="dl-profile-status" data-method-status role="status" aria-live="polite"></div></div>');
    var host = group.querySelector("[data-methods]"), status = group.querySelector("[data-method-status]");
    function say(msg, bad) { status.textContent = msg || ""; status.classList.toggle("is-error", !!bad); }
    var identities = null, passkeys = 0;
    securityGroup.addEventListener("dl:passkeys", function (e) { passkeys = e.detail.count; draw(); });
    function emailMethodRow(hasPassword) {
      var r = make('<div class="dl-sec-row"><span class="dl-sec-tile">' + icon("mail", 17) + '</span><span class="dl-sec-text"><span class="sw-label">Email and password</span><span class="sw-sub"></span></span></div>');
      r.querySelector(".sw-sub").textContent = hasPassword ? email : "Not set up. Use Change password above to add one.";
      return r;
    }
    function providerRow(p, identity, total) {
      var r = make('<div class="dl-sec-row"><span class="dl-sec-tile" data-glyph></span><span class="dl-sec-text"><span class="sw-label"></span><span class="sw-sub"></span></span><span class="dl-sec-actions"></span></div>');
      r.querySelector("[data-glyph]").innerHTML = p.glyph();
      r.querySelector(".sw-label").textContent = p.label;
      var sub = r.querySelector(".sw-sub"), actions = r.querySelector(".dl-sec-actions");
      if (identity) {
        var idEmail = identity.identity_data && identity.identity_data.email;
        sub.textContent = "Connected" + (idEmail ? " · " + idEmail : "");
        var last = total <= 1 && passkeys === 0;      /* the only way in */
        var onlyIdentity = total <= 1;                 /* Supabase refuses to unlink the last identity */
        if (onlyIdentity) {
          var note = make('<span class="dl-sec-note"></span>'); note.textContent = "This is your only sign-in method. Add another one to disconnect it."; actions.appendChild(note);
        } else {
          var b = make('<button type="button" class="btn-danger-outline">Disconnect</button>');
          b.addEventListener("click", async function () {
            if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirm disconnect"; setTimeout(function () { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Disconnect"; } }, 4000); return; }
            b.disabled = true;
            try { var res = await client().auth.unlinkIdentity(identity); if (res && res.error) throw res.error; say(p.label + " disconnected."); load(); }
            catch (e) { b.disabled = false; delete b.dataset.sure; b.textContent = "Disconnect"; say(errText(e, "Disconnecting"), true); }
          });
          actions.appendChild(b);
        }
      } else {
        sub.textContent = "Not connected";
        var c = make('<button type="button" class="btn-ghost dl-btn-sm">Connect</button>');
        c.addEventListener("click", async function () {
          c.disabled = true;
          try {
            var res = await client().auth.linkIdentity({ provider: p.id, options: { redirectTo: location.origin + location.pathname } });
            if (res && res.error) throw res.error;
          } catch (e) { c.disabled = false; say(errText(e, p.label + " sign-in"), true); }
        });
        actions.appendChild(c);
      }
      return r;
    }
    function draw() {
      if (!identities) return;
      host.innerHTML = "";
      var hasPassword = identities.some(function (i) { return i.provider === "email"; });
      host.appendChild(emailMethodRow(hasPassword));
      PROVIDERS.forEach(function (p) {
        var id = identities.filter(function (i) { return i.provider === p.id; })[0];
        host.appendChild(providerRow(p, id, identities.length));
      });
      var pk = make('<div class="dl-sec-row"><span class="dl-sec-tile">' + icon("key", 17) + '</span><span class="dl-sec-text"><span class="sw-label">Passkeys</span><span class="sw-sub"></span></span></div>');
      pk.querySelector(".sw-sub").textContent = passkeys ? passkeys + (passkeys === 1 ? " passkey added" : " passkeys added") : "None added";
      host.appendChild(pk);
    }
    async function load() {
      var c = client();
      try {
        if (!c || typeof c.auth.getUserIdentities !== "function") throw new Error("unavailable");
        var res = await c.auth.getUserIdentities();
        if (res && res.error) throw res.error;
        identities = (res && res.data && res.data.identities) || [];
        draw();
      } catch (e) { host.innerHTML = ""; say("Couldn’t load your sign-in methods right now.", true); }
    }
    load();
    return group;
  }

  window.daylightProfilePane = function (pane) {
    baseProfile.apply(this, arguments);
    try {
      var user = window.daylightCloud && window.daylightCloud.user;
      var email = (user && user.email) || window.__dlIdentityEmail || "";
      var groups = [].slice.call(pane.querySelectorAll(".set-group"));
      var old = groups.filter(function (g) { var t = g.querySelector(".set-group-title"); return t && /^security$/i.test(t.textContent.trim()); })[0];
      if (!old) return;
      var security = buildSecurity(email);
      old.replaceWith(security);
      security.after(buildMethods(security, email));
    } catch (e) { /* the original Security group stays */ }
  };
})();
