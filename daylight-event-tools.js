/* Event tools: Select mode (bulk move / delete in Search and Agenda) and photo attachments. They plug into the existing surfaces through small hooks in index.html. */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function mk(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  var CHECK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.4 6.3l2.4 2.4 4.8-5.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var css = document.createElement("style");
  css.textContent = [
    ".dl-checkbox.is-on .dl-cb-box{background:var(--text);border-color:var(--text)}.dl-checkbox.is-on .dl-cb-box svg path{stroke-dashoffset:0;opacity:1}",
    ".dl-selrow{display:flex;align-items:center;justify-content:flex-end;padding:6px 14px 0}",
    ".dl-selrow .btn-ghost{height:32px;padding:0 12px;font-size:13px}",
    ".dl-sel-cb{flex:none;margin-right:12px;pointer-events:none}",
    ".dl-selecting .agenda-card,.dl-selecting .pal-item{cursor:pointer}",
    ".dl-selecting .is-picked{background:color-mix(in srgb,var(--accent) 9%,transparent)}",
    ".dl-selbar{display:flex;align-items:center;gap:8px;margin:8px 14px 12px;padding:8px 10px 8px 16px;border-radius:12px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-pop);animation:dl-overlay-show .19s cubic-bezier(.23,1,.32,1) both;position:sticky;bottom:12px;z-index:3}",
    ".dl-selbar .dl-sel-count{flex:1;font-size:13.5px;font-weight:600;min-width:0;white-space:nowrap}",
    ".dl-selbar button{height:34px;padding:0 14px;font-size:13px;white-space:nowrap}",
    ".dl-selbar button:disabled{opacity:var(--dl-disabled-opacity,.55);cursor:default}",
    "@media (max-width:560px){.dl-selbar{flex-wrap:wrap}.dl-selbar .dl-sel-count{flex-basis:100%}}",
    "body.reduce-motion .dl-selbar{animation:none!important}",
    "body.dl-selecting .palette-results,body.dl-selecting .agenda-inner{padding-bottom:88px}",
  ].join("\n");
  document.head.appendChild(css);

  /* ===================================================================== Select mode */
  var sel = { surface: null, picked: [], rerender: null, host: null };
  function editable(ev) { try { return !isReadOnlyEvent(ev) && !ev.feedSubscriptionId && !ev.feedShareId && !ev.feedEventShareId && String(ev.cal).indexOf("share:") !== 0 && String(ev.cal).indexOf("evs:") !== 0 && ev.cal !== "holidays" && !(ev.builtin); } catch (e) { return true; } }
  function ownedCals() { return state.calendars.filter(function (c) { return typeof isOwnedCalendar === "function" ? isOwnedCalendar(c) : (!c.subscribed && !c.remoteShareId); }); }
  function count() { return sel.picked.length; }
  function refreshBar() {
    document.querySelectorAll(".dl-selbar").forEach(function (bar) {
      var n = count();
      bar.querySelector(".dl-sel-count").textContent = n + " selected";
      bar.querySelectorAll("[data-needs]").forEach(function (b) { b.disabled = n === 0; });
    });
  }
  function exit() {
    var was = sel.surface; sel.surface = null; sel.picked = [];
    document.body.classList.remove("dl-selecting");
    if (was && sel.rerender) sel.rerender();
  }
  function bar() {
    var b = mk('<div class="dl-selbar" role="toolbar" aria-label="Selected events"><span class="dl-sel-count" aria-live="polite">0 selected</span>' +
      '<button type="button" class="btn-ghost" data-move data-needs aria-haspopup="menu">Move to calendar…</button>' +
      '<button type="button" class="btn-danger-outline" data-del data-needs>Delete</button>' +
      '<button type="button" class="btn-primary" style="margin-left:0" data-done>Done</button></div>');
    b.querySelector("[data-done]").addEventListener("click", exit);
    b.querySelector("[data-move]").addEventListener("click", function () {
      var anchor = this, list = ownedCals();
      openMenu(anchor, [{ label2: "Move to calendar" }].concat(list.map(function (c) {
        return { label: c.name, title: c.name, dot: dotOf(c), fn: function () { moveTo(c); } };
      })), { above: true });
    });
    b.querySelector("[data-del]").addEventListener("click", function () {
      var n = count(); if (!n) return;
      openConfirm({ title: "Delete " + n + (n === 1 ? " event?" : " events?"), body: "This can’t be undone. You can undo right after.", confirmLabel: "Delete", danger: true, fn: function () {
        var list = sel.picked.slice(); sel.picked = [];
        window.daylightDeleteEvents(list);
        exit();
      } });
    });
    refreshBarSoon();
    return b;
  }
  function refreshBarSoon() { setTimeout(refreshBar, 0); }
  function moveTo(cal) {
    var list = sel.picked.slice(); if (!list.length) return;
    list.forEach(function (e) { e.cal = cal.id; });
    sel.picked = [];
    renderAll(false); renderSidebar();
    if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
    toast(list.length === 1 ? "Event moved to " + cal.name : list.length + " events moved to " + cal.name);
    exit();
  }
  window.daylightSelect = {
    active: function (surface) { return sel.surface === surface; },
    /* the "Select" button row (or nothing while selecting) */
    entry: function (surface, rerender) {
      if (sel.surface === surface) return null;
      var row = mk('<div class="dl-selrow"><button type="button" class="btn-ghost" data-select>Select</button></div>');
      row.querySelector("button").addEventListener("click", function () {
        sel.surface = surface; sel.picked = []; sel.rerender = rerender;
        document.body.classList.add("dl-selecting");
        rerender();
      });
      return row;
    },
    bar: function (surface) { return sel.surface === surface ? bar() : null; },
    /* a result row in Select mode: premium checkbox on the left, tap toggles; returns true when the row was handled */
    decorate: function (row, ev, surface) {
      if (sel.surface !== surface) return false;
      var ok = editable(ev);
      var on = sel.picked.indexOf(ev) !== -1;
      var cb = mk('<span class="dl-checkbox dl-sel-cb' + (on ? " is-on" : "") + '"><span class="dl-cb-box">' + CHECK + "</span></span>");
      if (!ok) cb.style.opacity = "var(--dl-disabled-opacity,.55)";
      row.insertBefore(cb, row.firstChild);
      row.setAttribute("role", "checkbox"); row.setAttribute("aria-checked", String(on));
      if (on) row.classList.add("is-picked");
      row.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (!ok) { toast("This event can’t be changed — it comes from a calendar you don’t own."); return; }
        var i = sel.picked.indexOf(ev);
        if (i === -1) sel.picked.push(ev); else sel.picked.splice(i, 1);
        var now = i === -1;
        cb.classList.toggle("is-on", now); row.classList.toggle("is-picked", now); row.setAttribute("aria-checked", String(now));
        refreshBar();
      }, true);
      return true;
    },
    exit: exit
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sel.surface && !document.querySelector(".menu,.backdrop")) { e.preventDefault(); e.stopPropagation(); exit(); }
  }, true);

  /* ===================================================================== Attachments (photos and PDFs, each with an optional caption) */
  (function () {
    var BUCKET = "event-attachments", MAX = 10, MAXBYTES = 10 * 1024 * 1024;
    var acss = document.createElement("style");
    acss.textContent = [
      ".dl-attach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:10px 8px;align-items:start}",
      ".dl-att-item{min-width:0;display:flex;flex-direction:column;gap:5px}",
      ".dl-att-cap{font-size:12px;line-height:1.35;color:var(--muted);overflow-wrap:anywhere}",
      ".dl-att-capwrap[hidden]{display:none}",
      ".dl-att-capwrap{display:flex;align-items:flex-start;gap:3px;min-width:0}.dl-att-capwrap .dl-att-cap{flex:1;min-width:0;padding-top:2px}",
      ".dl-att-pencil{flex:none;width:22px;height:22px;border-radius:7px;display:inline-grid;place-items:center;color:var(--faint);border:0;padding:0;cursor:pointer;transition:background 150ms var(--dl-ease-out),color 150ms var(--dl-ease-out),transform 150ms var(--dl-ease-out)}",
      ".dl-att-pencil:hover{background:var(--hover);color:var(--text)}.dl-att-pencil:active{transform:scale(.92)}.dl-att-pencil:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",
      ".dl-att-pencil.is-add{width:auto;gap:4px;padding:0 8px 0 6px;font-size:11.5px;font-weight:550;color:var(--faint)}",
      ".dl-att-capin{width:100%;height:28px;border:1px solid var(--line);border-radius:8px;background:var(--input-bg);color:var(--text);font:inherit;font-size:12px;padding:0 8px;outline:none;transition:border-color 140ms var(--dl-ease-out),box-shadow 140ms var(--dl-ease-out)}",
      ".dl-att-capin::placeholder{color:var(--faint)}.dl-att-capin:focus{border-color:color-mix(in srgb,var(--accent) 55%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 14%,transparent)}",
      ".dl-attach-tile{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:var(--hover);border:1px solid var(--line-soft);padding:0;display:block;width:100%;cursor:zoom-in;transition:transform 160ms var(--dl-ease-out),border-color 160ms var(--dl-ease-out)}",
      ".dl-attach-tile:hover{border-color:var(--line)}.dl-attach-tile:active{transform:scale(.98)}",
      ".dl-attach-tile img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity 200ms var(--dl-ease-out)}.dl-attach-tile img.is-in{opacity:1}",
      ".dl-attach-tile:focus-visible,.dl-att-pdf:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
      /* a PDF is a tile like a photo: its first page is the preview; click to open the viewer */
      ".dl-att-pdf{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#fff;border:1px solid var(--line-soft);padding:0;display:block;width:100%;cursor:zoom-in;transition:transform 160ms var(--dl-ease-out),border-color 160ms var(--dl-ease-out)}",
      ".dl-att-pdf:hover{border-color:var(--line)}.dl-att-pdf:active{transform:scale(.98)}",
      ".dl-att-pdf img{width:100%;height:100%;object-fit:cover;object-position:top;display:block;opacity:0;transition:opacity 200ms var(--dl-ease-out)}.dl-att-pdf img.is-in{opacity:1}",
      ".dl-att-pdf .pdf-ph{position:absolute;inset:0;display:grid;place-items:center;color:#9aa0a6;font-size:11px;font-weight:700;letter-spacing:.06em;background:var(--hover)}.dl-att-pdf.has-thumb .pdf-ph{display:none}",
      ".dl-att-pdf .pdf-badge{position:absolute;left:6px;bottom:6px;padding:1px 6px;border-radius:5px;background:#D93025;color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.04em}",
      ".dl-att-name{font-size:11.5px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dl-attach-x{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(18,18,18,.74);color:#fff;border:0;padding:0;cursor:pointer;transition:background 140ms var(--dl-ease-out),transform 140ms var(--dl-ease-out)}",
            ".dl-attach-x:hover{background:rgba(18,18,18,.92)}.dl-attach-x:active{transform:scale(.92)}",
      ".dl-attach-field{margin:0 0 14px}.dl-attach-field[hidden]{display:none}",
      ".dl-attach-h{font-size:13px;font-weight:550;margin:0 0 8px}.dl-attach-note{display:block;font-size:12px;color:var(--faint);margin-top:6px}.dl-attach-note:empty{display:none}",
      ".dl-desc-tools{position:absolute;right:0;top:-3px;display:flex;align-items:center;gap:2px}",
      ".dl-desc-tools .dl-attach-inline{position:static}",
      ".dl-attach-inline{position:absolute;right:0;top:-3px;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:8px;font-size:12.5px;font-weight:550;color:var(--muted);transition:background 150ms var(--dl-ease-out),color 150ms var(--dl-ease-out)}",
      ".dl-attach-inline:hover:not(:disabled){background:var(--hover);color:var(--text)}.dl-attach-inline:disabled{opacity:var(--dl-disabled-opacity,.55)}",
      ".pop-attach{margin-top:14px;padding-top:12px;border-top:1px solid var(--line-soft)}",
      ".pop-attach-h{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 8px}",
      ".popover .pop-attach{margin-left:2px;margin-right:2px}",
      /* the preview overlay (photos) and the PDF viewer share one style */
      ".dl-lightbox{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;background:rgba(0,0,0,.82);animation:dl-backdrop-show .16s cubic-bezier(.23,1,.32,1) both}",
      ".dl-lightbox .lb-frame{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:92vw}",
      ".dl-lightbox .lb-cap{max-width:min(92vw,900px);text-align:center;color:#fff;font-size:14px;font-weight:550;line-height:1.4;text-shadow:0 1px 8px rgba(0,0,0,.5)}.dl-lightbox .lb-cap:empty{display:none}",
      ".dl-lightbox img{max-width:min(92vw,1200px);max-height:80vh;border-radius:12px;box-shadow:var(--shadow-pop);animation:dl-overlay-show .19s cubic-bezier(.23,1,.32,1) both}",
      ".dl-lightbox .lb-btn{position:absolute;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);color:#fff;border:0;cursor:pointer;transition:background 150ms var(--dl-ease-out)}",
      ".dl-lightbox .lb-btn:hover{background:rgba(255,255,255,.26)}.dl-lightbox .lb-close{top:18px;right:18px}.dl-lightbox .lb-prev{left:18px;top:50%;margin-top:-20px}.dl-lightbox .lb-next{right:18px;top:50%;margin-top:-20px}",
      ".dl-lightbox .lb-count{position:absolute;bottom:16px;left:0;right:0;text-align:center;color:rgba(255,255,255,.8);font-size:12.5px}",
      ".dl-lightbox.is-pdf .lb-frame{width:min(880px,92vw)}",
      ".dl-lightbox .lb-pages{width:100%;max-height:78vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth;border-radius:12px}",
      ".dl-lightbox .lb-page{display:block;width:100%;height:auto;background:#fff;border-radius:12px;box-shadow:var(--shadow-pop)}",
      ".dl-lightbox [hidden]{display:none!important}",
      ".dl-lightbox .lb-loading{min-height:min(60vh,520px);display:grid;place-items:center;align-content:center;gap:14px;color:rgba(255,255,255,.8);font-size:13px}",
      ".dl-lightbox .lb-spin{width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.18);border-top-color:#fff;animation:dlLbSpin .8s linear infinite}@keyframes dlLbSpin{to{transform:rotate(360deg)}}",
      ".dl-lightbox .lb-page.is-ph{opacity:0}.dl-lightbox .lb-page{transition:opacity 220ms var(--dl-ease-out)}",
      ".dl-lightbox .lb-error{min-height:220px;display:grid;place-items:center;align-content:center;gap:8px;text-align:center;color:#fff;padding:26px 18px;border-radius:12px;background:rgba(255,255,255,.08)}.dl-lightbox .lb-error b{font-size:15px}.dl-lightbox .lb-error span{font-size:13px;color:rgba(255,255,255,.75)}",
      ".dl-lightbox .lb-note{color:rgba(255,255,255,.85);font-size:13px;text-align:center;padding:24px 0}",
      ".dl-lightbox .lb-bar{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}",
      ".dl-lightbox .lb-link{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 13px;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font-size:12.5px;font-weight:550;text-decoration:none;transition:background 150ms var(--dl-ease-out)}.dl-lightbox .lb-link:hover{background:rgba(255,255,255,.26)}",
      "body.reduce-motion .dl-lightbox .lb-spin{animation-duration:2.4s!important}body.reduce-motion .dl-lightbox,body.reduce-motion .dl-lightbox img,body.reduce-motion .dl-lightbox .lb-pages,body.reduce-motion .dl-attach-tile img{animation:none!important;transition:none!important}"
    ].join("\n");
    document.head.appendChild(acss);

    function cloud() { return window.daylightCloud; }
    function db() { var c = cloud(); return c && c.client; }
    function uid() { var c = cloud(); return c && c.user && c.user.id; }
    function isPdf(m) { return !!m && (m.type === "application/pdf" || /\.pdf$/i.test(m.name || "")); }
    var signed = Object.create(null);
    function sign(paths) {
      var need = paths.filter(function (p) { return p && (!signed[p] || signed[p].exp < Date.now()); });
      if (!need.length || !db()) return Promise.resolve();
      return db().storage.from(BUCKET).createSignedUrls(need, 3600).then(function (r) {
        (r.data || []).forEach(function (row) { if (row && row.path && row.signedUrl) signed[row.path] = { url: row.signedUrl, exp: Date.now() + 3300 * 1000 }; });
      }).catch(function () {});
    }
    function urlOf(path) { return signed[path] && signed[path].url || ""; }
    function keyOf(m) { return m.path || m.copyFrom; }
    /* PDF rendering: pdf.js is loaded the first time a PDF has to be drawn (preview or viewer) */
    var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/", pdfLoad = null;
    function loadPdfJs() {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (pdfLoad) return pdfLoad;
      pdfLoad = new Promise(function (resolve, reject) {
        var s = document.createElement("script"); s.src = PDFJS + "pdf.min.js"; s.async = true;
        s.onload = function () { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; resolve(window.pdfjsLib); } catch (e) { reject(e); } };
        s.onerror = function () { pdfLoad = null; reject(new Error("pdf.js failed to load")); };
        document.head.appendChild(s);
      });
      return pdfLoad;
    }
    function pdfBytes(m) {
      if (m._file) return m._file.arrayBuffer();
      var key = keyOf(m);
      return sign([key]).then(function () { var u = urlOf(key); if (!u) throw new Error("no url"); return fetch(u).then(function (r) { return r.arrayBuffer(); }); });
    }
    function openPdfDoc(m) { return Promise.all([loadPdfJs(), pdfBytes(m)]).then(function (x) { return x[0].getDocument({ data: new Uint8Array(x[1]) }).promise; }); }
    var thumbs = Object.create(null);
    /* the first page, drawn small, as the preview inside the box */
    function pdfThumb(m) {
      var k = keyOf(m) || m.name; if (m._file) k = "file:" + m.name + ":" + m.size;
      if (thumbs[k]) return thumbs[k];
      thumbs[k] = openPdfDoc(m).then(function (doc) { return doc.getPage(1); }).then(function (page) {
        var v0 = page.getViewport({ scale: 1 }), scale = 260 / v0.width, v = page.getViewport({ scale: scale });
        var c = document.createElement("canvas"); c.width = Math.round(v.width); c.height = Math.round(v.height);
        return page.render({ canvasContext: c.getContext("2d"), viewport: v }).promise.then(function () { return c.toDataURL("image/jpeg", 0.82); });
      });
      thumbs[k].catch(function () { delete thumbs[k]; });
      return thumbs[k];
    }
    function sizeLabel(n) { n = Number(n) || 0; return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : n > 1024 ? Math.round(n / 1024) + " KB" : n ? n + " B" : ""; }
    /* one attachment: [caption above] + photo tile or PDF card (+ remove in the editor) */
    function item(meta, opts) {
      opts = opts || {};
      var pdf = isPdf(meta);
      var wrap = mk('<div class="dl-att-item' + (pdf ? " is-pdf" : "") + '"></div>');
      /* where a caption would sit (above the attachment) a PDF shows its file name; photos show nothing */
      if (pdf) { var nameAbove = mk('<div class="dl-att-cap"></div>'); nameAbove.textContent = meta.name || "document.pdf"; wrap.appendChild(nameAbove); }
      var el;
      if (pdf) {
        el = mk('<button type="button" class="dl-att-pdf" aria-label="Open PDF ' + esc(meta.name || "") + '"><span class="pdf-ph" aria-hidden="true">PDF</span><img alt=""><span class="pdf-badge" aria-hidden="true">PDF</span></button>');
        var pimg = el.querySelector("img");
        pimg.addEventListener("load", function () { pimg.classList.add("is-in"); el.classList.add("has-thumb"); });
        pdfThumb(meta).then(function (url) { pimg.src = url; }).catch(function () {});
      } else {
        el = mk('<button type="button" class="dl-attach-tile" aria-label="' + esc(meta.name || "Photo") + '"><img alt=""></button>');
        var img = el.querySelector("img");
        img.addEventListener("load", function () { img.classList.add("is-in"); });
        img.addEventListener("error", function () { img.remove(); el.style.display = "grid"; el.style.placeItems = "center"; el.textContent = "Photo"; el.style.color = "var(--faint)"; el.style.fontSize = "12px"; });
        if (meta._local) img.src = meta._local;
        else { var key = keyOf(meta); sign([key]).then(function () { var u = urlOf(key); if (u) img.src = u; else img.dispatchEvent(new Event("error")); }); }
      }
      if (opts.onRemove) {
        var x = mk('<button type="button" class="dl-attach-x" aria-label="Remove attachment" title="Remove attachment">' + icon("x", 12) + "</button>");
        x.addEventListener("click", function (e) { e.stopPropagation(); opts.onRemove(); });
        el.appendChild(x);
      }
      el.addEventListener("click", function () { if (opts.onOpen) opts.onOpen(); });
      wrap.appendChild(el);
      if (wrap.__after) wrap.appendChild(wrap.__after);
      return wrap;
    }
    /* the in-app larger preview (photos only: arrows move between photos); the caption sits above the image */
    function lightbox(metas, at) {
      var i = at, box = mk('<div class="dl-lightbox" role="dialog" aria-modal="true" aria-label="Photo preview"><div class="lb-frame"><div class="lb-cap"></div><img alt=""></div><button class="lb-btn lb-close" aria-label="Close">' + icon("x", 18) + '</button><button class="lb-btn lb-prev" aria-label="Previous photo">' + icon("chevL", 20) + '</button><button class="lb-btn lb-next" aria-label="Next photo">' + icon("chevR", 20) + '</button><div class="lb-count"></div></div>');
      var img = box.querySelector("img");
      function show() {
        var m = metas[i], key = keyOf(m);
        function put() { img.src = m._local || urlOf(key); }
        if (m._local) put(); else sign([key]).then(put);
        box.querySelector(".lb-cap").textContent = "";
        box.querySelector(".lb-count").textContent = metas.length > 1 ? (i + 1) + " of " + metas.length : (m.name || "");
        box.querySelector(".lb-prev").style.display = box.querySelector(".lb-next").style.display = metas.length > 1 ? "" : "none";
      }
      function close() { document.removeEventListener("keydown", onKey, true); if (window.daylightExit) window.daylightExit(box); else box.remove(); }
      function go(d) { i = (i + d + metas.length) % metas.length; show(); }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1);
      }
      box.querySelector(".lb-close").addEventListener("click", close);
      box.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); go(-1); });
      box.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); go(1); });
      box.addEventListener("mousedown", function (e) { if (e.target === box) close(); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(box); show();
      box.querySelector(".lb-close").focus();
    }
    /* The PDF viewer: the same overlay as the photo preview (caption above, close, previous / next, "n of N"), showing the PDF's pages one under the other. */
    function pdfViewer(m) {
      var key = keyOf(m);
      var box = mk('<div class="dl-lightbox is-pdf" role="dialog" aria-modal="true" aria-label="PDF viewer"><div class="lb-frame"><div class="lb-cap"></div><div class="lb-pages" tabindex="0" aria-busy="true"><div class="lb-loading"><span class="lb-spin" aria-hidden="true"></span><span>Loading…</span></div></div>' +
        '<div class="lb-bar" hidden><a class="lb-link" data-newtab target="_blank" rel="noopener">Open in new tab</a><a class="lb-link" data-download>Download</a></div></div>' +
        '<button class="lb-btn lb-close" aria-label="Close">' + icon("x", 18) + '</button><button class="lb-btn lb-prev" aria-label="Previous page" hidden>' + icon("chevL", 20) + '</button><button class="lb-btn lb-next" aria-label="Next page" hidden>' + icon("chevR", 20) + '</button><div class="lb-count"></div></div>');
      box.querySelector(".lb-cap").textContent = m.name || "";
      var scroller = box.querySelector(".lb-pages"), pages = [], cur = 0, doc = null;
      function close() { document.removeEventListener("keydown", onKey, true); if (doc && doc.destroy) { try { doc.destroy(); } catch (e) {} } if (window.daylightExit) window.daylightExit(box); else box.remove(); }
      function setCount() { box.querySelector(".lb-count").textContent = pages.length > 1 ? "Page " + (cur + 1) + " of " + pages.length : (m.name || ""); }
      function go(d) { var n = Math.max(0, Math.min(pages.length - 1, cur + d)); if (!pages[n]) return; scroller.scrollTo({ top: pages[n].offsetTop - pages[0].offsetTop, behavior: "smooth" }); cur = n; setCount(); }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }
      scroller.addEventListener("scroll", function () {
        var top = scroller.scrollTop + scroller.clientHeight / 3, idx = 0;
        for (var i = 0; i < pages.length; i++) { if (pages[i].offsetTop - pages[0].offsetTop <= top) idx = i; }
        if (idx !== cur) { cur = idx; setCount(); }
      });
      box.querySelector(".lb-close").addEventListener("click", close);
      box.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); go(-1); });
      box.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); go(1); });
      box.addEventListener("mousedown", function (e) { if (e.target === box) close(); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(box);
      box.querySelector(".lb-close").focus();
      function fallback() {
        scroller.setAttribute("aria-busy", "false");
        scroller.innerHTML = '<div class="lb-error"><b>This PDF couldn’t be shown here</b><span>You can still open it in a new tab or download it.</span></div>';
        sign([key]).then(function () {
          var u = m._file ? URL.createObjectURL(m._file) : urlOf(key); if (!u) return;
          var bar = box.querySelector(".lb-bar"), nt = bar.querySelector("[data-newtab]"), dl = bar.querySelector("[data-download]");
          nt.href = u; dl.href = u; dl.setAttribute("download", m.name || "document.pdf"); bar.hidden = false;
        });
      }
      openPdfDoc(m).then(function (d) {
        doc = d;
        return d.getPage(1).then(function (first) {
          var v1 = first.getViewport({ scale: 1 }), width = scroller.clientWidth || 800, dpr = Math.min(2, window.devicePixelRatio || 1);
          scroller.innerHTML = ""; scroller.setAttribute("aria-busy", "false");
          box.querySelector(".lb-prev").hidden = box.querySelector(".lb-next").hidden = d.numPages < 2;
          /* every page gets its place up front (page 1's proportions), so nothing jumps as pages arrive */
          for (var n = 1; n <= d.numPages; n++) {
            var cv = document.createElement("canvas"); cv.className = "lb-page is-ph"; cv.setAttribute("aria-label", "Page " + n);
            cv.style.aspectRatio = v1.width + " / " + v1.height; cv.width = 2; cv.height = 2;
            scroller.appendChild(cv); pages.push(cv);
          }
          setCount();
          var chain = Promise.resolve();
          pages.forEach(function (cv, idx) {
            chain = chain.then(function () { return d.getPage(idx + 1); }).then(function (page) {
              var v0 = page.getViewport({ scale: 1 }), v = page.getViewport({ scale: (width * dpr) / v0.width });
              cv.width = Math.round(v.width); cv.height = Math.round(v.height); cv.style.aspectRatio = v0.width + " / " + v0.height;
              return page.render({ canvasContext: cv.getContext("2d"), viewport: v }).promise;
            }).then(function () { cv.classList.remove("is-ph"); });
          });
          return chain;
        });
      }).catch(fallback);
    }
    function open(list, idx) {
      var m = list[idx];
      if (isPdf(m)) { pdfViewer(m); return; }
      var photos = list.filter(function (x) { return !isPdf(x); });
      lightbox(photos, photos.indexOf(m));
    }
    function compress(file) {
      return new Promise(function (resolve) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== "function") return resolve(file);
        createImageBitmap(file).then(function (bmp) {
          var max = 1600, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
          var c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
          c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
          c.toBlob(function (blob) { resolve(blob && blob.size < file.size ? blob : file); }, "image/jpeg", 0.86);
        }).catch(function () { resolve(file); });
      });
    }
    function safeName(n) { return String(n || "attachment").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "attachment"; }
    function capOf() { return undefined; }   /* captions are not part of the app */
    function rec(m, blobType, size) { var r = { path: m.path, name: m.name, type: blobType || m.type, size: size != null ? size : m.size }; var c = capOf(m); if (c) r.caption = c; return r; }

    window.daylightAttachments = {
      /* the Attachments group in the Create / Edit form (photos and PDFs, each with an optional caption) */
      mountEditor: function (dlg, f, markDirty) {
        var after = dlg.querySelector("#efDesc"); after = after && after.closest(".field");
        if (!after) return null;
        f.attachments = (f.attachments || []).map(function (m) { return Object.assign({}, m); });
        f._origPaths = f.attachments.filter(function (m) { return m.path; }).map(function (m) { return m.path; });
        f._origCaps = {}; f.attachments.forEach(function (m) { if (m.path) f._origCaps[m.path] = capOf(m) || ""; });
        f._newFiles = [];
        var field = mk('<div class="dl-attach-field" hidden><div class="dl-attach-h">Attachments</div><div class="dl-attach-grid" data-grid></div><span class="dl-attach-note" data-note></span></div>');
        var addBtn = mk('<button type="button" class="dl-attach-inline" data-add>' + icon("plus", 14) + '<span>Add attachments</span></button>');
        var input = mk('<input type="file" accept="image/*,application/pdf,.pdf" multiple hidden>');
        after.style.position = "relative";
        var toolsBox = after.querySelector(".dl-desc-tools");
        if (toolsBox) { toolsBox.appendChild(addBtn); } else { after.appendChild(addBtn); }
        after.appendChild(input);
        after.parentNode.insertBefore(field, after.nextSibling);
        var grid = field.querySelector("[data-grid]"), note = field.querySelector("[data-note]");
        function all() { return f.attachments.concat(f._newFiles); }
        function draw() {
          grid.innerHTML = "";
          var list = all();
          list.forEach(function (m, idx) {
            grid.appendChild(item(m, {
              onRemove: function () {
                if (idx < f.attachments.length) f.attachments.splice(idx, 1); else f._newFiles.splice(idx - f.attachments.length, 1);
                markDirty(); draw();
              },
              onOpen: function () { open(list, idx); }
            }));
          });
          note.textContent = list.length >= MAX ? "Up to " + MAX + " attachments" : "";
          field.hidden = !list.length;
          addBtn.disabled = list.length >= MAX;
        }
        addBtn.addEventListener("click", function () {
          if (!uid()) { toast("Sign in to add attachments to events."); return; }
          input.click();
        });
        input.addEventListener("change", function () {
          var files = Array.prototype.slice.call(input.files || []).filter(function (x) { return /^image\//.test(x.type) || x.type === "application/pdf" || /\.pdf$/i.test(x.name); });
          input.value = "";
          var big = files.filter(function (x) { return x.size > MAXBYTES; });
          if (big.length) toast(big.length === 1 ? "“" + big[0].name + "” is over 10 MB and was skipped." : big.length + " files are over 10 MB and were skipped.");
          files = files.filter(function (x) { return x.size <= MAXBYTES; });
          var room = MAX - all().length;
          if (files.length > room) toast("Only " + MAX + " attachments fit on one event.");
          files.slice(0, Math.max(0, room)).forEach(function (file) {
            var pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
            f._newFiles.push({ _file: file, _local: pdf ? "" : URL.createObjectURL(file), name: file.name, type: pdf ? "application/pdf" : file.type, size: file.size, caption: "" });
          });
          if (files.length) { markDirty(); draw(); }
        });
        draw();
        return { grid: grid };
      },
      /* after the event is saved: remove dropped files, upload new ones, copy duplicated ones; captions ride along; the event itself is already saved */
      commit: function (ev, f) {
        if (!f || f._newFiles == null) return Promise.resolve(false);
        var keep = f.attachments.filter(function (m) { return m.path; });
        var pendingCopies = f.attachments.filter(function (m) { return !m.path && m.copyFrom; });
        var dropped = (f._origPaths || []).filter(function (p) { return !keep.some(function (m) { return m.path === p; }); });
        ev.attachments = keep.map(function (m) { return rec(m); });
        var capsChanged = keep.some(function (m) { return (capOf(m) || "") !== (f._origCaps && f._origCaps[m.path] || ""); });
        var jobs = f._newFiles.length + pendingCopies.length;
        if (!jobs && !dropped.length) return Promise.resolve(capsChanged || keep.length !== (f._origPaths || []).length);
        var me = uid(), client = db();
        if (!me || !client) { if (jobs) toast("Sign in to add attachments to events."); return Promise.resolve(true); }
        var failed = 0, store = client.storage.from(BUCKET);
        var work = Promise.resolve();
        if (dropped.length) work = work.then(function () { return store.remove(dropped.filter(function (p) { return p.indexOf(me + "/") === 0; })); }).catch(function () {});
        f._newFiles.forEach(function (n) {
          work = work.then(function () { return n.type === "application/pdf" ? n._file : compress(n._file); }).then(function (blob) {
            var base = safeName(n.name);
            if (blob.type === "image/jpeg") base = base.replace(/\.(png|webp)$/i, ".jpg");
            var path = me + "/" + ev.id + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "-" + base;
            var ctype = n.type === "application/pdf" ? "application/pdf" : (blob.type || n.type);
            return store.upload(path, blob, { contentType: ctype, upsert: false }).then(function (r) {
              if (r.error) throw r.error;
              ev.attachments.push(rec({ path: path, name: n.name, type: ctype, size: blob.size, caption: n.caption }));
            });
          }).catch(function () { failed++; });
        });
        pendingCopies.forEach(function (m) {
          work = work.then(function () {
            if (m.copyFrom.indexOf(me + "/") !== 0) { failed++; return; }
            var path = me + "/" + ev.id + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "-" + safeName(m.name);
            return store.copy(m.copyFrom, path).then(function (r) {
              if (r.error) throw r.error;
              ev.attachments.push(rec({ path: path, name: m.name, type: m.type, size: m.size, caption: m.caption }));
            });
          }).catch(function () { failed++; });
        });
        return work.then(function () {
          f._newFiles.forEach(function (n) { try { if (n._local) URL.revokeObjectURL(n._local); } catch (e) {} });
          if (failed) toast(failed === 1 ? "One attachment couldn’t be uploaded. The event was saved." : failed + " attachments couldn’t be uploaded. The event was saved.");
          return true;
        });
      },
      /* the popover's "Attachments" group (nothing at all when the event has none); each caption sits above its photo or PDF card */
      renderPopover: function (p, ev) {
        var list = (ev.attachments || []).filter(function (m) { return m && m.path; });
        if (!list.length) return;
        var sec = mk('<div class="pop-attach"><div class="pop-attach-h">Attachments</div><div class="dl-attach-grid"></div></div>');
        var grid = sec.querySelector(".dl-attach-grid");
        list.forEach(function (m, i) {
          grid.appendChild(item(m, { onOpen: function () { open(list, i); } }));
        });
        (p.querySelector(".pop-body") || p).appendChild(sec);
      },
      /* a duplicate gets its own copies of the files, captions included (made when the copy is saved) */
      copy: function (ev) {
        return (ev.attachments || []).filter(function (m) { return m && m.path; }).map(function (m) { var r = { path: null, copyFrom: m.path, name: m.name, type: m.type, size: m.size }; if (capOf(m)) r.caption = capOf(m); return r; });
      },
      /* a deleted event's files are removed once the Undo window has passed (and only if the event did not come back) */
      cleanupLater: function (events) {
        var me = uid(); if (!me || !db()) return;
        var picks = [];
        events.forEach(function (ev) { (ev.attachments || []).forEach(function (m) { if (m && m.path && m.path.indexOf(me + "/") === 0) picks.push({ ev: ev, path: m.path }); }); });
        if (!picks.length) return;
        setTimeout(function () {
          var gone = picks.filter(function (x) { return state.events.indexOf(x.ev) === -1; }).map(function (x) { return x.path; });
          if (gone.length) db().storage.from(BUCKET).remove(gone).catch(function () {});
        }, 6500);
      }
    };
    window.daylightCopyAttachments = window.daylightAttachments.copy;
  })();
})();

/* Round 14: Select mode, photo attachments. */
