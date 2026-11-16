/* Daylight /status page. Renders the one cached summary that landing.js reads (window.dlStatus); it never calls a ping address or a
   third-party source, and every value on the page comes from that summary. Times show in the visitor's local timezone. */
(function () {
  var d = document, w = window;
  var $ = function (id) { return d.getElementById(id); };
  var TITLE = {
    operational: ['All systems operational', 'Everything in Daylight is working normally.'],
    degraded: ['Degraded performance', 'Some services are slower than usual or reporting problems.'],
    down: ['Service outage', 'One or more services are not responding.'],
    maintenance: ['Maintenance in progress', 'Scheduled maintenance is under way. Affected services are marked below.'],
    unknown: ['Status unavailable', 'The latest status could not be loaded.']
  };
  var LABEL = { up: 'Operational', degraded: 'Degraded', down: 'Down', maintenance: 'Maintenance', unknown: 'Unknown' };
  var el = function (tag, cls, text) { var n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  var dt = function (iso) { return iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };
  var dur = function (a, b) {
    var m = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
    if (m < 1) return 'under a minute';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h < 24 ? h + ' h' + (r ? ' ' + r + ' min' : '') : Math.floor(h / 24) + ' d ' + (h % 24) + ' h';
  };
  var barColor = function (u) { return u == null ? '' : u >= 99.5 ? 'var(--s-up)' : u >= 95 ? 'var(--s-deg)' : 'var(--s-down)'; };
  var pct = function (u) { return u == null ? '—' : (u >= 99.995 ? '100' : u.toFixed(2).replace(/0$/, '')) + '%'; };

  var tip = $('stTip');
  var showTip = function (e, text) {
    tip.textContent = text; tip.hidden = false;
    var r = e.target.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(r.left + r.width / 2, 70), w.innerWidth - 70) + 'px';
    tip.style.top = (r.top - 8) + 'px';
  };
  d.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip({ target: t }, t.getAttribute('data-tip')); else tip.hidden = true; });
  w.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });

  function render(s) {
    var data = s.data;
    var title = $('stTitle'), sub = $('stSub'), upd = $('stUpd');
    if (!data) {
      title.setAttribute('data-state', 'unknown'); title.lastChild.textContent = TITLE.unknown[0];
      sub.textContent = 'We could not load the latest status. Try again in a moment.'; upd.textContent = '';
      return;
    }
    var st = data.overall || 'unknown', t = TITLE[st] || TITLE.unknown;
    title.setAttribute('data-state', st); title.lastChild.textContent = t[0];
    sub.textContent = t[1];
    var last = data.last_run_at, stale = !last || (new Date(data.now) - new Date(last)) > 20 * 60000;
    upd.textContent = '';
    if (last) {
      upd.appendChild(d.createTextNode('Updated ' + dt(last) + ', checks run every 5 minutes'));
      if (stale || s.failed) upd.appendChild(el('b', '', ' · Showing the last known state; the checker has not reported recently.'));
    } else upd.textContent = 'No checks have run yet.';
    if (s.failed) { upd.textContent = (last ? 'Last known state from ' + dt(last) + '. ' : '') + 'The latest read failed; showing what we have.'; }

    var svcs = data.services || [];
    // stats: everything is computed from the summary
    var ups = svcs.filter(function (x) { return x.uptime != null; }), mss = svcs.filter(function (x) { return x.ms != null; });
    $('sUp').textContent = ups.length ? pct(ups.reduce(function (a, x) { return a + x.uptime; }, 0) / ups.length) : '—';
    $('sSv').textContent = svcs.filter(function (x) { return x.state === 'up'; }).length + '/' + svcs.length;
    $('sMs').textContent = mss.length ? Math.round(mss.reduce(function (a, x) { return a + x.ms; }, 0) / mss.length) + ' ms' : '—';
    var inc = data.incidents || [], open = inc.filter(function (x) { return !x.ended; }).length;
    $('sIn').textContent = String(inc.length);
    $('sInS').textContent = 'last 30 days' + (inc.length ? ', ' + open + ' open' : '');
    $('stStats').hidden = false;

    // groups, in the order the summary lists them
    var host = $('stGroups'); host.textContent = '';
    var order = [], by = {};
    svcs.forEach(function (x) { if (!by[x.group]) { by[x.group] = []; order.push(x.group); } by[x.group].push(x); });
    var from = new Date((data.bars_from || '') + 'T00:00:00Z');
    order.forEach(function (g) {
      var sec = el('section', 'st-group'); sec.appendChild(el('h2', '', g));
      var card = el('div', 'st-card');
      by[g].forEach(function (x) {
        var row = el('div', 'st-row'), top = el('div', 'st-top');
        var name = el('div', 'st-name'); name.appendChild(el('b', '', x.name)); name.appendChild(el('small', '', x.desc));
        var stt = el('div', 'st-state'); stt.setAttribute('data-state', x.state); stt.appendChild(el('i', 'sdot')); stt.appendChild(el('span', '', LABEL[x.state] || 'Unknown'));
        var up = el('div', 'st-num'); up.appendChild(el('b', '', pct(x.uptime))); up.appendChild(d.createTextNode('30 days'));
        var ms = el('div', 'st-num'); ms.appendChild(el('b', '', x.ms != null ? x.ms + ' ms' : '—')); ms.appendChild(d.createTextNode('response'));
        top.appendChild(name); top.appendChild(stt); top.appendChild(up); top.appendChild(ms);
        var bars = el('div', 'st-bars'); bars.setAttribute('aria-hidden', 'true');
        (x.bars || []).forEach(function (u, n) {
          var day = new Date(from.getTime() + n * 86400000);
          var b = el('i'); if (u != null) b.style.setProperty('--bc', barColor(u));
          b.setAttribute('data-tip', day.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' · ' + (u == null ? 'No data' : pct(u) + ' uptime'));
          bars.appendChild(b);
        });
        row.appendChild(top); row.appendChild(bars); card.appendChild(row);
      });
      sec.appendChild(card); host.appendChild(sec);
    });

    // scheduled maintenance
    var mt = data.maintenance || [], msec = $('stMaintSec'), mhost = $('stMaint');
    msec.hidden = false; mhost.textContent = '';
    if (!mt.length) mhost.appendChild(el('div', 'st-empty', 'No maintenance is scheduled.'));
    mt.forEach(function (m) {
      var it = el('div', 'st-item'), b = el('b', '', m.title);
      if (m.active) b.appendChild(el('span', 'live', 'In progress'));
      it.appendChild(b);
      if (m.desc) it.appendChild(el('p', '', m.desc));
      var chips = el('div', 'st-chips'); (m.services || []).forEach(function (n) { chips.appendChild(el('span', '', n)); }); it.appendChild(chips);
      it.appendChild(el('div', 'st-meta', dt(m.starts) + ' – ' + dt(m.ends)));
      mhost.appendChild(it);
    });

    // past incidents
    var isec = $('stIncSec'), ihost = $('stInc');
    isec.hidden = false; ihost.textContent = '';
    if (!inc.length) ihost.appendChild(el('div', 'st-empty', 'No incidents in the last 30 days.'));
    inc.forEach(function (i) {
      var it = el('div', 'st-item'); it.appendChild(el('b', '', i.name));
      it.appendChild(el('div', 'st-meta', 'Started ' + dt(i.started) + (i.ended ? ' · Ended ' + dt(i.ended) + ' · ' + dur(i.started, i.ended) : ' · Ongoing')));
      ihost.appendChild(it);
    });
    $('stRegion').textContent = data.region ? 'Checked from ' + data.region + '. All times shown in your local timezone.' : 'All times shown in your local timezone.';
  }
  if (w.dlStatus) w.dlStatus.on(render);
})();
