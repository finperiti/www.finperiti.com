# Design system: analysis of Finperiti.Web.V2

This is the reference analysis done before building. The V2 project (`Finperiti.Web.V2`) is the source of truth for design. Its token, base, component and section stylesheets are reused **unchanged** in `src/public/assets/css/` (apart from two small additions to `base.css`: the `.sprite` helper and the form focus ring). Everything new lives in `pages.css` and only uses V2 tokens.

## 1. Technology and architecture of the reference

| Aspect | V2 reference | This project |
|---|---|---|
| Stack | Static HTML + CSS + vanilla JS, no framework, no runtime dependencies | Same |
| Pages | 1 landing page | 6 pages + 404, built from shared partials |
| CSS | `tokens.css` → `base.css` → `components.css` → `sections.css` (+ `dashboard.css`) | Same four files reused, plus `fonts.css` and `pages.css` |
| JS | `main.js` (nav, reveal, dot fields, globe, timeline), `config.js` | `main.js` adapted for multiple pages, `config.js` (boot flag), `contact.js` |
| Serving | nginx-unprivileged on :8080, CSP, `serve.mjs` dev server | Same approach, plus clean URLs and a GitHub Pages workflow |

## 2. Typography

- **Families:** Manrope for all text. JetBrains Mono for eyebrows, labels, step numbers and figures.
- **Fonts are self-hosted:** V2 loaded them from Google Fonts. Here they are variable woff2 files in `/assets/fonts/`, the same Manrope file the live site serves, so there are no third-party requests.
- **Scale:**

| Token | Value |
|---|---|
| `--fp-fs-hero` | 40→68px (desktop hero: `clamp(2.5rem, 3.6vw, 3.375rem)`) |
| `--fp-fs-h2` | 30→44px |
| `--fp-fs-h3` | 18→22px |
| `--fp-fs-lead` | 17→19px |
| Body | 16px |
| `sm` / `xs` / `2xs` | 14 / 12 / 11px |

- **Weights:** 800 for headings, 700 for buttons and card titles, 600 for nav and labels, 400 for body.
- **Line height:** 1.04 (hero), 1.12 (h2), 1.6 (body).
- **Letter spacing:** −0.035em (hero), −0.025em (h2), +0.14em uppercase for mono eyebrows.

## 3. Colour palette

All colours are defined once in `tokens.css`.

| Role | Token / value |
|---|---|
| Primary (brand) | Petrol `#0E4F5E` |
| Accent | Jewel Teal `#0E9F90`, Bright Teal `#5DE6D2` (dark surfaces only), Turquoise `#3EE3D3` (primary CTA on dark) |
| Dark surfaces | Ocean `#003943`, Midnight `#002B36`, Abyss `#001F27` (footer) |
| Light surfaces | White, off-white `#F6F9FA`, tint `#ECF7F5`, mist `#EAF0F1` |
| Text | `#102B38` / `#4F6670` / `#5F747D`; on dark `#FFF` / `#BCD5D9` / `#8FB0B6` |
| Borders | `#DFEAED`, strong `#C9DADF`; on dark `rgba(255,255,255,.11)` |
| Status | ok `#1C7A5B`, info `#08707F`, warn `#9A5A1C`, risk `#B8323D`, violet `#5A50C0` (each with a pale background) |
| Gradients | `--fp-grad-hero`, `--fp-grad-dark`, `--fp-grad-accent` (gradient text), `--fp-grad-brand` |

## 4. Header

- **Position and height:** fixed and transparent over the dark hero. 76px tall, shrinking to 66px once the page scrolls more than 24px.
- **Scrolled state:** `rgba(0,43,54,.93)` background with a 14px backdrop blur.
- **Logo:** white-wordmark PNG, 150px wide (128px when scrolled, 132px under 520px).
- **Links:** centred (`margin-inline:auto`), pill hover, 15px/600, colour `--fp-on-dark-2`. The active link gets a 16×2px Bright Teal underline.
- **Action:** a turquoise pill button (`btn--sm`, 42px) on the right.
- **Under 1080px:** the links are replaced by a 44px menu toggle. The menu drops down in Midnight with 1px dividers and a full-width CTA, and closes on Escape, a link click or a resize.

## 5. Layout

- **Container:** max 1280px plus fluid gutters (`clamp(16px, 4vw, 40px)`).
- **Section padding:** `clamp(72px, …, 128px)`.
- **Section heads:** centred, title max 22ch, lead max 62ch. The gap below the head is 40–64px.
- **Grids:** 4 → 2 → 1 columns for features, with a 20px gap. Hero is 1fr / 1.04fr. How it works is 0.9fr / 1.1fr with a sticky intro. Pricing has 3 columns.
- **Spacing scale:** 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96).
- **Radii:** 6, 10, 14, 20, 28 and pill.

## 6. Components (reused from V2)

- **Buttons:** pill shape, 48px tall (`sm` 42, `lg` 54).
  - Primary is turquoise with Ink text on dark backgrounds, and Petrol with white text inside `.section` light areas.
  - Other variants: ghost-light, outline, dark.
  - Hover: lifts 2px, adds a glow and nudges the arrow 3px.
- **Feature card:** white, 20px radius, 1px border. A 52px tinted icon tile uses `--accent` and `--accent-bg`. On hover the card lifts 6px and shows a top accent bar.
- **Timeline:** numbered nodes with an animated gradient connector and icon tiles.
- **Security panel:** dark gradient, 28px radius, glass sub-cards and a canvas dotted globe.
- **Price card:** featured variant with a jewel border, mono flag and halo. Other parts: check list, mono "includes" label and an enterprise top bar.
- **Value strip:** columns with vertical dividers and 44px icon tiles.
- **Final CTA:** hero gradient with a logo-inspired dot arc.
- **Footer:** Abyss background, mono Bright Teal headings, 1.6fr plus three columns.
- **Badges, eyebrows, link-arrow, check-list, ticks, deco-dots, float-cards:** all reused as they are.

## 7. New components built in the same language (`pages.css`)

| Component | Built from |
|---|---|
| Inner-page hero (`.page-hero`) | V2 hero background, waves, dots and glow, at a shorter height |
| Product window (`.app-window--image`) | V2 window chrome and 3D tilt, wrapping the real product screenshot from the live site |
| Trust strip | `value-strip` variant |
| Deadline pill and stat cards | Mono pill plus `feature-card` |
| Testimonial card | Light tint card with deco dots, mono attribution with rules |
| Why Us (stacked security panel) | Security panel with a 3×2 item grid |
| Team card and detailed team card | `feature-card` styling |
| Core plan with data-infrastructure panel | Price card plus security panel; tick list on dark |
| Add-on card | `feature-card` with partner logo and "Best for" footer |
| Contact form card | Fields: 50px tall, 1.5px border, 10px radius, petrol focus ring; error and success states use the status tokens |
| Legal layout | Sticky document nav plus prose styles |
| 404 hero | Hero background with a large mono gradient "404" |

## 8. Interactions and motion

- **Scroll reveal:** fade and 18px rise (700ms, `cubic-bezier(.22,1,.36,1)`), staggered 90ms across siblings.
- **Hover and press:** cards lift, buttons glow and the arrow nudges.
- **Hero visuals:** float cards bob on a 7s loop; the dot fields drift on a 28s loop.
- **Globe:** rotates at about 30fps and pauses when off-screen.
- **Timeline:** fills as you scroll.
- **Reduced motion:** `prefers-reduced-motion` disables all of the above.
- **No JavaScript:** the page renders fully, because reveal only applies once the `.js` class is set.
- **Focus:** visible on every element, with a 2px white + 4px petrol ring (a bright-teal variant on dark surfaces).
