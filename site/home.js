/* Daylight homepage: draws the product mocks (calendar grids, views, feeds) from today's date and keeps a few of them quietly alive.
   Nothing here talks to a server. Reduced motion: everything is drawn once, nothing loops. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var now = new Date();
  var Y = now.getFullYear(), M = now.getMonth(), T = now.getDate();
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* sample events, by day offset from the 1st of this month */
  var EV = [
    [1, "Dentist", "cg"], [2, "Sprint planning", "cb"], [2, "Gym", "cg"], [3, "Standup", "cb"], [4, "Lunch with Jess", "cr"],
    [5, "Design review", "cv"], [6, "Run club", "cg"], [7, "Brunch", "cr"], [8, "Team sync", "cb"], [9, "1:1 with Priya", "cb"], [9, "Yoga", "cg"],
    [10, "Roadmap review", "cv"], [11, "Dinner with Marcus", "cr"], [12, "Standup", "cb"], [13, "Dentist", "cg"], [14, "Soccer game", "ca"],
    [15, "Sprint planning", "cb"], [16, "Book club", "cr"], [17, "Release v2.4", "cv"], [18, "Standup", "cb"], [19, "Gym", "cg"],
    [20, "Mom's birthday", "cr"], [21, "Team sync", "cb"], [22, "Design review", "cv"], [23, "Yoga", "cg"], [24, "Standup", "cb"],
    [25, "Holiday dinner", "ca"], [26, "Run club", "cg"], [27, "Flight to Austin", "cv"], [28, "Standup", "cb"]
  ];

  function grid(el, small) {
    var first = new Date(Y, M, 1), start = new Date(Y, M, 1 - first.getDay());
    var rows = Math.ceil((first.getDay() + new Date(Y, M + 1, 0).getDate()) / 7), html = "";
    DOW.forEach(function (d) { html += '<div class="dow">' + d + "</div>"; });
    for (var i = 0; i < rows * 7; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), inM = d.getMonth() === M, today = inM && d.getDate() === T;
      var evs = inM ? EV.filter(function (e) { return e[0] === d.getDate(); }) : [];
      html += '<div class="d' + (inM ? "" : " out") + '"><span class="n' + (today ? " today" : "") + '">' + d.getDate() + "</span>";
      evs.slice(0, small ? 1 : 2).forEach(function (e) { html += '<span class="ev ' + e[2] + '">' + esc(e[1]) + "</span>"; });
      html += "</div>";
    }
    el.innerHTML = html;
  }
  $$("[data-grid]").forEach(function (el) { grid(el, el.getAttribute("data-grid") === "mini"); });
  $$("[data-month]").forEach(function (el) { el.textContent = MONTHS[M] + " " + Y; });

  /* ---- views panel ---- */
  var viewBody = $("#viewBody"), viewName = $("#viewName");
  function wkday(n) { var d = new Date(Y, M, T); d.setDate(d.getDate() - d.getDay() + n); return d; }
  var VIEWS = {
    month: function () { return '<div class="cal" id="vGrid"></div>'; },
    week: function () {
      var cols = [
        ["cb", "Standup", "9:30 AM"], ["cg", "Gym", "6:30 AM"], ["cb", "Sprint planning", "10:00 AM"], ["cv", "Design review", "3:00 PM"], ["cr", "Dinner with Marcus", "7:00 PM"]
      ], h = '<div class="pv-week">';
      for (var i = 1; i <= 5; i++) {
        var d = wkday(i);
        h += '<div class="pv-col"><h4>' + DOW[i] + " " + d.getDate() + "</h4>";
        h += '<span class="ev ' + cols[i - 1][0] + '">' + cols[i - 1][1] + "<small>" + cols[i - 1][2] + "</small></span>";
        h += '<span class="ev ' + cols[(i + 1) % 5][0] + '">' + cols[(i + 1) % 5][1] + "<small>" + cols[(i + 1) % 5][2] + "</small></span></div>";
      }
      return h + "</div>";
    },
    day: function () {
      var rows = [["8 AM", "cg", "Run club", "8:00 – 8:55"], ["9 AM", "cb", "Standup", "9:30 – 9:45"], ["10 AM", "", "", ""], ["11 AM", "cv", "Design review", "11:00 – 12:00"], ["12 PM", "cr", "Lunch with Jess", "12:15 – 1:30"], ["1 PM", "", "", ""], ["2 PM", "cb", "1:1 with Priya", "2:00 – 2:30"], ["3 PM", "", "", ""]], h = '<div class="pv-day">';
      rows.forEach(function (r) { h += '<div class="pv-row"><span>' + r[0] + "</span><div>" + (r[1] ? '<span class="ev ' + r[1] + '">' + r[2] + "<small>" + r[3] + "</small></span>" : "") + "</div></div>"; });
      return h + "</div>";
    },
    agenda: function () {
      var items = [["Today", [["9:30 AM", "cg", "Dentist", "Smile Dental"], ["12:15 PM", "cr", "Lunch with Jess", "Alamo Cafe"], ["3:00 PM", "cv", "Design review", "Zoom"]]], ["Tomorrow", [["10:00 AM", "cb", "Sprint planning", "Room B"], ["6:30 PM", "cg", "Yoga", "Flow Studio"]]], ["Friday", [["All day", "ca", "Holiday", ""], ["7:00 PM", "cr", "Dinner with Marcus", "Kōyō Ramen"]]]], h = '<div class="pv-agenda">';
      items.forEach(function (g) { h += "<h4>" + g[0] + "</h4>"; g[1].forEach(function (e) { h += '<div class="pv-item ' + e[1] + '"><time>' + e[0] + "</time><i></i><span>" + e[2] + "</span><em>" + e[3] + "</em></div>"; }); });
      return h + "</div>";
    },
    tasks: function () {
      var t = [["Send Fernwood concepts", "Today", 0], ["Reply to Cascade feedback", "Tomorrow", 0], ["Renew font licenses", "Fri", 0], ["Update rates sheet", "Mon", 0], ["Back up project files", "Yesterday", 1]];
      return '<div class="pv-tasks"><ul style="margin:0;padding:0;list-style:none">' + t.map(function (x) { return '<li class="' + (x[2] ? "done" : "") + '"><i class="box ' + (x[2] ? "done" : "") + '"></i><span>' + x[0] + "</span><em>" + x[1] + "</em></li>"; }).join("") + "</ul></div>";
    }
  };
  function showView(v) {
    $$(".tab").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-v") === v)); });
    viewName.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    viewBody.innerHTML = VIEWS[v]();
    viewBody.style.animation = "none"; void viewBody.offsetWidth; viewBody.style.animation = "";
    var g = $("#vGrid"); if (g) grid(g, false);
  }
  if (viewBody) {
    $$(".tab").forEach(function (b, i, all) {
      b.addEventListener("click", function () { showView(b.getAttribute("data-v")); });
      b.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
        if (n >= 0) { e.preventDefault(); var t = all[(n + all.length) % all.length]; t.focus(); showView(t.getAttribute("data-v")); }
      });
    });
    showView("month");
  }

  /* ---- AI access panel ---- */
  var aiBody = $("#aiBody");
  var AI = {
    connect: function () {
      return '<div><span class="k">// Settings → AI access</span></div><div><span class="k">1.</span> Copy your link</div><div><span class="u">https://…/daylight-mcp</span> <span class="k">(shown in Settings)</span></div><div><span class="k">2.</span> Add it to <span class="s">Claude</span>, <span class="s">ChatGPT</span> or <span class="s">Gemini</span></div><div><span class="k">3.</span> Choose what it can do</div><div>&nbsp;</div><div><span class="k">// disconnect any time</span></div>';
    },
    permissions: function () {
      var rows = [["Read events and tasks", "See what is on your calendar", 1], ["Write", "Add and change events and tasks", 1], ["Delete", "Remove events and tasks", 0]];
      return rows.map(function (r) { return '<div class="perm"><span>' + r[0] + "<small>" + r[1] + '</small></span><i class="tog' + (r[2] ? " on" : "") + '"></i></div>'; }).join("");
    },
    activity: function () {
      var rows = [["Claude", "read events", "2 min ago"], ["Claude", "added “Lunch with Jess”", "2 min ago"], ["ChatGPT", "read tasks", "1 hour ago"], ["Gemini", "was disconnected", "Yesterday"]];
      return rows.map(function (r, i) { return '<div class="act" style="animation-delay:' + i * 90 + 'ms"><b>' + r[0] + "</b><span>" + r[1] + "</span><time>" + r[2] + "</time></div>"; }).join("");
    }
  };
  function showAi(k) {
    $$(".ftab").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-a") === k)); });
    aiBody.innerHTML = AI[k]();
    aiBody.style.animation = "none"; void aiBody.offsetWidth; aiBody.style.animation = "";
    if (k === "permissions" && !reduce) { var t = $$(".tog", aiBody)[2]; setTimeout(function () { if (t) t.classList.add("on"); }, 900); setTimeout(function () { if (t) t.classList.remove("on"); }, 2200); }
  }
  if (aiBody) {
    $$(".ftab").forEach(function (b, i, all) {
      b.addEventListener("click", function () { showAi(b.getAttribute("data-a")); });
      b.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
        if (n >= 0) { e.preventDefault(); var t = all[(n + all.length) % all.length]; t.focus(); showAi(t.getAttribute("data-a")); }
      });
    });
    showAi("connect");
  }

  /* ---- typing: quick add + the event title ---- */
  function typer(el, phrases, onDone, speed) {
    var p = 0, i = 0, dir = 1, hold = 0;
    if (reduce) { el.textContent = phrases[0]; if (onDone) onDone(phrases[0]); return; }
    (function tick() {
      if (document.hidden) { setTimeout(tick, 600); return; }
      var s = phrases[p];
      if (hold > 0) { hold--; setTimeout(tick, 60); return; }
      i += dir; el.textContent = s.slice(0, i);
      if (dir === 1 && i === s.length) { if (onDone) onDone(s); dir = -1; hold = 24; }
      else if (dir === -1 && i === 0) { dir = 1; p = (p + 1) % phrases.length; hold = 6; }
      setTimeout(tick, dir === 1 ? (speed || 55) : 22);
    })();
  }
  var qa = $("#qaText"), stream = $("#stream");
  var QA = ["Lunch with Jess tomorrow 12:15", "Dentist Tuesday 9:30 at Smile Dental", "Yoga every Saturday 9am", "Flight to Austin Friday 7:45"];
  var QA_ROW = { "Lunch with Jess tomorrow 12:15": ["Lunch with Jess", "Tomorrow 12:15 PM", "Personal"], "Dentist Tuesday 9:30 at Smile Dental": ["Dentist", "Tue 9:30 AM", "Personal"], "Yoga every Saturday 9am": ["Yoga", "Weekly, Sat 9:00 AM", "Personal"], "Flight to Austin Friday 7:45": ["Flight to Austin", "Fri 7:45 AM", "Travel"] };
  function addRow(s) {
    var r = QA_ROW[s]; if (!r || !stream) return;
    var li = document.createElement("li"); li.innerHTML = "<b>Added</b><span>" + esc(r[0]) + " · " + esc(r[1]) + " · " + esc(r[2]) + "</span>";
    stream.insertBefore(li, stream.firstChild); while (stream.children.length > 3) stream.removeChild(stream.lastChild);
  }
  if (qa) typer(qa, QA, addRow, 48);
  var evt = $("#evTitle"); if (evt) typer(evt, ["Dentist", "Lunch with Jess", "Team sync", "Yoga"], null, 80);

  /* ---- reminders feed ---- */
  var feed = $("#feed");
  var FEED = [["cg", "Dentist", "in 1 hour", "Sent"], ["cb", "Standup", "in 10 minutes", "Sent"], ["cr", "Mom's birthday", "tomorrow", "Snoozed"], ["cv", "Release v2.4", "in 30 minutes", "Sent"], ["ca", "Pay rent", "due today", "Done"]];
  var fi = 0;
  function addFeed() {
    var f = FEED[fi++ % FEED.length], li = document.createElement("li");
    li.className = f[0]; li.innerHTML = '<span class="tagc ' + f[0] + '">' + f[3] + "</span><span>" + esc(f[1]) + "</span><small>" + esc(f[2]) + "</small>";
    feed.insertBefore(li, feed.firstChild); while (feed.children.length > 4) feed.removeChild(feed.lastChild);
  }
  if (feed) { addFeed(); addFeed(); addFeed(); addFeed(); if (!reduce) setInterval(function () { if (!document.hidden) addFeed(); }, 2200); }

  /* ---- tasks tick one by one, then reset ---- */
  var tasks = $$("#tasks li");
  if (tasks.length && !reduce) {
    var ti = 0;
    setInterval(function () {
      if (document.hidden) return;
      if (ti < tasks.length) { tasks[ti].classList.add("done"); tasks[ti].querySelector(".box").classList.add("done"); ti++; }
      else { tasks.forEach(function (l) { l.classList.remove("done"); l.querySelector(".box").classList.remove("done"); }); ti = 0; }
    }, 1300);
  }

  /* ---- sharing: the last person loses access, then comes back ---- */
  var people = $$("#people li");
  if (people.length > 2 && !reduce) {
    var gone = false, last = people[people.length - 1];
    setInterval(function () { if (document.hidden) return; gone = !gone; last.classList.toggle("gone", gone); }, 3200);
  }

  /* ---- hero tasks card: a task gets ticked now and then ---- */
  var ft = $$(".f2 .f-task .box");
  if (ft.length > 1 && !reduce) { var on = false; setInterval(function () { if (document.hidden) return; on = !on; ft[1].classList.toggle("done", on); }, 2400); }

  /* ---- spotlight follows the cursor on cards ---- */
  $$(".card.spot").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });
})();
