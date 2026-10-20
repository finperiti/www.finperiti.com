/* finperiti — pricing calculators + "email me this estimate"
 * Used on the product pages: /aml has the AML panel, /iq the IQ panel; each part runs only
 * when its panel is on the page.
 * The page renders the default estimate without JavaScript; this script makes the
 * plan switches and sliders live, and sends lead requests through forms.js.
 * Prices come from the buttons' data-value attributes (set from site.config.json at build).
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-calculator]");
  if (!root) return;
  // Assumptions come from site.config.json via data attributes, same as the server-rendered defaults.
  var automation = Number(root.getAttribute("data-automation"));
  var staffDay = Number(root.getAttribute("data-staff-day"));
  var $ = function (sel) { return root.querySelector(sel); };
  var num = function (n) { return Math.round(n).toLocaleString("en-IE"); };
  var eur = function (n) { return "€" + num(n); };

  var amlDesc = {
    essentials: "The full finperiti AML platform, hosted and managed by us. Up and running in minutes, no IT team required.",
    professional: "Everything in Essentials, with your document vault in your firm’s own Microsoft 365 tenant and Binarii Labs split-cloud storage."
  };

  function pressed(name) { return root.querySelector('[data-seg="' + name + '"] [aria-pressed="true"]'); }
  function value(name) { return Number(pressed(name).getAttribute("data-value")); }
  // Only touch the DOM when a value really changes: no needless repaints, and the
  // aria-live result areas announce real changes only.
  function setText(sel, text) {
    var el = $(sel);
    text = String(text);
    if (el.textContent !== text) el.textContent = text;
  }
  function setHidden(el, hidden) { if (el.hidden !== hidden) el.hidden = hidden; }

  function setFill(range) { range.style.setProperty("--pct", ((range.value - range.min) / (range.max - range.min)) * 100 + "%"); }

  var aml = root.querySelector('[data-calc="aml"]');
  var iq = root.querySelector('[data-calc="iq"]');

  function calc() {
    if (aml) calcAml();
    if (iq) calcIq();
  }

  function calcAml() {
    // finperiti AML: per entity; Groups (0) swaps the figures for a quote request
    var planBtn = pressed("aml-plan");
    var plan = value("aml-plan");
    aml.querySelectorAll("[data-priced]").forEach(function (el) { setHidden(el, !plan); });
    setHidden(aml.querySelector("[data-quote]"), !!plan);
    if (plan) {
      setText("#pc-aml-desc", amlDesc[planBtn.textContent.trim().toLowerCase()] || "");
      setText("#pc-aml-m", eur(plan));
      setText("#pc-aml-y", eur(plan * 12));
    }

    // Time saved: share of manual onboarding time automated, per staff day
    var clients = Number($("#pc-clients").value);
    var hrs = Number($("#pc-hrs").value);
    var perClient = hrs * automation;
    var saved = clients * perClient;
    setText("#pc-clients-out", clients);
    setText("#pc-hrs-out", hrs);
    setText("#pc-t-h", num(saved));
    setText("#pc-t-d", num(saved / staffDay));
    setText("#pc-t-c", (perClient % 1 ? perClient.toFixed(1) : perClient) + " hrs");
  }

  function calcIq() {
    // finperiti IQ: per fund report × filings per year
    var funds = Number($("#pc-funds").value);
    var reports = funds * value("iq-freq");
    setText("#pc-funds-out", funds);
    setText("#pc-iq-r", reports);
    setText("#pc-iq-y", eur(reports * value("iq-plan")));
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest(".seg button");
    if (!b || b.getAttribute("aria-pressed") === "true") return;
    b.parentNode.querySelectorAll("button").forEach(function (x) {
      x.setAttribute("aria-pressed", String(x === b));
    });
    calc();
  });
  // Sliders only — typing in the estimate forms must not recalculate or re-announce results.
  // The dragged slider's fill follows at once; the figures update once per frame.
  var queued = false;
  root.addEventListener("input", function (e) {
    if (e.target.type !== "range") return;
    setFill(e.target);
    if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; calc(); }); }
  });
  root.querySelectorAll("input[type=range]").forEach(setFill);
  calc();

  /* ---------- Lead capture: email the current estimate ---------- */
  if (!window.fpForms || !fpForms.supported) return;

  function text(sel) { return $(sel).textContent.trim(); }
  function chosen(name) {
    var b = pressed(name);
    return b.getAttribute("data-name") || b.textContent.trim();
  }
  function summary(kind) {
    if (kind === "aml") {
      var plan = chosen("aml-plan");
      return [
        "Product: finperiti AML",
        "Plan: " + plan,
        plan === "Groups" ? "Price: custom quote requested"
          : "Price per legal entity: " + text("#pc-aml-m") + " a month, " + text("#pc-aml-y") + " a year",
        "New clients onboarded per year: " + text("#pc-clients-out"),
        "Hours per manual onboarding today: " + text("#pc-hrs-out"),
        "Estimated hours saved yearly: " + text("#pc-t-h"),
        "Estimated staff days saved: " + text("#pc-t-d"),
        "Estimated time saved per client: " + text("#pc-t-c")
      ].join("\n");
    }
    return [
      "Product: finperiti IQ (AIFMD Annex IV)",
      "Plan: " + chosen("iq-plan"),
      "Funds: " + text("#pc-funds-out"),
      "Filing frequency: " + chosen("iq-freq"),
      "Reports per year: " + text("#pc-iq-r"),
      "Estimated annual cost: " + text("#pc-iq-y")
    ].join("\n");
  }

  root.querySelectorAll("[data-lead]").forEach(function (box) {
    var kind = box.getAttribute("data-lead");
    var bar = box.querySelector(".lead-box__bar");
    var open = box.querySelector(".lead-box__open");
    var form = box.querySelector("form");
    var done = box.querySelector(".lead-box__done");
    var err = box.querySelector(".lead-box__error");
    var submit = form.querySelector("[type=submit]");

    function fail(message, field) {
      err.textContent = message;
      err.hidden = false;
      if (field) field.focus();
    }

    open.addEventListener("click", function () {
      form.hidden = false;
      bar.hidden = true;
      open.setAttribute("aria-expanded", "true");
      form.email.focus();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      if (fpForms.isBot(form)) return;
      if (!form.email.value || !form.email.checkValidity()) return fail("Please enter a valid work email address.", form.email);
      if (!form.firm.value.trim()) return fail("Please enter your firm name.", form.firm);
      form.estimate.value = summary(kind);

      fpForms.busy(submit, true);
      fpForms.send(form)
        .then(function () {
          box.querySelector("[data-lead-to]").textContent = form.email.value.trim();
          form.hidden = true;
          done.hidden = false;
        })
        .catch(function () {
          fail("Sorry, that didn’t send. Please try again or email team@finperiti.com.");
        })
        .then(function () { fpForms.busy(submit, false); });
    });
  });
})();
