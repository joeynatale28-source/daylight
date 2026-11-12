-- Round 19 (Fix 66): attachments are removed. Nothing is deleted here that holds data: the bucket was verified empty
-- and no event in any workspace snapshot carried an attachment before this ran.
drop function if exists public.mcp_attachment_tool(text, jsonb);
drop policy if exists "event attachments read" on storage.objects;
drop policy if exists "event attachments upload own folder" on storage.objects;
drop policy if exists "event attachments update own folder" on storage.objects;
drop policy if exists "event attachments delete own folder" on storage.objects;
drop function if exists public.daylight_can_see_event_attachment(text, text, uuid);
-- The empty 'event-attachments' bucket itself was removed through the Storage API (direct deletes from storage.buckets are blocked).
