# Daylight design system

One site, one repo. The landing page (`/`), sign-in (`/login`), create account (`/sign-up`) and the app (`/dashboard`) share one design language, and the landing page is built from the app's sign-in screen and uses real screenshots of the app. This file records that study and the tokens. Source of truth for the app's own tokens: `dashboard/app.css` (`--auth-*` for the sign-in screen). Source of truth for the landing page: `site/landing.css`.

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

## 3. Landing page (`index.html` + `site/landing.css` + `site/landing.js`)

The landing page and the legal pages (`privacy/`, `tos/`) share one stylesheet and one script. They were built on the sign-in screen's system and merged from the separate website build on November 15, 2026. The older Resend-structure build (November 14) is in git history. `site/landing.css` and `site/landing.js` must exist: the deploy workflow's preflight fails without them.

**Files**
- `index.html`: nav, hero, nine sections, footer. `privacy/index.html` and `tos/index.html`: same chrome, a contents list and one plain-language summary per section.
- `site/landing.css`: all landing and legal styles. `site/landing.js`: nav pill, mobile menu, rotating headline word, accordions, scroll reveals, back to top, reload-to-top.
- `assets/screenshots/`: 10 real screenshots of the app (`month`, `week`, `day`, `agenda`, `tasks`, `event`, `ai-access`, `sharing`, `theme-light`, `theme-dark`), used for every product visual. A schematic drawing sits behind each image as an on-error fallback.
- Every path is relative, because the site is served from a project subpath (`/daylight/`). "Open Daylight" links go to `login/`; the app decides signed in or out.

**Tokens**
- Theme follows the operating system through `prefers-color-scheme` in CSS only. Light: #ffffff, text #171717, soft surface #f5f5f5, hairline #e5e5e5. Dark: #121212, text #e0e0e0, surface #282828, hairline #2c2c2c. The two theme pictures always show their own theme.
- Type: Inter. Hero headline `clamp(36px, 4.4vw, 56px)` / 600; section H2 `clamp(32px, 4vw, 48px)` / 700 with one italic word; body 17px; buttons 15px / 600, 50px tall pills.
- Rhythm: one `--gap` of 96px between sections (64px under 768px). Container 1120px, 24px side padding.
- Shapes: pills for buttons and chips; 28px cards; 20px product frames. No gradients, glows or colored backgrounds.

**Nav and strip**
- A 42px announcement strip sits above the nav and scrolls away. The nav is a 54px bar at rest and a floating opaque-tinted pill past 8px of scroll.
- One button, "Open Daylight". Under 768px: a menu button and a full-width panel.

**Motion**
- Easing `cubic-bezier(0.16, 1, 0.3, 1)`. Reveals rise 8px over 250ms with a 40ms stagger, and content is visible by default. The headline word rotates every 2.6 seconds with a cross-fade. Reduced motion: nothing moves.
