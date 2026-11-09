-- Removes the in-app support feature (added by 20261129_support_tickets.sql): its two tables, its eight functions and the
-- "Daylight Support" reply notifications it created. Nothing else is touched: broadcasts, banners, the bell, official notifications,
-- sharing and the admin dashboard keep working exactly as before.
-- Safe to run whether or not 20261129 was ever run, and safe to run more than once.
-- Run it AFTER 20261129_support_tickets.sql (if that was run). Ticket and message rows are deleted with their tables.

-- 1) the notifications support replies created (sender 'support'); recipients first, then the notifications themselves
delete from public.daylight_broadcast_recipients
  where broadcast_id in (select id from public.daylight_broadcasts where sender = 'support');
delete from public.daylight_broadcasts where sender = 'support';

-- 2) the functions
drop function if exists public.daylight_support_create_ticket(text, text, text, text);
drop function if exists public.daylight_support_my_tickets();
drop function if exists public.daylight_support_thread(uuid);
drop function if exists public.daylight_support_send(uuid, text);
drop function if exists public.daylight_support_admin_list();
drop function if exists public.daylight_support_admin_seen(uuid);
drop function if exists public.daylight_support_admin_reply(uuid, text);
drop function if exists public.daylight_support_admin_set_status(uuid, text);

-- 3) the tables (their policies, indexes and the messages' foreign key go with them)
drop table if exists public.daylight_support_messages;
drop table if exists public.daylight_support_tickets;

notify pgrst, 'reload schema';

-- Check: every line should say ok.
select 'support tables gone' as check,
       case when to_regclass('public.daylight_support_tickets') is null and to_regclass('public.daylight_support_messages') is null then 'ok' else 'STILL THERE' end as result
union all select 'support functions gone',
       case when to_regprocedure('public.daylight_support_create_ticket(text,text,text,text)') is null
             and to_regprocedure('public.daylight_support_admin_reply(uuid,text)') is null
             and to_regprocedure('public.daylight_support_my_tickets()') is null then 'ok' else 'STILL THERE' end
union all select 'no support notifications left',
       case when not exists (select 1 from public.daylight_broadcasts where sender = 'support') then 'ok' else 'LEFT OVER' end
union all select 'notifications system intact',
       case when to_regprocedure('public.daylight_list_broadcasts()') is not null and to_regclass('public.daylight_broadcasts') is not null then 'ok' else 'MISSING' end;
