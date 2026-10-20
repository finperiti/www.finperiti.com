# Content inventory, page map and limitations

**Content update (2026-10-17):** all copy now comes from the `finperiti-website-for-pablo` handover (new home page structure, new `/aml` and `/iq` product pages, two-product pricing with calculators, rewritten privacy notice and terms). The page table below describes the original 2026-10-14 rebuild; see the pages in `src/pages/` for the current structure.

**Original content source:** <https://www.finperiti.com/>, crawled on 2026-10-14. I fetched every page linked from the navigation, the footer and `sitemap.xml`. The live site is static HTML served by GitHub Pages (Fastly CDN), and the custom domain is `www.finperiti.com`.

**Fidelity check:** I extracted the visible text of every live page and compared it automatically with the rebuilt pages. Of 480 text fragments, 476 match exactly. The other four are:

- The ⚠ glyph, which is now an SVG icon. The text itself is unchanged.
- **Careers**, which was intentionally omitted (see Limitations).
- The two contact-form status messages. They are present in the page but hidden until the form is submitted, so the extraction didn't pick them up.

## Pages rebuilt

| Live URL | New file | Sections (in live order) |
|---|---|---|
| `/` | `src/pages/index.html` | Hero (eyebrow, H1, lead, *Book a Demo* and *See Pricing*, trust line, "Built natively for Microsoft 365", product screenshot that links to the full-size SVG) · Trust bar (Enterprise Ireland, Microsoft ISV, KYC by Veriff, Document Integrity by Binarii) · **#the-problem** (July 2026 deadline, 3 stat cards) · **#solution** (5 features) · **#how-it-works** (5 steps) · Testimonial UK · **#why-us** (6 advantages) · Testimonial Malta · **#pricing** (Core Platform €199/month + €299 setup, 6 features, 2 CTAs, Veriff/Binarii) · **#about** (6 team cards → `/about#name`) · **#waitlist** final CTA (2 buttons, 3 trust items) · home footer |
| `/about` | `src/pages/about.html` | Hero "Smarter Compliance. Less Chaos." · story (4 paragraphs + logo) · **#team** with **#fiona #richard #gordon #rachel #james #paul** (intro + bio) · CTA · footer |
| `/pricing` | `src/pages/pricing.html` | Hero · Core Platform (price, setup fee, 6 features) + "You control your Data Infrastructure" (3 points + highlight) · CTA · **#addons** (6 add-ons, Veriff/Binarii logos, "Coming soon") · **#configurations** (3 bundles, "Most popular") · CTA · footer |
| `/contact` | `src/pages/contact.html` | "Get in Touch" copy, email box, **contact form** (Name\*, Email\*, Company, Message\*, honeypot, Web3Forms) with success and error messages · CTA · footer |
| `/privacy-policy` | `src/pages/privacy-policy.html` | Full policy, 13 sections, "Last updated: July 2026" |
| `/terms-and-conditions` | `src/pages/terms-and-conditions.html` | Full terms, 13 sections, "Last updated: July 2026" |
| `/404` (GitHub Pages error page) | `src/pages/404.html` | "404 / Page Not Found", text, *Return to Home* |

**Preserved as on the live site:**

- **Titles and metadata:** every `<title>`, meta description, canonical URL, Open Graph and Twitter tags, and the Organization and WebPage JSON-LD on the home page.
- **Footers:** the home page keeps its own footer (Solution, How It Works, Pricing, Sign in · About & Team, Contact by `mailto` · Privacy and Terms opening in a new tab). Every other page keeps the shared footer (The Problem, The Solution, Pricing, Sign in · About & Team, Why Us, Contact · Privacy, Terms).
- **Links:**
  - Internal routes: `/`, `/about`, `/pricing`, `/contact`, `/privacy-policy`, `/terms-and-conditions`.
  - Anchors: `/#solution`, `/#why-us`, `/#the-problem`, `#how-it-works`, `/about#…`.
  - External: `mailto:team@finperiti.com` and the **Sign in** app link `https://kind-river-07dda5b03.6.azurestaticapps.net/signup` (new tab).
- **Navigation:** Our Solution, About Us, Why Us, Pricing, Contact, plus *Book a Demo* → `/contact`. The commented-out "Sign in" button on the live nav stays hidden.
- **Hidden content:** the "In the News" press section is commented out on the live home page, so it isn't published here either.

## Assets

| Asset | Source | Path |
|---|---|---|
| Product dashboard (AVIF + full-size SVG) | live site | `assets/img/product/` |
| Team photos (6, AVIF) | live site | `assets/img/team/` |
| Veriff and Binarii logos | live site | `assets/img/partners/` |
| Favicons (SVG, 32px, 180px) | live site | `assets/img/brand/` |
| finperiti logo (white wordmark for dark surfaces, petrol for light) | **V2 reference** | `assets/img/brand/` |
| Manrope (same file as live) and JetBrains Mono, variable woff2 | self-hosted | `assets/fonts/` |

The live site's six multicolour "Why Us" icons and its emoji feature icons are replaced by the V2 line-icon set, so every page uses one icon language.

## UI labels added by the design (not content claims)

These are interface labels that come from the V2 component language, not new statements about the company:

- "Includes" above the plan feature lists
- "(optional)" on the Company field
- "Sending…" while the form submits
- "Legal" above the legal documents navigation
- The window label "finperiti · Microsoft 365"
- "Founded in Dublin · 2024", taken from the About text
- A *Book a Demo* button beside "How finperiti Works", which links to the existing `/contact`

The two float cards in the hero only repeat live claims ("Built natively for Microsoft 365", "Microsoft ISV Certified", "Pilots live · UK & Malta"). No numbers, testimonials, services or certifications were invented.

## Limitations and decisions

1. **"Careers" footer link (home page only):** on the live site it points to `#`, and `/careers` returns 404. Publishing a dead link would fail link QA, so it's omitted. Add it back in `src/partials/footer-home.html` once a careers page exists.
2. **Contact form:** it posts to Web3Forms, as the live site does. The access key is copied from the live page. Web3Forms keys are public client-side keys (they only identify the destination inbox). It sits in `site.config.json` and can be overridden with `FORM_ACCESS_KEY` at build time. Real submissions were **not** sent during QA, because the endpoint was mocked so no email reached the team. Do one real test submission after deploying.
3. **Sign in:** this goes to the external Azure Static Web App, which this project doesn't change or test. Its URL is configurable (`APP_URL` / `site.config.json`).
4. **Analytics:** the live site only has a `dns-prefetch` for Google Analytics and loads no analytics script, so none was added. If analytics is needed, add it with a cookie-consent mechanism and extend the CSP.
5. **URLs:** pages are generated as `about.html` and so on and served as `/about`. This works on GitHub Pages, Azure Static Web Apps, Netlify, and nginx via the included `try_files`. `/about.html` also resolves, but canonical tags point at the clean URLs.
6. **Docker:** the image was **not built** because there was no Docker daemon in the build environment. The included `nginx.conf` **was** tested with nginx 1.24: config test passed; every route returned 200, unknown paths returned 404 with `404.html`, and the CSP header was sent.
7. **Logo:** the logo files come from V2, as the brief requires ("identidade visual … logotipo"). The live site's `nav-logo.svg` and `footer-logo.svg` are not used.
