/* Settings -> Danger Zone (the last section): delete your account. Calls the delete-account Edge Function, which deletes only the caller's own
   account after they type their e-mail address, and refuses owner accounts. When it succeeds the page leaves the app. */
(function () {
  "use strict";
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var css = document.createElement("style");
  css.textContent = [
    ".dl-danger{border-color:color-mix(in srgb,var(--danger) 40%,var(--line-soft))!important;background:color-mix(in srgb,var(--danger) 4%,var(--surface2))!important;padding:22px 24px!important}",
    ".dl-danger .set-group-title{display:flex;align-items:center;gap:9px;color:var(--danger);margin-bottom:16px}",
    ".dl-danger .set-group-title i{width:6px;height:6px;border-radius:50%;background:var(--danger);display:inline-block}",
    ".dl-danger-row{display:flex;align-items:center;gap:22px;justify-content:space-between}",
    ".dl-danger-row>span{min-width:0}",
    ".dl-danger-ico{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent);border:1px solid color-mix(in srgb,var(--danger) 28%,transparent)}",
    ".dl-danger-row .sw-label,.dl-danger-row .sw-sub{display:block}.dl-danger-row .sw-label{font-size:15px;font-weight:650;letter-spacing:-.01em}.dl-danger-row .sw-sub{margin-top:4px;font-size:13px;line-height:1.55;color:var(--muted);max-width:430px}",
    ".dl-danger-row .btn-danger{flex:none;margin:0;height:40px;padding:0 20px;border-radius:999px;font-size:14px;font-weight:600}",
    /* confirmation dialog */
    ".dl-del-body p{margin:0 0 12px;font-size:14px;line-height:1.55;color:var(--muted)}",
    ".dl-del-body ul{margin:0 0 4px;padding:0;list-style:none;display:grid;gap:8px}",
    ".dl-del-body li{display:flex;align-items:center;gap:10px;font-size:14px;line-height:1.4;color:var(--text)}",
    ".dl-del-body li i{flex:none;width:6px;height:6px;border-radius:50%;background:var(--danger)}",
    ".dl-del-confirm{margin-top:16px!important}",
    ".dl-del-confirm label{display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin-bottom:8px}",
    ".dl-del-confirm b{display:inline-block;margin-left:4px;color:var(--text);letter-spacing:0;text-transform:none;font-size:12.5px;font-weight:600}",
    ".dl-del-in{width:100%;box-sizing:border-box;border:1px solid var(--line-soft);background:var(--surface2);border-radius:14px;padding:12px 14px;font:inherit;font-size:14.5px;color:var(--text);outline:none;transition:border-color 140ms var(--ease-out),box-shadow 140ms var(--ease-out)}",
    ".dl-del-in::placeholder{color:var(--faint)}",
    ".dl-del-in:focus{border-color:var(--danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--danger) 16%,transparent)}",
    ".dl-del-err{min-height:18px;margin-top:8px;font-size:12.5px;line-height:1.4;color:var(--danger)}",
    ".dl-del-dlg .dialog-foot{gap:10px}",
    ".dl-del-dlg .dialog-foot button{height:40px;padding:0 20px;font-size:14px;margin:0}",
    /* the disabled delete button reads as disabled, with enough contrast (not a pale pink) */
    ".dl-del-dlg .btn-danger:disabled{background:var(--surface);color:var(--muted);border:1px solid var(--line);opacity:1;cursor:not-allowed;box-shadow:none}",
    ".dl-del-dlg .btn-danger:not(:disabled){transition:background 140ms var(--ease-out),transform 140ms var(--ease-out)}.dl-del-dlg .btn-danger:not(:disabled):active{transform:scale(.98)}",
    ".dl-del-done{display:flex;flex-direction:column;align-items:center;text-align:center;padding:12px 0 6px}",
    ".dl-del-done .dl-danger-ico{margin-bottom:14px;color:var(--text);background:var(--surface);border-color:var(--line-soft)}",
    "@media(max-width:640px){.dl-danger-row{flex-wrap:wrap}.dl-danger-row .btn-danger{margin-left:66px!important}}"
  ].join(String.fromCharCode(10));
  document.head.appendChild(css);

  function openDelete() {
    var c = window.daylightCloud, email = (c && c.user && c.user.email) || "";
    var bd = make('<div class="backdrop"><div class="dialog dl-std dl-look dl-del-dlg" role="dialog" aria-modal="true" aria-label="Delete account">' +
      '<div class="dialog-head"><span class="dialog-title">Delete your account?</span><button type="button" class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
      '<div class="dialog-body dl-del-body"><p>This permanently deletes your Daylight account and everything in it. It can’t be undone.</p>' +
      "<ul><li><i></i>Your calendars, events, tasks and settings</li><li><i></i>Everything you shared, and your AI access connections</li><li><i></i>Your support tickets and uploaded files</li></ul>" +
      '<div class="dl-del-confirm"><label for="dlDelIn">To confirm, type your e-mail address <b>' + esc(email) + '</b></label>' +
      '<input type="text" id="dlDelIn" class="dl-del-in" data-in autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your email address"><div class="dl-del-err" data-err role="alert"></div></div></div>' +
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
        bd.querySelector(".dialog").innerHTML = '<div class="dialog-body dl-del-body"><div class="dl-del-done"><span class="dl-danger-ico">' + icon("check", 22) + '</span><div class="dialog-title" style="margin-bottom:6px">Your account was deleted</div><p style="margin:0">Everything was removed. Taking you back to the start page…</p></div></div>';
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
    var g = make('<div class="set-group dl-danger"><div class="set-group-title"><i></i>Delete account</div>' +
      '<div class="dl-danger-row"><span class="dl-danger-ico" aria-hidden="true">' + icon("alert", 20) + '</span><span style="flex:1"><span class="sw-label">Delete your account</span><span class="sw-sub">Permanently deletes your account, calendars, events, tasks, settings, sharing, AI access and support tickets.</span></span>' +
      '<button type="button" class="btn-danger" data-del>Delete account</button></div></div>');
    g.querySelector("[data-del]").addEventListener("click", openDelete);
    pane.appendChild(g);
  };
})();
