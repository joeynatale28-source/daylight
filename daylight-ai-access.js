/* Settings -> AI access: one row per AI (Claude, ChatGPT), each with its logo and its live connection status for THIS account, then
   Recent AI activity (which AI did what) in the same pane.
   Truth sources (nothing is cached or assumed):
     auth.oauth.listGrants()   the OAuth consents Supabase holds for this account (client id + the name the client registered with)
     mcp_grants                Daylight's per-client permission row (read / write / delete), checked on every tool call by the MCP function
     mcp_workspace_audit       what each client did (tool + a readable result)
   A registration matches an AI by the client name recorded at registration; one that matches neither shows as "Other connection".
   More AIs can be added later by adding one entry to AIS. Disconnect revokes the consent and marks the grant revoked: access ends at once. */
(function () {
  "use strict";
  var MCP_URL = window.DAYLIGHT_MCP_URL || "https://usihrcucnreecynewgbd.supabase.co/functions/v1/mcp";
  var AIS = [
    { id: "claude", name: "Claude", re: /claude|anthropic/i, logo: "./assets/Claude_AI_symbol.svg", pad: "19%", tile: "plain",
      steps: ["Open Claude and go to Settings → Connectors.", "Choose Add custom connector.", "Paste the address above.", "Choose “Register automatically”.", "Leave Client ID and Client Secret blank.", "Approve access in Daylight."] },
    /* ChatGPT: the owner-uploaded mark (assets/ChatGPT-Logo.svg.webp, black on transparent) shown WHITE on its black rounded-square tile. */
    { id: "chatgpt", name: "ChatGPT", re: /chatgpt|openai/i, logo: "./assets/ChatGPT-Logo.svg.webp", invert: true, pad: "19%", tile: "plain",
      steps: ["In ChatGPT, create a new plugin or connector.", "Paste the address above.", "Leave Client ID and Client Secret blank.", "Approve access in Daylight."] },
    /* Google Gemini registers itself as "Google" (or "Gemini …"); the owner-uploaded gradient spark is used as-is on the standard tile. */
    { id: "gemini", name: "Google Gemini", re: /gemini|google/i, logo: "./assets/Google_Gemini_icon_2025.svg.webp", pad: "19%", initial: "G", tile: "plain",
      steps: ["Open Gemini CLI.", "Add Daylight as an MCP server, using the address above.", "Leave the client ID and client secret blank if it asks.", "Approve access on the Daylight consent screen."] }
  ];

  var css = document.createElement("style");
  css.textContent = [
    /* ONE shared tile for every AI: same size, shape and background; the background follows the app theme (dark enough in both themes for ChatGPT's white knot, light enough in Dark to separate from the card) */
    ":root{--dl-ai-tile-bg:#26272B}[data-theme=\"dark\"]{--dl-ai-tile-bg:#3A3C42}",
    ".dl-ai-tile{width:36px;height:36px;border-radius:10px;flex:none;display:grid;place-items:center;overflow:hidden;background:var(--dl-ai-tile-bg)}",
    ".dl-ai-tile img{width:100%;height:100%;object-fit:cover;display:block}",
    ".dl-ai-tile.is-dark{background:#17191b;border:1px solid var(--line-soft)}.dl-ai-tile.is-dark img{width:122%;height:122%;max-width:none;object-fit:contain;flex:none}",
    ".dl-ai-tile.is-other{color:var(--muted);font-weight:650;font-size:14px;background:var(--hover)}",
    "[data-theme=\"dark\"] .dl-ai-tile{outline:1px solid rgba(255,255,255,.2);outline-offset:-1px}",
    ".dl-ai-tile.is-sm{width:28px;height:28px;border-radius:8px}.dl-ai-tile.is-sm.is-dark img{width:122%;height:122%}",
    ".dl-ai-name{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ".dl-ai-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 9px 2px 8px;border-radius:999px;background:var(--hover);color:var(--muted);font-size:11.5px;font-weight:600;line-height:16px}",
    ".dl-ai-badge::before{content:\"\";width:6px;height:6px;border-radius:50%;background:var(--faint)}",
    ".dl-ai-badge.is-on{color:#238b59}.dl-ai-badge.is-on::before{background:#238b59}",
    ".dl-ai-act{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line-soft)}",
    ".dl-ai-act:first-of-type{border-top:0}",
    ".dl-ai-act-text{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}",
    ".dl-ai-act-what{font-size:13.5px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dl-ai-act-meta{font-size:12px;color:var(--muted)}",
    ".dl-ai-empty{font-size:13.5px;color:var(--faint);padding:4px 0 2px}",
    /* the connect panel */
    ".dl-ai-url{display:flex;gap:8px;align-items:center}.dl-ai-url .text-area{flex:1;min-width:0;min-height:0!important;height:56px;resize:none;font:500 12.5px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;padding:9px 12px;word-break:break-all}",
    ".dl-ai-steps{margin:18px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;counter-reset:s}",
    ".dl-ai-steps li{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.5;color:var(--muted);counter-increment:s}",
    ".dl-ai-steps li::before{content:counter(s);flex:none;width:24px;height:24px;border-radius:50%;background:var(--hover);display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--text)}"
  ].join("\n");
  document.head.appendChild(css);

  function cloud() { return window.daylightCloud; }
  function db() { return cloud() && cloud().client; }
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function when(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function ago(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) return "";
    var m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 2) return "just now"; if (m < 60) return m + " minutes ago";
    var h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function level(g) { return g.can_delete ? "Read, write and delete" : g.can_write ? "Read and write" : "Read only"; }
  function tile(ai, small) {
    var t = make('<span class="dl-ai-tile' + (ai && ai.tile === "dark" ? " is-dark" : "") + (small ? " is-sm" : "") + '" aria-hidden="true"></span>');
    if (ai) {
      var img = document.createElement("img"); img.alt = ""; img.src = ai.logo;
      if (ai.pad) { var inner = 100 - 2 * parseFloat(ai.pad); img.style.width = img.style.height = inner + "%"; img.style.maxWidth = "none"; img.style.objectFit = "contain"; }
      if (ai.invert) img.style.filter = "invert(1)";
      img.addEventListener("error", function () { img.remove(); t.removeAttribute("style"); t.classList.add("is-other"); t.textContent = ai.initial || ai.name.charAt(0); });
      t.appendChild(img);
    }
    else { t.classList.add("is-other"); t.textContent = "?"; }
    return t;
  }
  function copy(text, ok) {
    return navigator.clipboard.writeText(text).then(function () { toast(ok || "Copied"); }, function () { toast("Couldn’t copy. Select the address and copy it."); });
  }
  function aiFor(name) { return AIS.filter(function (a) { return a.re.test(name || ""); })[0] || null; }

  /* what a tool call did, in plain words (the audit stores a readable "Event: Title" result) */
  function describe(row) {
    var t = String(row.tool || ""), res = String(row.result || "");
    var m = /^(Event|Calendar|Task):\s*(.+)$/i.exec(res), title = m ? m[2].replace(/\s*·.*$/, "").trim() : "";
    var safe = title && !/(?:[0-9a-f]{8}-){3}[0-9a-f-]+|^\d+$/i.test(title) ? " “" + title + "”" : "";
    if (/^create_event/.test(t)) return "Created the event" + safe;
    if (/^update_event/.test(t)) return "Edited the event" + safe;
    if (/^delete_event/.test(t)) return "Deleted an event" + safe;
    if (/^add_attachment/.test(t)) return "Added an attachment to the event" + safe;
    if (/^remove_attachment/.test(t)) return "Removed an attachment from the event" + safe;
    if (/^list_attachments/.test(t)) return "Viewed an event’s attachments" + safe;
    if (/^create_calendar/.test(t)) return "Created a calendar" + safe;
    if (/^create_task/.test(t)) return "Created a task" + safe;
    if (/^complete_task/.test(t)) return "Completed a task" + safe;
    if (/^(list|get|search)_/.test(t)) return "Viewed your calendar";
    return "Used calendar access";
  }

  /* "for Mon, Nov 16": the date of the event an action concerned, so same-titled events can be told apart */
  function eventDateOf(row) {
    try {
      if (!/event|attachment/i.test(String(row.tool || "")) || row.target_id == null || !window.state || !state.events) return "";
      var ev = state.events.filter(function (e) { return String(e.id) === String(row.target_id); })[0];
      if (!ev) return "";
      return " · for " + new Date(ev.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }

  function openConnect(ai) {
    var bd = el('<div class="backdrop"><div class="dialog dl-std dl-look" role="dialog" aria-modal="true" aria-label="Connect ' + esc(ai.name) + '">' +
      '<div class="dialog-head"><span class="dialog-title">Connect ' + esc(ai.name) + '</span><button type="button" class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
      '<div class="dialog-body"><div class="field dl-std-field"><label for="aiUrl">Daylight server address</label><div class="dl-ai-url"><textarea class="text-area" id="aiUrl" readonly rows="2" spellcheck="false"></textarea><button type="button" class="btn-ghost" data-copy>Copy</button></div></div>' +
      '<ol class="dl-ai-steps"></ol></div>' +
      '<div class="dialog-foot"><button type="button" class="btn-primary" style="margin-left:0" data-done>Done</button></div></div></div>');
    overlayRoot.appendChild(bd);
    bd.querySelector("#aiUrl").value = MCP_URL;
    var ol = bd.querySelector(".dl-ai-steps");
    ai.steps.forEach(function (s) { var li = document.createElement("li"); li.textContent = s; ol.appendChild(li); });
    function close() { document.removeEventListener("keydown", onKey, true); if (window.daylightExit) window.daylightExit(bd); else bd.remove(); }
    function onKey(e) { if (e.key === "Escape" && overlayRoot.lastElementChild === bd) { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelector("[data-x]").addEventListener("click", close);
    bd.querySelector("[data-done]").addEventListener("click", close);
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    bd.querySelector("[data-copy]").addEventListener("click", function () { copy(MCP_URL, "Copied the Daylight address"); });
    bd.querySelector("[data-copy]").focus();
  }

  window.daylightAiPane = function (pane) {
    paneHead(pane, "AI access", "Let an AI assistant work with your calendar. You choose what it can do, and you can disconnect it any time.");
    var group = make('<div class="set-group dl-sec-group"><div class="set-group-title">Assistants</div><div class="dl-sec-list" data-list><div class="dl-ai-empty">Loading…</div></div><div class="dl-profile-status" data-status role="status" aria-live="polite"></div></div>');
    var act = make('<div class="set-group"><div class="set-group-title">Recent AI activity</div><div data-act><div class="dl-ai-empty">Loading…</div></div></div>');
    pane.appendChild(group); pane.appendChild(act);
    var list = group.querySelector("[data-list]"), status = group.querySelector("[data-status]"), actHost = act.querySelector("[data-act]");
    function say(msg, bad) { status.textContent = msg || ""; status.classList.toggle("is-error", !!bad); }
    var uid = cloud() && cloud().user && cloud().user.id, client = db();
    if (!client || !uid) { list.innerHTML = '<div class="dl-ai-empty">Sign in to manage AI access.</div>'; actHost.innerHTML = ""; return; }

    function row(ai, label, conns, newest, lastAt) {
      var on = conns.length > 0;
      var r = make('<div class="dl-sec-row"><span class="dl-sec-text"><span class="sw-label dl-ai-name"><span data-name></span><span class="dl-ai-badge' + (on ? " is-on" : "") + '">' + (on ? "Connected" : "Not connected") + '</span></span><span class="sw-sub" data-sub></span></span><span class="dl-sec-actions"></span></div>');
      r.insertBefore(tile(ai), r.firstChild);
      r.querySelector("[data-name]").textContent = label;
      var sub = r.querySelector("[data-sub]"), actions = r.querySelector(".dl-sec-actions");
      if (on) {
        sub.textContent = "Connected " + new Date(newest.granted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " · " + level(newest) + (lastAt ? " · Last activity " + ago(lastAt) : " · No activity yet");
        var b = make('<button type="button" class="btn-danger-outline">Disconnect</button>');
        b.addEventListener("click", function () {
          openConfirm({ title: "Disconnect " + label + "?", body: label + " will immediately lose access to your calendar.", confirmLabel: "Disconnect", danger: true, fn: async function () {
            try {
              for (var i = 0; i < conns.length; i++) {
                var rev = await client.auth.oauth.revokeGrant({ clientId: conns[i].client_id }); if (rev.error) throw rev.error;
                var up = await client.from("mcp_grants").update({ revoked_at: new Date().toISOString() }).eq("user_id", uid).eq("client_id", conns[i].client_id); if (up.error) throw up.error;
              }
              say(label + " was disconnected."); load();
            } catch (e) { say("Couldn’t disconnect " + label + ". Please try again.", true); }
          } });
        });
        actions.appendChild(b);
      } else {
        /* never contradicts the activity log: a past connection that was disconnected says so, with when it was last used */
        sub.textContent = lastAt ? "Not connected · Disconnected · Last activity " + ago(lastAt) : "Not connected";
        var c = make('<button type="button" class="btn-ghost dl-btn-sm">Connect</button>');
        c.addEventListener("click", function () { openConnect(ai); });
        actions.appendChild(c);
      }
      return r;
    }

    async function load() {
      var res;
      try {
        if (!client.auth.oauth || !client.auth.oauth.listGrants) throw new Error("unavailable");
        res = await Promise.all([
          client.auth.oauth.listGrants(),
          client.from("mcp_grants").select("client_id,client_name,can_read,can_write,can_delete,granted_at,revoked_at").eq("user_id", uid),
          client.from("mcp_workspace_audit").select("tool,result,created_at,client_id,target_id").eq("user_id", uid).order("created_at", { ascending: false }).limit(60)
        ]);
        if (res[0].error) throw res[0].error; if (res[1].error) throw res[1].error;
      } catch (e) {
        list.innerHTML = '<div class="dl-ai-empty">Couldn’t load your AI connections right now.</div>'; actHost.innerHTML = ""; return;
      }
      var oauth = Array.isArray(res[0].data) ? res[0].data : ((res[0].data && res[0].data.grants) || []);
      var names = {}; oauth.forEach(function (a) { var id = a.client_id || (a.client && a.client.id); names[id] = (a.client && a.client.name) || a.client_name || ""; });
      var allGrants = res[1].data || [], nameOf = {};
      allGrants.forEach(function (g) { nameOf[g.client_id] = g.client_name || names[g.client_id] || ""; });
      /* connected = a live Supabase consent AND a non-revoked Daylight permission row */
      var live = allGrants.filter(function (g) { return !g.revoked_at && Object.prototype.hasOwnProperty.call(names, g.client_id); })
        .map(function (g) { return Object.assign({}, g, { _name: names[g.client_id] || g.client_name || "" }); })
        .sort(function (a, b) { return new Date(b.granted_at || 0) - new Date(a.granted_at || 0); });
      var audit = res[2].error ? [] : (res[2].data || []);
      function lastFor(conns) { var ids = conns.map(function (c) { return c.client_id; }); var a = audit.filter(function (x) { return ids.indexOf(x.client_id) !== -1; })[0]; return a && a.created_at; }
      list.innerHTML = "";
      var used = {};
      AIS.forEach(function (ai) {
        var conns = live.filter(function (g) { return ai.re.test(g._name + " " + (g.client_name || "")); });
        conns.forEach(function (g) { used[g.client_id] = true; });
        var past = allGrants.filter(function (g) { return ai.re.test((names[g.client_id] || "") + " " + (g.client_name || "")); });
        list.appendChild(row(ai, ai.name, conns, conns[0], conns.length ? lastFor(conns) : lastFor(past)));
      });
      live.filter(function (g) { return !used[g.client_id]; }).forEach(function (g) {
        list.appendChild(row(null, "Other connection" + (g._name ? " · " + g._name : ""), [g], g, lastFor([g])));
      });
      /* activity, newest first, each row naming the AI that did it */
      actHost.innerHTML = "";
      var shown = audit.slice(0, 8);
      if (!shown.length) { actHost.innerHTML = '<div class="dl-ai-empty">No AI activity yet.</div>'; return; }
      shown.forEach(function (a) {
        var nm = nameOf[a.client_id] || names[a.client_id] || "", ai = aiFor(nm);
        var r = make('<div class="dl-ai-act"><span class="dl-ai-act-text"><span class="dl-ai-act-what"></span><span class="dl-ai-act-meta"></span></span></div>');
        r.insertBefore(tile(ai, true), r.firstChild);
        r.querySelector(".dl-ai-act-what").textContent = describe(a);
        r.querySelector(".dl-ai-act-meta").textContent = (ai ? ai.name : (nm || "An AI connection")) + eventDateOf(a) + " · " + when(a.created_at);
        actHost.appendChild(r);
      });
    }
    load();
  };
})();
