/* finperiti — shared form sending (contact form + pricing "email me this estimate")
 * Posts a form to the Web3Forms endpoint in its action attribute and resolves only when
 * the service confirms delivery. Each page script keeps its own validation messages and UI.
 */
(function () {
  "use strict";

  window.fpForms = {
    supported: !!(window.fetch && window.FormData),

    // Honeypot: people never tick the hidden "botcheck" box, so drop those submissions silently.
    isBot: function (form) { return !!(form.botcheck && form.botcheck.checked); },

    send: function (form) {
      return fetch(form.action, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (!json || !json.success) throw new Error("not sent");
          return json;
        });
    },

    // Disables the submit button and swaps its label ([data-label] child, or the button text) while sending.
    busy: function (button, on) {
      var label = button.querySelector("[data-label]") || button;
      if (!button.hasAttribute("data-idle-label")) button.setAttribute("data-idle-label", label.textContent);
      button.disabled = on;
      button.setAttribute("aria-busy", String(on));
      label.textContent = on ? "Sending…" : button.getAttribute("data-idle-label");
    }
  };
})();
