/* finperiti — progressive enhancement (from Finperiti.Web.V2, adapted for multiple pages)
 * Everything here is optional: without JS the page renders fully, links work
 * and content is visible. No dependencies.
 */
(function () {
  "use strict";

  // Tells the CSS that scripts really run, which cancels its show-everything safety net (base.css).
  document.documentElement.classList.add("reveal-ready");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- 2. Navigation: scrolled state, active section, mobile menu ---------- */
  function initNav() {
    var nav = $("[data-nav]");
    if (!nav) return;

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        nav.classList.toggle("is-scrolled", window.scrollY > 24);
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Active link for on-page anchors (only on the page that owns the sections, e.g. "/#solution" on "/")
    var path = window.location.pathname.replace(/\/index\.html$/, "/");
    var links = $$(".site-nav__links a[href*='#']").filter(function (a) {
      var url = new URL(a.getAttribute("href"), window.location.href);
      return url.pathname.replace(/\/index\.html$/, "/") === path && document.getElementById(url.hash.slice(1));
    });
    var pageLinks = $$(".site-nav__links a[aria-current='page']");
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").split("#")[1]] = a; });
    if (links.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var link = map[e.target.id];
          if (!link) return;
          if (e.isIntersecting) {
            links.forEach(function (l) { l.classList.remove("is-active"); l.removeAttribute("aria-current"); });
            pageLinks.forEach(function (l) { l.classList.remove("is-active"); });
            link.classList.add("is-active");
            link.setAttribute("aria-current", "location");
          } else if (link.classList.contains("is-active")) {
            link.classList.remove("is-active");
            link.removeAttribute("aria-current");
            // Leaving the section: hand the highlight back to the current page link (e.g. Home)
            if (!links.some(function (l) { return l.classList.contains("is-active"); })) {
              pageLinks.forEach(function (l) { l.classList.add("is-active"); });
            }
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }

    // Mobile menu
    var toggle = $("[data-nav-toggle]");
    var menu = $("[data-mobile-menu]");
    if (!toggle || !menu) return;
    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      $(".sr-only", toggle).textContent = open ? "Close menu" : "Open menu";
      menu.hidden = !open;
      nav.classList.toggle("is-scrolled", open || window.scrollY > 24);
      if (open) { var first = $("a", menu); if (first) first.focus(); }
    }
    toggle.addEventListener("click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setOpen(false); toggle.focus(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1180 && !menu.hidden) setOpen(false);
    });
  }

  /* ---------- 3. Scroll reveal with gentle stagger ---------- */
  function initReveal() {
    var items = $$("[data-reveal]");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible", "is-revealed"); });
      return;
    }
    // Stagger siblings that share a parent
    var groups = new Map();
    var delays = new Map();
    items.forEach(function (el) {
      var p = el.parentElement;
      var i = groups.get(p) || 0;
      delays.set(el, Math.min(i * 90, 360));
      el.style.setProperty("--reveal-delay", delays.get(el) + "ms");
      groups.set(p, i + 1);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add("is-visible");
        io.unobserve(el);
        // Once the entrance has played, the element's own transitions and hover effects take over.
        setTimeout(function () { el.classList.add("is-revealed"); }, delays.get(el) + 800);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 5. Timeline progress ---------- */
  function initTimeline() {
    var tl = $("[data-timeline]");
    if (!tl) return;
    var steps = $$(".timeline__step", tl);
    if (reduceMotion) { tl.style.setProperty("--progress", "1"); steps.forEach(function (s) { s.classList.add("is-active"); }); return; }
    var near = false, queued = false;
    function update() {
      queued = false;
      // Read every position first, then write — no forced layout between steps.
      var vh = window.innerHeight;
      var r = tl.getBoundingClientRect();
      var tops = steps.map(function (s) { return s.getBoundingClientRect().top; });
      var p = Math.max(0, Math.min(1, (vh * 0.6 - r.top) / r.height));
      tl.style.setProperty("--progress", p.toFixed(3));
      steps.forEach(function (s, i) { s.classList.toggle("is-active", tops[i] + 30 < vh * 0.62); });
    }
    function schedule() { if (near && !queued) { queued = true; requestAnimationFrame(update); } }
    // Only track scrolling while the timeline is near the viewport; the observer's first report
    // does the initial update, so nothing is measured at load for a timeline far down the page.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { near = entries[0].isIntersecting; if (near) schedule(); }, { rootMargin: "200px 0px" }).observe(tl);
    } else {
      near = true;
      schedule();
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  }

  /* ---------- 6. Endless animations (dot fields, launch dot, floating cards) ---------- */
  // They only run while their element is on screen ("is-paused" otherwise): off-screen, browsers
  // can't hand them to the GPU and would re-style the page every frame. The dot fields themselves
  // are static SVGs rendered at build time (scripts/build.mjs).
  function initLoopingAnimations() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("is-paused", !e.isIntersecting); });
    });
    $$("[data-dot-field], .launch-note, .float-card").forEach(function (el) { io.observe(el); });
  }

  /* ---------- 7. Dotted globe (canvas): set up when it nears the viewport, paused when off-screen ---------- */
  function initGlobe() {
    var canvas = $("[data-globe]");
    if (!canvas || !canvas.getContext) return;
    if (!("IntersectionObserver" in window)) { setupGlobe(canvas); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      setupGlobe(canvas);
    }, { rootMargin: "400px 0px" });
    io.observe(canvas);
  }
  function setupGlobe(canvas) {
    var ctx = canvas.getContext("2d");
    var N = window.innerWidth < 700 ? 520 : 900;
    var pts = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2;
      var rad = Math.sqrt(1 - y * y);
      var th = golden * i;
      pts.push([Math.cos(th) * rad, y, Math.sin(th) * rad]);
    }
    var rot = 0.6, running = false, last = 0, size = 0, dpr = 1;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(10, Math.min(rect.width, rect.height));
      canvas.width = size * dpr; canvas.height = size * dpr;
      draw();
    }
    function draw() {
      var s = size * dpr, R = s * 0.42, c = s / 2;
      ctx.clearRect(0, 0, s, s);
      // halo
      var grd = ctx.createRadialGradient(c, c, R * 0.2, c, c, R * 1.25);
      grd.addColorStop(0, "rgba(93,230,210,0.10)");
      grd.addColorStop(1, "rgba(93,230,210,0)");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(c, c, R * 1.25, 0, Math.PI * 2); ctx.fill();
      // rim
      ctx.strokeStyle = "rgba(93,230,210,0.22)"; ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
      var cos = Math.cos(rot), sin = Math.sin(rot), tilt = 0.38, ct = Math.cos(tilt), st = Math.sin(tilt);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var x = p[0] * cos - p[2] * sin;
        var z = p[0] * sin + p[2] * cos;
        var y = p[1] * ct - z * st;
        z = p[1] * st + z * ct;
        var depth = (z + 1) / 2; // 0 back → 1 front
        var r = (0.7 + depth * 1.9) * dpr;
        ctx.fillStyle = depth > 0.5 ? "rgba(93,230,210," + (0.25 + depth * 0.7).toFixed(2) + ")"
                                    : "rgba(14,159,144," + (0.08 + depth * 0.35).toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(c + x * R, c + y * R, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    function frame(ts) {
      if (!running) return;
      if (ts - last > 33) { rot += 0.0035; draw(); last = ts; } // ~30fps cap
      requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener("resize", resize);
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis && !running) { running = true; requestAnimationFrame(frame); }
      if (!vis) running = false;
    }).observe(canvas);
  }

  function initYear() {
    $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  /* ---------- 8. Time-limited links (data-expires="YYYY-MM-DD"), also removed at build time ---------- */
  function initExpiry() {
    var today = new Date().toISOString().slice(0, 10);
    $$("[data-expires]").forEach(function (el) {
      if (today >= el.getAttribute("data-expires")) el.parentNode.removeChild(el);
    });
  }

  /* ---------- 9. Faster page changes: prefetch an internal page when the mouse rests on its link (not on touch: that also fires when a scroll starts) ---------- */
  function initPrefetch() {
    var conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;
    var done = {};
    var timer = null;
    function target(e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return null;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
      url.hash = "";
      if (url.pathname === location.pathname || done[url.href]) return null;
      return url.href;
    }
    function prefetch(href) {
      done[href] = true;
      var link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      document.head.appendChild(link);
    }
    document.addEventListener("mouseover", function (e) {
      var href = target(e);
      clearTimeout(timer);
      if (href) timer = setTimeout(function () { prefetch(href); }, 65);
    }, { passive: true });
  }

  // Content first; the globe sets itself up only when the visitor gets near it.
  initExpiry();
  initNav();
  initReveal();
  initTimeline();
  initYear();
  initLoopingAnimations();
  initPrefetch();
  initGlobe();
})();
