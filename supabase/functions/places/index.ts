// Daylight places: JWT-scoped Photon (OpenStreetMap) autocomplete.
// No API keys and no dynamic outbound URLs. Photon is a public demo; keep requests modest.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { isAddressStyleQuery, placeFromPhoton, rankPhotonFeatures } from "./place-format.mjs";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const origins = new Set([
  "https://joeynatale28-source.github.io",
  "https://daylight-rose.vercel.app",
]);
const throttle = new Map<string, { time: number; count: number }>();
const cache = new Map<string, { time: number; result: unknown }>();
const MAX_RESULTS = 5;

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  const permitted = origins.has(origin) ||
    /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{2,5})?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": permitted ? origin : "https://joeynatale28-source.github.io",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
  };
}
function reply(req: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...headers(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return reply(req, { error: "POST required" }, 405);
  const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply(req, { error: "Authentication required" }, 401);
  const { data: auth, error } = await admin.auth.getUser(bearer);
  if (error || !auth.user) return reply(req, { error: "Authentication required" }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(req, { error: "Invalid JSON" }, 400); }
  if (body.action !== "autocomplete") return reply(req, { error: "Unsupported action" }, 400);
  const input = string(body.input, 150).replace(/\s+/g, " ");
  if (input.length < 2) return reply(req, { suggestions: [] });
  const now = Date.now(), bucket = throttle.get(auth.user.id);
  if (!bucket || now - bucket.time >= 60000)
    throttle.set(auth.user.id, { time: now, count: 1 });
  else if (++bucket.count > 24) return reply(req, { error: "Too many searches" }, 429);
  const language = string(body.language, 12).split("-")[0].toLowerCase();
  const lang = /^[a-z]{2,3}$/.test(language) ? language : "en";
  const cacheKey = auth.user.id + ":" + lang + ":" + input.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.time < 30000) return reply(req, cached.result);
  const uri = new URL("https://photon.komoot.io/api/");
  uri.searchParams.set("q", input);
  uri.searchParams.set("limit", String(isAddressStyleQuery(input) ? MAX_RESULTS * 4 : MAX_RESULTS));
  uri.searchParams.set("lang", lang);
  const bias = body.bias;
  if (bias && typeof bias === "object") {
    const { lat, lng } = bias as Record<string, unknown>;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
        Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180) {
      uri.searchParams.set("lat", String(Number(lat)));
      uri.searchParams.set("lon", String(Number(lng)));
    }
  }
  try {
    const res = await fetch(uri.toString(), {
      headers: { "Accept": "application/json", "User-Agent": "DaylightCalendar/1.0 (limited autocomplete; contact via site)" },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) throw Error("Photon returned HTTP " + res.status);
    const payload = await res.json();
    const features = rankPhotonFeatures(
      Array.isArray(payload.features) ? payload.features : [],
      input,
    );
    const suggestions = features.map(placeFromPhoton).filter(Boolean).slice(0, MAX_RESULTS);
    const result = { suggestions, attribution: "© OpenStreetMap contributors" };
    if (cache.size > 400) cache.clear();
    cache.set(cacheKey, { time: now, result });
    return reply(req, result);
  } catch (failure) {
    // No user-entered location text in logs.
    console.error("Daylight places upstream failure:", failure instanceof Error ? failure.name : "unknown");
    return reply(req, { error: "Address suggestions temporarily unavailable" }, 503);
  }
});
