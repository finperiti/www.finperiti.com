/* finperiti — contact form
 * Same behaviour as the live site: native HTML validation, a honeypot field,
 * and an AJAX POST to the Web3Forms endpoint in the form's action attribute
 * (configured in site.config.json → formEndpoint / formAccessKey) via forms.js.
 * Without JavaScript the form still posts normally to the endpoint.
 */
(function () {
  "use strict";

  var form = document.querySelector("[data-contact-form]");
  if (!form || !window.fpForms || !fpForms.supported) return;

  var ok = document.getElementById("ctSuccess");
  var err = document.getElementById("ctError");
  var submit = form.querySelector("[type=submit]");

  function show(el) {
    ok.hidden = el !== ok;
    err.hidden = el !== err;
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // Style invalid fields only after the first attempt (mirrors live behaviour).
  form.addEventListener("invalid", function () { form.classList.add("was-validated"); }, true);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      var first = form.querySelector(":invalid:not([type=hidden])");
      if (first) first.focus();
      return;
    }
    if (fpForms.isBot(form)) return;

    show(null);
    fpForms.busy(submit, true);
    fpForms.send(form)
      .then(function () {
        show(ok);
        form.reset();
        form.classList.remove("was-validated");
      })
      .catch(function () { show(err); })
      .then(function () { fpForms.busy(submit, false); });
  });
})();
