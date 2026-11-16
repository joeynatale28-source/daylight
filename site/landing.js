/* Daylight website — shared behavior for the landing page and the legal pages.
   Enhancements only: every page is complete and fully visible without this file. */
(function () {
  var d = document, w = window, root = d.documentElement;
  var reduce = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

  /* Reload lands at the very top, unless the URL carries a #hash: then the anchor wins. */
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  function toStart() {
    var id = '';
    try { id = decodeURIComponent((location.hash || '').slice(1)); } catch (e) {}
    var target = id && d.getElementById(id);
    if (target) target.scrollIntoView();
    else if (!location.hash) w.scrollTo(0, 0);
  }
  toStart();
  w.addEventListener('load', toStart);
  w.addEventListener('pageshow', function (e) { if (e.persisted) toStart(); });

  [].forEach.call(d.querySelectorAll('[data-top]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      w.scrollTo(0, 0);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (err) {}
    });
  });

  /* Announcement strip above the nav: the same live banner list the Admin dashboard writes ("Dashboard and landing page" banners,
     read through the public daylight_landing_banner function). Text, link and color come from the database; nothing is hardcoded.
     With no active banner nothing renders. Visitors cannot dismiss it. It refreshes every minute and when the tab returns,
     so an edited, deactivated or deleted banner never lingers. */
  var holder = d.getElementById('banners');
  if (holder && w.fetch) {
    var SUPA = 'https://usihrcucnreecynewgbd.supabase.co', KEY = 'sb_publishable_rFlNj3ZOQtyO-CTftzUhwQ_l9dkfFjM';
    var lastKey = '';
    var textOn = function (hex) {
      var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
      if (!m) return '#ffffff';
      var lin = function (v) { v = parseInt(v, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return (0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3])) > 0.4 ? '#111111' : '#ffffff';
    };
    var show = function (list) {
      list = (list || []).filter(function (b) { return b && b.body; });
      var key = JSON.stringify(list);
      if (key === lastKey) return;
      lastKey = key;
      holder.textContent = '';
      if (!list.length) return;
      list.forEach(function (b) {
        var link = /^https?:\/\/\S+$/i.test(b.link || '') ? b.link : null;
        var row = d.createElement(link ? 'a' : 'div');
        row.className = 'strip live';
        if (/^#[0-9a-f]{6}$/i.test(b.color || '')) { row.style.background = b.color; row.style.color = textOn(b.color); }
        var t = d.createElement('span'); t.textContent = b.body; row.appendChild(t);
        if (link) {
          row.href = link; row.target = '_blank'; row.rel = 'noopener noreferrer';
          var ar = d.createElement('span'); ar.className = 'arrow'; ar.setAttribute('aria-hidden', 'true'); ar.textContent = '\u203a';
          row.appendChild(ar);
        }
        holder.appendChild(row);
      });
    };
    var load = function () {
      w.fetch(SUPA + '/rest/v1/rpc/daylight_landing_banner', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) { if (rows) show(rows); })
        .catch(function () {});
    };
    load();
    setInterval(function () { if (!d.hidden) load(); }, 60000);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) load(); });
  }

  /* Nav: bar at rest, floating pill past 8px. Widths in px so the change animates smoothly. */
  var nav = d.getElementById('nav'), menu = d.getElementById('menu'), panel = d.getElementById('panel');
  if (nav) {
    var brand = nav.querySelector('.brand'), linksEl = nav.querySelector('.links'), rightEl = nav.querySelector('.right');
    var size = function () {
      var cw = nav.clientWidth;
      nav.style.setProperty('--w-rest', cw + 'px');
      var parts = [brand && brand.offsetWidth, linksEl && linksEl.offsetParent ? linksEl.offsetWidth : 0, rightEl && rightEl.offsetWidth].filter(Boolean);
      var pill = parts.reduce(function (s, n) { return s + n; }, 0) + 28 * Math.max(0, parts.length - 1) + 22;
      nav.style.setProperty('--w-pill', Math.max(0, Math.min(cw - 32, Math.ceil(pill))) + 'px');
    };
    size();
    w.addEventListener('load', size);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(size);
    if ('ResizeObserver' in w) new ResizeObserver(size).observe(nav); else w.addEventListener('resize', size);
    var onScroll = function () {
      nav.classList.toggle('is-pill', (w.pageYOffset || root.scrollTop || 0) > 8);
    };
    w.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (menu && panel) {
      var setOpen = function (o) {
        nav.classList.toggle('open', o);
        menu.setAttribute('aria-expanded', o ? 'true' : 'false');
        menu.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
      };
      menu.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
      panel.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
      w.addEventListener('resize', function () { if (w.innerWidth >= 768) setOpen(false); });
    }
  }

  /* Rotating word: the word and its period are one unit. Two stacked units cross-fade inside a fixed-width slot. Nothing outside the slot can move.
     Driven by the Web Animations API so there are no class swaps to race: every swap starts one fade-in and one fade-out together. */
  var a = d.getElementById('w1'), b = d.getElementById('w2');
  if (a && b && !reduce.matches && typeof a.animate === 'function') {
    var words = ['clutter.', 'noise.', 'chaos.', 'mess.'], i = 0, cur = a, next = b;
    var EASE_W = 'cubic-bezier(0.16, 1, 0.3, 1)';
    a.classList.remove('on'); a.style.opacity = '1'; a.style.transform = 'none';
    b.style.opacity = '0'; b.style.transform = 'translateY(6px)';
    var run = function (el, from, to) {
      var old = el.getAnimations();
      var an = el.animate([from, to], { duration: 320, easing: EASE_W, fill: 'forwards' });
      an.finished.then(function () { old.forEach(function (x) { x.cancel(); }); try { an.commitStyles(); an.cancel(); } catch (e) {} }).catch(function () {});
    };
    setInterval(function () {
      if (d.hidden) return;
      i = (i + 1) % words.length;
      next.textContent = words[i];
      run(next, { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' });
      run(cur, { opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' });
      var t = cur; cur = next; next = t;
    }, 2600);
  }

  /* Feature carousel: the section shows three cards (two on tablet, one on phone) with one blurred card peeking in on each side.
     Every 4.5 seconds the whole row moves one card to the right, forever. Nothing moves inside a panel. */
  var track = d.getElementById('carTrack');
  if (track) {
    var view = track.parentNode, dots = d.getElementById('carDots');
    var originals = [].slice.call(track.children), N = originals.length, per = 3, buf = 4, pos = 0, timer = 0, hover = false, gap = 24, busy = false;
    var motionOff = reduce.matches, clones = [], lastPer = 0;
    function perView() { var wd = w.innerWidth; return wd >= 960 ? 3 : wd >= 600 ? 2 : 1; }
    function cardStep() { return originals[0].getBoundingClientRect().width + gap; }
    function shape() {
      var kids = [].slice.call(track.children);
      kids.forEach(function (k, i) { k.classList.toggle('side', i < buf + pos || i >= buf + pos + per); });
      [].forEach.call(dots.children, function (b, i) { b.setAttribute('aria-selected', i === ((pos % N) + N) % N ? 'true' : 'false'); });
    }
    function place(animate) {
      track.classList.toggle('go', !!animate && !motionOff);
      track.classList.toggle('still', !animate || motionOff);
      track.style.transform = 'translate3d(' + (-(buf + pos) * cardStep()) + 'px,0,0)';
      shape();
    }
    function build() {
      per = perView(); buf = per + 1;
      gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      track.style.setProperty('--per', per);
      clones.forEach(function (n) { n.remove(); }); clones = [];
      for (var i = 0; i < buf; i++) {
        var a = originals[(N - buf + i) % N].cloneNode(true), z = originals[i % N].cloneNode(true);
        [a, z].forEach(function (n) { n.setAttribute('aria-hidden', 'true'); n.removeAttribute('id'); });
        track.insertBefore(a, originals[0]); track.appendChild(z); clones.push(a, z);
      }
      /* the clones before the row were inserted in order, so put them back in sequence */
      var before = clones.filter(function (n, i) { return i % 2 === 0; });
      before.forEach(function (n) { track.insertBefore(n, originals[0]); });
      dots.textContent = '';
      for (var p = 0; p < N; p++) {
        (function (p) {
          var b = d.createElement('button'); b.type = 'button'; b.className = 'car-dot'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'Show card ' + (p + 1));
          b.addEventListener('click', function () { pos = p; place(true); restart(); }); dots.appendChild(b);
        })(p);
      }
      if (pos >= N || pos < 0) pos = 0;
      place(false);
    }
    function advance() {
      if (busy) return;
      busy = true; pos -= 1; place(true);   /* the row slides right: the card on the left comes in */
      restart();                            /* the next move is 4.5s after this one starts */
      var done = function () {
        track.removeEventListener('transitionend', onEnd); busy = false;
        if (pos < 0) { pos = N - 1; place(false); }
      };
      var onEnd = function (e) { if (e.target === track) done(); };
      if (motionOff) done(); else { track.addEventListener('transitionend', onEnd); setTimeout(function () { if (busy) done(); }, 1400); }
    }
    function restart() { clearTimeout(timer); if (!motionOff && !hover && !d.hidden) timer = setTimeout(advance, 4500); }
    var sec = d.getElementById('features');
    sec.addEventListener('mouseenter', function () { hover = true; clearTimeout(timer); });
    sec.addEventListener('mouseleave', function () { hover = false; restart(); });
    d.addEventListener('visibilitychange', function () { restart(); });
    w.addEventListener('resize', function () { if (perView() !== lastPer) { lastPer = perView(); pos = 0; build(); } else place(false); restart(); });
    if (reduce.addEventListener) reduce.addEventListener('change', function () { motionOff = reduce.matches; restart(); });
    lastPer = perView(); build(); restart();
    /* it runs from page load, and the first time the section scrolls into view it starts a move right away, so it is already in motion on arrival */
    if ('IntersectionObserver' in w) {
      var seen = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        seen.disconnect();
        if (!motionOff && !busy) { clearTimeout(timer); timer = setTimeout(advance, 450); }
      }, { threshold: 0.25 });
      seen.observe(sec);
    }
  }

  /* Scroll reveals: fade + rise 8px, 250ms, 40ms stagger. Content is visible by default: nothing is hidden
     in CSS, anything on screen at load is left alone, and a timer always forces the finished state. */
  if (!reduce.matches && 'IntersectionObserver' in w && typeof Element.prototype.animate === 'function') {
    var first = true;
    var io = new IntersectionObserver(function (entries) {
      var initial = first; first = false;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        if (initial) return;
        var group = en.target;
        var els = group.hasAttribute('data-stagger') ? [].slice.call(group.children) : [group];
        var anims = els.map(function (el, n) {
          try {
            return el.animate([{ offset: 0, opacity: 0, translate: '0 8px' }],
              { duration: 250, delay: Math.min(n, 5) * 40, easing: EASE, fill: 'backwards' });
          } catch (e) { return null; }
        });
        setTimeout(function () {
          anims.forEach(function (an) { try { if (an && an.playState !== 'finished') an.finish(); } catch (e) {} });
        }, 700);
      });
    }, { threshold: 0.1 });
    [].forEach.call(d.querySelectorAll('[data-reveal]'), function (el) { io.observe(el); });
  }
})();
