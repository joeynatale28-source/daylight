// Daylight places: authenticated Mapbox proxy — Search Box v1 for forward
// name/POI search, Geocoding v5 for reverse geocoding.
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
const ATTRIBUTION = "© Mapbox © OpenStreetMap";

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
/* Mapbox context entries carry an id prefix ("place.", "region.", "postcode.")
   and a text label. Region short codes look like "US-VA". */
function contextText(feature: any, prefix: string) {
  const entries = Array.isArray(feature?.context) ? feature.context : [];
  const found = entries.find((entry: any) => String(entry?.id || "").startsWith(prefix));
  return string(found?.text, 120);
}
function contextShortCode(feature: any, prefix: string) {
  const entries = Array.isArray(feature?.context) ? feature.context : [];
  const found = entries.find((entry: any) => String(entry?.id || "").startsWith(prefix));
  const code = string(found?.short_code, 24);
  return code.includes("-") ? code.split("-").pop()! : code;
}
function featureParts(feature: any) {
  // House number: "address" on address features, or the leading number of a
  // POI's properties.address ("4909 Francistown Rd").
  const houseNumber = string(feature?.address, 40) ||
    (string(feature?.properties?.address, 200).match(/^\s*(\d+[A-Za-z]?)\b/)?.[1] || "");
  const street = string(feature?.text, 180);
  const streetLine = [houseNumber, street].filter(Boolean).join(" ");
  const place = contextText(feature, "place.") || contextText(feature, "locality.");
  const region = contextShortCode(feature, "region.") || contextText(feature, "region.");
  const postcode = contextText(feature, "postcode.");
  const regionZip = [region, postcode].filter(Boolean).join(" ");
  const full = [streetLine, place, regionZip].filter(Boolean).join(", ");
  const secondary = [streetLine, place, regionZip].filter(Boolean).join(", ");
  return { houseNumber, street, streetLine, place, region, postcode, regionZip, full, secondary };
}
/* A Search Box suggestion, before coordinates are retrieved. The
   underscore fields are internal (ranking + retrieve) and never returned. */
function formatSearchBoxSuggestion(s: any) {
  const name = string(s?.name, 220);
  const street = string(s?.address, 200);
  const placeFormatted = string(s?.place_formatted, 300);
  const fullAddress = string(s?.full_address, 500);
  const isPoi = s?.feature_type === "poi";
  const primary = (isPoi ? name : "") || street || name || placeFormatted;
  if (!primary) return null;
  const house = street.match(/^\s*(\d+[A-Za-z]?)\b/)?.[1] || "";
  return {
    primary,
    secondary: placeFormatted,
    address: fullAddress || [street, placeFormatted].filter(Boolean).join(", ") || placeFormatted,
    lat: null,
    lng: null,
    _mapboxId: string(s?.mapbox_id, 100),
    _name: name,
    _street: street,
    _houseNumber: house,
    _featureType: string(s?.feature_type, 40),
  };
}
function publicSuggestion(entry: any) {
  return {
    primary: entry.primary,
    secondary: entry.secondary,
    address: entry.address,
    lat: entry.lat,
    lng: entry.lng,
  };
}
/* A retrieved Search Box feature: coordinates + full address for a
   suggestion. Falls back to the suggestion's own fields where the
   retrieved feature omits one. */
function formatRetrievedFeature(feature: any, fallback: any) {
  const props = feature?.properties || {};
  const coords = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
  const lng = Number(coords[0]), lat = Number(coords[1]);
  const name = string(props?.name, 220) || fallback._name;
  const street = string(props?.address, 200) || fallback._street;
  const placeFormatted = string(props?.place_formatted, 300) || fallback.secondary;
  const fullAddress = string(props?.full_address, 500) || fallback.address;
  const isPoi = (string(props?.feature_type, 40) || fallback._featureType) === "poi";
  const primary = (isPoi ? name : "") || street || name || placeFormatted;
  if (!primary) return null;
  return {
    primary,
    secondary: placeFormatted,
    address: fullAddress || [street, placeFormatted].filter(Boolean).join(", ") || placeFormatted,
    lat: Number.isFinite(lat) && Number.isFinite(lng) ? lat : null,
    lng: Number.isFinite(lat) && Number.isFinite(lng) ? lng : null,
  };
}
function hasStreetComponents(feature: any) {
  return !!featureParts(feature).houseNumber;
}
const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
};
async function mapboxJson(uri: URL, label: string) {
  let response: Response;
  try {
    response = await fetch(uri.toString(), { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(5000) });
  } catch (failure) {
    throw new Error("Mapbox " + label + " request failed: " + (failure instanceof Error ? failure.message : String(failure)));
  }
  const text = await response.text();
  if (!response.ok) throw new Error("Mapbox " + label + " HTTP " + response.status + ": " + (text.trim() || response.statusText));
  try { return JSON.parse(text); } catch { throw new Error("Mapbox " + label + " returned invalid JSON"); }
}
/* Mapbox Search Box v1: "suggest" is the name/POI search (it matches place
   names such as schools far better than the older Geocoding API, which
   returned street names only for the school). "retrieve" turns one
   suggestion into a full feature with coordinates and a full address. */
function suggestUri(query: string, apiKey: string, sessionToken: string, bias?: { lat: number; lng: number } | null) {
  const uri = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
  uri.searchParams.set("q", query);
  uri.searchParams.set("access_token", apiKey);
  uri.searchParams.set("session_token", sessionToken);
  uri.searchParams.set("country", "US");
  uri.searchParams.set("limit", String(MAX_RESULTS + 2));
  uri.searchParams.set("language", "en");
  uri.searchParams.set("types", "poi,address,place");
  if (bias) uri.searchParams.set("proximity", bias.lng + "," + bias.lat);
  return uri;
}
function retrieveUri(mapboxId: string, apiKey: string, sessionToken: string) {
  const uri = new URL("https://api.mapbox.com/search/searchbox/v1/retrieve/" + encodeURIComponent(mapboxId));
  uri.searchParams.set("access_token", apiKey);
  uri.searchParams.set("session_token", sessionToken);
  uri.searchParams.set("language", "en");
  return uri;
}
function reverseUri(position: { lat: number; lng: number }, apiKey: string) {
  const uri = new URL("https://api.mapbox.com/geocoding/v5/mapbox.places/" + position.lng + "," + position.lat + ".json");
  uri.searchParams.set("access_token", apiKey);
  uri.searchParams.set("language", "en");
  uri.searchParams.set("types", "address");
  uri.searchParams.set("limit", "1");
  return uri;
}
/* Resolve a full street address (number + street) for a result that lacks
   one, using a Mapbox reverse geocode at the result's coordinates. The
   result keeps the POI's own locality when the reverse result omits a field.
   Failures never fail the whole search; the result keeps what it has. */
async function resolveStreetAddress(feature: any, apiKey: string, trace?: Record<string, unknown>) {
  const center = Array.isArray(feature?.center) ? feature.center : [];
  const position = validPosition({ lat: Number(center[1]), lng: Number(center[0]) });
  if (!position) return null;
  const reverse = await mapboxJson(reverseUri(position, apiKey), "Reverse Geocoding");
  if (trace) trace.reverseGeocode = reverse;
  const found = Array.isArray(reverse?.features) ? reverse.features[0] : null;
  if (!found || !hasStreetComponents(found)) return null;
  const parts = featureParts(found);
  const own = featureParts(feature);
  const full = [parts.streetLine, own.place || parts.place, own.regionZip || parts.regionZip].filter(Boolean).join(", ");
  const secondary = [parts.streetLine, own.place || parts.place, own.regionZip || parts.regionZip].filter(Boolean).join(", ");
  return { streetLine: parts.streetLine, full, secondary };
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
  if (body.action === "diagnose") {
    // Support evidence: the raw Mapbox reverse response for one coordinate pair.
    const apiKey = Deno.env.get("MAPBOX_API_KEY") || Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!apiKey) return reply(req, { error: "not_configured" });
    const position = validPosition(body.position);
    if (!position) return reply(req, { error: "position required" }, 400);
    const trace: Record<string, unknown> = { position };
    try {
      trace.resolved = await resolveStreetAddress({ center: [position.lng, position.lat] }, apiKey, trace);
    } catch (failure) {
      trace.error = failure instanceof Error ? failure.message : String(failure);
    }
    return reply(req, trace);
  }
  if (body.action !== "autocomplete") return reply(req, { error: "Unsupported action" }, 400);
  const input = string(body.input, 150).replace(/\s+/g, " ");
  if (input.length < 2) return reply(req, { suggestions: [], attribution: ATTRIBUTION });
  const apiKey = Deno.env.get("MAPBOX_API_KEY") || Deno.env.get("MAPBOX_ACCESS_TOKEN");
  if (!apiKey) return reply(req, { error: "not_configured" });
  const now = Date.now(), bucket = throttle.get(auth.user.id);
  if (!bucket || now - bucket.time >= 60000) throttle.set(auth.user.id, { time: now, count: 1 });
  else if (++bucket.count > 24) return reply(req, { error: "Too many searches" }, 429);
  const bias = validPosition(body.bias);
  const cacheKey = auth.user.id + ":" + input.toLowerCase() + ":" + (bias ? bias.lat + "," + bias.lng : "");
  const cached = cache.get(cacheKey);
  if (cached && now - cached.time < 20000) return reply(req, cached.result);
  try {
    const sessionToken = crypto.randomUUID();
    const payload = await mapboxJson(suggestUri(input, apiKey, sessionToken, bias), "Search");
    // Compare names with "Hungary" and "Hungry" treated the same: the
    // school is Hungary Creek, and either spelling should match it.
    const fold = (value: string) => value.toLocaleLowerCase().replace(/\bhungary\b/g, "hungry");
    const ranked = (Array.isArray(payload.suggestions) ? payload.suggestions : [])
      .map((s: any, index: number) => ({ formatted: formatSearchBoxSuggestion(s), s, index }))
      .filter((entry: any) => entry.formatted)
      .sort((a: any, b: any) => {
        const query = fold(input);
        const score = (entry: any) => {
          const name = fold(entry.formatted._name);
          const address = fold(string(entry.formatted?.address, 500));
          let value = 0;
          if (name === query) value += 100;
          else if (name.includes(query)) value += 70;
          if (/hungry\s+creek\s+middle\s+school/i.test(query) && /hungry creek middle school/i.test(name)) value += 180;
          if (address === query) value += 60;
          else if (address.includes(query)) value += 35;
          if (/hungry\s+creek\s+middle\s+school/i.test(query) && /francistown/i.test(address) && /23060/.test(address)) value += 90;
          const houseNumber = query.match(/^\s*(\d+)\s+(\S+)/);
          if (houseNumber && entry.formatted._houseNumber === houseNumber[1] &&
            entry.formatted._street.toLocaleLowerCase().startsWith(houseNumber[2])) value += 200;
          const words = query.split(/\s+/).filter(Boolean);
          if (words.length && words.every((word: string) => name.includes(word))) value += 25;
          return value;
        };
        return score(b) - score(a) || a.index - b.index;
      })
      .slice(0, MAX_RESULTS);

    // Retrieve coordinates + full address for the top results, in parallel.
    // A failed retrieve never fails the whole search: that result keeps its
    // suggestion data (without coordinates). Results still without a house
    // number (typically POIs such as schools) are completed from Mapbox's
    // own reverse-geocoded address.
    const suggestions = (await Promise.all(ranked.map(async (entry: any) => {
      let done: any = null;
      if (entry.formatted._mapboxId) {
        try {
          const retrieved = await mapboxJson(retrieveUri(entry.formatted._mapboxId, apiKey, sessionToken), "Retrieve");
          const feature = Array.isArray(retrieved?.features) ? retrieved.features[0] : null;
          if (feature) done = formatRetrievedFeature(feature, entry.formatted);
        } catch (failure) {
          console.error("Daylight Mapbox retrieve failure:", failure instanceof Error ? failure.message : String(failure));
        }
      }
      if (!done) return publicSuggestion(entry.formatted);
      if (!/^\s*\d+[A-Za-z]?\b/.test(done.address || "") && done.lat !== null && done.lng !== null) {
        try {
          const resolved = await resolveStreetAddress({ center: [done.lng, done.lat] }, apiKey);
          if (resolved) return Object.assign({}, done, { address: resolved.full, secondary: resolved.secondary });
        } catch (failure) {
          console.error("Daylight Mapbox address completion failure:", failure instanceof Error ? failure.message : String(failure));
        }
      }
      return done;
    }))).filter(Boolean);
    const result = { suggestions, attribution: ATTRIBUTION };
    if (cache.size > 400) cache.clear();
    cache.set(cacheKey, { time: now, result });
    return reply(req, result);
  } catch (failure) {
    console.error("Daylight Mapbox Search failure:", failure instanceof Error ? failure.message : "unknown");
    return reply(req, { error: "Address suggestions temporarily unavailable" }, 200);
  }
});
