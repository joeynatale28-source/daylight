// Data requests (Privacy Policy, Section 7). Called from Admin only: the owner approves a request that a person made in Settings.
//   action "approve"  { id }  export: build the full export (JSON + ICS in one zip), keep it in a PRIVATE bucket, e-mail a signed
//                              link that expires after 7 days.  delete: delete the account's data and notify by e-mail.
//   action "purge"            remove export files older than 8 days (their links have already expired).
// The caller must be the owner (the database function daylight_is_owner() is asked with the caller's own token), or hold the
// project's service role key (maintenance / tests). Everyone else is refused. Nothing is fulfilled without this review step.
import { createClient } from "npm:@supabase/supabase-js@2";
import { strToU8, zipSync } from "npm:fflate@0.8.2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("RESEND_FROM") ?? "Daylight <noreply@daylightcal.com>";
const BUCKET = "data-exports";
const WEEK = 7 * 24 * 3600;

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
  const probe = await fetch(`${URL_}/rest/v1/data_requests?select=id&limit=1`, { headers: { apikey: token, authorization: `Bearer ${token}` } });
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
async function buildExport(uid: string): Promise<Uint8Array> {
  const { data: u, error: ue } = await sb.auth.admin.getUserById(uid);
  if (ue || !u?.user) throw new Error("That account no longer exists.");
  const user = u.user;
  const q = async (table: string, col = "user_id", select = "*") => {
    const { data, error } = await sb.from(table).select(select).eq(col, uid);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  };
  const { data: snap } = await sb.from("workspace_snapshots").select("payload, updated_at").eq("user_id", uid).maybeSingle();
  const payload: any = snap?.payload ?? {};
  const calendars = payload.calendars ?? [], events = payload.events ?? [];
  const calRows: any[] = await q("calendars");
  const calShareRows: any[] = (await sb.from("daylight_calendar_shares").select("*").or(`owner_id.eq.${uid},recipient_id.eq.${uid}`)).data ?? [];
  const evShareRows: any[] = (await sb.from("daylight_event_shares").select("*").or(`owner_id.eq.${uid},recipient_id.eq.${uid}`)).data ?? [];
  const grants = await q("mcp_grants");
  const tokens = (await q("mcp_tokens")).map((t: any) => { const { token_hash, ...rest } = t; return rest; });   // never the secret
  const audit = await q("mcp_audit_log");
  const subs = (await q("subscriptions")).map((s: any) => { const { cached_events, etag, ...rest } = s; return rest; });
  const us = await q("user_settings");
  const calsClean = calRows.map((c: any) => { const { share_token_hash, ...rest } = c; return rest; });

  const J = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
  const files: Record<string, Uint8Array> = {
    "account.json": J({
      id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at,
      sign_in_methods: (user.identities ?? []).map((i: any) => i.provider), user_metadata: user.user_metadata ?? {},
    }),
    "settings.json": J({ settings: payload.settings ?? {}, ui: payload.ui ?? {}, account_settings: us }),
    "calendars.json": J({ calendars, calendar_records: calsClean, feeds: payload.feeds ?? [], subscriptions: subs }),
    "events.json": J(events),
    "tasks.json": J(payload.tasks ?? []),
    "sharing.json": J({ calendar_shares: calShareRows, event_shares: evShareRows, calendar_public_links: calsClean.map((c: any) => ({ calendar_id: c.id, name: c.name, share_feed_enabled: c.share_feed_enabled, share_public_enabled: c.share_public_enabled })) }),
    "ai-access.json": J({ grants, tokens, activity_log: audit }),
    "README.txt": strToU8("Your Daylight data export.\r\nJSON files hold your account, settings, calendars, events, tasks, sharing permissions and AI access grants.\r\nThe calendars folder holds one .ics file per calendar, which you can import into any calendar app.\r\nGenerated " + new Date().toISOString() + ".\r\n"),
  };
  const used = new Set<string>();
  for (const c of calendars) {
    const evs = events.filter((e: any) => e.cal === c.id);
    let base = safeName(c.name), n = 2; while (used.has(base.toLowerCase())) base = safeName(c.name) + " " + n++;
    used.add(base.toLowerCase());
    files[`calendars/${base}.ics`] = strToU8(toIcs(c.name || base, evs));
  }
  return zipSync(files, { level: 6 });
}

// ------------------------------------------------------------------ e-mail (Resend). Without RESEND_API_KEY nothing is sent and the request says so.
async function sendMail(to: string, subject: string, html: string, text: string): Promise<string | null> {
  if (!RESEND_KEY) return "E-mail is not configured yet (no RESEND_API_KEY on the project).";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    if (!r.ok) return `E-mail provider refused it (${r.status}): ${(await r.text()).slice(0, 200)}`;
    return null;
  } catch (e) { return "E-mail could not be sent: " + (e as Error).message; }
}
const shell = (body: string) => `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#171717">${body}<p style="margin-top:32px;font-size:12px;color:#737373">Daylight · daylightcal.com</p></div>`;

// ------------------------------------------------------------------ delete
async function deleteEverything(uid: string): Promise<void> {
  const { data: own } = await sb.from("daylight_owners").select("user_id").eq("user_id", uid);
  if (own && own.length) throw new Error("This is an owner account; it is not deleted from here.");
  const steps: Array<[string, any]> = [
    ["calendar shares", sb.from("daylight_calendar_shares").delete().or(`owner_id.eq.${uid},recipient_id.eq.${uid}`)],
    ["event shares", sb.from("daylight_event_shares").delete().or(`owner_id.eq.${uid},recipient_id.eq.${uid}`)],
    ["device sessions", sb.from("daylight_device_sessions").delete().eq("user_id", uid)],
    ["notification reads", sb.from("daylight_broadcast_reads").delete().eq("user_id", uid)],
    ["notification clears", sb.from("daylight_broadcast_clears").delete().eq("user_id", uid)],
    ["notification recipients", sb.from("daylight_broadcast_recipients").delete().eq("user_id", uid)],
    ["banner recipients", sb.from("daylight_banner_recipients").delete().eq("user_id", uid)],
  ];
  for (const [label, p] of steps) { const { error } = await p; if (error) throw new Error(`${label}: ${error.message}`); }
  for (const bucket of ["avatars", BUCKET]) {
    const { data: objs } = await sb.storage.from(bucket).list(uid, { limit: 1000 });
    if (objs && objs.length) await sb.storage.from(bucket).remove(objs.map((o) => `${uid}/${o.name}`));
  }
  const { error } = await sb.auth.admin.deleteUser(uid);   // cascades: calendars, snapshot, tokens, grants, subscriptions, settings, logs
  if (error) throw new Error("account: " + error.message);
}

async function purge(): Promise<number> {
  const cutoff = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const { data } = await sb.from("data_requests").select("id, export_path").eq("kind", "export").not("export_path", "is", null).lt("updated_at", cutoff);
  const rows = data ?? [];
  if (rows.length) {
    await sb.storage.from(BUCKET).remove(rows.map((r: any) => r.export_path));
    await sb.from("data_requests").update({ export_path: null }).in("id", rows.map((r: any) => r.id));
  }
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!(await isOwner(req))) return json({ error: "Only the owner can do this." }, 403);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  if (body.action === "purge") return json({ ok: true, removed: await purge() });
  if (body.action !== "approve" || !body.id) return json({ error: "Unknown action." }, 400);

  const { data: r } = await sb.from("data_requests").select("*").eq("id", body.id).maybeSingle();
  if (!r) return json({ error: "That request was not found." }, 404);
  const resend = r.status === "approved" && r.kind === "export";   // approved earlier but the e-mail did not go out: build a fresh link
  if (!["pending", "in_review"].includes(r.status) && !resend) return json({ error: "That request is not open." }, 409);

  // claim it first so two clicks cannot run it twice
  const claim = await sb.from("data_requests").update({ status: "approved", reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(), email_error: null })
    .eq("id", r.id).in("status", resend ? ["approved"] : ["pending", "in_review"]).select("id");
  if (claim.error || !claim.data?.length) return json({ error: "That request is not open." }, 409);

  try {
    if (r.kind === "export") {
      const zip = await buildExport(r.user_id);
      const path = `${r.user_id}/${r.id}.zip`;
      const up = await sb.storage.from(BUCKET).upload(path, zip, { contentType: "application/zip", upsert: true });
      if (up.error) throw new Error("storage: " + up.error.message);
      const signed = await sb.storage.from(BUCKET).createSignedUrl(path, WEEK, { download: "daylight-data-export.zip" });
      if (signed.error || !signed.data) throw new Error("link: " + (signed.error?.message ?? "none"));
      const expires = new Date(Date.now() + WEEK * 1000);
      const link = signed.data.signedUrl;
      const when = expires.toUTCString().replace(/ GMT$/, " UTC");
      const err = await sendMail(r.email, "Your Daylight data export",
        shell(`<h1 style="font-size:22px;margin:0 0 12px">Your data export is ready</h1><p style="line-height:1.6">You asked for a copy of your Daylight data. It includes your account, settings, calendars, events, tasks, sharing permissions and AI access grants as JSON files, plus an ICS file for each calendar.</p><p style="margin:24px 0"><a href="${link}" style="background:#171717;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Download your data</a></p><p style="line-height:1.6;font-size:14px;color:#525252">This link expires on ${when} (7 days). If you did not ask for this, you can ignore this e-mail.</p>`),
        `Your Daylight data export is ready.\n\nDownload it here (the link expires on ${when}, 7 days from now):\n${link}\n\nIf you did not ask for this, ignore this e-mail.`);
      await sb.from("data_requests").update({
        status: err ? "approved" : "sent", export_path: path, link_expires_at: expires.toISOString(),
        email_sent_at: err ? null : new Date().toISOString(), email_error: err, updated_at: new Date().toISOString(),
      }).eq("id", r.id);
      return json({ ok: true, status: err ? "approved" : "sent", emailed: !err, email_error: err, expires_at: expires.toISOString() });
    }
    // delete
    await deleteEverything(r.user_id);
    const err = await sendMail(r.email, "Your Daylight data was deleted",
      shell(`<h1 style="font-size:22px;margin:0 0 12px">Your data has been deleted</h1><p style="line-height:1.6">As you asked, we deleted your Daylight account and its calendars, events, tasks and settings. Copies may remain in our providers' backups for a short period and are then deleted.</p>`),
      "Your Daylight account and its data have been deleted, as you asked. Copies may remain in our providers' backups for a short period and are then deleted.");
    await sb.from("data_requests").update({ status: "completed", email_sent_at: err ? null : new Date().toISOString(), email_error: err, updated_at: new Date().toISOString() }).eq("id", r.id);
    return json({ ok: true, status: "completed", emailed: !err, email_error: err });
  } catch (e) {
    // put it back so it can be reviewed again; nothing is left half-claimed
    await sb.from("data_requests").update({ status: "in_review", email_error: "Failed: " + (e as Error).message, updated_at: new Date().toISOString() }).eq("id", r.id);
    return json({ error: (e as Error).message }, 500);
  }
});
