// Delete my account (Settings -> Danger Zone). The signed-in person deletes THEIR OWN account only: the caller's own access token says who
// they are, and they must type their e-mail address to confirm. Owner (Admin) accounts are refused so the site can never lock itself out.
// Everything is removed: calendars, events, tasks, settings, shares, AI access grants and tokens, support tickets and files, avatar, devices,
// and finally the sign-in account itself (the database cascades the rest).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const sb = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function emptyFolder(bucket: string, uid: string) {
  const { data: top } = await sb.storage.from(bucket).list(uid, { limit: 1000 });
  for (const t of top ?? []) {
    // files directly under <uid>/ (avatars) or one folder deeper (<uid>/<ticket>/file)
    if (t.id) { await sb.storage.from(bucket).remove([`${uid}/${t.name}`]); continue; }
    const { data: files } = await sb.storage.from(bucket).list(`${uid}/${t.name}`, { limit: 1000 });
    const paths = (files ?? []).map((f: any) => `${uid}/${t.name}/${f.name}`);
    if (paths.length) await sb.storage.from(bucket).remove(paths);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sign in first." }, 401);
  const { data: who, error: we } = await sb.auth.getUser(token);
  if (we || !who?.user) return json({ error: "Sign in first." }, 401);
  const user = who.user, uid = user.id;
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (String(body.confirm ?? "").trim().toLowerCase() !== String(user.email ?? "").toLowerCase() || !user.email) {
    return json({ error: "Type your e-mail address exactly to confirm." }, 400);
  }
  const { data: own } = await sb.from("daylight_owners").select("user_id").eq("user_id", uid);
  if (own && own.length) return json({ error: "Owner accounts can’t be deleted here." }, 403);
  try {
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
    await emptyFolder("avatars", uid);
    await emptyFolder("support-files", uid);
    const { error } = await sb.auth.admin.deleteUser(uid);   // cascades: calendars, workspace, tokens, grants, subscriptions, settings, logs, tickets
    if (error) throw new Error("account: " + error.message);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Couldn’t delete the account: " + (e as Error).message }, 500);
  }
});
