(function () {
  const root = document.getElementById("highlightRoot");
  const empty = document.getElementById("highlightEmpty");
  const toolbar = document.getElementById("highlightToolbar");
  if (!root) return;

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  function escAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  /** html2canvas UMD exposes `window.html2canvas` (sometimes .default) */
  function getHtml2Canvas() {
    const g = typeof globalThis !== "undefined" ? globalThis : window;
    const h = g.html2canvas;
    if (typeof h === "function") return h;
    if (h && typeof h.default === "function") return h.default;
    return null;
  }

  /** jsPDF 2.x UMD: `window.jspdf.jsPDF` */
  function getJsPDFConstructor() {
    const g = typeof globalThis !== "undefined" ? globalThis : window;
    const j = g.jspdf;
    if (!j) return null;
    if (typeof j.jsPDF === "function") return j.jsPDF;
    if (j.default && typeof j.default.jsPDF === "function") return j.default.jsPDF;
    return null;
  }

  /** CSS that often breaks or distorts html2canvas snapshots */
  function stripSnapshotCssInClone(clonedRoot) {
    if (!clonedRoot) return;
    clonedRoot.style.animation = "none";
    clonedRoot.style.transform = "none";
    clonedRoot.querySelectorAll("*").forEach((el) => {
      if (!el.style) return;
      el.style.animation = "none";
      el.style.transition = "none";
      el.style.transform = "none";
      try {
        el.style.setProperty("filter", "none", "important");
        el.style.setProperty("-webkit-filter", "none", "important");
        el.style.setProperty("backdrop-filter", "none", "important");
        el.style.setProperty("-webkit-backdrop-filter", "none", "important");
        el.style.setProperty("mix-blend-mode", "normal", "important");
      } catch (_) {
        el.style.filter = "none";
        el.style.webkitFilter = "none";
      }
    });
  }

  /** Wait until every image in the export node has loaded (or errored). */
  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll("img"));
    return Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 15000);
          })
      )
    );
  }

  /**
   * Re-encode same-origin raster images as data URLs so the html2canvas result
   * is not "tainted" (fixes PNG/PDF export when the browser treats file or CORS oddly).
   */
  function imgUrlIsSameOriginForFetch(url) {
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
    try {
      const abs = new URL(url, window.location.href);
      return abs.origin === window.location.origin;
    } catch (_) {
      return false;
    }
  }

  async function inlineFlyerImagesAsDataUrls(container) {
    if (window.location.protocol === "file:") return;
    const imgs = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.currentSrc || img.src;
        if (!imgUrlIsSameOriginForFetch(src)) return;
        try {
          const res = await fetch(src, { credentials: "same-origin", cache: "force-cache" });
          if (!res.ok) return;
          const blob = await res.blob();
          if (!blob.type.startsWith("image/")) return;
          const dataUrl = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => reject(new Error("read"));
            fr.readAsDataURL(blob);
          });
          img.src = dataUrl;
          if (img.decode) {
            await img.decode().catch(() => {});
          }
        } catch (_) {
          /* keep original src */
        }
      })
    );
  }

  function setExportBusy(busy) {
    if (!toolbar) return;
    toolbar.setAttribute("aria-busy", busy ? "true" : "false");
    toolbar.querySelectorAll("button").forEach((btn) => {
      btn.disabled = busy;
    });
  }

  function getExportEl() {
    return document.getElementById("highlightExport");
  }

  const STORAGE_FLYER_THEME = "tanvit_highlight_flyer_theme_v1";
  const FLYER_THEME_IDS = ["classic", "minimal", "bold", "studio"];
  const STORAGE_HIGHLIGHT_MODE = "tanvit_highlight_mode_v1";
  const STORAGE_HIGHLIGHT_CATEGORY = "tanvit_highlight_category_v1";
  const STORAGE_HIGHLIGHT_COUNT = "tanvit_highlight_count_v1";
  const STORAGE_HIGHLIGHT_MANUAL_IDS = "tanvit_highlight_manual_ids_v1";

  const selectionState = {
    mode: "category",
    category: "",
    count: 4,
    manualIds: [],
    refreshNonce: 0
  };

  function categoryKeyFromProduct(p) {
    if (TanvitStore.productCategoryKey) return TanvitStore.productCategoryKey(p);
    return String(p.weldingCategory || p.machineryCategory || p.consumablesCategory || "").trim();
  }

  function availableCategories() {
    const seen = new Set();
    const out = [];
    TanvitStore.PRODUCTS.forEach((p) => {
      const key = categoryKeyFromProduct(p);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ key, label: TanvitStore.productCategoryLabel(p) });
    });
    return out;
  }

  function loadSelectionState() {
    try {
      const mode = localStorage.getItem(STORAGE_HIGHLIGHT_MODE);
      if (mode === "category" || mode === "manual") selectionState.mode = mode;
      const category = localStorage.getItem(STORAGE_HIGHLIGHT_CATEGORY);
      selectionState.category = category ? String(category) : "";
      const count = parseInt(localStorage.getItem(STORAGE_HIGHLIGHT_COUNT) || "4", 10);
      selectionState.count = Number.isFinite(count) ? Math.min(24, Math.max(1, count)) : 4;
      const rawIds = localStorage.getItem(STORAGE_HIGHLIGHT_MANUAL_IDS) || "";
      selectionState.manualIds = rawIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    } catch (_) {
      /* ignore */
    }
  }

  function saveSelectionState() {
    try {
      localStorage.setItem(STORAGE_HIGHLIGHT_MODE, selectionState.mode);
      localStorage.setItem(STORAGE_HIGHLIGHT_CATEGORY, selectionState.category || "");
      localStorage.setItem(STORAGE_HIGHLIGHT_COUNT, String(selectionState.count));
      localStorage.setItem(STORAGE_HIGHLIGHT_MANUAL_IDS, selectionState.manualIds.join(","));
    } catch (_) {
      /* ignore */
    }
  }

  function rotatePick(list, count) {
    if (!list.length) return [];
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + selectionState.refreshNonce;
    const start = Math.abs(seed) % list.length;
    const out = [];
    const want = Math.min(count, list.length);
    for (let i = 0; i < want; i++) out.push(list[(start + i) % list.length]);
    return out;
  }

  function getSelectedHighlightProducts() {
    const count = Math.min(Math.max(1, selectionState.count), 24);
    if (selectionState.mode === "manual") {
      const map = new Map(TanvitStore.PRODUCTS.map((p) => [p.id, p]));
      return selectionState.manualIds.map((id) => map.get(id)).filter(Boolean).slice(0, count);
    }
    let pool = TanvitStore.PRODUCTS.slice();
    if (selectionState.category) {
      pool = pool.filter((p) => categoryKeyFromProduct(p) === selectionState.category);
    }
    return rotatePick(pool, count);
  }

  function normalizeFlyerTheme(id) {
    const v = String(id || "").toLowerCase().trim();
    return FLYER_THEME_IDS.includes(v) ? v : "classic";
  }

  function getResolvedFlyerTheme() {
    try {
      const raw = localStorage.getItem(STORAGE_FLYER_THEME);
      if (raw != null && raw !== "") {
        return normalizeFlyerTheme(raw);
      }
    } catch (_) {
      /* ignore */
    }
    const cfg = TanvitStore.getDailyHighlight();
    return normalizeFlyerTheme(cfg.flyerTheme);
  }

  function syncFlyerThemeSelect() {
    const sel = document.getElementById("highlightFlyerTheme");
    if (!sel) return;
    const t = getResolvedFlyerTheme();
    if (sel.value !== t) sel.value = t;
  }

  function flyerThemeClassAttr() {
    const t = getResolvedFlyerTheme();
    return t === "classic" ? "" : ` highlight-flyer--theme-${t}`;
  }

  function openWhatsAppShare() {
    const cfg = TanvitStore.getDailyHighlight();
    const title = cfg.title || "Today's highlight";
    const lines = [
      `*${title}* — Tanvit Industrial Solutions`,
      "",
      "View today's featured products & request a wholesale quote.",
      "",
      "A Trusted partner for Industry."
    ];
    const text = lines.join("\n");
    const url = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function flyerTelHref(mobile) {
    const d = String(mobile).replace(/[^\d+]/g, "");
    if (!d) return "";
    return d.startsWith("+") ? d : `+${d}`;
  }

  const FLYER_ICON_PHONE =
    '<svg class="highlight-flyer__contact-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>';
  const FLYER_ICON_MAIL =
    '<svg class="highlight-flyer__contact-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';

  function flyerContactSectionHtml(cfg) {
    const mob = cfg.flyerMobile && String(cfg.flyerMobile).trim();
    const em = cfg.flyerEmail && String(cfg.flyerEmail).trim();
    const extra = cfg.flyerContactLine && String(cfg.flyerContactLine).trim();
    if (!mob && !em && !extra) return "";
    const tiles = [];
    if (mob) {
      const tel = flyerTelHref(mob);
      tiles.push(
        `<a class="highlight-flyer__contact-tile" href="tel:${escAttr(tel)}">
          <span class="highlight-flyer__contact-icon" aria-hidden="true">${FLYER_ICON_PHONE}</span>
          <span class="highlight-flyer__contact-tile-body">
            <span class="highlight-flyer__contact-channel">Mobile</span>
            <span class="highlight-flyer__contact-value">${esc(mob)}</span>
          </span>
        </a>`
      );
    }
    if (em) {
      tiles.push(
        `<a class="highlight-flyer__contact-tile" href="mailto:${escAttr(em)}">
          <span class="highlight-flyer__contact-icon" aria-hidden="true">${FLYER_ICON_MAIL}</span>
          <span class="highlight-flyer__contact-tile-body">
            <span class="highlight-flyer__contact-channel">Email</span>
            <span class="highlight-flyer__contact-value">${esc(em)}</span>
          </span>
        </a>`
      );
    }
    const extraHtml = extra
      ? `<p class="highlight-flyer__contact-extra"><span class="highlight-flyer__contact-extra-inner">${esc(extra)}</span></p>`
      : "";
    return `<section class="highlight-flyer__contact-card" aria-label="Contact">
      <div class="highlight-flyer__contact-head">
        <h3 class="highlight-flyer__contact-title">Contact us</h3>
        <p class="highlight-flyer__contact-lead">Wholesale quotes &amp; product enquiries</p>
      </div>
      <div class="highlight-flyer__contact-grid">${tiles.join("")}</div>
      ${extraHtml}
    </section>`;
  }

  function flyerBulletsHtml(cfg) {
    const raw = Array.isArray(cfg.flyerBullets) ? cfg.flyerBullets : [];
    const lines = raw.map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
    if (!lines.length) {
      return [
        "Genuine brands & traceable specifications",
        "Prices incl. taxes where shown on the sheet",
        "Wholesale quotes & delivery on enquiry"
      ]
        .map((b) => `<li>${esc(b)}</li>`)
        .join("");
    }
    return lines.map((b) => `<li>${esc(b)}</li>`).join("");
  }

  function renderHighlightSheet() {
    const cfg = TanvitStore.getDailyHighlight();
    const products = getSelectedHighlightProducts();

    if (!products.length) {
      root.innerHTML = "";
      empty.hidden = false;
      empty.textContent =
        "Featured products will appear here soon. For the latest offers, browse the shop or contact us.";
      if (toolbar) toolbar.hidden = true;
      syncFlyerThemeSelect();
      return;
    }

    empty.hidden = true;
    if (toolbar) toolbar.hidden = false;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const isoDate = now.toISOString().slice(0, 10);

    const title = cfg.title || "Today's highlight";
    const modeTitle =
      selectionState.mode === "manual"
        ? "Manual selection"
        : selectionState.category
          ? "Category spotlight"
          : "Catalog spotlight";
    const subtitle = cfg.subtitle || "";
    const footnote = cfg.footnote || "";
    const contactSection = flyerContactSectionHtml(cfg);

    const items = products
      .map((p, i) => {
        const brand = TanvitStore.productBrand(p);
        const cat = TanvitStore.productCategoryLabel(p);
        const img = TanvitStore.productImageUrl(p);
        const mo = TanvitStore.productMinOrder(p);
        const n = i + 1;
        const priceBlock = TanvitStore.productHidePrice(p)
          ? `<div class="highlight-flyer__price-row"><span class="highlight-flyer__price-label">Price</span><p class="highlight-flyer__price highlight-flyer__price--quote"><span class="highlight-flyer__price-note">On quotation</span></p></div>`
          : `<div class="highlight-flyer__price-row"><span class="highlight-flyer__price-label">List</span><p class="highlight-flyer__price">${esc(TanvitStore.money(p.price))}<span class="highlight-flyer__price-note">incl. taxes</span></p></div>`;
        return `<article class="highlight-flyer__card">
        <span class="highlight-flyer__card-badge" aria-hidden="true">${n}</span>
        <div class="highlight-flyer__card-ribbon" aria-hidden="true"></div>
        <div class="highlight-flyer__card-photo">
          <img src="${escAttr(img)}" alt="" width="480" height="360" decoding="async" fetchpriority="high">
        </div>
        <div class="highlight-flyer__card-body">
          ${brand ? `<p class="highlight-flyer__brand">${esc(brand)}</p>` : ""}
          <h2 class="highlight-flyer__name">${esc(p.name)}</h2>
          <p class="highlight-flyer__cat">${esc(cat)}</p>
          ${priceBlock}
          <div class="highlight-flyer__card-footer">
            <p class="highlight-flyer__mo">Min. order <strong>${esc(mo)}</strong></p>
            <p class="highlight-flyer__sku"><span class="highlight-flyer__sku-label">Ref</span><span class="highlight-flyer__sku-pill">${esc(p.id)}</span></p>
          </div>
        </div>
      </article>`;
      })
      .join("");

    root.innerHTML = `<div id="highlightExport" class="highlight-sheet highlight-sheet--flyer${flyerThemeClassAttr()}">
    <header class="highlight-flyer__mast">
      <div class="highlight-flyer__mast-strip" aria-hidden="true"></div>
      <div class="highlight-flyer__mast-center">
        <div class="highlight-flyer__mast-brand">
          <img class="highlight-flyer__logo" src="assets/logo-tanvit.png" alt="" width="112" height="74" decoding="async">
          <div class="highlight-flyer__mast-text">
            <p class="highlight-flyer__company">Tanvit Industrial Solutions</p>
            <p class="highlight-flyer__tagline">A Trusted partner for Industry</p>
          </div>
        </div>
      </div>
      <div class="highlight-flyer__mast-meta">
        <time class="highlight-flyer__date" datetime="${escAttr(isoDate)}">${esc(dateStr)}</time>
        <span class="highlight-flyer__sheet-type">Product flyer</span>
      </div>
    </header>
    <div class="highlight-flyer__hero">
      <div class="highlight-flyer__hero-inner">
        <p class="highlight-flyer__eyebrow">${esc(modeTitle)}</p>
        <h1 class="highlight-flyer__title">${esc(title)}</h1>
        ${subtitle ? `<p class="highlight-flyer__subtitle">${esc(subtitle)}</p>` : ""}
      </div>
    </div>
    <div class="highlight-flyer__grid">${items}</div>
    <section class="highlight-flyer__cta" aria-label="How to order">
      <div class="highlight-flyer__cta-main">
        <h2 class="highlight-flyer__cta-heading">Request a wholesale quote</h2>
        <p class="highlight-flyer__cta-lead">Contact Tanvit for the full catalog, specifications, and wholesale pricing.</p>
      </div>
      <ul class="highlight-flyer__bullets">${flyerBulletsHtml(cfg)}</ul>
    </section>
    ${contactSection}
    <div class="highlight-flyer__bottom">
      <footer class="highlight-flyer__foot">${footnote ? esc(footnote) : "Prices & availability subject to confirmation on enquiry."}</footer>
    </div>
    </div>`;
    const exportEl = document.getElementById("highlightExport");
    if (exportEl) {
      const ph =
        (typeof TanvitStore !== "undefined" && TanvitStore.PRODUCT_IMAGE_PLACEHOLDER) ||
        "assets/placeholder-product.svg";
      exportEl.querySelectorAll("img").forEach((img) => {
        img.addEventListener(
          "error",
          function onFlyerImgErr() {
            img.removeEventListener("error", onFlyerImgErr);
            if (img.src && !img.src.includes("placeholder-product")) {
              img.src = ph;
            }
          },
          { once: true }
        );
      });
    }
    syncFlyerThemeSelect();
  }

  async function buildCanvas() {
    const el = getExportEl();
    const h2c = getHtml2Canvas();
    if (!el || !h2c) {
      throw new Error(
        "Snapshot library did not load. Ensure js/vendor/html2canvas.min.js is present, refresh the page, or use Print → Save as PDF."
      );
    }

    await document.fonts.ready;
    await waitForImages(el);
    await inlineFlyerImagesAsDataUrls(el);
    await waitForImages(el);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      return await h2c(el, {
        scale: 2,
        useCORS: false,
        allowTaint: false,
        logging: false,
        backgroundColor: "#ffffff",
        foreignObjectRendering: false,
        onclone(clonedDoc) {
          const node = clonedDoc.getElementById("highlightExport");
          if (!node) return;
          stripSnapshotCssInClone(node);
          node.querySelectorAll(".highlight-flyer__name").forEach((nameEl) => {
            nameEl.style.display = "block";
            nameEl.style.overflow = "visible";
            nameEl.style.webkitLineClamp = "unset";
            nameEl.style.lineClamp = "unset";
          });
        }
      });
    } catch (err) {
      const isFile = window.location.protocol === "file:";
      const hint = isFile
        ? " Opening the site as a file (file://) often blocks canvas export. Use a local web server (e.g. Live Server, or npx serve) so the address starts with http://localhost, then try again."
        : " If this persists, try Print → Save as PDF, or disable extensions that block canvas.";
      const msg = err && err.message ? String(err.message) : String(err);
      throw new Error(`${msg}.${hint}`);
    }
  }

  function downloadPngFromCanvas(canvas) {
    const name = "tanvit-todays-highlight.png";
    const taintHint =
      "The snapshot canvas was blocked (often file:// pages or cross-origin images). Open the site over http://localhost (not as a saved file), or use Print → Save as PDF.";
    try {
      const a = document.createElement("a");
      a.download = name;
      a.href = canvas.toDataURL("image/png");
      a.click();
      return;
    } catch (e1) {
      if (e1 && (e1.name === "SecurityError" || String(e1.message).toLowerCase().includes("tainted"))) {
        throw new Error(taintHint);
      }
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert("Could not create PNG file.");
          return;
        }
        const a = document.createElement("a");
        a.download = name;
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
      },
      "image/png",
      1
    );
  }

  function startHighlightUi() {
    loadSelectionState();
    const modeSel = document.getElementById("highlightMode");
    const catSel = document.getElementById("highlightCategoryFilter");
    const countInput = document.getElementById("highlightCount");
    const picker = document.getElementById("highlightProductPicker");

    const categories = availableCategories();
    if (catSel) {
      const opts = ['<option value="">All categories</option>']
        .concat(categories.map((c) => `<option value="${escAttr(c.key)}">${esc(c.label)}</option>`))
        .join("");
      catSel.innerHTML = opts;
      if (selectionState.category && !categories.find((c) => c.key === selectionState.category)) {
        selectionState.category = "";
      }
      catSel.value = selectionState.category;
    }

    if (picker) {
      picker.innerHTML = TanvitStore.PRODUCTS.map((p) => {
        const cat = TanvitStore.productCategoryLabel(p);
        return `<option value="${escAttr(p.id)}">${esc(p.name)} (${esc(cat)})</option>`;
      }).join("");
      const wanted = new Set(selectionState.manualIds);
      Array.from(picker.options).forEach((o) => {
        o.selected = wanted.has(o.value);
      });
    }
    if (modeSel) modeSel.value = selectionState.mode;
    if (countInput) countInput.value = String(selectionState.count);

    function syncSelectionUi() {
      const isManual = selectionState.mode === "manual";
      if (picker) picker.disabled = !isManual;
      if (catSel) catSel.disabled = isManual;
    }
    syncSelectionUi();

    renderHighlightSheet();

    const themeSelect = document.getElementById("highlightFlyerTheme");
    if (themeSelect) {
      themeSelect.addEventListener("change", () => {
        try {
          localStorage.setItem(STORAGE_FLYER_THEME, normalizeFlyerTheme(themeSelect.value));
        } catch (_) {
          /* ignore */
        }
        renderHighlightSheet();
      });
    }

    if (modeSel) {
      modeSel.addEventListener("change", () => {
        selectionState.mode = modeSel.value === "manual" ? "manual" : "category";
        syncSelectionUi();
        saveSelectionState();
        renderHighlightSheet();
      });
    }
    if (catSel) {
      catSel.addEventListener("change", () => {
        selectionState.category = catSel.value || "";
        saveSelectionState();
        renderHighlightSheet();
      });
    }
    if (countInput) {
      countInput.addEventListener("change", () => {
        const n = parseInt(countInput.value || "4", 10);
        selectionState.count = Number.isFinite(n) ? Math.min(24, Math.max(1, n)) : 4;
        countInput.value = String(selectionState.count);
        saveSelectionState();
        renderHighlightSheet();
      });
    }
    if (picker) {
      picker.addEventListener("change", () => {
        selectionState.manualIds = Array.from(picker.selectedOptions).map((o) => o.value);
        saveSelectionState();
        renderHighlightSheet();
      });
    }

    const products = getSelectedHighlightProducts();
    if (!products.length) {
      return;
    }

    const waBtn = document.getElementById("highlightWa");
  if (waBtn) waBtn.addEventListener("click", openWhatsAppShare);

  const refreshBtn = document.getElementById("highlightRefresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      selectionState.refreshNonce += 1;
      renderHighlightSheet();
      const still = getSelectedHighlightProducts();
      if (!still.length) return;
      refreshBtn.focus();
    });
  }

  const pngBtn = document.getElementById("highlightPng");
  if (pngBtn) {
    pngBtn.addEventListener("click", async () => {
      setExportBusy(true);
      try {
        const canvas = await buildCanvas();
        downloadPngFromCanvas(canvas);
      } catch (e) {
        console.error(e);
        alert(e.message || "Could not create PNG.");
      } finally {
        setExportBusy(false);
      }
    });
  }

  const pdfBtn = document.getElementById("highlightPdf");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", async () => {
      setExportBusy(true);
      try {
        const JsPDF = getJsPDFConstructor();
        if (!JsPDF) {
          throw new Error(
            "PDF library did not load. Ensure js/vendor/jspdf.umd.min.js is present, or use Print → Save as PDF."
          );
        }
        const canvas = await buildCanvas();
        const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxW = pageW - 2 * margin;
        const maxH = pageH - 2 * margin;
        const cw = canvas.width;
        const ch = canvas.height;
        let wMm = maxW;
        let hMm = (ch * wMm) / cw;
        if (hMm > maxH) {
          hMm = maxH;
          wMm = (cw * hMm) / ch;
        }
        const x = (pageW - wMm) / 2;
        const y = margin + Math.max(0, (maxH - hMm) / 2);
        let imgData;
        try {
          imgData = canvas.toDataURL("image/png");
        } catch (err) {
          const isSec = err && err.name === "SecurityError";
          throw new Error(
            isSec
              ? "Could not read the snapshot: the browser blocked the image (tainted canvas). Serve pages from http://localhost (not file://), keep product images on the same site, then try again — or use Print → Save as PDF."
              : `Could not read the snapshot: ${err && err.message ? err.message : String(err)}. Try Print → Save as PDF.`
          );
        }
        pdf.addImage(imgData, "PNG", x, y, wMm, hMm);
        pdf.save("tanvit-todays-highlight.pdf");
      } catch (e) {
        console.error(e);
        alert(e.message || "Could not create PDF.");
      } finally {
        setExportBusy(false);
      }
    });
  }

    const printBtn = document.getElementById("highlightPrint");
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }
  }

  if (typeof TanvitStore !== "undefined" && TanvitStore.PRODUCTS && TanvitStore.PRODUCTS.length) {
    startHighlightUi();
  } else {
    window.addEventListener("tanvit-catalog-ready", startHighlightUi, { once: true });
  }
})();
