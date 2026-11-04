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
  var lastSaved = '', saveTimer = null, saveAgain = false, sessionSequence = 0, conflict = false;
  var lastStatus = '';
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

  function status(message, error) {
    if (lastStatus === message) return;
    lastStatus = message;
    var node = document.getElementById('cloudStatus');
    if (!node) {
      node = document.createElement('div');
      node.id = 'cloudStatus';
      node.setAttribute('role', 'status');
      node.style.cssText = 'position:fixed;bottom:15px;right:16px;z-index:150;pointer-events:none;border:1px solid var(--border,#333);border-radius:20px;padding:6px 11px;background:var(--card,#1e1e1e);color:var(--muted,#999);font:500 11px Inter,system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.08)';
      document.body.appendChild(node);
    }
    node.hidden = !user;
    node.textContent = message;
    node.style.color = error ? 'var(--danger,#e5646e)' : 'var(--muted,#999)';
  }

  function clearPreviewData() {
    state.events = [];
    state.tasks = [];
    state.calendars = seedCalendars();
    state.feeds = [];
    state.profileName = 'Account';
    state.firstName = 'Account';
    state.view = 'month';
    state.section = 'calendar';
    state.cursor = new Date(BOOT_TODAY);
    state.selected = new Date(BOOT_TODAY);
    state.miniCursor = dt(BOOT_TODAY.getFullYear(), BOOT_TODAY.getMonth(), 1);
    state.miniSelected = new Date(BOOT_TODAY);
    state.defaultCalendarId = null;
  }
  clearPreviewData();

  function accountName(account) {
    var metadata = account.user_metadata || {};
    return String(metadata.full_name || metadata.name || (account.email || '').split('@')[0] || 'Account').trim() || 'Account';
  }

  function dateValue(value) {
    var d = new Date(value);
    return !isNaN(d.getTime()) ? d : null;
  }

  function readWorkspace(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (Array.isArray(payload.calendars)) {
      state.calendars = payload.calendars.map(function (c) {
        return {
          id: String(c.id), name: String(c.name || 'Calendar'),
          color: PALETTE[c.color] ? c.color : 'blue', hidden: !!c.hidden,
          subscribed: !!c.subscribed, shared: !!c.shared,
          builtin: !!c.builtin || c.id === 'holidays'
        };
      }).filter(function (c) { return !!c.id; });
    }
    if (!state.calendars.length) state.calendars = seedCalendars();
    if (Array.isArray(payload.events)) {
      state.events = payload.events.map(function (e) {
        var start = dateValue(e.start != null ? e.start : e.startMs);
        var end = dateValue(e.end != null ? e.end : e.endMs);
        if (!start || !end) return null;
        var id = Number(e.id);
        if (!Number.isSafeInteger(id) || id <= 0) id = ++uid;
        uid = Math.max(uid, id);
        return {
          id: id, title: String(e.title || 'Untitled'), cal: String(e.cal || 'personal'),
          start: start, end: end, allDay: !!e.allDay, loc: String(e.loc || ''),
          desc: String(e.desc || ''), repeat: e.repeat || null,
          reminder: e.reminder == null ? null : Number(e.reminder),
          declined: !!e.declined, uid: e.uid, rrule: e.rrule,
          exdates: e.exdates, feedKey: e.feedKey
        };
      }).filter(Boolean);
    }
    if (Array.isArray(payload.tasks)) {
      state.tasks = payload.tasks.map(function (t) {
        var due = dateValue(t.due != null ? t.due : t.dueMs);
        if (!due) return null;
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
    state.feeds = Array.isArray(payload.feeds)
      ? payload.feeds.filter(function (f) { return f && typeof f.url === 'string'; })
      : [];
    var settings = payload.settings || {};
    applySettingsSnapshot(settings);
    if (typeof settings.themeMode === 'string' && ['dark','light','system'].indexOf(settings.themeMode) !== -1) state.themeMode = settings.themeMode;
    if (typeof settings.profileName === 'string' && settings.profileName.trim()) state.profileName = settings.profileName.trim();
    if (typeof settings.firstName === 'string' && settings.firstName.trim()) state.firstName = settings.firstName.trim();
    if (typeof settings.sidebarRail === 'boolean') state.sidebarRail = settings.sidebarRail;
    if (typeof settings.defaultView === 'string' && ['day','week','month','agenda'].indexOf(settings.defaultView) !== -1) state.view = settings.defaultView;
    var ui = payload.ui || {};
    if (typeof ui.view === 'string' && ['day','week','month','agenda'].indexOf(ui.view) !== -1) state.view = ui.view;
    [['cursor','cursorMs'], ['selected','selectedMs'], ['miniCursor','miniCursorMs'], ['miniSelected','miniSelectedMs']].forEach(function (pair) {
      var d = dateValue(ui[pair[1]]);
      if (d) state[pair[0]] = d;
    });
    if (ui.section === 'tasks' || ui.section === 'calendar') state.section = ui.section;
  }

  function workspace() {
    return {
      version: 2,
      calendars: state.calendars.map(function (c) {
        return { id:c.id, name:c.name, color:c.color, hidden:!!c.hidden,
          subscribed:!!c.subscribed, shared:!!c.shared, builtin:!!c.builtin };
      }),
      events: state.events.map(function (e) {
        return { id:e.id, title:e.title, cal:e.cal, start:e.start.toISOString(),
          end:e.end.toISOString(), allDay:!!e.allDay, loc:e.loc || '',
          desc:e.desc || '', repeat:e.repeat || null, reminder:e.reminder == null ? null : e.reminder,
          declined:!!e.declined, uid:e.uid, rrule:e.rrule, exdates:e.exdates, feedKey:e.feedKey };
      }),
      tasks: state.tasks.map(function (t) {
        return { id:t.id, title:t.title, cal:t.cal, due:t.due.toISOString(),
          hasTime:!!t.hasTime, done:!!t.done };
      }),
      feeds: state.feeds.map(function (f) { return {url:f.url,name:f.name}; }),
      settings: Object.assign({}, settingsSnapshot(), {
        themeMode:state.themeMode, firstName:state.firstName,
        profileName:state.profileName, sidebarRail:state.sidebarRail
      }),
      ui: { view:state.view, section:state.section,
        cursorMs:state.cursor.getTime(), selectedMs:state.selected.getTime(),
        miniCursorMs:state.miniCursor.getTime(), miniSelectedMs:state.miniSelected.getTime() }
    };
  }

  function changesQueued() {
    if (!user || loading || recovery || conflict) return;
    try {
      if (JSON.stringify(workspace()) === lastSaved) return;
    } catch (e) { status('Unable to save', true); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWorkspace, 650);
    status('Saving…');
  }

  async function saveWorkspace() {
    clearTimeout(saveTimer);
    if (!user || loading || recovery || conflict) return;
    if (saving) { saveAgain = true; return; }
    var serialized;
    try { serialized = JSON.stringify(workspace()); }
    catch (e) { status('Unable to serialize changes', true); return; }
    if (serialized === lastSaved) { status('Saved'); return; }
    saving = true;
    var saveUser = user.id;
    try {
      var result;
      if (hasRow) {
        result = await client.from('workspace_snapshots')
          .update({payload: JSON.parse(serialized), revision:revision + 1})
          .eq('user_id', saveUser).eq('revision', revision).select('revision');
        if (result.error) throw result.error;
        if (!result.data || result.data.length !== 1) {
          conflict = true;
          status('Sync conflict — reload to review', true);
          toast('Your calendar changed on another device. Reload to review before saving.', {
            label:'Reload', fn:function () { location.reload(); }
          });
          return;
        }
        revision = result.data[0].revision;
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

  async function loadForUser(account) {
    if (!account || recovery) return;
    if (user && user.id === account.id && !loading) return;
    var seq = ++sessionSequence;
    loading = true;
    conflict = false;
    clearTimeout(saveTimer);
    user = account;
    status('Loading calendar…');
    document.getElementById('app').hidden = true;
    try {
      var response = await client.from('workspace_snapshots')
        .select('payload,revision').eq('user_id', account.id).maybeSingle();
      if (response.error) throw response.error;
      if (seq !== sessionSequence) return;
      clearPreviewData();
      state.profileName = accountName(account);
      state.firstName = state.profileName.split(/\s+/)[0];
      hasRow = !!response.data;
      revision = response.data ? Number(response.data.revision) || 0 : 0;
      if (hasRow) readWorkspace(response.data.payload);
      lastSaved = JSON.stringify(workspace());
      loading = false;
      applyTheme();
      document.getElementById('authRoot').innerHTML = '';
      document.getElementById('app').hidden = false;
      originalRenderAll(false);
      status('Saved to cloud');
      authState.password = '';
      authState.newPassword = '';
      authState.confirmPassword = '';
    } catch (error) {
      if (seq !== sessionSequence) return;
      console.error('Daylight load failed', error);
      loading = true;
      document.getElementById('app').hidden = true;
      authState.mode = 'login';
      renderAuth();
      toast('Could not load your calendar: ' + (error.message || 'Try again'));
      status('Unable to load', true);
    }
  }

  function showSignedOut() {
    sessionSequence++;
    user = null; hasRow = false; revision = 0; lastSaved = '';
    loading = true; saving = false; saveAgain = false; conflict = false;
    clearTimeout(saveTimer);
    clearPreviewData();
    document.getElementById('app').hidden = true;
    authState.mode = 'login';
    authState.password = '';
    authState.newPassword = '';
    authState.confirmPassword = '';
    authState.justReset = false;
    var root = document.getElementById('authRoot');
    root.innerHTML = '';
    renderAuth();
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
    if (emailNode) emailNode.textContent = user && user.email || '';
  };
  paneGeneral = function (pane, close) {
    originalPaneGeneral(pane, close);
    var emailInput = pane.querySelector('input[disabled]');
    if (emailInput && emailInput.type !== 'checkbox') emailInput.value = user && user.email || '';
  };

  /* The former sample-data reset must not re-add demonstration events. */
  resetDemoData = function (redraw) {
    state.calendars = seedCalendars();
    state.events = []; state.tasks = []; state.feeds = [];
    state.defaultCalendarId = null;
    state.section = 'calendar';
    renderAll(false);
    if (typeof redraw === 'function') redraw();
    toast('Calendar data cleared');
  };

  /* In-memory app data is never made accessible before the cloud read succeeds. */
  renderAuth();
  if (!client) {
    toast('Supabase could not load. Check your connection and reload.');
    return;
  }
  client.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      recovery = true;
      loading = true; user = null;
      authState.mode = 'forgot-new';
      document.getElementById('app').hidden = true;
      renderAuth();
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
  client.auth.getUser().then(function (result) {
    if (recovery) return;
    if (result.error || !result.data || !result.data.user) {
      if (!user) showSignedOut();
      return;
    }
    loadForUser(result.data.user);
  }).catch(function () {
    if (!user) showSignedOut();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && user && !loading) saveWorkspace();
  });
  window.addEventListener('online', function () { if (user && !loading) changesQueued(); });
})();
