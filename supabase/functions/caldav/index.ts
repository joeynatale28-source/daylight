// daylight CalDAV edge function. Deploy with JWT verification ON.
// The browser only ever talks to this function; all CalDAV traffic happens here.
// Passwords are written to caldav_accounts and never returned, logged or echoed.
import ICAL from "npm:ical.js@2.2.1";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createCalDav } from "./lib.mjs";
import { createHandlers, DbError } from "./handlers.mjs";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cors = {
  "Access-Control-Allow-Origin": "https://joeynatale28-source.github.io",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Vary": "Origin",
};
const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

// Every query below is scoped by userId, which comes from the verified JWT (never the request body).
const must = (op: string, r: { data: any; error: any }) => {
  if (r.error) throw new DbError(op, r.error.code, r.error.message, r.error.hint);
  return r.data;
};
const store = {
  async listAccounts(u: string) { return must("listAccounts", await admin.from("caldav_accounts").select("*").eq("user_id", u).order("created_at")) ?? []; },
  async getAccount(u: string, id: string) { return must("getAccount", await admin.from("caldav_accounts").select("*").eq("user_id", u).eq("id", id).maybeSingle()); },
  async upsertAccount(u: string, f: Record<string, unknown>) {
    return must("upsertAccount", await admin.from("caldav_accounts").upsert({ ...f, user_id: u, last_error: null }, { onConflict: "user_id,server_url,username" }).select().single());
  },
  async updateAccount(u: string, id: string, f: Record<string, unknown>) { return must("updateAccount", await admin.from("caldav_accounts").update(f).eq("user_id", u).eq("id", id).select().single()); },
  async deleteAccount(u: string, id: string) { must("deleteAccount", await admin.from("caldav_accounts").delete().eq("user_id", u).eq("id", id)); },
  async listCalendars(u: string, accountId?: string) {
    let q = admin.from("caldav_calendars").select("*").eq("user_id", u).order("created_at");
    if (accountId) q = q.eq("account_id", accountId);
    return must("listCalendars", await q) ?? [];
  },
  async getCalendar(u: string, id: string) { return must("getCalendar", await admin.from("caldav_calendars").select("*").eq("user_id", u).eq("id", id).maybeSingle()); },
  async insertCalendar(u: string, f: Record<string, unknown>) { return must("insertCalendar", await admin.from("caldav_calendars").insert({ ...f, user_id: u }).select().single()); },
  async updateCalendar(u: string, id: string, f: Record<string, unknown>) { return must("updateCalendar", await admin.from("caldav_calendars").update(f).eq("user_id", u).eq("id", id).select().single()); },
  async deleteCalendar(u: string, id: string) { must("deleteCalendar", await admin.from("caldav_calendars").delete().eq("user_id", u).eq("id", id)); },
};

const dav = createCalDav({ ICAL, fetchImpl: (...a: [any, any]) => fetch(...a), allowPrivate: false });
// Failures are logged with the real code and message (never credentials or row values), so a future problem
// can be diagnosed from the function logs alone.
const handlers = createHandlers({ store, dav, log: (entry: Record<string, unknown>) => console.error("caldav failure", JSON.stringify(entry)) });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return respond({ ok: false, error: { code: "bad_request", message: "POST required" } }, 405);
  const jwt = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) return respond({ ok: false, error: { code: "unauthorized", message: "Sign in required" } }, 401);
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return respond({ ok: false, error: { code: "unauthorized", message: "Sign in required" } }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond({ ok: false, error: { code: "bad_request", message: "Invalid JSON" } }, 400); }
  if (JSON.stringify(body).length > 400_000) return respond({ ok: false, error: { code: "bad_request", message: "Request too large" } }, 413);
  // Log only the action name: never bodies, URLs or credentials.
  console.log("caldav action:", String(body.action || ""));
  const result = await handlers.handle(user.id, body);
  return respond(result.body, result.status);
});
