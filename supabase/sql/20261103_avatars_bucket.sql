-- ============================================================================
-- OPTIONAL: the public `avatars` Storage bucket and its four policies, as SQL.
-- Use this INSTEAD of creating the bucket by hand in the dashboard (do not do both).
-- The app writes <user id>/avatar.png (daylight-settings.js) and reads it through the public URL.
-- Public read; upload / update / delete only inside the person's own folder. Safe to run more than once.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars upload own folder" on storage.objects;
drop policy if exists "avatars update own folder" on storage.objects;
drop policy if exists "avatars delete own folder" on storage.objects;

create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

select 'avatars bucket is public' as check, case when exists(select 1 from storage.buckets where id='avatars' and public) then 'ok' else 'MISSING' end as result
union all select 'four avatars policies', case when (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'avatars %') = 4 then 'ok' else 'WRONG COUNT' end;
