-- The emailed data-request flow (20261207) is replaced by data requests in the Support Center (20261208). Removes the old table, functions and bucket.
drop function if exists public.data_request_create(text), public.data_request_mine(), public.data_request_cancel(uuid), public.data_admin_list(), public.data_admin_set_status(uuid, text, text);
drop table if exists public.data_requests;
-- (the empty data-exports bucket is removed through the Storage API, not SQL)
