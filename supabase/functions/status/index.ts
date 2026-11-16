// Simple public status pings. Each service has its own long address with the service word embedded
// in it. The addresses are not secrets. Answers: 200 "STATUS OK", 503 "STATUS DOWN", or 404 (empty)
// when the path has no service word. Nothing else is ever returned.

const BASE = "https://usihrcucnreecynewgbd.supabase.co";
const TIMEOUT_MS = 5000;

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function status200(url: string, headers: Record<string, string> = {}): Promise<boolean> {
  const r = await get(url, headers);
  await r.body?.cancel();
  return r.status === 200;
}

const checks: Record<string, () => Promise<boolean>> = {
  // Supabase Auth health needs the project's public (publishable) key.
  auth: () => {
    const key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    return status200(`${BASE}/auth/v1/health`, key ? { apikey: key } : {});
  },
  // One minimal read with the service role (server-side only).
  database: () => {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!key) return Promise.resolve(false);
    return status200(`${BASE}/rest/v1/daylight_owners?select=*&limit=1`, {
      apikey: key,
      authorization: `Bearer ${key}`,
    });
  },
  // Observed healthy: with no credentials the endpoint answers 401 with code MISSING_CREDENTIALS.
  mcp: async () => {
    const r = await get(`${BASE}/functions/v1/mcp`);
    const text = await r.text();
    return r.status === 401 && text.includes("MISSING_CREDENTIALS");
  },
  website: () => status200("https://daylightcal.com/"),
  app: () => status200("https://joeynatale28-source.github.io/daylight/dashboard/"),
};

Deno.serve(async (req: Request) => {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const i = parts.indexOf("status");
  const addr = (i >= 0 ? parts.slice(i + 1).join("/") : "").toLowerCase();
  const service = Object.keys(checks).find((w) => addr.includes(w));
  if (!service) return new Response(null, { status: 404 });

  let ok = false;
  try {
    ok = await checks[service]();
  } catch {
    ok = false;
  }
  return new Response(ok ? "STATUS OK" : "STATUS DOWN", {
    status: ok ? 200 : 503,
    headers: { "content-type": "text/plain" },
  });
});
