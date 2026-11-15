-- =====================================================================================================================
-- DELETE ALL SAMPLE ACCOUNTS AND THEIR DATA  (paste the whole file into the Supabase SQL editor and press Run)
--
-- Removes every account whose address ends in @daylight-sample.test (the ones made by sample_accounts_for_screenshots.sql)
-- plus everything they own: workspaces, settings, calendars, shares, AI tokens and grants, audit rows, devices, banners they
-- created, and their sign-in records. No other account is touched. Safe to run more than once (a second run deletes nothing).
-- =====================================================================================================================

do $$
declare
  v_ids uuid[];
  r record;
  v_rows bigint;
  v_total bigint := 0;
begin
  select coalesce(array_agg(id), '{}') into v_ids from auth.users where email like '%@daylight-sample.test';

  if cardinality(v_ids) = 0 then
    raise notice 'No sample accounts found. Nothing to delete.';
    return;
  end if;

  -- every table in public that has a column pointing at a user (user_id, owner_id, created_by)
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name in ('user_id', 'owner_id', 'created_by') and c.data_type = 'uuid'
  loop
    execute format('delete from public.%I where %I = any($1)', r.table_name, r.column_name) using v_ids;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then raise notice 'public.%: % row(s) removed', r.table_name, v_rows; end if;
    v_total := v_total + v_rows;
  end loop;

  -- sign-in records, then the accounts themselves
  delete from auth.identities where user_id = any(v_ids);
  delete from auth.users where id = any(v_ids);

  raise notice 'Deleted % sample account(s) and % row(s) of their data.', cardinality(v_ids), v_total;
end $$;

-- Should show 0:
select count(*) as "sample accounts left" from auth.users where email like '%@daylight-sample.test';
