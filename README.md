# daylight

A calendar app — Month / Week / Day / Agenda views, tasks, multiple calendars,
a built-in rule-based US Holidays calendar, and full settings (themes, time
zones, working hours, density, and more).

## Current state

`daylight-calendar-ui-preview.html` is the current verified build as a single
self-contained file — all event banner images are inlined, so it runs as-is
with no other files. Open it in a browser, or rename it to `index.html` when
wiring it into a host.

- The sign-in is a demo front end: any valid-format email + password works.
  Forgot-password demo code: `428571`.
- Sample data (events, calendars, tasks) lives in the page for now — this is
  the UI build, ready to be connected to a real backend.

## Next step

Connect Supabase Auth (email + password) and move events / calendars / tasks
into Supabase tables. Nothing here is published to GitHub Pages.
