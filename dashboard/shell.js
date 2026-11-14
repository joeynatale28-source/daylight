      /* The served page already contains the app's shell. With a saved session
         the sidebar and canvas are painted right here, before any script has
         loaded: the last real render when we have one (same account, build, day
         and window size), otherwise the sidebar structure plus the calendar
         area's loading state. Without a session the sign-in screen renders as
         before. The real render later replaces this in place. */
      (function () {
        var boot = window.__dlBoot || {};
        if (!boot.hint) return;
        var app = document.getElementById("app");
        try {
          if (boot.snap) {
            document.getElementById("sidebar").innerHTML = boot.snap.s;
            document.getElementById("headerBand").innerHTML = boot.snap.hd;
            document.getElementById("viewWrap").innerHTML = boot.snap.v;
            if (boot.snap.rh) document.documentElement.style.setProperty("--dl-cal-row-height", boot.snap.rh);
            if (boot.snap.rail) document.getElementById("sidebar").classList.add("rail");
            if (boot.snap.bc) document.body.className = "booting " + boot.snap.bc;
            document.documentElement.setAttribute("data-dl-snapshot", "1");
          } else {
            var mark = '<div class="logo-tile"><img class="daylight-mark daylight-mark-light" src="../assets/daylight-sunarc-light-NOBG.png" alt="" width="38" height="38"><img class="daylight-mark daylight-mark-dark" src="../assets/daylight-sunarc-dark-NOBG.png" alt="" width="38" height="38"></div>';
            document.getElementById("sidebar").innerHTML = '<div class="dl-shell-sidebar" aria-hidden="true"><div class="brand-row">' + mark +
              '<div class="rail-hide"><div class="brand-name">Daylight</div><div class="brand-sub">Personal calendar</div></div></div>' +
              '<div class="dl-shell-pill"></div><div class="dl-shell-gap"></div>' +
              '<div class="dl-shell-row is-active"><i></i><b></b></div><div class="dl-shell-row"><i></i><b></b></div><div class="dl-shell-grow"></div>' + (boot.identity ? boot.identity : "") + '</div>';
            var spin = document.createElement("div");
            spin.id = "dlWorkspaceLoading"; spin.setAttribute("role", "status"); spin.setAttribute("aria-label", "Loading calendar");
            spin.dataset.startedAt = String(performance.now());
            spin.innerHTML = '<span class="dl-loading-spinner" aria-hidden="true"></span>';
            document.getElementById("main").appendChild(spin);
            document.body.classList.add("dl-canvas-holding");
            window.__dlShellSpinner = true;
          }
          app.hidden = false;
        } catch (e) {}
      })();
    
