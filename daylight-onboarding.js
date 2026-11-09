/* First-run onboarding: a popup in the app's standard dialog language, shown on a NEW account's first sign-in. It collects a first
   and last name (combined into the one display name Profile shows), an optional birthday (with the year, the same birthday Profile
   edits) and the first calendar (name + color). Nothing is saved until "Get started": closing the popup (X / Esc) saves nothing and
   it appears again on the next sign-in. Completion is stored on the account's own record (auth user metadata `onboarded`), so
   it never shows again on any device. Accounts that already have a profile (a saved workspace) never see it.
   Reset for testing: set the account's user metadata `onboarded` to false. */
(function () {
  "use strict";
  var shownFor = null, open = null;

  var css = document.createElement("style");
  css.textContent = [
    ".dl-onb .dialog-body{padding-top:6px}",
    ".dl-onb-intro{margin:0 0 18px;font-size:14px;line-height:1.55;color:var(--muted)}",
    ".dl-onb-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
    ".dl-onb .field{margin-bottom:14px}",
    ".dl-onb-step{font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:20px 0 10px}",
    ".dl-onb .dl-onb-opt{font-weight:400;color:var(--faint);margin-left:6px}",
    ".dl-onb .dl-banner{margin:0 0 4px}",
    "@media (max-width:520px){.dl-onb-row{grid-template-columns:1fr}}"
  ].join("\n");
  document.head.appendChild(css);

  function needsOnboarding() {
    var c = window.daylightCloud;
    var u = c && c.user;
    if (!u) return false;
    var done = u.user_metadata && u.user_metadata.onboarded;
    if (done === true) return false;                 /* completed once: never again, on any device */
    if (done === false) return true;                 /* explicitly reset (testing) */
    return typeof c.isNewAccount === "function" && c.isNewAccount();   /* no saved workspace yet = a brand-new account */
  }

  function show() {
    if (open || !needsOnboarding()) return;
    var c = window.daylightCloud, uidOf = c.user.id;
    if (shownFor === uidOf) return;                  /* once per page load; closing it brings it back on the next sign-in */
    shownFor = uidOf;
    var chosen = "blue";
    var bd = el('<div class="backdrop dl-onb-backdrop"><div class="dialog dl-std dl-onb" role="dialog" aria-modal="true" aria-label="Welcome to Daylight">' +
      '<div class="dialog-head"><span class="dialog-title">Welcome to Daylight!</span><button type="button" class="icon-btn dl-x" data-x title="Close" aria-label="Close">' + icon("x", 18) + "</button></div>" +
      '<div class="dialog-body" style="overflow-y:auto">' +
      '<p class="dl-onb-intro">Daylight is a personal calendar app. Keep your events and tasks in one place, share calendars with people you choose, and see your day at a glance. Let’s set up your profile and your first calendar.</p>' +
      '<div class="dl-onb-row"><div class="field dl-std-field"><label for="onbFirst">First name</label><input class="text-input" id="onbFirst" autocomplete="given-name" maxlength="60"></div>' +
      '<div class="field dl-std-field"><label for="onbLast">Last name</label><input class="text-input" id="onbLast" autocomplete="family-name" maxlength="60"></div></div>' +
      '<div class="field dl-std-field"><label for="onbBirthday">Birthday<span class="dl-onb-opt">Optional</span></label><input class="text-input" id="onbBirthday" type="date"></div>' +
      '<div class="dl-onb-step">Create your first calendar</div>' +
      '<div class="field dl-std-field"><label for="onbCal">Calendar name</label><input class="text-input" id="onbCal" maxlength="80" autocomplete="off" placeholder="For example, Personal"></div>' +
      '<div class="field dl-std-field"><label>Color</label><div class="swatches" id="onbSwatches"></div></div>' +
      '<div class="dl-banner" role="alert" hidden></div></div>' +
      '<div class="dialog-foot"><button type="button" class="btn-primary" style="margin-left:0" data-go disabled>Get started</button></div></div></div>');
    overlayRoot.appendChild(bd);
    open = bd;
    var first = bd.querySelector("#onbFirst"), last = bd.querySelector("#onbLast"), birthday = bd.querySelector("#onbBirthday"),
        calName = bd.querySelector("#onbCal"), go = bd.querySelector("[data-go]"), banner = bd.querySelector(".dl-banner");
    var today = new Date();
    birthday.max = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    if (window.daylightColorPicker) window.daylightColorPicker(bd.querySelector("#onbSwatches"), chosen, function (key) { chosen = key; });
    var busy = false;
    function valid() { return first.value.trim() && last.value.trim() && calName.value.trim() && (!birthday.value || /^\d{4}-\d{2}-\d{2}$/.test(birthday.value)); }
    function sync() { go.disabled = busy || !valid(); }
    [first, last, calName, birthday].forEach(function (i) { i.addEventListener("input", function () { banner.hidden = true; sync(); }); });
    function close() { document.removeEventListener("keydown", onKey, true); open = null; if (window.daylightExit) window.daylightExit(bd); else bd.remove(); }
    function onKey(e) { if (e.key === "Escape" && overlayRoot.lastElementChild === bd && !document.querySelector(".menu")) { e.preventDefault(); e.stopPropagation(); if (!busy) close(); } }
    document.addEventListener("keydown", onKey, true);
    bd.querySelector("[data-x]").addEventListener("click", function () { if (!busy) close(); });
    bd.addEventListener("mousedown", function (e) { if (e.target === bd && !busy) close(); });
    async function submit() {
      if (busy || !valid()) return;
      busy = true; go.disabled = true; go.textContent = "Setting up…"; banner.hidden = true;
      var firstName = first.value.trim(), full = (firstName + " " + last.value.trim()).replace(/\s+/g, " ");
      try {
        /* The account's own record first: if this fails nothing else has changed. */
        await c.updateProfileMetadata({ full_name: full, onboarded: true });
      } catch (err) {
        busy = false; go.textContent = "Get started"; sync();
        banner.textContent = "Couldn’t save your profile. Check your connection and try again."; banner.hidden = false;
        return;
      }
      /* Everything lands in one go: name, birthday (+ its events), first calendar, default calendar. */
      state.profileName = full; state.firstName = firstName;
      var calId = typeof newCalendarId === "function" ? newCalendarId() : "cal" + (++uid);
      state.calendars.push({ id: calId, name: calName.value.trim(), color: chosen, hidden: false, subscribed: false, shared: false });
      state.defaultCalendarId = calId;
      state.birthday = birthday.value || "";
      if (window.daylightSyncBirthday) window.daylightSyncBirthday();
      state.section = "calendar";
      renderAll(false);
      if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
      close();
      toast("Welcome to Daylight!");
    }
    go.addEventListener("click", submit);
    bd.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); submit(); } });
    first.focus();
  }

  document.addEventListener("daylight:workspace-ready", function () { setTimeout(show, 350); });
  document.addEventListener("daylight:workspace-signed-out", function () { shownFor = null; if (open) { open.remove(); open = null; } });
  if (window.daylightCloud && window.daylightCloud.ready) setTimeout(show, 350);
})();
