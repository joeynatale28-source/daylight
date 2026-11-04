-- Photon (OpenStreetMap) metadata for the normalized events table.
-- The current Daylight UI's authoritative store is workspace_snapshots.payload;
-- its event entries also preserve loc, placeId, placeLat, and placeLng.
alter table public.events
  add column if not exists location_text text,
  add column if not exists location_place_id text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;
update public.events set location_text = location
  where location_text is null and location is not null;
