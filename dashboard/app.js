      "use strict";
      /* ================= Icons (inline SVG, Lucide-style) ================= */
      var ICONS = {
        calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
        calendarPlus: '<path d="M16 19h6"/><path d="M19 16v6"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M11 10H3"/><path d="M17.5 22H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7.34"/>',
        calendarEvt: '<rect x="3" y="3.5" width="18" height="17.5" rx="3"/><path d="M3 9.5h18"/><path d="M8 2v3"/><path d="M16 2v3"/>',
        checkSq: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8.3 12.3 2.5 2.5 4.9-5.3"/>',
        calendarDot: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><circle cx="12" cy="16" r="1.7" fill="currentColor" stroke="none"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
        lifebuoy: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
        plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        chevL: '<path d="m15 18-6-6 6-6"/>',
        chevR: '<path d="m9 18 6-6-6-6"/>',
        chevD: '<path d="m6 9 6 6 6-6"/>',
        chevU: '<path d="m18 15-6-6-6 6"/>',
        chevUD: '<path d="m7 9 5-5 5 5"/><path d="m7 15 5 5 5-5"/>',
        plusCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
        repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
        pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
        trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
        dotsV: '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
        dotsH: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
        users: '<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="8" r="3.5"/><path d="M17 4.6a3.5 3.5 0 0 1 0 6.8M21 19v-1a4 4 0 0 0-3-3.9"/>',
        shield: '<path d="M12 3 5 6v6c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6l-7-3Z"/><path d="m9.5 12 1.8 1.8 3.4-3.6"/>',
        keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01"/><path d="M10 10h.01"/><path d="M14 10h.01"/><path d="M18 10h.01"/><path d="M6 14h.01"/><path d="M18 14h.01"/><path d="M9 14h6"/>',
        briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
        bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
        arrowL: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        sliders: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><circle cx="12" cy="4" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="14" cy="20" r="2"/>',
        droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
        sync: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M9 2v2"/><path d="M9 20v2"/><path d="M20 9h2"/><path d="M20 14h2"/><path d="M2 9h2"/><path d="M2 14h2"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".6" fill="currentColor"/>',
        collapse: '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
        expand: '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><path d="M12 15V3"/>',
        palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><circle cx="16" cy="10" r="1" fill="currentColor"/><path d="M12 21a2.5 2.5 0 0 0 2.5-2.5c0-.8-.4-1.4-1-1.9-.5-.5-1-1-1-1.6"/>',
        list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
        menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
        alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
        alignLeft: '<path d="M15 6H3"/><path d="M21 12H3"/><path d="M17 18H3"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
        tablet: '<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18h2"/>',
        sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
        upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
        link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
        printer: '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>',
        copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
        refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>'
      };
      function icon(name, size) {
        size = size || 18;
        return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
      }
      function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
      }
      function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }

      /* ================= Palette & data ================= */
      var PALETTE = {
        blue:   { dot: "#5b8def", dark: "#232f47", light: "#e2ebfd", darkText: "#b9cff9", lightText: "#2c4a7c" },
        violet: { dot: "#9a7ff0", dark: "#2c2542", light: "#ece7fb", darkText: "#c9bdf6", lightText: "#513f8f" },
        green:  { dot: "#43b581", dark: "#1e352e", light: "#dff2e7", darkText: "#a5dcc4", lightText: "#206045" },
        amber:  { dot: "#F0BF2B", dark: "#372b1c", light: "#faf0d7", darkText: "#eec987", lightText: "#7a5a17" },
        rose:   { dot: "#e5646e", dark: "#38222a", light: "#fbe7ea", darkText: "#f2b3ba", lightText: "#8c3038" },
        teal:   { dot: "#3fb6b2", dark: "#1d3232", light: "#dff3f2", darkText: "#a3dcd9", lightText: "#1d5f5c" },
        plum:   { dot: "#c65d8f", dark: "#38222e", light: "#fae6f1", darkText: "#eda9c9", lightText: "#83355f" },
        gray:   { dot: "#8a8f98", dark: "#26282c", light: "#eceef1", darkText: "#c3c8cf", lightText: "#4b5058" }
      };
      var SWATCH_ORDER = ["blue", "violet", "green", "amber", "rose", "teal", "plum", "gray"];
      var REPEAT_LABELS = { daily: "Repeats daily", weekly: "Repeats weekly", monthly: "Repeats monthly", yearly: "Repeats yearly" };

      var uid = 100;
      function mkEv(title, cal, start, end, opts) {
        opts = opts || {};
        if (opts.allDay) { end = new Date(end); end.setHours(23, 59); }
        return { id: ++uid, title: title, cal: cal, start: start, end: end,
          allDay: !!opts.allDay, loc: opts.loc || "", desc: opts.desc || "", repeat: opts.repeat || null,
          reminder: opts.reminder != null ? opts.reminder : null,
          declined: !!opts.declined };
      }
      function dt(y, m, d, h, mi) { return new Date(y, m, d, h || 0, mi || 0); }

      function seedCalendars() {
        return [
          { id: "personal", name: "Personal", color: "blue", hidden: false, subscribed: false, shared: false, _seed: true },
          { id: "work", name: "Work", color: "violet", hidden: false, subscribed: false, shared: false, _seed: true },
          { id: "life", name: "Life & plans", color: "green", hidden: false, subscribed: false, shared: false, _seed: true },
          { id: "holidays", name: "US Holidays", color: "amber", hidden: false, subscribed: true, shared: false, builtin: true }
        ];
      }
      function seedFeeds() {
        /* No feeds are seeded. US Holidays used to arrive as an
           external feed; it is now Daylight's own built-in calendar
           (see usHolidaysForYear below) and appears nowhere here. */
        return [];
      }
      var SETTINGS_DEFAULTS = {
        weekStart: 0, timeFormat: "12h", dateFormat: "mdy", defaultDuration: 60,
        defaultCalendarId: null, defaultReminder: 0, density: "comfortable",
        showWeekends: true, notifSound: true, quietEnabled: false,
        quietStart: 22 * 60, quietEnd: 7 * 60, summaryTime: 7 * 60,
        workDays: [1, 2, 3, 4, 5], workStart: 9 * 60, workEnd: 17 * 60,
        useDeviceTz: true
      };
      /* The real current day on this device, captured before state
         exists so the app's anchors can start on it. TODAY (below)
         refines it to the effective time zone once state exists. */
      var BOOT_TODAY = (function () { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
      var state = {
        view: "month",
        defaultView: "month",
        section: "calendar",
        taskFilter: "all",
        tasks: [],
        prevView: null,
        cursor: new Date(BOOT_TODAY),
        selected: new Date(BOOT_TODAY),
        miniCursor: dt(BOOT_TODAY.getFullYear(), BOOT_TODAY.getMonth(), 1),
        miniSelected: new Date(BOOT_TODAY),
        themeMode: "system",
        /* No account's identity is ever baked in: these are neutral until the signed-in account's own record is loaded. */
        firstName: "Account",
        profileName: "Account",
        avatarUrl: "",
        birthday: "",
        customColors: [],
        tzLabel: "America/New_York",
        weekNumbers: false,
        showDeclined: true,
        reduceMotion: false,
        sidebarRail: false,
        calSectionOpen: true,
        subSectionOpen: true,
        sharedSectionOpen: true,
        shareColors: {},
        weekStart: SETTINGS_DEFAULTS.weekStart,
        timeFormat: SETTINGS_DEFAULTS.timeFormat,
        dateFormat: SETTINGS_DEFAULTS.dateFormat,
        defaultDuration: SETTINGS_DEFAULTS.defaultDuration,
        defaultCalendarId: SETTINGS_DEFAULTS.defaultCalendarId,
        defaultReminder: SETTINGS_DEFAULTS.defaultReminder,
        density: SETTINGS_DEFAULTS.density,
        showWeekends: SETTINGS_DEFAULTS.showWeekends,
        notifSound: SETTINGS_DEFAULTS.notifSound,
        quietEnabled: SETTINGS_DEFAULTS.quietEnabled,
        quietStart: SETTINGS_DEFAULTS.quietStart,
        quietEnd: SETTINGS_DEFAULTS.quietEnd,
        summaryTime: SETTINGS_DEFAULTS.summaryTime,
        workDays: SETTINGS_DEFAULTS.workDays.slice(),
        workStart: SETTINGS_DEFAULTS.workStart,
        workEnd: SETTINGS_DEFAULTS.workEnd,
        useDeviceTz: SETTINGS_DEFAULTS.useDeviceTz,
        calendars: seedCalendars(),
        events: [],
        feeds: seedFeeds()
      };
      function seedEvents() {
        return [
        mkEv("Florida trip", "life", dt(2026, 9, 31), dt(2026, 10, 2), { allDay: true, loc: "Florida", desc: "Flights down to pick up the Jeep, then the drive back home." }),
        mkEv("School — Day 2", "personal", dt(2026, 10, 2, 8, 35), dt(2026, 10, 2, 15, 15), { loc: "Hungary Creek Middle School", desc: "Day 2 rotation — periods 5–8." }),
        mkEv("Homework — Algebra I", "personal", dt(2026, 10, 2, 16, 0), dt(2026, 10, 2, 17, 0), { desc: "Finish the problem set in the notebook first, then enter answers online." }),
        mkEv("Team standup", "work", dt(2026, 10, 3, 9, 0), dt(2026, 10, 3, 9, 30), { loc: "Google Meet" }),
        mkEv("Swim practice", "personal", dt(2026, 10, 3, 18, 30), dt(2026, 10, 3, 19, 45), { loc: "SwimRVA-CSAC", repeat: "weekly", reminder: 30, desc: "Advanced Novice — bring fins, kickboard, and a water bottle." }),
        mkEv("School — Day 1", "personal", dt(2026, 10, 3, 8, 35), dt(2026, 10, 3, 15, 15), { loc: "Hungary Creek Middle School", desc: "Day 1 rotation — periods 1–4." }),
        mkEv("School — Day 2", "personal", dt(2026, 10, 4, 8, 35), dt(2026, 10, 4, 15, 15), { loc: "Hungary Creek Middle School", desc: "Day 2 rotation — periods 5–8." }),
        mkEv("Design review", "work", dt(2026, 10, 4, 10, 0), dt(2026, 10, 4, 11, 0), { loc: "Studio B" }),
        mkEv("Team offsite", "work", dt(2026, 10, 4, 13, 0), dt(2026, 10, 4, 16, 0), { loc: "Downtown office", declined: true }),
        mkEv("Swim practice", "personal", dt(2026, 10, 5, 18, 30), dt(2026, 10, 5, 19, 45), { loc: "SwimRVA-CSAC", repeat: "weekly", desc: "Advanced Novice — bring fins, kickboard, and a water bottle." }),
        mkEv("Project check-in", "work", dt(2026, 10, 6, 14, 0), dt(2026, 10, 6, 15, 0)),
        mkEv("Dentist appointment", "life", dt(2026, 10, 6, 16, 30), dt(2026, 10, 6, 17, 15), { loc: "River Road Dental", reminder: 60 }),
        mkEv("Family dinner", "life", dt(2026, 10, 7, 18, 0), dt(2026, 10, 7, 19, 30)),
        mkEv("Grocery run", "life", dt(2026, 10, 8, 11, 0), dt(2026, 10, 8, 11, 45), { loc: "Publix" }),
        mkEv("Book club", "life", dt(2026, 10, 12, 19, 0), dt(2026, 10, 12, 20, 0)),
        mkEv("Haircut - Amanda", "personal", dt(2026, 10, 17, 18, 30), dt(2026, 10, 17, 18, 45), { loc: "Parkside Barber Shop & Grooming Lounge, 10833 W Broad St", reminder: 30 }),
        mkEv("Science fair prep", "personal", dt(2026, 10, 18, 15, 30), dt(2026, 10, 18, 16, 30)),
        mkEv("Fall break", "life", dt(2026, 10, 25), dt(2026, 10, 27), { allDay: true, desc: "No school." })
        ];
      }
      state.events = seedEvents();
      function mkTask(title, cal, due, hasTime, done) {
        return { id: ++uid, title: title, cal: cal, due: due, hasTime: !!hasTime, done: !!done };
      }
      function seedTasks() {
        return [
          mkTask("Finish Algebra I problem set — answers into the computer after the notebook", "personal", dt(2026, 10, 1, 17, 0), true, false),
          mkTask("Turn in the science lab notes", "personal", dt(2026, 10, 1), false, false),
          mkTask("Pack swim bag — fins, kickboard, and a water bottle", "personal", dt(2026, 10, 2, 16, 0), true, false),
          mkTask("Start the English reading for tomorrow", "personal", dt(2026, 10, 2), false, false),
          mkTask("Buy new goggles before the next meet", "life", dt(2026, 10, 5), false, false),
          mkTask("Draft the science fair poster layout", "personal", dt(2026, 10, 6), false, false),
          mkTask("Plan the weekend grocery list with Mom", "life", dt(2026, 10, 8), false, false),
          mkTask("Spanish worksheet — colors and greetings", "personal", dt(2026, 9, 30), false, true),
          mkTask("Ask coach about Saturday's start time", "personal", dt(2026, 10, 2), false, true)
        ];
      }
      state.tasks = seedTasks();

      /* ================= Date utils ================= */
      /* TODAY is the REAL current day — derived live from the
         device clock in the app's effective time zone (the device
         zone while "Use device time zone" is on, otherwise the
         picked zone), never a frozen date. refreshToday() re-derives
         it on every render and on a once-a-minute tick, so the app
         stays right across midnight and after a time-zone change.
         The sample events and tasks stay anchored to their sample
         week on purpose — only what the app calls "today" moved. */
      function todayInTz() {
        try {
          var parts = new Intl.DateTimeFormat("en-US", { timeZone: effectiveTz(), year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
          var y = 0, m = 0, d = 0;
          parts.forEach(function (p) {
            if (p.type === "year") y = +p.value;
            else if (p.type === "month") m = +p.value;
            else if (p.type === "day") d = +p.value;
          });
          if (y && m && d) return new Date(y, m - 1, d);
        } catch (e) {}
        var n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), n.getDate());
      }
      var TODAY = todayInTz();
      function refreshToday() {
        var t = todayInTz();
        if (t.getTime() !== TODAY.getTime()) { TODAY = t; return true; }
        return false;
      }
      var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      var MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      var DOWS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      var DOWS_S = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
      var DAY_MS = 86400000;
      function sod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
      function addDays(d, n) { var x = sod(d); x.setDate(x.getDate() + n); return x; }
      function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
      function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
      function sundayOf(d) { return addDays(d, -sod(d).getDay()); }
      function weekStartOf(d) { var x = sod(d); return addDays(x, -((x.getDay() - state.weekStart + 7) % 7)); }
      /* Column order (getDay() values) for calendar grids, honoring the
         first-day-of-week setting and the show-weekends toggle. */
      function visibleDows() {
        var out = [];
        for (var i = 0; i < 7; i++) {
          var g = (state.weekStart + i) % 7;
          if (!state.showWeekends && (g === 0 || g === 6)) continue;
          out.push(g);
        }
        return out;
      }
      /* The visible day dates of the week containing d (Week view). */
      function weekDays(d) {
        var start = weekStartOf(d), out = [];
        for (var i = 0; i < 7; i++) {
          var date = addDays(start, i);
          if (!state.showWeekends && (date.getDay() === 0 || date.getDay() === 6)) continue;
          out.push(date);
        }
        return out;
      }
      function hourPx() { return state.density === "compact" ? 40 : 56; }
      function pad2(n) { return (n < 10 ? "0" : "") + n; }
      function fmtTime(d) {
        var h = d.getHours(), m = d.getMinutes();
        if (state.timeFormat === "24h") return pad2(h) + ":" + pad2(m);
        var ap = h >= 12 ? "pm" : "am";
        var hh = h % 12; if (hh === 0) hh = 12;
        return hh + ":" + pad2(m) + ap;
      }
      function fmtEventTime(d) {
        if (state.useDeviceTz) return fmtTime(d);
        try {
          var parts = new Intl.DateTimeFormat("en-US", {
            timeZone: effectiveTz(),
            hour: "numeric",
            minute: "2-digit",
            hourCycle: state.timeFormat === "24h" ? "h23" : "h12"
          }).formatToParts(d);
          var hour = "", minute = "", period = "";
          parts.forEach(function (part) {
            if (part.type === "hour") hour = part.value;
            else if (part.type === "minute") minute = part.value;
            else if (part.type === "dayPeriod") period = part.value.toLowerCase();
          });
          if (state.timeFormat === "24h") return pad2(Number(hour) % 24) + ":" + minute;
          return Number(hour) + ":" + minute + period;
        } catch (e) {
          return fmtTime(d);
        }
      }
      function fmtMinutes(mins) { return fmtTime(new Date(2026, 0, 1, Math.floor(mins / 60), mins % 60)); }
      /* Time zones: state.tzLabel holds an IANA zone id (e.g.
         "America/New_York"). The Settings picker lists the COMPLETE
         IANA set from Intl.supportedValuesOf (with a major-zone
         fallback for engines without it), each row carrying its
         current UTC offset; the gutter head and popovers show the
         zone's short name (EST, GMT, JST…) via Intl. */
      var TZ_FALLBACK = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "America/Mexico_City", "America/Bogota", "America/Lima", "America/Santiago", "America/Sao_Paulo", "Atlantic/Reykjavik", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Athens", "Europe/Istanbul", "Europe/Moscow", "Africa/Cairo", "Africa/Lagos", "Africa/Johannesburg", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Taipei", "Asia/Seoul", "Asia/Tokyo", "Australia/Perth", "Australia/Adelaide", "Australia/Sydney", "Pacific/Auckland"];
      function tzOffsetStr(zone) {
        try {
          var parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(new Date());
          for (var i = 0; i < parts.length; i++) {
            if (parts[i].type === "timeZoneName") {
              var v = parts[i].value;
              if (v === "GMT") return "UTC+00:00";
              return v.replace(/^GMT/, "UTC").replace(/^UTC-/, "UTC−");
            }
          }
        } catch (e) {}
        return "";
      }
      var TZ_ENTRY_CACHE = {};
      function tzEntry(zone) {
        if (!TZ_ENTRY_CACHE[zone]) TZ_ENTRY_CACHE[zone] = [zone, zone.split("/").pop().replace(/_/g, " "), tzOffsetStr(zone)];
        return TZ_ENTRY_CACHE[zone];
      }
      /* The full IANA set as dropdown options, grouped by region with
         the current zone pinned at the top under "Current". Each entry
         is [zoneId, cityName, "UTC−05:00", regionGroup] — the menu
         shows city + offset, and its filter matches city, region, the
         full zone id, and the offset text. */
      function tzOptions(current) {
        var zones = [];
        try { if (Intl.supportedValuesOf) zones = Intl.supportedValuesOf("timeZone"); } catch (e) {}
        if (!zones || !zones.length) zones = TZ_FALLBACK.slice();
        if (zones.indexOf("UTC") < 0) zones = ["UTC"].concat(zones);
        var byRegion = {};
        zones.forEach(function (z) {
          var region = z === "UTC" ? "UTC" : z.split("/")[0];
          (byRegion[region] = byRegion[region] || []).push(z);
        });
        var order = ["America", "Europe", "Africa", "Asia", "Australia", "Pacific", "Atlantic", "Indian", "Antarctica", "Arctic", "Etc", "UTC"];
        Object.keys(byRegion).forEach(function (r) { if (order.indexOf(r) < 0) order.push(r); });
        var out = [];
        if (current && zones.indexOf(current) >= 0) {
          var ce = tzEntry(current);
          out.push([ce[0], ce[1], ce[2], "Current"]);
        }
        order.forEach(function (region) {
          (byRegion[region] || []).slice().sort().forEach(function (z) {
            if (z === current) return;
            var e = tzEntry(z);
            out.push([e[0], e[1], e[2], region]);
          });
        });
        return out;
      }
      function tzShort(zone) {
        try {
          var parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(new Date());
          for (var i = 0; i < parts.length; i++) if (parts[i].type === "timeZoneName" && parts[i].value) return parts[i].value;
        } catch (e) {}
        return String(zone || "").split("/").pop().replace(/_/g, " ");
      }
      /* "Use device time zone" (Google's pattern): while it is on, the
         app follows the device's own zone and the IANA picker is
         disabled; turning it off applies the picked zone instead. */
      function deviceTz() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
      }
      function effectiveTz() { return state.useDeviceTz ? deviceTz() : state.tzLabel; }
      /* "GMT-5" / "GMT+5:30" / "GMT" for the time gutter, derived from
         the same offset string the timezone picker shows. */
      function gmtLabel(zone) {
        var s = tzOffsetStr(zone);
        if (!s) return "";
        var m = s.replace(/^UTC/, "").replace(/−/g, "-");
        if (!m || m === "+00:00" || m === "-00:00") return "GMT";
        var sign = m.charAt(0) === "-" ? "−" : "+";
        var parts = m.slice(1).split(":");
        var hh = parseInt(parts[0], 10);
        var mm = parts[1] || "00";
        return "GMT " + sign + hh + (mm !== "00" ? ":" + mm : "");
      }
      function fmtTimeRange(a, b) { return fmtEventTime(a) + " - " + fmtEventTime(b); }
      /* An all-day event (or one migrated as midnight-to-midnight) has no real times: it must never render "12:00am – 12:00am". */
      function isAllDayLike(ev, start, end) {
        if (ev && ev.allDay) return true;
        var a = new Date(start || ev.start), b = new Date(end || ev.end);
        var mid = function (d) { return d.getHours() === 0 && d.getMinutes() === 0; };
        return mid(a) && mid(b);
      }
      window.daylightIsAllDayLike = isAllDayLike;
      function fmtHourLabel(h) {
        if (state.timeFormat === "24h") return pad2(h) + ":00";
        if (h === 0) return "12 AM"; if (h === 12) return "12 PM";
        return (h < 12 ? h + " AM" : (h - 12) + " PM");
      }
      function fmtDateLong(d) {
        if (state.dateFormat === "dmy") return DOWS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
        if (state.dateFormat === "ymd") return DOWS[d.getDay()] + ", " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
        return DOWS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
      }
      function fmtDateShort(d) {
        if (state.dateFormat === "dmy") return d.getDate() + " " + MONTHS_S[d.getMonth()] + " " + d.getFullYear();
        if (state.dateFormat === "ymd") return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
        return MONTHS_S[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
      }
      var REMINDER_CHOICES = [[null, "None"], [0, "At the start time"], [5, "5 minutes before"], [10, "10 minutes before"], [15, "15 minutes before"], [30, "30 minutes before"], [60, "1 hour before"], [1440, "1 day before"]];
      window.daylightReminderChoices = REMINDER_CHOICES;
      function fmtReminder(mins) {
        if (mins == null) return "";
        if (mins === 0) return "At the start time";
        if (mins < 60) return mins + " minutes before";
        if (mins === 60) return "1 hour before";
        if (mins === 1440) return "1 day before";
        return Math.floor(mins / 60) + " hours before";
      }
      /* the reminder a NEW event on this calendar starts with: the calendar's own default, else the account default */
      function defaultReminderFor(calId) {
        var c = state.calendars.filter(function (x) { return x.id === calId; })[0];
        if (c && c.defaultReminder != null) return c.defaultReminder;
        return state.defaultReminder > 0 ? state.defaultReminder : null;
      }
      window.daylightDefaultReminderFor = defaultReminderFor;
      function isoWeek(d) {
        var x = sod(d); x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
        var first = new Date(x.getFullYear(), 0, 4);
        first.setDate(first.getDate() + 3 - ((first.getDay() + 6) % 7));
        return 1 + Math.round(((x - first) / DAY_MS) / 7);
      }
      function calOf(id) { for (var i = 0; i < state.calendars.length; i++) if (state.calendars[i].id === id) return state.calendars[i]; return state.calendars[0]; }
      /* A calendar is read-only here when it is a subscription, or when it was shared with you as "View only". */
      function isSubscribed(cal) { return !!(cal && (cal.subscribed || cal.shared || (cal.sharedFrom && cal.sharedFrom.permission !== "edit"))); }
      function isReadOnlyEvent(ev) { return isSubscribed(calOf(ev.cal)); }
      function writableCalendars() { return state.calendars.filter(function (c) { return !isSubscribed(c) && !c.eventShare; }); }
      function defaultCalId() {
        if (state.defaultCalendarId) {
          var c = calOf(state.defaultCalendarId);
          if (c && !isSubscribed(c)) return c.id;
        }
        var w = writableCalendars(); return w.length ? w[0].id : state.calendars[0].id;
      }
      function checkColorFor(colorKey) { if(/^#[0-9a-f]{6}$/i.test(colorKey)){var c=parseInt(colorKey.slice(1),16);return ((c>>16)*.299+((c>>8)&255)*.587+(c&255)*.114)>160?"#151515":"#fff";} return colorKey === "amber" ? "#171717" : "#ffffff"; }
      function fmtGoogleWhen(occ) {
        var ev = occ.ev;
        var startDay = DOWS[occ.start.getDay()] + ", " + MONTHS[occ.start.getMonth()] + " " + occ.start.getDate();
        var endDay = DOWS[sod(occ.end).getDay()] + ", " + MONTHS[sod(occ.end).getMonth()] + " " + sod(occ.end).getDate();
        if (ev.allDay) {
          if (sameDay(sod(occ.start), sod(occ.end))) return startDay;
          return startDay + " – " + endDay;
        }
        if (sameDay(occ.start, occ.end)) return startDay + " · " + fmtEventTime(occ.start) + " – " + fmtEventTime(occ.end);
        return startDay + " · " + fmtEventTime(occ.start) + " – " + endDay + " · " + fmtEventTime(occ.end);
      }
      function fmtDuration(occ) {
        var ev = occ.ev;
        if (ev.allDay) {
          var days = Math.round((sod(occ.end) - sod(occ.start)) / DAY_MS) + 1;
          return days <= 1 ? "All day" : days + " days · All day";
        }
        var mins = Math.round((occ.end - occ.start) / 60000);
        if (mins <= 0) return "0 minutes";
        if (mins < 60) return mins + (mins === 1 ? " minute" : " minutes");
        var h = Math.floor(mins / 60), m = mins % 60;
        var hs = h + (h === 1 ? " hour" : " hours");
        return m ? hs + " " + m + (m === 1 ? " minute" : " minutes") : hs;
      }
      function fmtRelativeDay(d) {
        var diff = Math.round((sod(d) - sod(TODAY)) / DAY_MS);
        if (diff === 0) return "Today";
        if (diff === 1) return "Tomorrow";
        if (diff === -1) return "Yesterday";
        if (diff > 1 && diff < 7) return "In " + diff + " days";
        if (diff < -1 && diff > -7) return Math.abs(diff) + " days ago";
        return "";
      }
      function fmtPopDayPart(d) {
        if (state.dateFormat === "dmy") return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
        if (state.dateFormat === "ymd") return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
        return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
      }
      function fmtPopDate(occ) {
        var ev = occ.ev;
        var s = DOWS[occ.start.getDay()] + ", " + fmtPopDayPart(occ.start);
        if (!sameDay(sod(occ.start), sod(occ.end))) {
          var e = sod(occ.end);
          s += " – " + DOWS[e.getDay()] + ", " + fmtPopDayPart(e);
        }
        return s;
      }
      function effectiveTheme() {
        if (state.themeMode === "system") return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
        return state.themeMode;
      }
      /* Cron model: the block fill is a low tint of the calendar colour
         (12% light / 18% dark, mixed live so it sits right on either grid),
         the title takes the colour's contrast-safe text step, and the 4px
         ribbon + selected state use the full-saturation colour. */
      /* Event blocks take the palette's tint step for their calendar;
         the 4px left ribbon (ribbonOf) and the selected state use the
         full-saturation colour. */
      /* An event is always drawn in its calendar's color. (The event dialog used to default new events to a
         "graphite" accent with no control to change it, which drew them gray; that value is now ignored.) */
      function tintOf(cal,ev) { var p = daylightPalette(cal.color); return effectiveTheme() === "light" ? p.light : p.dark; }
      function tintTextOf(cal,ev) { var p = daylightPalette(cal.color); return effectiveTheme() === "light" ? p.lightText : p.darkText; }
      function daylightPalette(key) {
        if (PALETTE[key]) return PALETTE[key];
        if (typeof key==="string" && /^#[0-9a-f]{6}$/i.test(key)) {
          var hex=key.toUpperCase();
          return PALETTE[key]={dot:hex,light:"color-mix(in srgb, "+hex+" 14%, #fff)",dark:"color-mix(in srgb, "+hex+" 24%, #17191d)",lightText:"#202026",darkText:"#fff"};
        }
        return PALETTE.blue;
      }
      function dotOf(cal) { return daylightPalette(cal.color).dot; }
      function colorName(key) {
        if (COLOR_NAMES[key]) return COLOR_NAMES[key];
        var hex=daylightPalette(key).dot.toUpperCase();
        var match=Object.keys(COLOR_NAMES).find(function(name) {
          return daylightPalette(name).dot.toUpperCase()===hex;
        });
        return match ? COLOR_NAMES[match] : key;
      }
      function ribbonOf(cal,ev) { return "inset 4px 0 0 " + dotOf(cal); }

      /* Occurrences of an event overlapping [rs, re) — expands repeats. */
      function occurrenceStamp(value) {
        if (typeof value !== "string") return +new Date(value);
        var m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
        if (m) return Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0));
        return +new Date(value);
      }
      function occurrences(ev, rs, re) {
        var out = [];
        if (String(ev.status||"").toUpperCase()==="CANCELLED") return out;
        var dur = ev.end - ev.start;
        var cur = new Date(ev.start);
        /* The origin of a moved RECURRENCE-ID exception must disappear;
           otherwise the old occurrence and its replacement both render. */
        var exceptions = ev.uid && !ev.recurrenceId
          ? state.events.filter(function(other) {
              return other!==ev && other.cal===ev.cal && other.uid===ev.uid && other.recurrenceId;
            }) : [];
        var omitted = new Set((Array.isArray(ev.exdates) ? ev.exdates : []).map(occurrenceStamp));
        exceptions.forEach(function(ex) { omitted.add(occurrenceStamp(ex.recurrenceId)); });
        var ruleFreq = String(ev.rrule||"").match(/(?:^|;)FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(?:;|$)/i);
        var frequency = ev.recurrenceId ? null : (ev.repeat || (ruleFreq ? ruleFreq[1].toLowerCase() : null));
        /* Fast-forward daily/weekly series that start long before
           the range: jump in whole periods to just before the range
           (one period of safety margin, wall-clock preserving), so
           an old series still lands in view instead of exhausting
           the iteration guard before it ever arrives. Monthly and
           yearly series are covered by the larger guard alone. */
        if (frequency === "daily" || frequency === "weekly") {
          var stepDays = frequency === "daily" ? 1 : 7;
          var gapSteps = Math.floor((rs.getTime() - dur - cur.getTime()) / (stepDays * DAY_MS)) - 1;
          if (gapSteps > 0) cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + gapSteps * stepDays, cur.getHours(), cur.getMinutes());
        }
        var guard = 0;
        while (guard++ < 6000) {
          var cEnd = new Date(cur.getTime() + dur);
          if (cur >= re) break;
          if (ev.repeatEnd && sod(cur) > sod(new Date(ev.repeatEnd))) break;
          if (cEnd > rs && !omitted.has(+cur)) out.push({ ev: ev, start: new Date(cur), end: cEnd });
          if (!frequency) break;
          if (frequency === "weekly") cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7, cur.getHours(), cur.getMinutes());
          else if (frequency === "daily") cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, cur.getHours(), cur.getMinutes());
          else if (frequency === "monthly") cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate(), cur.getHours(), cur.getMinutes());
          else if (frequency === "yearly") cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate(), cur.getHours(), cur.getMinutes());
          else break;
        }
        return out;
      }
      function visibleEvents() {
        return state.events.filter(function (ev) {
          /* Older workspaces persisted a second copy of the built-in holiday feed.
             Built-in holidays come from usHolidaysForYear(), never from saved events. */
          if (ev.cal === "holidays") return false;
          var c = state.calendars.find(function (item) { return item.id === ev.cal; });
          if (!c || c.hidden) return false;
          if (c.builtin || (c.subscribed && String(c.name).trim().toLowerCase() === "us holidays")) return false;
          if (ev.declined && !state.showDeclined) return false;
          return true;
        });
      }
      /* ================= US Holidays — built in =================
         Daylight's own US Holidays calendar: computed from the
         holiday rules, never imported, fed, or fetched from
         anywhere else. Fixed-date holidays sit on their actual
         calendar date (no observed-date shifting); floating ones
         follow their nth-weekday rule, and Election Day is the
         Tuesday after November's first Monday. Holidays are
         generated for whatever years a view asks about, so the
         calendar is complete in every month of every year the app
         can navigate to. They live outside state.events — they are
         never stored, exported, or editable — and join the
         occurrence stream here, hidden with their calendar like
         everything else. */
      function nthWeekday(y, m, dow, n) {
        var first = new Date(y, m, 1);
        return new Date(y, m, 1 + ((dow - first.getDay() + 7) % 7) + (n - 1) * 7);
      }
      function lastWeekday(y, m, dow) {
        var last = new Date(y, m + 1, 0);
        return new Date(y, m, last.getDate() - ((last.getDay() - dow + 7) % 7));
      }
      var HOLIDAY_CACHE = {};
      function usHolidaysForYear(y) {
        if (HOLIDAY_CACHE[y]) return HOLIDAY_CACHE[y];
        function H(title, date) {
          return {
            id: "hol-" + y + "-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            title: title, cal: "holidays",
            start: sod(date), end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59),
            allDay: true, loc: "", desc: "", repeat: null, reminder: null, declined: false, builtin: true
          };
        }
        function hanukkahStart(year) {
          try {
            var formatter = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", day: "numeric" });
            for (var day = 15; day <= 31; day++) {
              var date = new Date(year, 10, day);
              var parts = formatter.formatToParts(date);
              var month = parts.find(function (p) { return p.type === "month"; });
              var number = parts.find(function (p) { return p.type === "day"; });
              if (month && /kislev/i.test(month.value) && number && Number(number.value) === 25) return date;
            }
            for (var next = 1; next <= 31; next++) {
              var decemberDate = new Date(year, 11, next);
              var decemberParts = formatter.formatToParts(decemberDate);
              var decemberMonth = decemberParts.find(function (p) { return p.type === "month"; });
              var decemberDay = decemberParts.find(function (p) { return p.type === "day"; });
              if (decemberMonth && /kislev/i.test(decemberMonth.value) && decemberDay && Number(decemberDay.value) === 25) return decemberDate;
            }
          } catch (error) {}
          return new Date(year, 11, 1);
        }
        var list = [
          H("New Year's Day", new Date(y, 0, 1)),
          H("New Year's Eve", new Date(y, 11, 31)),
          H("Martin Luther King Jr. Day", nthWeekday(y, 0, 1, 3)),
          H("Groundhog Day", new Date(y, 1, 2)),
          H("Valentine's Day", new Date(y, 1, 14)),
          H("Presidents' Day", nthWeekday(y, 1, 1, 3)),
          H("St. Patrick's Day", new Date(y, 2, 17)),
          H("Easter", (function(){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=(h+l-7*m+114)%31+1;return new Date(y,month,day)})()),
          H("Mother's Day", nthWeekday(y, 4, 0, 2)),
          H("Memorial Day", lastWeekday(y, 4, 1)),
          H("Father's Day", nthWeekday(y, 5, 0, 3)),
          H("Juneteenth", new Date(y, 5, 19)),
          H("Independence Day", new Date(y, 6, 4)),
          H("Labor Day", nthWeekday(y, 8, 1, 1)),
          H("Columbus Day", nthWeekday(y, 9, 1, 2)),
          H("Halloween", new Date(y, 9, 31)),
          H("Election Day", addDays(nthWeekday(y, 10, 1, 1), 1)),
          H("Veterans Day", new Date(y, 10, 11)),
          H("Thanksgiving", nthWeekday(y, 10, 4, 4)),
          H("Hanukkah", hanukkahStart(y)),
          H("Christmas Eve", new Date(y, 11, 24)),
          H("Christmas Day", new Date(y, 11, 25))
        ];
        HOLIDAY_CACHE[y] = list;
        return list;
      }
      window.daylightHolidaysForYear = usHolidaysForYear;
      function builtinCal() {
        /* There is exactly one authoritative built-in US Holidays calendar. */
        for (var i = 0; i < state.calendars.length; i++)
          if (state.calendars[i].id === "holidays") return state.calendars[i];
        return null;
      }
      function occsInRange(rs, re) {
        var out = [];
        visibleEvents().forEach(function (ev) { occurrences(ev, rs, re).forEach(function (o) { out.push(o); }); });
        var bc = builtinCal();
        if (bc && !bc.hidden) {
          for (var y = rs.getFullYear(); y <= re.getFullYear(); y++) {
            usHolidaysForYear(y).forEach(function (ev) {
              if (ev.start < re && ev.end >= rs) out.push({ ev: ev, start: ev.start, end: ev.end });
            });
          }
        }
        return out;
      }
      function daysWithEventsInMonth(y, m) {
        var rs = new Date(y, m, 1), re = new Date(y, m + 1, 1);
        var set = {};
        occsInRange(rs, re).forEach(function (o) {
          var d = sod(o.start), last = sod(o.end);
          if (o.ev.allDay) { var x = new Date(d); while (x <= last) { if (x.getMonth() === m && coversDay(o, x)) set[x.getDate()] = true; x = addDays(x, 1); } }
          else if (d.getMonth() === m) set[d.getDate()] = true;
        });
        return set;
      }

      /* ================= Toasts ================= */
      function toast(msg, action, opts) {
        var root = document.getElementById("toastRoot");
        opts = opts || {};
        /* one undo toast at a time: a newer delete replaces the older one (its Undo now covers the latest action) */
        if (opts.replaceKey) root.querySelectorAll('.toast[data-key="' + opts.replaceKey + '"]').forEach(function (n) { n.remove(); });
        /* Dedupe: an identical message that is already on screen is
           never stacked a second time — one event, one toast. */
        var dup = false;
        root.querySelectorAll(".toast:not(.out) > span:first-child").forEach(function (s) { if (s.textContent === msg) dup = true; });
        if (dup) return;
        var t = el('<div class="toast"><span>' + esc(msg) + "</span></div>");
        if (opts.replaceKey) t.setAttribute("data-key", opts.replaceKey);
        if (action) {
          var a = el('<button class="t-action">' + esc(action.label) + "</button>");
          a.addEventListener("click", function () { action.fn(); dismiss(); });
          t.appendChild(a);
        }
        var c = el('<button class="t-close" aria-label="Dismiss">' + icon("x", 14) + "</button>");
        c.addEventListener("click", dismiss);
        t.appendChild(c);
        root.appendChild(t);
        var timer = setTimeout(dismiss, opts.duration || 4200);
        function dismiss() { clearTimeout(timer); t.classList.add("out"); setTimeout(function () { t.remove(); }, 220); }
      }

      var COLOR_NAMES = { blue: "Blue", violet: "Violet", green: "Green", amber: "Amber", rose: "Rose", teal: "Teal", plum: "Plum", gray: "Gray" };
      var paletteCloseFn = null;
      function closeTopmostOverlay() {
        if (ddState) { closeDropdown(); return true; }
        if (document.getElementById("datePop")) { closeDatePicker(); return true; }
        if (openMenuEl) { closeMenu(); return true; }
        if (paletteCloseFn) { paletteCloseFn(); return true; }
        if (overlayRoot.children.length) {
          var top = overlayRoot.children[overlayRoot.children.length - 1];
          var dlg = top.querySelector(".dialog, .settings-dialog") || top;
          var btn = dlg.querySelector("[data-x]") || top.querySelector(".settings-close") || dlg.querySelector("[data-cancel]");
          if (btn) { btn.click(); return true; }
          top.remove(); return true;
        }
        if (popMenuEl) { closePopMenu(); return true; }
        if (popEl) { closePopover(); return true; }
        if (notifPanelEl) { closeNotifPanel(); return true; }
        return false;
      }

      /* ================= Menus ================= */
      var openMenuEl = null;
      function closeMenu() { closeDropdown(); if (openMenuEl) { daylightExit(openMenuEl); openMenuEl = null; document.removeEventListener("mousedown", menuOutside, true); document.removeEventListener("click", menuOutside, true); document.removeEventListener("focusin", menuOutside, true); document.removeEventListener("keydown", menuEscape, true); } }
      function menuEscape(e) { if (e.key === "Escape" && openMenuEl) { e.preventDefault(); e.stopPropagation(); closeMenu(); } }
      function menuOutside(e) { if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu(); }
      function openMenu(anchor, items, opts) {
        opts = opts || {};
        closeDropdown();
        closeMenu(); if (!opts.keepPopover) closePopover();
        var m = el('<div class="menu' + (opts.className ? " " + opts.className : "") + '" role="menu"></div>');
        items.forEach(function (it) {
          if (it.sep) { m.appendChild(el('<div class="menu-sep"></div>')); return; }
          if (it.label2) { m.appendChild(el('<div class="menu-label">' + esc(it.label2) + "</div>")); return; }
          var b = el('<button class="menu-item' + (it.danger ? " danger" : "") + '"' + (it.title ? ' title="' + esc(it.title) + '"' : "") + ">" + (it.right === "check" ? '<span class="mi-check-left">' + icon("check", 15) + "</span>" : "") + (it.dot ? '<span class="pop-dot" style="background:' + it.dot + ';margin:0;flex:none"></span>' : "") + (it.icon ? icon(it.icon, 16) : "") + (it.sub ? '<span class="mi-text"><span class="mi-label">' + esc(it.label) + '</span><span class="mi-sub">' + esc(it.sub) + "</span></span>" : '<span class="mi-label">' + esc(it.label) + "</span>") + (it.checkRight ? '<span class="mi-right">' + (it.selected ? icon("check", 15) : "") + "</span>" : "") + (it.right && it.right !== "check" ? '<span class="mi-right">' + icon(it.right, 15) + "</span>" : "") + "</button>");
          b.setAttribute("role", "menuitem"); if (it.id) b.setAttribute("data-menu-id", it.id);
          b.addEventListener("click", function () { closeMenu(); it.fn && it.fn(); });
          m.appendChild(b);
        });
        document.body.appendChild(m);
        var r = anchor.getBoundingClientRect();
        var mw = opts.matchWidth ? Math.round(r.width) : 220;
        if (opts.matchWidth) m.style.width = mw + "px";
        if (opts.maxHeight) { m.style.maxHeight = opts.maxHeight + "px"; m.style.overflowY = "auto"; }
        var mh = m.offsetHeight;
        var left = opts.align === "right" ? r.right - mw : r.left;
        left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
        var top = opts.above ? r.top - mh - 8 : r.bottom + 6;
        if (!opts.above && top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
        if (opts.above && top < 8) top = 8;
        m.style.left = left + "px"; m.style.top = top + "px";
        /* Scale from the trigger: the menu grows out of the point nearest its anchor. */
        m.style.transformOrigin = Math.round(Math.max(0, Math.min(mw, r.left + r.width / 2 - left))) + "px " + (top >= r.bottom - 1 ? "0" : "100%");
        openMenuEl = m;
        document.addEventListener("mousedown", menuOutside, true);
        /* keyboard activation and programmatic navigation never fire mousedown: also close on any outside click or focus move */
        setTimeout(function () { if (openMenuEl) { document.addEventListener("click", menuOutside, true); document.addEventListener("focusin", menuOutside, true); } }, 0);
        document.addEventListener("keydown", menuEscape, true);
        return m;
      }

      /* ================= Premium dropdowns =================
         ONE shared component in the login's language, used for every
         select in the app (settings, event-form times, view picker).
         selectHTML() renders the trigger and registers its options in
         DD_CFG; bindDropdowns(root) wires every .dd inside a freshly
         built subtree (settings panes call it); ddSetOptions() wires a
         single trigger directly (the time fields, whose options are
         rebuilt on the fly). A trigger carries a real .value property
         and fires a real "change" event when picked, so the settings
         code reads it exactly like the native selects it replaces.
         The menu scales from the trigger at 0.95 on the shared popIn
         curve, the selected row carries a check, long lists (>10) get
         a filter field, and the keyboard gets arrows / Enter / Escape
         / type-ahead. */
      var DD_CFG = {};
      var ddState = null;
      function ddLabelFor(options, value) {
        for (var i = 0; i < options.length; i++) if (String(options[i][0]) === String(value)) return options[i][1];
        return options.length ? options[0][1] : "";
      }
      function ddSetValue(btn, v) {
        if (!btn._dd) return;
        btn._dd.value = String(v);
        var val = btn.querySelector(".dd-val");
        if (val) val.textContent = ddLabelFor(btn._dd.options, btn._dd.value);
      }
      function ddBind(btn, options, value) {
        if (!btn._dd) {
          btn._dd = { options: [], value: "" };
          Object.defineProperty(btn, "value", {
            configurable: true,
            get: function () { return btn._dd.value; },
            set: function (v) { ddSetValue(btn, v); }
          });
          btn.addEventListener("click", function () {
            if (btn.disabled) return;
            if (ddState && ddState.btn === btn) closeDropdown(); else openDropdown(btn);
          });
          btn.addEventListener("keydown", function (e) {
            if (btn.disabled || (ddState && ddState.btn === btn)) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openDropdown(btn); }
            else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDropdown(btn); }
          });
        }
        btn._dd.options = options || [];
        ddSetValue(btn, value != null ? value : (btn._dd.options.length ? btn._dd.options[0][0] : ""));
      }
      function ddSetOptions(btn, options, value) { if (btn) ddBind(btn, options, value); }
      function bindDropdowns(root) {
        if (!root) return;
        root.querySelectorAll(".dd").forEach(function (btn) {
          if (btn._dd) return;
          var cfg = DD_CFG[btn.id] || { options: [], value: "" };
          ddBind(btn, cfg.options, cfg.value);
        });
      }
      function closeDropdown() {
        if (!ddState) return;
        daylightExit(ddState.menu);
        ddState.btn.classList.remove("open");
        ddState.btn.setAttribute("aria-expanded", "false");
        document.removeEventListener("mousedown", ddOutside, true);
        document.removeEventListener("keydown", ddKeys, true);
        ddState = null;
      }
      function ddOutside(e) {
        if (!ddState) return;
        if (ddState.menu.contains(e.target) || ddState.btn.contains(e.target)) return;
        closeDropdown();
      }
      function ddKeys(e) {
        if (!ddState) return;
        var st = ddState;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeDropdown(); st.btn.focus(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); ddMove(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); ddMove(-1); }
        else if (e.key === "Enter") { e.preventDefault(); if (st.active >= 0) ddPick(st.active); }
        else if (e.key === "Tab") { closeDropdown(); }
        else if (e.key.length === 1 && !st.search && !e.metaKey && !e.ctrlKey && !e.altKey) { ddTypeAhead(e.key); }
      }
      function ddMove(dir) {
        var st = ddState; if (!st || !st.items.length) return;
        var n = st.active + dir;
        if (n < 0) n = st.items.length - 1;
        if (n >= st.items.length) n = 0;
        ddSetActive(n);
      }
      function ddSetActive(idx) {
        var st = ddState; if (!st) return;
        st.items.forEach(function (it, i) { it.el.classList.toggle("active", i === idx); });
        st.active = idx;
        if (idx >= 0 && st.items[idx]) st.items[idx].el.scrollIntoView({ block: "nearest" });
      }
      function ddPick(idx) {
        var st = ddState; if (!st) return;
        var it = st.items[idx]; if (!it) return;
        var btn = st.btn;
        ddSetValue(btn, it.value);
        closeDropdown();
        btn.dispatchEvent(new Event("change"));
        btn.focus();
      }
      function ddTypeAhead(ch) {
        var st = ddState; if (!st || !st.items.length) return;
        var now = Date.now();
        if (!st.taTime || now - st.taTime > 700) st.taBuf = "";
        st.taTime = now; st.taBuf += ch.toLowerCase();
        for (var i = 0; i < st.items.length; i++) {
          var idx = (st.active + 1 + i) % st.items.length;
          if (String(st.items[idx].label).toLowerCase().indexOf(st.taBuf) === 0) { ddSetActive(idx); return; }
        }
      }
      function openDropdown(btn) {
        closeDropdown(); closeMenu(); closeDatePicker();
        var opts = (btn._dd && btn._dd.options) || [];
        var searchable = opts.length > 10;
        var m = el('<div class="menu dd-menu" role="listbox" aria-label="Options"></div>');
        var searchIn = null;
        if (searchable) {
          var srow = el('<div class="dd-search">' + icon("search", 15) + '<input type="text" placeholder="Filter" aria-label="Filter options"></div>');
          m.appendChild(srow);
          searchIn = srow.querySelector("input");
        }
        var list = el('<div class="dd-list"></div>');
        list.style.maxHeight = "264px";
        m.appendChild(list);
        document.body.appendChild(m);
        var r = btn.getBoundingClientRect();
        var hasRight = opts.some(function (o) { return !!o[2]; });
        var mw = Math.min(Math.max(r.width, hasRight ? 308 : 196), window.innerWidth - 16);
        m.style.width = mw + "px";
        var st = { btn: btn, menu: m, search: searchIn, items: [], active: -1, taBuf: "", taTime: 0 };
        ddState = st;
        function draw(filter) {
          list.innerHTML = ""; st.items = [];
          var f = (filter || "").trim().toLowerCase();
          var lastGroup = null;
          opts.forEach(function (o) {
            var label = String(o[1]);
            if (f && label.toLowerCase().indexOf(f) < 0 && String(o[0]).toLowerCase().replace(/_/g, " ").indexOf(f) < 0 && String(o[2] || "").toLowerCase().indexOf(f) < 0 && String(o[3] || "").toLowerCase().indexOf(f) < 0) return;
            if (o[3] && o[3] !== lastGroup) {
              list.appendChild(el('<div class="dd-group">' + esc(o[3]) + "</div>"));
              lastGroup = o[3];
            }
            var sel = String(o[0]) === String(btn._dd.value);
            var b = el('<button type="button" class="menu-item" role="option" aria-selected="' + sel + '"><span class="mi-slot">' + (sel ? icon("check", 14) : "") + '</span><span class="dd-label">' + esc(label) + "</span>" + (o[2] ? '<span class="dd-right">' + esc(o[2]) + "</span>" : "") + "</button>");
            var item = { el: b, value: o[0], label: label };
            b.addEventListener("click", function () { ddPick(st.items.indexOf(item)); });
            b.addEventListener("mousemove", function () { ddSetActive(st.items.indexOf(item)); });
            list.appendChild(b);
            st.items.push(item);
          });
          if (!st.items.length) list.appendChild(el('<div class="dd-empty">No matches</div>'));
          var selIdx = -1;
          st.items.forEach(function (it, i) { if (String(it.value) === String(btn._dd.value)) selIdx = i; });
          ddSetActive(selIdx >= 0 ? selIdx : (st.items.length ? 0 : -1));
        }
        draw("");
        if (searchIn) searchIn.addEventListener("input", function () { draw(searchIn.value); });
        var mh = m.offsetHeight;
        var left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8));
        var top = r.bottom + 6, origin = "top";
        if (top + mh > window.innerHeight - 8) { top = Math.max(8, r.top - mh - 6); origin = "bottom"; }
        m.style.left = left + "px"; m.style.top = top + "px";
        m.style.transformOrigin = origin + " center";
        btn.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
        document.addEventListener("mousedown", ddOutside, true);
        document.addEventListener("keydown", ddKeys, true);
        if (searchIn) searchIn.focus();
      }

      /* ================= Sidebar ================= */
      var sidebarEl = document.getElementById("sidebar");
      var drawerBackdropEl = null;
      function openDrawer() {
        if (window.innerWidth >= 640) return;
        if (state.sidebarRail) { state.sidebarRail = false; renderSidebar(); renderHeader(); }
        sidebarEl.classList.add("drawer-open");
        if (!drawerBackdropEl) {
          drawerBackdropEl = el('<div id="drawerBackdrop"></div>');
          drawerBackdropEl.addEventListener("mousedown", function () { closeDrawer(); });
          document.body.appendChild(drawerBackdropEl);
        }
      }
      function closeDrawer() {
        sidebarEl.classList.remove("drawer-open");
        if (drawerBackdropEl) { drawerBackdropEl.remove(); drawerBackdropEl = null; }
      }
      function isDrawerOpen() { return sidebarEl.classList.contains("drawer-open"); }
      window.addEventListener("resize", function () { if (window.innerWidth >= 640 && isDrawerOpen()) closeDrawer(); });
      function renderSidebar() {
        sidebarEl.classList.toggle("rail", state.sidebarRail);
        sidebarEl.innerHTML = "";
        var brand = el(
          '<div class="brand-row">' +
            '<button type="button" class="brand-home" aria-label="Daylight home" title="Daylight home">' +
              '<span class="logo-tile"><img class="daylight-mark daylight-mark-light" src="../assets/daylight-sunarc-light-NOBG.png" alt="" width="38" height="38"><img class="daylight-mark daylight-mark-dark" src="../assets/daylight-sunarc-dark-NOBG.png" alt="" width="38" height="38"></span>' +
              '<span class="rail-hide brand-text"><span class="brand-name">Daylight</span><span class="brand-sub">Personal calendar</span></span>' +
            '</button>' +
            (state.sidebarRail ? "" : '<button class="icon-btn" id="collapseBtn" title="Collapse sidebar">' + icon("collapse", 16) + "</button>") +
          "</div>"
        );
        /* the logo is "home": it returns the main area to the calendar from Tasks, Admin or any swapped-in view. It is navigation, not a
           reload: the date, view and calendar state stay as they are and nothing is re-fetched. On the calendar already, it does nothing. */
        brand.querySelector(".brand-home").addEventListener("click", function () {
          closeMenu(); closePopover();
          closeDrawer();
          if (state.section !== "calendar") { state.section = "calendar"; renderAll(true, 1); }
        });
        var collapseButton=brand.querySelector("#collapseBtn");
        if(collapseButton)collapseButton.addEventListener("click", function () {
          state.sidebarRail = true; renderSidebar();
        });
        sidebarEl.appendChild(brand);
        /* Create — Google's dark-grey pill. The main segment opens the
           event form; the caret segment offers Event / Task. */
        var createMenuItems = function () {
          return [
            { icon: "calendarEvt", label: "Event", fn: function () { closeDrawer(); openEventForm(null, state.selected); } },
            { icon: "checkSq", label: "Task", fn: function () {
              closeDrawer(); showTasks();
              setTimeout(function () { var ti = document.getElementById("taskTitleInput"); if (ti) ti.focus(); }, 40);
            } }
          ];
        };
        if (state.sidebarRail) {
          var railBtn = el('<button class="sidebar-add-rail" title="Create" aria-label="Create">' + icon("plus", 20) + "</button>");
          railBtn.addEventListener("click", function () { openMenu(railBtn, createMenuItems()); });
          sidebarEl.appendChild(railBtn);
        } else {
          var createPill = el(
            '<div class="create-pill">' +
              '<button class="create-main" title="Create" aria-label="Create" aria-haspopup="menu">' + icon("plus", 20) + '<span class="create-label">Create</span><span class="create-chev" aria-hidden="true">' + icon("chevD", 15) + "</span></button>" +
            "</div>"
          );
          /* One button: a click anywhere on it opens the Event / Task menu. */
          createPill.querySelector(".create-main").addEventListener("click", function () { openMenu(createPill, createMenuItems(), { className: "dl-create-menu" }); });
          sidebarEl.appendChild(createPill);
        }
        if (!state.sidebarRail) sidebarEl.appendChild(renderMiniCal());
        /* App-section nav: Calendar and Tasks swap the MAIN AREA
           only — the sidebar itself never changes. The current
           section's row carries the selected fill. */
        var nav = el('<div class="side-nav"></div>');
        var calNav = el('<button class="side-row' + (state.section === "calendar" ? " active" : "") + '" title="Calendar" aria-current="' + (state.section === "calendar") + '">' + icon("calendar", 18) + '<span class="rail-hide">Calendar</span></button>');
        calNav.addEventListener("click", function () { showCalendar(); });
        var taskNav = el('<button class="side-row' + (state.section === "tasks" ? " active" : "") + '" title="Tasks" aria-current="' + (state.section === "tasks") + '">' + icon("checkSq", 18) + '<span class="rail-hide">Tasks</span>' + (state.tasks.filter(function (t) { return !t.done; }).length ? '<span class="rail-hide" style="margin-left:auto;font-size:12px;font-weight:600;color:var(--muted)">' + state.tasks.filter(function (t) { return !t.done; }).length + "</span>" : "") + "</button>");
        taskNav.addEventListener("click", function () { showTasks(); });
        nav.appendChild(calNav); nav.appendChild(taskNav);
        sidebarEl.appendChild(nav);
        /* Two calendar sections. "My calendars" holds owned calendars;
           "Subscriptions" holds subscribed calendars, including US Holidays. */
        /* skeleton only while the account is still loading AND the placeholder identity is in place (real data, however it arrived, is never hidden) */
        var dlLoading = !!(window.daylightCloud && window.daylightCloud.loading && window.daylightCloud.user && state.profileName === "Account" && state.calendars.some(function (c) { return c._seed; }));
        var ownedCals = state.calendars.filter(function (c) { return !isSubscribed(c) && !c.remoteShareId && !c.eventShare; });
        var sharedCals = state.calendars.filter(function (c) { return !!c.remoteShareId; });
        var subCals = state.calendars.filter(function (c) { return isSubscribed(c) && !c.remoteShareId && !c.eventShare; });
        var label = el('<div class="side-label rail-hide"><span>My calendars</span></div>');
        var labelActions = el('<span class="side-label-actions"></span>');
        var addBtn = el('<button class="side-label-btn add" title="New calendar" aria-label="New calendar">' + icon("plus", 16) + "</button>");
        addBtn.addEventListener("click", openNewCalendar);
        labelActions.appendChild(addBtn);
        var collapseCal = el('<button class="side-label-btn" title="' + (state.calSectionOpen ? "Collapse section" : "Expand section") + '" aria-label="' + (state.calSectionOpen ? "Collapse My calendars" : "Expand My calendars") + '" aria-expanded="' + state.calSectionOpen + '">' + icon(state.calSectionOpen ? "chevU" : "chevD", 16) + "</button>");
        collapseCal.addEventListener("click", function () { state.calSectionOpen = !state.calSectionOpen; renderSidebar(); });
        labelActions.appendChild(collapseCal);
        label.appendChild(labelActions);
        sidebarEl.appendChild(label);
        if (state.sidebarRail || state.calSectionOpen) {
          var list = el('<div class="cal-list"></div>');
          if (dlLoading) {
            /* the account is still loading: hold the space with a quiet skeleton instead of a partial list presented as real */
            for (var sk = 0; sk < 4; sk++) list.appendChild(el('<div class="cal-row dl-sk-row" aria-hidden="true"><span class="dl-sk" style="width:20px;height:20px;border-radius:5px"></span><span class="dl-sk" style="height:12px;flex:1;max-width:' + (96 + (sk % 3) * 34) + 'px"></span></div>'));
          } else ownedCals.forEach(function (cal) { list.appendChild(calRow(cal)); });
          sidebarEl.appendChild(list);
        }
        /* Calendars other Daylight accounts have shared with you. The owner's name sits under each calendar's name. */
        if (sharedCals.length) {
          var shLabel = el('<div class="side-label rail-hide"><span>Shared</span></div>');
          var shActions = el('<span class="side-label-actions"></span>');
          var collapseSh = el('<button class="side-label-btn" title="' + (state.sharedSectionOpen ? "Collapse section" : "Expand section") + '" aria-label="' + (state.sharedSectionOpen ? "Collapse Shared" : "Expand Shared") + '">' + icon(state.sharedSectionOpen ? "chevU" : "chevD", 16) + "</button>");
          collapseSh.addEventListener("click", function () { state.sharedSectionOpen = !state.sharedSectionOpen; renderSidebar(); });
          shActions.appendChild(collapseSh);
          shLabel.appendChild(shActions);
          sidebarEl.appendChild(shLabel);
          if (state.sidebarRail || state.sharedSectionOpen) {
            var shList = el('<div class="cal-list"></div>');
            sharedCals.forEach(function (cal) { shList.appendChild(calRow(cal)); });
            sidebarEl.appendChild(shList);
          }
        }
        if (true) {
          var subLabel = el('<div class="side-label rail-hide"><span>Subscriptions</span></div>');
          var subActions = el('<span class="side-label-actions"></span>');
          var addSubscription = el('<button class="side-label-btn add" title="Add to Subscriptions" aria-label="Add to Subscriptions">' + icon("plus",16) + '</button>');
          addSubscription.addEventListener("click",function(){closeDrawer();if(window.daylightAddToSubscriptions)window.daylightAddToSubscriptions();});
          subActions.appendChild(addSubscription);
          var collapseSub = el('<button class="side-label-btn" title="' + (state.subSectionOpen ? "Collapse section" : "Expand section") + '" aria-label="' + (state.subSectionOpen ? "Collapse Subscriptions" : "Expand Subscriptions") + '" aria-expanded="' + state.subSectionOpen + '">' + icon(state.subSectionOpen ? "chevU" : "chevD", 16) + "</button>");
          collapseSub.addEventListener("click", function () { state.subSectionOpen = !state.subSectionOpen; renderSidebar(); });
          subActions.appendChild(collapseSub);
          subLabel.appendChild(subActions);
          sidebarEl.appendChild(subLabel);
          if (state.sidebarRail || state.subSectionOpen) {
            var subList = el('<div class="cal-list"></div>');
            subCals.forEach(function (cal) { subList.appendChild(calRow(cal)); });
            sidebarEl.appendChild(subList);
          }
        }
        /* the bottom cluster (Support section + account block) moves as one: leftover space sits ABOVE it, the profile stays pinned */
        sidebarEl.appendChild(el('<div class="side-spacer"></div>'));
        if (!state.sidebarRail) sidebarEl.appendChild(el('<div class="side-label rail-hide"><span>Support</span></div>'));
        var help = el('<button class="side-row" title="Help center">' + icon("lifebuoy", 18) + '<span class="rail-hide">Help center</span></button>');
        help.addEventListener("click", function () { closeDrawer(); openHelp(); });
        sidebarEl.appendChild(help);
        if(state.sidebarRail){
          var expand=el('<button class="side-row sidebar-expand" title="Expand sidebar" aria-label="Expand sidebar">'+icon("expand",18)+'<span class="rail-hide">Expand sidebar</span></button>');
          expand.addEventListener("click",function(){state.sidebarRail=false;renderSidebar()});
          sidebarEl.appendChild(expand);
        }
        var set = el('<button class="side-row" title="Settings">' + icon("settings", 18) + '<span class="rail-hide">Settings</span></button>');
        set.addEventListener("click", function () { closeDrawer(); openSettings("profile"); });
        sidebarEl.appendChild(set);
        var profileInitials = state.profileName.trim().split(/\s+/).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join("") || "?";
        var pw = el(
          '<div class="profile-wrap"><button class="profile-row" title="Account">' +
            '<span class="avatar">' + (state.avatarUrl ? '<img src="' + esc(state.avatarUrl) + '" alt="">' : esc(profileInitials)) + "</span>" +
            '<span class="rail-hide" style="min-width:0"><span class="profile-name">' + esc(state.profileName) + '</span><br><span class="profile-email">' + esc((window.daylightCloud && window.daylightCloud.user && window.daylightCloud.user.email) || window.__dlIdentityEmail || "") + '</span></span>' +
            '<span class="icon-btn rail-hide" style="pointer-events:none">' + icon("dotsV", 17) + "</span>" +
          "</button></div>"
        );
        /* The account block opens a small menu right above it: Settings and Log out (red). */
        if (dlLoading) {
          pw = el('<div class="profile-wrap"><div class="profile-row dl-sk-profile" aria-hidden="true"><span class="dl-sk" style="width:36px;height:36px;border-radius:50%"></span><span style="flex:1;display:flex;flex-direction:column;gap:7px"><span class="dl-sk" style="height:11px;width:96px"></span><span class="dl-sk" style="height:9px;width:132px"></span></span></div></div>');
        }
        var profileRow = pw.querySelector(".profile-row");
        profileRow.setAttribute("aria-haspopup", "menu");
        profileRow.addEventListener("click", function () {
          if (openMenuEl && openMenuEl.classList.contains("dl-account-menu")) { closeMenu(); return; }
          var rail = !!state.sidebarRail && window.innerWidth >= 640;
          var m = openMenu(profileRow, [
            { id: "settings", icon: "settings", label: "Settings", fn: function () { closeDrawer(); openSettings("profile"); } },
            { id: "logout", icon: "logout", label: "Log out", danger: true, fn: function () { closeDrawer(); logOut(); } }
          ], { above: true, matchWidth: !rail, className: "dl-account-menu" });
          profileRow.setAttribute("aria-expanded", "true");
          var first = m.querySelector(".menu-item"); if (first) first.focus({ preventScroll: true });
          var watch = setInterval(function () { if (openMenuEl !== m) { clearInterval(watch); profileRow.setAttribute("aria-expanded", "false"); } }, 120);
        });
        sidebarEl.appendChild(pw);
        /* Fix 39: the bottom cluster (Support rows + account block) is ONE pinned container that is never part of the scroll area; the sections above scroll and give up the space. */
        (function () {
          var kids = Array.prototype.slice.call(sidebarEl.children), spacer = sidebarEl.querySelector(":scope > .side-spacer"), at = kids.indexOf(spacer);
          if (at < 0) return;
          var scrollBox = el('<div class="side-scroll"></div>'), bottomBox = el('<div class="side-bottom"></div>');
          kids.slice(0, at).forEach(function (n) { scrollBox.appendChild(n); });
          kids.slice(at + 1).forEach(function (n) { bottomBox.appendChild(n); });
          spacer.remove();
          sidebarEl.appendChild(scrollBox); sidebarEl.appendChild(bottomBox);
          /* a row is never shown cut in half at the scroll edge: the edge fades while there is more below, and is clear once you reach the end */
          var fade = function () { scrollBox.classList.toggle("fade-b", scrollBox.scrollHeight - scrollBox.clientHeight - scrollBox.scrollTop > 6); };
          scrollBox.addEventListener("scroll", fade); requestAnimationFrame(fade); setTimeout(fade, 400); if (window.ResizeObserver) new ResizeObserver(fade).observe(scrollBox);
        })();
      }
      /* The main view's visible range — sidebar counts are the number
         of occurrences each calendar has inside it. */
      function visibleRange() {
        var c = state.cursor;
        if (state.view === "month") { var s = weekStartOf(new Date(c.getFullYear(), c.getMonth(), 1)); return [s, addDays(s, 42)]; }
        if (state.view === "week") { var wd = weekDays(c); return [wd[0], addDays(wd[wd.length - 1], 1)]; }
        if (state.view === "day") return [sod(c), addDays(c, 1)];
        return [sod(c), addDays(c, 21)];
      }
      function countInView(calId) {
        var r = visibleRange(), n = 0;
        state.events.forEach(function (ev) {
          if (ev.cal !== calId) return;
          if (ev.declined && !state.showDeclined) return;
          n += occurrences(ev, r[0], r[1]).length;
        });
        return n;
      }
      var calendarToggleLocks = Object.create(null);
      function persistCalendarChange() {
        if (window.daylightCloud && window.daylightCloud.save) {
          requestAnimationFrame(function () { window.daylightCloud.save(); });
        }
      }
      function animateCalendarToggle(cal) {
        var id = String(cal.id);
        if (calendarToggleLocks[id]) return;
        calendarToggleLocks[id] = true;
        var wasHidden = !!cal.hidden;
        var nextHidden = !wasHidden;
        var reduce = state.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var view = document.getElementById('viewWrap');
        var nodes = view ? Array.from(view.querySelectorAll('[data-calendar-id]')).filter(function (node) {
          return node.getAttribute('data-calendar-id') === id;
        }) : [];
        function release() { calendarToggleLocks[id] = false; }
        function finish() {
          cal.hidden = nextHidden;
          renderSidebar();
          renderView(false);
          if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
          release();
        }
        if (reduce || !nodes.length) { finish(); return; }
        if (!nextHidden) {
          finish();
          requestAnimationFrame(function () {
            var current = document.getElementById('viewWrap');
            if (!current) return;
            Array.from(current.querySelectorAll('[data-calendar-id]')).filter(function (node) {
              return node.getAttribute('data-calendar-id') === id;
            }).forEach(function (node) {
              node.animate([{opacity:0,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}],
                {duration:145,easing:'cubic-bezier(.23,1,.32,1)'});
            });
          });
          return;
        }
        var fades = nodes.map(function (node) {
          try {
            var animation = node.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.99)'}],
              {duration:115,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
            return animation.finished.catch(function(){});
          } catch (error) { return Promise.resolve(); }
        });
        Promise.all(fades).then(finish).catch(finish);
      }
      /* ===== Reorder calendars: the grip (six dots) is the only drag handle; Arrow Up / Down move a row from the keyboard. ===== */
      var GRIP_SVG = '<svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true" focusable="false"><g fill="currentColor"><circle cx="3.5" cy="3" r="1.35"/><circle cx="8.5" cy="3" r="1.35"/><circle cx="3.5" cy="8" r="1.35"/><circle cx="8.5" cy="8" r="1.35"/><circle cx="3.5" cy="13" r="1.35"/><circle cx="8.5" cy="13" r="1.35"/></g></svg>';
      function calSectionOf(cal) { return cal.remoteShareId ? "shared" : (isSubscribed(cal) ? "sub" : "mine"); }
      /* Move `cal` to position `to` among the calendars of its own section; the other sections keep their places in state.calendars. */
      function reorderCalendar(cal, to) {
        var sec = calSectionOf(cal);
        var idxs = [], list = [];
        state.calendars.forEach(function (c, i) { if (!c.eventShare && calSectionOf(c) === sec) { idxs.push(i); list.push(c); } });
        var from = list.indexOf(cal);
        to = Math.max(0, Math.min(list.length - 1, to));
        if (from < 0 || from === to) return false;
        list.splice(from, 1); list.splice(to, 0, cal);
        idxs.forEach(function (stateIndex, k) { state.calendars[stateIndex] = list[k]; });
        return true;
      }
      function sidebarRowTops() {
        var map = {};
        document.querySelectorAll("#sidebar .cal-row[data-cal-id]").forEach(function (r) { map[r.getAttribute("data-cal-id")] = r.getBoundingClientRect().top; });
        return map;
      }
      /* FLIP: after a re-render, every row slides from where it was to where it is now (the app's 190 ms ease-out). */
      function flipSidebarRows(before) {
        var reduce = state.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) return;
        document.querySelectorAll("#sidebar .cal-row[data-cal-id]").forEach(function (r) {
          var was = before[r.getAttribute("data-cal-id")];
          if (was == null) return;
          var dy = was - r.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) return;
          r.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "translateY(0)" }], { duration: 190, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
        });
      }
      function calGrip(cal, row) {
        row.setAttribute("data-cal-id", String(cal.id));
        var grip = el('<button type="button" class="cal-grip" title="Drag to reorder" aria-label="Reorder ' + esc(cal.name) + '. Use the Up and Down arrow keys." aria-roledescription="reorder handle">' + GRIP_SVG + "</button>");
        grip.addEventListener("click", function (e) { e.stopPropagation(); });
        grip.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          var sec = calSectionOf(cal);
          var list = state.calendars.filter(function (c) { return !c.eventShare && calSectionOf(c) === sec; });
          var at = list.indexOf(cal), before = sidebarRowTops();
          if (!reorderCalendar(cal, at + (e.key === "ArrowUp" ? -1 : 1))) return;
          renderSidebar(); flipSidebarRows(before); persistCalendarChange();
          var rowsNow = document.querySelectorAll("#sidebar .cal-row[data-cal-id]");
          for (var i = 0; i < rowsNow.length; i++) {
            if (rowsNow[i].getAttribute("data-cal-id") === String(cal.id)) { var g = rowsNow[i].querySelector(".cal-grip"); if (g) g.focus(); break; }
          }
        });
        grip.addEventListener("pointerdown", function (e) {
          if (e.button != null && e.button !== 0) return;
          var rows = Array.prototype.slice.call(row.parentNode.querySelectorAll(".cal-row[data-cal-id]"));
          var start = rows.indexOf(row);
          if (start < 0 || rows.length < 2) return;
          e.preventDefault();
          try { grip.setPointerCapture(e.pointerId); } catch (err) {}
          var tops = rows.map(function (r) { return r.getBoundingClientRect(); });
          var h = tops[start].height, y0 = e.clientY, target = start, moved = false;
          var reduce = state.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          function place(dy) {
            row.style.transform = "translateY(" + dy + "px) scale(1.015)";
            var mid = tops[start].top + dy + h / 2;
            var next = start;
            rows.forEach(function (r, i) {
              if (i < start && mid < tops[i].top + tops[i].height / 2) next = Math.min(next, i);
              if (i > start && mid > tops[i].top + tops[i].height / 2) next = Math.max(next, i);
            });
            target = next;
            rows.forEach(function (r, i) {
              if (i === start) return;
              var shift = 0;
              if (start < target && i > start && i <= target) shift = -h;
              if (start > target && i < start && i >= target) shift = h;
              r.style.transform = shift ? "translateY(" + shift + "px)" : "";
            });
          }
          function onMove(ev) {
            var dy = ev.clientY - y0;
            if (!moved) {
              if (Math.abs(dy) < 3) return;
              moved = true; document.body.classList.add("dl-reordering");
              row.classList.add("is-dragging");
              rows.forEach(function (r) { if (r !== row) r.classList.add("is-parting"); });
            }
            var minDy = tops[0].top - tops[start].top, maxDy = tops[rows.length - 1].top - tops[start].top;
            place(Math.max(minDy, Math.min(maxDy, dy)));
          }
          function finish(commit) {
            grip.removeEventListener("pointermove", onMove); grip.removeEventListener("pointerup", onUp); grip.removeEventListener("pointercancel", onCancel);
            try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
            document.body.classList.remove("dl-reordering");
            function clean() { rows.forEach(function (r) { r.style.transform = ""; r.classList.remove("is-dragging", "is-parting"); }); }
            if (!moved) { clean(); return; }
            if (!commit || target === start) {
              row.classList.remove("is-dragging"); row.style.transform = "";
              setTimeout(clean, reduce ? 0 : 200);
              return;
            }
            /* settle: the lifted row eases into its slot, then the list is rebuilt in the new order (the rows are already there: no jump) */
            var settle = tops[target].top - tops[start].top;
            row.classList.remove("is-dragging"); row.classList.add("is-parting"); row.style.transform = "translateY(" + settle + "px)";
            setTimeout(function () {
              clean();
              if (reorderCalendar(cal, target)) { renderSidebar(); persistCalendarChange(); }
            }, reduce ? 0 : 190);
          }
          function onUp() { finish(true); }
          function onCancel() { finish(false); }
          grip.addEventListener("pointermove", onMove); grip.addEventListener("pointerup", onUp); grip.addEventListener("pointercancel", onCancel);
        });
        return grip;
      }
      function calRow(cal) {
        var row = el('<div class="cal-row"></div>');
        if (!state.sidebarRail) row.appendChild(calGrip(cal, row));
        var chk = el('<button class="cal-check' + (cal.hidden ? " off" : "") + '" style="background:' + dotOf(cal) + ";border-color:" + dotOf(cal) + ";color:" + checkColorFor(cal.color) + '" title="' + (cal.hidden ? "Show " : "Hide ") + esc(cal.name) + '" aria-label="' + (cal.hidden ? "Show " : "Hide ") + esc(cal.name) + '" aria-pressed="' + (!cal.hidden) + '">' + icon("check", 13) + "</button>");
        chk.addEventListener("click", function () { animateCalendarToggle(cal); });
        row.appendChild(chk);
        var name = el('<span class="cal-name' + (cal.hidden ? " off" : "") + '">' + esc(cal.name) + "</span>");
        if (cal.sharedFrom) {
          var stack = el('<span class="cal-name-stack"></span>');
          stack.appendChild(name);
          stack.appendChild(el('<span class="cal-owner">' + esc(cal.sharedFrom.ownerName || "") + "</span>"));
          row.classList.add("has-owner");
          row.appendChild(stack);
        } else row.appendChild(name);
        /* Subscribed/shared rows get NO badge and NO menu: no lock
           icon, and no rename / color / delete controls at all —
           read-only is expressed by the section they live in and by
           their events' popovers, not by chrome on the row. Only
           owned calendars (My calendars) get the options menu. */
        if (!isSubscribed(cal) || cal.id === "holidays" || cal.remoteShareId) {
          var mb = el('<button class="icon-btn cal-menu-btn" title="Calendar settings" aria-label="Settings for ' + esc(cal.name) + '">' + icon("dotsV", 16) + "</button>");
          mb.addEventListener("click", function () { openCalMenu(mb, cal, row); });
          row.appendChild(mb);
        }
        return row;
      }
      /* A calendar that is YOURS: not a subscription, not shared with you, not an event share, not the built-in US Holidays. */
      function isOwnedCalendar(cal) { return !!cal && !isSubscribed(cal) && !cal.remoteShareId && !cal.eventShare && !cal.remoteSubscriptionId && cal.id !== "holidays" && !cal.builtin; }
      function openCalMenu(anchor, cal, row) {
        /* The ⋯ button: for your own calendars a menu (Manage, Delete calendar); everything else keeps its existing behavior
           (shared and US Holidays open the calendar settings popup; subscriptions keep their own manager). */
        if (isSubscribed(cal) && cal.id !== "holidays" && !cal.remoteShareId) return;
        closeMenu(); closePopover();
        if (isOwnedCalendar(cal)) {
          openMenu(anchor, [
            { icon: "settings", label: "Manage", fn: function () { if (window.daylightCalendarSettings) window.daylightCalendarSettings(cal); } },
            { icon: "trash", label: "Delete calendar", danger: true, fn: function () { confirmDeleteCalendar(cal); } }
          ], { align: "left" });
          return;
        }
        if (window.daylightCalendarSettings) window.daylightCalendarSettings(cal);
      }
      function startRename(row, cal) {
        var nameEl = row.querySelector(".cal-name");
        var input = el('<input class="cal-rename" value="' + esc(cal.name) + '">');
        nameEl.replaceWith(input);
        input.focus(); input.select();
        /* ONE-SHOT finish: Enter saves and the re-render removes the
           input, which fires blur — without this guard the blur ran
           done() a second time (a second "Calendar renamed" toast
           and a second full sidebar render). Escape likewise must
           not let the trailing blur save afterwards. */
        var finished = false;
        function done(save) {
          if (finished) return;
          finished = true;
          if (save && input.value.trim()) { cal.name = input.value.trim(); persistCalendarChange(); toast("Calendar renamed"); }
          renderSidebar(); renderView(false);
        }
        input.addEventListener("blur", function () { done(true); });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") done(true);
          if (e.key === "Escape") { input.value = cal.name; done(false); }
        });
      }
      /* The number of event records on THIS calendar that the deletion will remove, counted fresh from the calendar's own data
         (a repeating series counts once; its edited occurrences belong to it and are not counted again). */
      function calendarEventCount(cal) {
        return state.events.filter(function (e) { return e.cal === cal.id && !e.recurrenceId; }).length;
      }
      /* The ONE delete-calendar popup (sidebar menu and Manage -> Danger zone both land here). The Delete button does not exist until the
         typed text matches the calendar's name exactly (spaces at the ends are ignored); one field, nothing else to type. */
      function confirmDeleteCalendar(cal) {
        var count = calendarEventCount(cal);
        var bd = el('<div class="backdrop"><div class="dialog dl-std dl-confirm dl-delcal" role="dialog" aria-modal="true" aria-label="Delete calendar">' +
          '<div class="dialog-head"><span class="dialog-title">Delete calendar?</span><button class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
          '<div class="dialog-body"><p class="dl-delcal-body" style="margin:0 0 16px;font-size:14px;color:var(--muted);line-height:1.55"></p>' +
          '<div class="field dl-std-field" style="margin:0"><label for="delCalName" class="dl-delcal-label" style="font-weight:400;color:var(--muted)"></label><input class="text-input" id="delCalName" autocomplete="off" spellcheck="false"></div></div>' +
          '<div class="dialog-foot"><button class="btn-ghost" data-cancel>Cancel</button><button class="btn-danger" style="margin-left:0" data-ok hidden>Delete calendar</button></div></div></div>');
        var name = cal.name;
        var body = bd.querySelector(".dl-delcal-body");
        var strong = document.createElement("b"); strong.style.color = "var(--text)"; strong.textContent = name;
        body.appendChild(strong);
        body.appendChild(document.createTextNode(" has " + count + " " + (count === 1 ? "event" : "events") + ", and " + (count === 1 ? "it is" : "they are") + " deleted with it. This is permanent and cannot be undone."));
        var label = bd.querySelector(".dl-delcal-label");
        label.appendChild(document.createTextNode("To confirm, type the calendar name "));
        var strong2 = document.createElement("b"); strong2.style.color = "var(--text)"; strong2.textContent = name; label.appendChild(strong2);
        label.appendChild(document.createTextNode(" below:"));
        overlayRoot.appendChild(bd);
        var input = bd.querySelector("#delCalName"), ok = bd.querySelector("[data-ok]");
        function matches() { return input.value.trim() === name; }
        function sync() { ok.hidden = !matches(); }
        input.addEventListener("input", sync);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (matches()) ok.click(); } });
        function close() { input.value = ""; daylightExit(bd); }
        bd.querySelector("[data-x]").addEventListener("click", close);
        bd.querySelector("[data-cancel]").addEventListener("click", close);
        bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
        ok.addEventListener("click", function () {
          if (!matches()) return;
          close();
          state.calendars = state.calendars.filter(function (c) { return c.id !== cal.id; });
          state.events = state.events.filter(function (e) { return e.cal !== cal.id; });
          renderSidebar(); renderView(false); toast("Calendar deleted");
        });
        input.focus();
      }
      /* a calendar id that no other calendar (or task) already uses, so a new calendar can never inherit another one's events */
      function newCalendarId() { var id; do { id = "cal" + (++uid); } while (state.calendars.some(function (c) { return c.id === id; })); return id; }
      function calendarDayLabel(date, displayedMonth) {
        return date.getDate() === 1 && date.getMonth() !== displayedMonth
          ? MONTHS_S[date.getMonth()] + " 1" : String(date.getDate());
      }
      function renderMiniCal() {
        /* Decoupled: the mini calendar has its OWN cursor (state.miniCursor)
           and its OWN selection (state.miniSelected). Browsing it with the
           ‹ › arrows changes only the mini calendar — the main calendar does
           not move. Paging the main calendar does not change the mini month
           either. Only an explicit click on a mini date jumps the main view
           to that date (a deliberate pick, not browsing). */
        var wrap = el('<div class="rail-hide" id="miniWrap"></div>');
        var mc = state.miniCursor;
        var head = el('<div class="mini-head"><span class="mini-title">' + MONTHS[mc.getMonth()] + " " + mc.getFullYear() + '</span><span class="mini-navs"><button class="mini-nav" title="Previous month" aria-label="Previous month">' + icon("chevL", 14) + '</button><button class="mini-nav" title="Next month" aria-label="Next month">' + icon("chevR", 14) + "</button></span></div>");
        var navs = head.querySelectorAll(".mini-nav");
        var miniFade = function (dir) {
          var w = document.getElementById("miniWrap");
          if (w && !state.reduceMotion && !reduceMotionMQ.matches) { w.classList.add(dir < 0 ? "mini-anim-prev" : "mini-anim-next"); setTimeout(function () { w.classList.remove("mini-anim-prev", "mini-anim-next"); }, 220); }
        };
        navs[0].addEventListener("click", function () { state.miniCursor = addMonths(state.miniCursor, -1); renderSidebar(); miniFade(-1); });
        navs[1].addEventListener("click", function () { state.miniCursor = addMonths(state.miniCursor, 1); renderSidebar(); miniFade(1); });
        wrap.appendChild(head);
        var wdLabels = ["S", "M", "T", "W", "T", "F", "S"];
        var wd = el('<div class="mini-weekdays">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) { return "<span>" + wdLabels[(state.weekStart + i) % 7] + "</span>"; }).join("") + "</div>");
        wrap.appendChild(wd);
        var grid = el('<div id="miniGrid"></div>');
        var first = new Date(mc.getFullYear(), mc.getMonth(), 1);
        var start = weekStartOf(first);
        for (var w = 0; w < 6; w++) {
          var rowStart = addDays(start, w * 7);
          var row = el('<div class="mini-week"></div>');
          for (var d = 0; d < 7; d++) {
            (function (date) {
              var inMonth = date.getMonth() === mc.getMonth();
              var b = el('<button class="mini-day' + (inMonth ? "" : " dim") + (!inMonth && date.getDate() === 1 ? " edge-month" : "") + (sameDay(date, TODAY) ? " today" : "") + (sameDay(date, state.miniSelected) ? " sel" : "") + '"><span class="num">' + date.getDate() + "</span></button>");
              b.addEventListener("click", function () {
                state.section = "calendar";
                state.miniSelected = sod(date);
                if (date.getMonth() !== state.miniCursor.getMonth() || date.getFullYear() !== state.miniCursor.getFullYear()) state.miniCursor = dt(date.getFullYear(), date.getMonth(), 1);
                state.selected = sod(date); state.cursor = sod(date);
                if (state.view === "day") state.prevView = state.prevView || "month";
                renderAll(false);
                closeDrawer();
              });
              row.appendChild(b);
            })(addDays(rowStart, d));
          }
          grid.appendChild(row);
        }
        wrap.appendChild(grid);
        return wrap;
      }

      /* ================= Header ================= */
      /* "Nov 8–14, 2026", "Nov 29 – Dec 5, 2026", "Dec 28, 2026 – Jan 3, 2027" */
      function rangeLabel(days) {
        var a = days[0], b = days[days.length - 1], sm = MONTHS[a.getMonth()].slice(0, 3), em = MONTHS[b.getMonth()].slice(0, 3);
        if (a.getFullYear() !== b.getFullYear()) return sm + " " + a.getDate() + ", " + a.getFullYear() + " – " + em + " " + b.getDate() + ", " + b.getFullYear();
        if (a.getMonth() !== b.getMonth()) return sm + " " + a.getDate() + " – " + em + " " + b.getDate() + ", " + b.getFullYear();
        return sm + " " + a.getDate() + "–" + b.getDate() + ", " + b.getFullYear();
      }
      function renderHeader() {
        /* The header band is the whole top of the main area — the
           compact toolbar cluster at the left, the drawer button,
           the day-view Back button when drilled in, and the quiet
           search / Settings / help actions at the right. In Month,
           Week, and Agenda the cluster's label is the month + year
           ("November 2026") and its ‹ › chevrons page by ONE month.
           In Day view the month + year is GONE: the same spot shows
           the full date of the day being viewed ("Tuesday,
           November 3, 2026", via fmtDateLong so it honours the
           date-format setting) and the chevrons page by ONE day.
           The calendar-with-a-dot button returns to today in Month
           view from anywhere. In the Tasks section the cluster is
           hidden — Tasks has its own header inside its view — but
           the band itself keeps the same compact height. There is
           still no Day/Week/Month switcher here: that lives in
           Settings. */
        var hdr = document.getElementById("headerBand");
        hdr.innerHTML = "";
        var ham = el('<button class="icon-btn hamburger-btn" title="Open sidebar" aria-label="Open sidebar">' + icon("menu", 21) + "</button>");
        ham.addEventListener("click", function () { openDrawer(); });
        hdr.appendChild(ham);
        if (state.section === "calendar") {
          var isDay = state.view === "day";
          var isWeek = state.view === "week", isAgenda = state.view === "agenda";
          var label = isDay ? fmtDateLong(state.cursor) : isWeek ? rangeLabel(weekDays(state.cursor)) : isAgenda ? rangeLabel([sod(state.cursor), addDays(sod(state.cursor), 20)]) : MONTHS[state.cursor.getMonth()] + " " + state.cursor.getFullYear();
          var unit = isDay ? "day" : isWeek ? "week" : isAgenda ? "period" : "month";
          var prevName = "Previous " + unit;
          var nextName = "Next " + unit;
          var tb = el('<div class="cal-toolbar">' +
            (isDay ? "" : '<button class="icon-btn" id="tbPrev" title="' + prevName + '" aria-label="' + prevName + '">' + icon("chevL", 17) + "</button>") +
            '<span class="month-title' + (isDay ? " is-day" : (isAgenda ? " is-range" : "")) + '" id="tbMonth">' + esc(label) + "</span>" +
            (isDay ? "" : '<button class="icon-btn" id="tbNext" title="' + nextName + '" aria-label="' + nextName + '">' + icon("chevR", 17) + "</button>") +
            '<button class="icon-btn today-btn" id="tbToday" title="Back to today" aria-label="Back to today">' + icon("calendarDot", 19) + "</button>" +
          "</div>");
          /* the arrows move by the unit the header names: a day, a week, the agenda's three-week period, or a month */
          function pageHeader(dir) { if (state.view === "day") pageDay(dir); else if (state.view === "week" || state.view === "agenda") pageBy(dir, true); else pageMonth(dir); }
          if (!isDay) {
            tb.querySelector("#tbPrev").addEventListener("click", function () { pageHeader(-1); });
            tb.querySelector("#tbNext").addEventListener("click", function () { pageHeader(1); });
          } else {
            /* Day view: the day arrows live at the right end of the header; the left spot is a real Back */
            var dayArrows = el('<div class="dl-day-arrows"><button class="icon-btn" id="tbPrev" title="' + prevName + '" aria-label="' + prevName + '">' + icon("chevL", 17) + '</button><button class="icon-btn" id="tbNext" title="' + nextName + '" aria-label="' + nextName + '">' + icon("chevR", 17) + "</button></div>");
            dayArrows.querySelector("#tbPrev").addEventListener("click", function () { pageHeader(-1); });
            dayArrows.querySelector("#tbNext").addEventListener("click", function () { pageHeader(1); });
          }
          tb.querySelector("#tbToday").addEventListener("click", function () { goTodayMonth(); });
          hdr.appendChild(tb);
        }
        if (state.view === "day" && state.section === "calendar") {
          var back = el('<button class="back-btn" id="tbBack" title="Back" aria-label="Back">' + icon("arrowL", 15) + "Back</button>");
          back.addEventListener("click", function () {
            /* returns to the view he came from (Month when there is none), with that view's date kept */
            var pv = state.prevView || "month"; state.prevView = null; state.view = pv;
            if (state.prevCursor) { state.cursor = sod(state.prevCursor); state.prevCursor = null; }
            renderAll(true, -1);
          });
          var toolbarEl = hdr.querySelector(".cal-toolbar");
          if (toolbarEl) hdr.insertBefore(back, toolbarEl); else hdr.appendChild(back);
        }
        var right = el('<div class="head-right' + (state.view === "day" && state.section === "calendar" ? " is-day" : "") + '"></div>');
        /* Three quiet icon buttons only: search (full-screen command
           palette), Settings, and help. View switching lives in
           Settings → Default Calendar View. */
        var searchBtn = el('<button class="icon-btn" title="Search (Ctrl+K)" aria-label="Search">' + icon("search", 19) + "</button>");
        searchBtn.addEventListener("click", function () { openSearch(); });
        var gearBtn = el('<button class="icon-btn" title="Settings" aria-label="Settings">' + icon("settings", 19) + "</button>");
        gearBtn.addEventListener("click", function () { openSettings("general"); });
        var helpBtn = el('<button class="icon-btn" title="Help center" aria-label="Help center">' + icon("help", 19) + "</button>");
        helpBtn.addEventListener("click", function () { openHelp(); });
        /* The notifications button next to Search: its panel lists what the owner has sent to everyone
           (daylight-notifications.js) and shows the empty state when there is nothing. */
        var notifBtn = el('<button class="icon-btn dl-notif-btn" title="Notifications" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false">' + icon("bell", 19) + "</button>");
        notifBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleNotifPanel(notifBtn); });
        if (window.daylightNotifications) window.daylightNotifications.decorate(notifBtn);
        /* the sync label (its width changes) stays leftmost so everything to its right never shifts */
        if (window.daylightSyncIndicator) right.appendChild(window.daylightSyncIndicator());
        if (typeof dayArrows !== "undefined" && dayArrows && state.view === "day") right.appendChild(dayArrows);
        /* Month and Day views: a quiet overflow (⋯) menu, currently holding Print month */
        if (state.section === "calendar" && (state.view === "month" || state.view === "day")) {
          var moreBtn = el('<button class="icon-btn" title="More" aria-label="More" aria-haspopup="menu">' + icon("dotsH", 19) + "</button>");
          moreBtn.addEventListener("click", function () {
            openMenu(moreBtn, [{ icon: "printer", label: "Print month", fn: function () { if (window.daylightPrintMonth) window.daylightPrintMonth(); } }], { align: "right" });
          });
          right.appendChild(moreBtn);
        }
        right.appendChild(searchBtn); right.appendChild(notifBtn); right.appendChild(gearBtn);   /* (the header Help button is not rendered: it was always removed right after paint, which made the controls jump) */
        hdr.appendChild(right);
      }
      var notifPanelEl = null, notifPanelAnchor = null;
      function closeNotifPanel() {
        if (!notifPanelEl) return;
        document.removeEventListener("mousedown", notifOutside, true);
        window.removeEventListener("resize", closeNotifPanel);
        daylightExit(notifPanelEl); notifPanelEl = null;
        if (notifPanelAnchor && notifPanelAnchor.isConnected) notifPanelAnchor.setAttribute("aria-expanded", "false");
        notifPanelAnchor = null;
      }
      function notifOutside(e) {
        if (notifPanelEl && notifPanelEl.contains(e.target)) return;
        if (notifPanelAnchor && notifPanelAnchor.contains(e.target)) return;
        closeNotifPanel();
      }
      function toggleNotifPanel(anchor) {
        if (notifPanelEl) { closeNotifPanel(); return; }
        closeMenu(); closePopover();
        var panel = el('<div class="dl-notif-panel" role="dialog" aria-label="Notifications"><div class="dl-notif-head">Notifications</div>' +
          '<div class="dl-notif-empty"><span class="dl-notif-empty-ic">' + icon("bell", 20) + '</span><div class="dl-notif-empty-title">You’re all caught up</div><div class="dl-notif-empty-sub">New notifications will show up here.</div></div></div>');
        document.body.appendChild(panel);
        var r = anchor.getBoundingClientRect(), w = panel.offsetWidth;
        var group = anchor.closest(".head-right"), edge = group ? group.getBoundingClientRect().right : r.right;   /* flush with the header actions' right edge */
        panel.style.top = Math.round(r.bottom + 8) + "px";
        panel.style.left = Math.round(Math.max(8, Math.min(edge - w, window.innerWidth - w - 8))) + "px";
        notifPanelEl = panel; notifPanelAnchor = anchor;
        if (window.daylightNotifications) window.daylightNotifications.mount(panel);
        anchor.setAttribute("aria-expanded", "true");
        document.addEventListener("mousedown", notifOutside, true);
        window.addEventListener("resize", closeNotifPanel);
      }
      function showCalendar() {
        closeMenu();
        state.section = "calendar";
        renderAll(true, 1);
        closeDrawer();
      }
      function showTasks() {
        closeMenu();
        state.section = "tasks";
        renderAll(true, 1);
        closeDrawer();
      }
      function pageMonth(dir) {
        /* The header ‹ › arrows in Month, Week, and Agenda page by
           ONE month — the label follows the month they land on. */
        state.cursor = addMonths(state.cursor, dir);
        renderAll(true, dir);
      }
      function pageDay(dir) {
        /* The header ‹ › arrows in Day view page by ONE day — the
           header label (the full date) follows the day shown, and
           the selection moves with it. */
        state.cursor = addDays(state.cursor, dir);
        state.selected = sod(state.cursor);
        renderAll(true, dir);
      }
      function goTodayMonth() {
        /* The header's back-to-today button: MONTH view anchored on
           the current month, today selected — the one place a
           button switches the view, at Joey's explicit request. */
        state.section = "calendar";
        state.view = "month"; state.prevView = null;
        var fromCursor = state.cursor;
        state.cursor = sod(TODAY); state.selected = sod(TODAY);
        renderAll(true, state.cursor < fromCursor ? -1 : 1);
      }
      function goToday() {
        /* Main calendar only — the sidebar mini calendar keeps its own month. */
        state.section = "calendar";
        var fromCursor = state.cursor;
        state.cursor = sod(TODAY); state.selected = sod(TODAY);
        renderAll(true, state.cursor < fromCursor ? -1 : 1);
      }
      function pageBy(dir, animate) {
        /* In the Tasks section the arrow keys do not page anything. */
        if (state.section === "tasks") return;
        /* Main calendar only — do NOT sync state.miniCursor here.
           Keyboard paging passes animate=false: keyboard-initiated actions
           are never animated (Emil's rule). */
        var c = state.cursor;
        if (state.view === "month") state.cursor = addMonths(c, dir);
        else if (state.view === "week") state.cursor = addDays(c, 7 * dir);
        else if (state.view === "day") state.cursor = addDays(c, dir);
        else state.cursor = addDays(c, 21 * dir);
        if (state.view === "day") state.selected = sod(state.cursor);
        renderAll(animate !== false, dir);
      }
      function renderAll(animate, dir) {
        document.body.classList.toggle("dl-reduce-motion",!!state.reduceMotion);
        refreshToday();
        renderHeader(); renderSidebar(); renderView(animate, dir);
      }

      /* ================= Views ================= */
      var viewWrap = document.getElementById("viewWrap");
        var dragEventId=null,dragOccurrenceStart=null;
        viewWrap.addEventListener("dragstart",function(e){var chip=e.target.closest(".chip,.dl-continuous-bar");if(!chip||state.section!=="calendar"||state.view!=="month")return;dragEventId=Number(chip.dataset.eventId);dragOccurrenceStart=chip.dataset.occStart||"";if(!dragEventId){e.preventDefault();return}e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(dragEventId))});
        viewWrap.addEventListener("dragend",function(){dragEventId=null;dragOccurrenceStart=null});
        viewWrap.addEventListener("dragover",function(e){if(state.section==="calendar"&&state.view==="month"&&e.target.closest(".day-cell")){e.preventDefault();e.dataTransfer.dropEffect="move"}});
        viewWrap.addEventListener("drop",function(e){
          var cell=e.target.closest(".day-cell");if(!cell||!dragEventId)return;e.preventDefault();
          var ev=state.events.find(x=>Number(x.id)===dragEventId),target=cell.dataset.date;if(!ev||!target)return;
          var p=target.split("-").map(Number),day=new Date(p[0],p[1]-1,p[2]),occStart=dragOccurrenceStart?new Date(dragOccurrenceStart):new Date(ev.start),delta=sod(day).getTime()-sod(occStart).getTime();
          function move(scope){
            if(scope==="only"){ev.uid=ev.uid||("daylight-"+ev.id);var copy=Object.assign({},ev,{id:++uid,recurrenceId:occStart,repeat:null,exdates:[],start:new Date(occStart.getTime()+delta),end:new Date(occStart.getTime()+delta+(ev.end-ev.start))});state.events.push(copy);ev.exdates=Array.isArray(ev.exdates)?ev.exdates.slice():[];ev.exdates.push(occStart.toISOString())}
            else if(scope==="following"){ev.repeatEnd=previousRepeatOccurrence(occStart,ev.repeat).toISOString();state.events.push(Object.assign({},ev,{id:++uid,start:new Date(occStart.getTime()+delta),end:new Date(occStart.getTime()+delta+(ev.end-ev.start)),repeatEnd:null}))}
            else{ev.start=new Date(ev.start.getTime()+delta);ev.end=new Date(ev.end.getTime()+delta)}
            renderAll(false);toast("Event moved");
          }
          if(ev.repeat&&occStart.getTime()!==ev.start.getTime())chooseRepeatScope("Move repeating event","Choose which occurrences to move.",move);else move("all");
          dragEventId=null;dragOccurrenceStart=null;
        });
        var monthTouchStart=null;
        viewWrap.addEventListener("touchstart",function(e){if(state.section==="calendar"&&state.view==="month"&&e.touches.length===1)monthTouchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
        viewWrap.addEventListener("touchend",function(e){if(!monthTouchStart||state.section!=="calendar"||state.view!=="month")return;var dx=e.changedTouches[0].clientX-monthTouchStart.x,dy=e.changedTouches[0].clientY-monthTouchStart.y;monthTouchStart=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.25)pageBy(dx<0?1:-1,true)},{passive:true});
        viewWrap.addEventListener("wheel",function(e){if(state.section!=="calendar"||state.view!=="month")return;if(Math.abs(e.deltaX)>55&&Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.35){e.preventDefault();pageBy(e.deltaX>0?1:-1,true)}},{passive:false});
      var reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
      function renderView(animate, dir) {
        closePopover(); closeMenu();
        viewWrap.innerHTML = "";
        var node;
        if (state.section === "tasks") node = renderTasks();
        else if (state.view === "month") node = renderMonth();
        else if (state.view === "week") node = renderTimeGrid(weekDays(state.cursor));
        else if (state.view === "day") node = renderTimeGrid([sod(state.cursor)]);
        else node = renderAgenda();
        viewWrap.appendChild(node);
        if (animate && !state.reduceMotion && !reduceMotionMQ.matches) {
          node.classList.add(dir < 0 ? "anim-prev" : "anim-next");
          /* Mini calendar is decoupled — it does not slide with the main view. */
        }
        if (state.view === "week" || state.view === "day") {
          var sc = viewWrap.querySelector(".tg-scroll");
          if(sc){
            var days=state.view==="day"?[sod(state.cursor)]:weekDays(state.cursor);
            var relevant=occsInRange(days[0],addDays(days[days.length-1],1)).filter(function(o){return !o.ev.allDay;});
            var today=days.some(function(d){return sameDay(d,TODAY);});
            var anchor=today?(new Date().getHours()+new Date().getMinutes()/60-1):(Number(state.workStart||540)/60);
            relevant.forEach(function(o){var hour=o.start.getHours()+o.start.getMinutes()/60;if(hour<anchor)anchor=hour;});
            sc.scrollTop=Math.max(0,anchor*hourPx()-14);
          }
        }
      }
      function drillToDay(date) {
        state.section = "calendar";
        if (state.view !== "day") { state.prevView = state.view; state.prevCursor = new Date(state.cursor); }
        state.view = "day"; state.cursor = sod(date); state.selected = sod(date);
        renderAll(true, 1);
      }
      function segClass(occ, date, firstCol, lastCol) {
        var s = sameDay(occ.start, date), e = sameDay(sod(occ.end), date) || sameDay(occ.end, date);
        var multi = sod(occ.end) - sod(occ.start) >= DAY_MS || (occ.ev.allDay && sod(occ.end) > sod(occ.start));
        if (!occ.ev.allDay && !multi) return "";
        if (occ.ev.allDay && !multi) return "";
        if (s && e) return "";
        if (s) return " seg-start";
        if (e) return " seg-end";
        if (firstCol) return " seg-start";
        if (lastCol) return " seg-end";
        return " seg-mid";
      }
      function isMultiDay(occ) { return sod(occ.end) - sod(occ.start) >= DAY_MS; }
      /* "Only include weekdays": ONE event record (ev.weekdaysOnly) that covers Monday-Friday inside its full
         start..end range. Every view asks coversDay() instead of comparing dates itself. */
      function coversDay(o, date) {
        if (sod(o.start) > date || sod(o.end) < date) return false;
        if (o.ev && o.ev.weekdaysOnly) { var g = date.getDay(); if (g === 0 || g === 6) return false; }
        return true;
      }
      function dayRuns(indexes) {
        var runs = [], run = [];
        indexes.forEach(function (n) { if (run.length && n !== run[run.length - 1] + 1) { runs.push(run); run = []; } run.push(n); });
        if (run.length) runs.push(run);
        return runs;
      }
      function rangeHasWeekday(start, end) {
        for (var d = sod(start); d <= sod(end); d = addDays(d, 1)) { var g = d.getDay(); if (g !== 0 && g !== 6) return true; }
        return false;
      }

      function renderMonth() {
        var wrap = el('<div class="month-wrap"></div>');
        var y = state.cursor.getFullYear(), m = state.cursor.getMonth();
        var dows = visibleDows();
        var colTpl = (state.weekNumbers ? "30px " : "") + "repeat(" + dows.length + ", 1fr)";
        var dow = el('<div class="dow-row' + (state.weekNumbers ? " has-wn" : "") + '">' + (state.weekNumbers ? "<span></span>" : "") + dows.map(function (g) { return '<span class="dow-cell">' + DOWS_S[g] + "</span>"; }).join("") + "</div>");
        dow.style.gridTemplateColumns = colTpl;
        wrap.appendChild(dow);
        var grid = el('<div class="month-grid"></div>');
        var start = weekStartOf(new Date(y, m, 1));
        var rangeEnd = addDays(start, 42);
        var occs = occsInRange(start, rangeEnd);
        for (var w = 0; w < 6; w++) {
          var rowStart = addDays(start, w * 7);
          var spans=[];
          occs.forEach(function(o){
            if(!isMultiDay(o))return;
            var positions=dows.map(function(day,i){return {i:i,date:addDays(rowStart,(day-state.weekStart+7)%7)}})
              .filter(function(x){return coversDay(o,x.date)});
            if(!positions.length)return;
            if(spans.some(function(x){return x.o.ev.id===o.ev.id&&+x.o.start===+o.start}))return;
            dayRuns(positions.map(function(x){return x.i})).forEach(function(run){
              spans.push({o:o,first:run[0],last:run[run.length-1]});
            });
          });
          spans.sort(function(a,b){return a.o.start-b.o.start});
          var row = el('<div class="month-week' + (state.weekNumbers ? " has-wn" : "") + '"></div>');
          row.style.gridTemplateColumns = colTpl;
          if (state.weekNumbers) row.appendChild(el('<div class="wn-cell">' + isoWeek(addDays(rowStart, 3)) + "</div>"));
          for (var d = 0; d < 7; d++) {
            var cellDate = addDays(rowStart, d);
            var colIdx = dows.indexOf(cellDate.getDay());
            if (colIdx < 0) continue;
            (function (date, colIdx) {
              var inMonth = date.getMonth() === m;
              var dayOccs = occs.filter(function (o) { return !isMultiDay(o) && sod(o.start) <= date && sod(o.end) >= date; });
              dayOccs.sort(function (a, b) {
                var am = (a.ev.allDay || isMultiDay(a)) ? 0 : 1, bm = (b.ev.allDay || isMultiDay(b)) ? 0 : 1;
                if (am !== bm) return am - bm;
                return a.start - b.start;
              });
              var cell = el('<div class="day-cell' + (inMonth ? "" : " out") + (sameDay(date, TODAY) ? " today" : "") + (sameDay(date, state.selected) ? " sel" : "") + '"></div>');
              cell.dataset.date=date.getFullYear()+"-"+pad2(date.getMonth()+1)+"-"+pad2(date.getDate());
              var num = el('<button class="day-num' + (!inMonth && date.getDate() === 1 ? " edge-month" : "") + '" title="' + esc(fmtDateLong(date)) + '">' + calendarDayLabel(date, m) + "</button>");
              num.addEventListener("click", function (e) { e.stopPropagation(); drillToDay(date); });   /* the date number opens that day; the empty cell area still opens New event */
              cell.appendChild(num);
              var add = el('<button class="cell-add" title="Add event" aria-label="Add event on ' + esc(fmtDateLong(date)) + '">' + icon("plus", 14) + "</button>");
              add.addEventListener("click", function (e) { e.stopPropagation(); openEventForm(null, date); });
              cell.appendChild(add);
              var evBox = el('<div class="cell-events"></div>');
              var laneForCell=-1;
              spans.forEach(function(span,lane){
                if(span.first<=colIdx&&span.last>=colIdx)laneForCell=Math.max(laneForCell,lane);
              });
              if(laneForCell>=0){evBox.style.paddingTop=(laneForCell+1)*25+"px";evBox.dataset.lanes=String(laneForCell+1);}
              dayOccs.forEach(function (o) {
                var cal = calOf(o.ev.cal);
                var seg = segClass(o, date, colIdx === 0, colIdx === dows.length - 1);
                var isStart = sameDay(o.start, date) || colIdx === 0;
                var chip = el('<button draggable="true" data-event-id="' + esc(o.ev.id) + '" data-occ-start="' + esc(o.start.toISOString()) + '" class="chip' + seg + '" style="background:' + tintOf(cal,o.ev) + ";color:" + tintTextOf(cal,o.ev) + ";box-shadow:" + ribbonOf(cal,o.ev) + '">' +
                  (isStart || seg === "" ? '<span class="chip-title">' + esc(o.ev.title) + "</span>" + (!o.ev.allDay && !isMultiDay(o) ? '<span class="chip-time">' + fmtEventTime(o.start) + "</span>" : "") : '<span class="chip-title">&nbsp;</span>') +
                  "</button>");
                chip.setAttribute("data-calendar-id",o.ev.cal);
                chip.setAttribute("aria-label", o.ev.title);
                chip.addEventListener("click", function (e) { openPopover(o, chip); e.stopPropagation(); });
                evBox.appendChild(chip);
              });
              if (dayOccs.length) {
                var more = el('<button class="more-link" hidden></button>');
                more.addEventListener("click", function (e) { e.stopPropagation(); drillToDay(date); });
                evBox.appendChild(more);
              }
              cell.appendChild(evBox);
              cell.addEventListener("click", function (e) {
                if(e.target.closest("button"))return;
                state.selected=sod(date);openEventForm(null,date);
              });
              row.appendChild(cell);
            })(cellDate, colIdx);
          }
          if(spans.length){
            row.style.position="relative";
            var layer=el('<div class="dl-month-span-layer"></div>');
            spans.forEach(function(sp,lane){
              var o=sp.o,cal=calOf(o.ev.cal);
              var bar=el('<button draggable="true" data-event-id="'+esc(o.ev.id)+'" data-occ-start="'+esc(o.start.toISOString())+'" class="dl-continuous-bar" style="background:'+tintOf(cal,o.ev)+';color:'+tintTextOf(cal,o.ev)+';box-shadow:'+ribbonOf(cal,o.ev)+'">'+esc(o.ev.title)+'</button>');
              var key=String(o.ev.id)+':'+(+o.start);
              bar.dataset.spanKey=key;
              bar.setAttribute("aria-label",o.ev.title);
              bar.style.left='calc('+(state.weekNumbers?'30px + ':'')+'(100%'+(state.weekNumbers?' - 30px':'')+') * '+sp.first+'/'+dows.length+')';
              bar.style.width='calc((100%'+(state.weekNumbers?' - 30px':'')+') * '+(sp.last-sp.first+1)+'/'+dows.length+' - 2px)';
              bar.style.top=(34+lane*25)+'px';
              bar.dataset.lane=String(lane);bar.dataset.first=String(sp.first);bar.dataset.last=String(sp.last);
              bar.addEventListener("mouseenter",function(){viewWrap.querySelectorAll('[data-span-key="'+key+'"]').forEach(function(n){n.classList.add("dl-span-active")})});
              bar.addEventListener("mouseleave",function(){viewWrap.querySelectorAll('[data-span-key="'+key+'"]').forEach(function(n){n.classList.remove("dl-span-active")})});
              bar.addEventListener("click",function(e){
  e.stopPropagation();openPopover(o,bar);
  if(popEl&&popEl._occId===o.ev.id){
    viewWrap.querySelectorAll('[data-span-key="'+key+'"]').forEach(function(n){n.classList.add('dl-span-selected')});
  }
});
              layer.appendChild(bar);
            });
            row.appendChild(layer);
          }
          grid.appendChild(row);
        }
        wrap.appendChild(grid);
        requestAnimationFrame(function(){observeMonthChipLayout(grid);});
        return wrap;
      }

      var monthChipObserver=null;
      /* Fit chips (and multi-day bars) to what each cell can actually show.
         Nothing is estimated and left unchecked: after choosing counts, the
         real rendered bottoms are measured and counts are reduced until no
         visible chip, bar or "+N more" crosses the cell's inner bottom. When
         stacked multi-day bars leave no room, the lowest bars are folded
         into "+N more" too. */
      function fitMonthChipCounts(grid){
        if(!grid||!grid.isConnected)return;
        var LANE=25,LANE_TOP=34;
        var rows=Array.prototype.slice.call(grid.querySelectorAll(".month-week"));
        rows.forEach(function(row){
          var cells=Array.prototype.slice.call(row.querySelectorAll(".day-cell"));
          if(!cells.length)return;
          var rowHeight=row.getBoundingClientRect().height;
          var bars=Array.prototype.slice.call(row.querySelectorAll(".dl-continuous-bar"));
          bars.forEach(function(bar){bar.hidden=false;});
          var probe=cells[0].querySelector(".more-link"),moreHeight=18;
          if(probe){var wasHidden=probe.hidden;probe.hidden=false;moreHeight=probe.getBoundingClientRect().height||18;probe.hidden=wasHidden;}
          /* Lanes that fit above one "+N more" line (and at least the date row). */
          var capacity=Math.max(0,Math.floor((rowHeight-LANE_TOP-moreHeight-6)/LANE));
          var foldedByCol=[];
          bars.forEach(function(bar){
            if(Number(bar.dataset.lane)<capacity)return;
            bar.hidden=true;
            for(var c=Number(bar.dataset.first);c<=Number(bar.dataset.last);c++)foldedByCol[c]=(foldedByCol[c]||0)+1;
          });
          var hasWn=row.classList.contains("has-wn");
          cells.forEach(function(cell,col){
            var box=cell.querySelector(".cell-events");if(!box)return;
            var lanes=Number(box.dataset.lanes||0);
            if(lanes)box.style.paddingTop=Math.min(lanes,capacity)*LANE+"px";
            var folded=foldedByCol[col]||0;
            var chips=Array.prototype.slice.call(box.querySelectorAll(".chip")),more=box.querySelector(".more-link");
            if(!chips.length&&!folded){if(more)more.hidden=true;return;}
            if(!more){more=document.createElement("button");more.className="more-link";more.hidden=true;
              (function(date){more.addEventListener("click",function(e){e.stopPropagation();drillToDay(date);});})(parseDateKey(cell.dataset.date));
              box.appendChild(more);}
            function limit(){var cr=cell.getBoundingClientRect();return cr.top+cell.clientTop+cell.clientHeight-(parseFloat(getComputedStyle(cell).paddingBottom)||0)-1;}
            function apply(count){
              chips.forEach(function(chip,i){chip.hidden=i>=count;});
              var hidden=chips.length-count+folded;
              more.textContent="+"+hidden+" more";more.hidden=hidden===0;
            }
            function overflows(){
              var edge=limit(),last=null;
              Array.prototype.slice.call(box.children).forEach(function(k){if(!k.hidden&&k.getClientRects().length)last=k;});
              return !!last&&last.getBoundingClientRect().bottom>edge+0.5;
            }
            var count=chips.length;
            apply(count);
            while(count>=0&&overflows()){count--;apply(Math.max(count,0));if(count<0)break;}
          });
        });
      }
      function parseDateKey(key){var p=String(key).split("-").map(Number);return new Date(p[0],p[1]-1,p[2]);}
      function observeMonthChipLayout(grid){
        if(monthChipObserver)monthChipObserver.disconnect();
        if(!grid||!grid.isConnected)return;
        var schedule=function(){requestAnimationFrame(function(){fitMonthChipCounts(grid);});};
        if(typeof ResizeObserver==="function"){
          monthChipObserver=new ResizeObserver(schedule);
          monthChipObserver.observe(grid);
          grid.querySelectorAll(".day-cell").forEach(function(cell){monthChipObserver.observe(cell);});
        }
        /* Re-fit when web fonts land or an entry animation finishes: both
           change chip metrics without resizing any cell. */
        if(document.fonts&&document.fonts.ready)document.fonts.ready.then(schedule);
        grid.parentNode&&grid.parentNode.addEventListener("animationend",schedule,{once:true});
        window.addEventListener("resize",schedule);
        schedule();
      }

      function layoutDayEvents(list) {
        var items = list.map(function (o) {
          return { o: o, s: o.start.getHours() * 60 + o.start.getMinutes(), e: o.end.getHours() * 60 + o.end.getMinutes(), col: 0, cols: 1 };
        }).sort(function (a, b) { return a.s - b.s || b.e - a.e; });
        var clusters = [], cur = [], curEnd = -1;
        items.forEach(function (it) {
          if (cur.length && it.s >= curEnd) { clusters.push(cur); cur = []; curEnd = -1; }
          cur.push(it); curEnd = Math.max(curEnd, it.e);
        });
        if (cur.length) clusters.push(cur);
        clusters.forEach(function (cl) {
          var cols = [];
          cl.forEach(function (it) {
            var placed = false;
            for (var i = 0; i < cols.length; i++) if (cols[i] <= it.s) { it.col = i; cols[i] = it.e; placed = true; break; }
            if (!placed) { it.col = cols.length; cols.push(it.e); }
          });
          cl.forEach(function (it) { it.cols = cols.length; });
        });
        return items;
      }
      /* Cron's empty state, shared by Day, Week, Agenda, and search:
         icon badge, a title line, one large + New event button, and
         the command-bar hint underneath. The title and sub are
         optional — Day view passes neither, so its empty state is
         the badge and the button with no wording at all. */
      function buildEmptyState(cfg) {
        var mod = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";
        var wrap = el('<div class="empty-state"><span class="es-badge">' + icon(cfg.icon || "calendar", 24) + "</span>" + (cfg.title ? '<div class="es-title">' + esc(cfg.title) + "</div>" : "") + (cfg.sub ? '<p class="es-sub">' + esc(cfg.sub) + "</p>" : "") + "</div>");
        if (cfg.btnLabel) {
          var b = el('<button class="btn-primary es-btn">' + icon("plus", 16) + "<span>" + esc(cfg.btnLabel) + "</span></button>");
          b.addEventListener("click", cfg.onBtn);
          wrap.appendChild(b);
        }
        if (cfg.hint !== false) {
          wrap.appendChild(el('<div class="es-hint"><span class="kbd">' + mod + '</span><span class="kbd">K</span><span>to search events</span></div>'));
        }
        return wrap;
      }

      function renderTimeGrid(days) {
        var numDays = days.length;
        var firstDay = days[0];
        var rangeEnd = addDays(days[numDays - 1], 1);
        var occs = occsInRange(firstDay, rangeEnd);
        var gridCols = "var(--tg-gutter) repeat(" + numDays + ", minmax(0, 1fr))";
        var wrap = el('<div class="tg-wrap' + (numDays > 1 ? " tg-week" : " tg-day") + '"></div>');
        var head = el('<div class="tg-head" style="grid-template-columns:' + gridCols + '"></div>');
        head.appendChild(el('<div class="tg-gutter-head"><span>' + esc(gmtLabel(effectiveTz())) + "</span></div>"));
        days.forEach(function (date) {
          var isToday = sameDay(date, TODAY);
          var h = el('<div class="tg-day-head' + (isToday ? " today" : "") + '"><span class="dow">' + DOWS_S[date.getDay()] + '</span><button class="dnum">' + date.getDate() + "</button></div>");
          h.querySelector(".dnum").addEventListener("click", function () { if (numDays > 1) drillToDay(date); });
          head.appendChild(h);
        });
        wrap.appendChild(head);
        var adRow = el('<div class="allday-row" style="grid-template-columns:' + gridCols + '"></div>');
        adRow.appendChild(el('<div class="allday-label">All-day</div>'));
        var weekSpans=occs.filter(function(o){return numDays>1&&isMultiDay(o)});
        days.forEach(function(date){
          var cell=el('<div class="allday-cell"></div>');
          if(weekSpans.length)cell.style.paddingTop=(weekSpans.length*27+3)+"px";
          occs.filter(function(o){return o.ev.allDay&&(numDays===1||!isMultiDay(o))&&coversDay(o,date)})
            .forEach(function(o){
              var cal=calOf(o.ev.cal),bar=el('<button class="allday-bar" style="background:'+tintOf(cal,o.ev)+';color:'+tintTextOf(cal,o.ev)+';box-shadow:'+ribbonOf(cal,o.ev)+'">'+esc(o.ev.title)+'</button>');
              bar.setAttribute("data-calendar-id",o.ev.cal);
              bar.addEventListener("click",function(e){e.stopPropagation();openPopover(o,bar)});
              cell.appendChild(bar);
            });
          adRow.appendChild(cell);
        });
        if(weekSpans.length){
          adRow.style.position="relative";
          var layer=el('<div class="dl-week-span-layer"></div>');
          weekSpans.forEach(function(o,i){
            var allPositions=days.map(function(d,k){return coversDay(o,d)?k:-1}).filter(function(k){return k>=0});
            if(!allPositions.length)return;
            dayRuns(allPositions).forEach(function(positions){
            var cal=calOf(o.ev.cal),bar=el('<button class="dl-continuous-bar" style="background:'+tintOf(cal,o.ev)+';color:'+tintTextOf(cal,o.ev)+';box-shadow:'+ribbonOf(cal,o.ev)+'">'+esc(o.ev.title)+'</button>');
            var key=String(o.ev.id)+':'+(+o.start);
            bar.dataset.spanKey=key;bar.setAttribute("aria-label",o.ev.title);
            bar.style.left='calc((100% - var(--tg-gutter)) * '+positions[0]+'/'+numDays+' + var(--tg-gutter))';
            bar.style.width='calc((100% - var(--tg-gutter)) * '+(positions[positions.length-1]-positions[0]+1)+'/'+numDays+' - 3px)';
            bar.style.top=(3+i*27)+'px';
            bar.addEventListener("mouseenter",function(){viewWrap.querySelectorAll('[data-span-key="'+key+'"]').forEach(function(n){n.classList.add("dl-span-active")})});
            bar.addEventListener("mouseleave",function(){viewWrap.querySelectorAll('[data-span-key="'+key+'"]').forEach(function(n){n.classList.remove("dl-span-active")})});
            bar.addEventListener("click",function(e){
  e.stopPropagation();openPopover(o,bar);
  if(popEl&&popEl._occId===o.ev.id){
    viewWrap.querySelectorAll('[data-span-key="'+key+'"]').forEach(function(n){n.classList.add('dl-span-selected')});
  }
});
            layer.appendChild(bar);
            });
          });
          adRow.appendChild(layer);
        }
        wrap.appendChild(adRow);
        /* Even when Day view has no events, render the complete timeline,
           all-day area and current-time indicator. Empty slots remain clickable.
           Week view retains its existing empty-state treatment. */
        if (occs.length === 0 && numDays !== 1) {
          wrap.appendChild(buildEmptyState({
            icon: "calendar",
            title: "No events",
            sub: "Nothing is scheduled this week.",
            btnLabel: "New event",
            onBtn: function () { openEventForm(null, state.selected); }
          }));
          return wrap;
        }
        var scroll = el('<div class="tg-scroll"></div>');
        var body = el('<div class="tg-body" style="grid-template-columns:' + gridCols + ";height:" + 24 * hourPx() + 'px"></div>');
        var gutter = el('<div class="tg-gutter"></div>');
        for (var hr = 0; hr < 24; hr++) {
          var lab = el('<span class="hour-label' + (hr === 0 ? " is-first" : "") + '" style="top:' + hr * hourPx() + 'px">' + fmtHourLabel(hr) + "</span>");
          gutter.appendChild(lab);
        }
        body.appendChild(gutter);
        var now = new Date();
        var nowMin = now.getHours() * 60 + now.getMinutes();
        var todayInRange = days.some(function (d) { return sameDay(d, TODAY); });
        days.forEach(function (date) {
          var isWeekendCol = numDays > 1 && (date.getDay() === 0 || date.getDay() === 6);
          var colEl = el('<div class="tg-col' + (isWeekendCol ? " weekend" : "") + '"><div class="hour-lines" style="background-size:100% ' + hourPx() + 'px"></div></div>');
          var dayOccs = occs.filter(function (o) { return !o.ev.allDay && (numDays===1||!isMultiDay(o)) && sameDay(o.start, date); });
          layoutDayEvents(dayOccs).forEach(function (it) {
            var o = it.o, cal = calOf(o.ev.cal);
            var top = it.s / 60 * hourPx(), height = Math.max(26, (it.e - it.s) / 60 * hourPx() - 3);
            var leftPct = it.col / it.cols * 100, widthPct = 100 / it.cols;
            var card = el('<button class="ev-card" style="top:' + top + "px;height:" + height + "px;left:calc(" + leftPct + "% + 3px);width:calc(" + widthPct + "% - 6px);background:" + tintOf(cal,o.ev) + ";color:" + tintTextOf(cal,o.ev) + ";box-shadow:" + ribbonOf(cal,o.ev) + '">' +
              '<span class="ev-head"><span class="ev-title">' + esc(o.ev.title) + "</span>" +
              (height >= 44 ? '<span class="ev-time" style="display:block">' + fmtTimeRange(o.start, o.end) + "</span>" : "") + "</span>" +
              (o.loc && height >= 66 ? '<span class="ev-loc" style="display:block">' + esc(o.loc) + "</span>" : "") +
              "</button>");
            card.setAttribute("data-calendar-id",o.ev.cal);
            if (height < 58) card.querySelector(".ev-title").style.webkitLineClamp = "1";
            card.addEventListener("click", function (e) { openPopover(o, card); e.stopPropagation(); });
            colEl.appendChild(card);
          });
          colEl.addEventListener("click",function(e){
            if(e.target.closest("button"))return;
            var box=colEl.getBoundingClientRect();
            var minute=Math.max(0,Math.min(1410,Math.floor((e.clientY-box.top)/hourPx()*2)*30));
            var chosen=new Date(date);chosen.slotMinutes=minute;openEventForm(null,chosen);
          });
          body.appendChild(colEl);
        });
        if (todayInRange) {
          var line = el('<div class="now-line" style="top:' + nowMin / 60 * hourPx() + 'px;left:var(--tg-gutter)"></div>');
          body.appendChild(line);
          var nowTxt = fmtEventTime(now);
          var gutPill = el('<span class="now-pill" style="top:' + nowMin / 60 * hourPx() + 'px">' + nowTxt + "</span>");
          body.appendChild(gutPill);
        }
        scroll.appendChild(body);
        wrap.appendChild(scroll);
        /* A time line that is only partly visible (cut by the scroll edge) is hidden entirely: fully shown, or not at all. */
        /* "Whole" means both: not cut by the scroll edge, and not cut by the block's width (a narrow column would show a stray
           "…" or the tail of the range), so a time line is shown fully or not at all. */
        var timeFits = function (t) { return t.scrollWidth <= t.clientWidth + 1; };
        var timeSeen = new WeakMap();
        var timePaint = function (t) { t.style.visibility = (timeSeen.get(t) !== false && timeFits(t)) ? "" : "hidden"; };
        if (window.IntersectionObserver) {
          var timeWatch = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { timeSeen.set(en.target, en.intersectionRatio >= 0.999); timePaint(en.target); });
          }, { root: scroll, threshold: [0, 0.999, 1] });
          body.querySelectorAll(".ev-time").forEach(function (t) { timeWatch.observe(t); });
        }
        requestAnimationFrame(function () { body.querySelectorAll(".ev-time").forEach(timePaint); });
        return wrap;
      }

      function renderAgenda() {
        var start = sod(state.cursor), end = addDays(start, 21);
        var occs = occsInRange(start, end);
        var byDay = {};
        occs.forEach(function (o) {
          var first = sod(o.start);
          if (o.ev.weekdaysOnly) { while (first <= sod(o.end) && !coversDay(o, first)) first = addDays(first, 1); if (first > sod(o.end)) return; }
          var key = first.getTime();
          (byDay[key] = byDay[key] || []).push(o);
        });
        var scroll = el('<div class="agenda-scroll"></div>');
        var inner = el('<div class="agenda-inner"></div>');
        var agSelect = window.daylightSelect && daylightSelect.entry("agenda", function () { renderView(false); });
        if (agSelect) inner.appendChild(agSelect);
        var keys = Object.keys(byDay).sort(function (a, b) { return a - b; });
        if (!keys.length) {
          inner.appendChild(buildEmptyState({
            icon: "calendar",
            title: "No events coming up",
            sub: "Nothing is scheduled in the next three weeks.",
            btnLabel: "New event",
            onBtn: function () { openEventForm(null, state.selected); }
          }));
        }
        keys.forEach(function (k) {
          var date = new Date(+k);
          var head = el('<div class="agenda-day-head"><span class="ad-name">' + DOWS[date.getDay()] + '</span><span class="ad-date">' + fmtDateShort(date) + "</span>" + (sameDay(date, TODAY) ? '<span class="ad-today">Today</span>' : "") + "</div>");
          inner.appendChild(head);
          byDay[k].slice().sort(function (a, b) { return (a.ev.allDay ? 0 : 1) - (b.ev.allDay ? 0 : 1) || a.start - b.start; }).forEach(function (o) {
            var cal = calOf(o.ev.cal);
            var meta = isAllDayLike(o.ev, o.start, o.end)
              ? (o.ev.allDay && isMultiDay(o) ? fmtDateShort(o.start) + " - " + fmtDateShort(sod(o.end)) : "All day")
              : fmtTimeRange(o.start, o.end);
            var card = el('<button class="agenda-card">' +
              '<span class="ac-dot" style="background:' + dotOf(cal) + '"></span>' +
              '<span class="agenda-details"><span class="ac-title">' + esc(o.ev.title) + '</span><span class="ac-meta" style="display:flex"><span class="agenda-cal-name">' + esc(cal.name) + '</span>' + icon("clock", 13) + "<span>" + esc(meta) + "</span></span>" +
              (o.ev.loc ? '<span class="agenda-location">' + icon("pin",13) + '<span>'+esc(o.ev.loc)+'</span></span>' : '') +
              "</span></button>");
            card.addEventListener("click", function (e) { openPopover(o, card); e.stopPropagation(); });
            if (window.daylightSelect) daylightSelect.decorate(card, o.ev, "agenda");
            inner.appendChild(card);
          });
        });
        if (keys.length) inner.appendChild(el('<div class="agenda-end">No more events in ' + MONTHS[addDays(start, 20).getMonth()] + '</div>'));
        scroll.appendChild(inner);
        var w = el('<div style="display:flex;flex-direction:column;flex:1;min-height:0"></div>');
        w.appendChild(scroll);
        var agBar = window.daylightSelect && daylightSelect.bar("agenda");
        if (agBar) inner.appendChild(agBar);
        return w;
      }

      /* ================= Tasks =================
         A first-class section that swaps into the main area in
         place of the calendar (the sidebar never moves). Tasks are
         plain in-memory records like events: { id, title, cal,
         due (Date), hasTime, done }. The add form's draft survives
         re-renders via taskDraft, so toggling a checkbox never eats
         a half-typed title. */
      var taskDraft = { title: "", date: null, cal: null };
      function taskDueLabel(t) {
        var rel = fmtRelativeDay(t.due);
        var base = rel || fmtDateShort(t.due);
        if (!rel && !sameDay(t.due, TODAY)) base = DOWS[t.due.getDay()] + " · " + base;
        if (t.hasTime) base += " · " + fmtTime(t.due);
        return base;
      }
      function refreshTasks(focusInput) {
        renderView(false);
        if (focusInput) {
          var i = document.getElementById("taskTitleInput");
          if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} }
        }
      }
      function renderTasks() {
        if (!taskDraft.date) taskDraft.date = sod(TODAY);
        if (!taskDraft.cal) taskDraft.cal = defaultCalId();
        var wrap = el('<div class="tasks-wrap"></div>');
        var inner = el('<div class="tasks-inner"></div>');
        wrap.appendChild(inner);
        var activeCount = state.tasks.filter(function (t) { return !t.done; }).length;
        var doneCount = state.tasks.length - activeCount;
        var head = el('<div class="tasks-head"><div><div class="tasks-title">Tasks</div><div class="tasks-sub">' +
          (state.tasks.length ? activeCount + " active · " + doneCount + " completed" : "Nothing here yet") +
          '</div></div></div>');
        var headAdd = el('<button class="btn-primary">' + icon("plus", 16) + "<span>Add task</span></button>");
        headAdd.addEventListener("click", function () { var i = document.getElementById("taskTitleInput"); if (i) { i.focus(); i.scrollIntoView({ block: "nearest" }); } });
        head.appendChild(headAdd);
        inner.appendChild(head);
        /* Add form — one card: title input, due-date picker (the
           calendar's own date popover), calendar picker (the app's
           menu), and the Add button. Enter in the title also adds. */
        var addCard = el('<div class="task-add-card"></div>');
        var titleIn = el('<input class="text-input" id="taskTitleInput" type="text" placeholder="Add a task…" aria-label="Task title" autocomplete="off">');
        titleIn.value = taskDraft.title;
        titleIn.addEventListener("input", function () { taskDraft.title = titleIn.value; titleIn.classList.remove("err"); });
        titleIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addTaskFromDraft(); } });
        addCard.appendChild(titleIn);
        var dueBtn = el('<button class="picker-btn" id="taskDueBtn" title="Due date" aria-label="Due date">' + icon("calendar", 15) + "<span></span></button>");
        function paintDueBtn() { dueBtn.querySelector("span").textContent = taskDueLabel({ due: taskDraft.date, hasTime: false }); }
        paintDueBtn();
        dueBtn.addEventListener("click", function () {
          openDatePicker(dueBtn, taskDraft.date, function (d) { taskDraft.date = sod(d); paintDueBtn(); titleIn.focus(); });
        });
        addCard.appendChild(dueBtn);
        var calBtn = el('<button class="picker-btn" id="taskCalBtn" title="Calendar" aria-label="Calendar"><span></span><span style="margin-left:2px;color:var(--muted)">' + icon("chevD", 14) + "</span></button>");
        function paintCalBtn() {
          var c = calOf(taskDraft.cal);
          calBtn.querySelector("span").innerHTML = '<span style="display:inline-flex;align-items:center;gap:7px"><span class="pop-dot" style="background:' + dotOf(c) + ';margin:0"></span>' + esc(c.name) + "</span>";
        }
        paintCalBtn();
        calBtn.addEventListener("click", function () {
          var items = [{ label2: "Calendar" }];
          writableCalendars().forEach(function (c) {
            items.push({ label: c.name, right: taskDraft.cal === c.id ? "check" : null, fn: function () { taskDraft.cal = c.id; paintCalBtn(); } });
          });
          openMenu(calBtn, items);
        });
        addCard.appendChild(calBtn);
        var addBtn = el('<button class="btn-primary"><span>Add</span></button>');
        addBtn.addEventListener("click", addTaskFromDraft);
        addCard.appendChild(addBtn);
        inner.appendChild(addCard);
        function addTaskFromDraft() {
          var title = (taskDraft.title || "").trim();
          if (!title) { titleIn.classList.add("err"); titleIn.focus(); return; }
          state.tasks.push(mkTask(title, taskDraft.cal || defaultCalId(), sod(taskDraft.date), false, false));
          taskDraft.title = "";
          toast("Task added");
          refreshTasks(true);
          renderSidebar();
        }
        /* Segmented filter */
        var seg = el('<div class="task-seg" role="tablist" aria-label="Filter tasks"></div>');
        [["all", "All"], ["active", "Active"], ["completed", "Completed"]].forEach(function (f) {
          var b = el('<button role="tab" aria-selected="' + (state.taskFilter === f[0]) + '" class="' + (state.taskFilter === f[0] ? "on" : "") + '">' + f[1] + "</button>");
          b.addEventListener("click", function () {
            if (state.taskFilter === f[0]) return;
            state.taskFilter = f[0];
            seg.querySelectorAll("button").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", String(on)); });
            var host = inner.querySelector(".task-results");
            if (!host) { refreshTasks(false); return; }
            var token = (host._swap = (host._swap || 0) + 1);
            function swap() {
              if (host._swap !== token || !host.isConnected) return;
              host.innerHTML = ""; fillResults(host);
              host.classList.remove("is-out");
              if (!state.reduceMotion && !reduceMotionMQ.matches) { host.classList.add("is-in"); setTimeout(function () { host.classList.remove("is-in"); }, 230); }
            }
            /* cross-fade: the old list fades out (110ms), the new one fades in (200ms); reduced motion swaps instantly */
            if (state.reduceMotion || reduceMotionMQ.matches) { swap(); return; }
            host.classList.remove("is-in"); host.classList.add("is-out");
            setTimeout(swap, 110);
          });
          seg.appendChild(b);
        });
        inner.appendChild(seg);
        /* Groups — Overdue / Today / Upcoming / Completed, empty
           groups hidden, each sorted by due date. They live in their own container so a tab switch cross-fades ONLY the list
           (and the empty state), never the add card or the tabs. */
        var resultsHost = el('<div class="task-results"></div>');
        inner.appendChild(resultsHost);
        function fillResults(host) {
          var today0 = sod(TODAY);
          var act = state.tasks.filter(function (t) { return !t.done; });
          var byDue = function (a, b) { return a.due - b.due; };
          var groups = [];
          if (state.taskFilter !== "completed") {
            groups.push({ name: "Overdue", cls: "overdue", list: act.filter(function (t) { return sod(t.due) < today0; }).sort(byDue) });
            groups.push({ name: "Today", cls: "", list: act.filter(function (t) { return sameDay(t.due, today0); }).sort(byDue) });
            groups.push({ name: "Upcoming", cls: "", list: act.filter(function (t) { return sod(t.due) > today0; }).sort(byDue) });
          }
          if (state.taskFilter !== "active") {
            groups.push({ name: "Completed", cls: "", list: state.tasks.filter(function (t) { return t.done; }).sort(function (a, b) { return b.due - a.due; }) });
          }
          var shown = 0;
          groups.forEach(function (g) {
            if (!g.list.length) return;
            shown += g.list.length;
            host.appendChild(el('<div class="task-group-title ' + g.cls + '">' + g.name + '<span class="tg-count">' + g.list.length + "</span></div>"));
            g.list.forEach(function (t) { host.appendChild(taskRow(t)); });
          });
          if (!shown) {
            if (!state.tasks.length) {
              host.appendChild(buildEmptyState({
                icon: "checkSq", title: "No tasks yet",
                sub: "Add your first task above — homework, swim gear, anything you need to remember.",
                hint: false
              }));
            } else if (state.taskFilter === "active") {
              host.appendChild(buildEmptyState({ icon: "checkSq", title: "Nothing active", sub: "Everything is done. Nice work.", hint: false }));
            } else if (state.taskFilter === "completed") {
              host.appendChild(buildEmptyState({ icon: "checkSq", title: "Nothing completed yet", sub: "Tick a task's checkbox and it will land here.", hint: false }));
            } else {
              host.appendChild(buildEmptyState({ icon: "checkSq", title: "No tasks", sub: "Add one above to get started.", hint: false }));
            }
          }
        }
        fillResults(resultsHost);
        return wrap;
      }
      function taskRow(t) {
        var cal = calOf(t.cal);
        var row = el('<div class="task-row' + (t.done ? " done" : "") + '"></div>');
        var overdue = !t.done && sod(t.due) < sod(TODAY);
        var chk = el('<button class="task-check' + (t.done ? " done" : "") + '" style="border-color:' + dotOf(cal) + '" title="' + (t.done ? "Mark not done" : "Mark done") + '" aria-label="' + (t.done ? "Mark not done: " : "Mark done: ") + esc(t.title) + '" aria-pressed="' + t.done + '">' + icon("check", 13) + "</button>");
        var chkBusy = false;
        chk.addEventListener("click", function () {
          if (chkBusy) return;
          /* Reduced motion: no sequence — the state flips at once. */
          if (state.reduceMotion || reduceMotionMQ.matches) {
            t.done = !t.done;
            refreshTasks(false);
            renderSidebar();
            return;
          }
          chkBusy = true;
          if (!t.done) {
            /* Complete, as a sequence: the green fill and a small
               pop land first, the white check draws itself in, and
               only then does the task settle — strikethrough title,
               Completed group, updated counts. */
            chk.classList.add("completing");
            chk.setAttribute("aria-pressed", "true");
            chk.title = "Mark not done";
            setTimeout(function () {
              t.done = true;
              refreshTasks(false);
              renderSidebar();
              /* The change lands after the animation, so queue the cloud save here (the click-time check saw no change yet). */
              if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
            }, 300);
          } else {
            /* Un-complete runs it in reverse: the check undraws and
               the green clears, then the task returns to its group. */
            chk.classList.remove("done");
            chk.classList.add("uncompleting");
            chk.setAttribute("aria-pressed", "false");
            chk.title = "Mark done";
            setTimeout(function () {
              t.done = false;
              refreshTasks(false);
              renderSidebar();
              if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
            }, 200);
          }
        });
        row.appendChild(chk);
        var main = el('<div class="task-main"><div class="task-title">' + esc(t.title) + '</div></div>');
        var meta = el('<div class="task-meta"></div>');
        var due = el('<button class="tm-due' + (overdue ? " overdue" : "") + '" title="Change due date" aria-label="Change due date for ' + esc(t.title) + '">' + icon("clock", 12) + "<span>" + esc(taskDueLabel(t)) + "</span></button>");
        due.addEventListener("click", function () {
          openDatePicker(due, t.due, function (d) {
            t.due = t.hasTime ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.due.getHours(), t.due.getMinutes()) : sod(d);
            refreshTasks(false);
          });
        });
        meta.appendChild(due);
        meta.appendChild(el('<span class="tm-cal"><span class="tm-dot" style="background:' + dotOf(cal) + '"></span>' + esc(cal.name) + "</span>"));
        main.appendChild(meta);
        row.appendChild(main);
        var acts = el('<div class="task-actions"></div>');
        var editBtn = el('<button class="icon-btn" title="Edit task" aria-label="Edit task: ' + esc(t.title) + '">' + icon("pencil", 15) + "</button>");
        editBtn.addEventListener("click", function () { startTaskEdit(row, t); });
        var delBtn = el('<button class="icon-btn" title="Delete task" aria-label="Delete task: ' + esc(t.title) + '">' + icon("trash", 15) + "</button>");
        delBtn.addEventListener("click", function () {
          openConfirm({
            title: "Delete this task?",
            body: "“" + t.title + "” will be removed. This cannot be undone.",
            confirmLabel: "Delete", danger: true,
            fn: function () {
              state.tasks = state.tasks.filter(function (x) { return x.id !== t.id; });
              toast("Task deleted");
              refreshTasks(false);
              renderSidebar();
            }
          });
        });
        acts.appendChild(editBtn); acts.appendChild(delBtn);
        row.appendChild(acts);
        return row;
      }
      function startTaskEdit(row, t) {
        var main = row.querySelector(".task-main");
        if (!main || main.querySelector(".task-edit-input")) return;
        var titleEl = main.querySelector(".task-title");
        var input = el('<input class="task-edit-input" value="' + esc(t.title) + '" aria-label="Task title">');
        titleEl.replaceWith(input);
        input.focus(); input.select();
        /* Same one-shot guard as the calendar rename: Enter saves,
           the re-render removes the input, and the trailing blur
           must not save (or announce) a second time. */
        var finished = false;
        function done(save) {
          if (finished) return;
          finished = true;
          if (save && input.value.trim()) t.title = input.value.trim();
          refreshTasks(false);
        }
        input.addEventListener("blur", function () { done(true); });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") done(true);
          if (e.key === "Escape") { input.value = t.title; done(false); }
        });
      }

      /* ================= Event popover ================= */
      var popEl = null;
      var popMenuEl = null;
      /* Selected event block: while its popover is open the block goes
         solid in its calendar colour (Cron). The anchor's inline styles
         are restored verbatim when the popover closes. */
      var selAnchor = null, selAnchorBg = "", selAnchorColor = "", selAnchorShadow = "";
      function markSelected(anchor, cal) {
        clearSelected();
        if (!anchor || !anchor.style || !anchor.classList) return;
        selAnchor = anchor;
        selAnchorBg = anchor.style.background; selAnchorColor = anchor.style.color; selAnchorShadow = anchor.style.boxShadow;
        anchor.style.background = dotOf(cal);
        anchor.style.color = "#fff";
        anchor.style.boxShadow = "none";
        anchor.classList.add("ev-selected");
      }
      function clearSelected() {
        viewWrap.querySelectorAll('.dl-span-selected').forEach(function(n){n.classList.remove('dl-span-selected')});
        if (!selAnchor) return;
        try {
          selAnchor.style.background = selAnchorBg;
          selAnchor.style.color = selAnchorColor;
          selAnchor.style.boxShadow = selAnchorShadow;
          selAnchor.classList.remove("ev-selected");
        } catch (e) {}
        selAnchor = null;
      }
      function closePopMenu() { if (popMenuEl) { daylightExit(popMenuEl); popMenuEl = null; } }
      function closePopover() { closePopMenu(); clearSelected(); if (popEl) { daylightExit(popEl); popEl = null; document.removeEventListener("mousedown", popOutside, true); } }
      function popOutside(e) {
        if (popMenuEl && popMenuEl.contains(e.target)) return;
        if (openMenuEl && openMenuEl.contains(e.target)) return;   /* a menu opened from inside the popover (the Share view's permission menu) */
        if (popEl && popEl.contains(e.target)) { closePopMenu(); return; }
        /* A press on the event that owns the open popover is left to its
           click handler, which toggles the popover closed (Item 7). Closing
           here on mousedown would let that click reopen it. */
        if (popEl && e.target && e.target.closest) {
          if (popEl._anchor && popEl._anchor.isConnected && popEl._anchor.contains(e.target)) return;
          var hit = e.target.closest("[data-event-id]");
          if (hit && String(hit.dataset.eventId) === String(popEl._occId) &&
              (!hit.dataset.occStart || new Date(hit.dataset.occStart).getTime() === popEl._occStart)) return;
        }
        closePopover();
      }
      /* The popover's "…" overflow menu — kept separate from openMenu()
         because openMenu() closes the popover it would hang from. */
      function chooseRepeatScope(title,body,onChoose){
        var bd=el('<div class="backdrop"><div class="dialog" role="dialog" aria-modal="true" style="width:min(420px,94vw)"><div class="dialog-head"><span class="dialog-title">'+esc(title)+'</span><button class="icon-btn" data-close aria-label="Close">'+icon("x",16)+'</button></div><div class="dialog-body"><p>'+esc(body)+'</p><div class="dl-scope-options"><button class="btn-ghost" data-scope="only">Only this event</button><button class="btn-ghost" data-scope="following">This and following</button><button class="btn-ghost" data-scope="all">All events</button></div></div></div></div>');
        overlayRoot.appendChild(bd);bd.querySelector('[data-close]').onclick=function(){daylightExit(bd)};
        bd.querySelectorAll('[data-scope]').forEach(function(b){b.onclick=function(){var v=b.dataset.scope;daylightExit(bd);onChoose(v)}});
      }
      function previousRepeatOccurrence(date,frequency){
        var d=new Date(date);if(frequency==="weekly")d.setDate(d.getDate()-7);else if(frequency==="monthly")d.setMonth(d.getMonth()-1);else if(frequency==="yearly")d.setFullYear(d.getFullYear()-1);else d.setDate(d.getDate()-1);return d;
      }
      /* Deleting events: one Undo toast (5 s) restores the whole action exactly as it was (calendar, times, details). */
      function undoDeleteToast(restore) {
        toast("Event deleted", { label: "Undo", fn: function () { restore(); renderAll(false); renderSidebar(); if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save(); } }, { duration: 5000, replaceKey: "undo-delete" });
      }
      window.daylightDeleteEvents = function (list) {
        /* bulk delete (Select mode): ONE action, ONE Undo */
        var gone = list.slice(), at = gone.map(function (e) { return state.events.indexOf(e); });
        state.events = state.events.filter(function (e) { return gone.indexOf(e) === -1; });
        renderAll(false);
        toast(gone.length === 1 ? "Event deleted" : gone.length + " events deleted", { label: "Undo", fn: function () {
          gone.forEach(function (e, i) { state.events.splice(Math.min(at[i] < 0 ? state.events.length : at[i], state.events.length), 0, e); });
          renderAll(false); renderSidebar(); if (window.daylightCloud && window.daylightCloud.save) window.daylightCloud.save();
        } }, { duration: 5000, replaceKey: "undo-delete" });
      };
      function confirmDeleteEvent(ev,occ) {
        var recurring=!!ev.repeat&&occ&&occ.start.getTime()!==ev.start.getTime();
        function remove(scope){
          closePopover();
          var undo;
          if(scope==="only"){var oldEx=Array.isArray(ev.exdates)?ev.exdates.slice():[];ev.exdates=oldEx.slice();ev.exdates.push(occ.start.toISOString());undo=function(){ev.exdates=oldEx}}
          else if(scope==="following"){var oldEnd=ev.repeatEnd;ev.repeatEnd=previousRepeatOccurrence(occ.start,ev.repeat).toISOString();undo=function(){ev.repeatEnd=oldEnd}}
          else{var uid=ev.uid;var before=state.events.slice();state.events=state.events.filter(function(e){return e!==ev&&(uid?e.uid!==uid:e.id!==ev.id)});undo=function(){var keep=state.events.filter(function(e){return before.indexOf(e)===-1});state.events=before.concat(keep)}}
          renderAll(false);undoDeleteToast(undo);
        }
        if(recurring){chooseRepeatScope("Delete repeating event","Choose which occurrences to delete.",remove);return}
        openConfirm({title:"Delete this event?",body:"“"+ev.title+"” will be removed from "+calOf(ev.cal).name+". This cannot be undone.",confirmLabel:"Delete",danger:true,fn:function(){remove("all")}});
      }
      function editOccurrence(ev,occ){
        if(!ev.repeat||!occ||occ.start.getTime()===ev.start.getTime()){openEventForm(ev,null,occ||ev);return}
        chooseRepeatScope("Edit repeating event","Choose which occurrences this change should affect.",function(scope){
          if(scope==="all"){openEventForm(ev,null,ev);return}
          ev.uid=ev.uid||("daylight-"+ev.id);
          var copy=Object.assign({},ev,{id:++uid,start:new Date(occ.start),end:new Date(occ.end),repeat:scope==="only"?null:ev.repeat,repeatEnd:scope==="only"?ev.repeatEnd:null,recurrenceId:scope==="only"?new Date(occ.start):null,exdates:[],_seriesParentId:ev.id,_seriesScope:scope,_seriesStart:new Date(occ.start)});
          openEventForm(copy,null,copy);
        });
      }
      /* Duplicate: the Create form opens pre-filled with a full copy (an occurrence of a repeating series becomes one standalone event). Nothing is saved until the user saves. */
      function duplicateEvent(ev, occ) {
        var o = occ || ev;
        var draft = {
          title: ev.title, cal: ev.cal, allDay: !!ev.allDay, start: new Date(o.start), end: new Date(o.end),
          repeat: ev.repeat && occ ? null : ev.repeat, repeatEnd: ev.repeat && occ ? null : ev.repeatEnd,
          reminder: ev.reminder, loc: ev.loc, desc: ev.desc, placeId: ev.placeId || null, locationLat: ev.locationLat == null ? null : ev.locationLat, locationLng: ev.locationLng == null ? null : ev.locationLng,
          weekdaysOnly: ev.repeat ? false : !!ev.weekdaysOnly, accent: ev.accent, banner: ev.banner || null, attachments: window.daylightCopyAttachments ? window.daylightCopyAttachments(ev) : []
        };
        if (isReadOnlyEvent(ev)) { draft.cal = defaultCalId(); }
        openEventForm(null, null, null, draft);
      }
      function openPopMenu(anchor, ev, occ) {
        if (popMenuEl) { closePopMenu(); return; }
        var m = el('<div class="menu" role="menu" style="width:204px"></div>');
        var del = el('<button class="menu-item danger">' + icon("trash", 16) + "<span>Delete event</span></button>");
        del.addEventListener("click", function () { closePopMenu(); confirmDeleteEvent(ev,occ); });
        var exportItem = el('<button class="menu-item">' + icon("download",16) + '<span>Export event (.ics)</span></button>');
        exportItem.addEventListener("click",function(){closePopMenu();window.daylightExportEvent(ev);});
        /* the share-and-copy cluster (Duplicate, Export), then a hairline, then the destructive action on its own */
        var dup = el('<button class="menu-item">' + icon("copy", 16) + "<span>Duplicate</span></button>");
        dup.addEventListener("click", function () { closePopMenu(); duplicateEvent(ev, occ); });
        if (!isReadOnlyEvent(ev) || true) m.appendChild(dup);
        m.appendChild(exportItem);
        m.appendChild(el('<div class="menu-sep" role="separator"></div>'));
        m.appendChild(del);
        document.body.appendChild(m);
        var r = anchor.getBoundingClientRect();
        var mw = 204, mh = m.offsetHeight;
        /* Anchored to the popover's right edge: the menu sits beside the popover (right side, else left), top-aligned with the button, so it never covers the date or time. */
        var pr = (popEl || anchor.closest(".popover") || anchor).getBoundingClientRect();
        var left = pr.right + 8;
        if (left + mw > window.innerWidth - 8) left = pr.left - mw - 8;
        if (left < 8) left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8));
        var top = Math.max(8, Math.min(r.top - 4, window.innerHeight - mh - 8));
        m.style.left = left + "px"; m.style.top = top + "px";
        m.style.transformOrigin = (left >= pr.right ? "0" : "100%") + " " + Math.max(0, Math.min(mh, r.top + r.height / 2 - top)) + "px";
        popMenuEl = m;
      }
      function openPopover(occ, anchor) {
        closeMenu();
        if (popEl && popEl._occId === occ.ev.id && popEl._occStart === occ.start.getTime()) { closePopover(); return; }
        closePopover();
        var ev = occ.ev, cal = calOf(ev.cal);
        var readOnly = isReadOnlyEvent(ev);
        var rel = fmtRelativeDay(occ.start);
        var dur = fmtDuration(occ);
        var bannerKey = bannerKeyFor(ev, cal);
        var bannerSrc = bannerKey && BANNER_DATA[bannerKey];
        if (!bannerSrc) bannerKey = null;
        var holidayBanner = bannerKey && bannerKey.indexOf("dl-banner-holidays-") === 0;
        /* Google Calendar–style detail: date first, then time + duration, then the rest with icon gutter */
        var timeMain, timeSub;
        if (ev.allDay) {
          timeMain = fmtPopDate(occ);
          timeSub = dur + (rel ? " · " + rel : "");
        } else if (sameDay(occ.start, occ.end)) {
          timeMain = fmtPopDate(occ);
          timeSub = fmtEventTime(occ.start) + " – " + fmtEventTime(occ.end) + (dur ? " · " + dur : "") + " · " + tzShort(effectiveTz()) + (rel ? " · " + rel : "");
        } else {
          timeMain = fmtPopDate(occ);
          timeSub = fmtEventTime(occ.start) + " – " + fmtEventTime(occ.end) + (dur ? " · " + dur : "") + " · " + tzShort(effectiveTz()) + (rel ? " · " + rel : "");
        }
        /* Cron's detail order: date/time → repeat → location →
           description → calendar (visibility) → reminder. One icon
           size (18) down the whole gutter, no redundant row labels.
           With a banner, the date line sits under the title Google-style
           and the clock row is not repeated. */
        var calLine = '<div class="pop-cal-line"><span class="pop-cal-chip"><span style="width:8px;height:8px;border-radius:50%;background:' + dotOf(cal) + ';display:inline-block"></span>' + esc(cal.name) + "</span>" + (ev.allDay ? "<span>All day</span>" : "") + (ev.repeat ? "<span>" + esc(REPEAT_LABELS[ev.repeat] || "Repeats") + "</span>" : "") + "</div>";
        var rows = "";
        if (!bannerKey) rows += '<div class="pop-row"><span class="pop-ic">' + icon("clock", 18) + '</span><span class="pop-main"><span class="pr-strong">' + esc(timeMain) + '</span><span class="pr-sub">' + esc(timeSub) + "</span></span></div>";
        if (ev.repeat) rows += '<div class="pop-row"><span class="pop-ic">' + icon("repeat", 18) + '</span><span class="pop-main">' + esc(REPEAT_LABELS[ev.repeat] || "Repeats") + "</span></div>";
        if (ev.loc) {
          rows += '<div class="pop-row"><span class="pop-ic">' + icon("pin", 18) + '</span><span class="pop-main">' +
            esc(ev.loc) + '</span></div>';
        }
        if (ev.desc) rows += '<div class="pop-row"><span class="pop-ic">' + icon("alignLeft", 18) + '</span><span class="pop-main pop-desc">' + esc(ev.desc) + "</span></div>";
        /* the calendar: its own row, below the description and above the reminder (the settled popover order) */
        rows += '<div class="pop-row"><span class="pop-ic">' + icon("calendar", 18) + '</span><span class="pop-main">' + calLine + "</span></div>";
        if (ev.declined) rows += '<div class="pop-row"><span class="pop-ic">' + icon("info", 18) + '</span><span class="pop-main">Declined</span></div>';
        if (ev.reminder != null) rows += '<div class="pop-row"><span class="pop-ic">' + icon("bell", 18) + '</span><span class="pop-main">' + esc(fmtReminder(ev.reminder)) + "</span></div>";
        if (readOnly) rows += '<div class="pop-row"><span class="pop-ic">' + icon("info", 18) + '</span><span class="pop-main" style="color:var(--muted);font-size:13px">Read-only — you can\'t create, edit, or delete events on this calendar.</span></div>';
        var p;
        if (bannerKey) {
          /* Banner layout (Google): illustration across the top, the
             actions as circular buttons overlaid on its top-right,
             then color square + title with the date line under it. */
          var bBtns = "";
          if (!readOnly) bBtns += '<button class="pop-banner-btn" data-act="edit" title="Edit event" aria-label="Edit event">' + icon("pencil", 15) + '</button><button class="pop-banner-btn" data-act="del" title="Delete event" aria-label="Delete event">' + icon("trash", 15) + '</button><button class="pop-banner-btn" data-act="more" title="More actions" aria-label="More actions" aria-haspopup="menu">' + icon("dotsV", 16) + "</button>";
          bBtns += '<button class="pop-banner-btn" data-act="close" title="Close" aria-label="Close">' + icon("x", 16) + "</button>";
          var dateLine = '<div class="pop-date-line">' + esc(fmtGoogleWhen(occ) + (!ev.allDay && dur ? " · " + dur : "")) + "</div>";
          p = el('<div class="popover has-banner" role="dialog" aria-label="Event details">' +
            '<div class="pop-banner' + (holidayBanner ? " holiday-banner" : "") + '"><img src="' + esc(bannerSrc) + '" alt="" draggable="false"><div class="pop-banner-actions">' + bBtns + "</div></div>" +
            '<div class="pop-body"><div class="pop-head"><span class="pop-color-sq" style="background:' + dotOf(cal) + '"></span><div style="flex:1;min-width:0"><div class="pop-title">' + esc(ev.title) + "</div>" + dateLine + "</div></div>" +
            '<div class="pop-rows">' + rows + "</div></div></div>");
          var bImg = p.querySelector(".pop-banner img");
          bImg.addEventListener("error", function () {
            /* A mapped banner whose file is missing falls back to the
               plain header — never a broken image. */
            var b = p.querySelector(".pop-banner");
            if (!b) return;
            b.remove();
            p.classList.remove("has-banner");
            var body = p.querySelector(".pop-body");
            if (body) body.style.padding = "0";
            var top = el('<div class="pop-top">' + popTopBtns(readOnly) + "</div>");
            p.insertBefore(top, p.firstChild);
            wirePopActions(p, ev, occ);
          });
        } else {
          p = el('<div class="popover" role="dialog" aria-label="Event details"><div class="pop-top">' + popTopBtns(readOnly) + '</div><div class="pop-head"><span class="pop-color-sq" style="background:' + dotOf(cal) + '"></span><div style="flex:1;min-width:0"><div class="pop-title">' + esc(ev.title) + "</div>" + "</div></div>" +
            '<div class="pop-rows">' + rows + "</div></div>");
        }
        p._occId = ev.id; p._occStart = occ.start.getTime(); p._anchor = anchor;
        document.body.appendChild(p);
        var r = anchor.getBoundingClientRect();
        /* Fix 42: never taller than the window: the popover scrolls inside itself instead of running off-screen */
        p.style.maxHeight = (window.innerHeight - 16) + "px"; p.style.overflowY = "auto";
        var pw = 384, ph = p.offsetHeight;
        var left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
        var top = r.bottom + 8;
        if (top + ph > window.innerHeight - 8) { var above = r.top - ph - 8; top = above >= 8 ? above : Math.max(8, window.innerHeight - 8 - ph); }
        p.style.left = left + "px"; p.style.top = top + "px";
        popEl = p;
        markSelected(anchor, cal);
        document.addEventListener("mousedown", popOutside, true);
        wirePopActions(p, ev, occ);
      }
      function popTopBtns(readOnly) {
        var b = "";
        if (!readOnly) b += '<button class="icon-btn" data-act="edit" title="Edit event" aria-label="Edit event">' + icon("pencil", 16) + '</button><button class="icon-btn" data-act="more" title="More actions" aria-label="More actions" aria-haspopup="menu">' + icon("dotsH", 17) + "</button>";
        b += '<button class="icon-btn" data-act="close" title="Close" aria-label="Close">' + icon("x", 17) + "</button>";
        return b;
      }
      function wirePopActions(p, ev, occ) {
        var closeB = p.querySelector('[data-act="close"]');
        if (closeB) closeB.addEventListener("click", closePopover);
        var editBtn = p.querySelector('[data-act="edit"]');
        if (editBtn) editBtn.addEventListener("click", function () { closePopover(); editOccurrence(ev,occ); });
        var delBtn = p.querySelector('[data-act="del"]');
        if (delBtn) delBtn.addEventListener("click", function () { confirmDeleteEvent(ev,occ); });
        var moreBtn = p.querySelector('[data-act="more"]');
        if (moreBtn) moreBtn.addEventListener("click", function () { openPopMenu(moreBtn, ev, occ); });
      }
      /* Event banners are registered from individual WebP files by daylight-banners.js. */
      var BANNER_DATA = Object.create(null);
      var BANNER_KEYS = [];
      function bannerKeyFor(ev, cal) { return null; }

      /* ================= Generic dialogs ================= */
      var overlayRoot = document.getElementById("overlayRoot");
      function closeTopDialog() {
        var kids = overlayRoot.children;
        if (kids.length) daylightExit(kids[kids.length - 1]);
      }
      function openConfirm(opts) {
        var bd = el('<div class="backdrop"><div class="dialog dl-std dl-confirm">' +
          '<div class="dialog-head"><span class="dialog-title">' + esc(opts.title) + '</span><button class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
          '<div class="dialog-body"><p style="margin:0;font-size:14px;color:var(--muted);line-height:1.55">' + esc(opts.body).replace(/(\d[\d,]*) (events?|tasks?|calendars?|people|subscriptions?)\b/g, "$1&nbsp;$2") + "</p></div>" +
          '<div class="dialog-foot"><button class="btn-ghost" data-cancel>Cancel</button><button class="' + (opts.danger ? "btn-danger" : "btn-primary") + '" style="margin-left:0" data-ok>' + esc(opts.confirmLabel) + "</button></div></div></div>");
        overlayRoot.appendChild(bd);
        function close() { daylightExit(bd); }
        bd.querySelector("[data-x]").addEventListener("click", close);
        bd.querySelector("[data-cancel]").addEventListener("click", close);
        bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
        bd.querySelector("[data-ok]").addEventListener("click", function () { close(); opts.fn(); });
      }
      function openHelp() {
        var bd = el('<div class="backdrop"><div class="dialog" style="width:440px">' +
          '<div class="dialog-head"><span class="dialog-title">Help center</span><button class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
          '<div class="dialog-body" style="font-size:14px;line-height:1.6;color:var(--muted)">' +
          "<p style='margin:0 0 10px'><b style='color:var(--text)'>Create.</b> Use the Create button in the sidebar, press <b style='color:var(--text)'>N</b>, or use the + on any day. Click an event to see its details, edit it, or delete it.</p>" +
          "<p style='margin:0 0 10px'><b style='color:var(--text)'>Move around.</b> The header above the calendar shows the month and year — its ‹ › arrows move one month at a time, and the calendar-dot button jumps straight back to today in Month view. Click a date number to open that day: the header then shows that day's full date instead, and the arrows step one day at a time. The sidebar mini calendar's own ‹ › arrows browse months without moving the main view, and clicking one of its dates jumps there. The arrow keys page the calendar and <b style='color:var(--text)'>T</b> jumps back to today.</p>" +
          "<p style='margin:0 0 10px'><b style='color:var(--text)'>Tasks.</b> The <b style='color:var(--text)'>Tasks</b> row in the sidebar swaps the calendar for your task list — add tasks with a due date and a calendar, tick the checkbox to complete them, and use the pencil to rename or the date to move one. The <b style='color:var(--text)'>Calendar</b> row brings the calendar back.</p>" +
          "<p style='margin:0 0 10px'><b style='color:var(--text)'>Calendars.</b> Tick a calendar's square in the sidebar to show or hide it. Calendars under <b style='color:var(--text)'>My calendars</b> have a ⋮ menu to rename, recolor, or delete them. Calendars under <b style='color:var(--text)'>Subscriptions</b>, like US Holidays, are read-only — their events show on the grid but can't be added to or edited.</p>" +
          "<p style='margin:0'>Press <b style='color:var(--text)'>Ctrl/⌘ + K</b> to search and <b style='color:var(--text)'>Ctrl/⌘ + ,</b> for Settings, where you can change the view, time zone, density, and more.</p>" +
          '</div><div class="dialog-foot"><button class="btn-primary" style="margin-left:0" data-ok>Done</button></div></div></div>');
        overlayRoot.appendChild(bd);
        function close() { daylightExit(bd); }
        bd.querySelector("[data-x]").addEventListener("click", close);
        bd.querySelector("[data-ok]").addEventListener("click", close);
        bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
      }
      function openNewCalendar() {
        var chosen = "teal";
        var bd = el('<div class="backdrop"><div class="dialog dl-std">' +
          '<div class="dialog-head"><span class="dialog-title">New calendar</span><button class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
          '<div class="dialog-body"><div class="field"><label for="ncName">Name</label><input class="text-input" id="ncName" placeholder="Calendar name"><div class="field-err" id="ncErr">Add a name</div></div>' +
          '<div class="field"><label>Color</label><div class="swatches" id="ncSwatches"></div></div>' +
          '<div class="field"><label>Default reminder</label><button type="button" class="dl-select-btn" id="ncReminder" aria-haspopup="menu"><span>None</span>' + icon("chevD", 14) + '</button></div></div>' +
          '<div class="dialog-foot"><button class="btn-ghost" data-cancel>Cancel</button><button class="btn-primary" style="margin-left:0" data-ok>Create calendar</button></div></div></div>');
        var ncRem = null;
        overlayRoot.appendChild(bd);
        var sw = bd.querySelector("#ncSwatches");
        window.daylightColorPicker(sw,chosen,function(key){chosen=key;});
        var input = bd.querySelector("#ncName");
        input.focus();
        bd.querySelector("#ncReminder").addEventListener("click", function () {
          var btn = this;
          openMenu(btn, [{ label2: "Default reminder" }].concat(REMINDER_CHOICES.map(function (pair) {
            return { label: pair[1], right: ncRem === pair[0] ? "check" : null, fn: function () { ncRem = pair[0]; btn.querySelector("span").textContent = pair[1]; } };
          })));
        });
        function close() { if(window.daylightExit)window.daylightExit(bd);else bd.remove(); }
        bd.querySelector("[data-x]").addEventListener("click", close);
        bd.querySelector("[data-cancel]").addEventListener("click", close);
        bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
        bd.querySelector("[data-ok]").addEventListener("click", function () {
          var name = input.value.trim();
          if (!name) { input.classList.add("err"); bd.querySelector("#ncErr").classList.add("show"); return; }
          state.calendars.push({ id: newCalendarId(), name: name, color: chosen, hidden: false, subscribed: false, shared: false, defaultReminder: ncRem });
          close(); renderSidebar(); toast("Calendar created");
        });
      }

      /* ================= Event form ================= */
      /* [value, label] pairs for the premium dropdown — every time of
         day at the given step, as data instead of <option> markup. */
      function minuteOptionList(step) {
        var out = [];
        for (var m = 0; m < 24 * 60; m += step) out.push([m, fmtMinutes(m)]);
        return out;
      }
      /* The form's time lists are 30-minute steps, but a real start/end can
         sit off that grid (an event ending 19:45, a 15-minute default
         duration). Merge any such value in, sorted — otherwise the
         dropdown can't represent it and falls back to showing "00:00". */
      function timeOptionList(extra) {
        var out = minuteOptionList(30);
        (extra || []).forEach(function (m) {
          if (m == null) return;
          if (!out.some(function (o) { return o[0] === m; })) out.push([m, fmtMinutes(m)]);
        });
        out.sort(function (a, b) { return a[0] - b[0]; });
        return out;
      }
      function openDatePicker(anchorBtn, current, onPick) {
        closeDatePicker();
        var pop = el('<div class="date-pop"></div>');
        pop.id = "datePop";
        var view = dt(current.getFullYear(), current.getMonth(), 1);
        function draw() {
          pop.innerHTML = "";
          var head = el('<div class="mini-head" style="padding-bottom:6px"><button class="mini-nav" title="Previous month" aria-label="Previous month">' + icon("chevL", 14) + '</button><span class="mini-title" style="font-size:14px">' + MONTHS[view.getMonth()] + " " + view.getFullYear() + '</span><button class="mini-nav" title="Next month" aria-label="Next month">' + icon("chevR", 14) + "</button></div>");
          var navs = head.querySelectorAll(".mini-nav");
          navs[0].addEventListener("click", function (e) { e.stopPropagation(); view = addMonths(view, -1); draw(); });
          navs[1].addEventListener("click", function (e) { e.stopPropagation(); view = addMonths(view, 1); draw(); });
          pop.appendChild(head);
          pop.appendChild(el('<div class="mini-weekdays">' + ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(function (l, i, arr) { return "<span>" + arr[(state.weekStart + i) % 7] + "</span>"; }).join("") + "</div>"));
          var start = weekStartOf(view);
          for (var w = 0; w < 6; w++) {
            var row = el('<div class="mini-week"></div>');
            for (var d = 0; d < 7; d++) {
              (function (date) {
                var b = el('<button class="mini-day' + (date.getMonth() === view.getMonth() ? "" : " dim") + (sameDay(date, TODAY) ? " today" : "") + (sameDay(date, current) ? " sel" : "") + '"><span class="num">' + date.getDate() + "</span></button>");
                b.addEventListener("click", function (e) { e.stopPropagation(); closeDatePicker(); onPick(sod(date)); });
                row.appendChild(b);
              })(addDays(start, w * 7 + d));
            }
            pop.appendChild(row);
          }
        }
        draw();
        document.body.appendChild(pop);
        var r = anchorBtn.getBoundingClientRect();
        pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 260)) + "px";
        var top = r.bottom + 6;
        if (top + 320 > window.innerHeight) top = Math.max(8, r.top - 326);
        pop.style.top = top + "px";
        setTimeout(function () { document.addEventListener("mousedown", dpOutside, true); }, 0);
      }
      function dpOutside(e) { var p = document.getElementById("datePop"); if (p && !p.contains(e.target)) closeDatePicker(); }
      function closeDatePicker() { var p = document.getElementById("datePop"); if (p) { p.removeAttribute("id"); daylightExit(p); } document.removeEventListener("mousedown", dpOutside, true); }

      function openEventForm(existing, presetDate, occ, draft) {
        closePopover(); closeMenu();
        if (existing && isReadOnlyEvent(existing)) { toast("Subscribed calendars are read-only — events can't be edited"); return; }
        if (!existing && !writableCalendars().length) { toast("Create a calendar first"); openNewCalendar(); return; }
        var isEdit = !!existing;
        var src = existing || draft || null;
        var base = occ || src;
        var now = new Date();
        var nextHour = Math.min(23, now.getHours() + 1);
        var f = {
          title: src ? src.title : "",
          cal: src ? src.cal : defaultCalId(),
          allDay: src ? src.allDay : false,
          sDate: base ? sod(base.start) : sod(presetDate || state.selected),
          eDate: base ? sod(base.end) : sod(presetDate || state.selected),
          sMin: base && !base.allDay ? base.start.getHours() * 60 + base.start.getMinutes() : (presetDate && Number.isFinite(presetDate.slotMinutes) ? presetDate.slotMinutes : nextHour * 60),
          eMin: base && !base.allDay ? base.end.getHours() * 60 + base.end.getMinutes() : (presetDate && Number.isFinite(presetDate.slotMinutes) ? presetDate.slotMinutes : nextHour * 60) + state.defaultDuration,
          repeat: src ? src.repeat : null,
          repeatEnd: src && src.repeatEnd ? new Date(src.repeatEnd) : null,
          accent: "calendar",
          weekdaysOnly: src ? !!src.weekdaysOnly : false,
          reminder: src ? src.reminder : defaultReminderFor(src ? src.cal : defaultCalId()),
          reminderTouched: !!src,
          loc: src ? src.loc : "",
          placeId:src ? (src.placeId||null) : null,
          locationLat:src ? (src.locationLat??null) : null,
          locationLng:src ? (src.locationLng??null) : null,
          desc: src ? (src.desc || "") : "",
          dirty: false
        };
        if (f.eMin >= 24 * 60) f.eMin = 23 * 60 + 30;
        var bd = el('<div class="backdrop"></div>');
        var dlg = el('<div class="dialog event-form-dialog" role="dialog" aria-modal="true"></div>');
        dlg.innerHTML =
          '<div class="dialog-head"><span class="dialog-title">' + (isEdit ? "Edit event" : "New event") + '</span>' + '<button class="icon-btn" data-x title="Close" aria-label="Close">' + icon("x", 17) + "</button></div>" +
          '<div class="dialog-body">' +
            '<div class="field"><label for="efTitle">Title</label><input class="text-input" id="efTitle" placeholder="Event title" value="' + esc(f.title) + '"><div class="field-err" id="efTitleErr">Add a title</div></div>' +
            '<div class="field"><div class="switch-row"><span><span class="sw-label">All-day</span></span><label class="switch"><input type="checkbox" id="efAllDay" aria-label="All-day"' + (f.allDay ? " checked" : "") + '><span class="track"></span><span class="knob"></span></label></div></div>' +
            '<div class="form-grid">' +
              '<div class="field"><label>Starts</label><button class="picker-btn" id="efSDate">' + icon("calendar", 15) + '<span></span></button></div>' +
              '<div class="field"><label>Ends</label><button class="picker-btn" id="efEDate">' + icon("calendar", 15) + '<span></span></button></div>' +
              '<div class="field" id="efSTimeWrap"><label>Start time</label><button type="button" class="dd" id="efSTime" aria-haspopup="listbox" aria-expanded="false"><span class="dd-val"></span><span class="dd-chev">' + icon("chevD", 15) + '</span></button></div>' +
              '<div class="field" id="efETimeWrap"><label>End time</label><button type="button" class="dd" id="efETime" aria-haspopup="listbox" aria-expanded="false"><span class="dd-val"></span><span class="dd-chev">' + icon("chevD", 15) + '</span></button></div>' +
            "</div>" +
            '<label class="dl-checkbox dl-wd-check" id="efWeekdaysWrap" hidden><input type="checkbox" id="efWeekdays"><span class="dl-cb-box"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.4 6.3l2.4 2.4 4.8-5.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Only include weekdays</span></label>' +
            '<div class="field"><label>Repeats</label><button class="picker-btn" id="efRepeat">' + icon("repeat", 15) + '<span></span><span style="margin-left:auto;color:var(--muted)">' + icon("chevD", 15) + "</span></button></div>" +
            '<div class="field" id="efRepeatEndWrap"><label>Repeat until</label><button class="picker-btn" id="efRepeatEnd">' + icon("calendar",15) + '<span></span></button></div>' +
            '<div class="field"><label>Reminder</label><button class="picker-btn" id="efReminder">' + icon("bell", 15) + '<span></span><span style="margin-left:auto;color:var(--muted)">' + icon("chevD", 15) + "</span></button></div>" +
            '<div class="field"><label for="efLoc">Location</label><input class="text-input" id="efLoc" placeholder="Add a location" value="' + esc(f.loc) + '"></div>' +
            '<div class="field"><label for="efDesc">Description</label><textarea class="text-area" id="efDesc" rows="2" placeholder="Add a description">' + esc(f.desc) + '</textarea></div>' +
            '<div class="field"><label>Calendar</label><button class="picker-btn" id="efCal"><span></span><span style="margin-left:auto;color:var(--muted)">' + icon("chevD", 15) + "</span></button></div>" +
          "</div>" +
          '<div class="dialog-foot"><button class="btn-ghost" data-cancel>Cancel</button><button class="btn-primary" style="margin-left:0" data-save>' + (isEdit ? "Save changes" : "Create event") + "</button></div>";
        bd.appendChild(dlg);
        overlayRoot.appendChild(bd);
        var titleIn = dlg.querySelector("#efTitle");
        var allDayIn = dlg.querySelector("#efAllDay");
        var sDateBtn = dlg.querySelector("#efSDate"), eDateBtn = dlg.querySelector("#efEDate");
        var sTime = dlg.querySelector("#efSTime"), eTime = dlg.querySelector("#efETime");
        var repBtn = dlg.querySelector("#efRepeat"), calBtn = dlg.querySelector("#efCal");
        var repEndBtn=dlg.querySelector("#efRepeatEnd");
        var remBtn = dlg.querySelector("#efReminder");
        var locIn = dlg.querySelector("#efLoc");
        var descIn = dlg.querySelector("#efDesc");
        function markDirty() { f.dirty = true; }
        function dateLabel(d) { return fmtDateShort(d); }
        function syncUI() {
          sDateBtn.querySelector("span").textContent = dateLabel(f.sDate);
          eDateBtn.querySelector("span").textContent = dateLabel(f.eDate);
          ddSetOptions(sTime, timeOptionList([f.sMin]), f.sMin);
          ddSetOptions(eTime, timeOptionList([f.eMin]), f.eMin);
          dlg.querySelector("#efSTimeWrap").style.display = f.allDay ? "none" : "";
          dlg.querySelector("#efETimeWrap").style.display = f.allDay ? "none" : "";
          repBtn.querySelector("span").textContent = f.repeat ? f.repeat[0].toUpperCase() + f.repeat.slice(1) : "None";
          dlg.querySelector("#efRepeatEndWrap").style.display=f.repeat?"":"none";
          /* Only for a multi-day all-day event on a local calendar that does not repeat. */
          var wdShown = f.allDay && sod(f.eDate) > sod(f.sDate) && !f.repeat;
          dlg.querySelector("#efWeekdaysWrap").hidden = !wdShown;
          dlg.querySelector("#efWeekdays").checked = !!f.weekdaysOnly;
          repEndBtn.querySelector("span").textContent=f.repeatEnd?fmtDateShort(f.repeatEnd):"Never";
          remBtn.querySelector("span").textContent = f.reminder != null ? fmtReminder(f.reminder) : "None";
          var cal = calOf(f.cal);
          calBtn.classList.add("dl-cal-field");
          calBtn.title = cal.name;
          calBtn.querySelector("span").innerHTML = '<span class="dl-cal-field-main"><span class="pop-dot" style="background:' + dotOf(cal) + ';margin:0;flex:none"></span><span class="dl-cal-field-name">' + esc(cal.name) + "</span></span>";
        }
        syncUI();
        titleIn.focus();
        titleIn.addEventListener("input", function () { f.title = titleIn.value; titleIn.classList.remove("err"); dlg.querySelector("#efTitleErr").classList.remove("show"); markDirty(); });
        locIn.addEventListener("input", function () { f.loc = locIn.value; markDirty(); });
        if (window.daylightAttachPlaces) window.daylightAttachPlaces(locIn,f,markDirty);
        if (descIn) descIn.addEventListener("input", function () { f.desc = descIn.value; markDirty(); });
        allDayIn.addEventListener("change", function () {
          f.allDay = allDayIn.checked; markDirty();
          if (!f.allDay && f.sMin == null) { f.sMin = nextHour * 60; f.eMin = f.sMin + state.defaultDuration; }
          syncUI();
        });
        sDateBtn.addEventListener("click", function () {
          openDatePicker(sDateBtn, f.sDate, function (d) {
            f.sDate = d; if (f.eDate < d) f.eDate = d; markDirty(); syncUI();
          });
        });
        eDateBtn.addEventListener("click", function () {
          openDatePicker(eDateBtn, f.eDate, function (d) {
            f.eDate = d; if (f.sDate > d) f.sDate = d; markDirty(); syncUI();
          });
        });
        sTime.addEventListener("change", function () {
          var dur = f.eMin - f.sMin;
          f.sMin = +sTime.value; f.eMin = Math.min(23 * 60 + 30, f.sMin + dur);
          if (f.eMin <= f.sMin) f.eMin = f.sMin + 30;
          markDirty(); syncUI();
        });
        eTime.addEventListener("change", function () { f.eMin = +eTime.value; markDirty(); });
        repBtn.addEventListener("click", function () {
          var items = [{ label2: "Repeat" }];
          [["none", "None"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]].forEach(function (pair) {
            items.push({ label: pair[1], right: (f.repeat || "none") === pair[0] ? "check" : null, fn: function () { f.repeat = pair[0] === "none" ? null : pair[0]; if(!f.repeat)f.repeatEnd=null; markDirty(); syncUI(); } });
          });
          openMenu(repBtn, items);
        });
        repEndBtn.addEventListener("click",function(){if(!f.repeat)return;openDatePicker(repEndBtn,f.repeatEnd||f.eDate,function(d){f.repeatEnd=d;markDirty();syncUI()})});
        remBtn.addEventListener("click", function () {
          var items = [{ label2: "Reminder" }];
          REMINDER_CHOICES.forEach(function (pair) {
            items.push({ label: pair[1], right: f.reminder === pair[0] ? "check" : null, fn: function () { f.reminder = pair[0]; f.reminderTouched = true; markDirty(); syncUI(); } });
          });
          openMenu(remBtn, items);
        });
        calBtn.addEventListener("click", function () {
          var items = [{ label2: "Calendar" }];
          writableCalendars().forEach(function (c) {
            items.push({ label: c.name, title: c.name, dot: dotOf(c), checkRight: true, selected: f.cal === c.id, fn: function () { f.cal = c.id; if (!f.reminderTouched) f.reminder = defaultReminderFor(c.id); markDirty(); syncUI(); } });
          });
          if (!writableCalendars().length) items.push({ label: "No writable calendars yet — create one from the sidebar", fn: function () {} });
          openMenu(calBtn, items, { matchWidth: true, maxHeight: 280 });
        });
        dlg.querySelector("#efWeekdays").addEventListener("change", function (e) { f.weekdaysOnly = e.target.checked; markDirty(); });
        function tryClose() {
          closeDatePicker(); closeMenu();
          if (f.dirty) {
            openConfirm({
              title: "Discard changes?",
              body: "You have unsaved changes to this event. Discarding them cannot be undone.",
              confirmLabel: "Discard", danger: true,
              fn: function () { daylightExit(bd); }
            });
          } else daylightExit(bd);
        }
        dlg.querySelector("[data-x]").addEventListener("click", tryClose);
        dlg.querySelector("[data-cancel]").addEventListener("click", tryClose);
        bd.addEventListener("mousedown", function (e) { if (e.target === bd) tryClose(); });
        dlg.querySelector("[data-save]").addEventListener("click", function () {
          f.title = titleIn.value.trim();
          if (!f.title) {
            titleIn.classList.add("err"); dlg.querySelector("#efTitleErr").classList.add("show"); titleIn.focus(); return;
          }
          var start, end;
          if (f.allDay) { start = sod(f.sDate); end = sod(f.eDate); end.setHours(23, 59); }
          else {
            start = new Date(f.sDate); start.setHours(Math.floor(f.sMin / 60), f.sMin % 60);
            end = new Date(f.eDate); end.setHours(Math.floor(f.eMin / 60), f.eMin % 60);
            if (end <= start) { end = new Date(start.getTime() + 30 * 60000); }
          }
          var weekdaysOnly = f.allDay && sod(f.eDate) > sod(f.sDate) && !f.repeat && !!f.weekdaysOnly;
          if (weekdaysOnly && !rangeHasWeekday(start, end)) { toast("That range has no weekdays. Pick other dates or uncheck “Only include weekdays”."); return; }
          if (isSubscribed(calOf(f.cal))) { toast("Subscribed calendars are read-only — pick another calendar"); return; }
          closeDatePicker();
          if (isEdit) {
            src.weekdaysOnly = weekdaysOnly;
            src.title = f.title; src.cal = f.cal; src.allDay = f.allDay; src.start = start; src.end = end; src.repeat = f.repeat; src.reminder = f.reminder; src.loc = locIn.value.trim(); src.placeId = f.placeId || null;
            src.locationLat = f.locationLat ?? null; src.locationLng = f.locationLng ?? null;
            src.desc = descIn ? descIn.value.trim() : "";
            src.repeatEnd=f.repeatEnd?f.repeatEnd.toISOString():null;src.accent=f.accent;
            if(src._seriesParentId){
              var parent=state.events.find(function(e){return e.id===src._seriesParentId});
              if(parent){if(src._seriesScope==="only"){parent.exdates=Array.isArray(parent.exdates)?parent.exdates.slice():[];parent.exdates.push(src._seriesStart.toISOString())}else parent.repeatEnd=previousRepeatOccurrence(src._seriesStart,parent.repeat).toISOString()}
              delete src._seriesParentId;delete src._seriesScope;delete src._seriesStart;state.events.push(src);
            }
            daylightExit(bd); renderAll(false); toast("Event updated");
          } else {
            var created = mkEv(f.title, f.cal, start, end, { allDay: f.allDay, loc: locIn.value.trim(), desc: descIn ? descIn.value.trim() : "", repeat: f.repeat, reminder: f.reminder });
            created.placeId = f.placeId || null; created.locationLat = f.locationLat ?? null;
            created.locationLng = f.locationLng ?? null;
            created.repeatEnd=f.repeatEnd?f.repeatEnd.toISOString():null;created.accent=f.accent;created.weekdaysOnly=weekdaysOnly;
            state.events.push(created);
            daylightExit(bd); renderAll(false); toast("Event created");
          }
        });
      }

      /* ================= Search palette =================
         Search is the full-screen command palette: a fade-in overlay
         with one centered panel (the .palette styles above). The
         header search icon and Cmd/Ctrl+K both open it; Escape,
         the × button, or clicking the backdrop closes it. */
      var paletteEl = null;
      /* Shared motion for overlays; never delays a user's next interaction. */
      var daylightKeyboardInput = false;
      document.addEventListener("keydown", function(){daylightKeyboardInput=true;},true);
      document.addEventListener("pointerdown", function(){daylightKeyboardInput=false;},true);
      function daylightExit(node){
        if(!node)return;
        if(state.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          node.remove(); return;
        }
        if(node.classList.contains("dl-overlay-exit"))return;
        node.classList.add("dl-overlay-exit");
        node.style.pointerEvents="none";
        setTimeout(function(){node.remove();},175);
      }
      window.daylightExit=daylightExit;
      function closeSearch() {
        if (paletteEl) { daylightExit(paletteEl); paletteEl = null; }
        if (paletteCloseFn === closeSearch) paletteCloseFn = null;
      }
      function openSearch() {
        if (paletteEl) return;
        closeMenu(); closePopover();
        var bd = el('<div class="palette-backdrop" id="paletteBd"></div>');
        var pal = el('<div class="palette" role="dialog" aria-modal="true" aria-label="Search events">' +
          '<div class="palette-input-row">' + icon("search", 19) +
          '<input class="palette-input" id="palInput" type="text" placeholder="Search events…" aria-label="Search events" autocomplete="off" spellcheck="false">' +
          '<button class="palette-close" id="palClose" title="Close search" aria-label="Close search">' + icon("x", 17) + "</button></div>" +
          '<div class="palette-results" id="palResults"></div></div>');
        bd.appendChild(pal);
        document.body.appendChild(bd);
        paletteEl = bd;
        paletteCloseFn = closeSearch;
        bd.addEventListener("mousedown", function (e) { if (e.target === bd) closeSearch(); });
        pal.querySelector("#palClose").addEventListener("click", closeSearch);
        var inp = pal.querySelector("#palInput");
        inp.addEventListener("input", function () { drawSearch(); });
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            var first = pal.querySelector(".pal-item");
            if (first) { e.preventDefault(); first.click(); }
          } else if (e.key === "ArrowDown") {
            var f2 = pal.querySelector(".pal-item");
            if (f2) { e.preventDefault(); f2.focus(); }
          }
        });
        drawSearch();
        inp.focus();
      }
      function drawSearch() {
        var inp = document.getElementById("palInput");
        if (!inp || !paletteEl) return;
        var results = paletteEl.querySelector("#palResults");
        var q = inp.value.trim().toLowerCase();
        results.innerHTML = "";
        if (!q) {
          results.appendChild(el('<div class="empty-state" style="padding:26px 18px">' + icon("search", 24) + "<p>Start typing to search your events.</p></div>"));
          return;
        }
        var range = occsInRange(dt(2015, 0, 1), dt(2031, 0, 1)).filter(function (o) {
          return o.ev.title.toLowerCase().indexOf(q) >= 0 || (o.ev.loc || "").toLowerCase().indexOf(q) >= 0;
        });
        range.sort(function (a, b) { return a.start - b.start; });
        /* One holiday (or one repeating event) is not many results: a series shows its next upcoming occurrence and its most recent past one */
        (function () {
          var today = sod(TODAY), groups = {}, order = [];
          range.forEach(function (o) {
            var ev = o.ev, k = ev.repeat ? "r:" + ev.id : (ev.cal === "holidays" || ev.builtin) ? "h:" + (ev.title || "") : null;
            if (!k) { order.push({ solo: o }); return; }
            if (!groups[k]) { groups[k] = { list: [] }; order.push({ g: groups[k] }); }
            groups[k].list.push(o);
          });
          var keep = [];
          order.forEach(function (x) {
            if (x.solo) { keep.push(x.solo); return; }
            var past = null, next = null;
            x.g.list.forEach(function (o) { if (o.start < today) past = o; else if (!next) next = o; });
            [past, next].forEach(function (o) { if (o) keep.push(o); });
          });
          range = keep.sort(function (a, b) { return a.start - b.start; });
        })();
        if (!range.length) {
          var noRes = el('<div class="empty-state" style="padding:26px 18px"><span class="es-badge">' + icon("search", 22) + '</span><div class="es-title">No results for \u201c' + esc(inp.value.trim()) + '\u201d</div><p class="es-sub">Nothing on your calendars matches that search.</p></div>');
          var createBtn = el('<button class="btn-primary es-btn">' + icon("plus", 16) + "<span>New event</span></button>");
          createBtn.addEventListener("click", function () {
            var qv = inp.value.trim();
            closeSearch();
            openEventForm(null, state.selected);
            if (qv) {
              var ti = overlayRoot.querySelector("#efTitle");
              if (ti) { ti.value = qv; ti.dispatchEvent(new Event("input", { bubbles: true })); ti.focus(); }
            }
          });
          noRes.appendChild(createBtn);
          results.appendChild(noRes);
          return;
        }
        var groups = {};
        range.slice(0, 30).forEach(function (o) { (groups[o.ev.cal] = groups[o.ev.cal] || []).push(o); });
        var selEntry = window.daylightSelect && daylightSelect.entry("search", drawSearch);
        if (selEntry) results.appendChild(selEntry);
        Object.keys(groups).forEach(function (calId) {
          var cal = calOf(calId);
          results.appendChild(el('<div class="pal-group">' + esc(cal.name) + "</div>"));
          groups[calId].forEach(function (o) {
            var sub = isAllDayLike(o.ev, o.start, o.end) ? fmtDateShort(o.start) + " \u00b7 All day" : fmtDateShort(o.start) + " \u00b7 " + fmtTimeRange(o.start, o.end);
            if (o.ev.loc) sub += " \u00b7 " + o.ev.loc;
            var item = el('<button class="pal-item"><span class="pop-dot" style="background:' + dotOf(cal) + ';margin:0"></span><span class="pi-text"><span class="pi-title">' + esc(o.ev.title) + '</span><br><span class="pi-sub">' + esc(sub) + "</span></span>" + icon("chevR", 15) + "</button>");
            item.addEventListener("click", function () {
              closeSearch();
              inp.value = "";
              state.section = "calendar";
              state.selected = sod(o.start);
              if (state.view !== "day") { state.prevView = state.view; state.view = "day"; }
              state.cursor = sod(o.start);
              renderAll(false);
            });
            if (window.daylightSelect) daylightSelect.decorate(item, o.ev, "search");
            results.appendChild(item);
          });
        });
        var selBar = window.daylightSelect && daylightSelect.bar("search");
        if (selBar) results.appendChild(selBar);
      }
      /* ================= Settings ================= */
      var settingsState = { section: "general", pendingView: null };
      function applyTheme() {
        document.documentElement.setAttribute("data-theme", effectiveTheme());
        try { localStorage.setItem("daylight-theme-mode", state.themeMode || "system"); } catch (e) {}
      }
      function openSettings(section) {
        closeMenu(); closePopover();
        settingsState.section = section || settingsState.section || "general";
        settingsState.pendingView = state.view;
        var bd = el('<div class="backdrop"></div>');
        var dlg = el('<div class="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings"></div>');
        var rail = el('<div class="settings-rail"><div class="sr-title">Settings</div></div>');
        var sections = [
          ["general", "sliders", "General"],
          ["appearance", "droplet", "Appearance"],
          ["calendar", "calendar", "Calendar"],
          ["notifications", "bell", "Notifications"],
          ["shortcuts", "keyboard", "Shortcuts"],
          ["data", "sync", "Data & sync"],
          ["ai", "settings", "AI access"],
          ["about", "info", "About"]
        ];
        var pane = el('<div class="settings-pane"></div>');
        sections.forEach(function (s) {
          var b = el('<button class="sr-item' + (settingsState.section === s[0] ? " active" : "") + '">' + icon(s[1], 17) + "<span>" + s[2] + "</span></button>");
          b.addEventListener("click", function () {
            settingsState.section = s[0];
            rail.querySelectorAll(".sr-item").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
            drawPane();
          });
          rail.appendChild(b);
        });
        dlg.appendChild(rail); dlg.appendChild(pane);
        bd.appendChild(dlg);
        overlayRoot.appendChild(bd);
        function close() {
          var chosen = settingsState.viewSelect && document.contains(settingsState.viewSelect) ? settingsState.viewSelect.value : settingsState.pendingView;
          settingsState.viewSelect = null;
          bd.remove();
          if (chosen && chosen !== state.view) {
            state.view = chosen; state.prevView = null; renderAll(true, 1);
          } else renderAll(false);
        }
        bd.addEventListener("mousedown", function (e) { if (e.target === bd) close(); });
        function drawPane() {
          settingsState.redrawPane = drawPane;
          pane.innerHTML = "";
          var x = dlg.querySelector(":scope > .settings-close");
          if (!x) {
            x = el('<button class="icon-btn settings-close" title="Close settings" aria-label="Close settings">' + icon("x", 17) + "</button>");
            x.addEventListener("click", close);
            dlg.appendChild(x);
          }
          var fn = { general: paneGeneral, appearance: paneAppearance, calendar: paneCalendar, notifications: paneNotifications, shortcuts: paneShortcuts, data: paneData, ai: window.daylightAiPane, about: paneAbout }[settingsState.section];
          fn(pane, close);
          bindDropdowns(pane);
          /* Switches are icon-only controls: give each one its row's visible
             label as its accessible name so it isn't a bare "checkbox". */
          pane.querySelectorAll('label.switch input[type="checkbox"]').forEach(function (inp) {
            if (inp.getAttribute("aria-label")) return;
            var row = inp.closest(".switch-row");
            var lab = row ? row.querySelector(".sw-label") : null;
            if (lab) inp.setAttribute("aria-label", lab.textContent.trim());
          });
          /* One quiet rise-and-fade as the new pane's content lands. */
          pane.classList.remove("pane-in");
          void pane.offsetWidth;
          pane.classList.add("pane-in");
        }
        drawPane();
      }
      function switchHTML(id, checked) {
        return '<label class="switch"><input type="checkbox" id="' + id + '"' + (checked ? " checked" : "") + '><span class="track"></span><span class="knob"></span></label>';
      }
      function setRowHTML(label, sub, controlHTML) {
        return '<div class="set-row switch-row"><span><span class="sw-label">' + esc(label) + '</span>' + (sub ? '<div class="sw-sub">' + esc(sub) + "</div>" : "") + "</span>" + controlHTML + "</div>";
      }
      function selectHTML(id, options, value, cls) {
        DD_CFG[id] = { options: options, value: value };
        var label = ddLabelFor(options, value);
        return '<button type="button" class="dd ' + (cls || "") + '" id="' + id + '" aria-haspopup="listbox" aria-expanded="false"><span class="dd-val">' + esc(label) + '</span><span class="dd-chev">' + icon("chevD", 15) + "</span></button>";
      }
      function settingsSnapshot() {
        return {
          weekStart: state.weekStart, timeFormat: state.timeFormat, dateFormat: state.dateFormat,
          defaultDuration: state.defaultDuration, defaultCalendarId: state.defaultCalendarId,
          defaultReminder: state.defaultReminder, density: state.density, showWeekends: state.showWeekends,
          weekNumbers: state.weekNumbers, showDeclined: state.showDeclined, tzLabel: state.tzLabel,
          notifSound: state.notifSound, quietEnabled: state.quietEnabled, quietStart: state.quietStart,
          quietEnd: state.quietEnd, summaryTime: state.summaryTime,
          workDays: state.workDays.slice(), workStart: state.workStart, workEnd: state.workEnd,
          useDeviceTz: state.useDeviceTz, avatarUrl: state.avatarUrl || "",
          defaultView: ["month", "week", "day", "agenda"].indexOf(state.defaultView) !== -1 ? state.defaultView : "month",
          customColors: Array.isArray(state.customColors) ? state.customColors.slice() : []
        };
      }
      function applySettingsSnapshot(s) {
        if (!s || typeof s !== "object") return;
        ["weekStart", "timeFormat", "dateFormat", "defaultDuration", "defaultCalendarId", "defaultReminder",
         "density", "showWeekends", "weekNumbers", "showDeclined", "tzLabel", "notifSound", "quietEnabled",
         "quietStart", "quietEnd", "summaryTime", "workStart", "workEnd", "useDeviceTz", "defaultView"].forEach(function (k) {
          if (s[k] !== undefined) state[k] = s[k];
        });
        if (Array.isArray(s.workDays)) state.workDays = s.workDays.slice();
        if (typeof s.avatarUrl === "string") state.avatarUrl = s.avatarUrl;
        if (Array.isArray(s.customColors)) state.customColors = s.customColors.filter(function (c) { return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c); }).slice(0, 30);
        document.body.classList.toggle("density-compact", state.density === "compact");
      }
      function exportJSON() {
        try {
          var data = {
            app: "daylight", version: 1, exportedAt: new Date().toISOString(),
            calendars: state.calendars,
            events: state.events.map(function (e) {
              return { id: e.id, title: e.title, cal: e.cal, start: e.start.toISOString(), end: e.end.toISOString(), allDay: e.allDay, loc: e.loc, desc: e.desc, repeat: e.repeat, reminder: e.reminder, declined: e.declined };
            }),
            tasks: state.tasks.map(function (t) {
              return { id: t.id, title: t.title, cal: t.cal, due: t.due.toISOString(), hasTime: t.hasTime, done: t.done };
            }),
            settings: settingsSnapshot()
          };
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = "daylight-data.json";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
          toast("Data exported — check your downloads");
        } catch (err) { toast("Export failed in this browser"); }
      }
      function importJSON(file, done) {
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            if (!data || !Array.isArray(data.calendars) || !Array.isArray(data.events)) throw new Error("bad file");
            state.calendars = data.calendars.map(function (c) {
              return { id: String(c.id), name: String(c.name || "Calendar"), color: PALETTE[c.color] ? c.color : "blue", hidden: !!c.hidden, subscribed: !!c.subscribed, shared: !!c.shared, builtin: !!c.builtin };
            });
            state.events = data.events.map(function (e) {
              return { id: +e.id || ++uid, title: String(e.title || "Untitled"), cal: String(e.cal), start: new Date(e.start), end: new Date(e.end), allDay: !!e.allDay, loc: e.loc || "", desc: e.desc || "", repeat: e.repeat || null, reminder: e.reminder != null ? e.reminder : null, declined: !!e.declined };
            }).filter(function (e) { return !isNaN(e.start) && !isNaN(e.end); });
            if (Array.isArray(data.tasks)) {
              state.tasks = data.tasks.map(function (t) {
                return { id: +t.id || ++uid, title: String(t.title || "Untitled task"), cal: String(t.cal), due: new Date(t.due), hasTime: !!t.hasTime, done: !!t.done };
              }).filter(function (t) { return !isNaN(t.due); });
            }
            applySettingsSnapshot(data.settings);
            renderAll(false);
            toast("Data imported");
            if (done) done(true);
          } catch (err) { toast("That file isn't a Daylight data export"); if (done) done(false); }
        };
        reader.onerror = function () { toast("Couldn't read that file"); if (done) done(false); };
        reader.readAsText(file);
      }
      function resetDemoData(redraw) {
        state.calendars = seedCalendars();
        state.events = seedEvents();
        state.tasks = seedTasks();
        state.section = "calendar"; state.taskFilter = "all";
        taskDraft.title = ""; taskDraft.date = null; taskDraft.cal = null;
        state.feeds = seedFeeds();
        state.firstName = "Account";
        state.profileName = "Account";
        state.view = "month"; state.prevView = null;
        state.cursor = sod(TODAY); state.selected = sod(TODAY);
        state.miniCursor = dt(TODAY.getFullYear(), TODAY.getMonth(), 1); state.miniSelected = sod(TODAY);
        applySettingsSnapshot({
          weekStart: SETTINGS_DEFAULTS.weekStart, timeFormat: SETTINGS_DEFAULTS.timeFormat,
          dateFormat: SETTINGS_DEFAULTS.dateFormat, defaultDuration: SETTINGS_DEFAULTS.defaultDuration,
          defaultCalendarId: null, defaultReminder: SETTINGS_DEFAULTS.defaultReminder,
          density: SETTINGS_DEFAULTS.density, showWeekends: SETTINGS_DEFAULTS.showWeekends,
          weekNumbers: false, showDeclined: true, tzLabel: "America/New_York",
          notifSound: SETTINGS_DEFAULTS.notifSound, quietEnabled: SETTINGS_DEFAULTS.quietEnabled,
          quietStart: SETTINGS_DEFAULTS.quietStart, quietEnd: SETTINGS_DEFAULTS.quietEnd,
          summaryTime: SETTINGS_DEFAULTS.summaryTime, workDays: SETTINGS_DEFAULTS.workDays.slice(),
          workStart: SETTINGS_DEFAULTS.workStart, workEnd: SETTINGS_DEFAULTS.workEnd,
          useDeviceTz: SETTINGS_DEFAULTS.useDeviceTz
        });
        renderAll(false);
        if (redraw) redraw();
        toast("Demo data reset");
      }
      function paneHead(pane, title, sub) {
        pane.appendChild(el("<h2>" + esc(title) + "</h2>"));
        if (sub) pane.appendChild(el('<p class="pane-sub">' + esc(sub) + "</p>"));
      }
      function paneGeneral(pane, closeSettings) {
        paneHead(pane, "General", "The basics of your Daylight account.");
        var g = el('<div class="set-group"><div class="set-group-title">Profile</div>' +
          '<div class="field"><label for="gsName">First name</label><input class="text-input" id="gsName" style="max-width:300px" value="' + esc(state.firstName) + '"><p class="inline-note">Shown in your profile and account details.</p></div>' +
          '<div class="field"><label>Email</label><input class="text-input" style="max-width:300px" value="" disabled><p class="inline-note">The email you sign in with. It cannot be changed here.</p></div></div>');
        pane.appendChild(g);
        var nameIn = g.querySelector("#gsName");
        nameIn.addEventListener("input", function () {
          state.firstName = nameIn.value.trim() || "Account";
          /* The sidebar profile shows the full name — swap its first
             word for the new first name, keeping the rest, so this
             field visibly takes effect in the profile footer. */
          var rest = state.profileName.trim().split(/\s+/).slice(1).join(" ");
          state.profileName = state.firstName + (rest ? " " + rest : "");
          renderSidebar();
        });

        var gdt = el('<div class="set-group"><div class="set-group-title">Date &amp; time</div>' +
          setRowHTML("Time format", "Applies to event times, the hour gutter, and the event form.", selectHTML("gsTimeFmt", [["12h", "12-hour (2:30pm)"], ["24h", "24-hour (14:30)"]], state.timeFormat, "sm")) +
          setRowHTML("Date format", "How dates are written in lists, popovers, and the header.", selectHTML("gsDateFmt", [["mdy", "Nov 3, 2026"], ["dmy", "3 Nov 2026"], ["ymd", "2026-11-03"]], state.dateFormat, "sm")) +
          "</div>");
        pane.appendChild(gdt);
        gdt.querySelector("#gsTimeFmt").addEventListener("change", function (e) { state.timeFormat = e.target.value; renderAll(false); });
        gdt.querySelector("#gsDateFmt").addEventListener("change", function (e) { state.dateFormat = e.target.value; renderHeader(); renderView(false); });

        var tzDevice=deviceTz(), tzEntryNow=tzEntry(tzDevice);
        var tzShown=state.useDeviceTz ? tzDevice : state.tzLabel;
        var gtz=el('<div class="set-group"><div class="set-group-title">Time zone</div>'+
          '<div class="set-row switch-row"><span><span class="sw-label">Use my device’s time zone</span>'+
          '<div class="sw-sub">Follow this device ('+esc(tzEntryNow[1])+' '+esc(tzEntryNow[2])+').</div></span>'+
          switchHTML("gsUseDevTz",state.useDeviceTz)+'</div>'+
          setRowHTML("Time zone",state.useDeviceTz ? "Turn off device time zone to choose manually." : "Used for events and the Day/Week time gutter.",
            selectHTML("gsTz",tzOptions(tzShown),tzShown,"sm"))+"</div>");
        pane.appendChild(gtz);
        var tzBtn=gtz.querySelector("#gsTz");
        tzBtn.disabled=state.useDeviceTz;
        tzBtn.addEventListener("change",function(e){state.tzLabel=e.target.value;renderView(false);if(settingsState.markDirty)settingsState.markDirty();if(settingsState.redrawPane)settingsState.redrawPane()});
        gtz.querySelector("#gsUseDevTz").addEventListener("change",function(e){
          if (!e.target.checked && state.useDeviceTz) state.tzLabel=deviceTz();
          state.useDeviceTz=e.target.checked;
          renderView(false);
          if(settingsState.redrawPane)settingsState.redrawPane();
          if(settingsState.markDirty)settingsState.markDirty();
        });

        var calOpts = writableCalendars().map(function (c) { return [c.id, c.name]; });
        var gne = el('<div class="set-group"><div class="set-group-title">New events</div>' +
          setRowHTML("Default duration", "New events are prefilled with this length.", selectHTML("gsDuration", [[15, "15 minutes"], [30, "30 minutes"], [45, "45 minutes"], [60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"]], state.defaultDuration, "sm")) +
          setRowHTML("Default calendar", "Where new events land unless you pick another calendar.", selectHTML("gsDefCal", calOpts, defaultCalId(), "sm")) +
          setRowHTML("Default reminder", "Prefilled on new events — change it per event in the form.", selectHTML("gsDefRem", [[0, "None"], [5, "5 minutes before"], [10, "10 minutes before"], [15, "15 minutes before"], [30, "30 minutes before"], [60, "1 hour before"]], state.defaultReminder, "sm")) +
          "</div>");
        pane.appendChild(gne);
        gne.querySelector("#gsDuration").addEventListener("change", function (e) { state.defaultDuration = +e.target.value; });
        gne.querySelector("#gsDefCal").addEventListener("change", function (e) { state.defaultCalendarId = e.target.value; });
        gne.querySelector("#gsDefRem").addEventListener("change", function (e) { state.defaultReminder = +e.target.value; });

        var dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
        var chips = dayNames.map(function (n, i) {
          return '<button class="day-chip' + (state.workDays.indexOf(i) >= 0 ? " on" : "") + '" data-day="' + i + '" aria-pressed="' + (state.workDays.indexOf(i) >= 0) + '" title="' + DOWS[i] + '">' + n + "</button>";
        }).join("");
        var gwh = el('<div class="set-group"><div class="set-group-title">Working hours</div>' +
          '<div class="set-row switch-row"><span><span class="sw-label">Working days</span><div class="sw-sub">The days you are usually available.</div></span><span class="day-chips" id="gsWorkDays">' + chips + "</span></div>" +
          setRowHTML("Work starts", "When your working day usually begins.", selectHTML("gsWorkStart", [], state.workStart, "xs")) +
          setRowHTML("Work ends", "When your working day usually ends. Events outside these hours still show normally.", selectHTML("gsWorkEnd", [], state.workEnd, "xs")) +
          "</div>");
        pane.appendChild(gwh);
        var wsSel = gwh.querySelector("#gsWorkStart"), weSel = gwh.querySelector("#gsWorkEnd");
        ddSetOptions(wsSel, minuteOptionList(30), state.workStart);
        ddSetOptions(weSel, minuteOptionList(30), state.workEnd);
        wsSel.addEventListener("change", function () { state.workStart = +wsSel.value; });
        weSel.addEventListener("change", function () { state.workEnd = +weSel.value; });
        gwh.querySelectorAll(".day-chip").forEach(function (chip) {
          chip.addEventListener("click", function () {
            var d = +chip.getAttribute("data-day");
            var idx = state.workDays.indexOf(d);
            if (idx >= 0) state.workDays.splice(idx, 1); else state.workDays.push(d);
            var on = state.workDays.indexOf(d) >= 0;
            chip.classList.toggle("on", on);
            chip.setAttribute("aria-pressed", String(on));
          });
        });

      }
      function themePreviewHTML(mode) {
        function mock(cls) {
          return '<span class="tc-side"><span class="tc-dot"></span><span class="tc-line w70"></span><span class="tc-line w55"></span><span class="tc-line w85"></span></span>' +
            '<span class="tc-main"><span class="tc-topbar"></span><span class="tc-line strong w85"></span><span class="tc-event"></span><span class="tc-line w70"></span><span class="tc-event alt"></span></span>';
        }
        if (mode === "system") {
          return '<span class="tc-window"><span class="tc-half tc-half-light">' + mock("light") + '</span><span class="tc-half tc-half-dark"><span class="tc-main" style="padding-left:10px"><span class="tc-topbar"></span><span class="tc-line strong w85"></span><span class="tc-event"></span><span class="tc-line w70"></span><span class="tc-event" style="background:rgba(232,164,32,0.38)"></span></span></span></span>';
        }
        return '<span class="tc-window">' + mock(mode) + "</span>";
      }
      function paneAppearance(pane) {
        paneHead(pane, "Appearance", "How Daylight looks. Changes preview right away — Save to keep them.");
        var g = el('<div class="set-group"><div class="set-group-title">Theme</div><div class="theme-cards"></div><p class="set-helper">System follows your device\'s light or dark setting. Pick Light or Dark to keep Daylight in that theme all the time.</p></div>');
        var cards = g.querySelector(".theme-cards");
        [["system", "monitor", "System", "Follows your device", "tc-system"], ["light", "sun", "Light", "Bright, white surfaces", "tc-light"], ["dark", "moon", "Dark", "Soft dark, easy at night", "tc-dark"]].forEach(function (t) {
          var isSel = state.themeMode === t[0];
          var c = el('<button type="button" class="theme-card' + (isSel ? " sel" : "") + '" aria-pressed="' + isSel + '" aria-label="Theme: ' + t[2] + '"><span class="tc-check">' + icon("check", 12) + '</span><span class="tc-preview ' + t[4] + '">' + themePreviewHTML(t[0]) + '</span><span class="tc-name">' + icon(t[1], 15) + t[2] + '</span><span class="tc-caption">' + t[3] + "</span></button>");
          c.addEventListener("click", function () {
            state.themeMode = t[0]; applyTheme();
            cards.querySelectorAll(".theme-card").forEach(function (x) { x.classList.remove("sel"); x.setAttribute("aria-pressed", "false"); });
            c.classList.add("sel"); c.setAttribute("aria-pressed", "true");
            renderSidebar(); renderView(false);
          });
          cards.appendChild(c);
        });
        pane.appendChild(g);
        var g2 = el('<div class="set-group"><div class="set-group-title">Layout</div>' +
          setRowHTML("Density", "Comfortable gives rows more room. Compact fits more on screen at once.", selectHTML("apDensity", [["comfortable", "Comfortable"], ["compact", "Compact"]], state.density, "sm")) +
          "</div>");
        pane.appendChild(g2);
        g2.querySelector("#apDensity").addEventListener("change", function (e) {
          state.density = e.target.value;
          document.body.classList.toggle("density-compact", state.density === "compact");
          renderView(false);
        });
        var motion=el('<div class="set-group"><div class="set-group-title">Motion</div>'+
          setRowHTML("Reduce motion","Disable nonessential calendar and dialog transitions.",switchHTML("apReduceMotion",state.reduceMotion))+
          '</div>');
        pane.appendChild(motion);
        motion.querySelector("#apReduceMotion").addEventListener("change",function(e){
          state.reduceMotion=e.target.checked;
          document.body.classList.toggle("reduce-motion",state.reduceMotion);
        });
      }
      function paneCalendar(pane) {
        paneHead(pane, "Calendar", "How your calendar opens and what it shows.");
        /* Cron's Settings → Calendar view grouping: everything about
           how the grid reads lives in ONE section — weekends, declined
           events, week numbers, start-of-week, and the time zone with
           Google's "Use device time zone" toggle above the picker. */
        var g = el('<div class="set-group"><div class="set-group-title">Calendar view</div>' +
          '<div class="field"><label for="csView">Default Calendar View</label>' + selectHTML("csView", [["month", "Month"], ["week", "Week"], ["day", "Day"], ["agenda", "Agenda"]], state.defaultView || "month", "sm") +
          '</div>' +
          '<div class="set-row switch-row"><span><span class="sw-label">Show weekends</span><div class="sw-sub">Show Saturday and Sunday in Month and Week views.</div></span>' + switchHTML("csWeekends", state.showWeekends) + "</div>" +
          '<div class="set-row switch-row"><span><span class="sw-label">Show declined events</span><div class="sw-sub">Declined events stay visible on your calendar.</div></span>' + switchHTML("csSD", state.showDeclined) + "</div>" +
          '<div class="set-row switch-row"><span><span class="sw-label">Week numbers</span><div class="sw-sub">Show the ISO week number along the left edge of Month view.</div></span>' + switchHTML("csWN", state.weekNumbers) + "</div>" +
          setRowHTML("Start week on", "Changes the first column in Month, Week, and the mini calendar.", selectHTML("csWeekStart", [[0, "Sunday"], [1, "Monday"]], state.weekStart, "sm")) +
          "</div>");
        pane.appendChild(g);
        var sel = g.querySelector("#csView");
        settingsState.viewSelect = sel;
        sel.addEventListener("change", function () {
          /* Saved default view (Save/Discard pill); the calendar behind
             Settings previews it until then. */
          state.defaultView = sel.value;
          settingsState.pendingView = sel.value;
          if (sel.value !== state.view) { state.view = sel.value; state.prevView = null; renderHeader(); renderView(true, 1); renderSidebar(); }
          if (settingsState.markDirty) settingsState.markDirty();
        });
        g.querySelector("#csWeekends").addEventListener("change", function (e) { state.showWeekends = e.target.checked; renderView(false); });
        g.querySelector("#csSD").addEventListener("change", function (e) { state.showDeclined = e.target.checked; renderView(false); renderSidebar(); });
        g.querySelector("#csWN").addEventListener("change", function (e) { state.weekNumbers = e.target.checked; renderView(false); });
        g.querySelector("#csWeekStart").addEventListener("change", function (e) { state.weekStart = +e.target.value; renderSidebar(); renderView(false); });
      }
      function paneNotifications(pane) {
        paneHead(pane, "Notifications", "Reminders for the events on your calendar.");
        var status = ("Notification" in window) ? Notification.permission : "unsupported";
        var g = el('<div class="set-group">' +
          '<div class="set-row switch-row"><span><span class="sw-label">Browser notifications</span><div class="sw-sub" id="ntStatus">' +
          (status === "granted" ? "Notifications are on for this browser." : status === "denied" ? "Notifications are blocked in this browser's settings." : status === "unsupported" ? "This browser does not support notifications." : "Notifications are not turned on yet.") +
          '</div></span><button class="btn-ghost" id="ntBtn">Enable notifications</button></div>' +
          '<div class="set-row switch-row"><span><span class="sw-label">Event reminders</span><div class="sw-sub">Reminders follow the default reminder in Calendar settings. Each event can override it in the event form.</div></span><span class="dl-readonly-value">' + esc(state.defaultReminder ? fmtReminder(state.defaultReminder) : "No reminder") + '</span></div>' +
          '<div class="set-row switch-row"><span><span class="sw-label">Notification sound</span><div class="sw-sub">Play a soft chime when a reminder lands.</div></span>' + switchHTML("ntSound", state.notifSound) + "</div>" +
          '<div class="set-row switch-row"><span><span class="sw-label">Daily summary</span><div class="sw-sub">One notification with everything on the day ahead.</div></span>' + switchHTML("ntDaily", !!state.dailySummary) + "</div>" +
          '<div class="set-row switch-row"><span><span class="sw-label">Summary time</span><div class="sw-sub">When the daily summary is delivered.</div></span>' + selectHTML("ntSummary", [], state.summaryTime, "xs") + "</div></div>");
        pane.appendChild(g);
        var sumSel = g.querySelector("#ntSummary");
        ddSetOptions(sumSel, minuteOptionList(30), state.summaryTime);
        sumSel.addEventListener("change", function () { state.summaryTime = +sumSel.value; });
        g.querySelector("#ntSound").addEventListener("change", function (e) { state.notifSound = e.target.checked; });
        /* a feature's controls are disabled whenever the feature is off (same rule as Quiet hours below) */
        function syncSummary() { sumSel.disabled = !state.dailySummary; }
        syncSummary();
        g.querySelector("#ntDaily").addEventListener("change", function (e) { state.dailySummary = e.target.checked; syncSummary(); });
        var gq = el('<div class="set-group"><div class="set-group-title">Quiet hours</div>' +
          setRowHTML("Quiet hours", "Hold notifications during the hours below. They are delivered when quiet hours end.", switchHTML("ntQuiet", state.quietEnabled)) +
          setRowHTML("Quiet window", "Notifications are held from the first time until the second.", '<span class="dl-q-pair">' + selectHTML("ntQStart", [], state.quietStart, "xs") + "<span>to</span>" + selectHTML("ntQEnd", [], state.quietEnd, "xs") + "</span>") +
          "</div>");
        pane.appendChild(gq);
        var qsSel = gq.querySelector("#ntQStart"), qeSel = gq.querySelector("#ntQEnd");
        ddSetOptions(qsSel, minuteOptionList(30), state.quietStart);
        ddSetOptions(qeSel, minuteOptionList(30), state.quietEnd);
        function syncQuiet() { var dis = !state.quietEnabled; qsSel.disabled = dis; qeSel.disabled = dis; }
        syncQuiet();
        gq.querySelector("#ntQuiet").addEventListener("change", function (e) { state.quietEnabled = e.target.checked; syncQuiet(); });
        qsSel.addEventListener("change", function () { state.quietStart = +qsSel.value; });
        qeSel.addEventListener("change", function () { state.quietEnd = +qeSel.value; });
        var ntBtn=g.querySelector("#ntBtn"),ntStatus=g.querySelector("#ntStatus");
        function syncBrowserNotificationState(){
          var perm=("Notification" in window)?Notification.permission:"unsupported";
          ntStatus.textContent=perm==="granted"?"Notifications are on for this browser.":perm==="denied"?"Notifications are blocked in this browser's settings.":perm==="unsupported"?"This browser does not support notifications.":"Notifications are not turned on yet.";
          ntBtn.textContent=perm==="granted"?"Enabled":perm==="denied"?"Blocked in browser settings":perm==="unsupported"?"Unavailable":"Enable notifications";
          ntBtn.disabled=perm!=="default";
        }
        syncBrowserNotificationState();
        ntBtn.addEventListener("click",function(){
          if(!("Notification" in window)){syncBrowserNotificationState();return}
          Notification.requestPermission().then(function(perm){
            syncBrowserNotificationState();
            if(perm==="granted")toast("Notifications enabled");
          }).catch(function(){syncBrowserNotificationState()});
        });
      }
      function paneShortcuts(pane) {
        paneHead(pane, "Keyboard shortcuts", "Every shortcut Daylight supports. This page is a reference — the shortcuts themselves work everywhere in the app.");
        var mod = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";
        var rows = [
          ["Search events", "Jump straight to search from anywhere.", [[mod], ["K"]]],
          ["Open settings", "Toggle the settings popup.", [[mod], [","]]],
          ["New event", "Create an event on the selected day.", [["N"]]],
          ["Go to today", "Jump the calendar back to today.", [["T"]]],
          ["Previous period", "Page the calendar back a month, week, or day.", [["←"]]],
          ["Next period", "Page the calendar forward a month, week, or day.", [["→"]]],
          ["Close", "Close the topmost popup, menu, or dialog.", [["Esc"]]]
        ];
        var g = el('<div class="set-group"></div>');
        rows.forEach(function (r) {
          var keys = r[2].map(function (combo) {
            return combo.map(function (k) { return '<span class="kbd">' + esc(k) + "</span>"; }).join("");
          }).join("");
          g.appendChild(el('<div class="shortcut-row"><span><span class="sc-label">' + esc(r[0]) + '</span><div class="sc-sub">' + esc(r[1]) + '</div></span><span style="flex:none">' + keys + "</span></div>"));
        });
        pane.appendChild(g);
      }
      function paneData(pane, closeSettings) {
        paneHead(pane, "Data & sync", "Manage subscription refreshes, imports, exports and your workspace data.");
        /* Subscription creation belongs in the sidebar. The Supabase-backed
           feed management group is supplied by daylight-integrations.js. */
        var g2 = el('<div class="set-group"><div class="set-group-title">Your data</div>' +
          '<p class="pane-sub" style="margin:0 0 12px">Export saves your calendars, events, and settings as one JSON file. Import replaces what is here with the contents of a Daylight export.</p>' +
          '<div style="display:flex;gap:9px;flex-wrap:wrap"><button class="btn-ghost" id="dtExport">' + icon("download", 15) + '<span>Export data (JSON)</span></button>' +
          '<button class="btn-ghost" id="dtImport">' + icon("sync", 15) + '<span>Import data (JSON)</span></button></div>' +
          '<input type="file" id="dtFile" accept="application/json,.json" style="display:none"></div>');
        pane.appendChild(g2);
        g2.querySelector("#dtExport").addEventListener("click", exportJSON);
        var fileIn = g2.querySelector("#dtFile");
        g2.querySelector("#dtImport").addEventListener("click", function () { fileIn.click(); });
        fileIn.addEventListener("change", function () {
          if (!fileIn.files || !fileIn.files[0]) return;
          importJSON(fileIn.files[0], function (ok) { if (ok && settingsState.redrawPane) settingsState.redrawPane(); });
          fileIn.value = "";
        });
        var g3 = el('<div class="set-group"><div class="set-group-title" style="color:var(--danger)">Danger zone</div>' +
          '<div class="danger-zone"><div class="dz-title">Reset demo data</div>' +
          '<div class="dz-sub">Restore the original sample calendars and events, and put every setting back to its default. Anything you created or changed in this preview is lost.</div>' +
          '<button class="btn-danger-outline" id="dtReset">Reset demo data</button></div></div>');
        pane.appendChild(g3);
        g3.querySelector("#dtReset").addEventListener("click", function () {
          openConfirm({
            title: "Reset demo data?",
            body: "Your calendars, events, feeds, and settings go back to the original demo state. This cannot be undone.",
            confirmLabel: "Reset everything", danger: true,
            fn: function () { resetDemoData(function () { if (settingsState.redrawPane) settingsState.redrawPane(); }); }
          });
        });
      }
      function paneAbout(pane) {
        paneHead(pane, "About", "");
        var g = el('<div><div class="about-logo"><span class="logo-tile"><img class="daylight-mark daylight-mark-light" src="../assets/daylight-sunarc-light-NOBG.png" alt="" width="46" height="46"><img class="daylight-mark daylight-mark-dark" src="../assets/daylight-sunarc-dark-NOBG.png" alt="" width="46" height="46"></span><span><span style="font-size:17px;font-weight:600;letter-spacing:-0.01em;display:block">Daylight</span><span style="color:var(--muted);font-size:13px">Personal calendar</span></span></div>' +
          '<p class="pane-sub" style="margin:0 0 22px">One calm calendar for school, swim, and everything else — Month, Week, Day, and Agenda sharing the same design, plus a Tasks list that works the same way, with your settings and calendars kept together.</p>' +
          '<div class="set-group">' +
          setRowHTML("Version", "The build of Daylight you are using.", '<span style="font-size:14px;color:var(--muted)">1.0</span>') +
          setRowHTML("Subscribed calendars", "US Holidays is built into Daylight and read-only — it shows on your calendar but events can't be added to it.", '<span style="font-size:14px;color:var(--muted)">' + state.calendars.filter(function (c) { return isSubscribed(c); }).length + " active</span>") +
          "</div>" +
          '<p class="inline-note">Daylight is your calendar, kept simple on purpose.</p></div>');
        pane.appendChild(g);
      }

      /* ================= Auth (login / sign up) =================
         Design surface only: submitting either form enters the calendar app.
         Sign-in methods (Google, passkey, sign-up, reset) are wired in daylight-auth.js. */
      var authState = { mode: (window.__DL_ROUTE === "sign-up" ? "signup" : "login"), showPw: false, name: "", email: "", password: "", newPassword: "", confirmPassword: "", showNewPw: false, showConfirmPw: false, code: ["", "", "", "", "", ""], justReset: false };
      function googleGlyph() {
        return '<svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.8 3.6-4.9 6.8-4.9z"/></svg>';
      }
      function authArt() {
        /* A complete little month: weekday header, every date (adjacent months faint), today's disc, a few tiny bars, and one example
           event chip sitting INSIDE its cell. Title, color and day are picked fresh on each page load (authArt runs once, when the
           shell is built, so it then stays frozen through mode switches and theme toggles). Nothing is stored; no controls. The chip's
           color comes from the app's own PALETTE and is mixed into --auth-card so it adapts to light and dark. */
        var now = new Date(), y = now.getFullYear(), mo = now.getMonth();
        var first = new Date(y, mo, 1), startOffset = first.getDay(), dim = new Date(y, mo + 1, 0).getDate(), prevDim = new Date(y, mo, 0).getDate();
        var rows = Math.ceil((startOffset + dim) / 7), total = rows * 7;
        var cardTitles = ["Swim", "Game", "Gym", "Lunch"];
        var cardTitle = cardTitles[Math.floor(Math.random() * cardTitles.length)];
        var cardKeys = ["blue", "violet", "green", "amber", "rose"];
        var cardDot = (PALETTE[cardKeys[Math.floor(Math.random() * cardKeys.length)]] || PALETTE.blue).dot;
        var chipDay = 8 + Math.floor(Math.random() * Math.max(1, dim - 12));       /* a mid-month date, always inside the grid */
        var bars = {}; [3, 7, 11, 16, 24].forEach(function (d, i) { if (d <= dim && d !== chipDay) bars[d] = ["#e3a93d", "#43b581", "#e3a93d", "#5b8def", "#e3a93d"][i]; });
        var dows = ["S", "M", "T", "W", "T", "F", "S"].map(function (d) { return '<div class="auth-art-dow">' + d + "</div>"; }).join("");
        var cells = "";
        for (var c = 0; c < total; c++) {
          var d = c - startOffset + 1, out = d < 1 || d > dim, num = d < 1 ? prevDim + d : d > dim ? d - dim : d;
          var isToday = !out && d === now.getDate();
          cells += '<div class="auth-art-day' + (out ? " out" : "") + (isToday ? " today" : "") + '">' + num +
            (!out && bars[d] ? '<span class="bar" style="background:' + bars[d] + '"></span>' : "") +
            (!out && d === chipDay ? '<span class="auth-art-chip" style="background:color-mix(in srgb, ' + cardDot + ' 24%, var(--auth-card));box-shadow:inset 3px 0 0 ' + cardDot + '">' + cardTitle + "</span>" : "") + "</div>";
        }
        return '<div class="auth-art"><div class="auth-art-float"><p class="auth-art-month">' + MONTHS[mo] + '</p><div class="auth-art-grid">' + dows + cells + "</div></div></div>";
      }
      function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); }
      function pwRules(pw) {
        pw = pw || "";
        return [
          { label: "At least 12 characters", ok: pw.length >= 12 },
          { label: "An uppercase letter (A–Z)", ok: /[A-Z]/.test(pw) },
          { label: "A lowercase letter (a–z)", ok: /[a-z]/.test(pw) },
          { label: "A number (0–9)", ok: /[0-9]/.test(pw) },
          { label: "A symbol (e.g. ! @ # $ %)", ok: /[^A-Za-z0-9]/.test(pw) }
        ];
      }
      function pwRuleError(pw) {
        var rs = pwRules(pw);
        if (rs.every(function (r) { return r.ok; })) return "";
        if (!rs[0].ok) return "Password is too short — use at least 12 characters";
        if (!rs[1].ok) return "Add an uppercase letter";
        if (!rs[2].ok) return "Add a lowercase letter";
        if (!rs[3].ok) return "Add a number";
        if (!rs[4].ok) return "Add a symbol (e.g. ! @ # $ %)";
        return "Password doesn't meet all the rules yet";
      }
      function captureAuthInputs(root) {
        var n = root.querySelector("#authName"), e = root.querySelector("#authEmail"), p = root.querySelector("#authPassword");
        if (n) authState.name = n.value;
        if (e) authState.email = e.value;
        if (p) authState.password = p.value;
        var np = root.querySelector("#authNewPassword"); if (np) authState.newPassword = np.value;
        var cp = root.querySelector("#authConfirmPassword"); if (cp) authState.confirmPassword = cp.value;
        var boxes = root.querySelectorAll(".auth-code-box");
        if (boxes && boxes.length) boxes.forEach(function (b, i) { authState.code[i] = (b.value || "").replace(/\D/g, "").slice(0, 1); });
      }
      function enterApp() {
        /* Every entry path (form submit AND the social buttons, which
           skip the submit handler) lands here, so the profile name
           is derived here too: a name typed on sign-up becomes the
           name shown in the sidebar profile and in Settings. */
        if (authState.name && authState.name.trim()) {
          state.profileName = authState.name.trim().replace(/\s+/g, " ");
          state.firstName = state.profileName.split(" ")[0];
        }
        document.getElementById("authRoot").innerHTML = "";
        var app = document.getElementById("app");
        app.hidden = false;
        renderAll(false);
      }
      function logOut() {
        closeMenu(); closePopover(); closeDrawer();
        if (overlayRoot.children.length) overlayRoot.innerHTML = "";
        document.getElementById("app").hidden = true;
        authState.mode = "login"; authState.showPw = false; authState.password = ""; authState.newPassword = ""; authState.confirmPassword = ""; authState.showNewPw = false; authState.showConfirmPw = false; authState.code = ["", "", "", "", "", ""]; authState.justReset = false; stopResendCooldown();
        renderAuth();
      }
      /* ---------- Auth shell / form split ----------
         The shell (form panel + topbar/theme button + RIGHT VISUAL PANEL)
         is built exactly ONCE. The visual panel is never re-created,
         re-rendered or re-animated after that: mode switches and theme
         toggles only touch the left form's inner wrapper, so the wordmark,
         glowing November fragment and practice card stay pixel-identical
         and completely static across every switch. */
      var authEntered = false;   /* staggered entrance plays on first load only */
      var authSwitchSeq = 0;     /* generation counter: only the latest switch may land */
      var authSwitchTimers = [];
      function authReduced() {
        try { return !!(state.reduceMotion || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)); }
        catch (e) { return !!state.reduceMotion; }
      }
      function clearAuthSwitchTimers() {
        authSwitchTimers.forEach(function (t) { clearTimeout(t); });
        authSwitchTimers = [];
      }
      function authTimer(fn, ms) {
        var id = setTimeout(fn, ms);
        authSwitchTimers.push(id);
        return id;
      }
      function authIsLogin() { return authState.mode === "login"; }
      function authIsForgotCode() { return authState.mode === "forgot-code"; }
      function authIsForgotNew() { return authState.mode === "forgot-new"; }
      function authIsForgot() { return authIsForgotCode() || authIsForgotNew(); }
      function authPanelLabel() { if (authIsLogin()) return "Log in"; if (authState.mode === "signup") return "Sign up"; return "Reset password"; }
      /* Resend cooldown — 30s, ticking label, cleared on leaving the step */
      var resendInterval = null; var resendRemaining = 0;
      /* Demo reset code: fixed for this preview (a real build would
         verify server-side). Shown in a toast so both outcomes of the
         auto check can be tried. codeStateTimer drives the success
         flash / wrong-code clear; lastFailedCode stops the same wrong
         code re-triggering the shake on every keystroke. */
      var DEMO_CODE = "428571";
      var codeStateTimer = null; var lastFailedCode = "";
      function stopResendCooldown() { if (resendInterval) { clearInterval(resendInterval); resendInterval = null; } resendRemaining = 0; }
      function fmtResendTime(s) { return "0:" + (s < 10 ? "0" : "") + s; }
      function paintResend(root) {
        var btn = root ? root.querySelector("#authResend") : document.querySelector("#authResend");
        if (!btn) return;
        if (resendRemaining > 0) { btn.disabled = true; btn.textContent = "Resend code in " + fmtResendTime(resendRemaining); }
        else { btn.disabled = false; btn.textContent = "Resend code"; }
      }
      function startResendCooldown(root) {
        stopResendCooldown();
        resendRemaining = 30;
        paintResend(root);
        resendInterval = setInterval(function () {
          resendRemaining--;
          if (resendRemaining <= 0) { stopResendCooldown(); paintResend(document.getElementById("authRoot")); return; }
          paintResend(document.getElementById("authRoot"));
        }, 1000);
      }
      /* Hazard that lives in the pill's right-edge slot while the field
         is invalid. The tooltip is its visible message; the matching
         .auth-error span (screen-reader only) carries the same text via
         the input's aria-describedby. */
      function authHazardHtml(tipId) {
        /* A plain marker, not a button, while the field is valid: it is
           invisible then, so it must not exist as a control at all.
           setErr promotes it to a focusable button (role/tabindex) only
           while an error is actually showing. */
        return '<span class="auth-hazard-wrap"><span class="auth-hazard" aria-hidden="true">' + icon("alert", 19) + '</span><span class="auth-tip" id="' + tipId + '" role="tooltip"></span></span>';
      }
      function authPillHtml(id, label, inner, errId, tipId) {
        return '<div class="auth-field"><div class="auth-pill" data-pill-for="' + id + '"><span class="auth-pill-label">' + label + "</span>" + inner + authHazardHtml(tipId) + '</div><div class="auth-error-space"><span class="auth-error" id="' + errId + '" aria-live="polite"></span></div></div>';
      }
      /* Inner HTML of the left form ONLY — headline, switch line, fields,
         primary button, forgot/terms. Rebuilt on a mode switch; nothing
         outside .auth-form-inner is ever rebuilt. */
      function rulesHtmlFor(pwVal) {
        return pwRules(pwVal).map(function (r) {
          return '<span class="auth-rule' + (r.ok ? " ok" : "") + '" data-rule="' + esc(r.label) + '"><span class="rule-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>' + esc(r.label) + "</span>";
        }).join("");
      }
      /* Password requirements list shared by sign-up and reset step 2.
         It sits directly under the password pill with no box or
         header. While the password is empty the wrapper is collapsed
         (0fr, aria-hidden="true") so it takes no space at all; the
         first keystroke adds .show via paintReqVisibility and it
         animates in, and clearing the field animates it back out.
         Rule state is derived from the password value, so it persists
         across rebuilds and mode switches. */
      function reqListHtml(pwVal) {
        var has = !!pwVal;
        return '<div class="auth-reqs' + (has ? " show" : "") + '" id="authReqs" aria-hidden="' + (has ? "false" : "true") + '"><div class="auth-reqs-clip"><div class="auth-reqs-list">' + rulesHtmlFor(pwVal) + "</div></div></div>";
      }
      function paintReqVisibility(root, pwVal) {
        var wrap = root.querySelector("#authReqs");
        if (!wrap) return;
        var has = !!pwVal;
        wrap.classList.toggle("show", has);
        wrap.setAttribute("aria-hidden", has ? "false" : "true");
      }
      function buildAuthFormInner() {
        if (authIsForgotCode()) {
          var boxes = "";
          for (var ci = 0; ci < 6; ci++) {
            boxes += '<input class="auth-code-box" type="text" inputmode="numeric" autocomplete="' + (ci === 0 ? "one-time-code" : "off") + '" maxlength="1" data-code-idx="' + ci + '" aria-label="Digit ' + (ci + 1) + ' of 6" value="' + esc(authState.code[ci] || "") + '">';
          }
          return (
            '<div class="auth-mark"><img class="daylight-mark daylight-mark-light" src="../assets/daylight-sunarc-light-NOBG.png" alt=""><img class="daylight-mark daylight-mark-dark" src="../assets/daylight-sunarc-dark-NOBG.png" alt=""></div>' +
            '<h1 class="auth-headline">Reset your password</h1>' +
            '<p class="auth-subline">Enter the 6-digit code sent to your email.</p>' +
            '<div class="auth-code-wrap"><div class="auth-code-row" id="authCodeRow" role="group" aria-label="6-digit code">' + boxes + '</div>' +
            '<div class="auth-code-msg" id="authCodeMsg" aria-live="polite"><span class="hz-ic">' + icon("alert", 16) + '</span><span id="authCodeMsgText"></span></div></div>' +
            '<div class="auth-resend-row"><button type="button" class="auth-resend" id="authResend">Resend code</button></div>' +
            '<div class="auth-back-row" style="margin-top:22px"><button type="button" class="auth-back" id="authBackToLogin">Back to sign in</button></div>'
          );
        }
        if (authIsForgotNew()) {
          var npw = authState.newPassword || "";
          var newPwField =
            '<div class="auth-field"><div class="auth-pill" data-pill-for="authNewPassword"><span class="auth-pill-label">New password</span>' +
            '<input class="auth-pill-input" id="authNewPassword" type="' + (authState.showNewPw ? "text" : "password") + '" autocomplete="new-password" placeholder="Create a new password" value="' + esc(npw) + '" aria-invalid="false" aria-describedby="authNewPwErr">' +
            '<button type="button" class="auth-eye" id="authNewEye" title="' + (authState.showNewPw ? "Hide password" : "Show password") + '" aria-label="' + (authState.showNewPw ? "Hide password" : "Show password") + '">' + icon(authState.showNewPw ? "eyeOff" : "eye", 18) + "</button>" + authHazardHtml("authNewPwTip") + "</div>" +
            reqListHtml(npw) +
            '<div class="auth-error-space"><span class="auth-error" id="authNewPwErr" aria-live="polite"></span></div></div>';
          var confirmField =
            '<div class="auth-field"><div class="auth-pill" data-pill-for="authConfirmPassword"><span class="auth-pill-label">Confirm new password</span>' +
            '<input class="auth-pill-input" id="authConfirmPassword" type="' + (authState.showConfirmPw ? "text" : "password") + '" autocomplete="new-password" placeholder="Type it again" value="' + esc(authState.confirmPassword || "") + '" aria-invalid="false" aria-describedby="authConfirmErr">' +
            '<button type="button" class="auth-eye" id="authConfirmEye" title="' + (authState.showConfirmPw ? "Hide password" : "Show password") + '" aria-label="' + (authState.showConfirmPw ? "Hide password" : "Show password") + '">' + icon(authState.showConfirmPw ? "eyeOff" : "eye", 18) + "</button>" + authHazardHtml("authConfirmTip") + "</div>" +
            '<div class="auth-error-space"><span class="auth-error" id="authConfirmErr" aria-live="polite"></span></div></div>';
          return (
            '<div class="auth-mark"><img class="daylight-mark daylight-mark-light" src="../assets/daylight-sunarc-light-NOBG.png" alt=""><img class="daylight-mark daylight-mark-dark" src="../assets/daylight-sunarc-dark-NOBG.png" alt=""></div>' +
            '<h1 class="auth-headline">Set a new password</h1>' +
            '<p class="auth-subline">Choose a new password for your account.</p>' +
            '<div class="auth-fields">' + newPwField + confirmField + "</div>" +
            '<button type="submit" class="auth-primary">Reset password</button>' +
            '<div class="auth-back-row"><button type="button" class="auth-back" id="authBackToLogin">Back to sign in</button></div>'
          );
        }
        var isLogin = authIsLogin();
        var pw = authState.password || "";
        var nameField = isLogin ? "" : authPillHtml("authName", "Name",
          '<input class="auth-pill-input" id="authName" type="text" autocomplete="name" placeholder="Your name" value="' + esc(authState.name) + '" aria-invalid="false" aria-describedby="authNameErr">',
          "authNameErr", "authNameTip");
        var emailField = authPillHtml("authEmail", "Email",
          '<input class="auth-pill-input" id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" value="' + esc(authState.email) + '" aria-invalid="false" aria-describedby="authEmailErr">',
          "authEmailErr", "authEmailTip");
        var pwField =
          '<div class="auth-field"><div class="auth-pill" data-pill-for="authPassword"><span class="auth-pill-label">Password</span>' +
          '<input class="auth-pill-input" id="authPassword" type="' + (authState.showPw ? "text" : "password") + '" autocomplete="' + (isLogin ? "current-password" : "new-password") + '" placeholder="' + (isLogin ? "Your password" : "Create a password") + '" value="' + esc(pw) + '" aria-invalid="false" aria-describedby="authPwErr">' +
          '<button type="button" class="auth-eye" id="authEye" title="' + (authState.showPw ? "Hide password" : "Show password") + '" aria-label="' + (authState.showPw ? "Hide password" : "Show password") + '">' + icon(authState.showPw ? "eyeOff" : "eye", 18) + "</button>" + authHazardHtml("authPwTip") + "</div>" +
          (isLogin ? "" : reqListHtml(pw)) +
          '<div class="auth-error-space"><span class="auth-error" id="authPwErr" aria-live="polite"></span></div></div>';
        return (
          '<div class="auth-mark"><img class="daylight-mark daylight-mark-light" src="../assets/daylight-sunarc-light-NOBG.png" alt=""><img class="daylight-mark daylight-mark-dark" src="../assets/daylight-sunarc-dark-NOBG.png" alt=""></div>' +
          '<h1 class="auth-headline">' + (isLogin ? "Sign in" : "Create account") + "</h1>" +
          '<p class="auth-altline">or <button type="button" id="authSwitch">' + (isLogin ? "create an account" : "sign in instead") + "</button></p>" +
          (isLogin && authState.justReset ? '<div class="auth-success" role="status"><span class="ok-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span><span>Password updated — sign in with your new password.</span></div>' : "") +
          '<div class="auth-fields">' + nameField + emailField + pwField + "</div>" +
          '<button type="submit" class="auth-primary">' + (isLogin ? "Log in" : "Create account") + "</button>" +
          (isLogin ? '<div class="auth-forgot-row"><a class="auth-forgot" href="#" id="authForgot">Forgot password?</a></div>' : "") +
          (isLogin ? "" : '<p class="auth-terms">By continuing, you agree to the <a href="#" data-terms>Terms of Service</a> and <a href="#" data-terms>Privacy Policy</a>.</p>')
        );
      }
      /* Specific, plain-words problem for a field's current value, or ""
         when valid. requireAll (submit) also flags empty fields; the
         live/blur path passes false so an untouched empty field stays
         quiet until submit. */
      function authFieldError(input, requireAll) {
        var isLogin = authIsLogin();
        if (!input) return "";
        var v = input.value;
        if (input.id === "authName") return v.trim() ? "" : (requireAll ? "Name can't be empty" : "");
        if (input.id === "authEmail") {
          if (!v.trim()) return requireAll ? "Email can't be empty" : "";
          return validEmail(v) ? "" : "Enter a valid email address";
        }
        if (input.id === "authPassword") {
          if (!v) return requireAll ? "Password can't be empty" : "";
          if (isLogin) return "";
          return pwRuleError(v);
        }
        if (input.id === "authNewPassword") {
          if (!v) return requireAll ? "Password can't be empty" : "";
          return pwRuleError(v);
        }
        if (input.id === "authConfirmPassword") {
          if (!v) return requireAll ? "Confirm your new password" : "";
          var npEl = document.querySelector("#authNewPassword");
          var npVal = npEl ? npEl.value : authState.newPassword;
          return v === npVal ? "" : "Passwords don't match";
        }
        return "";
      }
      var AUTH_ERR_IDS = { authName: ["#authNameErr", "#authNameTip"], authEmail: ["#authEmailErr", "#authEmailTip"], authPassword: ["#authPwErr", "#authPwTip"], authNewPassword: ["#authNewPwErr", "#authNewPwTip"], authConfirmPassword: ["#authConfirmErr", "#authConfirmTip"] };
      /* One writer for every error state: pill tint, hazard in the
         right-edge slot (replacing the eye on the password pill), the
         tooltip copy, and the screen-reader copy all move together. */
      function authSetErr(root, input, on, msg) {
        var pl = input ? input.closest(".auth-pill") : null;
        if (pl) pl.classList.toggle("err", !!on);
        if (!input) return;
        input.setAttribute("aria-invalid", on ? "true" : "false");
        var ids = AUTH_ERR_IDS[input.id]; if (!ids) return;
        var text = on ? (msg || authFieldError(input, true)) : "";
        var errNode = root.querySelector(ids[0]); if (errNode) { errNode.textContent = text; errNode.classList.toggle("show", !!on); }
        var tipNode = root.querySelector(ids[1]); if (tipNode) tipNode.textContent = text;
        var hz = pl ? pl.querySelector(".auth-hazard") : null;
        if (hz) {
          if (on) { hz.removeAttribute("aria-hidden"); hz.setAttribute("role", "button"); hz.setAttribute("tabindex", "0"); hz.setAttribute("aria-label", text); hz.setAttribute("aria-describedby", ids[1].slice(1)); }
          else { hz.setAttribute("aria-hidden", "true"); hz.removeAttribute("role"); hz.removeAttribute("tabindex"); hz.removeAttribute("aria-label"); hz.removeAttribute("aria-describedby"); }
        }
        if (!on) { var wrap = pl ? pl.querySelector(".auth-hazard-wrap") : null; if (wrap) wrap.classList.remove("tip-open"); }
      }
      function authShowErrFor(root, input, requireAll) { var m = authFieldError(input, requireAll); authSetErr(root, input, !!m, m); return !m; }
      /* While an error is showing, typing re-checks live: it clears the
         moment the field turns valid, and the tooltip copy tracks the
         current problem until then. Quiet fields stay quiet. */
      function authRefreshErrLive(root, input) {
        var isLogin = authIsLogin();
        var pl = input ? input.closest(".auth-pill") : null;
        if (!pl || !pl.classList.contains("err")) return;
        var m = authFieldError(input, false) || authFieldError(input, true);
        var stillBad;
        if (input.id === "authPassword" && !isLogin) stillBad = !pwRules(input.value).every(function (r) { return r.ok; });
        else if (input.id === "authNewPassword") stillBad = !pwRules(input.value).every(function (r) { return r.ok; });
        else if (input.id === "authConfirmPassword") { var npEl2 = root.querySelector("#authNewPassword"); stillBad = input.value !== (npEl2 ? npEl2.value : authState.newPassword) || !input.value; }
        else if (input.id === "authEmail") stillBad = !validEmail(input.value);
        else stillBad = !input.value.trim();
        if (input.id === "authPassword" && isLogin) stillBad = !input.value;
        if (!stillBad) authSetErr(root, input, false); else authSetErr(root, input, true, m);
      }
      function authSetCodeErr(root, on, msg) {
        var row = root.querySelector("#authCodeRow"); if (row) row.classList.toggle("err", !!on);
        var wrap = root.querySelector("#authCodeMsg"); var txt = root.querySelector("#authCodeMsgText");
        if (txt) txt.textContent = on ? (msg || "Enter all 6 digits of the code") : "";
        if (wrap) wrap.classList.toggle("show", !!on);
        root.querySelectorAll(".auth-code-box").forEach(function (b) { b.setAttribute("aria-invalid", on ? "true" : "false"); });
      }
      function authCodeValue(root) {
        var vals = [];
        root.querySelectorAll(".auth-code-box").forEach(function (b) { vals.push((b.value || "").replace(/\D/g, "").slice(0, 1)); });
        return vals.join("");
      }
      /* Auto approve/deny for step 1: runs the moment the code is
         complete (last digit typed, multi-digit input, or full paste)
         — there is no Continue button anymore. Correct: green flash on
         all six boxes for ~600ms, then the usual cross-fade to step 2.
         Wrong: red borders/tint + shake + hazard line, then after
         ~1.2s the boxes clear and focus returns to box 1 (typing
         sooner clears the red immediately and cancels that timer). */
      function authCheckCode(root) {
        var row = root.querySelector("#authCodeRow");
        if (!row || row.classList.contains("ok")) return;
        var val = authCodeValue(root);
        if (val.length < 6) return;
        if (codeStateTimer) { clearTimeout(codeStateTimer); codeStateTimer = null; }
        if (val === DEMO_CODE) {
          lastFailedCode = "";
          authSetCodeErr(root, false);
          row.classList.add("ok");
          root.querySelectorAll(".auth-code-box").forEach(function (b) { b.disabled = true; });
          codeStateTimer = setTimeout(function () {
            codeStateTimer = null;
            if (!authIsForgotCode() || !document.contains(row)) return;
            transitionAuthTo(root, "forgot-new");
          }, 650);
        } else {
          lastFailedCode = val;
          authSetCodeErr(root, true, "That code isn't right — check it and try again.");
          row.classList.remove("shake"); void row.offsetWidth; row.classList.add("shake");
          codeStateTimer = setTimeout(function () {
            codeStateTimer = null;
            if (!document.contains(row)) return;
            lastFailedCode = "";
            root.querySelectorAll(".auth-code-box").forEach(function (b, i) { b.value = ""; authState.code[i] = ""; b.setAttribute("aria-invalid", "false"); });
            row.classList.remove("shake");
            authSetCodeErr(root, false);
            var first = root.querySelector(".auth-code-box"); if (first) first.focus();
          }, 1200);
        }
      }
      /* Bind everything that lives INSIDE .auth-form-inner. Called each
         time the inner contents are (re)built — and only then. */
      function bindAuthFormInner(root) {
        var isLogin = authIsLogin();
        var form = root.querySelector("#authForm");
        var emailIn = root.querySelector("#authEmail");
        var pwIn = root.querySelector("#authPassword");
        var nameIn = root.querySelector("#authName");
        root.querySelectorAll(".auth-pill").forEach(function (pl) {
          pl.addEventListener("click", function (e) {
            if (e.target.closest(".auth-eye") || e.target.closest(".auth-hazard-wrap")) return;
            var inp = pl.querySelector(".auth-pill-input"); if (inp) inp.focus();
          });
        });
        /* Hazard tap/click toggles the tooltip for touch (hover and
           focus-within already reveal it via CSS); tapping elsewhere or
           typing closes any open tooltip. */
        root.querySelectorAll(".auth-hazard").forEach(function (hz) {
          function toggleTip(e) {
            e.stopPropagation();
            var wrap = hz.closest(".auth-hazard-wrap");
            var wasOpen = wrap.classList.contains("tip-open");
            root.querySelectorAll(".auth-hazard-wrap.tip-open").forEach(function (w) { w.classList.remove("tip-open"); });
            if (!wasOpen) wrap.classList.add("tip-open");
          }
          hz.addEventListener("click", toggleTip);
          hz.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTip(e); } });
        });
        var eye = root.querySelector("#authEye");
        if (eye) eye.addEventListener("click", function () {
          captureAuthInputs(root);
          authState.showPw = !authState.showPw;
          pwIn.type = authState.showPw ? "text" : "password";
          this.innerHTML = icon(authState.showPw ? "eyeOff" : "eye", 18);
          this.title = authState.showPw ? "Hide password" : "Show password";
          this.setAttribute("aria-label", this.title);
          pwIn.focus();
        });
        var sw = root.querySelector("#authSwitch");
        if (sw) sw.addEventListener("click", function () { switchAuthMode(root); });
        var forgot = root.querySelector("#authForgot");
        if (forgot) forgot.addEventListener("click", function (e) { e.preventDefault(); authState.justReset = false; transitionAuthTo(root, "forgot-code"); });
        var backBtn = root.querySelector("#authBackToLogin");
        if (backBtn) backBtn.addEventListener("click", function () { stopResendCooldown(); transitionAuthTo(root, "login"); });
        /* --- Forgot: code boxes --- */
        var codeBoxes = Array.prototype.slice.call(root.querySelectorAll(".auth-code-box"));
        if (codeBoxes.length) {
          if (!resendInterval && resendRemaining <= 0) startResendCooldown(root); else paintResend(root);
          /* Step 1 just opened: show the demo code once so both the
             approve and deny paths can be tried. */
          toast("Demo code sent: " + DEMO_CODE);
          codeBoxes.forEach(function (box, idx) {
            box.addEventListener("input", function () {
              /* Typing while the wrong-code red is up clears it (and its
                 pending auto-clear timer) immediately. */
              var rowNow = root.querySelector("#authCodeRow");
              if (rowNow && rowNow.classList.contains("err")) {
                if (codeStateTimer) { clearTimeout(codeStateTimer); codeStateTimer = null; }
                authSetCodeErr(root, false);
              }
              var digits = box.value.replace(/\D/g, "");
              if (digits.length > 1) {
                /* Typing/pasting multiple digits into one box distributes them */
                for (var k = 0; k < digits.length && idx + k < codeBoxes.length; k++) { codeBoxes[idx + k].value = digits[k]; authState.code[idx + k] = digits[k]; }
                var nextIdx = Math.min(idx + digits.length, codeBoxes.length - 1);
                codeBoxes[nextIdx].focus(); if (codeBoxes[nextIdx].select) codeBoxes[nextIdx].select();
              } else {
                box.value = digits; authState.code[idx] = digits;
                if (digits && idx < codeBoxes.length - 1) { codeBoxes[idx + 1].focus(); }
              }
              var codeNow = authCodeValue(root);
              if (codeNow.length < 6) lastFailedCode = "";
              if (codeNow.length === 6 && codeNow !== lastFailedCode) authCheckCode(root);
            });
            box.addEventListener("keydown", function (e) {
              if (e.key === "Backspace") {
                if (box.value) { box.value = ""; authState.code[idx] = ""; e.preventDefault(); }
                else if (idx > 0) { e.preventDefault(); codeBoxes[idx - 1].focus(); codeBoxes[idx - 1].value = ""; authState.code[idx - 1] = ""; }
              } else if (e.key === "ArrowLeft" && idx > 0) { e.preventDefault(); codeBoxes[idx - 1].focus(); }
              else if (e.key === "ArrowRight" && idx < codeBoxes.length - 1) { e.preventDefault(); codeBoxes[idx + 1].focus(); }
            });
            box.addEventListener("paste", function (e) {
              e.preventDefault();
              var text = "";
              try { text = (e.clipboardData || window.clipboardData).getData("text") || ""; } catch (err) {}
              var digits2 = text.replace(/\D/g, "").slice(0, 6);
              if (!digits2) return;
              codeBoxes.forEach(function (b, i) { b.value = digits2[i] || ""; authState.code[i] = digits2[i] || ""; });
              var focusIdx = Math.min(digits2.length, codeBoxes.length - 1);
              codeBoxes[focusIdx].focus();
              if (digits2.length === 6) { lastFailedCode = ""; authCheckCode(root); }
            });
            box.addEventListener("focus", function () { box.select(); });
          });
          var resendBtn = root.querySelector("#authResend");
          if (resendBtn) resendBtn.addEventListener("click", function () {
            if (resendRemaining > 0) return;
            startResendCooldown(root);
            toast("Demo code sent: " + DEMO_CODE);
          });
        }
        /* --- Forgot: new password eyes + live rules / mismatch --- */
        function bindEye(btnId, inputId, stateKey) {
          var btn = root.querySelector(btnId); var inp = root.querySelector(inputId);
          if (!btn || !inp) return;
          btn.addEventListener("click", function () {
            captureAuthInputs(root);
            authState[stateKey] = !authState[stateKey];
            inp.type = authState[stateKey] ? "text" : "password";
            btn.innerHTML = icon(authState[stateKey] ? "eyeOff" : "eye", 18);
            btn.title = authState[stateKey] ? "Hide password" : "Show password";
            btn.setAttribute("aria-label", btn.title);
            inp.focus();
          });
        }
        bindEye("#authNewEye", "#authNewPassword", "showNewPw");
        bindEye("#authConfirmEye", "#authConfirmPassword", "showConfirmPw");
        var newPwIn = root.querySelector("#authNewPassword");
        var confPwIn = root.querySelector("#authConfirmPassword");
        if (newPwIn) {
          newPwIn.addEventListener("input", function () {
            authState.newPassword = newPwIn.value; authRefreshErrLive(root, newPwIn);
            var rs = pwRules(newPwIn.value);
            root.querySelectorAll(".auth-rule").forEach(function (node, i) { if (rs[i]) node.classList.toggle("ok", rs[i].ok); });
            paintReqVisibility(root, newPwIn.value);
            if (confPwIn) authRefreshErrLive(root, confPwIn);
          });
          newPwIn.addEventListener("blur", function () { if (newPwIn.value) authShowErrFor(root, newPwIn, false); });
        }
        if (confPwIn) {
          confPwIn.addEventListener("input", function () { authState.confirmPassword = confPwIn.value; authRefreshErrLive(root, confPwIn); });
          confPwIn.addEventListener("blur", function () { if (confPwIn.value) authShowErrFor(root, confPwIn, false); });
        }
        root.querySelectorAll("[data-terms]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); }); });
        if (emailIn) {
          emailIn.addEventListener("input", function () { authState.email = emailIn.value; authRefreshErrLive(root, emailIn); });
          emailIn.addEventListener("blur", function () { if (emailIn.value.trim()) authShowErrFor(root, emailIn, false); });
        }
        if (nameIn) {
          nameIn.addEventListener("input", function () { authState.name = nameIn.value; authRefreshErrLive(root, nameIn); });
          nameIn.addEventListener("blur", function () { var pl = nameIn.closest(".auth-pill"); if (pl && pl.classList.contains("err")) authShowErrFor(root, nameIn, true); });
        }
        if (pwIn) {
          pwIn.addEventListener("blur", function () { if (!authIsLogin() && pwIn.value) authShowErrFor(root, pwIn, false); });
          pwIn.addEventListener("input", function () {
            authState.password = pwIn.value; authRefreshErrLive(root, pwIn);
            if (!authIsLogin()) {
              var rs = pwRules(pwIn.value);
              root.querySelectorAll(".auth-rule").forEach(function (node, i) { if (rs[i]) node.classList.toggle("ok", rs[i].ok); });
              paintReqVisibility(root, pwIn.value);
            }
          });
        }
        if (form) { /* submit is bound once at shell level; nothing to add here */ }
      }
      /* Swap ONLY the inner form contents for the current authState.mode.
         No animation, no shell contact — used for instant (reduced-motion)
         swaps and for rebuilding the shell. */
      function replaceAuthFormInner(root) {
        var inner = root.querySelector("#authFormInner");
        if (!inner) return;
        inner.classList.remove("switch-out", "switch-in");
        inner.style.opacity = ""; inner.style.transform = "";
        inner.style.height = ""; inner.style.overflow = "";
        inner.innerHTML = buildAuthFormInner();
        var panel = root.querySelector(".auth-form-panel");
        if (panel) panel.setAttribute("aria-label", authPanelLabel());
        bindAuthFormInner(root);
      }
      /* The Log in <-> Create account switch. Only the left form's inner
         group moves: it fades/drifts out, its contents swap, then it
         fades in while its height animates between the two modes, so the
         vertically-centered column re-centers smoothly even though the
         sign-up form is taller (Name pill + password rules). The right
         visual panel, the topbar and the theme button are never touched.
         Rapid repeated clicks are generation-guarded: every click bumps
         authSwitchSeq and cancels pending timers, and the one surviving
         timer renders whatever mode is current when it fires — so the
         form can never be left half-faded or blank. */
      function switchAuthMode(root) { authState.justReset = false; transitionAuthTo(root, authIsLogin() ? "signup" : "login"); }
      function transitionAuthTo(root, newMode) {
        captureAuthInputs(root);
        /* Leaving a step kills any pending code flash/clear timer. */
        if (codeStateTimer) { clearTimeout(codeStateTimer); codeStateTimer = null; }
        lastFailedCode = "";
        if (newMode !== "forgot-code") stopResendCooldown();
        if (newMode === "login" && authState.mode !== "forgot-new") { /* keep justReset only when arriving from a successful reset — caller sets it */ }
        authState.mode = newMode;
        authState.showPw = false;
        var inner = root.querySelector("#authFormInner");
        /* The entrance belongs to first load only — make sure its class
           is gone before any new nodes exist under it. */
        var screen = root.querySelector("#authScreen");
        if (screen) screen.classList.remove("is-enter");
        var wrap = root.querySelector(".auth-form-wrap");
        if (wrap) wrap.classList.remove("is-enter");
        var seq = ++authSwitchSeq;
        clearAuthSwitchTimers();
        if (!inner || authReduced()) { replaceAuthFormInner(root); return; }
        var oldH = inner.offsetHeight;
        inner.classList.remove("switch-in");
        inner.classList.add("switch-out");
        authTimer(function () {
          if (seq !== authSwitchSeq) return;
          inner.style.height = oldH + "px";
          inner.style.overflow = "hidden";
          inner.innerHTML = buildAuthFormInner();
          var panel = root.querySelector(".auth-form-panel");
          if (panel) panel.setAttribute("aria-label", authPanelLabel());
          bindAuthFormInner(root);
          var newH = inner.scrollHeight;
          /* A collapsed requirements list is 0px tall on screen, but
             its clipped rule rows can still count toward scrollHeight —
             subtract that hidden overflow so the switch's height
             animation targets the real visible height. When the list
             is shown the delta is 0, so this is a no-op then. */
          var reqs = inner.querySelector(".auth-reqs");
          if (reqs) newH -= Math.max(0, reqs.scrollHeight - reqs.clientHeight);
          inner.classList.remove("switch-out");
          inner.classList.add("switch-in");
          if (newH && newH !== oldH) {
            void inner.offsetHeight; /* flush, so the height below transitions */
            inner.style.height = newH + "px";
          } else {
            inner.style.height = ""; inner.style.overflow = "";
          }
          authTimer(function () {
            if (seq !== authSwitchSeq) return;
            inner.classList.remove("switch-in");
            inner.style.height = ""; inner.style.overflow = "";
          }, 320);
        }, 170);
      }
      /* Build the shell ONCE (visual panel included), then only ever
         refresh the form's inner wrapper. If the shell already exists —
         theme changes, repeat calls — the visual panel and topbar are
         left exactly as they are. */
      function renderAuth() {
        var root = document.getElementById("authRoot");
        var existing = root.querySelector("#authScreen");
        if (existing) {
          /* Shell is live: refresh just the form contents in place. */
          authSwitchSeq++; clearAuthSwitchTimers();
          replaceAuthFormInner(root);
          return;
        }
        var isDark = effectiveTheme() === "dark";
        var firstLoad = !authEntered;
        authEntered = true;
        root.innerHTML =
          '<div id="authScreen"' + (firstLoad ? ' class="is-enter"' : "") + ">" +
            '<section class="auth-form-panel" aria-label="' + authPanelLabel() + '">' +
              '<div class="auth-topbar"><span class="auth-brand"><span class="auth-brand-mark"><img class="daylight-mark daylight-mark-light" src="../assets/daylight-sunarc-light-NOBG.png" alt="" width="34" height="34"><img class="daylight-mark daylight-mark-dark" src="../assets/daylight-sunarc-dark-NOBG.png" alt="" width="34" height="34"></span><span class="auth-wordmark">Daylight</span></span>' +
              '<button class="auth-theme-btn" id="authThemeBtn" title="' + (isDark ? "Switch to light theme" : "Switch to dark theme") + '" aria-label="' + (isDark ? "Switch to light theme" : "Switch to dark theme") + '">' + icon(isDark ? "sun" : "moon", 17) + "</button></div>" +
              '<form class="auth-form-wrap' + (firstLoad ? " is-enter" : "") + '" id="authForm" novalidate>' +
                '<div class="auth-form-inner" id="authFormInner"></div>' +
              "</form>" +
            "</section>" +
            '<aside class="auth-visual-panel" aria-hidden="true"><span class="auth-visual-word">Daylight</span>' + authArt() + "</aside>" +
          "</div>";
        replaceAuthFormInner(root);
        /* ---- Shell-level bindings: attached once, never re-attached ---- */
        if (!root.dataset.tipBound) {
          root.dataset.tipBound = "1";
          root.addEventListener("click", function (e) {
            if (!e.target.closest(".auth-hazard-wrap")) root.querySelectorAll(".auth-hazard-wrap.tip-open").forEach(function (w) { w.classList.remove("tip-open"); });
          });
        }
        /* Theme toggle updates ONLY itself: colors flow from the CSS
           variables, so neither panel is re-rendered and the entrance
           animations stay untouched. */
        root.querySelector("#authThemeBtn").addEventListener("click", function () {
          captureAuthInputs(root);
          state.themeMode = effectiveTheme() === "dark" ? "light" : "dark";
          applyTheme();
          var dk = effectiveTheme() === "dark";
          this.innerHTML = icon(dk ? "sun" : "moon", 17);
          this.title = dk ? "Switch to light theme" : "Switch to dark theme";
          this.setAttribute("aria-label", this.title);
          this.focus();
        });
        root.querySelector("#authForm").addEventListener("submit", function (e) {
          e.preventDefault();
          /* Forgot step 1 — code */
          if (authIsForgotCode()) {
            var codeVal = authCodeValue(root);
            if (codeVal.length < 6) {
              authSetCodeErr(root, true, "Enter all 6 digits of the code — " + (6 - codeVal.length) + " left");
              var firstEmpty = null;
              root.querySelectorAll(".auth-code-box").forEach(function (b) { if (!firstEmpty && !b.value) firstEmpty = b; });
              if (firstEmpty) firstEmpty.focus();
              return;
            }
            /* Enter in a code box runs the same auto check as typing
               the last digit (approve flashes green, deny shakes). */
            authCheckCode(root);
            return;
          }
          /* Forgot step 2 — new password */
          if (authIsForgotNew()) {
            var ok2 = true; var firstBad2 = null;
            [root.querySelector("#authNewPassword"), root.querySelector("#authConfirmPassword")].forEach(function (inp) {
              if (!inp) return;
              if (!authShowErrFor(root, inp, true)) { ok2 = false; if (!firstBad2) firstBad2 = inp; }
            });
            if (!ok2) {
              if (firstBad2) firstBad2.focus();
              return;
            }
            authState.justReset = true;
            authState.password = "";
            transitionAuthTo(root, "login");
            authState.newPassword = ""; authState.confirmPassword = ""; authState.showNewPw = false; authState.showConfirmPw = false; authState.code = ["", "", "", "", "", ""];
            return;
          }
          var ok = true;
          var firstBad = null;
          [root.querySelector("#authName"), root.querySelector("#authEmail"), root.querySelector("#authPassword")].forEach(function (inp) {
            if (!inp) return;
            if (!authShowErrFor(root, inp, true)) { ok = false; if (!firstBad) firstBad = inp; }
          });
          if (ok) {
            captureAuthInputs(root);
            if (!authIsLogin() && authState.mode === "signup" && authState.name.trim()) state.firstName = authState.name.trim().split(/\s+/)[0];
            authState.justReset = false;
            enterApp();
          } else {
            if (firstBad) firstBad.focus();
          }
        });
        /* No autofocus on load: it painted a focus ring on the first field
           in every screenshot and popped the keyboard on phones. */
        if (firstLoad) {
          /* Retire the entrance classes once the stagger has finished, so
             nothing under them can ever animate as an entrance again. */
          var builtScreen = root.querySelector("#authScreen");
          var builtWrap = root.querySelector(".auth-form-wrap");
          authTimer(function () {
            if (builtScreen) builtScreen.classList.remove("is-enter");
            if (builtWrap) builtWrap.classList.remove("is-enter");
          }, 1100);
        }
      }

      /* ================= Keyboard & init ================= */
      document.addEventListener("keydown", function (e) {
        if (document.getElementById("app").hidden) return;
        var mod = e.metaKey || e.ctrlKey;
        if (mod && e.key === ",") { e.preventDefault(); if (!overlayRoot.children.length) openSettings("general"); else closeTopmostOverlay(); }
        if (mod && (e.key === "k" || e.key === "K")) { e.preventDefault(); openSearch(); }
        if (!mod && !e.altKey && e.key !== "Escape") {
          var t = e.target;
          var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
          var blocked = typing || overlayRoot.children.length || document.getElementById("paletteBd") || openMenuEl || popEl;
          if (!blocked) {
            if (e.key === "n" || e.key === "N") { e.preventDefault(); openEventForm(null, state.selected); }
            else if (e.key === "t" || e.key === "T") { e.preventDefault(); goToday(); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); pageBy(-1, false); }
            else if (e.key === "ArrowRight") { e.preventDefault(); pageBy(1, false); }
          }
        }
        if (e.key === "Escape") {
          if (isDrawerOpen()) { closeDrawer(); e.preventDefault(); return; }
          if (closeTopmostOverlay()) { e.preventDefault(); }
        }
      });
      if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
          if (state.themeMode === "system") {
            applyTheme();
            var tb = document.getElementById("authThemeBtn");
            if (tb) { var dk = effectiveTheme() === "dark"; tb.innerHTML = icon(dk ? "sun" : "moon", 18); tb.title = dk ? "Switch to light theme" : "Switch to dark theme"; }
            if (!document.getElementById("app").hidden) renderAll(false);
          }
        });
      }
      applyTheme();
      /* Authentication is rendered only after Supabase resolves the session,
         eliminating an unnecessary login render and flash during reload. */
      /* Keep "today" honest while the app sits open: re-derive it
         once a minute and whenever the app returns to the
         foreground, re-rendering only if the day actually rolled
         over (or an effective-zone change moved it). */
      setInterval(function () { if (!document.getElementById("app").hidden && refreshToday()) renderAll(false); }, 60000);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden && !document.getElementById("app").hidden && refreshToday()) renderAll(false);
      });
    
