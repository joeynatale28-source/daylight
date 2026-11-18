/* Your data (Privacy Policy, Section 7).
   - Settings -> Your data: the cookie choice, "Export my data", "Delete my data", and the status of the person's own requests.
   - Admin -> Data requests: the owner reviews every request. Approving runs the `data-request` Edge Function, which builds the
     export (JSON + ICS) and e-mails a 7-day link, or deletes the account's data and e-mails a confirmation.
   Nothing is fulfilled without the Admin review step; the database and the function both re-check who is asking. */
(function () {
  "use strict";
  function cloud() { return window.daylightCloud; }
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  async function rpc(name, args) {
    var c = cloud();
    if (!c || !c.client || !c.user) throw new Error("Sign in to Daylight first.");
    if (c.ensureSession) await c.ensureSession();
    var r = await c.client.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }
  function msgOf(e, fallback) {
    var m = String((e && e.message) || "").replace(/^error:\s*/i, "");
    return /already have an open|no longer be canceled|not open|Only the owner|Sign in/i.test(m) ? m : fallback;
  }
  function day(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function ask(opts) { if (typeof openConfirm === "function") openConfirm(opts); else if (window.confirm(opts.title + "\n\n" + opts.body)) opts.fn(); }

  var css = document.createElement("style");
  css.textContent = [
    ".dl-dr-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--line-soft)}",
    ".dl-dr-row:first-child{border-top:0}",
    ".dl-dr-text{flex:1;min-width:0}",
    ".dl-dr-title{font-size:14px;font-weight:600;line-height:1.35;color:var(--text)}",
    ".dl-dr-sub{margin-top:2px;font-size:12.5px;line-height:1.5;color:var(--muted);overflow-wrap:anywhere}",
    ".dl-dr-sub.is-bad{color:var(--danger)}",
    ".dl-dr-actions{display:flex;gap:8px;flex:none;flex-wrap:wrap;justify-content:flex-end}",
    ".dl-dr-actions button{height:34px;padding:0 16px;font-size:13px;margin:0}",
    ".dl-dr-pill{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;border:1px solid var(--line-soft);background:var(--surface2);font-size:11.5px;font-weight:600;color:var(--muted);vertical-align:1px}",
    ".dl-dr-pill.is-sent{color:var(--text);border-color:var(--text)}",
    ".dl-dr-note{font-size:12.5px;color:var(--muted);line-height:1.55;margin:0 0 4px}",
    ".dl-dr-seg{display:inline-flex;gap:8px}",
    ".dl-dr-seg button[aria-pressed=true]{background:var(--text);color:var(--bg);border-color:var(--text)}",
    "@media(max-width:640px){.dl-dr-row{flex-wrap:wrap}.dl-dr-actions{width:100%;justify-content:flex-start}}"
  ].join("\n");
  document.head.appendChild(css);

  var KIND = { export: "Data export", delete: "Data deletion" };
  function statusText(r) {
    switch (r.status) {
      case "pending": return "Pending";
      case "in_review": return "In review";
      case "approved": return r.kind === "export" ? "Approved — the e-mail is on its way" : "Approved";
      case "sent": return "Sent" + (r.link_expires_at ? " — the link expires " + day(r.link_expires_at) : "");
      case "completed": return "Completed";
      case "rejected": return "Declined";
      case "canceled": return "Canceled";
      default: return r.status;
    }
  }

  /* ---------------------------------------------------------------- Settings -> Your data */
  window.daylightDataPane = function (pane) {
    paneHead(pane, "Your data", "Your cookie choice, and a copy or deletion of the data Daylight holds about you.");

    /* cookies */
    var ck = make('<div class="set-group"><div class="set-group-title">Cookies</div><div class="dl-dr-row"><div class="dl-dr-text"><div class="dl-dr-title">Cookie choice</div><div class="dl-dr-sub" data-ck-sub></div></div><div class="dl-dr-actions dl-dr-seg"><button type="button" class="btn-ghost" data-deny aria-pressed="false">Deny</button><button type="button" class="btn-ghost" data-accept aria-pressed="false">Accept</button></div></div></div>');
    var C = window.daylightConsent;
    function paintCk() {
      var v = C ? C.get() : null;
      ck.querySelector("[data-ck-sub]").textContent = "Strictly necessary cookies (your sign-in session and security) are always on. Optional cookies: " + (v === "accepted" ? "accepted." : v === "denied" ? "denied." : "not chosen yet.");
      ck.querySelector("[data-accept]").setAttribute("aria-pressed", String(v === "accepted"));
      ck.querySelector("[data-deny]").setAttribute("aria-pressed", String(v === "denied"));
    }
    ck.querySelector("[data-accept]").addEventListener("click", function () { if (C) C.set("accepted"); paintCk(); });
    ck.querySelector("[data-deny]").addEventListener("click", function () { if (C) C.set("denied"); paintCk(); });
    paintCk();
    pane.appendChild(ck);

    /* data requests */
    var grp = make('<div class="set-group"><div class="set-group-title">Your data</div>' +
      '<p class="dl-dr-note">Ask for a copy of your data, or for it to be deleted. Every request is reviewed first. Exports arrive as a secure link by e-mail that expires after 7 days.</p>' +
      '<div class="dl-dr-row"><div class="dl-dr-text"><div class="dl-dr-title">Export my data</div><div class="dl-dr-sub">Your account, calendars, events, tasks, settings, sharing permissions and AI access grants as JSON files, plus an ICS file for each calendar.</div></div><div class="dl-dr-actions"><button type="button" class="btn-ghost" data-export>Export my data</button></div></div>' +
      '<div class="dl-dr-row"><div class="dl-dr-text"><div class="dl-dr-title">Delete my data</div><div class="dl-dr-sub">Deletes your account and everything in it: calendars, events, tasks and settings.</div></div><div class="dl-dr-actions"><button type="button" class="btn-danger-outline" data-delete>Delete my data</button></div></div>' +
      '<div class="dl-profile-status" data-status role="status" aria-live="polite"></div></div>');
    var list = make('<div class="set-group"><div class="set-group-title">Your requests</div><div data-list><div class="dl-ad-list-empty" style="font-size:13px;color:var(--muted)">Loading…</div></div></div>');
    pane.appendChild(grp); pane.appendChild(list);
    var status = grp.querySelector("[data-status]"), host = list.querySelector("[data-list]");
    function say(m, bad) { status.textContent = m || ""; status.classList.toggle("is-error", !!bad); }

    async function load() {
      var rows;
      try { rows = (await rpc("data_request_mine")) || []; } catch (e) { host.innerHTML = '<div style="font-size:13px;color:var(--muted)">Couldn’t load your requests.</div>'; return; }
      host.innerHTML = "";
      if (!rows.length) { host.innerHTML = '<div style="font-size:13px;color:var(--muted)">You haven’t made any requests.</div>'; return; }
      rows.forEach(function (r) {
        var open = r.status === "pending" || r.status === "in_review";
        var row = make('<div class="dl-dr-row"><div class="dl-dr-text"><div class="dl-dr-title"></div><div class="dl-dr-sub"></div></div><div class="dl-dr-actions"></div></div>');
        row.querySelector(".dl-dr-title").innerHTML = esc(KIND[r.kind] || r.kind) + '<span class="dl-dr-pill' + (r.status === "sent" || r.status === "completed" ? " is-sent" : "") + '">' + esc(statusText(r).split(" — ")[0]) + "</span>";
        row.querySelector(".dl-dr-sub").textContent = "Requested " + day(r.created_at) + (statusText(r).indexOf(" — ") > 0 ? " · " + statusText(r).split(" — ")[1] : "");
        if (open) {
          var b = make('<button type="button" class="btn-ghost">Cancel request</button>');
          b.addEventListener("click", async function () {
            b.disabled = true;
            try { await rpc("data_request_cancel", { p_id: r.id }); say("Your request was canceled."); } catch (e) { say(msgOf(e, "Couldn’t cancel that request."), true); }
            load();
          });
          row.querySelector(".dl-dr-actions").appendChild(b);
        }
        host.appendChild(row);
      });
    }
    async function submit(kind) {
      say("");
      try { await rpc("data_request_create", { p_kind: kind }); say(kind === "export" ? "Your export request was sent. You’ll get an e-mail with a download link once it’s approved." : "Your deletion request was sent for review. You’ll get an e-mail once it’s done."); }
      catch (e) { say(msgOf(e, "Couldn’t send that request. Please try again."), true); }
      load();
    }
    grp.querySelector("[data-export]").addEventListener("click", function () {
      ask({ title: "Request a copy of your data?", body: "We’ll review the request, then e-mail you a secure download link that expires after 7 days.", confirmLabel: "Send request", fn: function () { submit("export"); } });
    });
    grp.querySelector("[data-delete]").addEventListener("click", function () {
      ask({ title: "Delete all your data?", body: "This asks for your account and everything in it — calendars, events, tasks and settings — to be deleted. It’s reviewed first, and once it’s approved it can’t be undone. You can cancel until then.", confirmLabel: "Request deletion", danger: true, fn: function () { submit("delete"); } });
    });
    load();
  };

  /* ---------------------------------------------------------------- Admin -> Data requests */
  async function callFn(body) {
    var c = cloud();
    if (!c || !c.client || !c.user) throw new Error("Sign in to Daylight first.");
    var session = c.ensureSession ? await c.ensureSession() : null;
    var headers = session && session.access_token ? { Authorization: "Bearer " + session.access_token } : undefined;
    var res = await c.client.functions.invoke("data-request", headers ? { body: body, headers: headers } : { body: body });
    if (res.error) {
      var msg = res.error.message || "Request failed";
      try { if (res.error.context && res.error.context.json) { var j = await res.error.context.json(); msg = j.error || msg; } } catch (e) {}
      throw new Error(msg);
    }
    return res.data;
  }
  window.daylightDataAdminPanel = function () {
    var wrap = make('<div class="set-group"><div class="set-group-title">Data requests</div><p class="dl-ad-lead">Requests from people in Settings → Your data. Nothing is sent or deleted until you approve it here. Approving an export builds the files and e-mails a link that expires after 7 days; approving a deletion permanently deletes that account’s data.</p><div class="dl-profile-status" data-status role="status" aria-live="polite"></div><div data-list><div class="dl-ad-list-empty">Loading…</div></div></div>');
    var host = wrap.querySelector("[data-list]"), status = wrap.querySelector("[data-status]");
    function say(m, bad) { status.textContent = m || ""; status.classList.toggle("is-error", !!bad); }
    var purged = false;
    async function load() {
      var rows;
      try { rows = (await rpc("data_admin_list")) || []; } catch (e) { host.innerHTML = '<div class="dl-ad-list-empty">Couldn’t load the requests.</div>'; return; }
      host.innerHTML = "";
      if (!rows.length) { host.innerHTML = '<div class="dl-ad-list-empty">No data requests yet.</div>'; return; }
      rows.forEach(function (r) {
        var open = r.status === "pending" || r.status === "in_review";
        var resend = r.status === "approved" && r.kind === "export";
        var row = make('<div class="dl-dr-row"><div class="dl-dr-text"><div class="dl-dr-title"></div><div class="dl-dr-sub" data-meta></div><div class="dl-dr-sub is-bad" data-err hidden></div></div><div class="dl-dr-actions"></div></div>');
        row.querySelector(".dl-dr-title").innerHTML = esc(r.email) + '<span class="dl-dr-pill' + (r.status === "sent" || r.status === "completed" ? " is-sent" : "") + '">' + esc(statusText(r).split(" — ")[0]) + "</span>";
        row.querySelector("[data-meta]").textContent = (KIND[r.kind] || r.kind) + " · requested " + day(r.created_at) + (r.link_expires_at && r.status === "sent" ? " · link expires " + day(r.link_expires_at) : "");
        if (r.email_error) { var er = row.querySelector("[data-err]"); er.hidden = false; er.textContent = "E-mail: " + r.email_error; }
        var acts = row.querySelector(".dl-dr-actions");
        function btn(label, cls, fn) { var b = make('<button type="button" class="' + cls + ' dl-btn-sm">' + esc(label) + "</button>"); b.addEventListener("click", fn); acts.appendChild(b); return b; }
        function approve() {
          var isDel = r.kind === "delete";
          ask({
            title: isDel ? "Approve deletion for " + r.email + "?" : (resend ? "Send a new link to " + r.email + "?" : "Approve the export for " + r.email + "?"),
            body: isDel ? "This permanently deletes their account, calendars, events, tasks and settings. It cannot be undone." : "This builds their full export (JSON and ICS files) and e-mails a download link that expires after 7 days.",
            confirmLabel: isDel ? "Delete their data" : (resend ? "Send link" : "Approve and send"), danger: isDel,
            fn: async function () {
              say("Working…");
              try {
                var res = await callFn({ action: "approve", id: r.id });
                say(res && res.emailed === false ? "Done, but the e-mail was not sent: " + (res.email_error || "unknown") : (isDel ? "Their data was deleted and they were notified." : "The export was built and the link was e-mailed."), res && res.emailed === false);
              } catch (e) { say(msgOf(e, "That didn’t work: " + (e && e.message || "try again.")) , true); }
              load();
            }
          });
        }
        if (r.status === "pending") btn("Start review", "btn-ghost", async function () { try { await rpc("data_admin_set_status", { p_id: r.id, p_status: "in_review", p_note: "" }); } catch (e) { say(msgOf(e, "Couldn’t update that request."), true); } load(); });
        if (open) {
          btn(r.kind === "delete" ? "Approve deletion" : "Approve export", r.kind === "delete" ? "btn-danger-outline" : "btn-primary", approve);
          btn("Decline", "btn-ghost", function () { ask({ title: "Decline this request?", body: "It is closed without anything being sent or deleted.", confirmLabel: "Decline", fn: async function () { try { await rpc("data_admin_set_status", { p_id: r.id, p_status: "rejected", p_note: "" }); } catch (e) { say(msgOf(e, "Couldn’t update that request."), true); } load(); } }); });
        } else if (resend) btn("Send e-mail again", "btn-primary", approve);
        host.appendChild(row);
      });
    }
    load();
    if (!purged) { purged = true; callFn({ action: "purge" }).catch(function () {}); }   /* old export files are removed after their links have expired */
    return wrap;
  };

  /* ---------------------------------------------------------------- deep link: /dashboard/?settings=yourdata (from the Privacy Policy) */
  var wantDeep = false;
  try { wantDeep = new URLSearchParams(location.search).get("settings") === "yourdata"; } catch (e) {}
  if (wantDeep) {
    var tries = 0, t = setInterval(function () {
      tries++;
      var c = cloud();
      if (c && c.ready && c.user && typeof openSettings === "function" && document.querySelector(".month-grid, #viewWrap > *")) {
        clearInterval(t);
        try {
          var q = new URLSearchParams(location.search); q.delete("settings");
          history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash);
          openSettings("yourdata");
        } catch (e) {}
      } else if (tries > 80) clearInterval(t);
    }, 250);
  }
})();
