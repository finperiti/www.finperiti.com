// Automated QA for the built site (dist/).
//   npm test            → builds, serves dist/ on a free port, runs every check, writes docs/screenshots + docs/qa-results.json
// Checks per page × viewport: HTTP status, console errors, failed/404 requests, horizontal overflow,
// broken images, one <h1>, title/description/canonical, internal links + anchors, mobile menu,
// contact form and pricing calculators/lead forms (endpoint mocked — nothing is sent).
import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = 5199;
const base = `http://localhost:${port}`;
const pages = ["/", "/aml", "/iq", "/about", "/contact", "/privacy-policy", "/terms-and-conditions"];
const viewports = { desktop: { width: 1280, height: 900 }, wide: { width: 1920, height: 1080 }, tablet: { width: 768, height: 1024 }, mobile: { width: 375, height: 812 } };
const shots = join(root, "docs", "screenshots");
await mkdir(shots, { recursive: true });

const server = spawn(process.execPath, [join(root, "scripts/serve.mjs"), "dist", String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 600));

const results = [];
let failures = 0;
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const slug = (p) => (p === "/" ? "home" : p.slice(1));

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
}

for (const [vpName, vp] of Object.entries(viewports)) {
  console.log(`\n[${vpName} ${vp.width}px]`);
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce" });
  for (const path of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
    page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    const res = await page.goto(base + path, { waitUntil: "networkidle" });
    await scrollThrough(page);
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1: document.querySelectorAll("h1").length,
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.content || "",
      canonical: document.querySelector('link[rel="canonical"]')?.href || "",
      brokenImgs: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src),
      fontsOk: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family)
    }));
    const p = `${vpName} ${path}`;
    check(`${p} responds 200`, res.status() === 200, String(res.status()));
    check(`${p} no console/network errors`, errors.length === 0, errors.join(" | "));
    check(`${p} no horizontal overflow`, info.overflow <= 0, `${info.overflow}px`);
    check(`${p} images load`, info.brokenImgs.length === 0, info.brokenImgs.join(", "));
    if (vpName === "desktop") {
      check(`${p} exactly one h1`, info.h1 === 1, String(info.h1));
      check(`${p} title + description + canonical`, !!info.title && info.desc.length > 50 && !!info.canonical);
      check(`${p} self-hosted fonts loaded`, info.fontsOk.some((f) => /Manrope/.test(f)) && info.fontsOk.some((f) => /JetBrains/.test(f)), info.fontsOk.join(","));
    }
    await page.screenshot({ path: join(shots, `${slug(path)}-${vp.width}.jpg`), fullPage: true, type: "jpeg", quality: 78 });
    await page.close();
  }
  await ctx.close();
}

// ---------- Links and anchors (desktop) ----------
console.log("\n[links]");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const internal = new Set();
  const external = new Set();
  for (const path of pages.concat(["/does-not-exist"])) {
    await page.goto(base + path);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) {
      if (h.startsWith("mailto:")) continue;
      if (h.startsWith("#")) { // in-page anchor: must exist on this page
        check(`anchor ${path}${h}`, (await page.locator(h).count()) === 1);
        continue;
      }
      if (/^https?:/.test(h)) { external.add(h); continue; }
      internal.add(new URL(h, base + path).href);
    }
  }
  for (const url of internal) {
    const u = new URL(url);
    const r = await page.goto(u.origin + u.pathname);
    let ok = r.status() === 200;
    let detail = String(r.status());
    if (ok && u.hash) {
      ok = (await page.locator(u.hash).count()) === 1;
      detail = ok ? "" : `missing anchor ${u.hash}`;
    }
    check(`link ${u.pathname}${u.hash}`, ok, detail);
  }
  const r404 = await page.goto(base + "/does-not-exist");
  check("unknown path serves 404 page", r404.status() === 404 && (await page.locator("h1").innerText()).includes("Page Not Found"));
  console.log(`  external links (not fetched): ${[...external].join(", ")}`);
  await ctx.close();
}

// ---------- Navigation behaviour ----------
console.log("\n[navigation]");
{
  const ctx = await browser.newContext({ viewport: viewports.mobile, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base + "/about");
  const toggle = page.locator("[data-nav-toggle]");
  check("mobile: menu hidden initially", await page.locator("[data-mobile-menu]").isHidden());
  await toggle.click();
  check("mobile: toggle opens menu", (await toggle.getAttribute("aria-expanded")) === "true" && (await page.locator("[data-mobile-menu]").isVisible()));
  await page.screenshot({ path: join(shots, "mobile-menu-375.png") });
  await page.keyboard.press("Escape");
  check("mobile: Escape closes menu", (await toggle.getAttribute("aria-expanded")) === "false");
  await toggle.click();
  await page.locator("[data-mobile-menu] a", { hasText: "finperiti IQ" }).click();
  await page.waitForURL("**/iq");
  check("mobile: menu link navigates", page.url().endsWith("/iq"));
  check("current page marked in nav", (await page.locator('.site-nav__links a[aria-current="page"]').innerText()).toLowerCase() === "finperiti iq");
  await ctx.close();

  const ctx2 = await browser.newContext({ viewport: viewports.desktop });
  const p2 = await ctx2.newPage();
  await p2.goto(base + "/");
  await p2.mouse.wheel(0, 900);
  await p2.waitForTimeout(500);
  check("desktop: nav gets scrolled state", await p2.locator("[data-nav]").evaluate((n) => n.classList.contains("is-scrolled")));
  await p2.screenshot({ path: join(shots, "nav-scrolled-1280.png") });
  await p2.goto(base + "/about#rachel");
  check("deep link /about#rachel targets team card", await p2.locator("#rachel").isVisible());
  // Home stays highlighted after the News section has scrolled in and out again
  await p2.goto(base + "/");
  const activeNav = () => p2.locator(".site-nav__links a.is-active").allInnerTexts();
  await p2.locator("#news").scrollIntoViewIfNeeded();
  await p2.waitForTimeout(400);
  const onNews = await activeNav();
  await p2.evaluate(() => window.scrollTo(0, 0));
  await p2.waitForTimeout(400);
  const atTop = await activeNav();
  check("nav: News active on #news, Home again at the top", onNews.join() === "News" && atTop.join() === "Home", `${onNews} → ${atTop}`);
  await ctx2.close();
}

// ---------- Contact form (endpoint mocked) ----------
console.log("\n[contact form]");
{
  const ctx = await browser.newContext({ viewport: viewports.desktop, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let posted = null;
  let reply = { success: true };
  await page.route("https://api.web3forms.com/**", async (route) => {
    posted = route.request().postData() || "";
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(reply) });
  });
  await page.goto(base + "/contact");
  await page.click("#ctForm button[type=submit]");
  check("form: empty submit shows validation", await page.locator("#ctForm.was-validated").count() === 1 && await page.locator("#ct-name-err").isVisible());
  check("form: nothing sent when invalid", posted === null);
  await page.screenshot({ path: join(shots, "contact-validation-1280.png") });
  await page.fill("#ct-name", "QA Test");
  await page.fill("#ct-email", "not-an-email");
  await page.fill("#ct-message", "Automated QA message");
  await page.click("#ctForm button[type=submit]");
  check("form: invalid email blocked", posted === null && await page.locator("#ct-email-err").isVisible());
  await page.fill("#ct-email", "qa@example.com");
  await page.click("#ctForm button[type=submit]");
  await page.locator("#ctSuccess").waitFor({ state: "visible" });
  check("form: posts expected fields", /access_key/.test(posted) && /qa@example.com/.test(posted) && /botcheck|QA Test/.test(posted));
  check("form: success message + reset", (await page.inputValue("#ct-name")) === "");
  await page.screenshot({ path: join(shots, "contact-success-1280.png") });
  reply = { success: false };
  await page.fill("#ct-name", "QA Test"); await page.fill("#ct-email", "qa@example.com"); await page.fill("#ct-message", "x");
  await page.click("#ctForm button[type=submit]");
  await page.locator("#ctError").waitFor({ state: "visible" });
  check("form: error message on failure", await page.locator("#ctSuccess").isHidden());
  await ctx.close();
}

// ---------- Pricing calculators + "email me this estimate" (endpoint mocked) ----------
console.log("\n[pricing calculator]");
{
  const ctx = await browser.newContext({ viewport: viewports.desktop, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let posted = null;
  await page.route("https://api.web3forms.com/**", async (route) => {
    posted = route.request().postData() || "";
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ success: true }) });
  });
  await page.goto(base + "/aml#calculator");
  check("calc: /aml shows only the AML panel", (await page.locator("[data-calc]").count()) === 1 && (await page.locator('[data-calc="aml"]').count()) === 1);
  const text = (sel) => page.locator(sel).innerText();
  check("calc: AML defaults to Essentials", (await text("#pc-aml-m")) === "€199" && (await text("#pc-aml-y")) === "€2,388");
  await page.click('[data-seg="aml-plan"] button:has-text("Professional")');
  check("calc: AML Professional = €399 / €4,788", (await text("#pc-aml-m")) === "€399" && (await text("#pc-aml-y")) === "€4,788");
  await page.click('[data-seg="aml-plan"] button:has-text("Groups")');
  check("calc: AML Groups shows quote instead of price", (await page.locator("[data-quote]").isVisible()) && (await page.locator("#pc-aml-m").isHidden()));
  await page.click('[data-seg="aml-plan"] button:has-text("Essentials")');
  await page.locator("#pc-clients").fill("100");
  await page.waitForFunction(() => document.querySelector("#pc-clients-out").textContent === "100", null, { timeout: 2000 }).catch(() => {});
  check("calc: time saved follows sliders (100 × 15h × 80%)", (await text("#pc-t-h")) === "1,200" && (await text("#pc-t-d")) === "160" && (await text("#pc-t-c")) === "12 hrs");
  const lead = page.locator('[data-lead="aml"]');
  await lead.locator(".lead-box__open").click();
  check("lead: form opens", await lead.locator("form").isVisible());
  await lead.locator('button[type="submit"]').click();
  check("lead: invalid email blocked", posted === null && (await lead.locator(".lead-box__error").isVisible()));
  await lead.locator('input[name="email"]').fill("qa@example.com");
  await lead.locator('input[name="firm"]').fill("QA Firm");
  await lead.locator('button[type="submit"]').click();
  await lead.locator(".lead-box__done").waitFor({ state: "visible" });
  check("lead: posts estimate summary", /access_key/.test(posted) && /qa@example.com/.test(posted) && /Product: finperiti AML/.test(posted) && /Estimated hours saved yearly: 1,200/.test(posted));
  await page.screenshot({ path: join(shots, "pricing-calculator-1280.png") });

  await page.goto(base + "/iq#calculator");
  check("calc: /iq shows only the IQ panel", (await page.locator("[data-calc]").count()) === 1 && (await page.locator('[data-calc="iq"]').count()) === 1);
  check("calc: IQ defaults to 5 funds quarterly = 20 reports, €1,980", (await text("#pc-iq-r")) === "20" && (await text("#pc-iq-y")) === "€1,980");
  await page.click('[data-seg="iq-plan"] button:has-text("Full + Filing")');
  await page.click('[data-seg="iq-freq"] button:has-text("Annually")');
  check("calc: IQ Full + Filing annually = 5 reports, €845", (await text("#pc-iq-r")) === "5" && (await text("#pc-iq-y")) === "€845");

  posted = null;
  await page.click('[data-seg="iq-plan"] button:has-text("Comparison")');
  const iqLead = page.locator('[data-lead="iq"]');
  await iqLead.locator(".lead-box__open").click();
  await iqLead.locator('input[name="email"]').fill("qa@example.com");
  await iqLead.locator('input[name="firm"]').fill("QA Firm");
  await iqLead.locator('input[name="firm"]').press("Enter");
  await iqLead.locator(".lead-box__done").waitFor({ state: "visible" });
  check("lead: IQ estimate names the full plan", (posted || "").includes("Plan: Integrity + Comparison")); // multipart body: plain text
  await ctx.close();
}

// ---------- Idle cost: nothing should keep re-styling or re-laying out the page ----------
console.log("\n[performance]");
{
  const ctx = await browser.newContext({ viewport: viewports.desktop }); // real motion on purpose
  for (const path of ["/", "/#news", "/aml", "/iq"]) {
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000); // entrance animations + idle-time decoration done
    const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    const a = await metric();
    await page.waitForTimeout(3000);
    const b = await metric();
    const styles = b.RecalcStyleCount - a.RecalcStyleCount, layouts = b.LayoutCount - a.LayoutCount;
    check(`perf ${path}: idle page does no style/layout work`, styles <= 6 && layouts <= 6, `${styles} style recalcs, ${layouts} layouts in 3 s`);
    await page.close();
  }
  await ctx.close();
}

// ---------- First screen: reduced motion + entrance that doesn't wait for main.js ----------
console.log("\n[first screen]");
{
  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const p1 = await reduced.newPage();
  await p1.goto(base + "/", { waitUntil: "load" }); // stylesheet applied
  const styled = await p1.evaluate(() => getComputedStyle(document.body).fontFamily.includes("Manrope"));
  const ops = await p1.$$eval(".hero__title, .feature-card", (els) => els.map((el) => getComputedStyle(el).opacity));
  check("reduced motion: hero and cards visible at once (styled page)", styled && ops.every((o) => o === "1"), ops.join(","));
  await reduced.close();

  const motion = await browser.newContext();
  const p2 = await motion.newPage();
  await p2.route("**/assets/js/main.*.js", (route) => route.abort()); // main.js never arrives (blocked, offline, stale cache)
  await p2.goto(base + "/");
  await p2.waitForTimeout(1200);
  const op2 = await p2.locator(".hero__title").evaluate((el) => getComputedStyle(el).opacity);
  check("hero entrance runs without main.js", op2 === "1", op2);
  const donut = await p2.locator(".donut__value").evaluate((el) => getComputedStyle(el).strokeDasharray);
  check("hero dashboard charts fill without main.js", !/^0(px)?[ ,]/.test(donut), donut);
  await p2.waitForTimeout(2200); // past the 2.5s safety net
  const hidden = await p2.$$eval("[data-reveal]", (els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length);
  check("without main.js every revealed block still appears", hidden === 0, `${hidden} hidden`);
  await motion.close();

  const hover = await browser.newContext({ viewport: viewports.desktop });
  const p3 = await hover.newPage();
  await p3.goto(base + "/aml");
  const card = p3.locator("#features .feature-card").first();
  await card.scrollIntoViewIfNeeded();
  await p3.waitForTimeout(1500); // entrance played → element's own hover styles take over
  await card.hover();
  await p3.waitForTimeout(500);
  const lifted = await card.evaluate((el) => getComputedStyle(el).transform);
  check("card hover lift works after the entrance", lifted !== "none", lifted);
  await hover.close();
}

// ---------- iPhone (Safari engine): intro blocks centred on phones ----------
console.log("\n[iPhone 15 Pro · WebKit]");
{
  let wk = null;
  try { wk = await webkit.launch(); } catch (e) { check("iPhone: WebKit available", false, "run: npx playwright install webkit"); }
  if (wk) {
    const ctx = await wk.newContext({ ...devices["iPhone 15 Pro"], reducedMotion: "reduce" });
    const page = await ctx.newPage();
    // Horizontal centre of the rendered text (not the box) compared with the viewport centre
    const offCentre = (sel) => page.$$eval(sel, (els) => els.map((el) => {
      const range = document.createRange(); range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return Math.round(Math.abs((r.left + r.right) / 2 - document.documentElement.clientWidth / 2));
    }));
    const groups = {
      "/": [".hero__copy .eyebrow", ".hero__title", ".hero__lead", ".hero__benefits", ".how__intro .section-title", ".security__copy .section-title", ".iq-band__copy .section-title", ".iq-band__copy .launch-note", ".final-cta .section-title"],
      "/aml": [".page-hero__title", ".page-hero .tag-row", ".page-hero .launch-note", ".faq-layout .section-title", ".security__copy .section-title"],
      "/contact": [".page-hero__title", ".contact__email"],
      "/privacy-policy": [".page-hero__title", ".page-hero__meta", ".legal__aside ul"]
    };
    for (const [path, sels] of Object.entries(groups)) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      for (const sel of sels) {
        const offsets = await offCentre(sel);
        const worst = Math.max(...offsets);
        check(`iPhone ${path} ${sel} centred`, offsets.length > 0 && worst <= 6, `${offsets.join(",")}px off`);
      }
    }
    const cells = await page.goto(base + "/").then(() => page.$$eval(".trust-bar__list li", (lis) => lis.map((li) => {
      const cell = li.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(li);
      const r = range.getBoundingClientRect();
      return Math.round(Math.abs((r.left + r.right) / 2 - (cell.left + cell.right) / 2));
    })));
    check("iPhone: trust badges centred in their cells", cells.every((d) => d <= 6), `${cells.join(",")}px off`);
    await page.screenshot({ path: join(shots, "iphone-home.png") });
    await wk.close();
  }
}

// ---------- No-JS rendering ----------
console.log("\n[no-js]");
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base + "/");
  const op = await page.locator("[data-reveal]").first().evaluate((el) => getComputedStyle(el).opacity);
  check("content visible without JavaScript", op === "1", op);
  await ctx.close();
}

await browser.close();
server.kill();
await writeFile(join(root, "docs", "qa-results.json"), JSON.stringify({ date: new Date().toISOString(), failures, results }, null, 2));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
