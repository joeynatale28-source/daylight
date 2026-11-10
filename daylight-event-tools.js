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

  /* ===================================================================== Photo attachments */
  (function () {
    var BUCKET = "event-attachments", MAX = 10;
    var acss = document.createElement("style");
    acss.textContent = [
      ".dl-attach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px}",
      ".dl-attach-tile{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:var(--hover);border:1px solid var(--line-soft);padding:0;display:block;width:100%;cursor:zoom-in;transition:transform 160ms var(--dl-ease-out),border-color 160ms var(--dl-ease-out)}",
      ".dl-attach-tile:hover{border-color:var(--line)}.dl-attach-tile:active{transform:scale(.98)}",
      ".dl-attach-tile img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity 200ms var(--dl-ease-out)}.dl-attach-tile img.is-in{opacity:1}",
      ".dl-attach-tile:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
      ".dl-attach-x{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(18,18,18,.74);color:#fff;border:0;padding:0;cursor:pointer;transition:background 140ms var(--dl-ease-out),transform 140ms var(--dl-ease-out)}",
      ".dl-attach-x:hover{background:rgba(18,18,18,.92)}.dl-attach-x:active{transform:scale(.92)}",
      ".dl-attach-field{margin:0 0 14px}.dl-attach-field[hidden]{display:none}",
      ".dl-attach-h{font-size:13px;font-weight:550;margin:0 0 8px}.dl-attach-note{display:block;font-size:12px;color:var(--faint);margin-top:6px}.dl-attach-note:empty{display:none}",
      ".dl-attach-inline{position:absolute;right:0;top:-3px;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:8px;font-size:12.5px;font-weight:550;color:var(--muted);transition:background 150ms var(--dl-ease-out),color 150ms var(--dl-ease-out)}",
      ".dl-attach-inline:hover:not(:disabled){background:var(--hover);color:var(--text)}.dl-attach-inline:disabled{opacity:var(--dl-disabled-opacity,.55)}",
      ".dl-attach-tile.is-busy::after{content:'';position:absolute;inset:0;background:color-mix(in srgb,var(--surface) 55%,transparent)}",
      ".pop-attach{margin-top:14px;padding-top:12px;border-top:1px solid var(--line-soft)}",
      ".pop-attach-h{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 8px}",
      ".popover .pop-attach{margin-left:2px;margin-right:2px}",
      ".dl-lightbox{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;background:rgba(0,0,0,.82);animation:dl-backdrop-show .16s cubic-bezier(.23,1,.32,1) both}",
      ".dl-lightbox img{max-width:min(92vw,1200px);max-height:86vh;border-radius:12px;box-shadow:var(--shadow-pop);animation:dl-overlay-show .19s cubic-bezier(.23,1,.32,1) both}",
      ".dl-lightbox .lb-btn{position:absolute;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);color:#fff;border:0;cursor:pointer;transition:background 150ms var(--dl-ease-out)}",
      ".dl-lightbox .lb-btn:hover{background:rgba(255,255,255,.26)}.dl-lightbox .lb-close{top:18px;right:18px}.dl-lightbox .lb-prev{left:18px;top:50%;margin-top:-20px}.dl-lightbox .lb-next{right:18px;top:50%;margin-top:-20px}",
      ".dl-lightbox .lb-count{position:absolute;bottom:16px;left:0;right:0;text-align:center;color:rgba(255,255,255,.8);font-size:12.5px}",
      "body.reduce-motion .dl-lightbox,body.reduce-motion .dl-lightbox img,body.reduce-motion .dl-attach-tile img{animation:none!important;transition:none!important}"
    ].join("\n");
    document.head.appendChild(acss);

    function cloud() { return window.daylightCloud; }
    function db() { var c = cloud(); return c && c.client; }
    function uid() { var c = cloud(); return c && c.user && c.user.id; }
    var signed = Object.create(null);
    function sign(paths) {
      var need = paths.filter(function (p) { return p && (!signed[p] || signed[p].exp < Date.now()); });
      if (!need.length || !db()) return Promise.resolve();
      return db().storage.from(BUCKET).createSignedUrls(need, 3600).then(function (r) {
        (r.data || []).forEach(function (row) { if (row && row.path && row.signedUrl) signed[row.path] = { url: row.signedUrl, exp: Date.now() + 3300 * 1000 }; });
      }).catch(function () {});
    }
    function urlOf(path) { return signed[path] && signed[path].url || ""; }
    function tile(meta, opts) {
      opts = opts || {};
      var b = mk('<button type="button" class="dl-attach-tile" aria-label="' + esc(meta.name || "Photo") + '"><img alt=""></button>');
      var img = b.querySelector("img");
      img.addEventListener("load", function () { img.classList.add("is-in"); });
      img.addEventListener("error", function () { img.remove(); b.style.display = "grid"; b.style.placeItems = "center"; b.textContent = "Photo"; b.style.color = "var(--faint)"; b.style.fontSize = "12px"; });
      if (meta._local) img.src = meta._local;
      else {
        var key = meta.path || meta.copyFrom;
        sign([key]).then(function () { var u = urlOf(key); if (u) img.src = u; else img.dispatchEvent(new Event("error")); });
      }
      if (opts.onRemove) {
        var x = mk('<button type="button" class="dl-attach-x" aria-label="Remove photo" title="Remove photo">' + icon("x", 12) + "</button>");
        x.addEventListener("click", function (e) { e.stopPropagation(); opts.onRemove(); });
        b.appendChild(x);
      }
      b.addEventListener("click", function () { if (opts.onOpen) opts.onOpen(); });
      return b;
    }
    /* the in-app larger preview */
    function lightbox(metas, at) {
      var i = at, box = mk('<div class="dl-lightbox" role="dialog" aria-modal="true" aria-label="Photo preview"><img alt=""><button class="lb-btn lb-close" aria-label="Close">' + icon("x", 18) + '</button><button class="lb-btn lb-prev" aria-label="Previous photo">' + icon("chevL", 20) + '</button><button class="lb-btn lb-next" aria-label="Next photo">' + icon("chevR", 20) + '</button><div class="lb-count"></div></div>');
      var img = box.querySelector("img");
      function show() {
        var m = metas[i], key = m.path || m.copyFrom;
        function put() { img.src = m._local || urlOf(key); }
        if (m._local) put(); else sign([key]).then(put);
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
    function safeName(n) { return String(n || "photo").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "photo"; }

    window.daylightAttachments = {
      /* the Attachments group in the Create / Edit form, right under Description */
      mountEditor: function (dlg, f, markDirty) {
        var after = dlg.querySelector("#efDesc"); after = after && after.closest(".field");
        if (!after) return null;
        f.attachments = (f.attachments || []).map(function (m) { return Object.assign({}, m); });
        f._origPaths = f.attachments.filter(function (m) { return m.path; }).map(function (m) { return m.path; });
        f._newFiles = [];
        /* empty state adds no height: the "Add photos" control rides on the Description label row; the Attachments group appears once there are photos */
        var field = mk('<div class="dl-attach-field" hidden><div class="dl-attach-h">Attachments</div><div class="dl-attach-grid" data-grid></div><span class="dl-attach-note" data-note></span></div>');
        var addBtn = mk('<button type="button" class="dl-attach-inline" data-add>' + icon("plus", 14) + '<span>Add photos</span></button>');
        var input = mk('<input type="file" accept="image/*" multiple hidden>');
        after.style.position = "relative"; after.appendChild(addBtn); after.appendChild(input);
        after.parentNode.insertBefore(field, after.nextSibling);
        var grid = field.querySelector("[data-grid]"), note = field.querySelector("[data-note]");
        function all() { return f.attachments.concat(f._newFiles); }
        function draw() {
          grid.innerHTML = "";
          var list = all();
          list.forEach(function (m, idx) {
            grid.appendChild(tile(m, {
              onRemove: function () {
                if (idx < f.attachments.length) f.attachments.splice(idx, 1); else f._newFiles.splice(idx - f.attachments.length, 1);
                markDirty(); draw();
              },
              onOpen: function () { lightbox(list, idx); }
            }));
          });
          note.textContent = list.length >= MAX ? "Up to " + MAX + " photos" : "";
          field.hidden = !list.length;
          addBtn.disabled = list.length >= MAX;
        }
        addBtn.addEventListener("click", function () {
          if (!uid()) { toast("Sign in to add photos to events."); return; }
          input.click();
        });
        input.addEventListener("change", function () {
          var files = Array.prototype.slice.call(input.files || []).filter(function (x) { return /^image\//.test(x.type); });
          input.value = "";
          var room = MAX - all().length;
          if (files.length > room) toast("Only " + MAX + " photos fit on one event.");
          files.slice(0, Math.max(0, room)).forEach(function (file) { f._newFiles.push({ _file: file, _local: URL.createObjectURL(file), name: file.name, type: file.type, size: file.size }); });
          if (files.length) { markDirty(); draw(); }
        });
        draw();
        return { grid: grid };
      },
      /* after the event is saved: remove dropped photos, upload new ones, copy duplicated ones; the event itself is already saved */
      commit: function (ev, f) {
        if (!f || f._newFiles == null) return Promise.resolve(false);
        var keep = f.attachments.filter(function (m) { return m.path; });
        var pendingCopies = f.attachments.filter(function (m) { return !m.path && m.copyFrom; });
        var dropped = (f._origPaths || []).filter(function (p) { return !keep.some(function (m) { return m.path === p; }); });
        ev.attachments = keep.map(function (m) { return { path: m.path, name: m.name, type: m.type, size: m.size }; });
        var jobs = f._newFiles.length + pendingCopies.length;
        if (!jobs && !dropped.length) return Promise.resolve(keep.length !== (f._origPaths || []).length);
        var me = uid(), client = db();
        if (!me || !client) { if (jobs) toast("Sign in to add photos to events."); return Promise.resolve(true); }
        var failed = 0, store = client.storage.from(BUCKET);
        var work = Promise.resolve();
        if (dropped.length) work = work.then(function () { return store.remove(dropped.filter(function (p) { return p.indexOf(me + "/") === 0; })); }).catch(function () {});
        f._newFiles.forEach(function (n) {
          work = work.then(function () { return compress(n._file); }).then(function (blob) {
            var path = me + "/" + ev.id + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "-" + safeName(n.name).replace(/\.(png|webp|heic|heif)$/i, blob.type === "image/jpeg" ? ".jpg" : ".$1");
            return store.upload(path, blob, { contentType: blob.type || n.type, upsert: false }).then(function (r) {
              if (r.error) throw r.error;
              ev.attachments.push({ path: path, name: n.name, type: blob.type || n.type, size: blob.size });
            });
          }).catch(function () { failed++; });
        });
        pendingCopies.forEach(function (m) {
          work = work.then(function () {
            if (m.copyFrom.indexOf(me + "/") !== 0) { failed++; return; }
            var path = me + "/" + ev.id + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "-" + safeName(m.name);
            return store.copy(m.copyFrom, path).then(function (r) {
              if (r.error) throw r.error;
              ev.attachments.push({ path: path, name: m.name, type: m.type, size: m.size });
            });
          }).catch(function () { failed++; });
        });
        return work.then(function () {
          f._newFiles.forEach(function (n) { try { URL.revokeObjectURL(n._local); } catch (e) {} });
          if (failed) toast(failed === 1 ? "One photo couldn’t be uploaded. The event was saved." : failed + " photos couldn’t be uploaded. The event was saved.");
          return true;
        });
      },
      /* the popover's "Attachments" group (nothing at all when the event has no photos) */
      renderPopover: function (p, ev) {
        var list = (ev.attachments || []).filter(function (m) { return m && m.path; });
        if (!list.length) return;
        var sec = mk('<div class="pop-attach"><div class="pop-attach-h">Attachments</div><div class="dl-attach-grid"></div></div>');
        var grid = sec.querySelector(".dl-attach-grid");
        list.forEach(function (m, i) { grid.appendChild(tile(m, { onOpen: function () { lightbox(list, i); } })); });
        (p.querySelector(".pop-body") || p).appendChild(sec);
      },
      /* a duplicate gets its own copies of the photos (made when the copy is saved) */
      copy: function (ev) {
        return (ev.attachments || []).filter(function (m) { return m && m.path; }).map(function (m) { return { path: null, copyFrom: m.path, name: m.name, type: m.type, size: m.size }; });
      },
      /* a deleted event's photos are removed once the Undo window has passed (and only if the event did not come back) */
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
