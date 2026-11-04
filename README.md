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

## GitHub Pages deployment\n\nThe intended production site is `https://joeynatale28-source.github.io/daylight/`. The `.github/workflows/deploy-pages.yml` workflow publishes only `index.html` and `daylight-cloud.js` when `main` changes, or when run manually from GitHub Actions.\n\n**One-time repository setup:** GitHub → `daylight` → Settings → Pages → under Build and deployment, choose **GitHub Actions** as the Source. The workflow cannot turn Pages on using the default `GITHUB_TOKEN`. For a private repository, GitHub Pro or another eligible GitHub plan is required; on GitHub Free, this repository would need to be made public before GitHub Pages is available. Published Pages sites are publicly accessible even when the underlying repository is private.\n\nAfter enabling Pages, run the `Deploy Daylight to GitHub Pages` workflow from the Actions tab if the initial push did not trigger a run. Check the Actions run and the Pages Settings page to confirm it is published; do not consider it live until those checks pass.\n\nFor local development:\n\n```sh\npython3 -m http.server 8000\n```\n\nOpen `http://localhost:8000/`. Password-reset redirects for localhost must be separately allowlisted in Supabase.\n\n## Manual verification checklist\n\n1. Sign in with an **existing confirmed** Supabase Auth account, and verify a wrong password fails.\n2. Create an event and a task, wait for the “Saved to cloud” indicator, reload, and verify both return.\n3. Sign out and verify the app disappears. Sign in again and verify the saved content returns.\n4. Check with a separate account that another user’s events do not appear.\n5. Request a password reset, follow the email link back to the Pages URL, update the password, then sign in.\n6. Open two browser sessions, edit the same data concurrently, and verify a sync conflict is surfaced rather than silently overwriting another edit.\n