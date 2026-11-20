-- Daylight status system: the check store, the public summary read, owner-only maintenance windows, and the 5-minute schedule.
-- Run once in the SQL editor of the NEW project (usihrcucnreecynewgbd). Safe to re-run.
--
-- After running: set each ping address on the five own-service rows (they are public addresses, not credentials, and are never
-- shown on the page, so they are not kept in this file):
--   update public.status_services set ping_url = 'https://usihrcucnreecynewgbd.supabase.co/functions/v1/status/<16 random><word><16 random>' where key = '<word>';
-- Then deploy the `status` and `status-check` Edge Functions (verify_jwt = false; the checker authenticates itself with the stored key).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ------------------------------------------------------------------ tables (no public access: everything goes through the functions below)
create table if not exists public.status_services (
  key text primary key,
  name text not null,
  grp text not null,
  descr text not null,
  sort int not null,
  kind text not null check (kind in ('ping', 'statuspage', 'google', 'unreadable')),
  ping_url text,
  src_url text
);
create table if not exists public.status_latest (
  service text primary key references public.status_services (key) on delete cascade,
  state text not null check (state in ('up', 'degraded', 'down', 'unknown')),
  ms int,
  checked_at timestamptz not null
);
create table if not exists public.status_checks (
  id bigserial primary key,
  service text not null references public.status_services (key) on delete cascade,
  checked_at timestamptz not null default now(),
  state text not null,
  ms int
);
create index if not exists status_checks_at_idx on public.status_checks (checked_at);
create table if not exists public.status_daily (
  service text not null references public.status_services (key) on delete cascade,
  day date not null,
  counted int not null default 0,
  ok int not null default 0,
  primary key (service, day)
);
create table if not exists public.status_incidents (
  id bigserial primary key,
  service text not null references public.status_services (key) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz
);
create index if not exists status_incidents_open_idx on public.status_incidents (service) where ended_at is null;
create table if not exists public.status_maintenance (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  services text[] not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  canceled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.status_config (key text primary key, value text);

do $$ declare t text; begin
  foreach t in array array['status_services', 'status_latest', 'status_checks', 'status_daily', 'status_incidents', 'status_maintenance', 'status_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;

insert into public.status_services (key, name, grp, descr, sort, kind, src_url) values
  ('website',    'Website',         'Main Services',        'The Daylight website.',                        1,  'ping', null),
  ('app',        'App',             'Main Services',        'The Daylight dashboard.',                      2,  'ping', null),
  ('auth',       'Sign-in',         'Main Services',        'Email, Google, and passkey sign-in.',          3,  'ping', null),
  ('database',   'Database',        'Main Services',        'Your calendars, events, and tasks.',           4,  'ping', null),
  ('mcp',        'MCP Server',      'MCPs',                 'Daylight''s AI access endpoint.',              5,  'ping', null),
  ('claude',     'Claude',          'MCPs',                 'Claude''s status, from status.claude.com.',    6,  'statuspage', 'https://status.claude.com/api/v2/status.json'),
  ('chatgpt',    'ChatGPT',         'MCPs',                 'ChatGPT''s status, from status.openai.com.',   7,  'statuspage', 'https://status.openai.com/api/v2/status.json'),
  ('supabase',   'Supabase',        'Platform',             'Daylight''s backend: database and sign-in.',   9,  'statuspage', 'https://status.supabase.com/api/v2/status.json'),
  ('cloudflare', 'Cloudflare',      'Platform',             'DNS and the daylightcal.com host.',            10, 'statuspage', 'https://www.cloudflarestatus.com/api/v2/status.json'),
  ('github',     'GitHub Pages',    'Platform',             'The production website host.',                 11, 'statuspage', 'https://www.githubstatus.com/api/v2/status.json'),
  ('google',     'Google',          'Third-Party Services', 'Google sign-in.',                              12, 'unreadable', null),
  ('tomtom',     'TomTom',          'Third-Party Services', 'Place search in the Location field.',          13, 'unreadable', null),
  ('resend',     'Resend',          'Third-Party Services', 'Account emails.',                              14, 'statuspage', 'https://resend-status.com/api/v2/status.json'),
  ('namecheap',  'Namecheap',       'Third-Party Services', 'The daylightcal.com domain registrar.',        15, 'unreadable', null)
on conflict (key) do update set name = excluded.name, grp = excluded.grp, descr = excluded.descr, sort = excluded.sort, kind = excluded.kind, src_url = excluded.src_url;

-- the shared secret the schedule sends to the checker (random, generated once, never shown anywhere)
insert into public.status_config (key, value) values ('checker_key', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (key) do nothing;

-- ------------------------------------------------------------------ checker side (service role only)
create or replace function public.status_checker_config(p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or p_key <> (select value from public.status_config where key = 'checker_key') then
    raise exception 'unauthorized';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', key, 'kind', kind, 'ping_url', ping_url, 'src_url', src_url) order by sort) from public.status_services), '[]'::jsonb);
end $$;
revoke all on function public.status_checker_config(text) from public, anon, authenticated;
grant execute on function public.status_checker_config(text) to service_role;

create or replace function public.status_record_run(p_results jsonb, p_region text)
returns void language plpgsql security definer set search_path = '' as $$
declare r jsonb; svc text; st text; msv int; maint boolean;
begin
  for r in select * from jsonb_array_elements(p_results) loop
    svc := r ->> 'service'; st := r ->> 'state'; msv := nullif(r ->> 'ms', '')::int;
    if st not in ('up', 'degraded', 'down', 'unknown') or not exists (select 1 from public.status_services where key = svc) then continue; end if;
    maint := exists (select 1 from public.status_maintenance m where not m.canceled and now() >= m.starts_at and now() < m.ends_at and svc = any (m.services));
    insert into public.status_checks (service, state, ms) values (svc, st, msv);
    insert into public.status_latest (service, state, ms, checked_at) values (svc, st, msv, now())
      on conflict (service) do update set state = excluded.state, ms = excluded.ms, checked_at = excluded.checked_at;
    -- a check during that service's maintenance window counts for nothing and never opens an incident
    if maint or st = 'unknown' then continue; end if;
    insert into public.status_daily (service, day, counted, ok) values (svc, (now() at time zone 'utc')::date, 1, case when st = 'down' then 0 else 1 end)
      on conflict (service, day) do update set counted = public.status_daily.counted + 1, ok = public.status_daily.ok + (case when st = 'down' then 0 else 1 end);
    if st = 'down' then
      if not exists (select 1 from public.status_incidents where service = svc and ended_at is null) then
        insert into public.status_incidents (service, started_at) values (svc, now());
      end if;
    else
      update public.status_incidents set ended_at = now() where service = svc and ended_at is null;
    end if;
  end loop;
  insert into public.status_config (key, value) values ('last_run_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), ('last_run_region', coalesce(nullif(p_region, ''), 'unknown'))
    on conflict (key) do update set value = excluded.value;
  delete from public.status_checks where checked_at < now() - interval '7 days';
  delete from public.status_daily where day < ((now() at time zone 'utc')::date - 29);
  delete from public.status_incidents where ended_at is not null and ended_at < now() - interval '30 days';
end $$;
revoke all on function public.status_record_run(jsonb, text) from public, anon, authenticated;
grant execute on function public.status_record_run(jsonb, text) to service_role;

-- ------------------------------------------------------------------ the one public read: a cached-by-the-checker summary, computed from stored results only
create or replace function public.status_public()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare out jsonb; overall text;
begin
  with act as (
    select s.key from public.status_services s
    where exists (select 1 from public.status_maintenance m where not m.canceled and now() >= m.starts_at and now() < m.ends_at and s.key = any (m.services))
  ), days as (
    select generate_series((now() at time zone 'utc')::date - 29, (now() at time zone 'utc')::date, interval '1 day')::date as d
  ), svc as (
    select s.key, s.name, s.grp, s.descr, s.sort,
      case when s.key in (select key from act) then 'maintenance' else coalesce(l.state, 'unknown') end as state,
      l.ms, l.checked_at,
      (select round(100.0 * sum(ok) / nullif(sum(counted), 0), 2) from public.status_daily d where d.service = s.key and d.day >= (now() at time zone 'utc')::date - 29) as uptime,
      (select jsonb_agg((select round(100.0 * x.ok / nullif(x.counted, 0), 2) from public.status_daily x where x.service = s.key and x.day = dd.d) order by dd.d) from days dd) as bars
    from public.status_services s left join public.status_latest l on l.service = s.key
  )
  select jsonb_build_object(
    'now', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'last_run_at', (select value from public.status_config where key = 'last_run_at'),
    'region', (select value from public.status_config where key = 'last_run_region'),
    'bars_from', to_char((now() at time zone 'utc')::date - 29, 'YYYY-MM-DD'),
    'services', (select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'group', grp, 'desc', descr, 'state', state, 'ms', ms, 'checked_at', checked_at, 'uptime', uptime, 'bars', bars) order by sort) from svc),
    'incidents', coalesce((select jsonb_agg(jsonb_build_object('service', i.service, 'name', s.name, 'started', i.started_at, 'ended', i.ended_at) order by i.started_at desc)
                   from public.status_incidents i join public.status_services s on s.key = i.service
                   where i.started_at > now() - interval '30 days' or i.ended_at is null), '[]'::jsonb),
    'maintenance', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'desc', m.description, 'services', (select jsonb_agg(s.name order by s.sort) from public.status_services s where s.key = any (m.services)), 'starts', m.starts_at, 'ends', m.ends_at, 'active', now() >= m.starts_at) order by m.starts_at)
                   from public.status_maintenance m where not m.canceled and m.ends_at > now()), '[]'::jsonb)
  ) into out;
  select case
    when exists (select 1 from jsonb_array_elements(out -> 'services') e where e ->> 'state' = 'down') then 'down'
    when exists (select 1 from jsonb_array_elements(out -> 'services') e where e ->> 'state' = 'maintenance') then 'maintenance'
    when exists (select 1 from jsonb_array_elements(out -> 'services') e where e ->> 'state' = 'degraded') then 'degraded'
    when exists (select 1 from jsonb_array_elements(out -> 'services') e where e ->> 'state' = 'up') then 'operational'
    else 'unknown' end into overall;
  return out || jsonb_build_object('overall', overall);
end $$;
revoke all on function public.status_public() from public;
grant execute on function public.status_public() to anon, authenticated, service_role;

-- ------------------------------------------------------------------ owner-only maintenance windows (Admin dashboard)
create or replace function public.status_admin_list_maintenance()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'description', description, 'services', services, 'starts', starts_at, 'ends', ends_at, 'canceled', canceled) order by starts_at desc) from public.status_maintenance), '[]'::jsonb);
end $$;
create or replace function public.status_admin_services()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'not allowed'; end if;
  return (select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'group', grp) order by sort) from public.status_services);
end $$;
create or replace function public.status_admin_save_maintenance(p_id uuid, p_title text, p_description text, p_services text[], p_starts timestamptz, p_ends timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if not public.daylight_is_owner() then raise exception 'not allowed'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Add a title.'; end if;
  if p_services is null or cardinality(p_services) = 0 then raise exception 'Pick at least one service.'; end if;
  if exists (select 1 from unnest(p_services) u where u not in (select key from public.status_services)) then raise exception 'Unknown service.'; end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then raise exception 'The end must be after the start.'; end if;
  if p_id is null then
    insert into public.status_maintenance (title, description, services, starts_at, ends_at) values (btrim(p_title), coalesce(p_description, ''), p_services, p_starts, p_ends) returning id into rid;
  else
    update public.status_maintenance set title = btrim(p_title), description = coalesce(p_description, ''), services = p_services, starts_at = p_starts, ends_at = p_ends, updated_at = now() where id = p_id returning id into rid;
    if rid is null then raise exception 'That window no longer exists.'; end if;
  end if;
  return rid;
end $$;
create or replace function public.status_admin_cancel_maintenance(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.daylight_is_owner() then raise exception 'not allowed'; end if;
  update public.status_maintenance set canceled = true, updated_at = now() where id = p_id;
end $$;
do $$ declare f text; begin
  foreach f in array array['status_admin_list_maintenance()', 'status_admin_services()', 'status_admin_save_maintenance(uuid,text,text,text[],timestamptz,timestamptz)', 'status_admin_cancel_maintenance(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- ------------------------------------------------------------------ the schedule: ONE run every 5 minutes checks all 15 services
select cron.unschedule('daylight-status-check') where exists (select 1 from cron.job where jobname = 'daylight-status-check');
select cron.schedule('daylight-status-check', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://usihrcucnreecynewgbd.supabase.co/functions/v1/status-check',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-checker-key', (select value from public.status_config where key = 'checker_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

-- Gemini is not a supported assistant: it is no longer listed on the status page
delete from public.status_services where key = 'gemini';
