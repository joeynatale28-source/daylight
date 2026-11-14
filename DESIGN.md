# Daylight design system

One site, one repo. The landing page (`/`), sign-in (`/login`), create account (`/sign-up`) and the app (`/dashboard`) share one design language, and the landing page is built from the app's sign-in screen. This file records that study and the tokens. Source of truth for the app's own tokens: `dashboard/app.css` (`--auth-*` for the sign-in screen). Source of truth for the landing page: `site/landing.css`.

## 1. The reference: the sign-in screen (measured, not remembered)

Measured on the real page at 1440 × 900 (`/login`, both themes).

**What makes it look good, named plainly**
- It is quiet. One typeface, two weights doing the work, no decoration that is not carrying meaning.
- Everything is a pill (999px radius): fields, the primary button, the Google and passkey buttons, the theme button. Softness comes from radius and tone, not from borders and shadows.
- Black and white only. The only color on the whole screen is the Google glyph. Hierarchy comes from size, weight and gray steps (text, muted, faint).
- Generous, even whitespace. Each group breathes; nothing is crowded and nothing floats loose.
- Large tight headline over small calm labels. The 40px headline is the only loud thing.

**Type**
- Family: Inter, then `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (the app's `--font`).
- Headline ("Sign in"): 40px, weight 600, letter-spacing -0.03em (-1.2px), line-height 1.08.
- Wordmark: 16px, weight 800, letter-spacing -0.02em.
- Primary button: 15.5px / 600. Social buttons: 14.5px / 500. Field label: 10.5px / 500. Divider "OR": 11px. Footer line: 13.5px.

**Spacing and sizes**
- Logo mark: 34px in the top bar, 44px above the headline. Top bar content sits 22px from the top, 28px from the left.
- Form column: 400px wide, vertically centered. Mark → headline 24px; headline → first field 36px; fields 64px tall with 19px between; field group → primary button 8px; primary button 50px tall; divider 24px below; social buttons 50px tall, 9px apart.
- Panel split 45% / 55% with a 1px hairline between them.

**Logo**: the sun-arc mark, black on light, white on dark, always next to the "Daylight" wordmark in the top bar.

**Tokens (the app's own)**

| Token | Light | Dark |
|---|---|---|
| background | #ffffff | #121212 |
| surface / field | #f5f5f5 | #282828 |
| card | #ffffff | #1e1e1e |
| text | #171717 | #e0e0e0 |
| muted | #737373 | #a0a0a0 |
| faint | #a3a3a3 | #757575 |
| hairline | #e5e5e5 | #2c2c2c |
| ghost border | #d4d4d4 | #333333 |
| primary pill | #171717 on #ffffff | #e0e0e0 on #121212 |

## 2. Where the brief and the login screen disagree: the login screen wins

| Brief said | The login screen has | Used |
|---|---|---|
| Dark #0A0A0A, text #FFFFFF | dark #121212, text #e0e0e0 | #121212 / #e0e0e0 (the app's black and white) |
| Display weight 700 | headline weight 600 | 600, same tracking (-0.03em) |
| Wordmark 17px/600, mark 28px | 16px/800, mark 34px | 16px/800, 34px |
| Buttons 48px tall | 50px tall | 50px (nav button 38px) |
| Dark raised surface #1A1A1A, surface #141414 | card #1e1e1e, field #282828 | #1e1e1e / #282828 |
| Ghost button border rgba(255,255,255,.2) | #333 | #333 on the dark hero |

Everything else in the brief (type scale clamps, 8px spacing, hero gaps, motion system) is used as written.

## 3. Landing page tokens (`site/landing.css`)

- Type: Display `clamp(48px, 7vw, 80px)` / 1.05 / -0.03em / 600. H2 (later sections) `clamp(32px, 4vw, 48px)` / 1.1 / -0.02em / 700. H3 20px / 1.3 / 600. Eyebrow 13px / 600 / 0.12em, uppercase. Body 17px / 1.6. Small 15px / 1.5. Buttons 15px / 600.
- Theme: follows the operating system through `prefers-color-scheme` in CSS only (no script, so no flash). Light: white nav bar, dark hero. Dark: #181818 nav bar, dark hero. The hero is dark in both, using the app's dark tokens. Colors crossfade for 200ms if the OS theme flips while the page is open.
- Container 1120px, 24px side padding (20px at 768px, 16px at 480px). 8px spacing base.
- Hero rhythm (measured, tested): announcement pill → headline 24px; headline → subcopy 16px; subcopy → buttons 40px; buttons → trust line 24px; trust line → frame 80px.
- Radii: pills and buttons 999px; product frame 12px. Frame shadow `0 24px 64px rgba(0,0,0,.18)`. No other shadows except the scrolled nav pill.
- No blue links. No colored icons (all `currentColor`). No gradients except the faint white glow and grid on the dark hero.

## 4. Nav

- 54px tall, same as the app's header. Fixed. At rest it is a real bar: its own background plus a 1px hairline.
- Past 8px of scroll it condenses into a floating frosted pill: `rgba(24,24,24,.88)`, `blur(12px) saturate(180%)`, full radius, soft shadow, no outline.
- One button, "Open Daylight", linking to `login/`. No "Log in", no divider, no login detection.
- Links (Features, Sharing, AI access, FAQ) are anchors to `#features`, `#sharing`, `#ai`, `#faq`. Those sections are built in later slices; the anchors are in place and resolve once the sections exist.
- Under 768px: hamburger that turns into ×, full-width panel with staggered links and the one button.

## 5. Hero

Dark, with a faint grid and a soft white glow (no large sun-arc graphic). Centered announcement pill ("Now with AI access", a real shipped feature), headline "Your calendar, minus the clutter.", one line of subcopy, **Get started** (to `sign-up/`) and **See how it works** (to `#features`), the trust line, then the product frame. The frame is browser chrome around a labeled placeholder; its screen area is exactly 8:5 (1600 × 1000) so a real screenshot drops in without changing layout. The frame fades to the page color at its bottom edge. No screenshots were captured for this slice.

## 6. Motion

- Easing `cubic-bezier(0.16, 1, 0.3, 1)` for entrances; `ease-out` for hovers. No bounce, spring or overshoot. Nothing longer than 400ms. Staggers 40 to 80ms.
- transform and opacity only (the nav pill also eases its width and radius, by design). `will-change` is set only while parallax is active.
- Entrance (about 640ms total): pill, then headline words 60ms apart, then subcopy, buttons, trust line, and the frame (fade + rise + scale 0.98 to 1).
- Hovers lift 1px and brighten; press scales to 0.98.
- Parallax (frame 0.3x capped at 40px, grid 0.1x) and the cursor glow (400px, 6%, lerped 0.15) run only with a fine pointer, above 768px, and with motion allowed.
- Reduced motion: everything is simply visible, nothing moves.
