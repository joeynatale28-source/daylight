// CalDAV action handlers. `store` and `dav` are injected: index.ts passes a Supabase store,
// tests pass an in-memory one. EVERY store call is scoped by `userId`, which index.ts takes
// from the verified JWT: a user id in the request body is never read.
//
// Contract (what Stage 1's form sends and expects):
//   test        {server_url, username, password}  -> {ok:true, server:{name, principal_url, calendars:[{url,name,color,read_only}]}}
//                                                    | {ok:false, error:{code,message}}   (stores nothing)
// Additional actions (all authenticated; responses never contain a password):
//   connect     {server_url, username, password}  -> {ok:true, account, calendars}
//   list        {}                                -> {ok:true, accounts:[...], calendars:[...with cached events]}
//   sync        {account_id, force?}              -> {ok:true, calendars} | {ok:false, error}
//   disconnect  {account_id}                      -> {ok:true, removed_calendars:[ids]}
//   update_calendar {calendar_id, color?, name?}  -> {ok:true, calendar}
//   create      {calendar_id, event}              -> {ok:true, calendar}
//   update      {calendar_id, href, uid, scope, occurrence:{start}, fields}
//   delete      {calendar_id, href, uid, scope, occurrence:{start}}
import { CalDavError } from "./lib.mjs";

const fail = (e) => {
  if (e instanceof CalDavError) return { ok: false, error: { code: e.code, message: e.message } };
  return { ok: false, error: { code: "server_error", message: "Something went wrong talking to that server." } };
};
const publicAccount = (a) => ({ id: a.id, server_url: a.server_url, username: a.username, last_synced_at: a.last_synced_at || null, last_error: a.last_error || null });
const publicCalendar = (c) => ({ id: c.id, account_id: c.account_id, href: c.href, name: c.name, color: c.color || null, read_only: !!c.read_only,
  last_synced_at: c.last_synced_at || null, last_error: c.last_error || null, cached_events: c.cached_events || [] });
const PALETTE = ["teal", "blue", "violet", "green", "amber", "rose"];
const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c.toUpperCase() : null);

export function createHandlers({ store, dav, now = () => new Date() }) {
  const events = (resource) => dav.eventsFromResource(resource, { now: now().getTime() });
  const credsOf = (account) => [account.username, account.password];

  async function applyFull(userId, calendar, account) {
    const [user, pass] = credsOf(account);
    const resources = await dav.fetchAll(calendar.href, user, pass);
    const all = []; let skipped = 0;
    for (const r of resources) { const out = events(r); all.push(...out.events); skipped += out.skipped; }
    return { cached_events: all, skipped };
  }
  async function applyIncremental(userId, calendar, account) {
    const [user, pass] = credsOf(account);
    const delta = await dav.syncChanges(calendar.href, calendar.sync_token, user, pass);
    let cached = (calendar.cached_events || []).slice();
    const gone = new Set(delta.removed);
    cached = cached.filter((e) => !gone.has(e.href));
    const wanted = delta.changed.map((c) => c.href);
    if (wanted.length) {
      const fresh = await dav.multiget(calendar.href, wanted, user, pass);
      const replace = new Set(wanted);
      cached = cached.filter((e) => !replace.has(e.href));
      for (const r of fresh) cached.push(...events(r).events);
    }
    return { cached_events: cached, sync_token: delta.token || calendar.sync_token };
  }

  /** Bring one account in line with the server. Last good events stay on failure. */
  async function syncAccount(userId, account, { force = false } = {}) {
    const [user, pass] = credsOf(account);
    try {
      const remote = await dav.listCalendars(account.home_url, user, pass);
      const existing = await store.listCalendars(userId, account.id);
      const byHref = new Map(existing.map((c) => [c.href, c]));
      let colorIndex = existing.length;
      for (const r of remote) {
        let row = byHref.get(r.href);
        if (!row) {
          row = await store.insertCalendar(userId, { account_id: account.id, href: r.href, name: r.name, color: r.color || PALETTE[colorIndex++ % PALETTE.length],
            read_only: !!r.read_only, ctag: null, sync_token: null, cached_events: [] });
          byHref.set(r.href, row);
        }
        const fresh = !force && row.ctag && r.ctag && row.ctag === r.ctag && !row.last_error;
        if (fresh) continue;
        try {
          let result;
          if (!force && row.sync_token && r.sync_token) {
            try { result = await applyIncremental(userId, row, account); }
            catch (e) { if (e instanceof CalDavError && e.code === "token_invalid") result = await applyFull(userId, row, account); else throw e; }
          } else result = await applyFull(userId, row, account);
          await store.updateCalendar(userId, row.id, { cached_events: result.cached_events, ctag: r.ctag, sync_token: result.sync_token ?? r.sync_token,
            read_only: !!r.read_only, last_synced_at: now().toISOString(), last_error: null });
        } catch (e) {
          await store.updateCalendar(userId, row.id, { last_error: fail(e).error.message });
          throw e;
        }
      }
      const present = new Set(remote.map((r) => r.href));
      for (const row of existing) if (!present.has(row.href)) await store.deleteCalendar(userId, row.id);
      await store.updateAccount(userId, account.id, { last_synced_at: now().toISOString(), last_error: null });
    } catch (e) {
      await store.updateAccount(userId, account.id, { last_error: fail(e).error.message });
      throw e;
    }
  }

  const accountCalendars = async (userId, account) => (await store.listCalendars(userId, account.id)).map(publicCalendar);

  async function ownCalendar(userId, id) {
    const calendar = await store.getCalendar(userId, String(id || ""));
    if (!calendar) throw new CalDavError("not_found", "That calendar isn't connected.");
    const account = await store.getAccount(userId, calendar.account_id);
    if (!account) throw new CalDavError("not_found", "That calendar isn't connected.");
    return { calendar, account };
  }

  const handlers = {
    async test(userId, body) {
      const found = await dav.discover(body.server_url, String(body.username || ""), String(body.password || ""));
      let name = "CalDAV server"; try { name = new URL(found.home_url).hostname; } catch { /* keep */ }
      return { ok: true, server: { name, principal_url: found.principal_url, calendars: found.calendars.map((c) => ({ url: c.href, name: c.name, color: c.color, read_only: c.read_only })) } };
    },

    async connect(userId, body) {
      const username = String(body.username || "").trim(), password = String(body.password || "");
      const serverUrl = dav.normalize(body.server_url).href;
      const found = await dav.discover(serverUrl, username, password);
      // Reconnecting the same account updates its credentials: no duplicate account or calendars.
      const account = await store.upsertAccount(userId, { server_url: serverUrl, username, password, principal_url: found.principal_url, home_url: found.home_url });
      await syncAccount(userId, account, { force: true }).catch(() => { /* surfaced through last_error; calendars still created */ });
      const fresh = await store.getAccount(userId, account.id);
      return { ok: true, account: publicAccount(fresh), calendars: await accountCalendars(userId, fresh) };
    },

    async list(userId) {
      const accounts = await store.listAccounts(userId);
      const calendars = [];
      for (const a of accounts) calendars.push(...await accountCalendars(userId, a));
      return { ok: true, accounts: accounts.map(publicAccount), calendars };
    },

    async sync(userId, body) {
      const account = await store.getAccount(userId, String(body.account_id || ""));
      if (!account) throw new CalDavError("not_found", "That account isn't connected.");
      try { await syncAccount(userId, account, { force: !!body.force }); }
      catch (e) {
        const reply = fail(e);
        return { ...reply, kept_cache: true, calendars: await accountCalendars(userId, account) };
      }
      return { ok: true, calendars: await accountCalendars(userId, account), last_synced_at: now().toISOString() };
    },

    async disconnect(userId, body) {
      const account = await store.getAccount(userId, String(body.account_id || ""));
      if (!account) throw new CalDavError("not_found", "That account isn't connected.");
      const calendars = await store.listCalendars(userId, account.id);
      await store.deleteAccount(userId, account.id); // removes its calendars and cached events; the server is never contacted
      return { ok: true, removed_calendars: calendars.map((c) => c.id) };
    },

    async update_calendar(userId, body) {
      const { calendar } = await ownCalendar(userId, body.calendar_id);
      const fields = {};
      if (body.color !== undefined) { const c = String(body.color); if (!(/^#[0-9a-f]{6}$/i.test(c) || /^[a-z]{2,20}$/.test(c))) throw new CalDavError("refused", "Invalid color."); fields.color = c; }
      if (body.name !== undefined) { const n = String(body.name || "").trim().slice(0, 120); if (!n) throw new CalDavError("refused", "Calendar name can't be empty."); fields.name = n; }
      const updated = await store.updateCalendar(userId, calendar.id, fields);
      return { ok: true, calendar: publicCalendar(updated) };
    },

    // ---------- Part B: writes (CalDAV calendars only) ----------
    async create(userId, body) {
      const { calendar, account } = await ownCalendar(userId, body.calendar_id);
      if (calendar.read_only) throw new CalDavError("refused", "This calendar is read-only on the server.");
      const [user, pass] = credsOf(account);
      const ev = body.event || {};
      if (!ev.start || !ev.end) throw new CalDavError("refused", "An event needs a start and end.");
      const uid = (globalThis.crypto.randomUUID()) + "@daylight";
      const href = new URL(encodeURIComponent(uid) + ".ics", calendar.href.endsWith("/") ? calendar.href : calendar.href + "/").href;
      const put = await dav.putResource(href, dav.buildIcs(ev, uid), { ifNoneMatch: true }, user, pass);
      await refreshHrefs(userId, calendar, account, [href], []);
      return { ok: true, calendar: publicCalendar(await store.getCalendar(userId, calendar.id)), href, uid, etag: put.etag };
    },

    async update(userId, body) { return writeOp(userId, body, "update"); },
    async delete(userId, body) { return writeOp(userId, body, "delete"); },
  };

  async function refreshHrefs(userId, calendar, account, changedHrefs, removedHrefs) {
    const [user, pass] = credsOf(account);
    const current = await store.getCalendar(userId, calendar.id);
    let cached = (current.cached_events || []).filter((e) => !changedHrefs.includes(e.href) && !removedHrefs.includes(e.href));
    for (const href of changedHrefs) {
      const r = await dav.getResource(href, user, pass);
      cached.push(...events({ href, etag: r.etag, data: r.data }).events);
    }
    await store.updateCalendar(userId, calendar.id, { cached_events: cached });
  }

  async function writeOp(userId, body, kind) {
    const { calendar, account } = await ownCalendar(userId, body.calendar_id);
    if (calendar.read_only) throw new CalDavError("refused", "This calendar is read-only on the server.");
    const [user, pass] = credsOf(account);
    const href = String(body.href || ""), uid = String(body.uid || "");
    const known = (calendar.cached_events || []).find((e) => e.href === href && e.uid === uid);
    if (!known) throw new CalDavError("not_found", "That event isn't on this calendar any more.");
    const scope = ["all", "only", "following"].includes(body.scope) ? body.scope : "all";
    try {
      const server = await dav.getResource(href, user, pass);
      // The etag we last synced must still be the server's current one; otherwise the event changed under us.
      if (known.etag && server.etag && server.etag !== known.etag) throw new CalDavError("conflict", "etag mismatch");
      const occ = body.occurrence || null;
      if (kind === "update") {
        const plan = dav.planUpdate(server.data, uid, scope, occ, body.fields || {});
        let newHref = null;
        if (plan.extraResource) {
          newHref = new URL(encodeURIComponent(plan.extraResource.uid) + ".ics", calendar.href.endsWith("/") ? calendar.href : calendar.href + "/").href;
          await dav.putResource(newHref, plan.extraResource.ics, { ifNoneMatch: true }, user, pass);
        }
        try { await dav.putResource(href, plan.ics, { ifMatch: server.etag || known.etag }, user, pass); }
        catch (e) { if (newHref) await dav.deleteResource(newHref, {}, user, pass).catch(() => {}); throw e; }
        await refreshHrefs(userId, calendar, account, newHref ? [href, newHref] : [href], []);
      } else {
        const plan = dav.planDelete(server.data, uid, scope, occ);
        if (plan.delete) { await dav.deleteResource(href, { ifMatch: server.etag || known.etag }, user, pass); await refreshHrefs(userId, calendar, account, [], [href]); }
        else { await dav.putResource(href, plan.ics, { ifMatch: server.etag || known.etag }, user, pass); await refreshHrefs(userId, calendar, account, [href], []); }
      }
      return { ok: true, calendar: publicCalendar(await store.getCalendar(userId, calendar.id)) };
    } catch (e) {
      if (e instanceof CalDavError && (e.code === "conflict" || e.code === "not_found")) {
        // Never force. Refresh this calendar from the server and report plainly.
        await syncAccount(userId, account, { force: true }).catch(() => {});
        return { ...fail(e), calendar: publicCalendar(await store.getCalendar(userId, calendar.id)) };
      }
      throw e;
    }
  }

  /** Dispatch with uniform error shaping. `userId` must come from the verified JWT. */
  async function handle(userId, body) {
    const action = String((body && body.action) || "");
    if (!Object.prototype.hasOwnProperty.call(handlers, action)) return { status: 400, body: { ok: false, error: { code: "bad_request", message: "Unknown action" } } };
    try { return { status: 200, body: await handlers[action](userId, body) }; }
    catch (e) { return { status: 200, body: fail(e) }; }
  }
  return { handle, handlers, syncAccount };
}
