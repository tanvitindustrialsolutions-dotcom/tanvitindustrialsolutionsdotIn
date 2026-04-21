(function () {
  "use strict";

  var ENDPOINT = "https://api.web3forms.com/submit";

  /**
   * POST enquiry to Web3Forms (delivers to the email registered for the access key).
   * @param {Record<string, string>} fields Must include name, email, subject, message (and access_key is added here).
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  function submit(fields) {
    var key =
      typeof TanvitSiteConfig !== "undefined" && TanvitSiteConfig.web3formsAccessKey
        ? String(TanvitSiteConfig.web3formsAccessKey).trim()
        : "";
    if (!key) {
      return Promise.resolve({
        ok: false,
        error:
          "Form delivery is not configured yet. Add your Web3Forms access key in js/site-config.js — see docs/OPERATIONS.md. You can still reach us by phone on +91-9414110440."
      });
    }

    var body = Object.assign({ access_key: key }, fields);

    return fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        if (data && data.success === true) return { ok: true };
        var msg =
          (data && data.message) ||
          "Could not send your message. Please try again or call +91-9414110440.";
        return { ok: false, error: msg };
      })
      .catch(function () {
        return { ok: false, error: "Network error. Check your connection or try again later." };
      });
  }

  window.TanvitEnquirySubmit = { submit: submit };
})();
