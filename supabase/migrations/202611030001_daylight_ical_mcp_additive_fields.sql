-- Additive Daylight iCal and MCP schema, applied to project qrqemjgpzoqhtmsowmqv.
ALTER TABLE public.calendars ADD COLUMN IF NOT EXISTS share_feed_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.calendars ADD COLUMN IF NOT EXISTS share_token_prefix text;
ALTER TABLE public.calendars ADD COLUMN IF NOT EXISTS share_token_hash text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS uid text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS sequence integer NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS dtstamp timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS exdates jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_id timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'teal';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cached_events jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cache_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS etag text;
ALTER TABLE public.mcp_tokens ADD COLUMN IF NOT EXISTS token_prefix text;
ALTER TABLE public.mcp_tokens ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT array['read']::text[];
ALTER TABLE public.mcp_audit_log ADD COLUMN IF NOT EXISTS token_name text;
ALTER TABLE public.mcp_audit_log ADD COLUMN IF NOT EXISTS summary text;
CREATE INDEX IF NOT EXISTS daylight_share_prefix_idx ON public.calendars (share_token_prefix) WHERE share_feed_enabled = true;
CREATE INDEX IF NOT EXISTS daylight_subscription_user_idx ON public.subscriptions(user_id,last_fetched_at);
CREATE UNIQUE INDEX IF NOT EXISTS daylight_event_uid_owner_unique ON public.events(user_id,uid) WHERE uid IS NOT NULL;
CREATE OR REPLACE FUNCTION public.daylight_event_update_version() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF row(new.title,new.description,new.location,new.starts_at,new.ends_at,new.all_day,new.rrule,new.status,new.exdates,new.recurrence_id)
   IS DISTINCT FROM row(old.title,old.description,old.location,old.starts_at,old.ends_at,old.all_day,old.rrule,old.status,old.exdates,old.recurrence_id)
 THEN new.sequence:=old.sequence+1; new.dtstamp:=now(); END IF;
 new.updated_at:=now(); RETURN new;
END $$;
DROP TRIGGER IF EXISTS daylight_event_update_version ON public.events;
CREATE TRIGGER daylight_event_update_version BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.daylight_event_update_version();
REVOKE ALL ON FUNCTION public.daylight_event_update_version() FROM public,anon,authenticated;
