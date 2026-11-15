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

The whole site now looks like the sign-in screen: it uses the app's tokens in both themes and nothing is forced dark.

- Theme: follows the operating system through `prefers-color-scheme` in CSS only (no script, so no flash). Light is white with #171717 text and #f5f5f5 soft surfaces; dark is #121212 with #e0e0e0 text and #282828 surfaces. Hairlines #e5e5e5 / #2c2c2c. Colors crossfade for 200ms if the OS theme flips while the page is open.
- Type (the sign-in screen's): Inter, headline weight 600 with -0.03em tracking. Hero headline `clamp(36px, 4.4vw, 56px)`; section H2 `clamp(32px, 4vw, 48px)`, 700, one italic word per headline; eyebrow 13px / 600 / 0.12em; body 17px; buttons 15px / 600.
- Shapes (the sign-in screen's): everything is a pill. Buttons are 50px tall with full radius; the announcement chip and feature chips are pills; cards (CTA, footer) are 28px rounded and soft; product windows 20px.
- Container 1120px, 24px side padding (20px at 768px, 16px at 480px). 8px spacing base.
- No blue links. No colored icons (all `currentColor`). No gradients or glows.

## 4. Nav

- 54px tall, same as the app's header. Fixed. At rest it is a real bar: its own background plus a 1px hairline.
- Past 8px of scroll it condenses into a floating frosted pill: `rgba(24,24,24,.88)`, `blur(12px) saturate(180%)`, full radius, soft shadow, no outline.
- One button, "Open Daylight", linking to `login/`. No "Log in", no divider, no login detection.
- Links (Features, Sharing, AI access, FAQ) are anchors to `#features`, `#sharing`, `#ai`, `#faq`. Those sections are built in later slices; the anchors are in place and resolve once the sections exist.
- Under 768px: hamburger that turns into ×, full-width panel with staggered links and the one button.

## 5. Hero (Profound's hero structure, Daylight's content and the sign-in look)

Top to bottom, as on Profound: the nav bar; an announcement strip as its own full-width band with hairlines above and below (a chip, one line, an arrow); a centered two-line headline whose second line carries an inline mark and a rotating last word ("Your calendar, minus the" / mark + clutter, noise, chaos, mess); one subcopy line; two buttons side by side (solid and soft); a trust line; then the product window directly below, fading out at its bottom edge. The product window is browser chrome around a labeled placeholder whose screen is exactly 8:5 (1600 × 1000). No screenshots were captured. Rhythm: strip to headline 112px, headline to subcopy 16px, subcopy to buttons 32px, buttons to trust line 28px, trust line to window 64px.

## 6. Motion

- Easing `cubic-bezier(0.16, 1, 0.3, 1)` for entrances; `ease-out` for hovers. No bounce, spring or overshoot. Nothing longer than 400ms. Staggers 40 to 80ms.
- transform and opacity only (the nav pill also eases its width and radius, by design). `will-change` is set only while parallax is active.
- Entrance (about 600ms total): strip, then the two headline lines, subcopy, buttons, trust line, and the window (fade + rise + scale 0.98 to 1).
- Hovers lift 1px and brighten; press scales to 0.98.
- The headline word rotates every 2.6 seconds with a quick fade and rise (opacity and transform only).
- Reduced motion: everything is simply visible, nothing moves.
