// Admin actions from a support ticket's sidebar. OWNER ONLY, and every action is tied to ONE ticket: the person acted on is always that ticket's owner
// (the caller can never name an arbitrary account), and every action is written to support_admin_actions with who, what, when and the reason.
//   reset_password   { ticket_id }                     sends the existing password-reset e-mail to the person (the admin never sees or sets a password)
//   change_email     { ticket_id, new_email }          starts GoTrue's own e-mail change: a confirmation goes to the NEW address, the change only takes effect when they confirm
//   suspend          { ticket_id, duration, reason }   duration: 1d | 7d | 30d | until_lifted. Limits the account to the Support Center and Settings; ends by itself at expiry
//   ban              { ticket_id, reason }             same limits, with no end date, until an admin lifts it
//   lift             { ticket_id, reason? }            lifts an active suspension or ban
//   private_message  { ticket_id, text }               an in-app notification from Daylight Support, separate from the ticket thread
// The caller must be the owner (daylight_is_owner() is asked with the caller's own token) or hold the project's service role key (tests).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const sb = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const SITES = [/^https:\/\/joeynatale28-source\.github\.io\/daylight\//, /^https:\/\/(www\.)?daylightcal\.com\//];

async function whoIsOwner(req: Request): Promise<{ ok: boolean; id: string | null; email: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, id: null, email: "" };
  if (token === SERVICE) return { ok: true, id: null, email: "service-role" };
  const probe = await fetch(`${URL_}/rest/v1/support_tickets?select=id&limit=1`, { headers: { apikey: token, authorization: `Bearer ${token}` } });
  await probe.body?.cancel();
  if (probe.status === 200) return { ok: true, id: null, email: "service-role" };
  const me = createClient(URL_, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
  const { data, error } = await me.rpc("daylight_is_owner");
  if (error || data !== true) return { ok: false, id: null, email: "" };
  const { data: u } = await sb.auth.getUser(token);
  return { ok: true, id: u?.user?.id ?? null, email: u?.user?.email ?? "" };
}

const HOURS: Record<string, number> = { "1d": 24, "7d": 168, "30d": 720 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const admin = await whoIsOwner(req);
  if (!admin.ok) return json({ error: "Only the owner can do this." }, 403);
  let b: any = {};
  try { b = await req.json(); } catch { /* empty */ }
  const action = String(b.action ?? "");
  const { data: t } = await sb.from("support_tickets").select("id,user_id,user_email,title").eq("id", b.ticket_id ?? "").maybeSingle();
  if (!t) return json({ error: "That ticket was not found." }, 404);
  const uid: string = t.user_id;
  const { data: ur, error: ue } = await sb.auth.admin.getUserById(uid);
  if (ue || !ur?.user) return json({ error: "That account no longer exists." }, 404);
  const user = ur.user;
  const { data: owner } = await sb.from("daylight_owners").select("user_id").eq("user_id", uid);
  const protectedAccount = !!(owner && owner.length);
  const log = async (act: string, reason: string, detail: Record<string, unknown> = {}) => {
    await sb.from("support_admin_actions").insert({ ticket_id: t.id, user_id: uid, admin_id: admin.id, admin_email: admin.email, action: act, reason: reason.slice(0, 500), detail });
  };
  const reason = String(b.reason ?? "").trim();

  try {
    if (action === "reset_password") {
      const redirect = typeof b.redirect_to === "string" && SITES.some((r) => r.test(b.redirect_to)) ? b.redirect_to : undefined;
      const r = await fetch(`${URL_}/auth/v1/recover${redirect ? "?redirect_to=" + encodeURIComponent(redirect) : ""}`, {
        method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: user.email }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); return json({ error: j.msg || j.error_description || "The reset e-mail could not be sent (" + r.status + ")." }, 502); }
      await log("reset_password", "", {});
      return json({ ok: true });
    }

    if (action === "change_email") {
      const nw = String(b.new_email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nw)) return json({ error: "Enter a valid e-mail address." }, 400);
      if (nw === (user.email ?? "").toLowerCase()) return json({ error: "That is already their e-mail address." }, 400);
      // GoTrue's own e-mail change flow: a short-lived session for this person starts it, so the confirmation goes to the NEW address and nothing changes until they confirm.
      const gl = await sb.auth.admin.generateLink({ type: "magiclink", email: user.email! });
      const hashed = gl.data?.properties?.hashed_token;
      if (gl.error || !hashed) return json({ error: "Couldn’t start the change." }, 502);
      const vr = await fetch(`${URL_}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: hashed }) });
      const vj = await vr.json().catch(() => ({}));
      if (!vr.ok || !vj.access_token) return json({ error: "Couldn’t start the change." }, 502);
      const pu = await fetch(`${URL_}/auth/v1/user`, { method: "PUT", headers: { apikey: ANON, authorization: `Bearer ${vj.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ email: nw }) });
      const pj = await pu.json().catch(() => ({}));
      await fetch(`${URL_}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${vj.access_token}` } }).catch(() => {});   // the temporary session is dropped
      if (!pu.ok) return json({ error: pj.msg || pj.error_description || pj.message || "The verification e-mail could not be sent (" + pu.status + ")." }, 502);
      await log("change_email", "", { from: user.email, to: nw, status: "verification sent, not yet confirmed" });
      return json({ ok: true, pending: nw });
    }

    if (action === "suspend" || action === "ban") {
      if (protectedAccount) return json({ error: "Owner accounts can’t be suspended or banned from here." }, 403);
      if (reason.length < 3) return json({ error: "Type a reason (the person is shown it)." }, 400);
      let hours = 876000, endsAt: string | null = null, kind = "banned", dur = "permanent";
      if (action === "suspend") {
        kind = "suspended"; dur = String(b.duration ?? "");
        if (dur === "until_lifted") { hours = 876000; endsAt = null; }
        else if (HOURS[dur]) { hours = HOURS[dur]; endsAt = new Date(Date.now() + hours * 3600 * 1000).toISOString(); }
        else return json({ error: "Pick a duration." }, 400);
      }
      // the person can still sign in: the app limits them to the Support Center and Settings (my_account_status), and they can appeal there
      await sb.from("account_restrictions").update({ lifted_at: new Date().toISOString(), lifted_by: admin.id }).eq("user_id", uid).is("lifted_at", null);
      await sb.from("account_restrictions").insert({ user_id: uid, kind, reason: reason.slice(0, 500), ends_at: endsAt, set_by: admin.id });
      await log(action, reason, { duration: dur, ends_at: endsAt });
      return json({ ok: true, kind, ends_at: endsAt });
    }

    if (action === "lift") {
      const { error } = await sb.auth.admin.updateUserById(uid, { ban_duration: "none" });
      if (error) throw new Error(error.message);
      await sb.from("account_restrictions").update({ lifted_at: new Date().toISOString(), lifted_by: admin.id }).eq("user_id", uid).is("lifted_at", null);
      await log("lift", reason, {});
      return json({ ok: true });
    }

    if (action === "private_message") {
      const text = String(b.text ?? "").trim();
      if (text.length < 1 || text.length > 1000) return json({ error: "Write a message (up to 1000 characters)." }, 400);
      const { data: bc, error } = await sb.from("daylight_broadcasts").insert({ title: "Message from Daylight Support", body: text, sender: "support", audience: "specific", created_by: admin.id }).select("id").single();
      if (error || !bc) throw new Error(error?.message ?? "could not send");
      const { error: e2 } = await sb.from("daylight_broadcast_recipients").insert({ broadcast_id: bc.id, user_id: uid });
      if (e2) throw new Error(e2.message);
      await log("private_message", "", { length: text.length });
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
