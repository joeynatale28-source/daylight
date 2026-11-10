-- Round 13 (Fix 10): photo attachments on events.
-- Photos live in a PRIVATE Storage bucket (never inside the event row). Path: <owner id>/<event id>/<file>.
-- The event keeps only a small list of references ({path, name, type, size}) in its workspace JSON.
-- Who can read a photo: its owner, and any account that can already see that event's details (an accepted event share
-- for that event, or an accepted calendar share for the calendar the event is on). Only the owner can add, change or delete.
-- Additive: new bucket, one helper function, four policies on storage.objects named for this bucket only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-attachments', 'event-attachments', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.daylight_can_see_event_attachment(p_owner_text text, p_event text, p_viewer uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_viewer is not null and p_owner_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and (
    p_owner_text = p_viewer::text
    or exists (
      select 1 from public.daylight_event_shares s
      where s.owner_id::text = p_owner_text and s.recipient_id = p_viewer and s.status = 'accepted'
        and s.event_id::text = p_event)
    or exists (
      select 1
      from public.workspace_snapshots w,
           jsonb_array_elements(coalesce(w.payload -> 'events', '[]'::jsonb)) e,
           public.daylight_calendar_shares cs
      where w.user_id::text = p_owner_text and e ->> 'id' = p_event
        and cs.owner_id::text = p_owner_text and cs.recipient_id = p_viewer and cs.status = 'accepted'
        and cs.calendar_id = e ->> 'cal')
  )
$$;
revoke all on function public.daylight_can_see_event_attachment(text, text, uuid) from public, anon;
grant execute on function public.daylight_can_see_event_attachment(text, text, uuid) to authenticated;

drop policy if exists "event attachments read" on storage.objects;
create policy "event attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'event-attachments'
         and public.daylight_can_see_event_attachment((storage.foldername(name))[1], (storage.foldername(name))[2], (select auth.uid())));

drop policy if exists "event attachments upload own folder" on storage.objects;
create policy "event attachments upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-attachments' and (storage.foldername(name))[1] = ((select auth.uid()))::text);

drop policy if exists "event attachments update own folder" on storage.objects;
create policy "event attachments update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'event-attachments' and (storage.foldername(name))[1] = ((select auth.uid()))::text)
  with check (bucket_id = 'event-attachments' and (storage.foldername(name))[1] = ((select auth.uid()))::text);

drop policy if exists "event attachments delete own folder" on storage.objects;
create policy "event attachments delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'event-attachments' and (storage.foldername(name))[1] = ((select auth.uid()))::text);
