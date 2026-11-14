      /* Runs before anything paints. (1) Theme: the saved mode (system / light /
         dark) or the system preference, so a dark user never sees a light frame
         and vice versa. (2) Boot hints for the shell below: is there a saved
         session, and is there a first-paint snapshot of the last real render
         for this account and build? Everything is wrapped: storage can throw. */
      window.__DL_BUILD = "__BUILD_ID__";
      /* The real window height, so the layout never depends on dvh agreeing with what is actually visible. */
      (function () {
        /* The smallest of every height the browser reports, so the app is never taller than what can actually be seen (an embedded pane or
           browser bar can make innerHeight larger than the visible area, which pushed the last month row out of reach). */
        var set = function () {
          var hs = [window.innerHeight, document.documentElement.clientHeight || 0, window.visualViewport ? window.visualViewport.height : 0].filter(function (n) { return n > 100; });
          document.documentElement.style.setProperty("--dl-app-h", Math.floor(Math.min.apply(null, hs)) + "px");
        };
        set(); window.addEventListener("resize", set); window.addEventListener("orientationchange", set);
        if (window.visualViewport) window.visualViewport.addEventListener("resize", set);
      })();
      (function () {
        var theme = "dark", mode = "system", boot = { hint: false, snap: null };
        try { mode = localStorage.getItem("daylight-theme-mode") || "system"; } catch (e) {}
        try {
          var light = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
          theme = mode === "light" ? "light" : mode === "dark" ? "dark" : (light ? "light" : "dark");
          document.documentElement.setAttribute("data-theme", theme);
        } catch (e) {}
        try {
          var session = JSON.parse(localStorage.getItem("sb-usihrcucnreecynewgbd-auth-token") || "null");
          var id = session && session.user && session.user.id;
          if (id) {
            boot.hint = true;
            var snap = JSON.parse(localStorage.getItem("daylight-first-paint:" + id) || "null");
            var d = new Date(), key = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
            var who = JSON.parse(localStorage.getItem("daylight-identity:" + id) || "null");
            if (who && who.b === window.__DL_BUILD && typeof who.n === "string") {
              var esc = function (t) { return String(t || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
              var initials = who.n.trim().split(/\s+/).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join("") || "?";
              boot.identity = '<div class="profile-wrap"><button class="profile-row" title="Account"><span class="avatar">' + (who.a ? '<img src="' + esc(who.a) + '" alt="">' : esc(initials)) +
                '</span><span class="rail-hide" style="min-width:0"><span class="profile-name">' + esc(who.n) + '</span><br><span class="profile-email">' + esc(who.e) + '</span></span></button></div>';
              window.__dlIdentityEmail = who.e || "";
            }
            if (snap && snap.b === window.__DL_BUILD && snap.d === key && snap.t === theme &&
                Math.abs(snap.w - innerWidth) < 160 && Math.abs(snap.h - innerHeight) < 120) boot.snap = snap;
          }
        } catch (e) {}
        window.__dlBoot = boot;
      })();
    
