/* Print a month: a dedicated print layout (white page, black text, one landscape sheet) that is built only while printing.
   Shows the displayed month's VISIBLE calendars: title + start time for each event, the calendar color as a light fill or a left bar,
   multi-day events as one continuous bar. No sidebar, header, buttons or popovers reach the page. Works the same in any app theme. */
(function () {
  "use strict";
  var css = document.createElement("style");
  css.textContent = [
    "#dlPrint{display:none}",
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
  /* Printing never touches the live app: the printout is built only for the moment the browser prints (beforeprint) and removed right after
     (afterprint, which also fires when the dialog is cancelled). Everything that makes it white and black lives in @media print, so the
     on-screen theme, background and state are never changed, before, during or after. */
  function inMonthView() { return !!window.state && state.section === "calendar" && state.view === "month"; }
  window.addEventListener("beforeprint", function () {
    if (!inMonthView()) return;
    cleanup();
    document.body.appendChild(build());
    document.body.classList.add("dl-printing");
  });
  window.addEventListener("afterprint", cleanup);
  window.daylightPrintMonth = function () { if (inMonthView()) window.print(); };
  /* test hook / preview: builds the same layout without opening the print dialog */
  window.daylightBuildPrintMonth = function () { cleanup(); var n = build(); document.body.appendChild(n); document.body.classList.add("dl-printing"); return n; };
  window.daylightEndPrintPreview = cleanup;
})();
