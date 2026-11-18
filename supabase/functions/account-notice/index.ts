// Sign-in notice for a suspended or banned person. The sign-in screen calls this ONLY after Supabase refused a sign-in with "user_banned".
// It repeats the person's own e-mail + password to Supabase (so the reason is only ever shown to someone who knows the password), and when the
// account really is restricted it returns why, when it ends, and how to appeal. Nothing is returned for any other situation.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { /* empty */ }
  const email = String(b.email ?? "").trim(), password = String(b.password ?? "");
  if (!email || !password) return json({ restricted: false });
  // Supabase says "user_banned" before it checks the password, so the password is checked here (only the right password ever sees the reason).
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok || (j.error_code ?? j.code) !== "user_banned") return json({ restricted: false });
  const { data: uid } = await sb.rpc("account_notice_check", { p_email: email, p_password: password });
  if (!uid) return json({ restricted: false });
  const user = { id: uid as string };
  const { data: row } = await sb.from("account_restrictions").select("kind,reason,ends_at,starts_at").eq("user_id", user.id).is("lifted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return json({ restricted: true, kind: row?.kind ?? "suspended", reason: row?.reason ?? "", ends_at: row?.ends_at ?? null, appeal: "privacy@daylightcal.com" });
});
