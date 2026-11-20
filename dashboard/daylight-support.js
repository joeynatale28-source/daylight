/* Support Center: tickets, chat, and data requests, built into the app (no help articles).
   - Sidebar -> Support Center swaps the calendar for this page, like Tasks and Admin do.
   - People see only their own tickets. Owners (Admin) also get an "Open tickets" list with every ticket, can reply, close, and "Give data".
   - Messages are read/written through database functions (support_*); photos go to the private support-files bucket.
   - A reply notifies the other side only when they are NOT actively viewing that ticket (the chat reports "viewing" while it is open and visible). */
(function () {
  "use strict";
  function cloud() { return window.daylightCloud; }
  function make(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function isOwner() { return !!(window.daylightAdmin && window.daylightAdmin.isOwner && window.daylightAdmin.isOwner()); }
  async function rpc(name, args) {
    var c = cloud();
    if (!c || !c.client || !c.user) throw new Error("Sign in to Daylight first.");
    if (c.ensureSession) await c.ensureSession();
    var r = await c.client.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }
  function errText(e, fb) { var m = String((e && e.message) || "").replace(/^error:\s*/i, ""); return m && m.length < 160 ? m : fb; }
  var IC = {
    back: '<path d="m15 18-6-6 6-6"/>', users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.4 3.4 0 0 1 0 6.4"/><path d="M18 14.2A6.5 6.5 0 0 1 21.5 20"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L8 19"/>', chev: '<path d="m9 6 6 6-6 6"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>', dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    buoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/>', chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>'
  };
  function ico(n, s) { return '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + "</svg>"; }

  var css = document.createElement("style");
  css.textContent = [
    ".dl-sup{flex:1;min-height:0;overflow-y:auto;padding:28px 36px 44px;animation:viewFade 200ms var(--ease-out)}",
    ".dl-sup.is-chat{display:flex;flex-direction:column;overflow:hidden;padding-bottom:20px}",
    ".dl-sup-inner{max-width:860px;margin:0 auto;width:100%}",
    ".dl-sup.is-chat .dl-sup-inner{flex:1;min-height:0;display:flex;flex-direction:column}",
    ".dl-sup-head{display:flex;align-items:flex-start;gap:16px;margin:8px 0 26px}",
    ".dl-sup-hello{font-size:30px;font-weight:650;letter-spacing:-.03em;line-height:1.15;margin:0}",
    ".dl-sup-sub{margin:8px 0 0;font-size:16px;color:var(--muted)}",
    ".dl-sup-head>div:first-child{flex:1;min-width:0}",
    ".dl-sup-admbtns{display:flex;flex-direction:column;align-items:stretch;gap:8px;flex:none}.dl-sup-admbtns .dl-sup-open{justify-content:flex-start;min-width:212px}.dl-sup-admbtns .dl-sup-open>svg:last-child{margin-left:auto;margin-right:4px}.dl-sup-admbtns .dl-sup-open>b{margin-left:2px}.dl-um-btn>svg:first-child{flex:none}.dl-um-host{padding-bottom:8px}.dl-um-host .dl-sup-back{margin-top:0}",
    ".dl-um-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 22px}",
    ".dl-um-stat{border:1px solid var(--line-soft);background:var(--surface2);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:3px}.dl-um-stat b{font-size:26px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.1}.dl-um-stat span{font-size:12.5px;color:var(--muted)}",
    ".dl-um-stat[data-k=suspended] b{color:#b7791f}.dl-um-stat[data-k=banned] b{color:var(--danger)}",
    ".dl-um-row{display:grid;grid-template-columns:40px minmax(0,1fr) 112px 150px 16px;align-items:center;column-gap:14px;padding:14px 18px}",
    ".dl-um-row .dl-sup-av{width:40px;height:40px;margin:0}.dl-um-row .dl-sup-rt{min-width:0}.dl-um-row .dl-sup-who,.dl-um-row .dl-sup-pv{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dl-um-row .dl-sup-pv{margin-top:2px}",
    ".dl-um-row .dl-um-side{display:contents}.dl-um-row .dl-um-st{justify-self:center;margin:0;min-width:88px;box-sizing:border-box;text-align:center}.dl-um-row .dl-sup-who{font-size:14.5px;font-weight:600;color:var(--text)}.dl-um-row .dl-sup-pv{font-size:13px;color:var(--muted)}",
    ".dl-um-dates{display:flex;flex-direction:column;align-items:flex-end;gap:2px;text-align:right}.dl-um-dates .dl-sup-date{font-size:12.5px;color:var(--muted)}.dl-um-la{font-size:11.5px;color:var(--faint)}.dl-um-row>svg{justify-self:end;color:var(--faint)}",
    ".dl-um-st.active{color:#1e8e5a;border-color:color-mix(in srgb,#1e8e5a 40%,transparent)}.dl-um-st.suspended{color:#b7791f;border-color:color-mix(in srgb,#b7791f 45%,transparent)}.dl-um-st.banned{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,transparent)}",
    ".dl-um-pg{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 2px 4px;font-size:13px;color:var(--muted)}.dl-um-pg div{display:flex;gap:8px}.dl-um-pg button:disabled{opacity:.45;cursor:default}",
    ".dl-um-head{display:flex;align-items:center;gap:18px;margin:6px 0 22px}.dl-um-avbig{width:64px;height:64px;font-size:22px;flex:none}.dl-um-id{min-width:0}.dl-um-id .dl-sup-hello{font-size:26px;overflow-wrap:anywhere}.dl-um-id .dl-sup-sub{margin-top:4px;font-size:15px;overflow-wrap:anywhere}",
    ".dl-um-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:10px;font-size:13px;color:var(--muted)}",
    ".dl-um-restr{margin:0 0 18px;padding:12px 16px;border-radius:14px;border:1px solid color-mix(in srgb,var(--danger) 35%,transparent);background:color-mix(in srgb,var(--danger) 8%,transparent);font-size:13.5px;line-height:1.5;overflow-wrap:anywhere}",
    ".dl-um-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}",
    ".dl-um-card{border:1px solid var(--line-soft);background:var(--surface);border-radius:18px;padding:18px 20px}.dl-um-card h2{margin:0 0 12px;font-size:11.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}",
    ".dl-um-kv>div{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-top:1px solid var(--line-soft);font-size:13.5px}.dl-um-kv>div:first-child{border-top:0;padding-top:0}.dl-um-kv span{color:var(--muted);flex:none}.dl-um-kv b{font-weight:550;text-align:right;overflow-wrap:anywhere}",
    ".dl-um-chips{display:flex;flex-wrap:wrap;gap:7px}.dl-um-chip{padding:5px 12px;border-radius:999px;background:var(--surface2);border:1px solid var(--line-soft);font-size:13px;overflow-wrap:anywhere}.dl-um-none{font-size:13.5px;color:var(--faint)}.dl-um-note{margin:12px 0 0;font-size:12px;color:var(--faint)}",
    ".dl-um-actions{display:flex;flex-wrap:wrap;gap:8px}.dl-um-actions button{flex:1 1 120px;width:auto}",
    "@media (max-width:860px){.dl-um-grid{grid-template-columns:1fr}.dl-um-stats{grid-template-columns:repeat(2,1fr)}.dl-sup-admbtns{width:100%}.dl-um-row{grid-template-columns:40px minmax(0,1fr);row-gap:8px;padding:14px 16px}.dl-um-row .dl-um-st{grid-column:2;grid-row:2;justify-self:start}.dl-um-dates{grid-column:2;grid-row:3;flex-direction:row;flex-wrap:wrap;align-items:center;gap:2px 12px;text-align:left}.dl-um-row>svg{display:none}.dl-um-head{align-items:flex-start}}",
    ".dl-sup-open{display:inline-flex;align-items:center;gap:10px;height:42px;padding:0 8px 0 18px;border-radius:999px;border:1px solid var(--line-soft);background:var(--surface2);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;flex:none;transition:background 140ms var(--ease-out),transform 140ms var(--ease-out)}",
    ".dl-sup-open:hover{background:var(--hover);border-color:color-mix(in srgb,var(--text) 28%,transparent)}.dl-sup-open>svg:last-child{color:var(--muted);margin-left:-2px;margin-right:4px}",
    ".dl-sup-open:active{transform:scale(.98)}",
    ".dl-sup-open b{min-width:26px;height:26px;padding:0 8px;border-radius:999px;background:var(--text);color:var(--bg);display:inline-grid;place-items:center;font-size:12.5px;font-weight:650}",
    ".dl-sup-cta{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 34px}",
    ".dl-sup-cta button{height:42px;padding:0 20px;font-size:14px;margin:0;display:inline-flex;align-items:center;gap:8px}",
    ".dl-sup-h2{font-size:12px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 10px}",
    ".dl-sup-card{border:1px solid var(--line-soft);border-radius:18px;background:var(--surface2);overflow:hidden;margin:0 0 26px}",
    ".dl-sup-row{display:flex;align-items:center;gap:14px;width:100%;padding:15px 20px;border:0;background:none;color:var(--text);text-align:left;cursor:pointer;font:inherit;border-top:1px solid var(--line-soft);transition:background 120ms var(--ease-out)}",
    ".dl-sup-row:first-child{border-top:0}.dl-sup-row:hover{background:var(--hover)}",
    ".dl-sup-dot{flex:none;width:9px;height:9px;border-radius:50%;background:transparent}.dl-sup-dot.on{background:var(--accent)}",
    ".dl-sup-rt{flex:1;min-width:0}.dl-sup-rt b{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".dl-sup-rt span{display:block;margin-top:2px;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".dl-sup-row svg{flex:none;color:var(--faint)}",
    ".dl-sup-empty{padding:30px 20px;text-align:center;color:var(--muted);font-size:14px}",
    ".dl-sup-pill{display:inline-block;padding:2px 9px;border-radius:999px;border:1px solid var(--line-soft);font-size:11.5px;font-weight:600;color:var(--muted);vertical-align:1px}",
    ".dl-sup-pill.open{color:var(--text);border-color:var(--text)}",
    ".dl-sup-back{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px 0 10px;border-radius:999px;border:1px solid var(--line-soft);background:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;margin:0 0 18px;align-self:flex-start}",
    ".dl-sup-back:hover{background:var(--hover)}",
    ".dl-sup-tabs{display:inline-flex;background:var(--surface2);border:1px solid var(--line-soft);border-radius:999px;padding:3px;gap:2px;margin:0 0 18px}",
    ".dl-sup-tabs button{padding:7px 18px;border-radius:999px;font-size:13.5px;font-weight:550;color:var(--muted);cursor:pointer;border:0;background:none}",
    ".dl-sup-tabs button[aria-selected=true]{background:var(--selected);color:var(--text)}",
    /* chat */
    ".dl-chat-head{display:flex;align-items:center;gap:14px;padding:0 0 16px;border-bottom:1px solid var(--line-soft);flex:none;flex-wrap:wrap}",
    ".dl-chat-head h1{font-size:19px;font-weight:650;letter-spacing:-.02em;margin:0;line-height:1.3;overflow-wrap:anywhere}",
    ".dl-chat-meta{font-size:12.5px;color:var(--muted);margin-top:3px}",
    ".dl-chat-head>div:first-child{flex:1;min-width:200px}",
    ".dl-chat-actions{display:flex;gap:8px;flex-wrap:wrap}.dl-chat-actions button{height:36px;padding:0 16px;font-size:13px;margin:0}",
    ".dl-msgs{flex:1;min-height:0;overflow-y:auto;padding:22px 2px;display:flex;flex-direction:column;gap:6px}",
    ".dl-msg{display:flex;flex-direction:column;max-width:min(560px,calc(100% - 44px));align-items:flex-start}",
    ".dl-msg.me{align-self:flex-end;align-items:flex-end}",
    ".dl-mrow{display:flex;align-items:flex-end;gap:10px;width:100%}",
    ".dl-mrow.me{flex-direction:row-reverse}",
    ".dl-mrow .dl-msg{align-self:auto;min-width:0}",
    ".dl-mav{flex:none;width:32px;height:32px;border-radius:50%;background:var(--surface);border:1px solid var(--line-soft);display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--muted);overflow:hidden;margin-bottom:22px}",
    ".dl-mav img{width:100%;height:100%;object-fit:cover;display:block}",
    ".dl-mav.sp{visibility:hidden}",
    ".dl-mav.brand{background:var(--text);color:var(--bg);border-color:var(--text)}.dl-mav.brand svg{width:17px;height:17px;display:block}",
    ".dl-msg-from{font-size:12px;font-weight:650;color:var(--muted);margin:10px 0 5px 4px;display:flex;align-items:center}",
    ".dl-msg.me .dl-msg-from{display:none}",
    ".dl-bub{padding:10px 15px;border-radius:18px 18px 18px 6px;background:var(--surface2);border:1px solid var(--line-soft);font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".dl-msg.me .dl-bub{background:var(--text);color:var(--bg);border-color:var(--text);border-radius:18px 18px 6px 18px}",
    ".dl-msg-t{font-size:11px;color:var(--faint);margin:4px 6px 0}",
    ".dl-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:6px;margin-top:8px;width:100%}.dl-pics:first-child{margin-top:0}",
    ".dl-pics button{padding:0;border:0;border-radius:12px;overflow:hidden;cursor:zoom-in;background:var(--surface);aspect-ratio:1;display:block}",
    ".dl-pics img{width:100%;height:100%;object-fit:cover;display:block}",
    ".dl-sys{align-self:center;font-size:12px;color:var(--faint);padding:10px 0;text-align:center}",
    ".dl-file{display:flex;align-items:center;gap:12px;margin-top:8px;padding:11px 13px;border-radius:14px;background:var(--bg);border:1px solid var(--line-soft);color:var(--text);min-width:260px}",
    ".dl-file>span:first-child{width:38px;height:38px;border-radius:11px;background:var(--surface2);display:grid;place-items:center;flex:none;color:var(--muted)}",
    ".dl-file div{flex:1 1 150px;min-width:0;font-size:13.5px;font-weight:600;overflow-wrap:anywhere}.dl-file small{display:block;font-weight:400;color:var(--muted);font-size:12px;margin-top:1px;line-height:1.4}",
    ".dl-file{flex-wrap:wrap}.dl-file button{flex:none}",
    ".dl-file button{height:32px;padding:0 14px;font-size:12.5px;margin:0}",
    ".dl-file.gone{opacity:.65}",
    ".dl-compose{flex:none;border:1px solid var(--line-soft);background:var(--surface2);border-radius:22px;padding:10px 10px 10px 16px;display:flex;flex-direction:column;gap:8px}",
    ".dl-compose textarea{border:0;background:none;resize:none;outline:none;font:inherit;font-size:14.5px;line-height:1.5;color:var(--text);min-height:24px;max-height:160px;padding:4px 0;width:100%}",
    ".dl-compose-row{display:flex;align-items:center;gap:8px}",
    ".dl-compose-row .sp{flex:1}",
    ".dl-ibtn{width:36px;height:36px;border-radius:50%;border:1px solid var(--line-soft);background:none;color:var(--muted);display:grid;place-items:center;cursor:pointer;flex:none}",
    ".dl-ibtn:hover{background:var(--hover);color:var(--text)}",
    ".dl-compose .btn-primary{height:36px;padding:0 18px;font-size:13.5px;margin:0;display:inline-flex;align-items:center;gap:7px}",
    ".dl-thumbs{display:flex;gap:8px;flex-wrap:wrap}",
    ".dl-thumb{position:relative;width:64px;height:64px;border-radius:12px;overflow:hidden;background:var(--surface)}",
    ".dl-thumb img{width:100%;height:100%;object-fit:cover;display:block}",
    ".dl-thumb button{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}",
    ".dl-closed-note{flex:none;text-align:center;font-size:13.5px;color:var(--muted);padding:14px;border:1px dashed var(--line-soft);border-radius:18px}",
    ".dl-sup-err{font-size:12.5px;color:var(--danger);min-height:16px}",
    /* new ticket panel: a side sheet, not a centered window */
    ".dl-sheet-bd{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.28);display:flex;justify-content:flex-end;animation:dlShBd 160ms var(--ease-out)}",
    ".dl-sheet{width:min(440px,100%);height:100%;background:var(--bg);border-left:1px solid var(--line-soft);box-shadow:-18px 0 50px rgba(0,0,0,.16);display:flex;flex-direction:column;animation:dlSh 240ms var(--ease-out)}",
    ".dl-sheet-h{display:flex;align-items:center;padding:22px 24px 8px}.dl-sheet-h h2{font-size:19px;font-weight:650;letter-spacing:-.02em;margin:0;flex:1}",
    ".dl-sheet-p{padding:0 24px 8px;font-size:13.5px;color:var(--muted);line-height:1.5}",
    ".dl-sheet-b{flex:1;overflow-y:auto;padding:14px 24px;display:flex;flex-direction:column;gap:18px}",
    ".dl-sheet-b label{display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 8px}",
    ".dl-sheet-b input[type=text],.dl-sheet-b textarea{width:100%;box-sizing:border-box;border:1px solid var(--line-soft);background:var(--surface2);border-radius:14px;padding:12px 14px;font:inherit;font-size:14.5px;color:var(--text);outline:none}",
    ".dl-sheet-b input[type=text]:focus,.dl-sheet-b textarea:focus{border-color:var(--text)}",
    ".dl-sheet-b textarea{min-height:150px;resize:vertical;line-height:1.5}",
    ".dl-sheet-f{display:flex;gap:10px;justify-content:flex-end;padding:16px 24px 22px;border-top:1px solid var(--line-soft)}",
    ".dl-sheet-f button{height:40px;padding:0 20px;font-size:14px;margin:0}",
    ".dl-addpic{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:999px;border:1px dashed var(--line-soft);background:none;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer}",
    ".dl-addpic:hover{background:var(--hover);color:var(--text)}",
    ".dl-lightbox{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.8);display:grid;place-items:center;padding:24px;cursor:zoom-out}",
    ".dl-lightbox img{max-width:100%;max-height:100%;border-radius:12px}",
    "@keyframes dlSh{from{transform:translateX(28px);opacity:0}to{transform:none;opacity:1}}@keyframes dlShBd{from{opacity:0}to{opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.dl-sheet,.dl-sheet-bd{animation:none}}",
    /* ---- round 2: organized lists, empty state, motion ---- */
    ".dl-sup-row{align-items:center;padding:16px 20px;animation:dlSupIn 260ms var(--ease-out) both;animation-delay:calc(var(--i,0) * 28ms)}",
    ".dl-sup-av{flex:none;width:36px;height:36px;border-radius:50%;background:var(--surface);border:1px solid var(--line-soft);display:grid;place-items:center;font-size:14px;font-weight:650;color:var(--text)}",
    ".dl-sup-who{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:2px}",
    ".dl-sup-who .dl-sup-dot{width:7px;height:7px}",
    ".dl-sup-rt b{font-size:15px}",
    ".dl-sup-rt .dl-sup-pv{margin-top:3px;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".dl-sup-side{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px}",
    ".dl-sup-tag{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--surface);border:1px solid var(--line-soft);font-size:11.5px;font-weight:600;color:var(--muted);white-space:nowrap}",
    ".dl-sup-date{font-size:12px;color:var(--faint);white-space:nowrap}",
    ".dl-sup-pill.closed{margin-right:0}",
    ".dl-sup-h2 span{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:var(--surface2);border:1px solid var(--line-soft);font-size:11px;letter-spacing:0;color:var(--muted)}",
    ".dl-sup-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 22px}",
    ".dl-sup-tabs{margin:0}",
    ".dl-sup-tabs button span{display:inline-block;min-width:20px;margin-left:5px;padding:0 6px;border-radius:999px;background:var(--surface);font-size:11.5px;font-weight:650;line-height:18px;text-align:center;color:var(--muted)}",
    ".dl-sup-tabs button[aria-selected=true] span{background:var(--text);color:var(--bg)}",
    ".dl-sup-search{flex:1 1 220px;min-width:180px;display:flex;align-items:center;gap:9px;height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--line-soft);background:var(--surface2);color:var(--muted);transition:border-color 140ms var(--ease-out)}",
    ".dl-sup-search:focus-within{border-color:var(--text)}",
    ".dl-sup-search input{flex:1;min-width:0;border:0;background:none;outline:none;font:inherit;font-size:14px;color:var(--text)}",
    ".dl-sup-sel{height:40px;padding:0 38px 0 16px;border-radius:999px;border:1px solid var(--line-soft);background:var(--surface2) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 14px center;appearance:none;-webkit-appearance:none;font:inherit;font-size:14px;color:var(--text);cursor:pointer;outline:none;transition:border-color 140ms var(--ease-out)}",
    ".dl-sup-sel:focus{border-color:var(--text)}",
    ".dl-sup-sel-f{width:100%;height:46px;border-radius:14px;box-sizing:border-box}",
    ".dl-sup-sel-f.bad{border-color:var(--danger)}",
    ".dl-selwrap{position:relative}",
    ".dl-sup-fade{animation:dlSupFade 220ms var(--ease-out) both}",
    /* loading placeholders look like the rows they stand for (avatar + two text bars on a bordered card) so a slow load never shows empty white cards */
    ".dl-sup-skel{display:grid;gap:10px;--skel:color-mix(in srgb,var(--text) 11%,var(--surface))}.dl-sup-skel i{display:block;height:68px;border-radius:18px;border:1px solid var(--line);background:radial-gradient(circle at 34px 50%,var(--skel) 0 15px,transparent 16px),linear-gradient(var(--skel),var(--skel)) 66px 21px/34% 11px no-repeat,linear-gradient(var(--skel),var(--skel)) 66px 40px/56% 9px no-repeat,var(--surface);animation:dlSupPulse 1.3s ease-in-out infinite}.dl-sup-skel i:nth-child(2){animation-delay:.18s}@keyframes dlSupPulse{0%,100%{opacity:1}50%{opacity:.55}}",
    ".dl-sup-empty2{display:flex;flex-direction:column;align-items:center;text-align:center;padding:48px 24px 44px;border:1px dashed var(--line-soft);border-radius:24px;background:var(--surface2)}",
    ".dl-sup-emico{width:60px;height:60px;border-radius:50%;background:var(--bg);border:1px solid var(--line-soft);display:grid;place-items:center;color:var(--muted);margin-bottom:18px;box-shadow:0 6px 20px rgba(0,0,0,.05)}",
    ".dl-sup-empty2 h2{font-size:19px;font-weight:650;letter-spacing:-.02em;margin:0 0 8px}",
    ".dl-sup-empty2 p{margin:0;max-width:420px;font-size:14.5px;line-height:1.55;color:var(--muted)}",
    ".dl-sup-emcats{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:22px}",
    ".dl-sup-chip{height:34px;padding:0 15px;border-radius:999px;border:1px solid var(--line-soft);background:var(--bg);color:var(--text);font-size:13px;font-weight:550;cursor:pointer;transition:background 140ms var(--ease-out),transform 140ms var(--ease-out)}",
    ".dl-sup-chip:hover{background:var(--hover)}.dl-sup-chip:active{transform:scale(.97)}",
    ".dl-sup-open,.dl-sup-back,.dl-sup-cta button,.dl-ibtn,.dl-addpic{transition:background 140ms var(--ease-out),transform 140ms var(--ease-out),border-color 140ms var(--ease-out)}",
    ".dl-sup-cta button:active,.dl-sup-back:active{transform:scale(.98)}",
    ".dl-sheet-bd.is-out{animation:dlShOut 200ms var(--ease-out) both}.dl-sheet-bd.is-out .dl-sheet{animation:dlShPanelOut 200ms var(--ease-out) both}",
    "@keyframes dlSupIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    "@keyframes dlSupFade{from{opacity:0}to{opacity:1}}",
    "@keyframes dlSupSh{from{background-position:200% 0}to{background-position:-200% 0}}",
    "@keyframes dlShOut{to{opacity:0}}@keyframes dlShPanelOut{to{transform:translateX(28px);opacity:0}}",
    "@media (prefers-reduced-motion:reduce){.dl-sup-row,.dl-msg,.dl-sup-fade,.dl-sup-skel i{animation:none}}",
    "body.reduce-motion .dl-sup-row,body.reduce-motion .dl-msg,body.reduce-motion .dl-sup-fade,body.reduce-motion .dl-sheet,body.reduce-motion .dl-sheet-bd{animation:none}",
    ".dl-sup-ddf{display:flex;align-items:center;justify-content:space-between;gap:10px;height:40px;padding:0 14px 0 16px;border-radius:999px;border:1px solid var(--line-soft);background:var(--surface2);color:var(--text);font:inherit;font-size:14px;cursor:pointer;text-align:left}",
    ".dl-sup-ddf-bar{min-width:180px}",
    ".dl-sheet .dl-selwrap .dl-sup-ddf.dd{width:100%;height:46px;border-radius:14px;box-sizing:border-box;font-size:14.5px;padding:0 14px}",
    ".dl-sup-ddf.is-empty .dd-val{color:var(--faint)}.dl-sup-ddf.bad{border-color:var(--danger)}",
    "@media (max-width:760px){.dl-sup-row{flex-wrap:wrap;row-gap:8px}.dl-sup-side{flex-direction:row;align-items:center;margin-left:50px;order:3;width:calc(100% - 50px);justify-content:flex-start;gap:10px}.dl-sup-row>svg{display:none}.dl-sup-bar{gap:10px}.dl-sup-sel{flex:1}}",
    /* ---- round 3: chat polish ---- */
    ".dl-compose{padding:8px 10px;gap:6px;border-radius:26px}",
    ".dl-compose-row{align-items:flex-end;gap:8px}",
    ".dl-compose textarea{flex:1;min-width:0;width:auto;padding:8px 4px;line-height:22px;min-height:38px;max-height:176px;overflow-y:hidden;box-sizing:border-box}",
    ".dl-compose .dl-send{height:38px;padding:0 18px;border-radius:999px;transition:background 160ms var(--ease-out),color 160ms var(--ease-out),opacity 160ms var(--ease-out),transform 120ms var(--ease-out)}",
    ".dl-compose .dl-send:disabled{background:var(--surface);color:var(--faint);border:1px solid var(--line-soft);cursor:not-allowed;opacity:1}",
    ".dl-compose .dl-send.is-ready{background:var(--text);color:var(--bg);border-color:var(--text);cursor:pointer}.dl-compose .dl-send.is-ready:active{transform:scale(.97)}",
    ".dl-compose .dl-ibtn{width:38px;height:38px}",
    ".dl-compose-row .sp{display:none}",
    ".dl-compose .dl-sup-err:empty,.dl-compose .dl-thumbs:empty{display:none}",
    ".dl-mrow{align-items:flex-start}",
    ".dl-mav{margin-bottom:0;margin-top:0}",
    ".dl-mrow.new{animation:dlMsgIn 260ms var(--ease-out) both}.dl-sys.new{animation:dlSupFade 260ms var(--ease-out) both}",
    ".dl-mrow.pending .dl-bub{opacity:.6}.dl-mrow.pending .dl-msg-t{color:var(--muted)}",
    ".dl-daydiv{display:flex;align-items:center;gap:12px;margin:14px 0 4px;color:var(--faint);font-size:11.5px;font-weight:650;letter-spacing:.04em;text-transform:uppercase}",
    ".dl-daydiv::before,.dl-daydiv::after{content:'';flex:1;height:1px;background:var(--line-soft)}",
    ".dl-bub{line-height:1.42}",
    ".dl-dots{display:inline-flex;align-items:center;gap:5px;padding:14px 16px}",
    ".dl-dots i{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:dlDot 1.1s ease-in-out infinite}.dl-dots i:nth-child(2){animation-delay:.15s}.dl-dots i:nth-child(3){animation-delay:.3s}",
    ".dl-typing .dl-msg-t{font-style:italic}",
    ".dl-sup.is-chat .dl-sup-inner{animation:dlSupIn 260ms var(--ease-out) both}",
    "@keyframes dlMsgIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}",
    "@keyframes dlDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}",
    "@media (prefers-reduced-motion:reduce){.dl-mrow.new,.dl-sys.new,.dl-dots i,.dl-sup.is-chat .dl-sup-inner{animation:none}}",
    "body.reduce-motion .dl-mrow.new,body.reduce-motion .dl-dots i{animation:none}",
    ".dl-sup-sum{display:flex;align-items:center;gap:14px;width:100%;padding:16px 20px;margin:0 0 22px;border-radius:20px;border:1px solid var(--line-soft);background:var(--surface2);color:var(--text);cursor:pointer;text-align:left;font:inherit;transition:background 140ms var(--ease-out)}.dl-sup-sum:hover{background:var(--hover)}",
    ".dl-sup-sum .dl-sup-emico{margin:0;width:44px;height:44px}.dl-sup-sumn{font-size:13px;font-weight:600;color:var(--muted)}",
    /* ---- admin sidebar ---- */
    ".dl-sup.has-adm .dl-sup-inner{max-width:1280px}",
    ".dl-sup.adm-hidden .dl-adm{display:none}.dl-sup.adm-hidden.has-adm .dl-sup-inner{max-width:860px}",
    ".dl-split{flex:1;min-height:0;display:flex;gap:28px;align-items:stretch}",
    ".dl-split-l{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}",
    ".dl-adm{flex:none;width:340px;overflow-y:auto;border:1px solid var(--line-soft);border-radius:22px;background:var(--surface2);padding:6px 6px 14px;scrollbar-width:thin;animation:dlSupIn 260ms var(--ease-out) both}",
    ".dl-adm-top{display:flex;align-items:center;gap:9px;padding:14px 16px 10px;font-size:13px;color:var(--muted)}.dl-adm-top b{color:var(--text);font-size:13.5px}.dl-adm-top span:last-child{margin-left:auto;font-size:11.5px;color:var(--faint)}",
    ".dl-adm-badge{width:24px;height:24px;border-radius:8px;background:var(--text);color:var(--bg);display:grid;place-items:center}",
    ".dl-adm-sec{border-top:1px solid var(--line-soft);margin:0 10px}.dl-adm-sec:first-of-type{border-top:0}",
    ".dl-adm-h{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 4px;border:0;background:none;color:var(--text);font:inherit;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}",
    ".dl-adm-h svg{color:var(--faint);transition:transform 180ms var(--ease-out)}.dl-adm-sec.open .dl-adm-h svg{transform:rotate(90deg)}",
    ".dl-adm-b{display:none;padding:0 4px 16px}.dl-adm-sec.open .dl-adm-b{display:block;animation:dlSupFade 200ms var(--ease-out) both}",
    ".dl-adm-kv{display:grid;grid-template-columns:92px minmax(0,1fr);gap:9px 10px;margin:0;font-size:13px}.dl-adm-kv dt{color:var(--muted)}.dl-adm-kv dd{margin:0;color:var(--text);font-weight:550;overflow-wrap:anywhere}",
    ".dl-adm-pill{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid var(--line-soft);font-size:12px;font-weight:650}",
    ".dl-adm-pill.ok{color:#1e8e5a;border-color:color-mix(in srgb,#1e8e5a 40%,transparent);background:color-mix(in srgb,#1e8e5a 10%,transparent)}",
    ".dl-adm-pill.warn{color:#b86e00;border-color:color-mix(in srgb,#d9952a 50%,transparent);background:color-mix(in srgb,#d9952a 12%,transparent)}",
    ".dl-adm-pill.bad{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,transparent);background:color-mix(in srgb,var(--danger) 10%,transparent)}",
    ".dl-adm-pill.open{color:var(--text);border-color:var(--text)}.dl-adm-pill.closed{color:var(--muted)}",
    ".dl-adm-user{display:flex;align-items:center;gap:12px;margin:0 0 14px}.dl-adm-user b{display:block;font-size:14.5px}.dl-adm-user span:not(.dl-adm-av){display:block;font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}",
    ".dl-adm-av{flex:none;width:40px;height:40px;border-radius:50%;background:var(--surface);border:1px solid var(--line-soft);display:grid;place-items:center;font-weight:650}",
    ".dl-adm-restr{margin-top:12px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--danger) 8%,transparent);border:1px solid color-mix(in srgb,var(--danger) 30%,transparent);font-size:12.5px;line-height:1.5;color:var(--text)}",
    ".dl-adm-sub{margin:4px 0 8px;font-size:12px;font-weight:650;color:var(--muted)}.dl-adm-sub:not(:first-child){margin-top:16px}",
    ".dl-adm-empty{font-size:12.5px;color:var(--faint)}",
    ".dl-adm-tk{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;margin:0 0 6px;border-radius:12px;border:1px solid var(--line-soft);background:var(--bg);color:var(--text);text-align:left;cursor:pointer;font:inherit;transition:background 140ms var(--ease-out)}.dl-adm-tk:hover{background:var(--hover)}",
    ".dl-adm-tk .dl-sup-rt b{font-size:13px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.3}.dl-adm-tk .dl-sup-rt span{font-size:11.5px}",
    ".dl-adm-log{padding:9px 0;border-top:1px solid var(--line-soft);font-size:12.5px;line-height:1.45}.dl-adm-log:first-of-type{border-top:0}.dl-adm-log b{display:block;font-size:13px}",
    ".dl-adm-lm,.dl-adm-lw{display:block;color:var(--muted);font-size:11.5px;overflow-wrap:anywhere}.dl-adm-lw{margin-top:1px}.dl-adm-lr{display:block;margin-top:2px;color:var(--text)}",
    ".dl-adm-note{margin:0 0 12px;font-size:12.5px;line-height:1.55;color:var(--muted)}",
    ".dl-adm-wide{width:100%;height:40px;margin:0 0 14px!important}.dl-adm-wide:disabled{background:var(--surface);color:var(--text);opacity:.6;border:1px solid var(--line);cursor:not-allowed}.dl-adm-why{margin:-6px 0 14px;font-size:12.5px;line-height:1.5;color:var(--muted)}.dl-adm-sm{margin-left:8px;font-size:12px;color:var(--muted);font-weight:400}",
    ".dl-adm-actions{display:grid;gap:8px}.dl-adm-actions button{width:100%;height:40px;margin:0;justify-content:center}",
    ".dl-adm-foot{margin:6px 16px 0;font-size:11.5px;line-height:1.5;color:var(--faint)}",
    ".dl-act-who{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:10px 12px;border-radius:14px;border:1px solid var(--line-soft);background:var(--surface2)}.dl-act-who b{display:block;font-size:14px}.dl-act-who span:not(.dl-adm-av){display:block;font-size:12.5px;color:var(--muted)}.dl-act-p{margin:0 0 14px;font-size:14px;line-height:1.55;color:var(--muted)}",
    ".dl-act-f{margin:0 0 14px}.dl-act-f label{display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin-bottom:8px}",
    ".dl-act-f input,.dl-act-f textarea{width:100%;box-sizing:border-box;border:1px solid var(--line-soft);background:var(--surface2);border-radius:14px;padding:11px 14px;font:inherit;font-size:14.5px;color:var(--text);outline:none;resize:vertical}.dl-act-f input:focus,.dl-act-f textarea:focus{border-color:var(--text)}",
    ".dl-act-seg{display:flex;flex-wrap:wrap;gap:8px}.dl-act-seg button{height:36px;padding:0 15px;border-radius:999px;border:1px solid var(--line-soft);background:none;color:var(--muted);font-size:13.5px;font-weight:550;cursor:pointer}.dl-act-seg button[aria-checked=true]{background:var(--text);color:var(--bg);border-color:var(--text)}",
    ".dl-act-hint{margin-top:6px;font-size:12px;color:var(--faint)}",
    ".dl-act .dialog-foot button{height:40px;padding:0 20px;font-size:14px;margin:0}.dl-act .btn-primary:disabled{background:var(--surface);color:var(--muted);border:1px solid var(--line);cursor:not-allowed}.dl-act .btn-danger:disabled{background:#fdeceb;color:#8a1b12;border:1px solid #e9aaa5;cursor:not-allowed;opacity:1}[data-theme=dark] .dl-act .btn-danger:disabled{background:#3b1714;color:#ffb9b1;border-color:#7a3028}",
    "@media (max-width:1100px){.dl-sup.is-chat.has-adm{overflow-y:auto}.dl-split{flex-direction:column;overflow:visible}.dl-split-l{min-height:72vh}.dl-adm{width:auto;margin-top:18px;overflow:visible}}",
    ".dl-restr{display:flex;gap:18px;align-items:flex-start;padding:22px 24px;border-radius:22px;border:1px solid color-mix(in srgb,var(--danger) 35%,var(--line-soft));background:color-mix(in srgb,var(--danger) 5%,var(--surface2));width:100%;box-sizing:border-box}",
    ".dl-restr-ico{flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent);border:1px solid color-mix(in srgb,var(--danger) 28%,transparent)}",
    ".dl-restr .dl-sup-hello{font-size:24px}.dl-restr-r{margin:12px 0 0;padding:10px 14px;border-radius:12px;background:var(--bg);border:1px solid var(--line-soft);font-size:13.5px;line-height:1.5;color:var(--text)}",
    ".dl-appeal{display:flex;align-items:center;gap:18px;width:100%;margin:8px 0 0;padding:20px 24px;border-radius:24px;border:0;background:var(--text);color:var(--bg);cursor:pointer;text-align:left;font:inherit;box-shadow:0 14px 34px rgba(0,0,0,.18);transition:transform 160ms var(--ease-out),box-shadow 160ms var(--ease-out)}",
    ".dl-appeal:hover{transform:translateY(-1px);box-shadow:0 18px 40px rgba(0,0,0,.24)}.dl-appeal:active{transform:scale(.99)}.dl-appeal:focus-visible{outline:3px solid var(--accent);outline-offset:3px}",
    ".dl-appeal-mark{flex:none;width:46px;height:46px;border-radius:50%;background:var(--bg);color:var(--text);display:grid;place-items:center}.dl-appeal-mark svg{width:26px;height:26px;display:block}",
    ".dl-appeal-t{flex:1;min-width:0}.dl-appeal-t b{display:block;font-size:18px;font-weight:700;letter-spacing:-.02em}.dl-appeal-t span{display:block;margin-top:3px;font-size:13.5px;opacity:.78}",
    "[data-lock]{opacity:.38!important;pointer-events:none!important;filter:grayscale(1)}",
    "@media (max-width:760px){.dl-sup{padding:20px 16px 32px}.dl-sup-hello{font-size:25px}.dl-sup-head{flex-wrap:wrap}.dl-msg{max-width:94%}.dl-file{min-width:0;width:100%;box-sizing:border-box}.dl-file button{margin-left:50px}}"
  ].join("\n");
  document.head.appendChild(css);

  /* ------------------------------------------------------------------ restricted accounts (suspended / banned)
     They can sign in, but only reach the Support Center and Settings. my_account_status() decides (and ends a suspension by itself at its end date). */
  function restrictedMsg(r, shortForm) {
    if (!r) return "";
    var until = r.ends_at ? new Date(r.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    return r.status === "banned" ? "Your account is banned" : "Your account is suspended" + (until ? " until " + until : "");
  }
  var ALLOWED_LOCK = "[data-side-support],.profile-wrap,.side-row[title=Settings]";
  function lockSidebar() {
    var sb = document.getElementById("sidebar"); if (!sb) return;
    var on = !!window.daylightRestricted;
    [].slice.call(sb.querySelectorAll("button,.cal-row,.mini,.mini-cal,.side-row,.brand-row,.side-label")).forEach(function (n) {
      var ok = n.matches(ALLOWED_LOCK) || n.closest(".profile-wrap") || n.closest("[data-side-support]");
      if (on && !ok) { n.setAttribute("data-lock", "1"); n.setAttribute("aria-disabled", "true"); n.tabIndex = -1; }
      else if (n.hasAttribute("data-lock")) { n.removeAttribute("data-lock"); n.removeAttribute("aria-disabled"); n.removeAttribute("tabindex"); }
    });
    [].slice.call(document.querySelectorAll("#header .icon-btn, header .icon-btn, .app-header .icon-btn")).forEach(function (n) {
      if (n.closest(".dl-notif-btn") || n.classList.contains("dl-notif-btn") || /Settings/i.test(n.getAttribute("title") || n.getAttribute("aria-label") || "")) return;
      if (on) n.setAttribute("data-lock", "1"); else n.removeAttribute("data-lock");
    });
  }
  async function loadStatus() {
    var c = cloud(); if (!c || !c.client || !c.user) return;
    var r = null;
    try { r = await rpc("my_account_status"); } catch (e) { return; }
    var was = !!window.daylightRestricted, now = r && r.status && r.status !== "active" ? r : null;
    window.daylightRestricted = now;
    document.body.classList.toggle("restricted", !!now);
    if (now && !was) { ST.view = "home"; state.section = "support"; renderAll(true, 1); }
    else if (!now && was) renderAll(false);
    lockSidebar();
    if (window.daylightNotifications && window.daylightNotifications.refresh) window.daylightNotifications.refresh();
  }
  document.addEventListener("daylight:workspace-ready", function () { loadStatus(); });
  document.addEventListener("daylight:workspace-signed-out", function () { window.daylightRestricted = null; document.body.classList.remove("restricted"); });
  setInterval(function () { if (!document.hidden) loadStatus(); }, 60000);
  window.addEventListener("focus", function () { if (cloud() && cloud().user) loadStatus(); });
  /* shortcuts that would open the calendar's tools are off while restricted */
  document.addEventListener("keydown", function (e) {
    if (!window.daylightRestricted) return;
    var t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === "Escape" || e.key === "Tab" || e.key === "Enter" || e.key === " " || /^Arrow|^Page|^Home|^End|^F\d/.test(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === ",") return;
    if (e.key.length === 1 || e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ------------------------------------------------------------------ state */
  var ST = { view: "home", ticketId: null, adminTab: "open", cat: "", from: "home", host: null, timer: null, token: 0 };
  function stopTimer() { clearInterval(ST.timer); ST.timer = null; }
  function firstName() {
    var u = cloud() && cloud().user, m = (u && u.user_metadata) || {};
    var n = String(m.full_name || m.name || "").trim().split(/\s+/)[0];
    return n || "";
  }
  function greeting() {
    var h = new Date().getHours(), part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    var n = firstName();
    return n ? part + ", " + n : part;
  }
  /* cut at a word boundary (never mid-word); the full text stays available on hover */
  function wordCut(str, max) {
    str = String(str || ""); if (str.length <= max) return str;
    var cut = str.slice(0, max + 1), i = cut.lastIndexOf(" ");
    if (i < max * 0.5) i = max;
    return cut.slice(0, i).replace(/[\s,.;:\-–—]+$/, "") + "…";
  }
  function ago(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "Just now"; if (m < 60) return m + " min ago";
    var h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function clock(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function bytes(n) { n = +n || 0; return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB"; }

  /* ------------------------------------------------------------------ page */
  function show(view, extra) {
    stopTimer(); ST.view = view; if (extra) Object.assign(ST, extra);
    if (typeof renderAll === "function" && state.section === "support") renderAll(false); else { state.section = "support"; renderAll(true, 1); }
  }
  function openTicket(id, from) { ST.from = from || "home"; ST.ticketId = id; ST.view = "chat"; state.section = "support"; stopTimer(); renderAll(true, 1); }
  function page() {
    var wrap = make('<div class="dl-sup"><div class="dl-sup-inner"></div></div>');
    var inner = wrap.querySelector(".dl-sup-inner");
    if (ST.view === "chat") { wrap.classList.add("is-chat"); chatView(inner, wrap); }
    else if (ST.view === "admin" && isOwner()) adminView(inner);
    else if (ST.view === "users" && isOwner()) usersView(inner);
    else if (ST.view === "user" && isOwner() && ST.userId) userView(inner);
    else homeView(inner);
    return wrap;
  }

  var CATS = [["feature", "Feature request"], ["bug", "Bug report"], ["account", "Account & sign-in"], ["data", "Data request"], ["other", "Something else"]];
  var ADM_CATS = [["appeal", "Appeal"]].concat(CATS);
  function catLabel(k) { if (k === "appeal") return "Appeal"; for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === k) return CATS[i][1]; return "Something else"; }
  function fullDate(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function initial(t) { var n = String(t.user_name || t.user_email || "?").trim(); return n.charAt(0).toUpperCase() || "?"; }

  function ticketRow(t, admin, from, i) {
    var who = t.user_name || t.user_email || "";
    var row = make('<button type="button" class="dl-sup-row"></button>');
    row.style.setProperty("--i", Math.min(i || 0, 12));
    if (admin) row.appendChild(make('<span class="dl-sup-av" aria-hidden="true">' + esc(initial(t)) + "</span>"));
    else row.appendChild(make('<span class="dl-sup-dot' + (t.unread && t.status !== "closed" ? " on" : "") + '" aria-hidden="true"></span>'));
    var text = make('<span class="dl-sup-rt"></span>');
    if (admin) { var w = make('<span class="dl-sup-who"></span>'); w.textContent = who; if (t.unread && t.status !== "closed") w.appendChild(make('<i class="dl-sup-dot on" aria-label="New reply"></i>')); text.appendChild(w); }
    var b = make("<b></b>"); b.textContent = t.title; text.appendChild(b);
    if (t.preview) { var pv = make('<span class="dl-sup-pv"></span>'); pv.textContent = t.preview; text.appendChild(pv); }
    row.appendChild(text);
    var side = make('<span class="dl-sup-side">' + (admin ? "" : '<span class="dl-sup-tag"></span>') + '<span class="dl-sup-date"></span></span>');
    if (!admin) side.querySelector(".dl-sup-tag").textContent = catLabel(t.category);
    side.querySelector(".dl-sup-date").textContent = fullDate(admin ? t.created_at : t.last_message_at);
    if (!admin && t.status === "closed") side.insertBefore(make('<span class="dl-sup-pill closed">Closed</span>'), side.firstChild);
    row.appendChild(side);
    row.appendChild(make(ico("chev", 16)));
    if (t.unread && t.status !== "closed" && !admin) row.setAttribute("aria-label", t.title + " (new reply)");
    row.addEventListener("click", function () { openTicket(t.id, from); });
    return row;
  }
  function listCard(rows, admin, from) {
    var card = make('<div class="dl-sup-card"></div>');
    rows.forEach(function (t, i) { card.appendChild(ticketRow(t, admin, from, i)); });
    return card;
  }

  function homeView(inner) {
    var R = window.daylightRestricted;
    var head = make('<div class="dl-sup-head"><div><h1 class="dl-sup-hello"></h1><p class="dl-sup-sub">How can we help you?</p></div></div>');
    if (R) {
      head = make('<div class="dl-sup-head"><div class="dl-restr"><span class="dl-restr-ico">' + ico("lock", 22) + '</span><div><h1 class="dl-sup-hello"></h1><p class="dl-sup-sub"></p><p class="dl-restr-r"></p></div></div></div>');
      head.querySelector("h1").textContent = restrictedMsg(R);
      head.querySelector(".dl-sup-sub").textContent = "You can still use the Support Center and Settings. The rest of Daylight is unavailable while this is in place.";
      head.querySelector(".dl-restr-r").textContent = R.reason ? "Reason given: " + R.reason : "";
      if (!R.reason) head.querySelector(".dl-restr-r").remove();
    } else head.querySelector("h1").textContent = greeting();
    inner.appendChild(head);
    if (isOwner()) {
      var ob = make('<button type="button" class="dl-sup-open">' + ico("inbox", 17) + '<span>Open tickets</span><b>–</b>' + ico("chev", 15) + '</button>');
      ob.addEventListener("click", function () { show("admin", { adminTab: "open" }); });
      head.appendChild(ob);
      rpc("support_admin_list", { p_status: "open" }).then(function (r) { ob.querySelector("b").textContent = String((r || []).length); }).catch(function () { ob.querySelector("b").textContent = "0"; });
    }
    var cta = make('<div class="dl-sup-cta"><button type="button" class="btn-primary" data-new>' + ico("plus", 16) + 'Create new ticket</button><button type="button" class="btn-ghost" data-data>Request your data</button></div>');
    cta.querySelector("[data-new]").addEventListener("click", newTicketSheet);
    cta.querySelector("[data-data]").addEventListener("click", requestData);
    inner.appendChild(cta);
    var host = make('<div class="dl-sup-fade"></div>'); inner.appendChild(host);
    host.appendChild(make('<div class="dl-sup-skel" aria-hidden="true"><i></i><i></i></div>'));
    var adminSum = isOwner() && !R ? Promise.all([rpc("support_admin_list", { p_status: "open" }), rpc("support_admin_list", { p_status: "closed" })]).then(function (r) { return { open: (r[0] || []).length, closed: (r[1] || []).length }; }).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([rpc("support_ticket_list"), adminSum]).then(function (pair) {
      var rows = pair[0] || [], sum = pair[1];
      host.innerHTML = "";
      if (sum && (sum.open || sum.closed)) {
        var sc = make('<button type="button" class="dl-sup-sum"><span class="dl-sup-emico">' + ico("inbox", 20) + '</span><span class="dl-sup-rt"><b>All tickets</b><span></span></span><span class="dl-sup-sumn"></span>' + ico("chev", 16) + "</button>");
        sc.querySelector(".dl-sup-rt span").textContent = sum.open + " open · " + sum.closed + " closed";
        sc.querySelector(".dl-sup-sumn").textContent = "View tickets";
        sc.addEventListener("click", function () { show("admin", { adminTab: sum.open ? "open" : "closed" }); });
        host.appendChild(sc);
      }
      var open = rows.filter(function (t) { return t.status === "open"; }), closed = rows.filter(function (t) { return t.status === "closed"; });
      if (!rows.length && sum && (sum.open || sum.closed)) return;
      if (!rows.length) {
        var em = make('<div class="dl-sup-empty2"><span class="dl-sup-emico">' + ico("chat", 26) + '</span><h2>No tickets yet</h2><p>Questions, bugs, ideas, or a copy of your data — start a ticket and we’ll reply right here.</p><div class="dl-sup-emcats"></div></div>');
        CATS.forEach(function (c) { var b = make('<button type="button" class="dl-sup-chip"></button>'); b.textContent = c[1]; b.addEventListener("click", function () { newTicketSheet(c[0]); }); em.querySelector(".dl-sup-emcats").appendChild(b); });
        host.appendChild(em);
        if (R) addAppeal(host, R);
        return;
      }
      host.appendChild(make('<div class="dl-sup-h2">Open</div>'));
      if (open.length) host.appendChild(listCard(open, false, "home")); else host.appendChild(make('<div class="dl-sup-card"><div class="dl-sup-empty">You have no open tickets.</div></div>'));
      if (closed.length) { host.appendChild(make('<div class="dl-sup-h2">Closed</div>')); host.appendChild(listCard(closed, false, "home")); }
      if (R) addAppeal(host, R);
    }).catch(function () { host.innerHTML = '<div class="dl-sup-card"><div class="dl-sup-empty">Couldn’t load your tickets.</div></div>'; });
  }

  /* the big, branded appeal button under everything (restricted accounts only) */
  function addAppeal(host, R) {
    var banned = R.status === "banned";
    var b = make('<button type="button" class="dl-appeal"><span class="dl-appeal-mark"><svg viewBox="0 0 498 498" aria-hidden="true"><path fill="currentColor" d="M100 326a149 149 0 0 1 298 0z"/><path fill="currentColor" d="M36 339h426v12H36z"/></svg></span><span class="dl-appeal-t"><b></b><span></span></span>' + ico("chev", 20) + "</button>");
    b.querySelector("b").textContent = banned ? "Appeal your ban" : "Appeal your suspension";
    b.querySelector(".dl-appeal-t span").textContent = "Tell us why the decision should be reviewed. An admin will read it.";
    b.addEventListener("click", function () { newTicketSheet("appeal"); });
    host.appendChild(b);
  }
  function adminView(inner) {
    var back = make('<button type="button" class="dl-sup-back">' + ico("back", 16) + "Support Center</button>");
    back.addEventListener("click", function () { show("home"); });
    inner.appendChild(back);
    inner.appendChild(make('<div class="dl-sup-head"><div><h1 class="dl-sup-hello">Tickets</h1><p class="dl-sup-sub">All tickets, grouped by category.</p></div></div>'));
    var bar = make('<div class="dl-sup-bar"><div class="dl-sup-tabs" role="tablist"><button type="button" role="tab" data-t="open">Open <span data-n="open">–</span></button><button type="button" role="tab" data-t="closed">Closed <span data-n="closed">–</span></button></div>' +
      '<label class="dl-sup-search">' + ico("search", 15) + '<input type="search" placeholder="Search tickets" aria-label="Search tickets"></label>' +
      '<button type="button" class="dd dl-sup-ddf dl-sup-ddf-bar" id="dlSupCat" aria-haspopup="listbox" aria-expanded="false" aria-label="Filter by category"><span class="dd-val"></span><span class="dd-chev">' + ico("chevD", 15) + "</span></button></div>");
    var sel = bar.querySelector("#dlSupCat"), q = bar.querySelector("input");
    ddBind(sel, [["", "All categories"]].concat(ADM_CATS.map(function (c) { return [c[0], c[1]]; })), ST.cat || "");
    inner.appendChild(bar);
    var box = make('<div class="dl-sup-fade"><div class="dl-sup-skel" aria-hidden="true"><i></i><i></i></div></div>'); inner.appendChild(box);
    var data = { open: null, closed: null };
    function tabs() {
      bar.querySelectorAll("[data-t]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.t === ST.adminTab)); });
      ["open", "closed"].forEach(function (k) { bar.querySelector('[data-n="' + k + '"]').textContent = data[k] ? String(data[k].length) : "–"; });
    }
    function draw() {
      tabs();
      var rows = data[ST.adminTab]; if (!rows) return;
      var term = q.value.trim().toLowerCase(), cat = sel.value;
      rows = rows.filter(function (t) { return (!cat || t.category === cat) && (!term || [t.title, t.user_name, t.user_email, t.preview, catLabel(t.category)].join(" ").toLowerCase().indexOf(term) >= 0); });
      box.innerHTML = "";
      if (!rows.length) { box.appendChild(make('<div class="dl-sup-card"><div class="dl-sup-empty">' + (term || cat ? "No tickets match." : (ST.adminTab === "open" ? "No open tickets." : "No closed tickets yet.")) + "</div></div>")); return; }
      ADM_CATS.forEach(function (c) {
        var g = rows.filter(function (t) { return t.category === c[0]; });
        if (!g.length) return;
        box.appendChild(make('<div class="dl-sup-h2">' + esc(c[1]) + ' <span>' + g.length + "</span></div>"));
        box.appendChild(listCard(g, true, "admin"));
      });
    }
    bar.querySelectorAll("[data-t]").forEach(function (b) { b.addEventListener("click", function () { ST.adminTab = b.dataset.t; draw(); }); });
    q.addEventListener("input", draw);
    sel.addEventListener("change", function () { ST.cat = sel.value; draw(); });
    Promise.all([rpc("support_admin_list", { p_status: "open" }), rpc("support_admin_list", { p_status: "closed" })]).then(function (r) { data.open = r[0] || []; data.closed = r[1] || []; draw(); })
      .catch(function () { box.innerHTML = '<div class="dl-sup-card"><div class="dl-sup-empty">Couldn’t load the tickets.</div></div>'; });
  }

  /* ------------------------------------------------------------------ photos */
  var BUCKET = "support-files";
  function pickPhotos(list, onChange, max) {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp,image/gif"; inp.multiple = true;
    inp.addEventListener("change", function () {
      var errs = [];
      [].slice.call(inp.files).forEach(function (f) {
        if (list.length >= max) { errs.push("Up to " + max + " photos."); return; }
        if (!/^image\//.test(f.type)) { errs.push(f.name + " isn’t a photo."); return; }
        if (f.size > 8 * 1048576) { errs.push(f.name + " is over 8 MB."); return; }
        list.push({ file: f, url: URL.createObjectURL(f) });
      });
      onChange(errs[0] || "");
    });
    inp.click();
  }
  function thumbs(list, host, onChange) {
    host.innerHTML = "";
    list.forEach(function (p, i) {
      var t = make('<div class="dl-thumb"><img alt=""><button type="button" aria-label="Remove photo">' + ico("x", 12) + "</button></div>");
      t.querySelector("img").src = p.url;
      t.querySelector("button").addEventListener("click", function () { URL.revokeObjectURL(p.url); list.splice(i, 1); onChange(); });
      host.appendChild(t);
    });
  }
  async function uploadAll(list, userId, ticketId) {
    var out = [], c = cloud();
    for (var i = 0; i < list.length; i++) {
      var f = list[i].file, safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-60) || "photo";
      var path = userId + "/" + ticketId + "/" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + i) + "-" + safe;
      var r = await c.client.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
      if (r.error) throw new Error("A photo couldn’t be uploaded.");
      out.push({ path: path, name: f.name, type: f.type, size: f.size });
    }
    return out;
  }

  /* ------------------------------------------------------------------ new ticket (side panel) */
  function newTicketSheet(preCat) {
    var photos = [], appeal = preCat === "appeal";
    var bd = make('<div class="dl-sheet-bd"><aside class="dl-sheet" role="dialog" aria-modal="true" aria-label="' + (appeal ? "Appeal" : "New ticket") + '">' +
      '<div class="dl-sheet-h"><h2>' + (appeal ? (window.daylightRestricted && window.daylightRestricted.status === "banned" ? "Appeal your ban" : "Appeal your suspension") : "New ticket") + '</h2><button type="button" class="icon-btn" data-x aria-label="Close">' + ico("x", 17) + "</button></div>" +
      '<p class="dl-sheet-p">Tell us what’s going on. We’ll reply right here in the ticket.</p>' +
      '<div class="dl-sheet-b"><div><label for="dlTkCat">Category</label><div class="dl-selwrap"><button type="button" id="dlTkCat" class="dd dl-sup-ddf" aria-haspopup="listbox" aria-expanded="false" aria-label="Category"><span class="dd-val"></span><span class="dd-chev">' + icon("chevD", 15) + '</span></button></div></div>' +
      '<div><label for="dlTkTitle">Title</label><input type="text" id="dlTkTitle" maxlength="120" placeholder="What’s the problem?" autocomplete="off"></div>' +
      '<div><label for="dlTkBody">Details</label><textarea id="dlTkBody" maxlength="4000" placeholder="What happened, and what did you expect?"></textarea></div>' +
      '<div><label>Photos</label><div class="dl-thumbs" data-thumbs></div><button type="button" class="dl-addpic" data-add>' + ico("image", 16) + 'Add photos</button></div>' +
      '<div class="dl-sup-err" data-err role="alert"></div></div>' +
      '<div class="dl-sheet-f"><button type="button" class="btn-ghost" data-x>Cancel</button><button type="button" class="btn-primary" data-ok>Submit ticket</button></div></aside></div>');
    var sel = bd.querySelector("#dlTkCat");
    if (appeal) {
      ddBind(sel, [["appeal", "Appeal"]], "appeal"); sel.disabled = true; sel.closest("div").style.display = "none";
      bd.querySelector("#dlTkTitle").value = window.daylightRestricted && window.daylightRestricted.status === "banned" ? "Appeal: my ban" : "Appeal: my suspension";
      bd.querySelector("#dlTkBody").placeholder = "Explain why the decision should be reviewed.";
      bd.querySelector(".dl-sheet-p").textContent = "Write your appeal. An admin will read it and reply here in the ticket.";
      bd.querySelector("[data-ok]").textContent = "Send appeal";
    } else ddBind(sel, CATS.map(function (c) { return [c[0], c[1]]; }), typeof preCat === "string" && preCat ? preCat : CATS[0][0]);
    function placeholder() { sel._dd.value = ""; sel.querySelector(".dd-val").textContent = "Choose a category…"; sel.classList.add("is-empty"); }
    if (!appeal && !(typeof preCat === "string" && preCat)) placeholder();
    var root = (typeof overlayRoot !== "undefined" && overlayRoot) || document.body;
    root.appendChild(bd);
    var err = bd.querySelector("[data-err]"), th = bd.querySelector("[data-thumbs]"), closing = false;
    function close() {
      if (closing) return; closing = true;
      document.removeEventListener("keydown", onKey, true); photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
      var calm = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || document.body.classList.contains("reduce-motion");
      if (calm) { bd.remove(); return; }
      bd.classList.add("is-out"); setTimeout(function () { bd.remove(); }, 200);
    }
    function onKey(e) { if (e.key === "Escape") { if (typeof ddState !== "undefined" && ddState) return; e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelectorAll("[data-x]").forEach(function (b) { b.addEventListener("click", close); });
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    var redraw = function (m) { thumbs(photos, th, redraw); err.textContent = m || ""; };
    bd.querySelector("[data-add]").addEventListener("click", function () { pickPhotos(photos, redraw, 4); });
    sel.addEventListener("change", function () { err.textContent = ""; sel.classList.remove("bad", "is-empty"); });
    var ok = bd.querySelector("[data-ok]");
    ok.addEventListener("click", async function () {
      var cat = appeal ? "appeal" : sel.value, title = bd.querySelector("#dlTkTitle").value.trim(), body = bd.querySelector("#dlTkBody").value.trim();
      if (!cat) { err.textContent = "Pick a category."; sel.classList.add("bad"); sel.focus(); return; }
      if (!title) { err.textContent = "Add a title."; bd.querySelector("#dlTkTitle").focus(); return; }
      if (!body) { err.textContent = "Describe the problem."; bd.querySelector("#dlTkBody").focus(); return; }
      ok.disabled = true; ok.textContent = "Sending…"; err.textContent = "";
      try {
        var id = crypto.randomUUID(), atts = await uploadAll(photos, cloud().user.id, id);
        await rpc("support_ticket_create", { p_id: id, p_title: title, p_body: body, p_kind: cat === "data" ? "data" : "ticket", p_category: cat, p_atts: atts });
        close(); openTicket(id, "home");
      } catch (e) { err.textContent = errText(e, "Couldn’t send the ticket. Please try again."); ok.disabled = false; ok.textContent = appeal ? "Send appeal" : "Submit ticket"; }
    });
    setTimeout(function () { var i = bd.querySelector(sel.value ? "#dlTkTitle" : "#dlTkCat"); if (i) i.focus(); }, 80);
  }

  function requestData() {
    var go = async function () {
      try {
        if (window.daylightTurnstile && !(await window.daylightTurnstile.check("export-data", { cancel: true }))) return;
        var id = crypto.randomUUID();
        await rpc("support_ticket_create", { p_id: id, p_title: "Please send me a copy of my data", p_body: "", p_kind: "data", p_category: "data", p_atts: [] });
        openTicket(id, "home");
      } catch (e) { window.alert(errText(e, "Couldn’t send that request. Please try again.")); }
    };
    if (typeof openConfirm === "function") openConfirm({ title: "Request a copy of your data?", body: "We’ll review the request, then send your data as a ZIP file in your support ticket. The download is available for 24 hours.", confirmLabel: "Send request", fn: go });
    else go();
  }

  /* ------------------------------------------------------------------ admin sidebar on a ticket (owner only)
     Ticket details, the person's account, history, data, actions. Everything comes from THIS ticket's context (support_admin_context);
     it never shows calendars, events or tasks, never a password, and every action is confirmed first and logged. */
  async function invokeFn(name, body) {
    if (window.daylightTurnstile && !(await window.daylightTurnstile.check("admin-" + (body && body.action || name), { cancel: true }))) throw new Error("Cancelled. Nothing was changed.");
    var c = cloud(), s = c.ensureSession ? await c.ensureSession() : null;
    var res = await c.client.functions.invoke(name, { body: body, headers: s && s.access_token ? { Authorization: "Bearer " + s.access_token } : undefined });
    if (res.error) { var m = res.error.message; try { var j = await res.error.context.json(); m = j.error || m; } catch (e) {} throw new Error(m); }
    return res.data;
  }
  var ACT_LABEL = { reset_password: "Password reset sent", change_email: "E-mail change started", suspend: "Suspended", ban: "Banned", lift: "Restriction lifted", warn: "Warning sent", private_message: "Private message sent", give_data: "Data export given" };
  function dt(iso) { var d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  function dOnly(iso) { var d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }

  /* a small form dialog in the app's own dialog style: fields, a confirm button, an error line */
  function actionDialog(o) {
    var bd = make('<div class="backdrop"><div class="dialog dl-std dl-look dl-act" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
      '<div class="dialog-head"><span class="dialog-title">' + esc(o.title) + '</span><button type="button" class="icon-btn" data-x title="Close" aria-label="Close">' + ico("x", 17) + "</button></div>" +
      '<div class="dialog-body"><p class="dl-act-p"></p><div data-fields></div><div class="dl-sup-err" data-err role="alert"></div></div>' +
      '<div class="dialog-foot"><button type="button" class="btn-ghost" data-cancel>Cancel</button><button type="button" class="' + (o.danger ? "btn-danger" : "btn-primary") + '" style="margin-left:0" data-ok></button></div></div></div>');
    bd.querySelector(".dl-act-p").textContent = typeof o.body === "function" ? o.body({}) : (o.body || "");
    var ok = bd.querySelector("[data-ok]"), err = bd.querySelector("[data-err]"), host = bd.querySelector("[data-fields]"), vals = {};
    if (o.who) {
      var wh = make('<div class="dl-act-who"><span class="dl-adm-av"></span><div><b></b><span></span></div></div>');
      wh.querySelector(".dl-adm-av").textContent = (o.who.name || o.who.email || "?").trim().charAt(0).toUpperCase();
      wh.querySelector("b").textContent = o.who.name || "No name on file"; wh.querySelector(":scope > div > span").textContent = o.who.email;
      bd.querySelector(".dialog-body").insertBefore(wh, bd.querySelector(".dl-act-p"));
    }
    function redoBody() { if (typeof o.body === "function") bd.querySelector(".dl-act-p").textContent = o.body(vals); }
    ok.textContent = o.confirmLabel;
    (o.fields || []).forEach(function (f) {
      var w = make('<div class="dl-act-f"><label></label></div>'); w.querySelector("label").textContent = f.label;
      if (f.type === "choice") {
        var seg = make('<div class="dl-act-seg" role="radiogroup"></div>'); vals[f.id] = f.value || f.options[0][0];
        f.options.forEach(function (op) { var b = make('<button type="button" role="radio"></button>'); b.textContent = op[1]; b.setAttribute("aria-checked", String(op[0] === vals[f.id]));
          b.addEventListener("click", function () { vals[f.id] = op[0]; seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); }); redoBody(); }); seg.appendChild(b); });
        w.appendChild(seg);
      } else {
        var i = make(f.type === "textarea" ? "<textarea></textarea>" : '<input type="text" autocomplete="off" spellcheck="false">'); i.placeholder = f.placeholder || ""; i.maxLength = f.max || 500;
        if (f.type === "textarea") i.rows = 3;
        i.addEventListener("input", function () { vals[f.id] = i.value; err.textContent = ""; sync(); }); vals[f.id] = ""; w.appendChild(i);
      }
      if (f.hint) { var h = make('<div class="dl-act-hint"></div>'); h.textContent = f.hint; w.appendChild(h); }
      host.appendChild(w);
    });
    function sync() { ok.disabled = !!o.need && !o.need.every(function (k) { return String(vals[k] || "").trim().length >= (k === "reason" ? 3 : 1); }); }
    sync(); redoBody();
    var root = (typeof overlayRoot !== "undefined" && overlayRoot) || document.body; root.appendChild(bd);
    function close() { document.removeEventListener("keydown", onKey, true); if (window.daylightExit) window.daylightExit(bd); else bd.remove(); }
    function onKey(e) { if (e.key === "Escape" && !ok.dataset.busy) { if (typeof ddState !== "undefined" && ddState) return; e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelector("[data-x]").addEventListener("click", function () { if (!ok.dataset.busy) close(); });
    bd.querySelector("[data-cancel]").addEventListener("click", function () { if (!ok.dataset.busy) close(); });
    ok.addEventListener("click", async function () {
      if (ok.disabled || ok.dataset.busy) return;
      ok.dataset.busy = "1"; ok.disabled = true; var label = ok.textContent; ok.textContent = "Working…"; err.textContent = "";
      try { await o.run(vals); close(); } catch (e) { delete ok.dataset.busy; ok.disabled = false; ok.textContent = label; err.textContent = errText(e, "That didn’t work. Please try again."); }
    });
    setTimeout(function () { var f = bd.querySelector("input,textarea,[data-ok]"); if (f && !f.disabled) f.focus(); }, 60);
  }

  function adminSidebar(ticketId, hooks) {
    var el0 = make('<aside class="dl-adm" aria-label="Ticket and person details (admin only)"></aside>'), ctx = null;
    var open = { ticket: true, user: true, history: true, data: true, actions: true };
    function sec(key, title, body) {
      var s = make('<section class="dl-adm-sec' + (open[key] ? " open" : "") + '"><button type="button" class="dl-adm-h" aria-expanded="' + open[key] + '"><span></span>' + ico("chev", 15) + '</button><div class="dl-adm-b"></div></section>');
      s.querySelector(".dl-adm-h span").textContent = title;
      s.querySelector(".dl-adm-b").appendChild(body);
      s.querySelector(".dl-adm-h").addEventListener("click", function () { open[key] = !open[key]; s.classList.toggle("open", open[key]); s.querySelector(".dl-adm-h").setAttribute("aria-expanded", String(open[key])); });
      return s;
    }
    function kv(rows) {
      var d = make('<dl class="dl-adm-kv"></dl>');
      rows.forEach(function (r) { var k = make("<dt></dt>"); k.textContent = r[0]; var v = make("<dd></dd>"); if (r[1] instanceof Node) v.appendChild(r[1]); else v.textContent = r[1]; d.appendChild(k); d.appendChild(v); });
      return d;
    }
    function statusCell(t) {
      var w = make("<span></span>"); w.appendChild(pill(t.status === "open" ? "Open" : "Closed", t.status));
      if (t.status === "closed" && t.closed_by) { var sm = make('<small class="dl-adm-sm"></small>'); sm.textContent = "by " + (t.closed_by === "admin" ? "support" : "the customer"); w.appendChild(sm); }
      return w;
    }
    function pill(text, cls) { var p = make('<span class="dl-adm-pill ' + cls + '"></span>'); p.textContent = text; return p; }
    function btn(label, cls, fn, icon) { var b = make('<button type="button" class="' + cls + '"></button>'); b.textContent = label; b.addEventListener("click", fn); return b; }

    function act(name, extra) { return invokeFn("support-admin", Object.assign({ action: name, ticket_id: ticketId }, extra || {})); }
    function after(msg) { hooks.toast && hooks.toast(msg); return refresh(); }

    function render() {
      el0.innerHTML = "";
      var t = ctx.ticket, u = ctx.user, status = u.status;
      el0.appendChild(make('<div class="dl-adm-top"><span class="dl-adm-badge">' + ico("buoy", 14) + '</span><b>Admin</b><span>Only you see this panel</span></div>'));
      // 1. ticket details
      var tk = kv([["Opened", dt(t.created_at)], ["Category", catLabel(t.category)], ["Status", statusCell(t)],
        ["Last reply", (t.last_sender === "user" ? "Customer" : t.last_sender === "admin" ? "Daylight Support" : "System") + " · " + ago(t.last_message_at)], ["Reference", "#" + t.ref]]);
      el0.appendChild(sec("ticket", "Ticket details", tk));
      // 2. user
      var head = make('<div class="dl-adm-user"><span class="dl-adm-av"></span><div><b></b><span></span></div></div>');
      head.querySelector(".dl-adm-av").textContent = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
      head.querySelector("b").textContent = u.name || "No name on file"; head.querySelector(":scope > div > span").textContent = u.email;
      var ub = make("<div></div>"); ub.appendChild(head);
      var st = status === "active" ? pill("Active", "ok") : status === "banned" ? pill("Banned", "bad") : pill("Suspended", "warn");
      var rows = [["Account", st], ["Created", dOnly(u.created_at)], ["Last active", u.last_sign_in_at ? dt(u.last_sign_in_at) : "Never"]];
      ub.appendChild(kv(rows));
      if (u.restriction) {
        var rb = make('<div class="dl-adm-restr"></div>');
        rb.textContent = (u.restriction.kind === "banned" ? "Banned" : "Suspended") + " · " + (u.restriction.ends_at ? "until " + dt(u.restriction.ends_at) : u.restriction.kind === "banned" ? "permanent" : "until lifted") + " — “" + u.restriction.reason + "”";
        ub.appendChild(rb);
      }
      el0.appendChild(sec("user", "User", ub));
      // 3. history
      var hs = make("<div></div>");
      hs.appendChild(make('<div class="dl-adm-sub">Other tickets</div>'));
      if (!ctx.history.tickets.length) hs.appendChild(make('<div class="dl-adm-empty">No other tickets.</div>'));
      ctx.history.tickets.forEach(function (x) {
        var r = make('<button type="button" class="dl-adm-tk"><span class="dl-sup-rt"><b></b><span></span></span><span class="dl-sup-pill"></span></button>');
        r.querySelector("b").textContent = wordCut(x.title, 34); r.title = x.title; r.querySelector(".dl-sup-rt span").textContent = catLabel(x.category) + " · " + dOnly(x.created_at);
        var p = r.querySelector(".dl-sup-pill"); p.textContent = x.status === "open" ? "Open" : "Closed"; p.classList.add(x.status);
        r.addEventListener("click", function () { hooks.openTicket(x.id); }); hs.appendChild(r);
      });
      hs.appendChild(make('<div class="dl-adm-sub">Admin actions</div>'));
      if (!ctx.history.actions.length) hs.appendChild(make('<div class="dl-adm-empty">No actions taken on this account.</div>'));
      ctx.history.actions.forEach(function (a) {
        var r = make('<div class="dl-adm-log"><b></b><span class="dl-adm-lm"></span><span class="dl-adm-lw"></span><span class="dl-adm-lr"></span></div>');
        r.querySelector("b").textContent = ACT_LABEL[a.action] || a.action;
        r.querySelector(".dl-adm-lm").textContent = dt(a.created_at) + (a.detail && a.detail.duration ? " · " + String(a.detail.duration).replace("_", " ") : "") + (a.detail && a.detail.to ? " · to " + a.detail.to : "");
        r.querySelector(".dl-adm-lw").textContent = "by " + (a.admin_email || "admin");
        if (a.reason) r.querySelector(".dl-adm-lr").textContent = "“" + a.reason + "”"; else r.querySelector(".dl-adm-lr").remove();
        hs.appendChild(r);
      });
      el0.appendChild(sec("history", "History", hs));
      // 4. data
      var dd = make("<div></div>");
      dd.appendChild(make('<p class="dl-adm-note">Builds this person’s full data (readable JSON files, calendars as ICS, and a summary) and posts it in this ticket. Their own data only; the download expires after 24 hours.</p>'));
      var gb = btn("Give data", "btn-primary dl-adm-wide", function () {
        actionDialog({ title: "Give " + (u.name || u.email) + " their data?", body: "This posts a ZIP of their data in this ticket. It stays downloadable for 24 hours.", confirmLabel: "Give data",
          run: async function () { await invokeFn("support", { action: "give_data", ticket_id: ticketId }); await after("Data posted in the ticket."); hooks.reload(); } });
      });
      var dataTicket = t.category === "data";
      if (t.status !== "open" && !dataTicket) { gb.disabled = true; gb.title = "Only open tickets (data requests can always be fulfilled)"; var why = make('<div class="dl-adm-why"></div>'); why.textContent = "This ticket is closed. Give data is available on open tickets and on data requests."; dd.appendChild(why); }
      dd.appendChild(gb);
      dd.appendChild(kv([["Data requests", String(ctx.data.requests)], ["Exports given", String(ctx.data.exports_given) + (ctx.data.last_export_at ? " · last " + dOnly(ctx.data.last_export_at) : "")]]));
      el0.appendChild(sec("data", "Data", dd));
      // 5. actions
      var ac = make('<div class="dl-adm-actions"></div>');
      ac.appendChild(btn("Reset password", "btn-ghost", function () {
        actionDialog({ title: "Send a password reset link?", body: "We e-mail " + u.email + " a link to choose a new password. You never see or set the password.", confirmLabel: "Send link",
          run: async function () { await act("reset_password", { redirect_to: (window.daylightRoute && window.daylightRoute.siteRoot) || undefined }); await after("Password reset link sent."); } });
      }));
      ac.appendChild(btn("Change email", "btn-ghost", function () {
        actionDialog({ title: "Change this person’s e-mail?", body: "A verification link goes to the NEW address. The account keeps its current e-mail until they confirm it.", confirmLabel: "Send verification", need: ["new_email"],
          fields: [{ id: "new_email", label: "New e-mail address", placeholder: "name@example.com", max: 200 }],
          run: async function (v) { await act("change_email", { new_email: v.new_email.trim() }); await after("Verification sent to the new address."); } });
      }));
      ac.appendChild(btn("Send private message", "btn-ghost", function () {
        actionDialog({ title: "Send a private message?", body: "They get it in their notifications from Daylight Support. It is separate from this ticket.", confirmLabel: "Send message", need: ["text"],
          fields: [{ id: "text", label: "Message", type: "textarea", placeholder: "What do you want to tell them?", max: 1000 }],
          run: async function (v) { await act("private_message", { text: v.text.trim() }); await after("Message sent."); } });
      }));
      if (status === "active") {
        ac.appendChild(btn("Suspend user", "btn-ghost", function () {
          actionDialog({ title: "Suspend this user?", who: u, body: function (v) {
            var d = v.duration || "7d", days = { "1d": 1, "7d": 7, "30d": 30 }[d];
            return days ? "They can still sign in, but only to the Support Center and Settings, until " + new Date(Date.now() + days * 864e5).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + ". It lifts by itself then. They’re shown the reason and can appeal."
                        : "They can still sign in, but only to the Support Center and Settings, until an admin lifts the suspension. They’re shown the reason and can appeal."; },
          confirmLabel: "Suspend", danger: true, need: ["reason"],
            fields: [{ id: "duration", label: "For how long", type: "choice", value: "7d", options: [["1d", "1 day"], ["7d", "7 days"], ["30d", "30 days"], ["until_lifted", "Until lifted"]] },
                     { id: "reason", label: "Reason (they will see this)", type: "textarea", placeholder: "Why is the account being suspended?", max: 300 }],
            run: async function (v) { await act("suspend", { duration: v.duration, reason: v.reason.trim() }); await after("Suspended."); } });
        }));
        ac.appendChild(btn("Ban user", "btn-danger-outline", function () {
          actionDialog({ title: "Ban this user permanently?", who: u, body: "They can still sign in, but only to the Support Center and Settings, until an admin lifts the ban. They’re shown the reason and can appeal from there.", confirmLabel: "Ban user", danger: true, need: ["reason"],
            fields: [{ id: "reason", label: "Reason (they will see this)", type: "textarea", placeholder: "Why is the account being banned?", max: 300 }],
            run: async function (v) { await act("ban", { reason: v.reason.trim() }); await after("Banned."); } });
        }));
      } else {
        ac.appendChild(btn(status === "banned" ? "Lift ban" : "Lift suspension", "btn-primary", function () {
          actionDialog({ title: status === "banned" ? "Lift this ban?" : "Lift this suspension?", who: u, body: "Full access to Daylight returns right away.", confirmLabel: "Lift", need: ["reason"],
            fields: [{ id: "reason", label: "Reason", type: "textarea", placeholder: "Why is it being lifted?", max: 300 }],
            run: async function (v) { await act("lift", { reason: v.reason.trim() }); await after("Restriction lifted."); } });
        }));
      }
      el0.appendChild(sec("actions", "Actions", ac));
      el0.appendChild(make('<p class="dl-adm-foot">Admin access is for support and safety only. Every action is logged with who, what, when and why. Calendar content is never shown here.</p>'));
    }
    async function refresh() {
      try { ctx = await rpc("support_admin_context", { p_ticket_id: ticketId }); render(); }
      catch (e) { el0.innerHTML = '<div class="dl-adm-empty" style="padding:16px">Couldn’t load the details.</div>'; }
    }
    refresh();
    return { el: el0, refresh: refresh };
  }

  /* ------------------------------------------------------------------ Manage users (owner only)
     The user database inside the Support Center: a summary, a searchable paginated list, and one person's detail. Everything comes from owner-only
     RPCs. It shows e-mails, calendar NAMES, tickets and the admin-action history; never calendar content, never a password or passkey detail. */
  var PAGE_N = 25;
  function statusPill(s) { var p = make('<span class="dl-sup-pill dl-um-st ' + esc(s) + '"></span>'); p.textContent = s === "banned" ? "Banned" : s === "suspended" ? "Suspended" : "Active"; return p; }
  function nameOf(u) { return u.name || (u.email ? String(u.email).split("@")[0] : "") || "No name"; }
  function avatarOf(u, big) { var a = make('<span class="dl-sup-av' + (big ? " dl-um-avbig" : "") + '" aria-hidden="true"></span>'); a.textContent = String(nameOf(u)).trim().split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join("").toUpperCase() || "?"; return a; }
  function lastActive(iso) { return iso ? ago(iso) : "Never"; }

  /* the Users tab on the Admin page hosts these views; umShow switches between the list and one person */
  var UM = { host: null };
  function umRender() {
    var h = UM.host; if (!h) return;
    h.innerHTML = "";
    if (!isOwner()) return;
    if (ST.usersMode === "user" && ST.userId) userView(h); else usersView(h);
  }
  function umShow(mode, extra) { ST.usersMode = mode; if (extra) Object.assign(ST, extra); stopTimer(); umRender(); }
  window.daylightUsersPanel = function (host) { UM.host = host; umRender(); };

  function usersView(inner) {
    inner.appendChild(make('<p class="dl-ad-lead">Everyone with a Daylight account, newest first. Open a person to see their details and take action.</p>'));
    var strip = make('<div class="dl-um-stats" aria-label="User summary"></div>');
    [["total", "Total users"], ["active", "Active"], ["suspended", "Suspended"], ["banned", "Banned"]].forEach(function (s) { strip.appendChild(make('<div class="dl-um-stat" data-k="' + s[0] + '"><b>–</b><span>' + s[1] + "</span></div>")); });
    inner.appendChild(strip);
    var bar = make('<div class="dl-sup-bar"><label class="dl-sup-search">' + ico("search", 15) + '<input type="search" placeholder="Search by name, e-mail or username" aria-label="Search users" autocomplete="off" spellcheck="false"></label></div>');
    inner.appendChild(bar);
    var box = make('<div class="dl-sup-fade"><div class="dl-sup-skel" aria-hidden="true"><i></i><i></i></div></div>'); inner.appendChild(box);
    var q = bar.querySelector("input"); q.value = ST.usersQ || "";
    var seq = 0, timer = null;
    rpc("support_users_summary").then(function (s) { if (!s) return; ["total", "active", "suspended", "banned"].forEach(function (k) { var n = strip.querySelector('[data-k="' + k + '"] b'); if (n) n.textContent = String(s[k] || 0); }); }).catch(function () {});
    function load() {
      var mine = ++seq, term = q.value.trim(), off = ST.usersOff || 0;
      rpc("support_users_list", { p_q: term, p_limit: PAGE_N, p_offset: off }).then(function (r) {
        if (mine !== seq) return;
        box.innerHTML = "";
        var rows = (r && r.rows) || [], total = (r && r.total) || 0;
        if (!rows.length) {
          box.appendChild(make('<div class="dl-sup-card"><div class="dl-sup-empty">' + (term ? "Nobody matches “" + esc(term) + "”. Try a name, an e-mail or a username." : "No users yet.") + "</div></div>"));
          return;
        }
        var card = make('<div class="dl-sup-card"></div>');
        rows.forEach(function (u, i) {
          var row = make('<button type="button" class="dl-sup-row dl-um-row"></button>');
          row.style.setProperty("--i", Math.min(i, 12));
          row.appendChild(avatarOf(u));
          var text = make('<span class="dl-sup-rt"><span class="dl-sup-who"></span><span class="dl-sup-pv"></span></span>');
          text.querySelector(".dl-sup-who").textContent = nameOf(u); text.querySelector(".dl-sup-pv").textContent = u.email + (u.username ? " · @" + u.username : "");
          row.appendChild(text);
          var side = make('<span class="dl-sup-side dl-um-side"><span class="dl-um-dates"><span class="dl-sup-date"></span><span class="dl-um-la"></span></span></span>');
          side.querySelector(".dl-sup-date").textContent = "Joined " + fullDate(u.created_at); side.querySelector(".dl-um-la").textContent = "Active " + lastActive(u.last_sign_in_at);
          side.insertBefore(statusPill(u.status), side.firstChild);
          row.appendChild(side); row.appendChild(make(ico("chev", 16)));
          row.addEventListener("click", function () { umShow("user", { userId: u.id }); });
          card.appendChild(row);
        });
        box.appendChild(card);
        var from = off + 1, to = off + rows.length;
        var pg = make('<div class="dl-um-pg"><span></span><div><button type="button" class="btn-ghost dl-btn-sm" data-prev>Previous</button><button type="button" class="btn-ghost dl-btn-sm" data-next>Next</button></div></div>');
        pg.querySelector("span").textContent = "Showing " + from + "–" + to + " of " + total;
        var pv = pg.querySelector("[data-prev]"), nx = pg.querySelector("[data-next]");
        pv.disabled = off <= 0; nx.disabled = to >= total;
        pv.addEventListener("click", function () { ST.usersOff = Math.max(0, off - PAGE_N); load(); });
        nx.addEventListener("click", function () { ST.usersOff = off + PAGE_N; load(); });
        box.appendChild(pg);
      }).catch(function () { if (mine === seq) box.innerHTML = '<div class="dl-sup-card"><div class="dl-sup-empty">Couldn’t load the users.</div></div>'; });
    }
    var lastTerm = q.value.trim();
    function live() { var t = q.value.trim(); if (t === lastTerm) return; lastTerm = t; ST.usersQ = q.value; ST.usersOff = 0; clearTimeout(timer); timer = setTimeout(load, 120); }
    /* filters as you type: no Enter needed (input, plus key/search/change events for browsers that only report some of them) */
    ["input", "keyup", "search", "change"].forEach(function (ev) { q.addEventListener(ev, live); });
    q.addEventListener("keydown", function (e) { if (e.key === "Enter") e.preventDefault(); });
    load();
  }

  function userView(inner) {
    var back = make('<button type="button" class="dl-sup-back">' + ico("back", 16) + "Users</button>");
    back.addEventListener("click", function () { umShow("users"); });
    inner.appendChild(back);
    var host = make('<div class="dl-um-detail"><div class="dl-sup-skel" aria-hidden="true"><i></i><i></i></div></div>'); inner.appendChild(host);
    var id = ST.userId;
    function card(title, body) { var c = make('<section class="dl-um-card"><h2></h2></section>'); c.querySelector("h2").textContent = title; c.appendChild(body); return c; }
    function kv(rows) {
      var d = make('<div class="dl-um-kv"></div>');
      rows.forEach(function (r) { var x = make("<div><span></span><b></b></div>"); x.querySelector("span").textContent = r[0]; x.querySelector("b").textContent = r[1]; d.appendChild(x); });
      return d;
    }
    function render(d) {
      var u = d.user; host.innerHTML = "";
      var who = { name: u.name, email: u.email };
      var hd = make('<div class="dl-um-head"><div class="dl-um-id"><h1 class="dl-sup-hello"></h1><p class="dl-sup-sub"></p><div class="dl-um-meta"></div></div></div>');
      hd.insertBefore(avatarOf(u, true), hd.firstChild);
      hd.querySelector("h1").textContent = nameOf(u); hd.querySelector(".dl-sup-sub").textContent = u.email;
      var meta = hd.querySelector(".dl-um-meta"); meta.appendChild(statusPill(u.status));
      var m1 = make("<span></span>"); m1.textContent = "Member since " + fullDate(u.created_at); meta.appendChild(m1);
      var m2 = make("<span></span>"); m2.textContent = "Last active " + lastActive(u.last_sign_in_at); meta.appendChild(m2);
      host.appendChild(hd);
      if (u.restriction) {
        var rs = make('<div class="dl-um-restr"></div>');
        rs.textContent = (u.restriction.kind === "banned" ? "Banned" : "Suspended") + " · " + (u.restriction.ends_at ? "until " + fullDate(u.restriction.ends_at) : "until lifted") + (u.restriction.reason ? " · “" + u.restriction.reason + "”" : "");
        host.appendChild(rs);
      }
      var grid = make('<div class="dl-um-grid"></div>'); host.appendChild(grid);
      // account
      grid.appendChild(card("Account", kv([["E-mail", u.email], ["Username", u.username || "None"], ["Sign-in methods", (d.sign_in && d.sign_in.length ? d.sign_in.join(", ") : "None")]])));
      // calendars: names only
      var cb = make('<div class="dl-um-chips"></div>');
      if (!(d.calendars || []).length) cb.appendChild(make('<span class="dl-um-none">No calendars.</span>'));
      (d.calendars || []).forEach(function (n) { var c = make('<span class="dl-um-chip"></span>'); c.textContent = n; cb.appendChild(c); });
      var cc = card("Calendars", cb); cc.appendChild(make('<p class="dl-um-note">Names only. Events, tasks and descriptions are never shown here.</p>')); grid.appendChild(cc);
      // tickets
      var tb = make("<div></div>");
      if (!(d.tickets || []).length) tb.appendChild(make('<span class="dl-um-none">No tickets.</span>'));
      (d.tickets || []).forEach(function (t) {
        var r = make('<button type="button" class="dl-adm-tk"><span class="dl-sup-rt"><b></b><span></span></span><span class="dl-sup-pill"></span></button>');
        r.querySelector("b").textContent = t.title; r.querySelector(".dl-sup-rt span").textContent = catLabel(t.category) + " · #" + t.ref + " · " + fullDate(t.created_at);
        var p = r.querySelector(".dl-sup-pill"); p.textContent = t.status === "open" ? "Open" : "Closed"; p.classList.add(t.status);
        r.addEventListener("click", function () { openTicket(t.id, "user"); });
        tb.appendChild(r);
      });
      grid.appendChild(card("Tickets", tb));
      // history
      var hb = make("<div></div>");
      if (!(d.history || []).length) hb.appendChild(make('<span class="dl-um-none">No warnings, suspensions or actions yet.</span>'));
      (d.history || []).forEach(function (a) {
        var r = make('<div class="dl-adm-log"><b></b><span class="dl-adm-lm"></span><span class="dl-adm-lw"></span><span class="dl-adm-lr"></span></div>');
        r.querySelector("b").textContent = ACT_LABEL[a.action] || a.action;
        r.querySelector(".dl-adm-lm").textContent = dt(a.created_at) + (a.detail && a.detail.duration ? " · " + String(a.detail.duration).replace("_", " ") : "");
        r.querySelector(".dl-adm-lw").textContent = "by " + (a.admin_email || "admin");
        if (a.reason) r.querySelector(".dl-adm-lr").textContent = "“" + a.reason + "”"; else r.querySelector(".dl-adm-lr").remove();
        hb.appendChild(r);
      });
      grid.appendChild(card("History", hb));
      // actions
      var ac = make('<div class="dl-adm-actions dl-um-actions"></div>');
      function done(msg) { if (typeof toast === "function") toast(msg); return load(); }
      function act(name, extra) { return invokeFn("support-admin", Object.assign({ action: name, user_id: u.id }, extra || {})); }
      function b(label, cls, fn) { var x = make('<button type="button" class="' + cls + '"></button>'); x.textContent = label; x.addEventListener("click", fn); return x; }
      ac.appendChild(b("Warn", "btn-ghost", function () {
        actionDialog({ title: "Warn this user?", who: who, body: "They get a notification from Daylight Support with your reason. They can appeal by opening a Support ticket. Their access doesn’t change.", confirmLabel: "Send warning", need: ["reason"],
          fields: [{ id: "reason", label: "Reason (they will see this)", type: "textarea", placeholder: "What is the warning about?", max: 300 },
                   { id: "message", label: "Message (optional)", type: "textarea", placeholder: "Anything else you want them to know", max: 800 }],
          run: async function (v) { await act("warn", { reason: v.reason.trim(), message: (v.message || "").trim() }); await done("Warning sent."); } });
      }));
      if (u.status === "active") {
        ac.appendChild(b("Suspend", "btn-ghost", function () {
          actionDialog({ title: "Suspend this user?", who: who, body: function (v) {
            var dd = v.duration || "7d", days = { "1d": 1, "7d": 7, "30d": 30 }[dd];
            return days ? "They can still sign in, but only to the Support Center and Settings, until " + new Date(Date.now() + days * 864e5).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + ". It lifts by itself then. They’re shown the reason and can appeal."
                        : "They can still sign in, but only to the Support Center and Settings, until an admin lifts the suspension. They’re shown the reason and can appeal."; },
            confirmLabel: "Suspend", danger: true, need: ["reason"],
            fields: [{ id: "duration", label: "For how long", type: "choice", value: "7d", options: [["1d", "1 day"], ["7d", "7 days"], ["30d", "30 days"], ["until_lifted", "Until lifted"]] },
                     { id: "reason", label: "Reason (they will see this)", type: "textarea", placeholder: "Why is the account being suspended?", max: 300 }],
            run: async function (v) { await act("suspend", { duration: v.duration, reason: v.reason.trim() }); await done("Suspended."); } });
        }));
        ac.appendChild(b("Ban", "btn-danger-outline", function () {
          actionDialog({ title: "Ban this user?", who: who, body: "They can still sign in, but only to the Support Center and Settings, until an admin lifts the ban. They’re shown the reason and can appeal from there.", confirmLabel: "Ban user", danger: true, need: ["reason"],
            fields: [{ id: "reason", label: "Reason (they will see this)", type: "textarea", placeholder: "Why is the account being banned?", max: 300 }],
            run: async function (v) { await act("ban", { reason: v.reason.trim() }); await done("Banned."); } });
        }));
      } else {
        ac.appendChild(b(u.status === "banned" ? "Lift ban" : "Lift suspension", "btn-primary", function () {
          actionDialog({ title: u.status === "banned" ? "Lift this ban?" : "Lift this suspension?", who: who, body: "Full access to Daylight returns right away.", confirmLabel: "Lift", need: ["reason"],
            fields: [{ id: "reason", label: "Reason", type: "textarea", placeholder: "Why is it being lifted?", max: 300 }],
            run: async function (v) { await act("lift", { reason: v.reason.trim() }); await done("Restriction lifted."); } });
        }));
      }
      grid.appendChild(card("Actions", ac));
      host.appendChild(make('<p class="dl-adm-foot">Admin access is for support and safety only. Every action is logged with who, what, when and why. Calendar content is never shown here.</p>'));
    }
    function load() {
      return rpc("support_user_detail", { p_id: id }).then(render).catch(function () { host.innerHTML = '<div class="dl-sup-card"><div class="dl-sup-empty">Couldn’t load this person.</div></div>'; });
    }
    load();
  }

  /* ------------------------------------------------------------------ chat */
  function chatView(inner, wrap) {
    var token = ++ST.token, data = null, pending = [], sending = false, lastSig = "";
    var back = make('<button type="button" class="dl-sup-back">' + ico("back", 16) + (ST.from === "admin" ? "Tickets" : ST.from === "user" ? "Back to user" : "Support Center") + "</button>");
    back.addEventListener("click", function () {
      if (ST.from === "user" && isOwner()) { ST.usersMode = "user"; try { sessionStorage.setItem("daylight-admin-tab", "users"); } catch (e) {} state.section = "admin"; stopTimer(); renderAll(true, 1); return; }
      show(ST.from === "admin" && isOwner() ? "admin" : "home");
    });
    inner.appendChild(back);
    var headHost = make("<div></div>"), msgsHost = make('<div class="dl-msgs" role="log" aria-live="polite"></div>'), compHost = make("<div></div>");
    var split = make('<div class="dl-split"><div class="dl-split-l"></div></div>'), leftCol = split.firstChild, side = null;
    leftCol.appendChild(headHost); leftCol.appendChild(msgsHost); leftCol.appendChild(compHost); inner.appendChild(split);
    msgsHost.innerHTML = '<div class="dl-sys">Loading…</div>';

    function viewerIsUser() { return !!(data && data.ticket.mine); }
    function drawHead() {
      var t = data.ticket;
      headHost.innerHTML = "";
      var h = make('<div class="dl-chat-head"><div><h1></h1><div class="dl-chat-meta"></div></div><div class="dl-chat-actions"></div></div>');
      h.querySelector("h1").textContent = t.title;
      var who = !t.mine ? (t.user_name ? t.user_name + " · " + t.user_email : t.user_email) + " · " : "";
      h.querySelector(".dl-chat-meta").textContent = who + catLabel(t.category) + " · " + (t.status === "open" ? "Open" : "Closed") + " · opened " + clock(t.created_at);
      var acts = h.querySelector(".dl-chat-actions");
      if (!t.mine && isOwner()) {
        var tg = make('<button type="button" class="btn-ghost dl-adm-toggle" aria-pressed="false"></button>');
        var paintTg = function () { var hid = wrap.classList.contains("adm-hidden"); tg.textContent = hid ? "Show details" : "Hide details"; tg.setAttribute("aria-pressed", String(!hid)); };
        tg.addEventListener("click", function () { wrap.classList.toggle("adm-hidden"); try { localStorage.setItem("daylight-adm-hidden", wrap.classList.contains("adm-hidden") ? "1" : "0"); } catch (e) {} paintTg(); });
        paintTg(); acts.appendChild(tg);
      }
      if (t.status === "open") {
        var cb = make('<button type="button" class="btn-ghost">Close ticket</button>');
        cb.addEventListener("click", function () {
          var go = async function () { try { await rpc("support_close", { p_id: t.id }); await load(true); } catch (e) { window.alert(errText(e, "Couldn’t close the ticket.")); } };
          if (typeof openConfirm === "function") openConfirm({ title: "Close this ticket?", body: "Neither side can send more messages. The conversation stays readable.", confirmLabel: "Close ticket", fn: go }); else go();
        });
        acts.appendChild(cb);
      }
      headHost.appendChild(h);
    }
    async function giveData(btn) {
      var t = data.ticket;
      var go = async function () {
        btn.disabled = true; btn.textContent = "Preparing…";
        try {
          if (window.daylightTurnstile && !(await window.daylightTurnstile.check("admin-give-data", { cancel: true }))) { btn.disabled = false; btn.textContent = "Give data"; return; }
          var c = cloud(), s = c.ensureSession ? await c.ensureSession() : null;
          var res = await c.client.functions.invoke("support", { body: { action: "give_data", ticket_id: t.id }, headers: s && s.access_token ? { Authorization: "Bearer " + s.access_token } : undefined });
          if (res.error) { var m = res.error.message; try { var j = await res.error.context.json(); m = j.error || m; } catch (e) {} throw new Error(m); }
          await load(true);
        } catch (e) { window.alert(errText(e, "Couldn’t prepare the export.")); }
        btn.disabled = false; btn.textContent = "Give data";
      };
      if (typeof openConfirm === "function") openConfirm({ title: "Give " + (t.user_name || t.user_email) + " their data?", body: "This builds their full data export (JSON files, ICS calendars and a readable summary) and posts it in this ticket. It stays downloadable for 24 hours.", confirmLabel: "Give data", fn: go }); else go();
    }
    var lastTypingPing = 0;
    function drawComposer() {
      var t = data.ticket;
      compHost.innerHTML = "";
      if (t.status !== "open") { compHost.appendChild(make('<div class="dl-closed-note">This ticket is closed.</div>')); return; }
      var c = make('<div class="dl-compose"><div class="dl-thumbs" data-th></div>' +
        '<div class="dl-compose-row"><button type="button" class="dl-ibtn" data-add title="Add photos" aria-label="Add photos">' + ico("image", 17) + '</button>' +
        '<textarea rows="1" placeholder="Write a message…" aria-label="Message"></textarea>' +
        '<button type="button" class="btn-primary dl-send" data-send disabled>' + ico("send", 15) + '<span>Send</span></button></div>' +
        '<div class="dl-sup-err" data-err role="alert"></div></div>');
      var ta = c.querySelector("textarea"), err = c.querySelector("[data-err]"), th = c.querySelector("[data-th]"), send = c.querySelector("[data-send]");
      function sync() {
        ta.style.height = "auto"; ta.style.height = Math.min(176, ta.scrollHeight) + "px";
        ta.style.overflowY = ta.scrollHeight > 176 ? "auto" : "hidden";
        var has = !!ta.value.trim() || pending.length > 0;
        send.disabled = !has || sending; send.classList.toggle("is-ready", has && !sending);
      }
      var redraw = function (m) { thumbs(pending, th, redraw); err.textContent = m || ""; sync(); };
      ta.addEventListener("input", function () {
        sync();
        var now = Date.now();
        if (ta.value.trim() && now - lastTypingPing > 3000) { lastTypingPing = now; rpc("support_typing", { p_id: t.id }).catch(function () {}); }
      });
      c.querySelector("[data-add]").addEventListener("click", function () { pickPhotos(pending, redraw, 4); });
      async function doSend() {
        if (sending) return;
        var body = ta.value.trim(); if (!body && !pending.length) return;
        sending = true; send.disabled = true; send.classList.remove("is-ready"); err.textContent = "";
        showPending(body, pending.length);
        try {
          var atts = await uploadAll(pending, t.user_id, t.id);
          await rpc("support_send", { p_id: t.id, p_body: body, p_atts: atts });
          pending.forEach(function (p) { URL.revokeObjectURL(p.url); }); pending.length = 0; ta.value = ""; redraw("");
          sending = false;
          await load(true);
        } catch (e) { var pe = msgsHost.querySelector(".dl-mrow.pending"); if (pe) pe.remove(); err.textContent = errText(e, "Couldn’t send that message."); }
        sending = false; sync(); ta.focus();
      }
      send.addEventListener("click", doSend);
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); } });
      compHost.appendChild(c);
      redraw("");
    }
    /* the message shows up right away, dimmed with "Sending…", until the server has it */
    function showPending(body, photos) {
      var row = make('<div class="dl-mrow me pending new"><span class="dl-mav sp" aria-hidden="true"></span><div class="dl-msg me"><div class="dl-bub"></div><div class="dl-msg-t">Sending…</div></div></div>');
      var bub = row.querySelector(".dl-bub");
      bub.textContent = body || (photos + (photos === 1 ? " photo" : " photos"));
      var ty = msgsHost.querySelector(".dl-typing"); if (ty) ty.remove();
      msgsHost.appendChild(row); msgsHost.scrollTop = msgsHost.scrollHeight;
    }
    function drawTyping() {
      var old = msgsHost.querySelector(".dl-typing"); if (old) old.remove();
      if (!data || !data.ticket.other_typing) return;
      var t = data.ticket, near = msgsHost.scrollHeight - msgsHost.scrollTop - msgsHost.clientHeight < 90;
      var who = viewerIsUser() ? "Daylight Support" : (t.user_name || t.user_email || "They");
      var row = make('<div class="dl-mrow dl-typing new" role="status"><div class="dl-msg"><div class="dl-bub dl-dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="dl-msg-t"></div></div></div>');
      row.insertBefore(avatarFor(viewerIsUser() ? "admin" : "user", t), row.firstChild);
      row.querySelector(".dl-msg-t").textContent = who + " is typing…";
      msgsHost.appendChild(row);
      if (near) msgsHost.scrollTop = msgsHost.scrollHeight;
    }
    async function signed(paths) {
      if (!paths.length) return {};
      var r = await cloud().client.storage.from(BUCKET).createSignedUrls(paths, 3600), map = {};
      (r.data || []).forEach(function (x) { if (x.signedUrl) map[x.path] = x.signedUrl; });
      return map;
    }
    function avatarFor(sender, t) {
      if (sender === "admin") return make('<span class="dl-mav brand" title="Daylight Support"><svg viewBox="0 0 498 498" aria-hidden="true"><path fill="currentColor" d="M100 326a149 149 0 0 1 298 0z"/><path fill="currentColor" d="M36 339h426v12H36z"/></svg></span>');
      var a = make('<span class="dl-mav" aria-hidden="true"></span>'), name = String(t.user_name || t.user_email || "?");
      var ini = name.trim().split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join("") || "?";
      a.textContent = ini;
      var img = new Image();
      img.alt = ""; img.onload = function () { a.textContent = ""; a.appendChild(img); a.classList.add("has"); };
      try { var pu = cloud().client.storage.from("avatars").getPublicUrl(t.user_id + "/avatar.png").data.publicUrl; img.src = /^https?:/.test(pu) ? pu + "?v=" + Math.floor(Date.now() / 600000) : pu; } catch (e) {}
      return a;
    }
    var seenIds = null;
    function dayKey(iso) { var d = new Date(iso); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
    function dayLabel(iso) {
      var d = new Date(iso), n = new Date(), y = new Date(Date.now() - 864e5);
      if (dayKey(iso) === dayKey(n)) return "Today"; if (dayKey(iso) === dayKey(y)) return "Yesterday";
      return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: d.getFullYear() === n.getFullYear() ? undefined : "numeric" });
    }
    function timeOnly(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
    async function drawMsgs(stick) {
      var t = data.ticket, msgs = data.messages;
      var paths = []; msgs.forEach(function (m) { (m.attachments || []).forEach(function (a) { if (m.kind !== "export" && a.path) paths.push(a.path); }); });
      var urls = {}; try { urls = await signed(paths); } catch (e) {}
      if (token !== ST.token) return;
      var near = msgsHost.scrollHeight - msgsHost.scrollTop - msgsHost.clientHeight < 80;
      msgsHost.innerHTML = "";
      var prev = null, lastDay = "", fresh = {};
      msgs.forEach(function (m, idx) {
        var dk = dayKey(m.created_at);
        if (dk !== lastDay) { lastDay = dk; var dd = make('<div class="dl-daydiv"><span></span></div>'); dd.firstChild.textContent = dayLabel(m.created_at); msgsHost.appendChild(dd); prev = null; }
        var isNew = !!seenIds && !seenIds[m.id]; fresh[m.id] = 1;
        if (m.sender === "system") { var sy = make('<div class="dl-sys' + (isNew ? " new" : "") + '"></div>'); sy.textContent = m.body + " · " + timeOnly(m.created_at); msgsHost.appendChild(sy); prev = null; return; }
        var me = (m.sender === "user") === viewerIsUser();
        var box = make('<div class="dl-msg' + (me ? " me" : "") + '"></div>');
        if (prev !== m.sender) {
          var from = make('<div class="dl-msg-from"></div>');
          if (m.sender === "admin") { from.appendChild(document.createTextNode("Daylight Support")); if (window.daylightVerifiedBadge) from.appendChild(window.daylightVerifiedBadge()); }
          else from.textContent = viewerIsUser() ? "You" : (t.user_name || t.user_email);
          box.appendChild(from);
        }
        var bub = make('<div class="dl-bub"></div>');
        if (m.body) bub.appendChild(document.createTextNode(m.body));
        var atts = m.attachments || [];
        if (m.kind === "export") {
          atts.forEach(function (a) {
            var exp = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
            var f = make('<div class="dl-file' + (exp ? " gone" : "") + '"><span>' + ico("file", 20) + '</span><div><span class="n"></span><small></small></div></div>');
            f.querySelector(".n").textContent = a.name || "daylight-data-export.zip";
            f.querySelector("small").textContent = exp ? "Expired — ask again in this ticket for a new copy" : bytes(a.size) + " · available until " + clock(a.expires_at);
            if (!exp) {
              var b = make('<button type="button" class="btn-primary">' + ico("dl", 14) + " Download</button>");
              b.style.cssText = "display:inline-flex;align-items:center;gap:6px";
              b.addEventListener("click", async function () {
                b.disabled = true;
                try {
                  var r = await cloud().client.storage.from(BUCKET).createSignedUrl(a.path, 300, { download: a.name || "daylight-data-export.zip" });
                  if (r.error || !r.data) throw new Error("expired");
                  var l = document.createElement("a"); l.href = r.data.signedUrl; l.download = a.name || ""; document.body.appendChild(l); l.click(); l.remove();
                } catch (e) { f.classList.add("gone"); f.querySelector("small").textContent = "Expired — ask again in this ticket for a new copy"; b.remove(); }
                b.disabled = false;
              });
              f.appendChild(b);
            }
            bub.appendChild(f);
          });
        } else if (atts.length) {
          var pics = make('<div class="dl-pics"></div>');
          atts.forEach(function (a) {
            var u = urls[a.path]; if (!u) return;
            var pb = make('<button type="button" aria-label="Open photo"><img alt="Attached photo"></button>'); pb.querySelector("img").src = u;
            pb.addEventListener("click", function () { var lb = make('<div class="dl-lightbox"><img alt=""></div>'); lb.querySelector("img").src = u; lb.addEventListener("click", function () { lb.remove(); }); document.body.appendChild(lb); });
            pics.appendChild(pb);
          });
          if (pics.children.length) { if (!m.body) bub.style.padding = "6px"; bub.appendChild(pics); }
        }
        box.appendChild(bub);
        box.appendChild(make('<div class="dl-msg-t">' + esc(timeOnly(m.created_at)) + "</div>"));
        var mrow = make('<div class="dl-mrow' + (me ? " me" : "") + (isNew ? " new" : "") + '"></div>');
        mrow.appendChild(avatarFor(m.sender, t));
        mrow.appendChild(box);
        msgsHost.appendChild(mrow);
        prev = m.sender;
      });
      seenIds = fresh;
      drawTyping();
      if (stick || near) msgsHost.scrollTop = msgsHost.scrollHeight;
    }
    async function load(force) {
      if (token !== ST.token || !wrap.isConnected) return;
      var visible = document.visibilityState === "visible";
      var d;
      try { d = await rpc("support_ticket_get", { p_id: ST.ticketId, p_viewing: visible }); }
      catch (e) { if (!data) msgsHost.innerHTML = '<div class="dl-sys">That ticket couldn’t be opened.</div>'; return; }
      if (token !== ST.token) return;
      var sig = d.ticket.status + "|" + d.messages.length + "|" + (d.messages.length ? d.messages[d.messages.length - 1].id : "");
      d.messages.forEach(function (m) { if (m.kind === "export") (m.attachments || []).forEach(function (x) { sig += "|" + (x.expires_at && new Date(x.expires_at).getTime() < Date.now() ? "x" : "o"); }); });
      var first = !data, wasTyping = !!(data && data.ticket.other_typing);
      data = d;
      if (!first && wasTyping !== !!d.ticket.other_typing && sig === lastSig) drawTyping();
      if (first || force || sig !== lastSig) {
        var statusChanged = !lastSig || lastSig.split("|")[0] !== d.ticket.status;
        lastSig = sig;
        if (first || statusChanged) { drawHead(); drawComposer(); }
        if (!side && !d.ticket.mine && isOwner()) {
          side = adminSidebar(d.ticket.id, { openTicket: function (id) { openTicket(id, "admin"); }, reload: function () { load(true); }, toast: function (m) { if (typeof toast === "function") toast(m); } });
          split.appendChild(side.el); wrap.classList.add("has-adm");
          try { if (localStorage.getItem("daylight-adm-hidden") === "1") wrap.classList.add("adm-hidden"); } catch (e) {}
          drawHead();
        } else if (side && statusChanged) side.refresh();
        await drawMsgs(first || force);
      }
    }
    setTimeout(function () { load(true); }, 0);   /* after the page is attached */
    var myTimer = setInterval(function () { if (!wrap.isConnected || token !== ST.token) { clearInterval(myTimer); return; } if (document.visibilityState === "visible") load(false); }, 2500);
    ST.timer = myTimer;
  }

  /* ------------------------------------------------------------------ wiring into the app */
  var baseRenderView = renderView;
  renderView = function (animate, dir) {
    if (window.daylightRestricted && state.section !== "support") state.section = "support";
    if (state.section === "support") {
      if (typeof closePopover === "function") closePopover();
      if (typeof closeMenu === "function") closeMenu();
      var host = document.getElementById("viewWrap");
      host.innerHTML = "";
      host.appendChild(page());
      return;
    }
    stopTimer();
    return baseRenderView.apply(this, arguments);
  };
  var basePageBy = pageBy;
  pageBy = function () { if (state.section === "support") return; return basePageBy.apply(this, arguments); };

  function decorate() {
    var sb = document.getElementById("sidebar");
    if (!sb || sb.querySelector("[data-side-support]")) return;
    var anchor = sb.querySelector("[data-side-row]") || [].slice.call(sb.querySelectorAll(".side-row")).filter(function (b) { return b.getAttribute("title") === "Settings"; })[0];
    if (!anchor) return;
    var b = make('<button class="side-row' + (state.section === "support" ? " active" : "") + '" title="Support Center" data-side-support>' + ico("buoy", 18) + '<span class="rail-hide">Support Center</span></button>');
    b.addEventListener("click", function () { ST.view = "home"; state.section = "support"; stopTimer(); renderAll(true, 1); if (typeof closeDrawer === "function") closeDrawer(); });
    anchor.parentNode.insertBefore(b, anchor);
  }
  var baseSidebar = renderSidebar;
  renderSidebar = function () {
    var r = baseSidebar.apply(this, arguments);
    try { decorate(); lockSidebar(); } catch (e) { /* the sidebar works without this row */ }
    return r;
  };
  document.addEventListener("daylight:workspace-signed-out", function () { stopTimer(); if (window.state && state.section === "support") state.section = "calendar"; });

  window.daylightSupport = { open: function () { ST.view = "home"; state.section = "support"; renderAll(true, 1); }, openTicket: openTicket, requestData: function () { window.daylightSupport.open(); setTimeout(requestData, 50); } };

  /* /dashboard/?support=1 (from the Privacy Policy) opens the Support Center once signed in */
  var want = false;
  try { want = new URLSearchParams(location.search).get("support") === "1"; } catch (e) {}
  if (want) {
    var tries = 0, t = setInterval(function () {
      tries++;
      var c = cloud();
      if (c && c.ready && c.user && typeof renderAll === "function" && document.querySelector(".month-grid, #viewWrap > *")) {
        clearInterval(t);
        try { var q = new URLSearchParams(location.search); q.delete("support"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash); } catch (e) {}
        window.daylightSupport.open();
      } else if (tries > 80) clearInterval(t);
    }, 250);
  }

  /* Month grid keyboard reach: PageUp / PageDown / Home / End scroll the month grid when it is scrollable (short windows) */
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !window.state || state.section !== "calendar" || state.view !== "month") return;
    if (!/^(PageDown|PageUp|Home|End)$/.test(e.key)) return;
    var t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (document.querySelector(".backdrop,.menu,.dd-menu")) return;
    var g = document.querySelector(".month-grid"); if (!g || g.scrollHeight <= g.clientHeight + 1) return;
    e.preventDefault();
    if (e.key === "Home") g.scrollTop = 0; else if (e.key === "End") g.scrollTop = g.scrollHeight;
    else g.scrollBy({ top: (e.key === "PageDown" ? 1 : -1) * g.clientHeight * 0.85 });
  });
})();
