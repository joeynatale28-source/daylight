// Support Center helper (Privacy Policy, Section 7). Owner only.
//   action "give_data" { ticket_id }  build the ticket owner full data export (readable JSON files, one ICS file per calendar and a
//                                     readable summary) as a ZIP, keep it in the private support-files bucket and post it in that
//                                     ticket chat. The bucket policy stops anyone downloading it after 24 hours.
//   action "purge"                    remove export files older than 24 hours.
// The caller must be the owner (daylight_is_owner() is asked with the caller own token) or hold the project service role key.
// The export only ever goes into the ticket it was asked for.
import { createClient } from "npm:@supabase/supabase-js@2";
import { strToU8, zipSync } from "npm:fflate@0.8.2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "support-files";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const sb = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function isOwner(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === SERVICE) return true;
  // any other service-role key of this project (legacy JWT or secret key): only it can read this table, so a successful read proves it
  const probe = await fetch(`${URL_}/rest/v1/support_tickets?select=id&limit=1`, { headers: { apikey: token, authorization: `Bearer ${token}` } });
  await probe.body?.cancel();
  if (probe.status === 200) return true;
  const me = createClient(URL_, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
  const { data, error } = await me.rpc("daylight_is_owner");
  return !error && data === true;
}

// ------------------------------------------------------------------ ICS
const icsText = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const day = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
function fold(line: string): string {
  const out: string[] = []; let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); }
  out.push(s); return out.join("\r\n");
}
function toIcs(name: string, events: any[]): string {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Daylight//Data export//EN", "CALSCALE:GREGORIAN", fold("X-WR-CALNAME:" + icsText(name))];
  const stamp = utc(new Date());
  for (const e of events) {
    const s = new Date(e.start), en = new Date(e.end || e.start);
    if (isNaN(s.getTime())) continue;
    L.push("BEGIN:VEVENT", fold("UID:" + (e.uid || `daylight-${e.id}@daylightcal.com`)), "DTSTAMP:" + stamp);
    if (e.allDay) {
      const endEx = new Date(Date.UTC(en.getFullYear(), en.getMonth(), en.getDate() + 1));
      const startD = new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()));
      L.push("DTSTART;VALUE=DATE:" + day(startD), "DTEND;VALUE=DATE:" + day(endEx));
    } else {
      L.push("DTSTART:" + utc(s), "DTEND:" + utc(isNaN(en.getTime()) ? s : en));
    }
    L.push(fold("SUMMARY:" + icsText(e.title || "")));
    if (e.loc) L.push(fold("LOCATION:" + icsText(e.loc)));
    if (e.desc) L.push(fold("DESCRIPTION:" + icsText(e.desc)));
    if (e.rrule) L.push(fold("RRULE:" + String(e.rrule).replace(/^RRULE:/i, "")));
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
}
const safeName = (s: string) => String(s || "calendar").replace(/[^A-Za-z0-9 _.-]+/g, "").trim().slice(0, 60) || "calendar";


// ------------------------------------------------------------------ export
async function buildExport(uid: string, ticketId: string): Promise<Uint8Array> {
  const { data: u, error: ue } = await sb.auth.admin.getUserById(uid);
  if (ue || !u?.user) throw new Error("That account no longer exists.");
  const user = u.user;
  const q = async (table: string) => {
    const { data, error } = await sb.from(table).select("*").eq("user_id", uid);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  };
  const { data: snap } = await sb.from("workspace_snapshots").select("payload, updated_at").eq("user_id", uid).maybeSingle();
  const payload: any = snap?.payload ?? {};
  const calendars: any[] = payload.calendars ?? [], events: any[] = payload.events ?? [], tasks: any[] = payload.tasks ?? [];
  const calRows: any[] = await q("calendars");
  const calShareRows: any[] = (await sb.from("daylight_calendar_shares").select("*").or(`owner_id.eq.${uid},recipient_id.eq.${uid}`)).data ?? [];
  const evShareRows: any[] = (await sb.from("daylight_event_shares").select("*").or(`owner_id.eq.${uid},recipient_id.eq.${uid}`)).data ?? [];
  const grants = await q("mcp_grants");
  const tokens = (await q("mcp_tokens")).map((t: any) => { const { token_hash, ...rest } = t; return rest; });   // never the secret
  const audit = await q("mcp_audit_log");
  const wsAudit = await q("mcp_workspace_audit");
  const subs = (await q("subscriptions")).map((s: any) => { const { cached_events, etag, ...rest } = s; return rest; });
  const us = await q("user_settings");
  const devices = await q("daylight_device_sessions");
  const tickets = await q("support_tickets");
  const tids = tickets.map((t: any) => t.id);
  const msgs: any[] = tids.length ? ((await sb.from("support_messages").select("ticket_id,sender,kind,body,created_at").in("ticket_id", tids).order("created_at")).data ?? []) : [];
  const calsClean = calRows.map((c: any) => { const { share_token_hash, ...rest } = c; return rest; });

  const J = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
  const files: Record<string, Uint8Array> = {
    "account.json": J({
      id: user.id, email: user.email, phone: user.phone || null, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at,
      sign_in_methods: (user.identities ?? []).map((i: any) => i.provider), user_metadata: user.user_metadata ?? {},
    }),
    "settings.json": J({ settings: payload.settings ?? {}, ui: payload.ui ?? {}, account_settings: us }),
    "calendars.json": J({ calendars, calendar_records: calsClean, feeds: payload.feeds ?? [], subscriptions: subs }),
    "events.json": J(events),
    "tasks.json": J(tasks),
    "sharing.json": J({ calendar_shares: calShareRows, event_shares: evShareRows, calendar_public_links: calsClean.map((c: any) => ({ calendar_id: c.id, name: c.name, share_feed_enabled: c.share_feed_enabled, share_public_enabled: c.share_public_enabled })) }),
    "ai-access.json": J({ grants, tokens, activity_log: audit, workspace_activity_log: wsAudit }),
    "devices.json": J(devices),
    "support-tickets.json": J(tickets.map((t: any) => ({ ...t, messages: msgs.filter((m: any) => m.ticket_id === t.id).map(({ ticket_id, ...m }: any) => m) }))),
  };
  const used = new Set<string>();
  for (const c of calendars) {
    const evs = events.filter((e: any) => e.cal === c.id);
    let base = safeName(c.name), n = 2; while (used.has(base.toLowerCase())) base = safeName(c.name) + " " + n++;
    used.add(base.toLowerCase());
    files[`calendars/${base}.ics`] = strToU8(toIcs(c.name || base, evs));
  }
  const summary = [
    "YOUR DAYLIGHT DATA",
    "==================",
    `Prepared ${new Date().toUTCString()} for ${user.email} at your request (support ticket ${ticketId}).`,
    "This file holds everything Daylight stores about your account. It is only for you; keep it somewhere safe.",
    "",
    "WHAT IS INSIDE",
    "--------------",
    "account.json          Your account: id, e-mail, when it was created, your sign-in methods and profile name.",
    "settings.json         Your preferences (theme, default view, time format, notifications) and account settings.",
    `calendars.json        Your ${calendars.length} calendar(s), their colors and default reminders, and your ${subs.length} calendar subscription(s).`,
    `events.json           Your ${events.length} event(s): title, time, location, description, repeat rule.`,
    `tasks.json            Your ${tasks.length} task(s).`,
    `sharing.json          Who you share calendars and events with, and the permission each person has (${calShareRows.length} calendar share(s), ${evShareRows.length} event share(s)).`,
    "ai-access.json        The AI assistants you connected, what each may do (read / write / delete), and a log of what they did.",
    "devices.json          The devices signed in to your account.",
    `support-tickets.json  Your support tickets and every message in them (${tickets.length} ticket(s)).`,
    "calendars/*.ics       One ICS file per calendar. Import them into any calendar app.",
    "",
    "NOT INCLUDED",
    "------------",
    "Your password (Daylight never stores it in readable form) and the secret part of AI access tokens. Both are kept only as one-way hashes.",
    "",
    "HOW TO READ THE FILES",
    "---------------------",
    "The .json files are plain text; open them with any text editor. The .ics files open in Apple Calendar, Google Calendar, Outlook and others.",
    "",
    "The download link in your support ticket expires 24 hours after it was posted. If it has expired, ask again in the ticket.",
    "",
  ].join("\r\n");
  files["SUMMARY.txt"] = strToU8(summary);
  return zipSync(files, { level: 6 });
}

async function purge(): Promise<number> {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  let removed = 0;
  const { data: tops } = await sb.storage.from(BUCKET).list("", { limit: 1000 });
  for (const top of tops ?? []) {   // <user id>/<ticket id>/<file>
    const { data: tks } = await sb.storage.from(BUCKET).list(top.name, { limit: 1000 });
    for (const tk of tks ?? []) {
      const { data: fs } = await sb.storage.from(BUCKET).list(`${top.name}/${tk.name}`, { limit: 1000 });
      const old = (fs ?? []).filter((f: any) => f.name.startsWith("export-") && new Date(f.created_at).getTime() < cutoff).map((f: any) => `${top.name}/${tk.name}/${f.name}`);
      if (old.length) { await sb.storage.from(BUCKET).remove(old); removed += old.length; }
    }
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!(await isOwner(req))) return json({ error: "Only the owner can do this." }, 403);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (body.action === "purge") return json({ ok: true, removed: await purge() });
  if (body.action !== "give_data" || !body.ticket_id) return json({ error: "Unknown action." }, 400);

  const { data: t } = await sb.from("support_tickets").select("*").eq("id", body.ticket_id).maybeSingle();
  if (!t) return json({ error: "That ticket was not found." }, 404);
  if (t.status !== "open") return json({ error: "This ticket is closed." }, 409);
  try {
    const zip = await buildExport(t.user_id, t.id);
    const path = `${t.user_id}/${t.id}/export-${Date.now()}.zip`;
    const up = await sb.storage.from(BUCKET).upload(path, zip, { contentType: "application/zip", upsert: false });
    if (up.error) throw new Error("storage: " + up.error.message);
    const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const att = [{ path, name: "daylight-data-export.zip", type: "application/zip", size: zip.byteLength, expires_at: expires }];
    const { error } = await sb.rpc("support_post", {
      p_ticket_id: t.id, p_sender: "admin", p_sender_id: null, p_kind: "export",
      p_body: "Here is a copy of your data. The download is available for 24 hours.", p_atts: att,
    });
    if (error) throw new Error(error.message);
    purge().catch(() => {});
    return json({ ok: true, expires_at: expires, size: zip.byteLength });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
