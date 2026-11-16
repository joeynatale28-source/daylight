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

  /* Rotating word: the word and its period are one unit. Two stacked units cross-fade inside a fixed-width slot. Nothing outside the slot can move. */
  var a = d.getElementById('w1'), b = d.getElementById('w2');
  if (a && b && !reduce.matches) {
    var words = ['clutter.', 'noise.', 'chaos.', 'mess.'], i = 0, cur = a, next = b;
    setInterval(function () {
      i = (i + 1) % words.length;
      next.className = 'word reset';
      next.textContent = words[i];
      void next.offsetWidth;
      next.className = 'word on';
      cur.className = 'word up';
      var t = cur; cur = next; next = t;
    }, 2600);
  }

  /* Feature carousel: whole cards move together, three at a time (two on tablet, one on phone), forever. Never moves inside a panel. */
  var track = d.getElementById('carTrack');
  if (track) {
    var view = track.parentNode, dots = d.getElementById('carDots'), prevB = d.getElementById('carPrev'), nextB = d.getElementById('carNext');
    var originals = [].slice.call(track.children), per = 3, pages = 4, idx = 0, timer = 0, hover = false, gap = 24;
    var motionOff = reduce.matches;
    var clones = [];
    function perView() { var wd = w.innerWidth; return wd >= 960 ? 3 : wd >= 600 ? 2 : 1; }
    function step() { return view.clientWidth - 8 + gap; }   /* the view has 4px of room each side for the hover lift */
    function place(animate) {
      track.classList.toggle('go', !!animate && !motionOff);
      track.style.transform = 'translate3d(' + (-idx * step()) + 'px,0,0)';
    }
    function mark() {
      var cur = idx % pages;
      [].forEach.call(dots.children, function (b, i) { b.setAttribute('aria-selected', i === cur ? 'true' : 'false'); });
    }
    function build() {
      per = perView(); pages = Math.ceil(originals.length / per);
      gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      track.style.setProperty('--per', per);
      clones.forEach(function (n) { n.remove(); }); clones = [];
      for (var i = 0; i < per; i++) { var cl = originals[i].cloneNode(true); cl.setAttribute('aria-hidden', 'true'); cl.removeAttribute('id'); track.appendChild(cl); clones.push(cl); }
      dots.textContent = '';
      for (var p = 0; p < pages; p++) {
        (function (p) {
          var b = d.createElement('button'); b.type = 'button'; b.className = 'car-dot'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'Show cards ' + (p * per + 1) + ' to ' + Math.min(originals.length, p * per + per));
          b.addEventListener('click', function () { go(p); }); dots.appendChild(b);
        })(p);
      }
      if (idx >= pages) idx = 0;
      place(false); mark();
    }
    function go(p) { idx = p; place(true); mark(); restart(); }
    function next() {
      idx += 1; place(true);
      if (idx >= pages) {
        var settle = function () { track.removeEventListener('transitionend', settle); idx = 0; place(false); mark(); };
        if (motionOff) settle(); else track.addEventListener('transitionend', settle);
      } else mark();
      d.querySelectorAll('.car-dot')[idx % pages] && mark();
      restart();
    }
    function prev() {
      if (idx === 0) { idx = pages; place(false); void track.offsetWidth; }
      idx -= 1; place(true); mark(); restart();
    }
    function restart() { clearTimeout(timer); if (!motionOff && !hover && !d.hidden) timer = setTimeout(next, 6500); }
    nextB.addEventListener('click', next); prevB.addEventListener('click', prev);
    var sec = d.getElementById('features');
    sec.addEventListener('mouseenter', function () { hover = true; clearTimeout(timer); });
    sec.addEventListener('mouseleave', function () { hover = false; restart(); });
    sec.addEventListener('focusin', function () { hover = true; clearTimeout(timer); });
    sec.addEventListener('focusout', function () { hover = false; restart(); });
    d.addEventListener('visibilitychange', function () { restart(); });
    var lastPer = 0;
    w.addEventListener('resize', function () { if (perView() !== lastPer) { lastPer = perView(); idx = 0; build(); } else place(false); restart(); });
    if (reduce.addEventListener) reduce.addEventListener('change', function () { motionOff = reduce.matches; restart(); });
    lastPer = perView(); build(); restart();
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
