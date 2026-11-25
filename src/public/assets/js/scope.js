// EU AML 2027 scope checker: shows one industry at a time on /eu-aml-2027, chosen from the dropdown,
// a #slug in the address bar (shareable) or ?sector=slug (the no-JavaScript form submit from the home page).
// Without JavaScript the page shows every industry, so nothing is lost.
(() => {
  const pickers = document.querySelectorAll("[data-scope-picker]");
  const sectors = [...document.querySelectorAll("[data-scope-sector]")];
  const onScopePage = sectors.length > 0;

  // Custom dropdown: phones draw native <select> lists in their own style (grey, indented, unstyleable),
  // so the list is rebuilt on brand: dark teal panel, white text, left aligned. The real <select> stays in
  // the form (hidden) and is what the rest of this script reads, so it still works without JavaScript.
  function enhance(select) {
    const wrap = document.createElement("div");
    wrap.className = "scope-dd";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("scope-dd__native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const label = document.querySelector(`label[for="${select.id}"]`);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "field__input scope-picker__select scope-dd__button";
    button.id = `${select.id}-button`;
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    if (label) { label.htmlFor = button.id; label.id = `${select.id}-label`; }

    const panel = document.createElement("div");
    panel.className = "scope-dd__panel";
    panel.setAttribute("role", "listbox");
    panel.id = `${select.id}-list`;
    panel.tabIndex = -1;
    panel.hidden = true;
    if (label) panel.setAttribute("aria-labelledby", label.id);
    button.setAttribute("aria-controls", panel.id);

    const options = [];
    [...select.children].forEach((node, gi) => {
      if (node.tagName !== "OPTGROUP") return;
      const group = document.createElement("div");
      group.setAttribute("role", "group");
      const heading = document.createElement("p");
      heading.className = "scope-dd__group";
      heading.id = `${select.id}-g${gi}`;
      heading.textContent = node.label;
      group.setAttribute("aria-labelledby", heading.id);
      group.appendChild(heading);
      [...node.children].forEach((opt) => {
        const item = document.createElement("div");
        item.className = "scope-dd__option";
        item.setAttribute("role", "option");
        item.id = `${select.id}-o-${opt.value}`;
        item.dataset.value = opt.value;
        item.textContent = opt.textContent;
        group.appendChild(item);
        options.push(item);
      });
      panel.appendChild(group);
    });
    wrap.append(button);
    document.body.appendChild(panel); // outside the hero, so no stacking context can paint over the list

    const placeholder = select.querySelector('option[value=""]').textContent;
    let active = -1;
    function sync() {
      const chosen = options.find((o) => o.dataset.value === select.value);
      button.textContent = chosen ? chosen.textContent : placeholder;
      button.classList.toggle("is-placeholder", !chosen);
      options.forEach((o) => o.setAttribute("aria-selected", String(o === chosen)));
    }
    function setActive(i) {
      options.forEach((o) => o.classList.remove("is-active"));
      active = Math.max(0, Math.min(options.length - 1, i));
      const o = options[active];
      o.classList.add("is-active");
      panel.setAttribute("aria-activedescendant", o.id);
      const pr = panel.getBoundingClientRect(), or = o.getBoundingClientRect();
      if (or.top < pr.top + 40) panel.scrollTop -= pr.top + 40 - or.top;
      else if (or.bottom > pr.bottom - 8) panel.scrollTop += or.bottom - (pr.bottom - 8);
    }
    function place() {
      const r = button.getBoundingClientRect();
      const below = innerHeight - r.bottom - 16, above = r.top - 16;
      const up = below < 260 && above > below;
      panel.style.left = `${r.left}px`;
      panel.style.width = `${r.width}px`;
      panel.style.maxHeight = `${Math.min(440, up ? above : below)}px`;
      panel.style.top = up ? "" : `${r.bottom + 6}px`;
      panel.style.bottom = up ? `${innerHeight - r.top + 6}px` : "";
    }
    function open(fromKeyboard) {
      if (!panel.hidden) return;
      // Short of room below (e.g. on a phone)? Scroll the field up under the menu bar so the list opens downwards.
      const r = button.getBoundingClientRect();
      if (innerHeight - r.bottom < 320) {
        const nav = document.querySelector(".site-nav");
        window.scrollBy(0, r.top - ((nav ? nav.offsetHeight : 76) + 16));
      }
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      place();
      const i = options.findIndex((o) => o.dataset.value === select.value);
      panel.scrollTop = 0;
      if (i >= 0 || fromKeyboard) setActive(i < 0 ? 0 : i);
      if (i >= 0) { // centre the current choice
        const pr = panel.getBoundingClientRect(), or = options[i].getBoundingClientRect();
        panel.scrollTop += or.top - pr.top - (pr.height - or.height) / 2;
      }
      else { active = -1; options.forEach((o) => o.classList.remove("is-active")); panel.removeAttribute("aria-activedescendant"); }
      panel.focus({ preventScroll: true });
      addEventListener("scroll", place, true);
      addEventListener("resize", place);
    }
    function close(focusButton) {
      if (panel.hidden) return;
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
      removeEventListener("scroll", place, true);
      removeEventListener("resize", place);
      if (focusButton) button.focus();
    }
    function choose(i) {
      select.value = options[i].dataset.value;
      sync();
      close(true);
      select.dispatchEvent(new Event("change"));
    }

    button.addEventListener("click", (e) => (panel.hidden ? open(e.detail === 0) : close(true)));
    button.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(true); }
    });
    panel.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowDown") setActive(active + 1);
      else if (k === "ArrowUp") setActive(active - 1);
      else if (k === "Home") setActive(0);
      else if (k === "End") setActive(options.length - 1);
      else if (k === "PageDown") setActive(active + 6);
      else if (k === "PageUp") setActive(active - 6);
      else if ((k === "Enter" || k === " ") && active >= 0) choose(active);
      else if (k === "Escape") close(true);
      else if (k === "Tab") { close(false); return; }
      else if (k.length === 1) {
        const n = options.findIndex((o, i) => i > active && o.textContent.toLowerCase().startsWith(k.toLowerCase()));
        const m = n >= 0 ? n : options.findIndex((o) => o.textContent.toLowerCase().startsWith(k.toLowerCase()));
        if (m >= 0) setActive(m);
      } else return;
      e.preventDefault();
    });
    panel.addEventListener("mousemove", (e) => {
      const o = e.target.closest(".scope-dd__option");
      if (o && options.indexOf(o) !== active) setActive(options.indexOf(o));
    });
    panel.addEventListener("click", (e) => {
      const o = e.target.closest(".scope-dd__option");
      if (o) choose(options.indexOf(o));
    });
    document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target) && !panel.contains(e.target)) close(false); });
    select.addEventListener("change", sync);
    select.addEventListener("scope:sync", sync);
    sync();
  }
  // "Where you're based": a type-to-search box. Typing filters the list; tapping opens the full list.
  // Left empty, the page shows the general EU rules. The real <select> stays underneath for no-JS.
  function combo(select) {
    const wrap = document.createElement("div");
    wrap.className = "scope-dd scope-combo";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("scope-dd__native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const label = document.querySelector(`label[for="${select.id}"]`);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "field__input scope-picker__select scope-combo__input";
    input.id = `${select.id}-input`;
    input.placeholder = "Start typing your country";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "words");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    if (label) { label.htmlFor = input.id; label.id = `${select.id}-label`; }
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "scope-combo__clear";
    clear.setAttribute("aria-label", "Clear country");
    clear.innerHTML = "&times;";
    clear.hidden = true;

    const panel = document.createElement("div");
    panel.className = "scope-dd__panel scope-combo__panel";
    panel.setAttribute("role", "listbox");
    panel.id = `${select.id}-list`;
    panel.hidden = true;
    if (label) panel.setAttribute("aria-labelledby", label.id);
    input.setAttribute("aria-controls", panel.id);

    const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const options = [], groups = [];
    [...select.children].forEach((node, gi) => {
      if (node.tagName !== "OPTGROUP") return;
      const group = document.createElement("div");
      group.setAttribute("role", "group");
      const heading = document.createElement("p");
      heading.className = "scope-dd__group";
      heading.id = `${select.id}-g${gi}`;
      heading.textContent = node.label;
      group.setAttribute("aria-labelledby", heading.id);
      group.appendChild(heading);
      [...node.children].forEach((opt) => {
        const item = document.createElement("div");
        item.className = "scope-dd__option";
        item.setAttribute("role", "option");
        item.id = `${select.id}-o-${opt.value}`;
        item.dataset.value = opt.value;
        if (opt.dataset.alias) item.dataset.alias = opt.dataset.alias;
        item.textContent = opt.textContent;
        group.appendChild(item);
        options.push(item);
      });
      groups.push(group);
      panel.appendChild(group);
    });
    const empty = document.createElement("p");
    empty.className = "scope-combo__empty";
    empty.textContent = "No matching country. Leave it blank to see the EU rules.";
    empty.hidden = true;
    panel.appendChild(empty);
    wrap.append(input, clear);
    document.body.appendChild(panel);

    const nameOf = (v) => { const o = options.find((x) => x.dataset.value === v); return o ? o.textContent : ""; };
    let active = -1;
    const visible = () => options.filter((o) => !o.hidden);
    function sync() {
      input.value = nameOf(select.value);
      clear.hidden = !input.value;
      options.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.value === select.value)));
    }
    function filter() {
      const q = norm(input.value);
      const showAll = !q || q === norm(nameOf(select.value));
      options.forEach((o) => {
        const n = norm(o.textContent), al = norm(o.dataset.alias || "");
        o.hidden = !showAll && !(n.startsWith(q) || n.split(/[\s-]+/).some((w) => w.startsWith(q)) || al.split(/\s+/).some((w) => w.startsWith(q)) || (q.length > 3 && al.includes(q)));
      });
      groups.forEach((g) => { g.hidden = ![...g.querySelectorAll(".scope-dd__option")].some((o) => !o.hidden); });
      empty.hidden = visible().length > 0;
      setActive(q && !showAll ? 0 : -1);
    }
    function setActive(i) {
      const list = visible();
      options.forEach((o) => o.classList.remove("is-active"));
      if (i < 0 || !list.length) { active = -1; input.removeAttribute("aria-activedescendant"); return; }
      active = Math.max(0, Math.min(list.length - 1, i));
      const o = list[active];
      o.classList.add("is-active");
      input.setAttribute("aria-activedescendant", o.id);
      const pr = panel.getBoundingClientRect(), or = o.getBoundingClientRect();
      if (or.top < pr.top + 40) panel.scrollTop -= pr.top + 40 - or.top;
      else if (or.bottom > pr.bottom - 8) panel.scrollTop += or.bottom - (pr.bottom - 8);
    }
    function place() {
      const r = input.getBoundingClientRect();
      const below = innerHeight - r.bottom - 16, above = r.top - 16;
      const up = below < 200 && above > below;
      panel.style.left = `${r.left}px`;
      panel.style.width = `${r.width}px`;
      panel.style.maxHeight = `${Math.min(400, up ? above : below)}px`;
      panel.style.top = up ? "" : `${r.bottom + 6}px`;
      panel.style.bottom = up ? `${innerHeight - r.top + 6}px` : "";
    }
    function open() {
      if (!panel.hidden) return;
      // On a phone, lift the box under the menu bar so the list (and keyboard) have room.
      const r = input.getBoundingClientRect();
      if (innerHeight - r.bottom < 320) {
        const nav = document.querySelector(".site-nav");
        window.scrollBy(0, r.top - ((nav ? nav.offsetHeight : 76) + 16));
      }
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      filter();
      place();
      panel.scrollTop = 0;
      addEventListener("scroll", place, true);
      addEventListener("resize", place);
    }
    function close() {
      if (panel.hidden) return;
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      removeEventListener("scroll", place, true);
      removeEventListener("resize", place);
    }
    function choose(value) {
      const changed = select.value !== value;
      select.value = value;
      sync();
      close();
      if (changed) select.dispatchEvent(new Event("change"));
    }
    // Leaving the box: keep an exact or single match, clear an empty box, otherwise put the last choice back.
    function settle() {
      const q = norm(input.value);
      if (!q) { choose("eu"); return; }
      const exact = options.find((o) => norm(o.textContent) === q);
      const list = visible();
      if (exact) choose(exact.dataset.value);
      else if (list.length === 1 && !panel.hidden) choose(list[0].dataset.value);
      else { sync(); close(); }
    }

    input.addEventListener("focus", open);
    input.addEventListener("click", open);
    input.addEventListener("input", () => { open(); filter(); clear.hidden = !input.value; });
    input.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowDown") { open(); setActive(active + 1); }
      else if (k === "ArrowUp") { open(); setActive(active - 1); }
      else if (k === "Enter") {
        const list = visible();
        if (!panel.hidden && active >= 0) choose(list[active].dataset.value);
        else settle();
      }
      else if (k === "Escape") { sync(); close(); }
      else if (k === "Tab") { settle(); return; }
      else return;
      e.preventDefault();
    });
    input.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== input && !panel.contains(document.activeElement)) settle(); }, 150));
    clear.addEventListener("click", () => { choose("eu"); input.focus(); });
    panel.addEventListener("pointerdown", (e) => e.preventDefault()); // keep focus in the box
    panel.addEventListener("click", (e) => {
      const o = e.target.closest(".scope-dd__option");
      if (o) { choose(o.dataset.value); input.blur(); }
    });
    panel.addEventListener("mousemove", (e) => {
      const o = e.target.closest(".scope-dd__option");
      const list = visible();
      if (o && list.indexOf(o) !== active) setActive(list.indexOf(o));
    });
    document.addEventListener("pointerdown", (e) => { if (!panel.hidden && !wrap.contains(e.target) && !panel.contains(e.target)) settle(); });
    select.addEventListener("change", sync);
    select.addEventListener("scope:sync", sync);
    sync();
  }

  pickers.forEach((form) => form.querySelectorAll("select").forEach((sel) => (sel.matches("[data-scope-country]") ? combo(sel) : enhance(sel))));

  // Country details for EU countries without a detailed layer yet (FIU and financial supervisor).
  const countryData = (() => { try { return JSON.parse(document.getElementById("scope-countries").textContent); } catch { return {}; } })();
  const checklists = [];
  const NON_EU = ["uk", "ae"]; // countries shown with their own rules only, no EU content

  // Where the business is based: chosen once (next to the industry), carried across industries and pages.
  // It rides along in ?country=, so a shared link keeps the visitor's country.
  const syncUrl = true;
  const countryNames = {};
  document.querySelectorAll("[data-scope-country] option").forEach((o) => { if (o.value) countryNames[o.value] = o.textContent.trim(); });
  const validCountry = (c) => (c && countryNames[c] ? c : "eu");
  let country = validCountry(new URLSearchParams(location.search).get("country") || window.__scopeCountry);
  function scopeUrl(action, slug) {
    return `${action}${country !== "eu" ? `?country=${country}` : ""}#${encodeURIComponent(slug)}`;
  }
  function updateBased() {
    document.querySelectorAll("[data-based]").forEach((p) => {
      p.hidden = false;
      p.querySelector("[data-based-text]").innerHTML = country === "eu" ? "Showing the EU rules." : `Based in <strong>${countryNames[country]}</strong>.`;
      p.querySelector("[data-change-country]").textContent = country === "eu" ? "Add your country" : "Change";
    });
  }
  function setGlobalCountry(c) {
    country = validCountry(c);
    window.__scopeCountry = country;
    document.querySelectorAll("[data-scope-country]").forEach((sel) => {
      if (sel.value !== country) { sel.value = country; sel.dispatchEvent(new Event("scope:sync")); }
    });
    checklists.forEach((set) => set(country));
    updateBased();
    if (syncUrl && onScopePage) {
      const u = new URL(location.href);
      if (country === "eu") u.searchParams.delete("country"); else u.searchParams.set("country", country);
      history.replaceState(history.state, "", u);
    }
  }

  // Self-assessment checklists: live score, readiness level and advice, with an optional country layer
  // (Ireland, Malta, UK). Nothing is stored or sent.
  document.querySelectorAll("[data-scope-check]").forEach((box) => {
    const all = [...box.querySelectorAll(".scope-check__list > li")];
    const result = box.querySelector("[data-check-result]");
    const body = box.querySelector("[data-check-body]");
    const count = box.querySelector("[data-check-count]");
    const total = box.querySelector("[data-check-total]");
    const bar = box.querySelector("[data-check-bar]");
    const level = box.querySelector("[data-check-level]");
    const advice = box.querySelector("[data-check-advice]");
    const when = box.dataset.when;
    let boxCountry = "eu";
    const article = box.closest(".scope-sector") || box;
    result.hidden = false;
    const visible = () => all.filter((li) => !li.hidden).map((li) => li.querySelector("input"));
    function update() {
      const inputs = visible();
      const done = inputs.filter((i) => i.checked).length;
      const pct = inputs.length ? Math.round((done / inputs.length) * 100) : 0;
      const by = NON_EU.includes(boxCountry) ? "" : ` before ${when}`;
      count.textContent = done;
      total.textContent = inputs.length;
      bar.style.width = `${pct}%`;
      let l, a, tone;
      if (done === 0) { l = "Not started"; a = "Tick the items you already have in place to see where you stand."; tone = "none"; }
      else if (pct < 40) { l = "Early stage"; a = `You have important gaps to close${by}. Start with your risk assessment and how you onboard and check clients.`; tone = "low"; }
      else if (pct < 80) { l = "Partly ready"; a = `The basics are in place. Work through the items you haven&rsquo;t ticked, starting with client due diligence${by}.`; tone = "mid"; }
      else if (pct < 100) { l = "Nearly ready"; a = "You&rsquo;re close. Close the remaining gaps and make sure you can show evidence for each item."; tone = "high"; }
      else { l = "Ready on paper"; a = "Everything is in place. Make sure you can show your supervisor evidence for each item, client by client."; tone = "full"; }
      level.textContent = l;
      advice.innerHTML = a;
      result.dataset.tone = tone;
      all.forEach((li) => { const i = li.querySelector("input"); li.querySelector(".scope-check__item").classList.toggle("is-done", i.checked); });
    }
    function setCountry(c) {
      boxCountry = c || "eu";
      const info = countryData[boxCountry];
      const layer = info ? "other" : boxCountry;
      article.querySelectorAll("[data-local]").forEach((d) => { d.hidden = d.dataset.local !== layer; });
      if (info) {
        const cap = (e, t) => (e.hasAttribute("data-cap") ? t.charAt(0).toUpperCase() + t.slice(1) : t);
        article.querySelectorAll("[data-fiu]").forEach((e) => { e.innerHTML = cap(e, info.fiu); });
        article.querySelectorAll("[data-fin]").forEach((e) => { e.innerHTML = cap(e, info.fin); });
        article.querySelectorAll("[data-cname]").forEach((e) => { e.textContent = info.name; });
      }
      // Non-EU views (UK, UAE) are purely local: hide the EU content (deadline tag, why, what it means, steps).
      const nonEU = NON_EU.includes(boxCountry);
      article.querySelectorAll("[data-eu-only]").forEach((e) => { e.hidden = nonEU; });
      article.querySelectorAll("[data-uk-only]").forEach((e) => { e.hidden = boxCountry !== "uk"; });
      article.querySelectorAll("[data-ae-only]").forEach((e) => { e.hidden = boxCountry !== "ae"; });
      article.querySelectorAll("[data-noneu-only]").forEach((e) => { e.hidden = !nonEU; });
      all.forEach((li) => {
        const only = li.dataset.only, hideIn = (li.dataset.hideIn || "").split(",");
        li.hidden = (only && only !== layer) || hideIn.includes(boxCountry);
      });
      body.hidden = nonEU && box.dataset[`${boxCountry}Status`] === "out";
      update();
    }
    checklists.push(setCountry);
    all.forEach((li) => li.querySelector("input").addEventListener("change", update));
    box.querySelector("[data-check-print]").addEventListener("click", (e) => { buildPrint(box); openPreview(e.currentTarget); });
    setCountry(country);
  });
  updateBased();
  document.querySelectorAll("[data-scope-country]").forEach((sel) => {
    if (sel.value !== country) { sel.value = country; sel.dispatchEvent(new Event("scope:sync")); }
    sel.addEventListener("change", () => setGlobalCountry(sel.value));
  });
  // "Change" next to "Based in ...": jump to the location box at the top and open it.
  document.querySelectorAll("[data-change-country]").forEach((b) => b.addEventListener("click", () => {
    const sel = document.querySelector("[data-scope-country]");
    if (!sel) return;
    const box = sel.parentNode.querySelector(".scope-combo__input, .scope-dd__button") || sel;
    box.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    setTimeout(() => { box.focus({ preventScroll: true }); if (box.select) box.select(); }, 450);
  }));

  // Printable report: a one-to-two page A4 summary of the self-assessment, built from what's on screen
  // when someone prints. The rest of the page is hidden in print.
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function itemText(li) {
    const span = li.querySelector(".scope-check__item > span").cloneNode(true);
    const tag = span.querySelector(".scope-check__tag");
    const tagText = tag ? tag.textContent.trim() : "";
    if (tag) tag.remove();
    return { text: span.textContent.trim(), tag: tagText };
  }
  function buildPrint(box) {
    const report = document.getElementById("scope-print");
    if (!report || !box) return;
    if (report.parentNode !== document.body) {
      document.querySelectorAll("body > .scope-print").forEach((old) => { if (old !== report) old.remove(); });
      document.body.appendChild(report);
    }
    const article = box.closest(".scope-sector");
    const industry = article ? article.querySelector(".scope-sector__title").textContent.trim() : "Your business";
    const status = article && article.querySelector(".scope-sector__head .tag[data-eu-only]") ? article.querySelector(".scope-sector__head .tag").textContent.trim() : "";
    const countryName = country === "eu" ? "EU rules only" : countryNames[country];
    const nonEU = NON_EU.includes(country);
    const when = box.dataset.when;
    const visible = [...box.querySelectorAll(".scope-check__list > li")].filter((li) => !li.hidden);
    const out = nonEU && box.dataset[`${country}Status`] === "out";
    const localTag = article ? article.querySelector(`.scope-sector__head .tag[data-${country}-only]`) : null;
    const done = visible.filter((li) => li.querySelector("input").checked);
    const gaps = visible.filter((li) => !li.querySelector("input").checked);
    const pct = visible.length ? Math.round((done.length / visible.length) * 100) : 0;
    const level = box.querySelector("[data-check-level]").textContent;
    const advice = box.querySelector("[data-check-advice]").textContent;
    const row = (li, ok) => { const { text, tag } = itemText(li); return `<li class="${ok ? "is-done" : "is-gap"}"><span class="sp-box" aria-hidden="true">${ok ? "&#10003;" : ""}</span><span>${esc(text)}${tag ? ` <em>${esc(tag)}</em>` : ""}</span></li>`; };
    const scopeEl = article || box;
    const local = [...scopeEl.querySelectorAll("[data-local]")].find((d) => !d.hidden);
    const LAWS = { uk: "the UK Money Laundering Regulations 2017", ae: "the UAE&rsquo;s Federal Decree-Law No. 10 of 2025" };
    const law = nonEU ? LAWS[country] : `the EU Anti-Money Laundering Regulation, which applies from ${when}`;
    let html = `
      <h1 class="sp-title">${esc(industry)}</h1>
      <p class="sp-sub">Readiness under ${law}</p>
      <dl class="sp-meta">
        <div><dt>Based in</dt><dd>${esc(countryName)}</dd></div>
        <div><dt>Status</dt><dd>${esc(nonEU ? (localTag ? localTag.textContent.trim() : "") : status || "In scope")}</dd></div>
        <div><dt>Deadline</dt><dd>${nonEU ? "Already in force" : esc(when)}</dd></div>
      </dl>`;
    if (!out) {
      html += `
      <section class="sp-score">
        <div class="sp-score__num"><strong>${done.length}</strong><span>of ${visible.length} in place</span></div>
        <div class="sp-score__text"><p class="sp-score__level">${esc(level)}</p><p>${esc(advice)}</p>
          <div class="sp-bar"><span style="width:${pct}%"></span></div></div>
        <div class="sp-score__pct">${pct}%</div>
      </section>
      <section class="sp-sec"><h2>Gaps to close <span>${gaps.length}</span></h2>
        ${gaps.length ? `<ul class="sp-list">${gaps.map((li) => row(li, false)).join("")}</ul>` : `<p class="sp-none">No gaps. Everything on the checklist is in place.</p>`}</section>
      <section class="sp-sec"><h2>Already in place <span>${done.length}</span></h2>
        ${done.length ? `<ul class="sp-list sp-list--done">${done.map((li) => row(li, true)).join("")}</ul>` : `<p class="sp-none">Nothing ticked yet.</p>`}</section>`;
    }
    if (local) html += `<section class="sp-sec sp-note"><h2>Your supervisor and local rules</h2>${local.innerHTML}</section>`;
    // "Where finperiti can help": match the client's gaps to what finperiti does today (no transaction monitoring).
    const HELP = [
      { re: /identify and verify every client|identify buyers and sellers|identify every party|identify policy beneficiaries|due diligence is complete|due diligence starts|carry out due diligence on|investor due diligence/i, t: "Client identity checks (KYC)", d: "Verify each client&rsquo;s identity before you take them on, with the result saved to their client file." },
      { re: /beneficial owner|register of beneficial ownership|companies house register|complex ownership|holding structures|nominee|trust registration service/i, t: "Company and ownership checks (KYB)", d: "Check company details and record who owns and controls each company, trust or other entity, including beneficial owners." },
      { re: /screened against|screen clients|pep status|sanctions/i, t: "Sanctions, PEP and adverse media screening", d: "Screen clients at onboarding and keep monitoring them, so you know when something changes." },
      { re: /risk rating|enhanced checks|enhanced due diligence|high risk/i, t: "Client risk rating", d: "Give every client a risk rating and flag who needs enhanced checks." },
      { re: /source of (wealth|funds)|how clients pay/i, t: "Supporting documents", d: "Collect and store supporting documents, such as source of funds and source of wealth evidence, in each client file." },
      { re: /due diligence records|keep .*records/i, t: "Records and audit trail", d: "Every check is logged and stored, ready to show your supervisor." },
      { re: /existing clients/i, t: "Bringing existing clients up to standard", d: "Re-check your current clients against the new standard and track progress client by client." }
    ];
    const gapText = gaps.map((li) => itemText(li).text);
    let helps = HELP.map((h) => ({ ...h, n: gapText.filter((g) => h.re.test(g)).length })).filter((h) => h.n);
    const helpIntro = helps.length ? "Based on your gaps, finperiti can take care of:" : "These are the checks finperiti can run for you, to make what you already do faster and easier to evidence:";
    if (!helps.length) helps = HELP.slice(0, 4).concat(HELP[5]).map((h) => ({ ...h, n: 0 }));
    html += `
      <section class="sp-sec sp-help"><h2>Where finperiti can help</h2><p class="sp-help__intro">${helpIntro}</p>
        <ul class="sp-help__list">${helps.map((h) => `<li><strong>${h.t}</strong>${h.n ? ` <em>${h.n} gap${h.n > 1 ? "s" : ""}</em>` : ""}<span>${h.d}</span></li>`).join("")}</ul>
        <p class="sp-help__foot">finperiti runs inside Microsoft 365, so your team works where it already does. Talk to us: <strong>finperiti.com/contact</strong></p></section>`;
    html += `
      <section class="sp-sec sp-next"><h2>Next steps</h2><ol>
        <li>Close the gaps above, starting with your risk assessment and how you check clients.</li>
        <li>Keep evidence for each item, client by client, so you can show your supervisor.</li>
        <li>See where finperiti can help above, and book a short walkthrough: <strong>finperiti.com/contact</strong></li>
      </ol></section>`;
    report.querySelector("[data-sp-body]").innerHTML = html;
    report.querySelector("[data-sp-date]").textContent = `Prepared ${new Date().toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  // On-screen preview of the report, shown before printing (and the only way to see it where printing is blocked).
  let modal, lastFocus, previewBox;
  function fitPreview() {
    if (!modal || modal.hidden) return;
    const outer = modal.querySelector(".sp-sheet-outer"), wrap = modal.querySelector(".sp-sheet-wrap"), sheet = modal.querySelector(".sp-sheet");
    const avail = modal.querySelector(".sp-modal__body").clientWidth - 32;
    const scale = Math.min(1, avail / sheet.offsetWidth);
    wrap.style.width = `${sheet.offsetWidth}px`;
    wrap.style.transform = `scale(${scale})`;
    outer.style.width = `${sheet.offsetWidth * scale}px`;
    outer.style.height = `${sheet.offsetHeight * scale}px`;
  }
  function closePreview() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove("sp-open");
    removeEventListener("resize", fitPreview);
    if (lastFocus) lastFocus.focus();
  }
  // "Let us email you your report": name and email, sent to the address in data-report-endpoint on <html>
  // (for example the CRM's form webhook). With no address set, the form stays hidden: it must never claim to send.
  function reportPayload(form) {
    const box = previewBox;
    const items = box ? [...box.querySelectorAll("input[type=checkbox]")].filter((i) => !i.closest("[hidden]")) : [];
    const label = (i) => (i.closest("label") || i).textContent.replace(/\s+/g, " ").trim();
    const sector = box ? box.closest(".scope-sector") : null;
    const sheet = modal.querySelector(".sp-sheet");
    return {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      contact_ok: form.followup.checked,
      industry: sector ? (sector.querySelector("h2, h1") || sector).textContent.replace(/\s+/g, " ").trim() : "",
      country: (() => { const s = document.querySelector("[data-scope-country]"); return s && s.selectedIndex > -1 ? s.options[s.selectedIndex].text.trim() : ""; })(),
      in_place: items.filter((i) => i.checked).map(label),
      missing: items.filter((i) => !i.checked).map(label),
      report_text: sheet ? sheet.innerText : "",
      report_html: sheet ? sheet.innerHTML : "",
      page: location.href,
      sent_at: new Date().toISOString()
    };
  }
  function setupEmailForm() {
    const form = modal.querySelector("[data-sp-email]");
    const status = form.querySelector("[data-sp-status]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.name.value.trim(), email = form.email.value.trim();
      form.name.setAttribute("aria-invalid", name ? "false" : "true");
      const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      form.email.setAttribute("aria-invalid", okEmail ? "false" : "true");
      if (!name || !okEmail) {
        status.textContent = !name ? "Please enter your name." : "Please enter a valid email address.";
        (!name ? form.name : form.email).focus();
        return;
      }
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Sending…"; status.textContent = "";
      try {
        const endpoint = document.documentElement.dataset.reportEndpoint || "";
        if (!endpoint) throw new Error("no report endpoint");
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reportPayload(form)) });
        if (!r.ok) throw new Error(r.status);
        form.classList.add("is-sent");
        form.querySelector("[data-sp-done]").textContent = `Thanks, ${name.split(" ")[0]}. Your report is on its way to ${email}.`;
        form.querySelector("[data-sp-done]").focus();
      } catch (err) {
        status.textContent = "Sorry, that didn't send. Please try again in a moment.";
        btn.disabled = false; btn.textContent = "Email me my report";
      }
    });
  }
  function resetEmailForm() {
    const form = modal.querySelector("[data-sp-email]");
    form.classList.remove("is-sent");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = false; btn.textContent = "Email me my report";
    form.querySelector("[data-sp-status]").textContent = "";
  }
  function openPreview(trigger) {
    const report = document.getElementById("scope-print");
    if (!report) { window.print(); return; }
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "sp-modal";
      modal.hidden = true;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "sp-modal-title");
      modal.innerHTML = `
        <div class="sp-modal__bar">
          <p class="sp-modal__title" id="sp-modal-title">Your report</p>
          <button class="sp-modal__close" type="button" data-sp-close aria-label="Close">&times;</button>
        </div>
        <div class="sp-modal__body">
          <p class="sp-modal__hint">Here&rsquo;s a preview of your report.</p>
          <div class="sp-sheet-outer" style="margin:0 auto"><div class="sp-sheet-wrap"><div class="sp-sheet"></div></div></div>
          <form class="sp-email" data-sp-email novalidate>
            <div class="sp-email__form">
              <p class="sp-email__title">Let us email you your report</p>
              <p class="sp-email__text">Enter your name and email and we&rsquo;ll send a copy of this report to your inbox.</p>
              <div class="sp-email__row">
                <label class="sp-email__field"><span>Name</span><input name="name" type="text" autocomplete="name" required></label>
                <label class="sp-email__field"><span>Email</span><input name="email" type="email" autocomplete="email" inputmode="email" required></label>
              </div>
              <label class="sp-email__consent"><input type="checkbox" name="followup"><span>finperiti can contact me about my results (optional)</span></label>
              <div class="sp-email__actions">
                <button class="btn btn--primary" type="submit">Email me my report</button>
                <p class="sp-email__status" data-sp-status role="status" aria-live="polite"></p>
              </div>
              <p class="sp-email__small">We use your details to send this report. See our <a href="/privacy-policy">privacy notice</a>.</p>
            </div>
            <p class="sp-email__done" data-sp-done tabindex="-1" role="status"></p>
          </form>
          <div class="sp-email" data-sp-keep hidden>
            <p class="sp-email__title">Keep a copy of your report</p>
            <p class="sp-email__text">Print it, or choose &ldquo;Save as PDF&rdquo; in the print dialog.</p>
            <div class="sp-email__actions"><button class="btn btn--primary" type="button" data-sp-print>Print or save as PDF</button></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector("[data-sp-close]").addEventListener("click", closePreview);
      setupEmailForm();
      if (!document.documentElement.dataset.reportEndpoint) {
        modal.querySelector("[data-sp-email]").hidden = true;
        modal.querySelector("[data-sp-keep]").hidden = false;
      }
      modal.querySelector("[data-sp-print]").addEventListener("click", () => window.print());
      modal.addEventListener("click", (e) => { if (e.target === modal || e.target.classList.contains("sp-modal__body")) closePreview(); });
      modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); closePreview(); }
        if (e.key === "Tab") { // keep focus inside the dialog
          const f = [...modal.querySelectorAll("button:not([disabled]), input, a[href]")].filter((el) => el.offsetParent !== null);
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
    }
    previewBox = trigger.closest("[data-scope-check]");
    const copy = report.cloneNode(true);
    copy.removeAttribute("id");
    copy.removeAttribute("aria-hidden");
    const sheet = modal.querySelector(".sp-sheet");
    sheet.replaceChildren(copy);
    lastFocus = trigger;
    resetEmailForm();
    modal.hidden = false;
    document.documentElement.classList.add("sp-open");
    modal.querySelector(".sp-modal__body").scrollTop = 0;
    fitPreview();
    addEventListener("resize", fitPreview);
    const img = copy.querySelector("img");
    if (img && !img.complete) img.addEventListener("load", fitPreview, { once: true });
    modal.querySelector("[data-sp-close]").focus();
  }

  // Ctrl+P / browser menu: print the industry that's open.
  window.addEventListener("beforeprint", () => {
    const open = [...document.querySelectorAll(".scope-sector")].find((a) => !a.hidden && a.querySelector("[data-scope-check]"));
    if (open) buildPrint(open.querySelector("[data-scope-check]"));
  });

  // On the home page: choosing an industry goes straight to its page.
  if (!onScopePage) {
    pickers.forEach((form) => {
      const select = form.querySelector("select[name=sector]");
      const go = (e) => {
        if (e) e.preventDefault();
        if (select.value) location.href = scopeUrl(form.action, select.value);
        else select.parentNode.querySelector(".scope-dd__button").focus();
      };
      form.addEventListener("submit", go);
    });
    return;
  }

  const index = document.querySelector("[data-scope-index]");
  const back = document.querySelector("[data-scope-back]");
  const baseTitle = document.title;
  const ids = new Set(sectors.map((s) => s.id));

  function show(slug, focus) {
    const valid = ids.has(slug);
    sectors.forEach((s) => { s.hidden = valid ? s.id !== slug : true; });
    index.hidden = valid;
    back.hidden = !valid;
    pickers.forEach((form) => {
      const select = form.querySelector("select[name=sector]");
      select.value = valid ? slug : "";
      select.dispatchEvent(new Event("scope:sync"));
    });
    if (!valid) { document.title = baseTitle; return; }
    const article = document.getElementById(slug);
    const name = article.querySelector(".scope-sector__title").textContent;
    document.title = `${name}: EU AML rules 2027 | finperiti`;
    if (focus) {
      article.setAttribute("tabindex", "-1");
      article.focus({ preventScroll: true });
      article.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }

  // ?sector=slug from the home page form without JavaScript → turn it into #slug.
  const query = new URLSearchParams(location.search).get("sector");
  if (query && ids.has(query) && syncUrl) history.replaceState(null, "", scopeUrl(location.pathname, query));

  const current = () => decodeURIComponent(location.hash.slice(1));
  show(current(), Boolean(current()));
  window.addEventListener("hashchange", () => show(current(), true));
  // Industry links on this page change the #slug only, so ?country= (and the chosen country) is kept.
  const samePage = (a) => a.pathname.replace(/\.html$/, "") === location.pathname.replace(/\.html$/, "");
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href*='#']");
    if (!a || !a.hash || !samePage(a) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    location.hash = a.hash;
  });

  pickers.forEach((form) => {
    const select = form.querySelector("select[name=sector]");
    const go = (e) => {
      if (e) e.preventDefault();
      if (!select.value) { select.parentNode.querySelector(".scope-dd__button").focus(); return; }
      if (current() === select.value) show(select.value, true);
      else location.hash = "#" + select.value;
    };
    form.addEventListener("submit", go);
    select.addEventListener("change", () => go());
  });
})();
