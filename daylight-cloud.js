/* Daylight cloud integration
 * Browser-only, Supabase Auth + per-user, revision-protected workspace persistence.
 * The publishable key is intentionally public; never add a service-role key here.
 * Original Daylight UI remains in daylight-calendar-ui-preview.html.
 */
(function () {
  'use strict';

  var URL = 'https://qrqemjgpzoqhtmsowmqv.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_MuX0ICyo0pYrhrj3wu5G0g_v6_gy8Pj';
  var client = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(URL, PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  var user = null, revision = 0, hasRow = false, saving = false;
  var loading = true, recovery = /(?:^|[&#?])type=recovery(?:[&#&]|$)/.test(location.href);
  var lastSaved = '', saveTimer = null, saveAgain = false, sessionSequence = 0, conflict = false, workspaceRetryTimer = null;
  var lastStatus = '';
  var committedSerialized = null;
  var authBlockedUntil = 0;
  var warmShown = null; // what the cache render showed: {id, payload, name, avatar}
  // Per-user warm snapshot. Cached data is shown only after Supabase
  // authenticates the account, and it never changes the revision baseline.
  function cacheKey(id){return 'daylight-warm-workspace:'+id}
  /* Cached identity (name, email, photo URL) for the sidebar account block. Same
     lifetime rules as the other caches: per account, build-stamped, removed on sign-out. */
  function readIdentity(id){
    try{
      var who=JSON.parse(localStorage.getItem('daylight-identity:'+id)||'null');
      return who&&who.b===(window.__DL_BUILD||'dev')&&typeof who.n==='string'?who:null;
    }catch(e){return null}
  }
  function writeIdentity(){
    if(!user)return;
    try{
      localStorage.setItem('daylight-identity:'+user.id,JSON.stringify({b:window.__DL_BUILD||'dev',n:state.profileName||'',a:state.avatarUrl||'',e:user.email||''}));
    }catch(e){}
  }
  function cacheWorkspace(id,document,rev){
    try{
      const serialized=JSON.stringify({payload:document,revision:rev,build:window.__DL_BUILD||'dev'});
      if(serialized.length<3000000)localStorage.setItem(cacheKey(id),serialized);
    }catch(error){console.warn('Workspace cache unavailable',error)}
  }
  function warmWorkspace(account,seq){
    try{
      const raw=localStorage.getItem(cacheKey(account.id));
      if(!raw)return false;
      const entry=JSON.parse(raw);
      if(!entry||typeof entry.payload!=='object'||!Number.isFinite(Number(entry.revision)))return false;
      /* A cache written by a different build may have a different shape. */
      if(entry.build!==(window.__DL_BUILD||'dev'))return false;
      clearPreviewData();
      state.profileName=accountName(account);
      state.firstName=state.profileName.split(/\s+/)[0];
      readWorkspace(entry.payload);
      /* Name, email and photo come from the cached identity so the account
         block is final in this very render (no initials-then-photo swap). */
      var who=readIdentity(account.id);
      if(who){state.profileName=who.n||state.profileName;state.firstName=state.profileName.split(/\s+/)[0];if(typeof who.a==='string')state.avatarUrl=who.a;window.__dlIdentityEmail=who.e||account.email||'';}
      else if(account.email)window.__dlIdentityEmail=account.email;
      applyTheme();
      document.getElementById('authRoot').innerHTML='';
      document.getElementById('app').hidden=false;
      originalRenderAll(false);
      warmShown={id:account.id,payload:JSON.stringify(entry.payload),name:state.profileName,avatar:state.avatarUrl};
      /* The calendar is on screen from the cache: the page's shell spinner and
         canvas hold (cold loads only) must not stay up over it. */
      window.__dlFromCache=true;
      var shellSpinner=document.getElementById('dlWorkspaceLoading');
      if(shellSpinner)shellSpinner.remove();
      document.body.classList.remove('dl-canvas-holding');
      document.dispatchEvent(new Event('daylight:workspace-preview-ready'));
      return true;
    }catch(error){console.warn('Warm calendar preview unavailable',error);return false}
  }
  window.daylightCloud = {
    get client() { return client; },
    get user() { return user; },
    get ready() { return !!user && !loading && !conflict; },
    save: function () { changesQueued(); },
    /* Edge functions authenticate with the access token supabase-js attaches. If the session is dead (refresh token
       revoked/used, or the session was signed out elsewhere) every call comes back 401/403 from the function's own
       auth check. So: resolve/refresh the session first, and after a 401/403 stop making background calls for a minute
       instead of hammering the functions with a token that cannot work. */
    ensureSession: async function () {
      if (!client) throw new Error('Sign in to daylight first');
      if (Date.now() < authBlockedUntil) throw new Error('Your session expired. Sign in again.');
      var result;
      try { result = await client.auth.getSession(); } catch (e) { result = { error: e }; }
      if (result.error || !result.data || !result.data.session) { authBlockedUntil = Date.now() + 60000; throw new Error('Your session expired. Sign in again.'); }
      return result.data.session;
    },
    /* A person pressing "Try again" is not background hammering: let that one attempt through. */
    resetAuthBlock: function () { authBlockedUntil = 0; },
    noteAuthFailure: function (status) { if (status === 401 || status === 403) authBlockedUntil = Date.now() + 60000; },
    /* Save exactly the state at this moment, even while a Settings/calendar
       transaction stays open for further (preview-only) edits. */
    commit: function () {
      if (!user || loading || recovery || conflict) return;
      try { committedSerialized = JSON.stringify(workspace()); } catch (e) { status('Unable to save', true); return; }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveWorkspace, 0);
      status('Saving…');
    },
    updateProfileMetadata: async function (metadata) {
      var api = window.daylightCloud, activeClient = api.client, activeUser = api.user;
      if (!activeClient || !activeUser) throw new Error('Sign in before updating your profile.');
      var result = await activeClient.auth.updateUser({data:metadata});
      if (result.error) throw result.error;
      if (user && result.data && result.data.user && result.data.user.id === user.id) user = result.data.user;
      return result.data.user;
    }
  };
  function signature(e) { return JSON.stringify([e.title,e.cal,+e.start,+e.end,e.allDay,e.loc,e.desc,e.repeat,e.rrule,e.exdates]); }
  function ensureMeta(e) {
    if (!e.uid) e.uid = crypto.randomUUID() + '@daylight';
    if (!e.dtstamp) e.dtstamp = new Date().toISOString();
    if (!e.timezone) e.timezone = state.useDeviceTz ? deviceTz() : (state.tzLabel || 'America/New_York');
    if (!Number.isInteger(e.sequence)) e.sequence = 0;
    var sig = signature(e);
    if (e._lastSig && sig !== e._lastSig) { e.sequence++; e.dtstamp = new Date().toISOString(); }
    e._lastSig = sig;
  }
  var originalBuildAuth = buildAuthFormInner;
  var originalRenderAll = renderAll;
  var originalRenderSidebar = renderSidebar;
  var originalPaneGeneral = paneGeneral;

  /* Owner-created accounts only. There is no public sign-up or fixed reset code. */
  buildAuthFormInner = function () {
    if (authState.mode === 'signup' || authState.mode === 'forgot-code') authState.mode = 'login';
    return originalBuildAuth().replace(/<p class="auth-altline">[\s\S]*?<\/p>/, '');
  };
  authCheckCode = function () { /* Reset codes are verified by Supabase, not this UI. */ };
  var switchMode = switchAuthMode;
  switchAuthMode = function () { authState.mode = 'login'; renderAuth(); };
  var authSwitch = document.getElementById('authSwitch');
  if (authSwitch) authSwitch.remove();

  // Cloud saves stay silent. Keep error handling in the persistence path,
  // but never insert a persistent corner status pill.
  function status(message, error) {
    lastStatus = message;
    document.getElementById('cloudStatus')?.remove();
  }

  function clearPreviewData() {
    state.events = [];
    state.tasks = [];
    state.calendars = seedCalendars();
    state.feeds = [];
    state.profileName = 'Account';
    state.firstName = 'Account';
    state.avatarUrl = '';
    state.birthday = '';
    state.customColors = [];
    state.view = 'month';
    state.section = 'calendar';
    state.cursor = new Date(BOOT_TODAY);
    state.selected = new Date(BOOT_TODAY);
    state.miniCursor = dt(BOOT_TODAY.getFullYear(), BOOT_TODAY.getMonth(), 1);
    state.miniSelected = new Date(BOOT_TODAY);
    state.defaultCalendarId = null;
    state.themeMode = 'system';
    state.reduceMotion = false;
    state.remind15 = true;
    state.dailySummary = false;
    state.sidebarRail = false;
    applySettingsSnapshot(SETTINGS_DEFAULTS);
  }
  clearPreviewData();

  /* An address counts as this account's photo only if it sits inside the account's own storage folder. */
  function ownsAvatar(url) {
    return typeof url === 'string' && !!url && !!user && url.indexOf('/' + user.id + '/') !== -1;
  }
  /* Does a stored name plausibly belong to this email address? ("Alex Rivera" fits alexrivera@...; it does not fit user@...) */
  function nameFitsEmail(name, email) {
    var norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var n = norm(name), local = norm(String(email || '').split('@')[0]);
    if (n.length < 3 || local.length < 3) return false;
    return local.indexOf(n) !== -1 || n.indexOf(local) !== -1;
  }
  function accountName(account) {
    var metadata = account.user_metadata || {};
    return String(metadata.full_name || metadata.name || (account.email || '').split('@')[0] || 'Account').trim() || 'Account';
  }

  function dateValue(value) {
    var d = new Date(value);
    return !isNaN(d.getTime()) ? d : null;
  }
  /* Convert legacy RFC all-day UTC-midnight values to local calendar days. */
  function workspaceEventDate(value, allDay, isEnd) {
    var d = dateValue(value);
    if (!d || !allDay) return d;
    if (d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds() || d.getUTCMilliseconds()) return d;
    var local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (isEnd) local.setMinutes(local.getMinutes() - 1);
    return local;
  }

  function normalizeCalendarList(raw, holidayIds) {
    /* New/legacy accounts without a saved calendar list need all defaults,
       not just the built-in holiday calendar. */
    if (!Array.isArray(raw) || !raw.length) return seedCalendars();
    var output = [], seen = Object.create(null);
    (Array.isArray(raw) ? raw : []).forEach(function (item) {
      if (!item || typeof item !== 'object' || item.id == null) return;
      var id = String(item.id), name = String(item.name || 'Calendar');
      var isHoliday = id === 'holidays' ||
        ((item.builtin || item.subscribed) && name.trim().toLowerCase() === 'us holidays');
      if (isHoliday) {
        holidayIds[id] = true;
        id = 'holidays';
        name = 'US Holidays';
      }
      if (seen[id]) return;
      seen[id] = true;
      output.push({
        id: id, name: name, color: (PALETTE[item.color] || (typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color))) ? item.color : 'blue',
        hidden: !!item.hidden, subscribed: isHoliday || !!item.subscribed,
        shared: !isHoliday && !!item.shared, builtin: !!isHoliday,
        publicLink: !isHoliday && typeof item.publicLink === 'string' && /^https:\/\//.test(item.publicLink) ? item.publicLink : ''
      });
    });
    if (!seen.holidays) {
      var builtIn = seedCalendars().filter(function (c) { return c.id === 'holidays'; })[0];
      if (builtIn) output.push(builtIn);
    }
    return output.length ? output : seedCalendars();
  }

  function readWorkspace(payload) {
    if (!payload || typeof payload !== 'object') return;
    var holidayIds = Object.create(null);
    holidayIds.holidays = true;
    state.calendars = normalizeCalendarList(payload.calendars, holidayIds);
    if (Array.isArray(payload.events)) {
      state.events = payload.events.map(function (e) {
        var allDay = !!e.allDay;
        var start = workspaceEventDate(e.start != null ? e.start : e.startMs, allDay, false);
        var end = workspaceEventDate(e.end != null ? e.end : e.endMs, allDay, true);
        if (!start || !end) return null;
        var id = Number(e.id);
        if (!Number.isSafeInteger(id) || id <= 0) id = ++uid;
        uid = Math.max(uid, id);
        return {
          id: id, title: String(e.title || 'Untitled'), cal: String(e.cal || 'personal'),
          start: start, end: end, allDay: allDay, loc: String(e.loc || ''),
          desc: String(e.desc || ''), repeat: e.repeat || null, repeatEnd:e.repeatEnd||null, accent:e.accent||null, weekdaysOnly:!!e.weekdaysOnly, birthday:!!e.birthday,
          reminder: e.reminder == null ? null : Number(e.reminder),
          declined: !!e.declined, uid: e.uid, rrule: e.rrule,
          exdates: e.exdates, feedKey: e.feedKey,
          timezone: e.timezone, dtstamp:e.dtstamp, sequence:e.sequence,
          recurrenceId:e.recurrenceId, status:e.status,
          placeId:e.placeId||null,locationLat:e.locationLat??null,locationLng:e.locationLng??null
        };
      }).filter(function (ev) {
        /* Old snapshots duplicated built-in holidays as stored event rows.
           Holiday dates now come only from usHolidaysForYear in the app. */
        return ev && !holidayIds[ev.cal];
      });
    }
    if (Array.isArray(payload.tasks)) {
      state.tasks = payload.tasks.map(function (t) {
        /* A task may legitimately have no due date (null) — only a
           present-but-unparseable date drops the task. */
        var rawDue = t.due != null ? t.due : t.dueMs;
        var due = rawDue == null ? null : dateValue(rawDue);
        if (rawDue != null && !due) return null;
        var id = Number(t.id);
        if (!Number.isSafeInteger(id) || id <= 0) id = ++uid;
        uid = Math.max(uid, id);
        return {
          id: id, title: String(t.title || 'Untitled task'),
          cal: String(t.cal || 'personal'), due: due,
          hasTime: !!t.hasTime, done: !!(t.done || t.completed)
        };
      }).filter(Boolean);
    }
    state.events.forEach(ensureMeta);
    state.feeds = Array.isArray(payload.feeds)
      ? payload.feeds.filter(function (f) { return f && typeof f.url === 'string'; })
      : [];
    var settings = payload.settings || {};
    applySettingsSnapshot(settings);
    if (typeof settings.themeMode === 'string' && ['dark','light','system'].indexOf(settings.themeMode) !== -1) state.themeMode = settings.themeMode;
    /* Identity (name, photo) belongs to the SIGNED-IN account's own record, never to whatever a stored workspace
       happens to carry. The account's record (auth metadata, then its email) is the base; a name saved in the workspace
       is honored only when it is stamped as this account's own, or (older workspaces without a stamp) only when it
       plausibly belongs to this account's email and the account's record has no name. A photo is honored only when its
       address is inside this account's own folder. Anything else is ignored. */
    var metadata = (user && user.user_metadata) || {};
    var savedFullName = typeof settings.profileName === 'string' ? settings.profileName.trim() : '';
    if (savedFullName && user) {
      var stamped = settings.identityOwner === user.id;
      var metaHasName = !!String(metadata.full_name || metadata.name || '').trim();
      if (!(stamped || (!settings.identityOwner && !metaHasName && nameFitsEmail(savedFullName, user.email)))) savedFullName = '';
    } else savedFullName = '';
    if (savedFullName) state.profileName = savedFullName;
    /* Keep the first-name and full-name fields in sync (never show a stale
       hard-coded profile name or the email username when a name exists). */
    state.firstName = state.profileName.split(/\s+/)[0] || 'Account';
    if (typeof settings.sidebarRail === 'boolean') state.sidebarRail = settings.sidebarRail;
    if (typeof settings.reduceMotion === 'boolean') state.reduceMotion = settings.reduceMotion;
    if (typeof settings.remind15 === 'boolean') state.remind15 = settings.remind15;
    if (typeof settings.dailySummary === 'boolean') state.dailySummary = settings.dailySummary;
    state.avatarUrl = [metadata.avatar_url, settings.avatarUrl].filter(function (u) { return ownsAvatar(u); })[0] || '';
    state.birthday = typeof settings.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(settings.birthday) ? settings.birthday : '';
    state.customColors = Array.isArray(settings.customColors)
      ? settings.customColors.filter(function (color) { return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color); }).slice(0,30)
      : [];
    document.body.classList.toggle('reduce-motion', !!state.reduceMotion);
    state.defaultView = 'month';
    if (typeof settings.defaultView === 'string' && ['day','week','month','agenda'].indexOf(settings.defaultView) !== -1) { state.view = settings.defaultView; state.defaultView = settings.defaultView; }
    /* Navigation state is NOT restored (Part 1 + 11.11): a fresh
       load always lands on today in the default view, with today as
       the selection. A persisted selected date survived reloads and
       masqueraded as a second "today", and new events defaulted to
       that stale date. payload.ui is ignored entirely now. */
  }

  function workspace() {
    return {
      version: 2,
      calendars: state.calendars.filter(function (c) { return !c.remoteSubscriptionId; }).map(function (c) {
        var out = { id:c.id, name:c.name, color:c.color, hidden:!!c.hidden,
          subscribed:!!c.subscribed, shared:!!c.shared, builtin:!!c.builtin };
        if (c.publicLink) out.publicLink = String(c.publicLink);
        return out;
      }),
      events: state.events.filter(function (e) { return !e.feedSubscriptionId; }).map(function (e) {
        ensureMeta(e);
        return { id:e.id, title:e.title, cal:e.cal, start:e.start.toISOString(),
          end:e.end.toISOString(), allDay:!!e.allDay, loc:e.loc || '',
          desc:e.desc || '', repeat:e.repeat || null, repeatEnd:e.repeatEnd || null, accent:e.accent || null, weekdaysOnly:!!e.weekdaysOnly, birthday:!!e.birthday, reminder:e.reminder == null ? null : e.reminder,
          declined:!!e.declined, uid:e.uid, rrule:e.rrule, exdates:e.exdates, feedKey:e.feedKey,
          timezone:e.timezone,dtstamp:e.dtstamp,sequence:e.sequence,
          recurrenceId:e.recurrenceId,status:e.status,
          placeId:e.placeId||null,locationLat:e.locationLat??null,locationLng:e.locationLng??null };
      }),
      tasks: state.tasks.map(function (t) {
        return { id:t.id, title:t.title, cal:t.cal, due:t.due ? t.due.toISOString() : null,
          hasTime:!!t.hasTime, done:!!t.done };
      }),
      feeds: state.feeds.map(function (f) { return {url:f.url,name:f.name}; }),
      settings: Object.assign({}, settingsSnapshot(), {
        themeMode:state.themeMode, firstName:state.firstName,
        profileName:state.profileName, sidebarRail:state.sidebarRail,
        reduceMotion:state.reduceMotion, remind15:state.remind15,
        dailySummary:state.dailySummary, avatarUrl:state.avatarUrl || '', birthday:state.birthday || '', identityOwner:user ? user.id : null,
        customColors:Array.isArray(state.customColors)?state.customColors.slice(0,30):[]
      }),
      /* No navigation state is persisted (see the restore note):
         cursor/selected/view/section always start fresh on load. */
      ui: {}
    };
  }

  function changesQueued() {
    if (!user || loading || recovery || conflict) return;
    if (window.settingsState && window.settingsState.transactionActive) return;
    try {
      if (JSON.stringify(workspace()) === lastSaved) return;
    } catch (e) { status('Unable to save', true); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWorkspace, 320);
    status('Saving…');
  }

  async function saveWorkspace() {
    clearTimeout(saveTimer);
    if (!user || loading || recovery || conflict) return;
    if (saving) { saveAgain = true; return; }
    var serialized;
    var inTransaction = !!(window.settingsState && window.settingsState.transactionActive);
    if (inTransaction && !committedSerialized) return; // previews are never saved
    try { serialized = inTransaction ? committedSerialized : JSON.stringify(workspace()); }
    catch (e) { status('Unable to serialize changes', true); return; }
    if (serialized === lastSaved) { status('Saved'); return; }
    saving = true;
    var saveUser = user.id;
    try {
      var result;
      if (hasRow) {
        result = await client.from('workspace_snapshots')
          .update({payload: JSON.parse(serialized), revision:revision + 1})
          .eq('user_id', saveUser).eq('revision', revision).select('revision').maybeSingle();
        if (result.error) throw result.error;
        if (!result.data || !Number.isFinite(Number(result.data.revision))) {
          var latest = await client.from('workspace_snapshots')
            .select('payload,revision').eq('user_id', saveUser).maybeSingle();
          if (latest.error) throw latest.error;
          if (latest.data && JSON.stringify(latest.data.payload) === serialized) {
            revision = Number(latest.data.revision) || revision;
          } else {
            conflict = true;
            status('Sync conflict — reload to review', true);
            toast('Your calendar changed on another device. Reload to review before saving.', {
              label:'Reload', fn:function () { location.reload(); }
            });
            return;
          }
        } else revision = Number(result.data.revision);
      } else {
        result = await client.from('workspace_snapshots')
          .insert({user_id:saveUser, payload:JSON.parse(serialized), revision:1})
          .select('revision').single();
        if (result.error) throw result.error;
        revision = result.data.revision;
        hasRow = true;
      }
      if (!user || user.id !== saveUser) return;
      lastSaved = serialized;
      if (committedSerialized === serialized) committedSerialized = null;
      cacheWorkspace(saveUser,JSON.parse(serialized),revision);
      status('Saved to cloud');
    } catch (error) {
      console.error('Daylight save failed', error);
      status('Save failed — retrying', true);
      toast('Could not save Daylight data: ' + (error.message || 'Connection failed'));
      saveAgain = true;
    } finally {
      saving = false;
      if (saveAgain && !conflict && user && user.id === saveUser && !loading) {
        saveAgain = false;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveWorkspace, 2500);
      } else if (user && user.id === saveUser && !loading) {
        changesQueued();
      }
    }
  }

  async function loadForUser(account, retry) {
    if (!account || recovery) return;
    if (user && user.id === account.id && !retry) return;
    if (user && user.id !== account.id) { forgetCaches(user.id); clearPreviewData(); teardownSessionUi(); }
    var seq = ++sessionSequence;
    loading = true;
    conflict = false;
    clearTimeout(saveTimer);
    user = account;
    status('Loading calendar…');
    const authRoot=document.getElementById('authRoot');
    if(authRoot)authRoot.innerHTML='';
    const appRoot=document.getElementById('app');
    if(appRoot)appRoot.hidden=false;
    /* Cache first: with a snapshot the calendar is already on screen (page
       shell + early cache render) and there is no artificial hold. Only a
       true cold load shows the spinner. */
    var fromCache = (warmShown && warmShown.id === account.id) || warmWorkspace(account,seq);
    if (!fromCache) {
      document.dispatchEvent(new Event('daylight:workspace-loading'));
      originalRenderAll(false);
    }
    try {
      var response = await client.from('workspace_snapshots')
        .select('payload,revision').eq('user_id', account.id).maybeSingle();
      if (response.error) throw response.error;
      if (seq !== sessionSequence) return;
      clearTimeout(workspaceRetryTimer);
      clearPreviewData();
      state.profileName = accountName(account);
      state.firstName = state.profileName.split(/\s+/)[0];
      hasRow = !!response.data;
      revision = response.data ? Number(response.data.revision) || 0 : 0;
      if (hasRow) readWorkspace(response.data.payload);
      lastSaved = JSON.stringify(workspace());
      if(hasRow)cacheWorkspace(account.id,response.data.payload,revision);
      loading = false;
      applyTheme();
      document.getElementById('authRoot').innerHTML = '';
      document.getElementById('app').hidden = false;
      /* Refresh behind the cache: identical data repaints nothing; changed data
         re-renders inside the same layout. */
      var unchanged = fromCache && warmShown && warmShown.id === account.id && hasRow &&
        warmShown.payload === JSON.stringify(response.data.payload) &&
        warmShown.name === state.profileName && warmShown.avatar === state.avatarUrl;
      if (account.email) window.__dlIdentityEmail = account.email;
      if (!unchanged) originalRenderAll(false);
      warmShown = null;
      writeIdentity();
      document.dispatchEvent(new Event('daylight:workspace-ready'));
      document.body.classList.remove('booting');
      status('Saved to cloud');
      authState.password = '';
      authState.newPassword = '';
      authState.confirmPassword = '';
    } catch (error) {
      if (seq !== sessionSequence) return;
      console.error('Daylight load failed', error);
      loading = true;
      status('Unable to load — retrying…', true);
      clearTimeout(workspaceRetryTimer);
      workspaceRetryTimer = setTimeout(function () { loadForUser(account, true); }, 2000);
    }
  }

  function forgetCaches(id) {
    try {
      if (id) { localStorage.removeItem(cacheKey(id)); localStorage.removeItem('daylight-first-paint:' + id); localStorage.removeItem('daylight-identity:' + id); localStorage.removeItem('daylight-subscription-cache:' + id); }
      /* Any other per-account cache an earlier build left behind (keys are 'daylight-<name>:<account id>'). */
      if (id) { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('daylight-') === 0 && k.slice(-(id.length + 1)) === ':' + id) localStorage.removeItem(k); }); }
    } catch (e) {}
  }
  /* Everything on the page that can name an account or belong to its session: open dialogs (Settings included),
     menus, popovers, the drawer, the sidebar/header/view markup and the identity globals. Run on every sign-out and
     whenever a different account takes over, so nothing of the previous account can show, even for one frame. */
  function teardownSessionUi() {
    ['closeMenu', 'closePopover', 'closeDrawer', 'closeNotifPanel', 'closeSearch'].forEach(function (name) {
      try { if (typeof window[name] === 'function') window[name](); else if (typeof eval('typeof ' + name) === 'string' && eval('typeof ' + name) === 'function') eval(name + '()'); } catch (e) {}
    });
    var overlays = document.getElementById('overlayRoot');
    if (overlays) overlays.innerHTML = '';
    document.querySelectorAll('.menu, .popover, .dl-notif-panel, .palette-backdrop, #dlSettingsDiscardConfirm').forEach(function (n) { n.remove(); });
    try { if (window.settingsState) { settingsState.transactionActive = false; settingsState.markDirty = null; settingsState.redrawPane = null; } } catch (e) {}
    ['sidebar', 'headerBand', 'viewWrap'].forEach(function (id) { var n = document.getElementById(id); if (n) n.innerHTML = ''; });
    window.__dlIdentityEmail = '';
    window.__dlFromCache = false;
    try { authState.email = ''; authState.password = ''; authState.newPassword = ''; authState.confirmPassword = ''; } catch (e) {}
    try { state.section = 'calendar'; } catch (e) {}
  }
  function showSignedOut() {
    if (user) forgetCaches(user.id);
    else if (warmShown) forgetCaches(warmShown.id);
    warmShown = null;
    sessionSequence++;
    clearTimeout(workspaceRetryTimer);
    user = null; hasRow = false; revision = 0; lastSaved = '';
    loading = true; saving = false; saveAgain = false; conflict = false;
    clearTimeout(saveTimer);
    clearPreviewData();
    teardownSessionUi();
    document.dispatchEvent(new Event('daylight:workspace-signed-out'));
    document.getElementById('app').hidden = true;
    authState.mode = 'login';
    authState.password = '';
    authState.newPassword = '';
    authState.confirmPassword = '';
    authState.justReset = false;
    var root = document.getElementById('authRoot');
    root.innerHTML = '';
    renderAuth();
    document.body.classList.remove('booting');
    document.getElementById('cloudStatus')?.setAttribute('hidden', '');
  }

  enterApp = async function () {
    if (!client) { toast('Authentication is unavailable. Check your network and reload.'); return; }
    var root = document.getElementById('authRoot');
    var button = root.querySelector('.auth-primary');
    var email = (authState.email || '').trim();
    var password = authState.password || '';
    if (!validEmail(email) || !password) return;
    if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
    try {
      var result = await client.auth.signInWithPassword({email:email,password:password});
      if (result.error) throw result.error;
      if (!result.data || !result.data.user) throw new Error('No authenticated user was returned');
      await loadForUser(result.data.user);
    } catch (error) {
      console.error('Daylight sign-in failed', error);
      var pw = root.querySelector('#authPassword');
      if (pw) authSetErr(root, pw, true, error.message || 'Sign-in failed');
      toast(error.message || 'Unable to sign in');
    } finally {
      if (button && document.contains(button)) { button.disabled = false; button.textContent = 'Log in'; }
    }
  };

  logOut = async function () {
    if (!client) { showSignedOut(); return; }
    try {
      if (user && !loading) await saveWorkspace();
      var result = await client.auth.signOut();
      if (result.error) throw result.error;
      showSignedOut();
    } catch (error) {
      toast('Could not sign out: ' + (error.message || 'Try again'));
    }
  };

  async function sendResetEmail() {
    if (!client) { toast('Authentication is unavailable'); return; }
    var root = document.getElementById('authRoot');
    captureAuthInputs(root);
    var email = (authState.email || '').trim();
    if (!validEmail(email)) {
      var emailInput = root.querySelector('#authEmail');
      if (emailInput) { authSetErr(root, emailInput, true, 'Enter your email first'); emailInput.focus(); }
      return;
    }
    var result = await client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });
    if (result.error) toast('Reset email failed: ' + result.error.message);
    else toast('If the account exists, check its inbox for the password-reset link.');
  }

  async function updatePassword() {
    if (!client || !recovery) return;
    var root = document.getElementById('authRoot');
    var inputs = [root.querySelector('#authNewPassword'),root.querySelector('#authConfirmPassword')];
    if (!inputs.every(function (input) { return input && authShowErrFor(root,input,true); })) return;
    var submit = root.querySelector('.auth-primary');
    if (submit) { submit.disabled = true; submit.textContent = 'Updating…'; }
    var result = await client.auth.updateUser({password:inputs[0].value});
    if (result.error) {
      toast('Password reset failed: ' + result.error.message);
      if (submit) { submit.disabled = false; submit.textContent = 'Reset password'; }
      return;
    }
    recovery = false;
    history.replaceState(null,'',location.pathname);
    await client.auth.signOut();
    showSignedOut();
    authState.justReset = true;
    renderAuth();
    toast('Password updated. You can now sign in.');
  }

  document.addEventListener('click', function (event) {
    var forgot = event.target.closest && event.target.closest('#authForgot');
    if (forgot) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sendResetEmail();
      return;
    }
    if (!user || loading) return;
    setTimeout(changesQueued, 0);
  }, true);
  document.addEventListener('submit', function (event) {
    if (event.target && event.target.id === 'authForm' && authState.mode === 'forgot-new') {
      event.preventDefault();
      event.stopImmediatePropagation();
      updatePassword();
    }
  }, true);
  document.addEventListener('change', function () { setTimeout(changesQueued,0); }, true);
  document.addEventListener('input', function () {
    if (!user || loading) return;
    setTimeout(changesQueued,0);
  }, true);
  document.addEventListener('keydown', function (event) {
    if (!user || loading) return;
    if (event.key === 'Enter' || event.key === 'Escape') setTimeout(changesQueued,25);
  }, true);

  renderAll = function () {
    originalRenderAll.apply(this, arguments);
    changesQueued();
  };
  renderSidebar = function () {
    originalRenderSidebar.apply(this, arguments);
    var emailNode = document.querySelector('.profile-email');
    /* Until the session resolves, keep the cached email (never blank it). */
    if (emailNode) emailNode.textContent = (user && user.email) || window.__dlIdentityEmail || '';
  };
  paneGeneral = function (pane, close) {
    originalPaneGeneral(pane, close);
    var emailInput = pane.querySelector('input[disabled]');
    if (emailInput && emailInput.type !== 'checkbox') emailInput.value = user && user.email || '';

    /* The preview edited "first name" on every keystroke and reconstructed
       the full name repeatedly, causing a visibly unstable profile. Replace
       only that field's old event listener with a commit-on-blur editor. */
    var oldInput = pane.querySelector('#gsName');
    if (!oldInput) return;
    var nameLabel = pane.querySelector('label[for="gsName"]');
    if (nameLabel) nameLabel.textContent = 'Full name';
    var nameField = oldInput.closest('.field');
    var hint = nameField && nameField.querySelector('.inline-note');
    if (hint) hint.textContent = 'Your name on this account. Changes save when you finish editing.';
    var nameInput = oldInput.cloneNode(true);
    oldInput.replaceWith(nameInput); /* Removes the old per-keystroke handler. */
    nameInput.value = state.profileName || '';
    nameInput.autocomplete = 'name';
    nameInput.placeholder = 'Your name';
    var commitName = function () {
      var newName = nameInput.value.replace(/\s+/g, ' ').trim();
      if (!newName) {
        nameInput.value = state.profileName;
        return;
      }
      nameInput.value = newName;
      if (newName === state.profileName) return;
      state.profileName = newName;
      state.firstName = newName.split(' ')[0];
      renderSidebar(); /* Sidebar only: never replace the focused editor. */
      changesQueued();
      if (settingsState && settingsState.markDirty) settingsState.markDirty();
    };
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('blur', commitName);
    nameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); nameInput.blur(); }
      if (event.key === 'Escape') { nameInput.value = state.profileName; nameInput.blur(); }
    });
  };

  /* Profile metadata is saved only after Settings confirms the transaction. */
  document.addEventListener('daylight:settings-committed', function (e) {
    var nextName = e.detail && e.detail.name;
    var previousName = e.detail && e.detail.previousName;
    var nextAvatar = e.detail && e.detail.avatarUrl;
    var previousAvatar = e.detail && e.detail.previousAvatarUrl;
    var updates = {};
    if (nextName && nextName !== previousName) updates.full_name = nextName;
    if (nextAvatar !== undefined && nextAvatar !== previousAvatar) updates.avatar_url = nextAvatar || null;
    if (!client || !user || !Object.keys(updates).length) return;
    client.auth.updateUser({data:updates}).then(function (result) {
      if (result.error) console.warn('Name metadata update failed:', result.error.message);
      else if (result.data && result.data.user && user && result.data.user.id === user.id)
        user = result.data.user;
    }).catch(function (error) { console.warn('Name metadata update failed:', error); });
  });

  /* Cloud accounts must never lose data through a legacy demo reset action. */
  resetDemoData = function () {
    toast('Demo reset is unavailable for cloud accounts. Your data is safe.');
  };

  /* ---- First-paint snapshot (see the shell in index.html) -------------
     After a normal load, once the calendar is in its home state (calendar
     section, default view, this month, nothing open), the rendered sidebar,
     header and view are stored for this account. The next load paints them
     straight from the HTML, before any script runs. Keyed by account; used
     only for the same build, the same day, the same theme and a similar
     window size; removed on sign-out. */
  function homeState() {
    try {
      var today = new Date();
      return state.section === 'calendar' && state.view === (state.defaultView || 'month') &&
        state.cursor && state.cursor.getFullYear() === today.getFullYear() && state.cursor.getMonth() === today.getMonth() &&
        !document.querySelector('#overlayRoot > *') && !document.querySelector('.popover,.menu,.dl-notif-panel') &&
        !document.body.classList.contains('dl-canvas-holding') && !document.getElementById('dlWorkspaceLoading') &&
        !(window.settingsState && window.settingsState.transactionActive);
    } catch (e) { return false; }
  }
  function saveFirstPaint() {
    if (user && !loading) writeIdentity();
    if (!user || loading || conflict || !homeState()) return;
    try {
      var d = new Date();
      var snap = {
        b: window.__DL_BUILD || 'dev', d: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(),
        t: document.documentElement.getAttribute('data-theme'), w: innerWidth, h: innerHeight,
        s: document.getElementById('sidebar').innerHTML, hd: document.getElementById('headerBand').innerHTML.replace(/<span class="dl-notif-badge"[^>]*>[^<]*<\/span>/g, ''),
        v: document.getElementById('viewWrap').innerHTML,
        rail: document.getElementById('sidebar').classList.contains('rail'),
        rh: document.documentElement.style.getPropertyValue('--dl-cal-row-height'),
        bc: document.body.className.split(/\s+/).filter(function (c) { return c && c !== 'booting' && c !== 'dl-canvas-holding'; }).join(' ')
      };
      var text = JSON.stringify(snap);
      if (text.length < 1500000) localStorage.setItem('daylight-first-paint:' + user.id, text);
    } catch (e) { /* storage full or unavailable: the next load simply has no snapshot */ }
  }
  var snapshotTimer = null;
  function scheduleSnapshot(delay) { clearTimeout(snapshotTimer); snapshotTimer = setTimeout(saveFirstPaint, delay || 1800); }
  document.addEventListener('daylight:workspace-ready', function () { scheduleSnapshot(2200); });
  document.addEventListener('daylight:canvas-revealed', function () { scheduleSnapshot(500); });
  window.addEventListener('pagehide', saveFirstPaint);
  document.addEventListener('daylight:settings-committed', function () { writeIdentity(); scheduleSnapshot(1200); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveFirstPaint(); });
  window.addEventListener('resize', function () { scheduleSnapshot(2500); });

  /* Early cache render: do not wait for the Supabase round trip. The saved
     session in storage names the account; if a cache for that account exists
     (and this build wrote it) the calendar is rendered from it now. */
  (function earlyCacheRender() {
    if (recovery) return;
    try {
      var stored = JSON.parse(localStorage.getItem('sb-qrqemjgpzoqhtmsowmqv-auth-token') || 'null');
      var hinted = stored && stored.user && stored.user.id ? stored.user : null;
      if (hinted) warmWorkspace(hinted, 0);
    } catch (e) { console.warn('Early cache render skipped', e); }
  })();

  /* Resolve the session before constructing any login UI.
     Returning users never build the login screen at all. */
  if (!client) {
    showSignedOut();
    toast('Supabase could not load. Check your connection and reload.');
    return;
  }
  /* One row per device: every browser keeps a stable random device id and tells the server which sign-in belongs to
     it, so signing in again from the same browser refreshes that device's row instead of adding another. Best effort:
     if the server function is not installed yet, or the call fails, nothing else is affected. */
  var deviceRegistered = false;
  function deviceId() {
    try {
      var id = localStorage.getItem('daylight-device-id');
      if (id && /^[A-Za-z0-9-]{16,64}$/.test(id)) return id;
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      localStorage.setItem('daylight-device-id', id);
      return id;
    } catch (e) { return null; }
  }
  function registerDevice() {
    if (deviceRegistered || !client || typeof client.rpc !== 'function') return;
    var id = deviceId();
    if (!id) return;
    deviceRegistered = true;
    var label = '';
    try { label = (window.daylightSessionDevice ? window.daylightSessionDevice(navigator.userAgent).label : ''); } catch (e) {}
    try {
      Promise.resolve(client.rpc('daylight_register_device', { p_device_id: id, p_label: label })).then(function () {}, function () {});
    } catch (e) {}
  }
  client.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT') deviceRegistered = false;
    if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !recovery) setTimeout(registerDevice, 0);
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') { if (session) authBlockedUntil = 0; }
    if (event === 'PASSWORD_RECOVERY') {
      recovery = true;
      loading = true; user = null;
      authState.mode = 'forgot-new';
      document.getElementById('app').hidden = true;
      renderAuth();
      document.body.classList.remove('booting');
      return;
    }
    if (event === 'SIGNED_OUT') {
      showSignedOut();
      return;
    }
    if (session && session.user && !recovery) {
      setTimeout(function () { loadForUser(session.user); },0);
    }
  });
  /* Session rehydration is the only startup decision. Do not paint Login
     while a saved token is being restored or its workspace is loading. */
  client.auth.getSession().then(function (result) {
    if (recovery) return;
    var account = result.data && result.data.session && result.data.session.user;
    if (result.error || !account) {
      if (!user) showSignedOut();
      return;
    }
    loadForUser(account);
  }).catch(function () {
    if (!user && !recovery) showSignedOut();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && user && !loading) saveWorkspace();
  });
  window.addEventListener('online', function () { if (user && !loading) changesQueued(); });
})();
