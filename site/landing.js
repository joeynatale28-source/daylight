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
    var onScroll = function () { nav.classList.toggle('is-pill', (w.pageYOffset || root.scrollTop || 0) > 8); };
    w.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* A heading never comes to rest under the pill: once scrolling stops, a heading the pill is covering is nudged just below it. */
    var settle = 0;
    var heads = function () { return [].slice.call(d.querySelectorAll('main h1, main h2, .fx-text h2, .qa-q')); };
    var nudge = function () {
      var bar = nav.querySelector('.bar'); if (!bar || !nav.classList.contains('is-pill') || nav.classList.contains('open')) return;
      var pr = bar.getBoundingClientRect(), pb = pr.bottom + 12;
      var hs = heads();
      for (var i = 0; i < hs.length; i++) {
        var r = hs[i].getBoundingClientRect();
        if (r.bottom < pr.top + 6 || r.top > pb) continue;                       /* clear of the pill */
        if (r.right < pr.left || r.left > pr.right) continue;                     /* beside the pill, not under it */
        if (r.top >= pr.bottom + 4) continue;
        w.scrollBy({ top: r.top - pb, behavior: 'smooth' });
        return;
      }
    };
    w.addEventListener('scroll', function () { clearTimeout(settle); settle = setTimeout(nudge, 220); }, { passive: true });

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

  /* Feature carousel. Twelve equal cards, three on screen (two on tablet, one on phone), all sharp; the row is clipped to exactly those cards.
     Every 4.5 seconds the whole row slides one card to the right (the next card enters from the left), forever. Copies of the cards
     sit on both ends of the row, so after card 12 the row simply keeps going and card 1 follows with the identical motion; the reset
     to the real cards happens while the picture is identical, so the wrap cannot be seen. Nothing moves inside a panel. */
  var track = d.getElementById('carTrack');
  if (track) {
    var view = track.parentNode, root = d.documentElement;
    var originals = [].slice.call(track.children), N = originals.length;
    var per = 3, buf = 4, pos = 0, timer = 0, hover = false, g = 24, cardW = 0, offX = 0, busy = false, pending = null;
    var motionOff = reduce.matches, clones = [], lastPer = 0;
    function perView() { var wd = root.clientWidth; return wd >= 960 ? 3 : wd >= 600 ? 2 : 1; }
    /* exactly the cards in view fill the row: equal columns, no peeking cards, nothing blurred */
    function size() {
      var viewW = view.clientWidth;
      g = root.clientWidth >= 768 ? 24 : 16;
      cardW = (viewW - (per - 1) * g) / per;
      offX = 0;
      track.style.setProperty('--cw', cardW + 'px');
      track.style.columnGap = g + 'px';
      /* equal heights: every description gets the room of the longest one */
      var all = [].slice.call(track.querySelectorAll('.fcard > p'));
      all.forEach(function (p) { p.style.minHeight = ''; });
      var tallest = 0; originals.forEach(function (c) { tallest = Math.max(tallest, c.querySelector(':scope > p').getBoundingClientRect().height); });
      all.forEach(function (p) { p.style.minHeight = tallest + 'px'; });
    }
    function shape() {}
    function place(animate) {
      track.classList.toggle('go', !!animate && !motionOff);
      track.classList.toggle('still', !animate || motionOff);
      track.style.transform = 'translate3d(' + (offX - (buf + pos) * (cardW + g)) + 'px,0,0)';
      shape();
    }
    function build() {
      per = perView(); buf = per + 1;
      track.style.setProperty('--per', per);
      clones.forEach(function (n) { n.remove(); }); clones = [];
      for (var i = 0; i < buf; i++) {
        var a = originals[(N - buf + i) % N].cloneNode(true), z = originals[i % N].cloneNode(true);
        [a, z].forEach(function (n) { n.setAttribute('aria-hidden', 'true'); n.removeAttribute('id'); });
        track.insertBefore(a, originals[0]); track.appendChild(z); clones.push(a, z);
      }
      size();
      if (pos >= N || pos < 0) pos = 0;
      place(false);
    }
    function finish() {
      if (!busy) return;
      busy = false; pending = null;
      if (pos >= N) { pos = 0; place(false); }   /* identical picture: the copy of card 1 -> the real card 1 */
    }
    function over() { try { return view.matches(':hover'); } catch (e) { return false; } }
    function advance() {
      if (busy) return;
      if (over()) { restart(); return; }          /* the pointer is on the cards: wait, then check again */
      busy = true; pos += 1; place(true);           /* the row slides left: the next card enters from the right */
      restart();                                    /* the next move starts 4.5s after this one, so every rest is the same length */
      var onEnd = function (e) { if (e.target === track) { track.removeEventListener('transitionend', onEnd); finish(); } };
      pending = function () { track.removeEventListener('transitionend', onEnd); finish(); };
      if (motionOff) pending(); else { track.addEventListener('transitionend', onEnd); setTimeout(function () { if (busy) pending(); }, 1100); }
    }
    var inView = false;
    function restart() { clearTimeout(timer); if (!motionOff && !d.hidden && inView) timer = setTimeout(advance, 4500); }
    var sec = d.getElementById('features');
    view.addEventListener('mouseleave', function () { if (!busy) restart(); });
    d.addEventListener('visibilitychange', function () { if (!d.hidden && pending) pending(); restart(); });
    w.addEventListener('resize', function () {
      if (perView() !== lastPer) { lastPer = perView(); pos = 0; busy = false; build(); }
      else { size(); place(false); }
      restart();
    });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { size(); place(false); });
    w.addEventListener('load', function () { size(); place(false); });
    if (reduce.addEventListener) reduce.addEventListener('change', function () { motionOff = reduce.matches; restart(); });
    lastPer = perView(); pos = 0; build();
    /* it waits at card 1 until the section is on screen, then advances every 4.5s; it stops while the section is off screen */
    if ('IntersectionObserver' in w) {
      new IntersectionObserver(function (es) {
        var on = es[0].intersectionRatio >= 0.3;
        if (on && !inView) { inView = true; restart(); }
        else if (!es[0].isIntersecting && inView) { inView = false; clearTimeout(timer); }
      }, { threshold: [0, 0.3] }).observe(sec);
    } else { inView = true; restart(); }
  }

  /* Feature sections: each animation starts from its first frame when its section scrolls into view, pauses when it leaves,
     and starts again from the first frame on re-entry. */
  var fxs = [].slice.call(d.querySelectorAll('.fx'));
  var typers = [].slice.call(d.querySelectorAll('.typ'));
  typers.forEach(function (t) { if (reduce.matches) t.textContent = t.getAttribute('data-typ'); });
  if (fxs.length) {
    var anims = function (s) { return [].slice.call(s.querySelectorAll('.fxp *')).reduce(function (all, e) { return all.concat(e.getAnimations ? e.getAnimations() : []); }, []); };
    if ('IntersectionObserver' in w) {
      var fxio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var s = e.target;
          if (e.intersectionRatio >= 0.3) {
            if (!s.classList.contains('on')) anims(s).forEach(function (a) { try { a.currentTime = 0; } catch (x) {} });
            s.classList.add('on');
          } else if (!e.isIntersecting) s.classList.remove('on');
        });
      }, { threshold: [0, 0.3] });
      fxs.forEach(function (s) { fxio.observe(s); });
    } else fxs.forEach(function (s) { s.classList.add('on'); });
  }
  /* AI access scene: a timer, not the animation clock, moves it along: Checking for ~2.6s, then the answer for ~2.6s, then around again.
     It starts from "Checking" each time the section comes into view and stops when it leaves. */
  var aiSec = d.getElementById('ai'), aiScene = aiSec && aiSec.querySelector('.sc1'), aiT = [];
  if (aiScene) {
    var aiStop = function () { aiT.forEach(clearTimeout); aiT = []; };
    var aiRun = function () {
      aiStop(); aiScene.classList.remove('ans');
      aiT.push(setTimeout(function () { aiScene.classList.add('ans'); }, 2600));
      aiT.push(setTimeout(function () { aiScene.classList.remove('ans'); }, 5400));
      aiT.push(setTimeout(aiRun, 5800));
    };
    if (reduce.matches) aiScene.classList.add('ans');
    else if ('IntersectionObserver' in w) {
      new IntersectionObserver(function (es) {
        var e = es[0];
        if (e.intersectionRatio >= 0.3 && !aiSec._aiOn) { aiSec._aiOn = true; aiRun(); }
        else if (!e.isIntersecting && aiSec._aiOn) { aiSec._aiOn = false; aiStop(); aiScene.classList.remove('ans'); }
      }, { threshold: [0, 0.3] }).observe(aiSec);
    } else aiScene.classList.add('ans');
  }
  /* typing is keystroke by keystroke, locked to the animation clock so it loops with the scene */
  if (typers.length && !reduce.matches) {
    var tick = function () {
      typers.forEach(function (t) {
        var an = t.getAnimations ? t.getAnimations()[0] : null;
        if (!an) return;
        var dur = an.effect.getComputedTiming().duration, ct = (an.currentTime || 0) % dur;
        var txt = t.getAttribute('data-typ'), n = Math.max(0, Math.min(txt.length, Math.floor((ct / 1000 - parseFloat(t.getAttribute('data-start'))) * parseFloat(t.getAttribute('data-cps')))));
        var v = txt.slice(0, n);
        if (t.textContent !== v) t.textContent = v;
      });
      w.requestAnimationFrame(tick);
    };
    w.requestAnimationFrame(tick);
  }
  /* Views: Month, Week, Day and Agenda are real tabs. The first click takes over from the automatic loop. */
  var vsec = d.getElementById('views');
  if (vsec) {
    var layers = [].slice.call(vsec.querySelectorAll('.sc2 .vl'));
    var tabs = [].slice.call(vsec.querySelectorAll('[data-view]'));
    var showView = function (k) {
      vsec.classList.add('manual');
      layers.forEach(function (l, i) { l.style.transform = 'translateX(' + (i === k ? 0 : i < k ? -100 : 100) + '%)'; });
      tabs.forEach(function (t) { var on = +t.getAttribute('data-view') === k; t.classList.toggle('active', on); t.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    };
    tabs.forEach(function (t) { t.addEventListener('click', function () { showView(+t.getAttribute('data-view')); }); });
  }

  /* Scroll reveals: parts below the fold start hidden (set by script, so the page is complete without it) and fade and rise 16px
     in 500ms as they come into view. An anchor jump shows everything up to its target at once. */
  var rvTargets = [];
  if (!reduce.matches && 'IntersectionObserver' in w) {
    [].forEach.call(d.querySelectorAll('[data-reveal]'), function (el) {
      var parts = el.hasAttribute('data-stagger') ? [].slice.call(el.children) : [el];
      if (el.getBoundingClientRect().top < w.innerHeight * 0.9) return;
      parts.forEach(function (p, n) { p.classList.add('rv'); p.style.setProperty('--rd', Math.min(n, 5) * 100 + 'ms'); });
      rvTargets.push({ el: el, parts: parts, done: false });
    });
    var showRv = function (t, now) { if (t.done) return; t.done = true; t.parts.forEach(function (p) { if (now) p.classList.add('now'); p.classList.add('in'); }); };
    var rvio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        rvio.unobserve(e.target);
        rvTargets.forEach(function (t) { if (t.el === e.target) showRv(t, false); });
      });
    }, { threshold: 0.12 });
    rvTargets.forEach(function (t) { rvio.observe(t.el); });
    var revealTo = function (id) {
      var target = id && d.getElementById(id);
      if (!target) return;
      rvTargets.forEach(function (t) {
        var pos = t.el.compareDocumentPosition(target);
        if (t.el === target || (pos & 4) || (pos & 8)) showRv(t, true);   /* before, around or inside the target */
      });
    };
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (a) { var h = a.getAttribute('href'); revealTo(h.slice(h.indexOf('#') + 1)); }
    }, true);
    w.addEventListener('hashchange', function () { revealTo(location.hash.slice(1)); });
    if (location.hash) revealTo(decodeURIComponent(location.hash.slice(1)));
    var sweep = function () { rvTargets.forEach(function (t) { var r = t.el.getBoundingClientRect(); if (r.top < w.innerHeight * 0.95 && r.bottom > 0) showRv(t, false); }); };
    w.addEventListener('scroll', sweep, { passive: true });
    setTimeout(sweep, 1500);
  }

  /* Accordions: one row open at a time; the first starts open. Heights animate for 300ms. Without this script every row stays expanded. */
  [].forEach.call(d.querySelectorAll('[data-acc]'), function (rootEl) {
    var items = [].slice.call(rootEl.querySelectorAll('.acc-item'));
    var fit = function (item) { var body = item.querySelector('.acc-body'); if (body) body.style.height = item.classList.contains('open') ? body.firstElementChild.offsetHeight + 'px' : '0px'; };
    var setOpen = function (item, open) { item.classList.toggle('open', open); var btn = item.querySelector('button'); if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false'); fit(item); };
    rootEl.classList.add('js-acc'); d.documentElement.classList.add('js-acc');
    items.forEach(function (item, n) {
      setOpen(item, n === 0);
      var btn = item.querySelector('button');
      if (btn) btn.addEventListener('click', function () {
        var was = item.classList.contains('open');
        items.forEach(function (o) { setOpen(o, false); });
        setOpen(item, !was);
      });
    });
    w.addEventListener('resize', function () { items.forEach(fit); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { items.forEach(fit); });
  });
  /* Status: ONE small read of the cached summary per page load (the same read feeds the footer dot and the /status page),
     refreshed at most every 5 minutes while the page is open. It never calls a ping address or a third-party source. */
  var stFoot = [].slice.call(d.querySelectorAll('[data-status]')), stPage = d.getElementById('stGroups');
  if ((stFoot.length || stPage) && w.fetch) {
    var ST = { data: null, failed: false, subs: [], at: 0, busy: false };
    var stLoad = function () {
      if (ST.busy) return; ST.busy = true;
      w.fetch('https://usihrcucnreecynewgbd.supabase.co/rest/v1/rpc/status_public', { method: 'POST', headers: { apikey: 'sb_publishable_rFlNj3ZOQtyO-CTftzUhwQ_l9dkfFjM', 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('status'); return r.json(); })
        .then(function (j) { ST.data = j; ST.failed = false; })
        .catch(function () { ST.failed = true; })
        .then(function () { ST.busy = false; ST.at = Date.now(); ST.subs.forEach(function (f) { f(ST); }); });
    };
    w.dlStatus = { on: function (f) { ST.subs.push(f); if (ST.at) f(ST); } };
    var LABEL = { operational: 'Servers up', degraded: 'Degraded', down: 'Servers down', maintenance: 'Maintenance', unknown: 'Status unavailable' };
    w.dlStatus.on(function (s) {
      var st = !s.data ? 'unknown' : (s.data.overall || 'unknown');
      stFoot.forEach(function (a) {
        a.setAttribute('data-state', st);
        a.querySelector('span').textContent = LABEL[st] || LABEL.unknown;
        a.classList.remove('pending');
      });
    });
    stLoad();
    setInterval(function () { if (!d.hidden) stLoad(); }, 300000);
    d.addEventListener('visibilitychange', function () { if (!d.hidden && Date.now() - ST.at > 300000) stLoad(); });
  }
})();
