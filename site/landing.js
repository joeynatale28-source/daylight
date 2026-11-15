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
  
  /* ---- announcement strip: whatever the owner posts as a banner and marks "Dashboard and landing page" in the admin dashboard.
     Nothing posted means no strip at all. The entrance waits for the answer (at most 450ms) so the page never jumps. ---- */
  var strip = document.getElementById("strip"), hero = document.getElementById("top");
  var SUPA = "https://usihrcucnreecynewgbd.supabase.co", KEY = "sb_publishable_rFlNj3ZOQtyO-CTftzUhwQ_l9dkfFjM", CACHE = "dl-landing-banner";
  var ARROW = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderBanner(b) {
    if (!strip) return;
    strip.textContent = "";
    if (!b || !b.body) { strip.hidden = true; hero.classList.remove("has-strip"); return; }
    var link = /^https?:\/\/\S+$/i.test(b.link || "") ? b.link : null;
    var el = document.createElement(link ? "a" : "div");
    el.className = "strip-link";
    if (link) { el.href = link; el.target = "_blank"; el.rel = "noopener noreferrer"; }
    var t = document.createElement("span"); t.className = "strip-text"; t.textContent = b.body; el.appendChild(t);
    if (link) el.insertAdjacentHTML("beforeend", ARROW);
    strip.appendChild(el); strip.hidden = false; hero.classList.add("has-strip");
  }
  function fetchBanner() {
    return fetch(SUPA + "/rest/v1/rpc/daylight_landing_banner", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return (rows && rows[0]) || null; })
      .catch(function () { return null; });
  }
  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(CACHE) || "null"); } catch (e) {}
  if (cached && Date.now() - cached.at < 120000) renderBanner(cached.b);
  var bannerReady = fetchBanner().then(function (b) {
    renderBanner(b);
    try { sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), b: b })); } catch (e) {}
  });
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
    nav.classList.toggle("is-scrolled", y > 8);
    if (!phone.matches && progress) {
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      progress.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";
    } else if (progress) { progress.style.transform = "scaleX(0)"; }
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
