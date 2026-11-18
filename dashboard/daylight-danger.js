/* Settings -> Danger Zone (the last section): delete your account. Calls the delete-account Edge Function, which deletes only the caller's own
   account after they type their e-mail address, and refuses owner accounts. When it succeeds the page leaves the app. */
(function () {
  "use strict";
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var css = document.createElement("style");
  css.textContent = [
    ".dl-danger{border-color:color-mix(in srgb,var(--danger) 45%,var(--line-soft))!important}",
    ".dl-danger .set-group-title{color:var(--danger)}",
    ".dl-danger-row{display:flex;align-items:center;gap:18px;justify-content:space-between}",
    ".dl-danger-row>span{min-width:0}",
    ".dl-danger-row .sw-label,.dl-danger-row .sw-sub{display:block}.dl-danger-row .sw-sub{margin-top:3px;font-size:12.5px;line-height:1.5;color:var(--muted)}",
    ".dl-danger-row .btn-danger{flex:none;margin:0}",
    ".dl-del-in{width:100%;box-sizing:border-box;border:1px solid var(--line-soft);background:var(--surface2);border-radius:14px;padding:12px 14px;font:inherit;font-size:14.5px;color:var(--text);outline:none;margin-top:12px}",
    ".dl-del-in:focus{border-color:var(--danger)}",
    ".dl-del-err{min-height:18px;margin-top:8px;font-size:12.5px;color:var(--danger)}",
    ".dl-del-body p{margin:0 0 10px;font-size:14px;line-height:1.55;color:var(--muted)}",
    ".dl-del-body ul{margin:0 0 6px;padding-left:18px;font-size:14px;line-height:1.6;color:var(--muted)}",
    "@media(max-width:640px){.dl-danger-row{flex-wrap:wrap}}"
  ].join("\n");
  document.head.appendChild(css);

  function openDelete() {
    var c = window.daylightCloud, email = (c && c.user && c.user.email) || "";
    var bd = make('<div class="backdrop"><div class="dialog dl-std dl-look" role="dialog" aria-modal="true" aria-label="Delete account">' +
      '<div class="dialog-head"><span class="dialog-title">Delete your account?</span><button type="button" class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
      '<div class="dialog-body dl-del-body"><p>This permanently deletes your Daylight account and everything in it. It can’t be undone.</p>' +
      "<ul><li>Your calendars, events, tasks and settings</li><li>Everything you shared, and your AI access connections</li><li>Your support tickets and uploaded files</li></ul>" +
      '<p style="margin-top:12px">To confirm, type your e-mail address: <b style="color:var(--text)">' + esc(email) + '</b></p>' +
      '<input type="text" class="dl-del-in" data-in autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(email) + '" aria-label="Type your e-mail address to confirm"><div class="dl-del-err" data-err role="alert"></div></div>' +
      '<div class="dialog-foot"><button type="button" class="btn-ghost" data-cancel>Cancel</button><button type="button" class="btn-danger" style="margin-left:0" data-ok disabled>Delete my account</button></div></div></div>');
    var root = (typeof overlayRoot !== "undefined" && overlayRoot) || document.body;
    root.appendChild(bd);
    var input = bd.querySelector("[data-in]"), ok = bd.querySelector("[data-ok]"), err = bd.querySelector("[data-err]");
    function close() { document.removeEventListener("keydown", onKey, true); if (window.daylightExit) window.daylightExit(bd); else bd.remove(); }
    function onKey(e) { if (e.key === "Escape" && !ok.dataset.busy) { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelector("[data-x]").addEventListener("click", function () { if (!ok.dataset.busy) close(); });
    bd.querySelector("[data-cancel]").addEventListener("click", function () { if (!ok.dataset.busy) close(); });
    function match() { return !!email && input.value.trim().toLowerCase() === email.toLowerCase(); }
    input.addEventListener("input", function () { ok.disabled = !match(); err.textContent = ""; });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && match()) ok.click(); });
    ok.addEventListener("click", async function () {
      if (!match() || ok.dataset.busy) return;
      ok.dataset.busy = "1"; ok.disabled = true; ok.textContent = "Deleting…"; err.textContent = "";
      try {
        var session = c.ensureSession ? await c.ensureSession() : null;
        var res = await c.client.functions.invoke("delete-account", { body: { confirm: input.value.trim() }, headers: session && session.access_token ? { Authorization: "Bearer " + session.access_token } : undefined });
        if (res.error) { var m = res.error.message; try { var j = await res.error.context.json(); m = j.error || m; } catch (e) {} throw new Error(m); }
        bd.querySelector(".dialog").innerHTML = '<div class="dialog-head"><span class="dialog-title">Your account was deleted</span></div><div class="dialog-body dl-del-body"><p>Everything was removed. Taking you back to the start page…</p></div>';
        try { await c.client.auth.signOut({ scope: "local" }); } catch (e) {}
        try { Object.keys(localStorage).filter(function (k) { return /^sb-.*-auth-token/.test(k) || /^daylight/i.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
        setTimeout(function () { location.replace((window.daylightRoute && window.daylightRoute.siteRoot) || "../"); }, 1400);
      } catch (e) {
        delete ok.dataset.busy; ok.disabled = false; ok.textContent = "Delete my account";
        var m2 = String((e && e.message) || ""); err.textContent = m2 && m2.length < 200 ? m2 : "Couldn’t delete the account. Please try again.";
      }
    });
    setTimeout(function () { input.focus(); }, 60);
  }

  window.daylightDangerPane = function (pane) {
    paneHead(pane, "Danger Zone", "Actions here can’t be undone.");
    var g = make('<div class="set-group dl-danger"><div class="set-group-title">Delete account</div>' +
      '<div class="dl-danger-row"><span><span class="sw-label">Delete your account</span><span class="sw-sub">Permanently deletes your account, calendars, events, tasks, settings, sharing, AI access and support tickets.</span></span>' +
      '<button type="button" class="btn-danger" data-del>Delete account</button></div></div>');
    g.querySelector("[data-del]").addEventListener("click", openDelete);
    pane.appendChild(g);
  };
})();
