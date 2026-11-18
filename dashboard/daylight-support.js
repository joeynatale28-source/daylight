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
    back: '<path d="m15 18-6-6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L8 19"/>', chev: '<path d="m9 6 6 6-6 6"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>', dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    buoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/>', chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>'
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
    ".dl-sup-open{display:inline-flex;align-items:center;gap:10px;height:42px;padding:0 8px 0 18px;border-radius:999px;border:1px solid var(--line-soft);background:var(--surface2);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;flex:none;transition:background 140ms var(--ease-out),transform 140ms var(--ease-out)}",
    ".dl-sup-open:hover{background:var(--hover)}.dl-sup-open:active{transform:scale(.98)}",
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
    ".dl-sup-skel{display:grid;gap:10px}.dl-sup-skel i{display:block;height:68px;border-radius:18px;background:linear-gradient(90deg,var(--surface2),var(--surface),var(--surface2));background-size:200% 100%;animation:dlSupSh 1.2s linear infinite}",
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
    "@media (max-width:760px){.dl-sup{padding:20px 16px 32px}.dl-sup-hello{font-size:25px}.dl-sup-head{flex-wrap:wrap}.dl-msg{max-width:94%}.dl-file{min-width:0;width:100%;box-sizing:border-box}.dl-file button{margin-left:50px}}"
  ].join("\n");
  document.head.appendChild(css);

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
    else homeView(inner);
    return wrap;
  }

  var CATS = [["feature", "Feature request"], ["bug", "Bug report"], ["account", "Account & sign-in"], ["data", "Data request"], ["other", "Something else"]];
  function catLabel(k) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === k) return CATS[i][1]; return "Something else"; }
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
    var head = make('<div class="dl-sup-head"><div><h1 class="dl-sup-hello"></h1><p class="dl-sup-sub">How can we help you?</p></div></div>');
    head.querySelector("h1").textContent = greeting();
    inner.appendChild(head);
    if (isOwner()) {
      var ob = make('<button type="button" class="dl-sup-open">' + ico("inbox", 17) + '<span>Open tickets</span><b>–</b></button>');
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
    rpc("support_ticket_list").then(function (rows) {
      rows = rows || [];
      host.innerHTML = "";
      var open = rows.filter(function (t) { return t.status === "open"; }), closed = rows.filter(function (t) { return t.status === "closed"; });
      if (!rows.length) {
        var em = make('<div class="dl-sup-empty2"><span class="dl-sup-emico">' + ico("chat", 26) + '</span><h2>No tickets yet</h2><p>Questions, bugs, ideas, or a copy of your data — start a ticket and we’ll reply right here.</p><div class="dl-sup-emcats"></div></div>');
        CATS.forEach(function (c) { var b = make('<button type="button" class="dl-sup-chip"></button>'); b.textContent = c[1]; b.addEventListener("click", function () { newTicketSheet(c[0]); }); em.querySelector(".dl-sup-emcats").appendChild(b); });
        host.appendChild(em);
        return;
      }
      host.appendChild(make('<div class="dl-sup-h2">Open</div>'));
      if (open.length) host.appendChild(listCard(open, false, "home")); else host.appendChild(make('<div class="dl-sup-card"><div class="dl-sup-empty">You have no open tickets.</div></div>'));
      if (closed.length) { host.appendChild(make('<div class="dl-sup-h2">Closed</div>')); host.appendChild(listCard(closed, false, "home")); }
    }).catch(function () { host.innerHTML = '<div class="dl-sup-card"><div class="dl-sup-empty">Couldn’t load your tickets.</div></div>'; });
  }

  function adminView(inner) {
    var back = make('<button type="button" class="dl-sup-back">' + ico("back", 16) + "Support Center</button>");
    back.addEventListener("click", function () { show("home"); });
    inner.appendChild(back);
    inner.appendChild(make('<div class="dl-sup-head"><div><h1 class="dl-sup-hello">Tickets</h1><p class="dl-sup-sub">Every ticket from the people using Daylight, grouped by category.</p></div></div>'));
    var bar = make('<div class="dl-sup-bar"><div class="dl-sup-tabs" role="tablist"><button type="button" role="tab" data-t="open">Open <span data-n="open">–</span></button><button type="button" role="tab" data-t="closed">Closed <span data-n="closed">–</span></button></div>' +
      '<label class="dl-sup-search">' + ico("search", 15) + '<input type="search" placeholder="Search tickets" aria-label="Search tickets"></label>' +
      '<button type="button" class="dd dl-sup-ddf dl-sup-ddf-bar" id="dlSupCat" aria-haspopup="listbox" aria-expanded="false" aria-label="Filter by category"><span class="dd-val"></span><span class="dd-chev">' + ico("chevD", 15) + "</span></button></div>");
    var sel = bar.querySelector("#dlSupCat"), q = bar.querySelector("input");
    ddBind(sel, [["", "All categories"]].concat(CATS.map(function (c) { return [c[0], c[1]]; })), ST.cat || "");
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
      CATS.forEach(function (c) {
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
    var photos = [];
    var bd = make('<div class="dl-sheet-bd"><aside class="dl-sheet" role="dialog" aria-modal="true" aria-label="New ticket">' +
      '<div class="dl-sheet-h"><h2>New ticket</h2><button type="button" class="icon-btn" data-x aria-label="Close">' + ico("x", 17) + "</button></div>" +
      '<p class="dl-sheet-p">Tell us what’s going on. We’ll reply right here in the ticket.</p>' +
      '<div class="dl-sheet-b"><div><label for="dlTkCat">Category</label><div class="dl-selwrap"><button type="button" id="dlTkCat" class="dd dl-sup-ddf" aria-haspopup="listbox" aria-expanded="false" aria-label="Category"><span class="dd-val"></span><span class="dd-chev">' + icon("chevD", 15) + '</span></button></div></div>' +
      '<div><label for="dlTkTitle">Title</label><input type="text" id="dlTkTitle" maxlength="120" placeholder="What’s the problem?" autocomplete="off"></div>' +
      '<div><label for="dlTkBody">Details</label><textarea id="dlTkBody" maxlength="4000" placeholder="What happened, and what did you expect?"></textarea></div>' +
      '<div><label>Photos</label><div class="dl-thumbs" data-thumbs></div><button type="button" class="dl-addpic" data-add>' + ico("image", 16) + 'Add photos</button></div>' +
      '<div class="dl-sup-err" data-err role="alert"></div></div>' +
      '<div class="dl-sheet-f"><button type="button" class="btn-ghost" data-x>Cancel</button><button type="button" class="btn-primary" data-ok>Submit ticket</button></div></aside></div>');
    var sel = bd.querySelector("#dlTkCat");
    ddBind(sel, CATS.map(function (c) { return [c[0], c[1]]; }), typeof preCat === "string" && preCat ? preCat : CATS[0][0]);
    function placeholder() { sel._dd.value = ""; sel.querySelector(".dd-val").textContent = "Choose a category…"; sel.classList.add("is-empty"); }
    if (!(typeof preCat === "string" && preCat)) placeholder();
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
      var cat = sel.value, title = bd.querySelector("#dlTkTitle").value.trim(), body = bd.querySelector("#dlTkBody").value.trim();
      if (!cat) { err.textContent = "Pick a category."; sel.classList.add("bad"); sel.focus(); return; }
      if (!title) { err.textContent = "Add a title."; bd.querySelector("#dlTkTitle").focus(); return; }
      if (!body) { err.textContent = "Describe the problem."; bd.querySelector("#dlTkBody").focus(); return; }
      ok.disabled = true; ok.textContent = "Sending…"; err.textContent = "";
      try {
        var id = crypto.randomUUID(), atts = await uploadAll(photos, cloud().user.id, id);
        await rpc("support_ticket_create", { p_id: id, p_title: title, p_body: body, p_kind: cat === "data" ? "data" : "ticket", p_category: cat, p_atts: atts });
        close(); openTicket(id, "home");
      } catch (e) { err.textContent = errText(e, "Couldn’t send the ticket. Please try again."); ok.disabled = false; ok.textContent = "Submit ticket"; }
    });
    setTimeout(function () { var i = bd.querySelector(sel.value ? "#dlTkTitle" : "#dlTkCat"); if (i) i.focus(); }, 80);
  }

  function requestData() {
    var go = async function () {
      try {
        var id = crypto.randomUUID();
        await rpc("support_ticket_create", { p_id: id, p_title: "Please send me a copy of my data", p_body: "", p_kind: "data", p_category: "data", p_atts: [] });
        openTicket(id, "home");
      } catch (e) { window.alert(errText(e, "Couldn’t send that request. Please try again.")); }
    };
    if (typeof openConfirm === "function") openConfirm({ title: "Request a copy of your data?", body: "We’ll review the request, then send your data as a ZIP file in your support ticket. The download is available for 24 hours.", confirmLabel: "Send request", fn: go });
    else go();
  }

  /* ------------------------------------------------------------------ chat */
  function chatView(inner, wrap) {
    var token = ++ST.token, data = null, pending = [], sending = false, lastSig = "";
    var back = make('<button type="button" class="dl-sup-back">' + ico("back", 16) + (ST.from === "admin" ? "Open tickets" : "Support Center") + "</button>");
    back.addEventListener("click", function () { show(ST.from === "admin" && isOwner() ? "admin" : "home"); });
    inner.appendChild(back);
    var headHost = make("<div></div>"), msgsHost = make('<div class="dl-msgs" role="log" aria-live="polite"></div>'), compHost = make("<div></div>");
    inner.appendChild(headHost); inner.appendChild(msgsHost); inner.appendChild(compHost);
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
      if (t.status === "open" && !t.mine && isOwner()) {
        var gd = make('<button type="button" class="btn-primary">Give data</button>');
        gd.addEventListener("click", function () { giveData(gd); });
        acts.appendChild(gd);
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
        mrow.appendChild(prev !== m.sender ? avatarFor(m.sender, t) : make('<span class="dl-mav sp" aria-hidden="true"></span>'));
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
    try { decorate(); } catch (e) { /* the sidebar works without this row */ }
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
})();
