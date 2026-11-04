# daylight.

Daylight is a single-page calendar with Month, Week, Day, Agenda and Tasks views, custom calendars, settings, and a built-in US Holidays calendar.

## Application files

- `index.html`: current app. The visual design is preserved from the standalone preview.
- `daylight-cloud.js`: real Supabase Auth + cloud workspace synchronization.
- `daylight-calendar-ui-preview.html`: archived original UI preview (demo-only, **not** the live authenticated application).

Serve `index.html` over HTTPS (or localhost). Do **not** use `file://`, which cannot be trusted for password reset redirects. The Supabase JavaScript client is loaded from a pinned CDN version. There is no build step.

## Supabase configuration

Existing Supabase project: **Daylight** (`qrqemjgpzoqhtmsowmqv`).

The new application uses Supabase email/password authentication through `auth.signInWithPassword()`. Sessions refresh and persist in the browser. No sign-up page is exposed; create/enable accounts via **Supabase Dashboard → Authentication → Users**. Supabase's `workspace_snapshots` table stores each signed-in user's complete UI data as JSONB, keyed to the account's `auth.uid()`. Existing snapshots are read and carried forward without deleting the legacy rows or any other app tables.

The existing RLS owner policy protects `workspace_snapshots`. The browser receives only the **publishable** API key. Never place a Supabase secret key, service-role key, admin credentials, or an OAuth client secret into this repository.

To use password-reset emails:\n1. In Supabase → Authentication → URL Configuration, set the Site URL to `https://joeynatale28-source.github.io/daylight/`.\n2. Add the exact same URL to the Redirect URLs allowlist. Add any local development URLs separately as needed.\n3. Configure an SMTP provider for reliable production email delivery (Supabase default emails are rate-limited).\n4. If accounts are owner-invited only, disable public sign-ups in Supabase Auth providers/settings.\n5. Consider enabling leaked-password protection (the security advisor currently warns that it is disabled).\n\n## Data behavior

- On sign-in, the app reads the authenticated user's existing workspace before showing events or tasks.
- Calendar and task changes, edits and settings save to Supabase after a short debounce.
- Each save uses an incrementing `revision` and a conditional update, so cross-device conflicts don't silently overwrite newer cloud data. Reload to review conflicts.
- The initial sample UI events/tasks are cleared before the cloud workspace loads. A new account starts with empty events/tasks and default calendars.
- A failed cloud read leaves the calendar locked instead of showing unrelated local/demo data.
- A deleted calendar or task is persisted in the workspace JSON, not propagated to the separate legacy `dl_*` table set.
- The legacy demo-reset control is disabled for cloud accounts to protect saved data.

**Caution:** This is snapshot-based synchronization, not a collaborative event-by-event sync engine. Large accounts and simultaneous multi-device edits will eventually warrant normalized Supabase tables and row-level mutations. Existing `dl_*` tables remain untouched.

## GitHub Pages deployment\n\nThe intended production site is `https://joeynatale28-source.github.io/daylight/`. The `.github/workflows/deploy-pages.yml` workflow publishes `index.html`, `daylight-cloud.js`, `daylight-settings.js`, `daylight-integrations.js`, `daylight-places.js`, and `daylight-places.css` when `main` changes, or when run manually from GitHub Actions.\n\n**One-time repository setup:** GitHub → `daylight` → Settings → Pages → under Build and deployment, choose **GitHub Actions** as the Source. The workflow cannot turn Pages on using the default `GITHUB_TOKEN`. For a private repository, GitHub Pro or another eligible GitHub plan is required; on GitHub Free, this repository would need to be made public before GitHub Pages is available. Published Pages sites are publicly accessible even when the underlying repository is private.\n\nAfter enabling Pages, run the `Deploy Daylight to GitHub Pages` workflow from the Actions tab if the initial push did not trigger a run. Check the Actions run and the Pages Settings page to confirm it is published; do not consider it live until those checks pass.\n\nFor local development:\n\n```sh\npython3 -m http.server 8000\n```\n\nOpen `http://localhost:8000/`. Password-reset redirects for localhost must be separately allowlisted in Supabase.\n\n## Manual verification checklist\n\n1. Sign in with an **existing confirmed** Supabase Auth account, and verify a wrong password fails.\n2. Create an event and a task, wait for the save debounce, reload, and verify both return. Saving is deliberately silent.\n3. Sign out and verify the app disappears. Sign in again and verify the saved content returns.\n4. Check with a separate account that another user’s events do not appear.\n5. Request a password reset, follow the email link back to the Pages URL, update the password, then sign in.\n6. Open two browser sessions, edit the same data concurrently, and verify a sync conflict is surfaced rather than silently overwriting another edit.\n
## Next step — iCal sharing, subscriptions, import/export, and MCP

This functionality is integrated into the live app. The existing single-file UI is preserved in index.html, with additive modules for authenticated backend integrations and OSM location autocomplete.

### iCal share feeds
Own-calendar menu → Share calendar uses the deployed ical-feed Edge Function.
It creates a 40-byte random URL-safe token, stores only SHA-256 and an
eight-character prefix in Supabase, and reveals the full HTTPS/webcal URLs
once. Reset revokes the old URL; disable makes the feed unavailable. The
US Holidays built-in calendar has no sharing controls. The serializer is
ical-generator. Timed events use UTC timestamps; all-day events use DATE
ranges with an exclusive end. ETag and Last-Modified support conditional
downloads. Source data currently comes from the user's revisioned
workspace_snapshots JSONB, NOT from the separate empty normalized tables.

### Subscriptions and imports
Settings → Data & sync adds external HTTPS or webcal subscriptions via the
deployed ical-subscribe function and ical.js. Parsed occurrences are stored
as subscriptions.cached_events JSONB and presented only as read-only UI
events. Errors preserve the last good cached copy; manual refreshes within
three hours use the existing cache. An automatic periodic refresh worker is not configured; manual Refresh now bypasses the normal three-hour cache window.

The deployed ical-import Edge Function authenticates the owner, validates
an ICS file, deduplicates by UID + recurrence ID, and performs a revision
checked workspace write. The UI reloads after import to avoid overwriting
the new revision. .ics export uses the same serializer as sharing.

### MCP
Settings → AI access creates/revokes scoped 32-byte random MCP tokens; only
their SHA-256 digests are stored. Tokens are shown once. The separate Node
MCP package uses the official @modelcontextprotocol/sdk over stateless
Streamable HTTP and requires the bearer token for every request. Every tool
reads only the token's owning workspace. The delete_event tool requires a
write-scoped token **and** mcp_allow_delete=true. Atomic deletion and audit
are implemented by a service-role-only Postgres function.

The Node service is NOT yet deployed to a public HTTPS URL. Use a Node
hosting environment such as Render or Fly.io behind TLS, not GitHub Pages.

Run locally from the mcp/ directory:

    npm install
    export SUPABASE_URL=YOUR_PROJECT_URL
    export SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_KEY
    npm run typecheck
    npm run start

The service listens on http://localhost:8787/mcp by default.
For client tests set DAYLIGHT_MCP_PUBLIC_URL, SMOKE_USER_ID and
SMOKE_CALENDAR_ID (use a disposable calendar), then run npm run smoke.
Set optional SMOKE_SECOND_USER_ID for the cross-account isolation test.
The smoke script makes disposable tokens and exercises real MCP SDK
client connectivity, write and read scopes, task edits, account-wide
deletion denial, audit logging and token revocation.

The AI access UI currently lists the pre-existing Supabase daylight-mcp Edge Function URL while the new Node server has no deployed HTTPS URL. The older endpoint accepts manually created tokens and implements the documented read/write tools; the separate Node implementation is not live. Update the configuration snippet when Node hosting is set up.

### Remaining verification / phase 2
Before merge, verify imported events, timezone conversions, DST transitions,
multi-day ranges, RRULE/EXDATE/RECURRENCE-ID moved instances, repeated
imports, public-feed subscriptions, Apple and Google Calendar subscriptions,
calendar visibility animations and reduced motion in a browser, and a real
MCP Inspector connection. These cannot be claimed as completed merely from
a successful database migration.

The UI still uses a basic native repeat field and cannot natively edit all
complex imported recurrence exceptions; future work should add a shared
RFC5545 recurrence model, extract shared UI/MCP validation, run regression
tests, and migrate snapshots to normalized Postgres event rows when safe.

## November 2026 UI completion

**The visual design is unchanged.** In the sidebar, the Subscribe and share
calendars section shows read-only subscription rows with source host,
last-update date, status and a management menu. Its + button opens
Settings → Data & sync. Add a URL to preview the calendar name and number
of events before choosing a color and saving. Subscription menus offer
Refresh now, Rename, Change color and Unsubscribe with confirmation.

On an owned calendar, **Share…** generates a private, read-only iCal feed.
The full HTTPS and webcal links appear **once**, immediately after enabling
or resetting. The reopened dialog displays only the token prefix and explains
why the original link cannot be recovered. Reset and Disable require
confirmation. The calendar menu offers **Export .ics**; an owned event's menu
also exports that event alone. Import results are shown after the workspace
reload as **X added, Y updated, Z skipped**.

**Settings → AI access** has a copyable MCP URL and configuration, token
name/read-write scope switches, a one-time token reveal dialog, a revocable
token list, a delete-permission confirmation switch and an audit history.
Only SHA-256 token hashes are stored. The audit panel includes both the
original deployed Edge Function's audit table and the standalone Node
implementation's audit table. If you lose a token, revoke and replace it.
Deletion remains disabled by default even when a token has write permission.

### Location autocomplete — OpenStreetMap / Photon

Event creation and editing uses the `places` Supabase Edge Function.
The function validates the logged-in user's Supabase JWT before proxying
queries to the public `photon.komoot.io` demo API. **No Google Places,
Maps API key, or client-side geocoding credential is involved.**
The browser calls only Supabase, and sends the user's typed query after a
210 ms debounce starting at two characters. Suggestions offer mouse and
arrow-key / Enter selection and show the required OpenStreetMap attribution.
Selecting a result commits the full Photon formatted address, its latitude,
longitude, and an `osm:` reference. Editing the text clears those fields;
free-text locations are always permitted, and errors degrade silently.
Resolved coordinates become an OpenStreetMap link in event details.
The cloud snapshot saves `placeId`, `locationLat` and `locationLng`.
The normalized events table has nullable location columns for later migration.
iCal feeds and exports emit `LOCATION` plus `GEO` for resolved coordinates;
imports can restore `GEO` as latitude/longitude.

The public Photon endpoint is a community demo with **no availability
guarantees**. It imposes reasonable-use limits; the Edge Function restricts
requests by user and caches briefly. For high production volume, self-host
Photon or negotiate a dedicated provider. See
https://github.com/komoot/photon for usage notes.

### UI and testing

The Documentation menu link and persistent `Saved to cloud` pill are
removed; cloud persistence remains active. Overlays share a quick ease-out
motion, respect browser reduced-motion and Daylight's Reduce Motion setting,
and do not delay the next interaction.

GitHub Actions checks the HTML's embedded JavaScript, module syntax,
MCP TypeScript types, scripted mouse/keyboard location selection,
free-text fallback, absence of address-search secrets in client code,
and a no-JWT `places` request returning HTTP 401.

Live sign-in tests, Apple/Google iCalendar clients, MCP Inspector,
two-user account isolation, and screenshot evidence for authenticated
settings in both themes require separate test accounts and were not
established by these automated checks. Do not claim those tests passed.
