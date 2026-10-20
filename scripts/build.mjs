// Zero-dependency static site build.
//   node scripts/build.mjs            → dist/
// Pages in src/pages/*.html start with a <!--meta {json} --> block. The build:
//   1. resolves {{> partial}} includes from src/partials (recursively),
//   2. replaces {{variables}} from site.config.json (incl. prices) + the page's meta block,
//   3. marks the current page in the navigation (aria-current="page"),
//   4. drops links whose data-expires date has passed,
//   5. copies src/public/, renders the decorative dot fields as static SVG, bundles + minifies
//      the CSS into one file, and gives CSS/JS/SVG content-hashed names (safe to cache forever),
//   6. writes sitemap.xml and header files for Netlify/Cloudflare (_headers) and Azure (staticwebapp.config.json).
// After a build, scripts/carry-over-assets.mjs can add the live release's hashed files (deploy only).
// Environment overrides (CI / deploy): SITE_URL, APP_URL, FORM_ENDPOINT, FORM_ACCESS_KEY, ROBOTS.
import { readFile, writeFile, mkdir, readdir, rm, cp, rename } from "node:fs/promises";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const out = join(root, process.env.OUT_DIR || "dist");

const config = JSON.parse(await readFile(join(root, "site.config.json"), "utf8"));
const env = {
  siteUrl: process.env.SITE_URL, appUrl: process.env.APP_URL,
  formEndpoint: process.env.FORM_ENDPOINT, formAccessKey: process.env.FORM_ACCESS_KEY, robots: process.env.ROBOTS
};
for (const [k, v] of Object.entries(env)) if (v) config[k] = v;
config.siteUrl = config.siteUrl.replace(/\/+$/, "");
config.appUrl = config.appUrl.replace(/\/+$/, "");
const today = new Date().toISOString().slice(0, 10);

// Prices live once, in site.config.json → {{priceAmlEssentials}} etc. in pages, meta and structured data.
const price = config.prices;
const num = (n) => Math.round(n).toLocaleString("en-IE");
const priceVars = {
  priceAmlEssentials: num(price.amlEssentials),
  priceAmlProfessional: num(price.amlProfessional),
  priceIqIntegrity: num(price.iqIntegrity),
  priceIqComparison: num(price.iqComparison),
  priceIqFiling: num(price.iqFiling),
  priceAmlEssentialsYear: num(price.amlEssentials * 12),
  ...Object.fromEntries(Object.entries(price).map(([k, v]) => [`price${k[0].toUpperCase()}${k.slice(1)}Value`, String(v)]))
};
// Pricing calculator: assumptions + slider defaults also live once (site.config.json → calculator).
// The page shows the default result without JavaScript; pricing.js reads the same assumptions from
// data attributes, so the two can't disagree. Default plan buttons are the first ones (Essentials,
// Integrity, Quarterly = 4 filings a year).
const calc = config.calculator;
const perClient = calc.defaults.hours * calc.automationShare;
const calcVars = {
  calcAutomationShare: String(calc.automationShare),
  calcAutomationPct: `${Math.round(calc.automationShare * 100)}%`,
  calcStaffDayHours: String(calc.staffDayHours),
  calcClients: String(calc.defaults.clients),
  calcHours: String(calc.defaults.hours),
  calcFunds: String(calc.defaults.funds),
  calcHoursSaved: num(calc.defaults.clients * perClient),
  calcDaysSaved: num((calc.defaults.clients * perClient) / calc.staffDayHours),
  calcPerClient: `${perClient % 1 ? perClient.toFixed(1) : perClient} hrs`,
  calcIqReports: String(calc.defaults.funds * 4),
  calcIqAnnual: num(calc.defaults.funds * 4 * price.iqIntegrity)
};
const { prices: _prices, calculator: _calculator, ...siteVars } = config;
const baseVars = { robots: config.robots, ...siteVars, ...priceVars, ...calcVars };

const partials = {};
for (const f of await readdir(join(src, "partials"))) {
  if (f.endsWith(".html")) partials[basename(f, ".html")] = await readFile(join(src, "partials", f), "utf8");
}

/* ---------- Structured data ---------- */
const logo = `${config.siteUrl}/assets/img/brand/finperiti-logo.png`;
const ogImage = `${config.siteUrl}/assets/img/og/finperiti-og.jpg`;
const orgDescription = "AI-assisted AML and KYC compliance automation for Microsoft 365 firms";
const contactPoint = { "@type": "ContactPoint", contactType: "Customer Support", email: "team@finperiti.com" };
const address = { "@type": "PostalAddress", addressCountry: "IE", addressLocality: "Dublin" };
const publisher = { "@type": "Organization", name: "Finperiti", url: config.siteUrl };
const preOrder = "https://schema.org/PreOrder"; // both products launch in January 2027
const breadcrumb = (name, path) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${config.siteUrl}/` },
    { "@type": "ListItem", position: 2, name, item: `${config.siteUrl}${path}` }
  ]
});
// One offer per plan, each with its own billing unit, so per-report and per-month prices never mix.
const offer = (name, value, unitText) => ({
  "@type": "Offer", name, price: String(value), priceCurrency: "EUR", availability: preOrder, priceValidUntil: "2027-12-31",
  priceSpecification: { "@type": "UnitPriceSpecification", price: String(value), priceCurrency: "EUR", unitText }
});
const amlOffers = () => [
  offer("finperiti AML Essentials", price.amlEssentials, "per legal entity, per month"),
  offer("finperiti AML Professional", price.amlProfessional, "per legal entity, per month")
];
const iqOffers = () => [
  offer("finperiti IQ Integrity", price.iqIntegrity, "per fund report"),
  offer("finperiti IQ Integrity + Comparison", price.iqComparison, "per fund report"),
  offer("finperiti IQ Full + Filing", price.iqFiling, "per fund report")
];
const software = (name, description, path, offers) => ({
  "@type": "SoftwareApplication", name, applicationCategory: "BusinessApplication", operatingSystem: "Web",
  description, url: `${config.siteUrl}${path}`, publisher, offers
});

// Structured data per page (meta "jsonld" key). Functions receive the rendered page so FAQ
// answers are read from the visible FAQ markup and can never drift from it.
const jsonld = {
  home: (html, meta) => [
    {
      "@context": "https://schema.org", "@type": "Organization", name: "Finperiti", url: config.siteUrl, logo,
      description: orgDescription, sameAs: ["https://www.linkedin.com/company/finperiti"], contactPoint, address
    },
    {
      "@context": "https://schema.org", "@type": "WebPage",
      name: plainText(meta.title, "home title"), description: plainText(meta.description, "home description"),
      url: `${config.siteUrl}/`,
      publisher: { "@type": "Organization", name: "Finperiti", logo: { "@type": "ImageObject", url: logo } },
      image: { "@type": "ImageObject", url: ogImage, width: 1200, height: 630 }
    }
  ],
  about: () => [{
    "@context": "https://schema.org", "@type": "Organization", name: "Finperiti", url: config.siteUrl, logo,
    description: orgDescription, foundingDate: "2024", foundingLocation: "Dublin", contactPoint, address,
    member: [
      ["Fiona Finucane", "CEO & Co-Founder"], ["Richard Metcalfe", "CGO & Co-Founder"],
      ["Gordon Rudman", "CPTO & Co-Founder"], ["Rachel Martin", "Regulatory & Compliance Expert"],
      ["James Robinson", "CFO Advisor"], ["Paul Mason", "Strategic Advisor, Agentic AI & Growth Partnerships"]
    ].map(([name, jobTitle]) => ({ "@type": "Person", name, jobTitle, email: "team@finperiti.com" }))
  }],
  contact: () => [{
    "@context": "https://schema.org", "@type": "ContactPage", name: "Contact finperiti", url: `${config.siteUrl}/contact`,
    contactPoint: { ...contactPoint, areaServed: ["IE", "GB", "MT"], availableLanguage: "en" },
    publisher: { ...publisher, logo }
  }],
  // No offers here: /pricing shows the products and configurations, the prices are on /aml and /iq.
  pricing: () => [{
    "@context": "https://schema.org",
    "@graph": [
      software("finperiti AML", "AML, KYC and KYB client onboarding for small regulated firms, working with Microsoft 365.", "/aml"),
      software("finperiti IQ", "Pre-submission integrity checks for AIFMD Annex IV regulatory reports, validated against the source data.", "/iq")
    ]
  }],
  aml: (html) => [{
    "@context": "https://schema.org",
    "@graph": [
      software("finperiti AML", "AML, KYC and KYB client onboarding for small regulated firms, working with Microsoft 365.", "/aml", amlOffers()),
      faqPage(html),
      breadcrumb("finperiti AML", "/aml")
    ]
  }],
  iq: (html) => [{
    "@context": "https://schema.org",
    "@graph": [
      software("finperiti IQ", "Pre-submission integrity checks for AIFMD Annex IV regulatory reports, validated against the source data.", "/iq", iqOffers()),
      faqPage(html),
      breadcrumb("finperiti IQ", "/iq")
    ]
  }]
};

const entities = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  mdash: "—", ndash: "–", euro: "€", pound: "£", dollar: "$", times: "×", middot: "·", hellip: "…", rarr: "→",
  laquo: "«", raquo: "»", deg: "°", copy: "©", reg: "®", trade: "™", sect: "§", para: "¶"
};
function plainText(html, where) {
  return html.replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, name) => {
      if (!(name in entities)) throw new Error(`${where}: add &${name}; to the entity table in build.mjs`);
      return entities[name];
    })
    .replace(/\s+/g, " ").replace(/\s+([.,;:!?)])/g, "$1").trim();
}
// FAQPage from every <details class="… faq__item …"><summary>Q</summary>…answer…</details>
function faqPage(html) {
  const items = [];
  for (const [, attrs, inner] of html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)) {
    if (!/\bclass="[^"]*\bfaq__item\b/.test(attrs)) continue;
    const m = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*)$/);
    if (!m) throw new Error("FAQ item without <summary>");
    items.push({ "@type": "Question", name: plainText(m[1], "FAQ question"), acceptedAnswer: { "@type": "Answer", text: plainText(m[2], "FAQ answer") } });
  }
  const expected = (html.match(/\bclass="[^"]*\bfaq__item\b/g) || []).length;
  if (!items.length || items.length !== expected) throw new Error(`FAQ structured data: parsed ${items.length} of ${expected} .faq__item elements`);
  return { "@type": "FAQPage", mainEntity: items };
}
// JSON inside <script> must never contain "</script>" or "<!--": escape every "<".
const ldScript = (o) => `  <script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

/* ---------- Templates ---------- */
function include(html, depth = 0) {
  if (depth > 10) throw new Error("Partial include depth exceeded");
  return html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
    return include(partials[name].replace(/\n$/, ""), depth + 1);
  });
}
function fill(text, vars, file, keep = []) {
  return text.replace(/\{\{(\w+)\}\}/g, (tag, k) => {
    if (keep.includes(k)) return tag;
    if (!(k in vars)) throw new Error(`${file}: unknown variable {{${k}}}`);
    return vars[k];
  });
}

function render(file, raw, assetVars) {
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--meta {...} --> block`);
  const meta = JSON.parse(m[1]);
  for (const [k, v] of Object.entries(meta)) if (typeof v === "string") meta[k] = fill(v, baseVars, file); // e.g. prices in descriptions
  const vars = { ...baseVars, ...assetVars, jsonld: "", ctaTitle: "", ctaLead: "", ctaButton: "Book a Demo", ...meta };
  vars.path = meta.path === "/" ? "/" : meta.path;

  let html = fill(include(raw.slice(m[0].length)), vars, file, ["jsonld"]);
  if (meta.jsonld) {
    if (!jsonld[meta.jsonld]) throw new Error(`${file}: unknown jsonld "${meta.jsonld}"`);
    vars.jsonld = jsonld[meta.jsonld](html, meta).map(ldScript).join("\n");
  }
  html = fill(html, { jsonld: vars.jsonld }, file);
  // Current page in the navigation (top-level pages only; on-page anchors are handled by main.js)
  html = html.replace(/<a data-nav-key="([\w-]+)" href="([^"]+)">/g, (tag, key, href) =>
    key === meta.page ? `<a data-nav-key="${key}" href="${href}" aria-current="page" class="is-active">` : tag);
  // Dot fields: only densities that have a rendered SVG (dotFields below + selectors in pages.css)
  for (const [tag] of html.matchAll(/<[^>]*\bdata-dot-field\b[^>]*>/g)) {
    const density = (tag.match(/data-density="([^"]*)"/) || [, "1"])[1];
    if (!["1", "0.7", "0.6", "0.5"].includes(density)) {
      throw new Error(`${file}: data-density="${density}" has no dot-field SVG; use 1, 0.7, 0.6 or 0.5 (or add one in build.mjs dotFields + pages.css)`);
    }
  }
  // Closing CTA whose button points back at this page (e.g. /contact): drop the button, keep the text.
  html = html.replace(/\s*<div class="final-cta__actions"[^>]*>\s*<a\b[^>]*\bhref="([^"]+)"[^>]*>[\s\S]*?<\/a>\s*<\/div>/g, (block, href) => (href === vars.path ? "" : block));
  // Time-limited links (e.g. an event invitation): removed once their date has passed. main.js does the same at runtime.
  html = html.replace(/\s*<a\b[^>]*\bdata-expires="(\d{4}-\d{2}-\d{2})"[^>]*>[\s\S]*?<\/a>/g, (link, date) => (today >= date ? "" : link));
  // Content-hashed asset URLs
  html = html.replace(/\/assets\/js\/([\w-]+)\.js\b/g, (url, name) => {
    if (!assetVars.js[name]) throw new Error(`${file}: unknown script ${url}`);
    return assetVars.js[name];
  });
  if (/\{\{[^}]*\}\}/.test(html)) throw new Error(`${file}: unresolved template tag`);
  return { meta, html };
}

/* ---------- Assets ---------- */
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);
// CSS minifier: quoted strings (data: URIs, content: "…") are copied untouched; elsewhere it drops
// comments and whitespace around { } ; , — never around ":" (".a :focus" is a descendant selector).
function minifyCss(css) {
  let outCss = "", code = "";
  // Code between two strings is squeezed as one piece, so comments leave no stray spaces behind.
  // ": " → ":" is safe: a space *before* ":" (".a :focus") is the significant one and is kept.
  const flush = () => {
    outCss += code.replace(/\s+/g, " ").replace(/ ?([{};,]) ?/g, "$1").replace(/: /g, ":").replace(/;}/g, "}");
    code = "";
  };
  for (const [, str, comment, chunk] of css.matchAll(/("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')|(\/\*[\s\S]*?\*\/)|([^"'/]+|\/)/g)) {
    if (str) { flush(); outCss += str; }
    else code += comment ? " " : chunk;
  }
  flush();
  return outCss.trim();
}
const cssOrder = ["fonts", "tokens", "base", "components", "sections", "dashboard", "pages"];

// Decorative dot arcs (logo motif), rendered once here as static SVG instead of thousands of DOM nodes
// at runtime. Concentric arcs of dots whose size swells toward the middle of the sweep.
function dotArcSvg(o) {
  const groups = { "#0e9f90": "", "#5de6d2": "" };
  for (let row = 0; row < o.rows; row++) {
    const radius = o.r0 + row * o.gap;
    const count = Math.round((radius * (o.a1 - o.a0)) / o.spacing);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const ang = o.a0 + (o.a1 - o.a0) * t;
      const swell = Math.sin(Math.PI * t);
      const rowFade = 1 - Math.abs(row - o.rows * 0.45) / o.rows;
      const size = o.minR + (o.maxR - o.minR) * Math.pow(swell, 1.6) * rowFade;
      if (size < 0.5) continue;
      groups[t > 0.5 ? "#5de6d2" : "#0e9f90"] += `<circle cx="${(o.cx + Math.cos(ang) * radius).toFixed(1)}" cy="${(o.cy + Math.sin(ang) * radius).toFixed(1)}" r="${size.toFixed(2)}" fill-opacity="${(o.alpha * (0.35 + 0.65 * swell)).toFixed(2)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${Object.entries(groups).map(([fill, c]) => `<g fill="${fill}">${c}</g>`).join("")}</svg>`;
}
const field = (density) => ({ cx: 560, cy: 470, r0: 330, gap: 26, rows: Math.round(8 * density) + 2, a0: -1.45, a1: 1.55, spacing: 30 / density, minR: 0.8, maxR: 6.2, alpha: 0.55 * density });
const dotFields = {
  "field-100": field(1), "field-70": field(0.7), "field-60": field(0.6), "field-50": field(0.5),
  cta: { cx: 470, cy: 500, r0: 250, gap: 24, rows: 9, a0: -1.5, a1: 1.6, spacing: 26, minR: 0.8, maxR: 7, alpha: 0.6 }
};

// Security headers: one policy, written here for Netlify / Cloudflare Pages / Azure Static Web Apps,
// and checked against the dev server and nginx.conf so they can't drift.
const CSP = "default-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; script-src 'self'; connect-src 'self' https://api.web3forms.com; form-action 'self' https://api.web3forms.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
for (const f of ["nginx.conf", "scripts/serve.mjs"]) {
  const text = await readFile(join(root, f), "utf8").catch(() => null); // absent in the Docker build stage
  if (text !== null && !text.includes(CSP)) throw new Error(`${f}: Content-Security-Policy differs from the one in scripts/build.mjs`);
}
const immutable = "public, max-age=31536000, immutable";
const hashedDirs = ["/assets/css/*", "/assets/js/*", "/assets/img/dots/*"];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(src, "public"), out, { recursive: true });

const dotsDir = join(out, "assets", "img", "dots");
await mkdir(dotsDir, { recursive: true });
const dots = {};
for (const [name, opts] of Object.entries(dotFields)) {
  const svg = dotArcSvg(opts);
  const file = `${name}.${hash(svg)}.svg`;
  await writeFile(join(dotsDir, file), svg);
  dots[name] = `/assets/img/dots/${file}`;
}

const cssDir = join(out, "assets", "css");
const cssFiles = (await readdir(cssDir)).filter((f) => f.endsWith(".css"));
const unknownCss = cssFiles.filter((f) => !cssOrder.includes(basename(f, ".css")));
if (unknownCss.length) throw new Error(`Add ${unknownCss.join(", ")} to cssOrder in build.mjs`);
let css = minifyCss((await Promise.all(cssOrder.map((n) => readFile(join(cssDir, `${n}.css`), "utf8")))).join("\n"));
css = css.replace(/\/assets\/img\/dots\/([\w-]+)\.svg/g, (url, name) => {
  if (!dots[name]) throw new Error(`CSS references unknown dot field ${url}`);
  return dots[name];
});
await Promise.all(cssFiles.map((f) => rm(join(cssDir, f)))); // only the bundled sources; anything else stays
const cssName = `site.${hash(css)}.css`;
await writeFile(join(cssDir, cssName), css);

const jsDir = join(out, "assets", "js");
const js = {};
for (const f of await readdir(jsDir)) {
  if (!f.endsWith(".js")) continue;
  const name = basename(f, ".js");
  const hashed = `${name}.${hash(await readFile(join(jsDir, f)))}.js`;
  await rename(join(jsDir, f), join(jsDir, hashed));
  js[name] = `/assets/js/${hashed}`;
}
const assetVars = { stylesheet: `/assets/css/${cssName}`, js };
// This release's hashed files; scripts/carry-over-assets.mjs adds the previous releases' list on deploy.
await writeFile(join(out, "assets", "releases.json"), JSON.stringify({ current: [assetVars.stylesheet, ...Object.values(js), ...Object.values(dots)].sort(), previous: [] }, null, 2) + "\n");
console.log(`  css   ${cssName} (${(css.length / 1024).toFixed(1)} KB, ${cssOrder.length} files)`);

/* ---------- Pages ---------- */
// Sitemap <lastmod>: the date the page source last changed (its last git commit; file date outside git),
// so the daily rebuild doesn't claim every page changed every day.
async function lastModified(file) {
  try {
    const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (date) return date;
  } catch { /* not a git checkout */ }
  return (await stat(file)).mtime.toISOString().slice(0, 10);
}
const pages = [];
for (const f of (await readdir(join(src, "pages"))).sort()) {
  if (!f.endsWith(".html")) continue;
  // "draft": true in the meta block keeps a page's source but leaves it out of dist/ and the sitemap.
  if (JSON.parse((await readFile(join(src, "pages", f), "utf8")).match(/^<!--meta\s*([\s\S]*?)-->/)?.[1] || "{}").draft) {
    console.log(`  draft ${f}`);
    continue;
  }
  const { meta, html } = render(f, await readFile(join(src, "pages", f), "utf8"), assetVars);
  await writeFile(join(out, f), html);
  pages.push({ file: f, ...meta, lastmod: await lastModified(join(src, "pages", f)) });
  console.log(`  built ${f.padEnd(26)} ${meta.path}`);
}

const prio = { "/": "1.0", "/aml": "0.9", "/iq": "0.9", "/about": "0.8", "/contact": "0.7" };
const urls = pages.filter((p) => p.page !== "404").map((p) => `  <url>
    <loc>${config.siteUrl}${p.path}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <priority>${prio[p.path] || "0.5"}</priority>
  </url>`).join("\n");
await writeFile(join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
const robots = await readFile(join(out, "robots.txt"), "utf8");
await writeFile(join(out, "robots.txt"), robots.replace("__SITE_URL__", config.siteUrl));

// Host header files (ignored by GitHub Pages, which can't set headers; nginx.conf covers Docker).
const security = {
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY", "Content-Security-Policy": CSP
};
await writeFile(join(out, "_headers"), [ // Netlify, Cloudflare Pages
  "/*", ...Object.entries(security).map(([k, v]) => `  ${k}: ${v}`),
  ...hashedDirs.flatMap((d) => [d, `  Cache-Control: ${immutable}`]),
  ""
].join("\n"));
await writeFile(join(out, "staticwebapp.config.json"), JSON.stringify({ // Azure Static Web Apps
  globalHeaders: security,
  routes: hashedDirs.map((route) => ({ route, headers: { "Cache-Control": immutable } })),
  responseOverrides: { 404: { rewrite: "/404.html" } }
}, null, 2) + "\n");
console.log(`Built ${pages.length} pages → ${out}`);
