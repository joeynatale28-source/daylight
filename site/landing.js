/* Daylight landing page motion. One small file, no libraries. Everything animates transform / opacity only (the nav pill also eases its
   width and radius, as asked). Reduced motion: nothing moves. Touch devices: no parallax and no cursor glow. */
(function () {
  "use strict";
  var doc = document.documentElement;
  var nav = document.getElementById("nav");
  var progress = document.getElementById("progress");
  var burger = document.getElementById("burger");
  var menu = document.getElementById("menu");
  var frame = document.getElementById("par");
  var grid = document.getElementById("grid");
  var glow = document.getElementById("glow");
  var hero = document.getElementById("top");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(pointer: fine)");
  var phone = window.matchMedia("(max-width: 768px)");
  function motionOk() { return !reduce.matches; }
  function parallaxOk() { return motionOk() && fine.matches && !phone.matches; }

  /* ---- entrance: start after the first frame so the hidden state is painted once ---- */
  requestAnimationFrame(function () { requestAnimationFrame(function () { doc.classList.add("is-loaded"); }); });

  /* ---- scroll: nav pill, progress hairline, parallax (one rAF per frame, never per event) ---- */
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  function update() {
    ticking = false;
    var y = window.pageYOffset || doc.scrollTop || 0;
    nav.classList.toggle("is-scrolled", y > 8);
    if (!phone.matches && progress) {
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      progress.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";
    } else if (progress) { progress.style.transform = "scaleX(0)"; }
    if (parallaxOk()) {
      if (frame) { frame.style.willChange = "transform"; frame.style.transform = "translate3d(0," + (-Math.min(40, y * 0.3)).toFixed(1) + "px,0)"; }
      if (grid) { grid.style.willChange = "transform"; grid.style.transform = "translate3d(0," + (y * 0.1).toFixed(1) + "px,0)"; }
    } else {
      if (frame) { frame.style.transform = ""; frame.style.willChange = ""; }
      if (grid) { grid.style.transform = ""; grid.style.willChange = ""; }
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { onScroll(); if (!phone.matches) closeMenu(); }, { passive: true });
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

  /* ---- cursor glow inside the hero (desktop, fine pointer, motion allowed): lerped, never instant ---- */
  var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, active = false;
  function glowOk() { return motionOk() && fine.matches && !phone.matches; }
  function step() {
    cx += (tx - cx) * 0.15; cy += (ty - cy) * 0.15;
    glow.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
    if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) raf = requestAnimationFrame(step); else raf = 0;
  }
  if (hero && glow) {
    hero.addEventListener("pointermove", function (e) {
      if (!glowOk() || e.pointerType === "touch") return;
      var r = hero.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!active) { active = true; cx = tx; cy = ty; glow.classList.add("on"); }
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { active = false; glow.classList.remove("on"); });
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

  /* ---- the OS theme can flip while the page is open: colors crossfade (the CSS reads prefers-color-scheme directly) ---- */
  var scheme = window.matchMedia("(prefers-color-scheme: dark)");
  function fade() {
    if (!motionOk()) return;
    doc.classList.add("theme-fade");
    setTimeout(function () { doc.classList.remove("theme-fade"); }, 260);
  }
  if (scheme.addEventListener) scheme.addEventListener("change", fade); else if (scheme.addListener) scheme.addListener(fade);
})();
