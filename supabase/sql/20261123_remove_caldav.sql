-- Removes the CalDAV feature's database objects. This is the ONE file allowed to name the old feature:
-- delete it from the repo after you have run it.
--
-- Safe to run more than once. It touches daylight's own two tables and their helper function only, never a remote
-- server. If any account row is still present it STOPS before dropping anything and tells you how many remain
-- (no credentials or server addresses are shown).

do $$
declare
  n bigint := 0;
begin
  if to_regclass('public.caldav_accounts') is not null then
    execute 'select count(*) from public.caldav_accounts' into n;
    if n > 0 then
      raise exception '% account(s) are still connected. Nothing was dropped. Disconnect them first, then run this again.', n;
    end if;
  end if;
end
$$;

drop table if exists public.caldav_calendars cascade;
drop table if exists public.caldav_accounts cascade;
drop function if exists public.caldav_touch_updated_at() cascade;

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'accounts table gone' as check, case when to_regclass('public.caldav_accounts') is null then 'ok' else 'STILL THERE' end as result
union all select 'calendars table gone', case when to_regclass('public.caldav_calendars') is null then 'ok' else 'STILL THERE' end
union all select 'helper function gone', case when to_regprocedure('public.caldav_touch_updated_at()') is null then 'ok' else 'STILL THERE' end;
