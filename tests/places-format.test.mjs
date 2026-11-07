import test from "node:test";
import assert from "node:assert/strict";
import { isAddressStyleQuery, placeFromPhoton, rankPhotonFeatures } from "../supabase/functions/places/place-format.mjs";

function feature(properties, id) {
  return {
    type: "Feature",
    properties: { osm_type: "way", osm_id: String(id), ...properties },
    geometry: { type: "Point", coordinates: [-77.5, 37.6] },
  };
}

test("places without their own house number do not inherit the nearest street", () => {
  const result = placeFromPhoton(feature({
    name: "Hungary Creek Middle School",
    street: "Covewood Road",
    city: "Glen Allen",
    state: "Virginia",
    postcode: "23060",
    country: "United States",
  }, 1));

  assert.equal(result.address, "Hungary Creek Middle School, Glen Allen, Virginia 23060, United States");
  assert.doesNotMatch(result.address, /Covewood Road/);
  assert.doesNotMatch(result.secondary, /Covewood Road/);
});

test("house-number results retain their full street address", () => {
  const result = placeFromPhoton(feature({
    housenumber: "4909",
    street: "Francistown Road",
    name: "Hungary Creek Middle School",
    city: "Glen Allen",
    state: "Virginia",
    postcode: "23060",
    country: "United States",
  }, 2));

  assert.equal(result.address, "4909 Francistown Road, Glen Allen, Virginia 23060, United States");
});

test("address-style queries rank results with their own house number first", () => {
  const named = feature({ name: "Hungary Creek Middle School" }, 3);
  const numbered = feature({ housenumber: "4909", street: "Francistown Road" }, 4);
  assert.equal(isAddressStyleQuery("4909 Francistown Road"), true);
  assert.equal(isAddressStyleQuery("Hungary Creek Middle School"), false);
  assert.deepEqual(rankPhotonFeatures([named, numbered], "4909 Francistown Road"), [numbered, named]);
  assert.deepEqual(rankPhotonFeatures([named, numbered], "Hungary Creek Middle School"), [named, numbered]);
});
