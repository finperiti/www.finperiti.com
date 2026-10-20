// Zero-dependency static server for local development and preview.
//   node scripts/serve.mjs [dir] [port] [--watch]     (defaults: dist 5174)
// Mirrors production routing: clean URLs (/about → about.html), 404.html for unknown paths,
// and the same security headers as nginx.conf, so problems surface before deploy.
// --watch: rebuilds when src/ or site.config.json changes and reloads open pages (dev only;
// the reload script is a same-origin file, so it runs under the production CSP).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2).filter((a) => a !== "--watch");
const live = process.argv.includes("--watch");
const root = resolve(projectRoot, args[0] || "dist");
const port = Number(args[1] || process.env.PORT || 5174);
const CSP = "default-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; script-src 'self'; connect-src 'self' https://api.web3forms.com; form-action 'self' https://api.web3forms.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".avif": "image/avif", ".webp": "image/webp", ".woff2": "font/woff2",
  ".json": "application/json", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon"
};
const isFile = async (f) => (await stat(f).catch(() => null))?.isFile();

/* ---------- Live reload (--watch) ---------- */
const clients = new Set();
const reloadScript = `new EventSource("/__livereload").addEventListener("reload", () => location.reload());`;
let building = false, pending = false, timer;
function build() {
  if (building) { pending = true; return; }
  building = true;
  const started = Date.now();
  spawn(process.execPath, [join(projectRoot, "scripts", "build.mjs")], { cwd: projectRoot, stdio: ["ignore", "ignore", "inherit"] })
    .on("exit", (code) => {
      building = false;
      if (code === 0) {
        console.log(`  rebuilt in ${Date.now() - started} ms → reloading ${clients.size} page(s)`);
        for (const res of clients) res.write("event: reload\ndata: \n\n");
      } else console.log("  build failed — fix the error above and save again");
      if (pending) { pending = false; build(); }
    });
}
if (live) {
  const schedule = () => { clearTimeout(timer); timer = setTimeout(build, 120); };
  watch(join(projectRoot, "src"), { recursive: true }, schedule);
  watch(join(projectRoot, "site.config.json"), schedule);
}

createServer(async (req, res) => {
  const headers = { "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" };
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (live && path === "/__livereload") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (live && path === "/__livereload.js") {
      res.writeHead(200, { ...headers, "Content-Type": types[".js"] }).end(reloadScript);
      return;
    }
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (path.endsWith("/")) file = join(file, "index.html");
    else if (!(await isFile(file)) && (await isFile(file + ".html"))) file += ".html";
    let status = 200;
    if (!(await isFile(file))) { file = join(root, "404.html"); status = 404; }
    let body = await readFile(file);
    if (live && extname(file) === ".html") {
      body = body.toString().replace("</body>", `<script src="/__livereload.js"></script></body>`);
      headers["Cache-Control"] = "no-store";
    }
    res.writeHead(status, { ...headers, "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Server error");
  }
}).listen(port, () => console.log(`finperiti → http://localhost:${port}  (serving ${root}${live ? ", live reload on" : ""})`));
