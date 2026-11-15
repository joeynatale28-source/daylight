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
     With no active banner the default strip stays. Visitors cannot dismiss it. It refreshes every minute and when the tab returns,
     so an edited, deactivated or deleted banner never lingers. */
  var holder = d.getElementById('banners'), dflt = d.getElementById('stripDefault');
  if (holder && dflt && w.fetch) {
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
      if (!list.length) { holder.appendChild(dflt); return; }
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
    var size = function () {
      var cw = nav.clientWidth;
      nav.style.setProperty('--w-rest', cw + 'px');
      nav.style.setProperty('--w-pill', Math.max(0, Math.min(760, cw - 32)) + 'px');
    };
    size();
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

  /* Accordions. Without this script every row stays expanded. Toggling never scrolls the page. */
  [].forEach.call(d.querySelectorAll('[data-acc]'), function (rootEl) {
    var keepOne = rootEl.getAttribute('data-acc') === 'one';
    var items = [].slice.call(rootEl.querySelectorAll('.acc-item'));
    var set = function (item, open) {
      item.classList.toggle('open', open);
      var btn = item.querySelector('button');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    items.forEach(function (item, n) {
      set(item, keepOne && n === 0);
      var btn = item.querySelector('button');
      if (btn) btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');
        if (keepOne && isOpen) return;
        items.forEach(function (other) { set(other, false); });
        set(item, !isOpen);
      });
    });
    rootEl.classList.add('js-acc');
  });

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
