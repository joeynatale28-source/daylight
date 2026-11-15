/* Daylight landing page motion. One small file, no libraries. Everything animates transform / opacity only (the nav pill also eases its
   width and radius, as asked). Reduced motion: nothing moves. Touch devices: no parallax and no cursor glow. */
(function () {
  "use strict";
  var doc = document.documentElement;
  var nav = document.getElementById("nav");
  var progress = document.getElementById("progress");
  var burger = document.getElementById("burger");
  var menu = document.getElementById("menu");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var phone = window.matchMedia("(max-width: 768px)");
  function motionOk() { return !reduce.matches; }
  
  /* ---- banners above the nav: exactly what the owner posted in Admin and marked "Dashboard and landing page".
     Colors, text and link all come from the database; nothing is hardcoded here. Visitors cannot dismiss them. The list is refreshed
     every minute and when the tab comes back, so a deleted or edited banner never lingers. The entrance waits for the first answer
     (at most 450ms) so the page never jumps. ---- */
  var banners = document.getElementById("banners");
  var SUPA = "https://usihrcucnreecynewgbd.supabase.co", KEY = "sb_publishable_rFlNj3ZOQtyO-CTftzUhwQ_l9dkfFjM";
  var ARROW = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /* readable text for any banner color: the same luminance rule the dashboard uses */
  function textOn(hex) {
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) return "#ffffff";
    var lin = function (v) { v = parseInt(v, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
    return L > 0.4 ? "#111111" : "#ffffff";
  }
  var lastBanners = null;
  function bannerHeight() { return banners ? banners.offsetHeight : 0; }
  function setBannerVar() { doc.style.setProperty("--banner-h", bannerHeight() + "px"); }
  function renderBanners(list) {
    if (!banners) return;
    var key = JSON.stringify(list || []);
    if (key === lastBanners) return;
    lastBanners = key;
    banners.textContent = "";
    (list || []).forEach(function (b) {
      if (!b || !b.body) return;
      var row = document.createElement("div");
      row.className = "banner";
      if (/^#[0-9a-f]{6}$/i.test(b.color || "")) { row.style.background = b.color; row.style.color = textOn(b.color); }
      var link = /^https?:\/\/\S+$/i.test(b.link || "") ? b.link : null;
      if (link) {
        var a = document.createElement("a"); a.href = link; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = b.body;
        row.appendChild(a); row.insertAdjacentHTML("beforeend", ARROW);
      } else row.textContent = b.body;
      banners.appendChild(row);
    });
    setBannerVar(); update();
  }
  function fetchBanners() {
    return fetch(SUPA + "/rest/v1/rpc/daylight_landing_banner", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { if (rows) renderBanners(rows); })
      .catch(function () {});
  }
  var bannerReady = banners ? fetchBanners() : Promise.resolve();
  if (banners) {
    setInterval(function () { if (!document.hidden) fetchBanners(); }, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) fetchBanners(); });
  }
  var waited = new Promise(function (res) { setTimeout(res, 450); });

  /* ---- entrance: start after the first frame, once the banner question is settled ---- */
  Promise.race([bannerReady, waited]).then(function () {
    requestAnimationFrame(function () { requestAnimationFrame(function () { doc.classList.add("is-loaded"); }); });
  });

  /* ---- scroll: nav pill, progress hairline, parallax (one rAF per frame, never per event) ---- */
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  function update() {
    ticking = false;
    var y = window.pageYOffset || doc.scrollTop || 0;
    var bh = bannerHeight();
    nav.style.transform = bh > y ? "translate3d(0," + (bh - y) + "px,0)" : "";
    nav.classList.toggle("is-scrolled", y > bh + 8);
    if (!phone.matches && progress) {
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      progress.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";
    } else if (progress) { progress.style.transform = "scaleX(0)"; }
    }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { setBannerVar(); onScroll(); if (!phone.matches) closeMenu(); }, { passive: true });
  update();

  /* ---- mobile menu ---- */
  var menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  function closeMenu() { if (menuOpen) setMenu(false); }
  burger.addEventListener("click", function () { setMenu(!menuOpen); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuOpen) { closeMenu(); burger.focus(); } });
  document.addEventListener("click", function (e) { if (menuOpen && !nav.contains(e.target)) closeMenu(); });

  /* ---- the word at the end of the headline rotates (opacity + transform only; still when motion is reduced) ---- */
  var rot = document.getElementById("rot");
  if (rot && motionOk()) {
    var words = [].slice.call(rot.querySelectorAll(".rot-word")), cur = 0;
    setInterval(function () {
      if (document.hidden) return;
      words[cur].classList.remove("is-on");
      cur = (cur + 1) % words.length;
      words[cur].classList.add("is-on");
    }, 2600);
  }

  /* ---- Features dropdown (desktop): opens on hover, focus or click; Escape and outside clicks close it ---- */
  var dd = document.getElementById("dd"), ddTrigger = document.getElementById("ddTrigger"), ddTimer = 0, escaped = false;
  function setDd(open) {
    if (!dd) return;
    clearTimeout(ddTimer);
    dd.classList.toggle("open", open);
    ddTrigger.setAttribute("aria-expanded", String(open));
  }
  if (dd) {
    dd.addEventListener("pointerenter", function (e) { if (e.pointerType === "touch" || phone.matches) return; ddTimer = setTimeout(function () { setDd(true); }, 60); });
    dd.addEventListener("pointerleave", function () { clearTimeout(ddTimer); ddTimer = setTimeout(function () { setDd(false); }, 140); });
    ddTrigger.addEventListener("click", function (e) { if (phone.matches) return; if (!dd.classList.contains("open")) { e.preventDefault(); setDd(true); } else { setDd(false); } });
    dd.addEventListener("focusin", function () { if (!phone.matches && !escaped) setDd(true); });
    dd.addEventListener("focusout", function (e) { if (!dd.contains(e.relatedTarget)) setDd(false); });
    dd.addEventListener("click", function (e) { if (e.target.closest(".dd-item, .dd-card")) setDd(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dd.classList.contains("open")) { escaped = true; setDd(false); ddTrigger.focus(); setTimeout(function () { escaped = false; }, 400); } });
    document.addEventListener("click", function (e) { if (!dd.contains(e.target)) setDd(false); });
  }

  /* ---- carousels (features, AI access): arrows scroll one card or slide; the next one always peeks in ---- */
  [].slice.call(document.querySelectorAll(".arrow-btn[data-car]")).forEach(function (btn) {
    var track = document.getElementById("car-" + btn.getAttribute("data-car"));
    if (!track) return;
    var dir = Number(btn.getAttribute("data-dir"));
    function step() { var first = track.firstElementChild; return first ? first.getBoundingClientRect().width + 20 : 320; }
    btn.addEventListener("click", function () { track.scrollBy({ left: dir * step(), behavior: motionOk() ? "smooth" : "auto" }); });
    function sync() {
      var max = track.scrollWidth - track.clientWidth - 2;
      btn.disabled = dir < 0 ? track.scrollLeft <= 2 : track.scrollLeft >= max;
    }
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    sync();
  });

  /* ---- Features: chip selector driving the tabbed window (arrow keys, Home and End work too) ---- */
  var tabs = [].slice.call(document.querySelectorAll(".chip[role=tab]"));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t, false); });
    t.addEventListener("keydown", function (e) {
      var n = -1;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length; else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") n = 0; else if (e.key === "End") n = tabs.length - 1;
      if (n >= 0) { e.preventDefault(); selectTab(tabs[n], true); }
    });
  });

  /* ---- scroll reveal: each block rises in once as it enters the viewport ---- */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && motionOk()) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (n) { io.observe(n); });
  } else { reveals.forEach(function (n) { n.classList.add("in"); }); }

  /* ---- the Daylight logo: the homepage when signed out; the dashboard when signed in ---- */
  function signedIn() {
    try {
      var raw = localStorage.getItem("sb-usihrcucnreecynewgbd-auth-token");
      var s = raw && JSON.parse(raw);
      return !!(s && s.access_token && s.user);
    } catch (e) { return false; }
  }
  [].slice.call(document.querySelectorAll("a.brand")).forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (!signedIn()) return;
      e.preventDefault();
      location.href = new URL("dashboard/", a.href).href;
    });
  });

  /* ---- the OS theme can flip while the page is open: colors crossfade (the CSS reads prefers-color-scheme directly) ---- */
  var scheme = window.matchMedia("(prefers-color-scheme: dark)");
  function fade() {
    if (!motionOk()) return;
    doc.classList.add("theme-fade");
    setTimeout(function () { doc.classList.remove("theme-fade"); }, 260);
  }
  if (scheme.addEventListener) scheme.addEventListener("change", fade); else if (scheme.addListener) scheme.addListener(fade);
})();
