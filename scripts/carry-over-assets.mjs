// Adds the hashed CSS/JS/SVG files of the last two live releases to dist/, so pages a visitor still
// has cached or prefetched keep working right after a deploy (even two deploys in quick succession).
//   node scripts/carry-over-assets.mjs        (after scripts/build.mjs; reads SITE_URL or site.config.json)
// The live site's /assets/releases.json lists its own files ("current") and the release before it
// ("previous"); both are carried, older ones are dropped. Sites without that file are scanned instead.
// It never fails a deploy: unreachable sites and files that can't be downloaded are reported and skipped.
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, process.env.OUT_DIR || "dist");
const config = JSON.parse(await readFile(join(root, "site.config.json"), "utf8"));
const site = (process.env.SITE_URL || config.siteUrl).replace(/\/+$/, "");
const HASHED = /\/assets\/(?:css|js|img\/dots)\/[\w-]+\.[0-9a-f]{10}\.(?:css|js|svg)/g;
const manifestPath = join(out, "assets", "releases.json");

const fetchText = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};
const exists = (p) => stat(p).then(() => true, () => false);
const paths = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(loc).pathname);

// What the live site uses: its manifest, or (older releases without one) the files its pages reference.
async function liveReleases() {
  const manifest = await fetchText(`${site}/assets/releases.json`).then(JSON.parse, () => null);
  if (manifest && Array.isArray(manifest.current)) return { current: manifest.current, previous: manifest.previous || [] };
  const routes = new Set(["/", ...paths(await readFile(join(out, "sitemap.xml"), "utf8"))]);
  await fetchText(`${site}/sitemap.xml`).then((xml) => paths(xml).forEach((p) => routes.add(p)), () => {});
  const pages = await Promise.all([...routes].map((r) => fetchText(site + r).catch(() => null)));
  if (!pages.some((p) => p !== null)) throw new Error(`no page of ${site} could be fetched`);
  const current = new Set();
  for (const html of pages) for (const [asset] of (html || "").matchAll(HASHED)) current.add(asset);
  return { current: [...current], previous: [] };
}

try {
  const live = await liveReleases();
  const wanted = new Set([...live.current, ...live.previous]);
  const failed = [];
  let added = 0;
  // Download in parallel; a file that fails is reported and skipped, the others still go through.
  const carry = async (asset) => {
    const file = join(out, asset);
    if (await exists(file)) return;
    try {
      const body = await fetchText(site + asset);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
      added++;
      if (asset.endsWith(".css")) { // images an old stylesheet points at
        await Promise.all([...body.matchAll(HASHED)].map(([ref]) => (wanted.has(ref) ? null : (wanted.add(ref), carry(ref)))));
      }
    } catch (err) {
      failed.push(`${asset} (${err.message})`);
    }
  };
  await Promise.all([...wanted].map(carry));

  const ours = JSON.parse(await readFile(manifestPath, "utf8"));
  ours.previous = live.current.filter((a) => !ours.current.includes(a));
  await writeFile(manifestPath, JSON.stringify(ours, null, 2) + "\n");

  console.log(`carry-over: ${added} file(s) from the last two releases at ${site} (${wanted.size} referenced)`);
  if (failed.length) console.warn(`carry-over: could not fetch ${failed.length}: ${failed.join(", ")}`);
} catch (err) {
  console.warn(`carry-over skipped: ${err.message}`);
}
