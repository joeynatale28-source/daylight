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

To use password-reset emails:
1. In Supabase → Authentication → URL Configuration, set the Site URL to the actual HTTPS site URL.
2. Add the exact deployment URL (including its path) to the Redirect URLs allowlist; for GitHub Pages, it is normally `https://joeynatale28-source.github.io/daylight/` if Pages is enabled. Add `http://localhost:8000/` when testing locally.
3. Configure an SMTP provider for reliable production email delivery. The built-in service has rate limits.
4. Disable public sign-ups under Authentication → Providers if accounts are owner-invited only (hide the form alone is not enough).
5. Consider turning on leaked-password protection (Supabase security advisor identifies it as disabled).

## Data behavior

- On sign-in, the app reads the authenticated user's existing workspace before showing events or tasks.
- Calendar and task changes, edits and settings save to Supabase after a short debounce.
- Each save uses an incrementing `revision` and a conditional update, so cross-device conflicts don't silently overwrite newer cloud data. Reload to review conflicts.
- The initial sample UI events/tasks are cleared before the cloud workspace loads. A new account starts with empty events/tasks and default calendars.
- A failed cloud read leaves the calendar locked instead of showing unrelated local/demo data.
- A deleted calendar or task is persisted in the workspace JSON, not propagated to the separate legacy `dl_*` table set.
- The reset-data button clears your current user data; it no longer restores example events.

**Caution:** This is snapshot-based synchronization, not a collaborative event-by-event sync engine. Large accounts and simultaneous multi-device edits will eventually warrant normalized Supabase tables and row-level mutations. Existing `dl_*` tables remain untouched.

## Run locally

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000/`. To host with GitHub Pages, enable Pages in the repository settings or configure a deployment workflow. Pages deployment is **not** automatically enabled by adding these files; private repository hosting is plan-dependent.

## Quick checks

1. Sign in with a **real** confirmed Supabase Auth email/password; a wrong password must fail.
2. Create an event and a task, wait for “Saved to cloud”, reload, and verify they return.
3. Sign out and verify the app is hidden. Sign in again and verify the same content loads.
4. Try another user's account: the first user's events must not be visible.
5. Request a password reset; follow the emailed link back to the configured deployment URL, set a new password, and sign in.
6. Open two sessions, edit the same workspace concurrently, and verify conflict warnings prevent silent overwrites.
