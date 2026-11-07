function string(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function placeFromPhoton(feature) {
  const properties = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates;
  const lng = Number(coordinates?.[0]);
  const lat = Number(coordinates?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const osmType = string(properties.osm_type, 20).toLowerCase();
  const osmId = String(properties.osm_id || "");
  if (!/^(node|way|relation|n|w|r)$/.test(osmType) ||
      !/^\d{1,20}$/.test(osmId)) return null;

  const houseNumber = string(properties.housenumber, 40);
  const streetName = string(properties.street, 150);
  const street = houseNumber ? [houseNumber, streetName].filter(Boolean).join(" ") : "";
  const name = string(properties.name, 200);
  const town = string(properties.city || properties.town || properties.village ||
    properties.locality || properties.district || properties.county, 150);
  const state = string(properties.state, 150);
  const postal = string(properties.postcode, 32);
  const country = string(properties.country, 120);
  const region = [town, [state, postal].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  const address = [street || name || town, region, country]
    .filter(Boolean).filter((segment, index, all) => index === 0 || segment !== all[0])
    .join(", ");
  if (!address) return null;

  const type = ({ n: "node", w: "way", r: "relation" })[osmType] || osmType;
  return {
    primary: name || street || town || address,
    secondary: [street && street !== name ? street : "", region, country]
      .filter(Boolean).join(" · "),
    address,
    hasHouseNumber: Boolean(houseNumber),
    osmRef: "osm:" + type + ":" + osmId,
    lat,
    lng,
  };
}

export function isAddressStyleQuery(input) {
  return /^\d{1,6}[A-Za-z]?\s+\p{L}/u.test(String(input).trim());
}

export function rankPhotonFeatures(features, input) {
  if (!isAddressStyleQuery(input)) return features;
  return features.slice().sort((a, b) =>
    Number(Boolean(b?.properties?.housenumber)) -
    Number(Boolean(a?.properties?.housenumber)));
}
