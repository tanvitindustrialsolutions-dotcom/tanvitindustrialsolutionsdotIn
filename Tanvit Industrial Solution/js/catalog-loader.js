(function () {
  "use strict";

  function ready(list) {
    if (window.TanvitStore && typeof TanvitStore.ingestProducts === "function") {
      TanvitStore.ingestProducts(list);
    }
    window.dispatchEvent(new CustomEvent("tanvit-catalog-ready", { detail: { count: list.length } }));
  }

  function tryParse(json) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.products)) return json.products;
    return null;
  }

  async function load() {
    const urls = [];
    if (typeof TanvitSiteConfig !== "undefined" && TanvitSiteConfig.catalogUrl) {
      urls.push(String(TanvitSiteConfig.catalogUrl).trim());
    }
    urls.push("/api/catalog");
    urls.push("/data/catalog.json");

    for (let u = 0; u < urls.length; u++) {
      const url = urls[u];
      if (!url) continue;
      try {
        const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) continue;
        const json = await res.json();
        const list = tryParse(json);
        if (list && list.length) {
          ready(list);
          return;
        }
      } catch (_) {
        /* try next URL */
      }
    }

    console.warn("Tanvit: catalog could not be loaded. Check that data/catalog.json is deployed and reachable.");
    ready([]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
