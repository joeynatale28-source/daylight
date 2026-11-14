/* Print a month: a dedicated print layout (white page, black text, one landscape sheet) that is built only while printing.
   Shows the displayed month's VISIBLE calendars: title + start time for each event, the calendar color as a light fill or a left bar,
   multi-day events as one continuous bar. No sidebar, header, buttons or popovers reach the page. Works the same in any app theme. */
(function () {
  "use strict";
  var css = document.createElement("style");
  css.textContent = [
    "#dlPrint{display:none}",
    ".dialog.dl-print-dlg{width:min(1080px,96vw)!important;max-width:96vw!important}.dl-print-body{display:grid;place-items:center;padding-top:6px}",
    ".dl-print-stage{position:relative;overflow:hidden;border-radius:8px;border:1px solid var(--line);background:#fff;box-shadow:var(--shadow-pop)}",
    ".dl-print-frame{display:block;border:0;background:#fff;transform-origin:0 0}",
    ".dl-print-dlg .dialog-foot{gap:8px}.dl-print-dlg [data-tab]{margin-right:auto}",
    "@media print{",
    "  @page{size:landscape;margin:9mm}",
    "  html,body{background:#fff!important;color:#000!important;height:auto!important;overflow:visible!important}",
    "  body.dl-printing > *:not(#dlPrint){display:none!important}",
    "  body.dl-printing #dlPrint{display:flex!important;flex-direction:column;position:static;width:100%;height:186mm;font-family:Inter,system-ui,sans-serif;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    "}",
    "#dlPrint .pm-title{font-size:20px;font-weight:650;letter-spacing:-.01em;margin:0 0 6px}",
    "#dlPrint .pm-heads{display:grid;grid-template-columns:repeat(7,1fr);border:1px solid #bdbdbd;border-bottom:0}",
    "#dlPrint .pm-heads span{font-size:10px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;padding:4px 6px;border-right:1px solid #d6d6d6;color:#333}",
    "#dlPrint .pm-heads span:last-child{border-right:0}",
    "#dlPrint .pm-weeks{flex:1;min-height:0;display:flex;flex-direction:column;border:1px solid #bdbdbd}",
    "#dlPrint .pm-week{flex:1;min-height:0;position:relative;overflow:hidden;border-bottom:1px solid #bdbdbd}",
    "#dlPrint .pm-week:last-child{border-bottom:0}",
    "#dlPrint .pm-bg{position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,1fr)}",
    "#dlPrint .pm-bg i{border-right:1px solid #d6d6d6}#dlPrint .pm-bg i:last-child{border-right:0}",
    "#dlPrint .pm-bg i.out{background:#f4f4f4}",
    "#dlPrint .pm-grid{position:relative;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:min-content;height:100%;align-content:start}",
    "#dlPrint .pm-num{font-size:11px;font-weight:650;padding:3px 6px 2px;text-align:right;color:#222}#dlPrint .pm-num.out{color:#999}",
    "#dlPrint .pm-bar{margin:1px 2px;padding:1px 5px;font-size:10px;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid var(--c);background:color-mix(in srgb,var(--c) 22%,#fff);color:#000;border-radius:2px}",
    "#dlPrint .pm-bar.cl{border-top-left-radius:0;border-bottom-left-radius:0}",
    "#dlPrint .pm-list{display:flex;flex-direction:column;gap:1px;padding:1px 2px;min-width:0}",
    "#dlPrint .pm-ev{font-size:10px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid var(--c);padding-left:4px;color:#000}",
    "#dlPrint .pm-ev b{font-weight:650;margin-right:4px}",
    "#dlPrint .pm-more{font-size:9.5px;color:#555;padding-left:7px}"
  ].join("\n");
  document.head.appendChild(css);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function timeLabel(d) {
    var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? "p" : "a";
    h = h % 12; if (h === 0) h = 12;
    return h + (m ? ":" + (m < 10 ? "0" : "") + m : "") + ap;
  }
  function build() {
    var cur = state.cursor, first = new Date(cur.getFullYear(), cur.getMonth(), 1), last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    var d0 = sod(first);
    while (d0.getDay() !== (state.weekStart || 0)) d0 = addDays(d0, -1);
    var weeks = Math.ceil(((sod(last) - d0) / 86400000 + 1) / 7);
    var occs = occsInRange(d0, addDays(d0, weeks * 7)).filter(function (o) { return !o.ev.declined || state.showDeclined; });
    var MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var root = document.createElement("div"); root.id = "dlPrint";
    var html = '<h1 class="pm-title">' + esc(MON[cur.getMonth()] + " " + cur.getFullYear()) + "</h1><div class=\"pm-heads\">";
    for (var i = 0; i < 7; i++) html += "<span>" + DAY[((state.weekStart || 0) + i) % 7] + "</span>";
    html += '</div><div class="pm-weeks">';
    for (var w = 0; w < weeks; w++) {
      var ws = addDays(d0, w * 7), days = [];
      for (var c = 0; c < 7; c++) days.push(addDays(ws, c));
      var bars = [], timed = days.map(function () { return []; });
      occs.forEach(function (o) {
        var cal = calOf(o.ev.cal), color = cal ? dotOf(cal) : "#888";
        var multi = o.ev.allDay || sod(o.end) > sod(o.start);
        var cover = [];
        days.forEach(function (d, ci) { if (coversDay(o, d)) cover.push(ci); });
        if (!cover.length) return;
        if (multi) {
          var run = [];
          cover.concat([99]).forEach(function (ci) {
            if (run.length && ci !== run[run.length - 1] + 1) {
              bars.push({ a: run[0], b: run[run.length - 1], title: o.ev.title, color: color,
                openL: sod(o.start) < days[run[0]], openR: sod(o.end) > days[run[run.length - 1]] });
              run = [];
            }
            if (ci !== 99) run.push(ci);
          });
        } else timed[cover[0]].push({ t: o.start, title: o.ev.title, color: color });
      });
      bars.sort(function (x, y) { return x.a - y.a || (y.b - y.a) - (x.b - x.a); });
      var lanes = [];
      bars.forEach(function (b) {
        var lane = 0;
        while (lanes[lane] && lanes[lane].some(function (o) { return !(b.b < o.a || b.a > o.b); })) lane++;
        (lanes[lane] = lanes[lane] || []).push(b); b.lane = lane;
      });
      html += '<div class="pm-week"><div class="pm-bg">';
      days.forEach(function (d) { html += "<i" + (d.getMonth() !== cur.getMonth() ? ' class="out"' : "") + "></i>"; });
      html += '</div><div class="pm-grid">';
      days.forEach(function (d, ci) {
        html += '<div class="pm-num' + (d.getMonth() !== cur.getMonth() ? " out" : "") + '" style="grid-column:' + (ci + 1) + ';grid-row:1">' + d.getDate() + "</div>";
      });
      bars.forEach(function (b) {
        html += '<div class="pm-bar' + (b.openL ? " cl" : "") + '" style="grid-column:' + (b.a + 1) + "/" + (b.b + 2) + ";grid-row:" + (b.lane + 2) + ";--c:" + esc(b.color) + '">' + esc(b.title) + "</div>";
      });
      var listRow = lanes.length + 2;
      days.forEach(function (d, ci) {
        var list = timed[ci].sort(function (x, y) { return x.t - y.t; });
        if (!list.length) return;
        var shown = list.slice(0, 4);
        html += '<div class="pm-list" style="grid-column:' + (ci + 1) + ";grid-row:" + listRow + '">' + shown.map(function (e) {
          return '<div class="pm-ev" style="--c:' + esc(e.color) + '"><b>' + timeLabel(e.t) + "</b>" + esc(e.title) + "</div>";
        }).join("") + (list.length > shown.length ? '<div class="pm-more">+' + (list.length - shown.length) + " more</div>" : "") + "</div>";
      });
      html += "</div></div>";
    }
    html += "</div>";
    root.innerHTML = html;
    return root;
  }
  function cleanup() {
    document.body.classList.remove("dl-printing");
    var n = document.getElementById("dlPrint"); if (n) n.remove();
  }
  /* PRINTING NEVER TOUCHES THE LIVE APP. The printout is a separate document inside a hidden iframe: it has its own white page and black
     text, and the print dialog prints THAT document. The app's own page (theme, classes, menus, scroll, state) is not changed before, during
     or after, so nothing can flash, stick or freeze, and cancelling the dialog simply removes the iframe. */
  function inMonthView() { return !!window.state && state.section === "calendar" && state.view === "month"; }
  function elementCss() { return css.textContent.split("\n").filter(function (l) { return /^#dlPrint \.pm-/.test(l); }).join("\n"); }
  function printDocument() {
    var node = build(), title = (node.querySelector(".pm-title") || {}).textContent || "Daylight";
    return "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title><style>@page{size:landscape;margin:9mm}" +
      "html,body{margin:0;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "#dlPrint{display:flex;flex-direction:column;width:100%;height:186mm;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#000;background:#fff}" +
      elementCss() + "</style></head><body>" + node.outerHTML + "</body></html>";
  }
  /* "Print month" opens an in-app preview of the page (a separate white document in a visible frame) with Print and Close.
     Nothing blocks until the person presses Print; if a browser cannot show a print dialog the preview still opens, the app stays
     fully usable, and "Open in a new tab" gives a page that can be printed from there. */
  var printing = null;
  window.daylightPrintMonth = function () {
    if (!window.state || state.section !== "calendar" || (state.view !== "month" && state.view !== "day") || printing) return;   /* the ⋯ menu offers it in Month and Day */
    try { if (typeof closeMenu === "function") closeMenu(); } catch (e) {}
    var html = printDocument();
    var bd = document.createElement("div"); bd.className = "backdrop dl-print-bd";
    bd.innerHTML = '<div class="dialog dl-std dl-look dl-print-dlg" role="dialog" aria-modal="true" aria-label="Print month">' +
      '<div class="dialog-head"><span class="dialog-title">Print month</span><button type="button" class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + '</button></div>' +
      '<div class="dialog-body dl-print-body"><div class="dl-print-stage"><iframe class="dl-print-frame" title="Month preview" tabindex="-1"></iframe></div></div>' +
      '<div class="dialog-foot"><button type="button" class="btn-ghost" data-tab>Open in a new tab</button><button type="button" class="btn-ghost" data-close>Close</button><button type="button" class="btn-primary" style="margin-left:0" data-print>' + icon("printer", 15) + '<span>Print</span></button></div></div>';
    var host = (typeof overlayRoot !== "undefined" && overlayRoot) || document.body;
    host.appendChild(bd); printing = bd;
    var frame = bd.querySelector("iframe"), stage = bd.querySelector(".dl-print-stage");
    var W = 1000, H = 790;
    frame.style.width = W + "px"; frame.style.height = H + "px";
    function fit() {
      var k = Math.max(0.3, Math.min(1, (window.innerWidth - 80) / W, (window.innerHeight - 230) / H));
      frame.style.transform = "scale(" + k + ")"; stage.style.width = Math.round(W * k) + "px"; stage.style.height = Math.round(H * k) + "px";
    }
    fit(); window.addEventListener("resize", fit);
    var d = frame.contentDocument; d.open(); d.write(html.replace("</style>", "@media screen{body{padding:9mm;box-sizing:border-box}}</style>")); d.close();
    function close() {
      window.removeEventListener("resize", fit); document.removeEventListener("keydown", onKey, true);
      printing = null;
      if (window.daylightExit) window.daylightExit(bd); else bd.remove();
      try { window.focus(); } catch (e) {}
    }
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelector("[data-x]").addEventListener("click", close);
    bd.querySelector("[data-close]").addEventListener("click", close);
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
    bd.querySelector("[data-print]").addEventListener("click", function () {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { toast("This browser couldn’t open its print dialog. Use Open in a new tab."); }
      try { window.focus(); } catch (e) {}   /* focus always returns to the app, so Escape and every control keep working */
    });
    bd.querySelector("[data-tab]").addEventListener("click", function () {
      var url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      var w = window.open(url, "_blank"); if (!w) toast("Your browser blocked the new tab. Allow pop-ups for this site.");
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    });
    setTimeout(function () { var pb = bd.querySelector("[data-print]"); if (pb) pb.focus(); }, 0);
  };
  /* test hook / preview: builds the same layout without opening the print dialog */
  window.daylightBuildPrintMonth = function () { cleanup(); var n = build(); document.body.appendChild(n); document.body.classList.add("dl-printing"); return n; };
  window.daylightEndPrintPreview = cleanup;
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === "p" && inMonthView()) {
      if (document.querySelector(".backdrop,.settings-dialog,.dl-consent-backdrop,.dl-lightbox")) return;
      e.preventDefault(); window.daylightPrintMonth();
    }
  });
})();
/* Printing is driven only by the browser print events; the live app is never changed to print. */
