// CalDAV protocol library for daylight. Pure ES module: no Deno/Node APIs beyond
// fetch/AbortSignal/URL/btoa, with ICAL (ical.js) injected, so the same code runs in
// the Supabase edge function and in Node against a local test server.
//
// Errors thrown here are CalDavError with a stable `code`:
//   invalid_url | unreachable | auth_failed | no_caldav | conflict | not_found |
//   token_invalid | refused | server_error

export class CalDavError extends Error {
  constructor(code, message, extra) { super(message || code); this.code = code; Object.assign(this, extra || {}); }
}

// ---------- tiny namespace-agnostic XML reader (CalDAV multistatus only) ----------
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e.toLowerCase()];
  });
}
export function parseXml(xml) {
  const root = { name: "#root", children: [], text: "" };
  const stack = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w.\-]*:)?([A-Za-z_][\w.\-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) { top.text += m[1]; continue; }
    if (m[7] !== undefined) { top.text += decode(m[7]); continue; }
    if (m[4] === undefined) continue;
    if (m[2] === "/") { if (stack.length > 1) stack.pop(); continue; }
    const node = { name: m[4], children: [], text: "", attrs: m[5] };
    top.children.push(node);
    if (m[6] !== "/") stack.push(node);
  }
  return root;
}
const find = (node, name) => node && node.children.find(c => c.name === name);
const findAll = (node, name) => (node ? node.children.filter(c => c.name === name) : []);
const text = node => (node ? node.text.trim() : "");
const walk = (node, name, out = []) => { for (const c of node.children) { if (c.name === name) out.push(c); walk(c, name, out); } return out; };

/** Parse a 207 multistatus into [{href, status, props:{name: node}, statuses}] (props from 2xx propstats). */
export function parseMultistatus(xml) {
  const doc = parseXml(xml);
  const ms = walk(doc, "multistatus")[0];
  if (!ms) return [];
  return findAll(ms, "response").map(r => {
    const props = {};
    let status = text(find(r, "status")) || "";
    for (const ps of findAll(r, "propstat")) {
      const st = text(find(ps, "status"));
      if (/\s2\d\d\s/.test(st + " ")) for (const p of (find(ps, "prop") || { children: [] }).children) props[p.name] = p;
    }
    return { href: text(find(r, "href")), status, props };
  });
}

// ---------- HTTP ----------
export function createCalDav({ ICAL, fetchImpl, allowPrivate = false, userAgent = "DaylightCalendar/1.0 (CalDAV)", timeoutMs = 15000 }) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));

  function assertSafe(u) {
    if (u.username || u.password) throw new CalDavError("invalid_url", "Enter the server address without a username or password.");
    if (allowPrivate) return;
    if (u.protocol !== "https:") throw new CalDavError("invalid_url", "Only secure (https) servers are supported.");
    const host = u.hostname.toLowerCase();
    if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") ||
        host.endsWith(".test") || host.endsWith(".invalid") || host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host))
      throw new CalDavError("invalid_url", "Private network and local addresses cannot be used.");
  }
  function normalize(raw) {
    let t = String(raw || "").trim();
    if (!t) throw new CalDavError("invalid_url", "Enter a server address.");
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = "https://" + t;
    let u; try { u = new URL(t); } catch { throw new CalDavError("invalid_url", "That doesn't look like a server address."); }
    if (!/^https?:$/.test(u.protocol)) throw new CalDavError("invalid_url", "Only http(s) addresses are supported.");
    assertSafe(u);
    return u;
  }
  const basic = (user, pass) => "Basic " + btoa(unescape(encodeURIComponent(user + ":" + pass)));

  /** One request, following redirects by hand (credentials only go to the original host). */
  async function dav(method, url, { user, pass, depth, body, headers = {}, type = "application/xml; charset=utf-8" } = {}) {
    let target = new URL(url); const origin = target.origin;
    for (let hop = 0; hop < 6; hop++) {
      assertSafe(target);
      const h = { "User-Agent": userAgent, ...headers };
      if (target.origin === origin) h.Authorization = basic(user, pass);
      if (depth !== undefined) h.Depth = String(depth);
      if (body !== undefined) h["Content-Type"] = type;
      let res;
      try {
        res = await doFetch(target.href, { method, headers: h, body, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
      } catch (e) { throw new CalDavError("unreachable", "Couldn't reach that server."); }
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location"); if (!loc) throw new CalDavError("unreachable", "Bad redirect from server.");
        target = new URL(loc, target); continue;
      }
      const textBody = await res.text();
      if (textBody.length > 12_000_000) throw new CalDavError("server_error", "Server response too large.");
      return { status: res.status, headers: res.headers, text: textBody, url: target.href };
    }
    throw new CalDavError("unreachable", "Too many redirects.");
  }

  const NS = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:a="http://apple.com/ns/ical/"';
  const propfind = (props) => `<?xml version="1.0" encoding="utf-8"?><d:propfind ${NS}><d:prop>${props}</d:prop></d:propfind>`;
  const abs = (base, href) => new URL(href, base).href;
  const hrefIn = (node) => text(find(node, "href"));

  function authOrThrow(res) {
    if (res.status === 401 || res.status === 403) throw new CalDavError("auth_failed", "The server rejected the username or password.");
  }

  // ---------- discovery ----------
  async function discover(rawUrl, user, pass) {
    const start = normalize(rawUrl);
    const candidates = [start.href];
    for (const extra of [start.origin + "/.well-known/caldav", start.origin + "/"]) if (!candidates.includes(extra)) candidates.push(extra);
    let sawAuth = null, sawReach = false;
    for (const candidate of candidates) {
      let res;
      try {
        res = await dav("PROPFIND", candidate, { user, pass, depth: 0, body: propfind("<d:current-user-principal/><c:calendar-home-set/><d:resourcetype/><d:displayname/>") });
      } catch (e) { if (e.code === "unreachable") continue; throw e; }
      sawReach = true;
      if (res.status === 401 || res.status === 403) { sawAuth = res; continue; }
      if (res.status !== 207) continue;
      const entry = parseMultistatus(res.text)[0];
      if (!entry) continue;
      const base = res.url;
      const isCalendar = !!find(entry.props.resourcetype, "calendar");
      let home = entry.props["calendar-home-set"] && hrefIn(entry.props["calendar-home-set"]);
      let principal = entry.props["current-user-principal"] && hrefIn(entry.props["current-user-principal"]);
      if (!home && principal) {
        const pr = await dav("PROPFIND", abs(base, principal), { user, pass, depth: 0, body: propfind("<c:calendar-home-set/>") });
        authOrThrow(pr);
        if (pr.status === 207) { const pe = parseMultistatus(pr.text)[0]; home = pe && pe.props["calendar-home-set"] && hrefIn(pe.props["calendar-home-set"]); }
      }
      if (!home && isCalendar) {
        // A bare calendar link on a server that hides the principal: its parent collection is the home.
        const u = new URL(base); u.pathname = u.pathname.replace(/\/[^/]*\/?$/, "/") || "/"; home = u.href;
      }
      if (!home) continue;
      const homeUrl = abs(base, home);
      const calendars = await listCalendars(homeUrl, user, pass);
      if (!calendars.length) throw new CalDavError("no_caldav", "Connected, but the server has no calendars for this account.");
      return { principal_url: principal ? abs(base, principal) : null, home_url: homeUrl, calendars };
    }
    if (sawAuth) throw new CalDavError("auth_failed", "The server rejected the username or password.");
    if (!sawReach) throw new CalDavError("unreachable", "Couldn't reach that server.");
    throw new CalDavError("no_caldav", "That address doesn't look like a CalDAV server.");
  }

  async function listCalendars(homeUrl, user, pass) {
    const res = await dav("PROPFIND", homeUrl, { user, pass, depth: 1, body: propfind(
      "<d:resourcetype/><d:displayname/><a:calendar-color/><cs:getctag/><d:sync-token/><c:supported-calendar-component-set/><d:current-user-privilege-set/>") });
    authOrThrow(res);
    if (res.status !== 207) throw new CalDavError("no_caldav", "The server didn't list calendars (HTTP " + res.status + ").");
    const out = [];
    for (const r of parseMultistatus(res.text)) {
      if (!find(r.props.resourcetype, "calendar")) continue;
      const comps = r.props["supported-calendar-component-set"];
      if (comps && !findAll(comps, "comp").some(c => /name="VEVENT"/i.test(c.attrs || ""))) continue;
      const privs = r.props["current-user-privilege-set"];
      const names = privs ? walk(privs, "privilege").map(p => p.children[0] && p.children[0].name) : [];
      const readOnly = privs ? !(names.includes("write") || names.includes("write-content") || names.includes("all")) : false;
      let color = text(r.props["calendar-color"]);
      color = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color) ? color.slice(0, 7).toUpperCase() : null;
      out.push({ href: abs(res.url, r.href), name: text(r.props.displayname) || decodeURIComponent(r.href.replace(/\/$/, "").split("/").pop() || "Calendar"),
        color, ctag: text(r.props.getctag) || null, sync_token: text(r.props["sync-token"]) || null, read_only: readOnly });
    }
    return out;
  }

  // ---------- reading ----------
  const calQueryAll = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query ${NS}><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>`;

  function resourcesFrom(res, baseUrl) {
    return parseMultistatus(res.text).filter(r => r.props["calendar-data"]).map(r => ({
      href: abs(baseUrl, r.href), etag: text(r.props.getetag) || null, data: text(r.props["calendar-data"]) }));
  }
  async function fetchAll(calUrl, user, pass) {
    const res = await dav("REPORT", calUrl, { user, pass, depth: 1, body: calQueryAll });
    authOrThrow(res);
    if (res.status !== 207) throw new CalDavError("server_error", "Server returned HTTP " + res.status + " reading the calendar.");
    return resourcesFrom(res, res.url);
  }
  async function multiget(calUrl, hrefs, user, pass) {
    const out = [];
    for (let i = 0; i < hrefs.length; i += 40) {
      const chunk = hrefs.slice(i, i + 40);
      const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-multiget ${NS}><d:prop><d:getetag/><c:calendar-data/></d:prop>${chunk.map(h => `<d:href>${esc(new URL(h).pathname)}</d:href>`).join("")}</c:calendar-multiget>`;
      const res = await dav("REPORT", calUrl, { user, pass, depth: 1, body });
      authOrThrow(res);
      if (res.status !== 207) throw new CalDavError("server_error", "Server returned HTTP " + res.status + " reading events.");
      out.push(...resourcesFrom(res, res.url));
    }
    return out;
  }
  /** Incremental read via sync-collection. Throws token_invalid when the token must be dropped. */
  async function syncChanges(calUrl, token, user, pass) {
    const body = `<?xml version="1.0" encoding="utf-8"?><d:sync-collection ${NS}><d:sync-token>${esc(token)}</d:sync-token><d:sync-level>1</d:sync-level><d:prop><d:getetag/></d:prop></d:sync-collection>`;
    const res = await dav("REPORT", calUrl, { user, pass, body });
    authOrThrow(res);
    if (res.status === 403 || res.status === 409 || res.status === 400 || res.status === 507 || res.status === 501 || res.status === 405)
      throw new CalDavError("token_invalid", "sync token rejected");
    if (res.status !== 207) throw new CalDavError("server_error", "Server returned HTTP " + res.status + " syncing.");
    const doc = parseXml(res.text);
    const newToken = text(walk(doc, "sync-token")[0]) || null;
    const changed = [], removed = [];
    for (const r of parseMultistatus(res.text)) {
      const href = abs(res.url, r.href);
      if (/\s404\s/.test(" " + r.status + " ")) removed.push(href);
      else if (r.href && !r.href.endsWith("/")) changed.push({ href, etag: text(r.props.getetag) || null });
    }
    // sync-collection also reports the collection itself; entries ending in "/" are skipped above.
    return { token: newToken, changed, removed };
  }
  async function getResource(url, user, pass) {
    const res = await dav("GET", url, { user, pass, headers: { Accept: "text/calendar" } });
    authOrThrow(res);
    if (res.status === 404) throw new CalDavError("not_found", "That event no longer exists on the server.");
    if (!res.ok && res.status !== 200) throw new CalDavError("server_error", "Server returned HTTP " + res.status + ".");
    return { data: res.text, etag: res.headers.get("etag") };
  }
  async function putResource(url, ics, { ifMatch, ifNoneMatch }, user, pass) {
    const headers = {};
    if (ifMatch) headers["If-Match"] = ifMatch;
    if (ifNoneMatch) headers["If-None-Match"] = "*";
    const res = await dav("PUT", url, { user, pass, body: ics, headers, type: "text/calendar; charset=utf-8" });
    authOrThrow(res);
    if (res.status === 412) throw new CalDavError("conflict", "etag mismatch");
    if (res.status === 404 && ifMatch) throw new CalDavError("conflict", "resource gone");
    if (res.status === 409 || res.status === 405) throw new CalDavError("conflict", "server refused write (HTTP " + res.status + ")");
    if (![200, 201, 204].includes(res.status)) throw new CalDavError("server_error", "Server returned HTTP " + res.status + " saving the event.");
    let etag = res.headers.get("etag");
    if (!etag) { try { etag = (await getResource(url, user, pass)).etag; } catch { etag = null; } }
    return { etag };
  }
  async function deleteResource(url, { ifMatch }, user, pass) {
    const res = await dav("DELETE", url, { user, pass, headers: ifMatch ? { "If-Match": ifMatch } : {} });
    authOrThrow(res);
    if (res.status === 412) throw new CalDavError("conflict", "etag mismatch");
    if (res.status === 404) throw new CalDavError("not_found", "That event is already gone from the server.");
    if (![200, 202, 204].includes(res.status)) throw new CalDavError("server_error", "Server returned HTTP " + res.status + " deleting the event.");
  }

  // ---------- iCalendar <-> daylight events ----------
  function inUTC(value, defaultTz) {
    if (value.isDate) return new Date(Date.UTC(value.year, value.month - 1, value.day));
    const tzid = value.zone && value.zone.tzid;
    if (tzid && tzid !== "floating" && tzid !== "local" && tzid !== "UTC" && tzid !== "Z") {
      if (value.zone.component) return value.toJSDate();
      try {
        const zone = new Intl.DateTimeFormat("en-US", { timeZone: tzid, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
        const wanted = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
        let ms = wanted;
        for (let i = 0; i < 4; i++) {
          const parts = Object.fromEntries(zone.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
          ms += wanted - Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
        }
        return new Date(ms);
      } catch { throw new Error("Unsupported time zone: " + tzid); }
    }
    if (tzid === "UTC" || tzid === "Z") return value.toJSDate();
    if (defaultTz) return inUTC({ ...value, zone: { tzid: defaultTz } }, "");
    return new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second));
  }

  /** Turn one calendar resource into daylight event records (recurrences expanded into the same window the iCal feed uses). */
  function eventsFromResource(resource, { now = Date.now() } = {}) {
    let comp;
    try { comp = new ICAL.Component(ICAL.parse(resource.data)); } catch { return { events: [], skipped: 1 }; }
    for (const part of comp.getAllSubcomponents("vtimezone")) {
      try { const tz = new ICAL.Timezone(part); ICAL.TimezoneService.register(tz.tzid, tz); } catch { /* skip */ }
    }
    const timezone = String(comp.getFirstPropertyValue("x-wr-timezone") || "UTC");
    const master = new Map(), exceptions = [];
    let skipped = 0;
    for (const part of comp.getAllSubcomponents("vevent")) {
      try {
        const ev = new ICAL.Event(part);
        if (!ev.uid || !ev.startDate) { skipped++; continue; }
        if (ev.isRecurrenceException()) exceptions.push(ev); else master.set(ev.uid, ev);
      } catch { skipped++; }
    }
    for (const ex of exceptions) {
      const parent = master.get(ex.uid);
      if (!parent) { skipped++; continue; }
      try { parent.relateException(ex); } catch { skipped++; }
    }
    const lower = new Date(now - 365 * 86400000), upper = new Date(now + 730 * 86400000);
    const events = [];
    const base = { href: resource.href, etag: resource.etag };
    function store(ev, part, original, index, occStart, occEnd, recurring) {
      const start = inUTC(occStart || part.startDate, timezone);
      let end = inUTC(occEnd || part.endDate || (occStart || part.startDate), timezone);
      if (!Number.isFinite(+start)) throw new Error("bad date");
      const allDay = !!(occStart || part.startDate).isDate;
      if (!(end > start)) end = new Date(start.getTime() + (allDay ? 86400000 : 3600000));
      if (end < lower || start > upper) return;
      events.push({
        ...base, uid: String(ev.uid), occurrence_id: String(ev.uid) + ":" + String((original && original.toICALString()) || index),
        title: String(part.summary || ev.summary || "Untitled").slice(0, 300), description: String(part.description || "").slice(0, 10000), location: String(part.location || "").slice(0, 1500),
        start: start.toISOString(), end: (allDay ? new Date(end.getTime() - 60000) : end).toISOString(), allDay,
        status: String(part.component.getFirstPropertyValue("status") || "CONFIRMED").toUpperCase(),
        source_timezone: (occStart || part.startDate).zone && (occStart || part.startDate).zone.tzid || timezone,
        recurring: !!recurring, recurrence_id: original ? original.toICALString() : null,
        original_start: start.toISOString(),
      });
    }
    for (const ev of master.values()) {
      try {
        const recurring = !!ev.component.getFirstPropertyValue("rrule") || ev.component.getAllProperties("rdate").length > 0;
        if (!recurring) { store(ev, ev, null, 0, null, null, false); continue; }
        const iter = ev.iterator();
        let seen = 0, next;
        while ((next = iter.next()) && seen++ < 3000) {
          const d = ev.getOccurrenceDetails(next);
          if (inUTC(d.startDate, timezone) > upper) break;
          try { store(ev, d.item, d.recurrenceId, seen, d.startDate, d.endDate, true); } catch { skipped++; }
        }
      } catch { skipped++; }
    }
    return { events, skipped };
  }

  // ---------- writing ----------
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pad = n => String(n).padStart(2, "0");
  const fmtUtc = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const fmtDate = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const textEsc = s => String(s || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  function fold(line) { const out = []; let rest = line; while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); } out.push(rest); return out.join("\r\n"); }

  /** daylight event -> new VCALENDAR text. times: ISO strings; allDay end is the inclusive last day (daylight convention). */
  function buildIcs(ev, uid) {
    const start = new Date(ev.start), end = new Date(ev.end);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//daylight//CalDAV 1.0//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:" + uid, "DTSTAMP:" + fmtUtc(new Date()), "SEQUENCE:0"];
    if (ev.allDay) {
      const endEx = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
      lines.push("DTSTART;VALUE=DATE:" + fmtDate(start), "DTEND;VALUE=DATE:" + fmtDate(endEx));
    } else lines.push("DTSTART:" + fmtUtc(start), "DTEND:" + fmtUtc(end));
    lines.push("SUMMARY:" + textEsc(ev.title || "Untitled"));
    if (ev.location) lines.push("LOCATION:" + textEsc(ev.location));
    if (ev.description) lines.push("DESCRIPTION:" + textEsc(ev.description));
    if (ev.rrule) lines.push("RRULE:" + ev.rrule);
    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  const toIcalTime = (d, allDay) => allDay ? ICAL.Time.fromData({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), isDate: true })
    : ICAL.Time.fromJSDate(d, true);
  function setTimes(vevent, start, end, allDay, keepZoneFrom) {
    // Only touch DTSTART/DTEND when the instants really change, so original zones/TZID survive.
    vevent.updatePropertyWithValue("dtstart", toIcalTime(start, allDay));
    const endEx = allDay ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1)) : end;
    if (vevent.hasProperty("duration")) vevent.removeProperty("duration");
    vevent.updatePropertyWithValue("dtend", toIcalTime(endEx, allDay));
  }
  function applyFields(vevent, fields) {
    if (fields.title !== undefined) vevent.updatePropertyWithValue("summary", String(fields.title || "Untitled"));
    const setOrDrop = (name, value) => { if (value === undefined) return; if (value) vevent.updatePropertyWithValue(name, String(value)); else vevent.removeProperty(name); };
    setOrDrop("location", fields.location); setOrDrop("description", fields.description);
    const seq = parseInt(vevent.getFirstPropertyValue("sequence") || "0", 10) || 0;
    vevent.updatePropertyWithValue("sequence", seq + 1);
    vevent.updatePropertyWithValue("dtstamp", ICAL.Time.fromJSDate(new Date(), true));
    vevent.updatePropertyWithValue("last-modified", ICAL.Time.fromJSDate(new Date(), true));
  }
  const cloneComp = (c) => new ICAL.Component(JSON.parse(JSON.stringify(c.toJSON())));
  /** RRULE copy that ends just before `origStart` (COUNT removed). */
  function truncatedRule(rrule, origStart, allDay) {
    const r = ICAL.Recur.fromData(JSON.parse(JSON.stringify(rrule.toJSON())));
    r.count = null;
    r.until = allDay
      ? ICAL.Time.fromData({ year: origStart.getUTCFullYear(), month: origStart.getUTCMonth() + 1, day: origStart.getUTCDate() - 1, isDate: true })
      : ICAL.Time.fromJSDate(new Date(origStart.getTime() - 1000), true);
    return r;
  }
  const instant = (vevent, prop) => { const v = vevent.getFirstPropertyValue(prop); return v ? inUTC(v, "UTC").getTime() : null; };

  /**
   * Compute the new resource text for an update. `scope`: all | only | following.
   * `occ` identifies the occurrence being edited: { start: ISO of the ORIGINAL occurrence start }.
   * Returns { ics, extraResource?: {ics} } (extraResource is a brand-new series for "following"), or throws refused/not_found.
   */
  function planUpdate(currentIcs, uid, scope, occ, fields) {
    const comp = new ICAL.Component(ICAL.parse(currentIcs));
    const vevents = comp.getAllSubcomponents("vevent").filter(v => String(v.getFirstPropertyValue("uid")) === uid);
    const master = vevents.find(v => !v.hasProperty("recurrence-id"));
    const overrides = vevents.filter(v => v.hasProperty("recurrence-id"));
    if (!master) throw new CalDavError("refused", "This event's series can't be safely changed here.");
    const recurring = master.hasProperty("rrule") || master.hasProperty("rdate");
    const newStart = fields.start ? new Date(fields.start) : null, newEnd = fields.end ? new Date(fields.end) : null;
    const allDay = fields.allDay !== undefined ? !!fields.allDay : !!master.getFirstPropertyValue("dtstart").isDate;
    const origStart = occ && occ.start ? new Date(occ.start) : null;

    if (!recurring || scope === "all") {
      if (recurring && overrides.length === 0 && newStart && origStart) {
        // shift the whole series by the edit's delta, keep its (possibly changed) duration
        const mStart = inUTC(master.getFirstPropertyValue("dtstart"), "UTC");
        const delta = newStart.getTime() - origStart.getTime();
        const shifted = new Date(mStart.getTime() + delta);
        const duration = newEnd.getTime() - newStart.getTime();
        setTimes(master, shifted, new Date(shifted.getTime() + duration), allDay);
      } else if (recurring && overrides.length) {
        // Time changes with existing exceptions can't shift them consistently: only non-time fields.
        if (newStart && origStart && newStart.getTime() !== origStart.getTime())
          throw new CalDavError("refused", "This series already has changed instances, so its time can't be changed safely.");
      } else if (!recurring && newStart && newEnd) {
        const same = instant(master, "dtstart") === newStart.getTime() && (instant(master, "dtend") ?? newEnd.getTime() + (allDay ? 86400000 : 0)) === newEnd.getTime() + (allDay ? 86400000 : 0);
        if (!same) setTimes(master, newStart, newEnd, allDay);
      }
      applyFields(master, fields);
      return { ics: comp.toString() };
    }

    if (!origStart) throw new CalDavError("refused", "Which occurrence to change wasn't specified.");
    if (scope === "only") {
      const rid = overrides.find(o => inUTC(o.getFirstPropertyValue("recurrence-id"), "UTC").getTime() === origStart.getTime());
      const target = rid || (() => {
        const copy = cloneComp(master);
        copy.removeProperty("rrule"); copy.removeProperty("rdate"); copy.removeProperty("exdate");
        copy.addPropertyWithValue("recurrence-id", toIcalTime(origStart, allDay));
        comp.addSubcomponent(copy);
        return copy;
      })();
      if (newStart && newEnd) setTimes(target, newStart, newEnd, allDay);
      applyFields(target, fields);
      return { ics: comp.toString() };
    }

    if (scope === "following") {
      const mStart = inUTC(master.getFirstPropertyValue("dtstart"), "UTC");
      if (origStart.getTime() <= mStart.getTime()) return planUpdate(currentIcs, uid, "all", occ, fields);
      if (overrides.some(o => inUTC(o.getFirstPropertyValue("recurrence-id"), "UTC").getTime() >= origStart.getTime()))
        throw new CalDavError("refused", "Some later instances of this series were changed individually, so it can't be split safely.");
      const rrule = master.getFirstPropertyValue("rrule");
      if (!rrule) throw new CalDavError("refused", "This series uses a repeat pattern that can't be split safely.");
      const rrJson = rrule.toJSON();
      if (rrJson.count) throw new CalDavError("refused", "This series repeats a fixed number of times, so it can't be split safely.");
      // New series (everything from the split on), built from the master before truncation.
      const dur = (inUTC(master.getFirstPropertyValue("dtend") || master.getFirstPropertyValue("dtstart"), "UTC").getTime()) - mStart.getTime();
      const newUid = (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) + "@daylight";
      const ncomp = new ICAL.Component(["vcalendar", [], []]);
      ncomp.addPropertyWithValue("version", "2.0"); ncomp.addPropertyWithValue("prodid", "-//daylight//CalDAV 1.0//EN");
      const nv = cloneComp(master);
      nv.updatePropertyWithValue("uid", newUid);
      nv.removeProperty("exdate");
      for (const ex of master.getAllProperties("exdate")) {
        for (const val of ex.getValues()) if (inUTC(val, "UTC").getTime() >= origStart.getTime()) nv.addPropertyWithValue("exdate", val);
      }
      const ns = newStart || origStart, ne = newEnd || new Date(origStart.getTime() + dur);
      setTimes(nv, ns, ne, allDay);
      applyFields(nv, { ...fields, start: undefined, end: undefined });
      nv.updatePropertyWithValue("sequence", 0);
      ncomp.addSubcomponent(nv);
      // Truncate the original: UNTIL = just before the split instant; drop exdates at/after it.
      master.updatePropertyWithValue("rrule", truncatedRule(rrule, origStart, allDay));
      const keep = master.getAllProperties("exdate").flatMap(p => p.getValues()).filter(v => inUTC(v, "UTC").getTime() < origStart.getTime());
      master.removeProperty("exdate");
      for (const v of keep) master.addPropertyWithValue("exdate", v);
      const seq = parseInt(master.getFirstPropertyValue("sequence") || "0", 10) || 0;
      master.updatePropertyWithValue("sequence", seq + 1);
      master.updatePropertyWithValue("dtstamp", ICAL.Time.fromJSDate(new Date(), true));
      return { ics: comp.toString(), extraResource: { ics: ncomp.toString(), uid: newUid } };
    }
    throw new CalDavError("refused", "Unknown change scope.");
  }

  /** Delete planning: returns { delete: true } (remove whole resource) or { ics } (resource edited in place). */
  function planDelete(currentIcs, uid, scope, occ) {
    const comp = new ICAL.Component(ICAL.parse(currentIcs));
    const vevents = comp.getAllSubcomponents("vevent").filter(v => String(v.getFirstPropertyValue("uid")) === uid);
    const master = vevents.find(v => !v.hasProperty("recurrence-id"));
    const overrides = vevents.filter(v => v.hasProperty("recurrence-id"));
    if (!master) throw new CalDavError("refused", "This event's series can't be safely changed here.");
    const recurring = master.hasProperty("rrule") || master.hasProperty("rdate");
    if (!recurring || scope === "all") return { delete: true };
    const origStart = occ && occ.start ? new Date(occ.start) : null;
    if (!origStart) throw new CalDavError("refused", "Which occurrence to delete wasn't specified.");
    const allDay = !!master.getFirstPropertyValue("dtstart").isDate;
    if (scope === "only") {
      for (const o of overrides) if (inUTC(o.getFirstPropertyValue("recurrence-id"), "UTC").getTime() === origStart.getTime()) comp.removeSubcomponent(o);
      master.addPropertyWithValue("exdate", toIcalTime(origStart, allDay));
      return { ics: comp.toString() };
    }
    if (scope === "following") {
      const mStart = inUTC(master.getFirstPropertyValue("dtstart"), "UTC");
      if (origStart.getTime() <= mStart.getTime()) return { delete: true };
      const rrule = master.getFirstPropertyValue("rrule");
      if (!rrule) throw new CalDavError("refused", "This series uses a repeat pattern that can't be split safely.");
      const rrJson = rrule.toJSON();
      if (rrJson.count) throw new CalDavError("refused", "This series repeats a fixed number of times, so it can't be cut safely.");
      for (const o of overrides) if (inUTC(o.getFirstPropertyValue("recurrence-id"), "UTC").getTime() >= origStart.getTime()) comp.removeSubcomponent(o);
      master.updatePropertyWithValue("rrule", truncatedRule(rrule, origStart, allDay));
      const keep = master.getAllProperties("exdate").flatMap(p => p.getValues()).filter(v => inUTC(v, "UTC").getTime() < origStart.getTime());
      master.removeProperty("exdate");
      for (const v of keep) master.addPropertyWithValue("exdate", v);
      return { ics: comp.toString() };
    }
    throw new CalDavError("refused", "Unknown change scope.");
  }

  return { normalize, discover, listCalendars, fetchAll, multiget, syncChanges, getResource, putResource, deleteResource,
    eventsFromResource, buildIcs, planUpdate, planDelete, parseMultistatus };
}
