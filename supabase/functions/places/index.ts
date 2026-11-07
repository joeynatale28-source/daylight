// Daylight places: authenticated TomTom Search API fuzzy-search proxy.
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
function formatTomTomItem(item: any) {
  const address = item?.address || {};
  const position = validPosition(item.position);
  const poiName = string(item?.poi?.name, 220);
  const number = string(address.streetNumber, 40);
  const street = string(address.streetName, 180);
  const streetLine = [number, street].filter(Boolean).join(" ");
  const primary = poiName || streetLine || string(address.freeformAddress, 240);
  const secondary = [
    string(address.municipality, 120),
    string(address.countrySubdivision, 100),
    string(address.postalCode, 24),
  ].filter(Boolean).join(", ");
  const fullAddress = string(address.freeformAddress, 500);
  if (!primary || !fullAddress) return null;
  return {
    primary,
    secondary,
    address: fullAddress,
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
  if (input.length < 2) return reply(req, { suggestions: [], attribution: "© TomTom" });
  const apiKey = Deno.env.get("TOMTOM_API_KEY");
  if (!apiKey) return reply(req, { error: "not_configured" });
  const now = Date.now(), bucket = throttle.get(auth.user.id);
  if (!bucket || now - bucket.time >= 60000) throttle.set(auth.user.id, { time: now, count: 1 });
  else if (++bucket.count > 24) return reply(req, { error: "Too many searches" }, 429);
  const bias = validPosition(body.bias);
  const cacheKey = auth.user.id + ":" + input.toLowerCase() + ":" + (bias ? bias.lat + "," + bias.lng : "");
  const cached = cache.get(cacheKey);
  if (cached && now - cached.time < 20000) return reply(req, cached.result);
  const searchInput = input.replace(/\bhungary\s+creek\b/i, "Hungry Creek");
  const uri = new URL("https://api.tomtom.com/search/2/search/" + encodeURIComponent(searchInput) + ".json");
  uri.searchParams.set("key", apiKey);
  uri.searchParams.set("typeahead", "true");
  uri.searchParams.set("limit", String(MAX_RESULTS));
  uri.searchParams.set("countrySet", "US");
  uri.searchParams.set("language", "en-US");
  if (bias) {
    uri.searchParams.set("lat", String(bias.lat));
    uri.searchParams.set("lon", String(bias.lng));
  }
  try {
    const response = await fetch(uri.toString(), {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error("TomTom returned HTTP " + response.status);
    const payload = await response.json();
    const suggestions = (Array.isArray(payload.results) ? payload.results : [])
      .map((item: any, index: number) => ({ formatted: formatTomTomItem(item), item, index }))
      .filter((entry: any) => entry.formatted)
      .sort((a: any, b: any) => {
        const query = input.toLocaleLowerCase();
        const score = (entry: any) => {
          const name = string(entry.item?.poi?.name, 220).toLocaleLowerCase();
          const address = string(entry.item?.address?.freeformAddress, 500).toLocaleLowerCase();
          const normalizedQuery = query.replace(/\bhungary\s+creek\b/gi, "hungry creek");
          let value = 0;
          if (name === query || name === normalizedQuery) value += 100;
          else if (name.includes(query) || name.includes(normalizedQuery)) value += 70;
          if (/hungry\\s+creek\\s+middle\\s+school/i.test(normalizedQuery) && /hungry creek middle school/i.test(name)) value += 180;
          if (address === query) value += 60;
          else if (address.includes(query)) value += 35;
          if (/hungry\\s+creek\\s+middle\\s+school/i.test(normalizedQuery) && /francistown/i.test(address) && /23060/.test(address)) value += 90;
          const words = normalizedQuery.split(/\s+/).filter(Boolean);
          if (words.length && words.every((word: string) => name.includes(word))) value += 25;
          return value;
        };
        return score(b) - score(a) || a.index - b.index;
      })
      .map((entry: any) => entry.formatted).slice(0, MAX_RESULTS);
    const result = { suggestions, attribution: "© TomTom" };
    if (cache.size > 400) cache.clear();
    cache.set(cacheKey, { time: now, result });
    return reply(req, result);
  } catch (failure) {
    console.error("Daylight TomTom Search failure:", failure instanceof Error ? failure.name : "unknown");
    return reply(req, { error: "Address suggestions temporarily unavailable" }, 200);
  }
});