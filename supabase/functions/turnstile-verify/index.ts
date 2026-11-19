// Cloudflare Turnstile verification for the Daylight security check page.
//   POST { token }  ->  { ok: true } when Cloudflare accepts the token,
//                       { ok: true, configured: false } when TURNSTILE_SECRET_KEY has not been set yet (the check is then a no-op, never a lock-out),
//                       { ok: false } when Cloudflare rejects it.
// The secret key is read from the Edge Function secrets (TURNSTILE_SECRET_KEY) at verification time. It is never in the code.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return json({ ok: true, configured: false });
  let token = "";
  try { token = String((await req.json()).token ?? ""); } catch { return json({ ok: false, error: "Bad request" }, 400); }
  if (!token || token.length > 4096) return json({ ok: false, error: "Missing token" }, 400);
  const form = new URLSearchParams({ secret, response: token });
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) form.set("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const j = await r.json();
    return json({ ok: j.success === true, configured: true });
  } catch {
    return json({ ok: false, error: "Could not reach the verification service" }, 502);
  }
});
