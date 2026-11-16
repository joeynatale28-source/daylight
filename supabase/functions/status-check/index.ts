// Daylight status checker. The database schedule (pg_cron, every 5 minutes) calls this ONCE per run; the run checks all 15 services
// and stores the results through one database function. Nothing here is ever called by a visitor, and it returns no data.
//   - own services: the five ping addresses (the `status` function), each answering "STATUS OK" (200) or "STATUS DOWN" (503)
//   - third-party sources: the public status API where one exists; sources with no reliable machine-readable indicator are recorded as unknown
// Each check is one request with a 5 second timeout. No retries.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TIMEOUT_MS = 5000;
const SLOW_MS = 2000;

type Svc = { key: string; kind: "ping" | "statuspage" | "google" | "unreadable"; ping_url: string | null; src_url: string | null };
type Res = { service: string; state: "up" | "degraded" | "down" | "unknown"; ms: number | null };

async function timed(url: string, init: RequestInit = {}): Promise<{ r: Response | null; ms: number }> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { r, ms: Math.round(performance.now() - t0) };
  } catch {
    return { r: null, ms: Math.round(performance.now() - t0) };
  }
}

async function ping(s: Svc): Promise<Res> {
  if (!s.ping_url) return { service: s.key, state: "unknown", ms: null };
  const { r, ms } = await timed(s.ping_url);
  if (!r) return { service: s.key, state: "down", ms };            // timed out or unreachable: slower than 5s is DOWN
  const body = (await r.text().catch(() => "")).trim();
  if (r.status === 200 && body === "STATUS OK") return { service: s.key, state: ms > SLOW_MS ? "degraded" : "up", ms };
  return { service: s.key, state: "down", ms };
}

async function statuspage(s: Svc): Promise<Res> {
  if (!s.src_url) return { service: s.key, state: "unknown", ms: null };
  const { r, ms } = await timed(s.src_url, { headers: { accept: "application/json" } });
  if (!r || r.status !== 200) return { service: s.key, state: "unknown", ms: r ? ms : null };
  try {
    const j = await r.json();
    const ind = String(j?.status?.indicator ?? "");
    const state = ind === "none" ? "up" : ind === "minor" ? "degraded" : ind === "major" || ind === "critical" ? "down" : "unknown";
    return { service: s.key, state, ms };
  } catch {
    return { service: s.key, state: "unknown", ms };
  }
}

// Google Cloud status has one feed of incidents; an incident with no end is still open. Gemini = open incidents touching a Gemini product.
async function google(list: Svc[]): Promise<Res[]> {
  const out: Res[] = [];
  const wanted = list.filter((s) => s.kind === "google");
  if (!wanted.length) return out;
  const { r, ms } = await timed(wanted[0].src_url ?? "https://status.cloud.google.com/incidents.json");
  for (const s of wanted) {
    if (!r || r.status !== 200) { out.push({ service: s.key, state: "unknown", ms: r ? ms : null }); continue; }
  }
  if (!r || r.status !== 200) return out;
  try {
    const incidents = await r.json();
    if (!Array.isArray(incidents)) throw new Error("shape");
    const open = incidents.filter((i: any) => !i.end);
    for (const s of wanted) {
      const mine = open.filter((i: any) => (i.affected_products ?? []).some((p: any) => /gemini/i.test(String(p?.title ?? ""))));
      const outage = mine.some((i: any) => i.status_impact === "SERVICE_OUTAGE");
      const disruption = mine.some((i: any) => i.status_impact === "SERVICE_DISRUPTION");
      out.push({ service: s.key, state: outage ? "down" : disruption ? "degraded" : "up", ms });
    }
  } catch {
    for (const s of wanted) out.push({ service: s.key, state: "unknown", ms });
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 404 });
  const key = req.headers.get("x-checker-key") ?? "";
  const rpc = (name: string, args: unknown) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const cfg = await rpc("status_checker_config", { p_key: key });
  if (!cfg.ok) return new Response(null, { status: 401 });
  const services: Svc[] = await cfg.json();

  const results = (await Promise.all([
    ...services.filter((s) => s.kind === "ping").map(ping),
    ...services.filter((s) => s.kind === "statuspage").map(statuspage),
    google(services),
    // no machine-readable overall indicator exists for these: recorded as unknown, never guessed
    ...services.filter((s) => s.kind === "unreadable").map((s): Res => ({ service: s.key, state: "unknown", ms: null })),
  ])).flat();

  const region = Deno.env.get("SB_REGION") ?? Deno.env.get("DENO_REGION") ?? "";
  const rec = await rpc("status_record_run", { p_results: results, p_region: region });
  return new Response(rec.ok ? "OK" : "ERROR", { status: rec.ok ? 200 : 500, headers: { "content-type": "text/plain" } });
});
