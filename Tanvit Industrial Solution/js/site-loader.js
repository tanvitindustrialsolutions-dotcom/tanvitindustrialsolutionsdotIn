(function () {
  "use strict";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;");
  }

  function buildSlideArticle(slide, index, total) {
    const photoCenter = !!slide.photoCenter;
    const centerClass = photoCenter ? " hero-slide--photo-center" : "";
    const hidden = index > 0 ? ' aria-hidden="true"' : "";
    const fetchPri = index === 0 ? ' fetchpriority="high"' : "";
    const loading = index === 0 ? "eager" : "lazy";
    const alt = slide.alt != null ? String(slide.alt) : "";
    return (
      `<article class="hero-slide hero-slide--media${centerClass}" aria-label="Slide ${index + 1} of ${total}"${hidden}>` +
      `<div class="hero-slide-media">` +
      `<img src="${escAttr(slide.image)}" alt="${escAttr(alt)}" width="1200" height="800" decoding="async"${fetchPri} loading="${loading}">` +
      `</div>` +
      `<div class="hero-slide-scrim" aria-hidden="true"></div>` +
      `<div class="hero-slide-inner">` +
      `<p class="hero-eyebrow">${esc(slide.eyebrow || "")}</p>` +
      `<h1>${esc(slide.title || "")}</h1>` +
      `<p class="tagline">${esc(slide.tagline || "")}</p>` +
      `<div class="hero-actions">` +
      `<a class="btn btn-primary" href="${escAttr(slide.primaryHref || "#")}">${esc(slide.primaryLabel || "")}</a>` +
      `<a class="btn btn-secondary" href="${escAttr(slide.secondaryHref || "#")}">${esc(slide.secondaryLabel || "")}</a>` +
      `</div></div></article>`
    );
  }

  function applySite(site) {
    if (!site || !Array.isArray(site.slides) || site.slides.length === 0) return false;
    if (site.slides.length > 6) return false;

    const track = document.getElementById("heroSliderTrack");
    const dotsWrap = document.querySelector(".hero-slider-dots");
    if (!track || !dotsWrap) return false;

    const total = site.slides.length;
    track.innerHTML = site.slides.map((s, i) => buildSlideArticle(s, i, total)).join("");

    dotsWrap.innerHTML = site.slides
      .map(
        (_, i) =>
          `<button type="button" class="hero-slider-dot" role="tab" aria-selected="${i === 0 ? "true" : "false"}" aria-label="Slide ${i + 1}"></button>`
      )
      .join("");

    const copy = site.copy && typeof site.copy === "object" ? site.copy : {};
    const sec = document.querySelector(".section--clients .section-title");
    if (sec) {
      const h2 = sec.querySelector("h2");
      const p = sec.querySelector("p");
      if (h2 && copy.homeClientsHeading) h2.textContent = String(copy.homeClientsHeading);
      if (p && copy.homeClientsSub) p.textContent = String(copy.homeClientsSub);
    }

    const first = site.slides[0] && site.slides[0].image;
    if (first) {
      let preload = document.querySelector('link[rel="preload"][as="image"][data-tanvit-slide]');
      if (!preload) {
        preload = document.createElement("link");
        preload.rel = "preload";
        preload.as = "image";
        preload.setAttribute("data-tanvit-slide", "1");
        document.head.appendChild(preload);
      }
      preload.href = first;
    }

    return true;
  }

  function applyClients(doc) {
    if (!doc || !Array.isArray(doc.clients) || doc.clients.length === 0) return false;
    const ul = document.querySelector(".section--clients ul.clients-grid");
    if (!ul) return false;

    ul.innerHTML = doc.clients
      .map((c) => {
        const w = Number(c.width) > 0 ? Number(c.width) : 280;
        const h = Number(c.height) > 0 ? Number(c.height) : 88;
        const logo = String(c.logo || "").trim();
        const alt = String(c.alt || c.name || "").trim();
        return (
          `<li class="clients-item" data-client-id="${escAttr(c.id || "")}">` +
          `<div class="clients-logo">` +
          `<img src="${escAttr(logo)}" alt="${escAttr(alt)}" width="${w}" height="${h}" loading="lazy" decoding="async">` +
          `</div></li>`
        );
      })
      .join("");
    return true;
  }

  async function fetchJson(url) {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) return null;
    try {
      return await r.json();
    } catch {
      return null;
    }
  }

  async function run() {
    try {
      const [site, clients] = await Promise.all([fetchJson("/data/site.json"), fetchJson("/data/clients.json")]);
      if (site) applySite(site);
      if (clients) applyClients(clients);
    } catch {
      /* keep static HTML */
    }
    if (typeof window.TanvitInitHeroSlider === "function") {
      window.TanvitInitHeroSlider();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
