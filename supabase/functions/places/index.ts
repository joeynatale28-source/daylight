// Daylight places: authenticated HERE Geocoding and Search Autosuggest proxy.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

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
const MAX_RESULTS = 6;

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
    headers: { ...headers(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
const string = (value: unknown, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
function validPosition(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const lat = Number(p.lat), lng = Number(p.lng);
  return Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    Number.isFinite(lng) && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function formatHereItem(item: any) {
  const address = item?.address;
  if (!address || typeof address.label !== "string" || !address.label.trim()) return null;
  const position = validPosition(item.position);
  const houseNumber = string(address.houseNumber, 40);
  const street = string(address.street, 180);
  const title = string(item.title, 220);
  const primary = title || [houseNumber, street].filter(Boolean).join(" ") || address.label.trim();
  const secondary = [
    string(address.city, 120),
    string(address.state, 100),
    string(address.postalCode, 24),
  ].filter(Boolean).join(", ");
  return {
    primary,
    secondary,
    address: address.label.trim(),
    lat: position?.lat ?? null,
    lng: position?.lng ?? null,
  };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return reply(req, { error: "POST required" }, 405);
  const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply(req, { error: "Authentication required" }, 401);
  const { data: auth, error } = await admin.auth.getUser(bearer);
  if (error || !auth.user) return reply(req, { error: "Authentication required" }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(req, { error: "Invalid JSON" }, 400); }
  if (body.action !== "autocomplete") return reply(req, { error: "Unsupported action" }, 400);
  const input = string(body.input, 150).replace(/\s+/g, " ");
  if (input.length < 2) return reply(req, { suggestions: [], attribution: "© HERE" });
  const apiKey = Deno.env.get("HERE_API_KEY");
  if (!apiKey) return reply(req, { error: "not_configured" });
  const now = Date.now(), bucket = throttle.get(auth.user.id);
  if (!bucket || now - bucket.time >= 60000) throttle.set(auth.user.id, { time: now, count: 1 });
  else if (++bucket.count > 24) return reply(req, { error: "Too many searches" }, 429);
  const bias = validPosition(body.bias);
  const cacheKey = auth.user.id + ":" + input.toLowerCase() + ":" + (bias ? bias.lat + "," + bias.lng : "");
  const cached = cache.get(cacheKey);
  if (cached && now - cached.time < 20000) return reply(req, cached.result);
  const uri = new URL("https://autosuggest.search.hereapi.com/v1/autosuggest");
  uri.searchParams.set("q", input);
  uri.searchParams.set("apiKey", apiKey);
  uri.searchParams.set("in", "countryCode:USA");
  uri.searchParams.set("limit", String(MAX_RESULTS));
  uri.searchParams.set("lang", "en");
  if (bias) uri.searchParams.set("at", bias.lat + "," + bias.lng);
  try {
    const response = await fetch(uri.toString(), {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error("HERE returned HTTP " + response.status);
    const payload = await response.json();
    const suggestions = (Array.isArray(payload.items) ? payload.items : [])
      .map(formatHereItem).filter(Boolean).slice(0, MAX_RESULTS);
    const result = { suggestions, attribution: "© HERE" };
    if (cache.size > 400) cache.clear();
    cache.set(cacheKey, { time: now, result });
    return reply(req, result);
  } catch (failure) {
    console.error("Daylight HERE autosuggest failure:", failure instanceof Error ? failure.name : "unknown");
    return reply(req, { error: "Address suggestions temporarily unavailable" }, 200);
  }
});