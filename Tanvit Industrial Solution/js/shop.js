(function () {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const selType = document.getElementById("shopProductType");
  const selCategory = document.getElementById("shopWeldingCategory");

  let mainFilter = "all";
  let categoryFilter = null;

  function excerpt(text, max) {
    const t = text.trim();
    if (t.length <= max) return t;
    return t.slice(0, max).trim() + "…";
  }

  function render() {
    const imgPh = String(
      TanvitStore.PRODUCT_IMAGE_PLACEHOLDER || "assets/placeholder-product.svg"
    ).replace(/'/g, "\\'");
    const list = TanvitStore.filterProducts(mainFilter, categoryFilter);
    if (!list.length) {
      const noCatalogMsg =
        '<p class="shop-empty" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-muted)">The product catalog did not load. Ensure <code>data/catalog.json</code> is deployed and reachable, then refresh. For local admin + API use <code>npm run server</code> (see <code>docs/OPERATIONS.md</code>).</p>';
      const noMatchMsg =
        '<p class="shop-empty" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--color-text-muted)">No products match these filters. Try <button type="button" class="link-like" id="shopResetFilters">clearing filters</button> or browse all products.</p>';
      grid.innerHTML = !TanvitStore.PRODUCTS.length ? noCatalogMsg : noMatchMsg;
      const reset = document.getElementById("shopResetFilters");
      if (reset) {
        reset.addEventListener("click", () => {
          mainFilter = "all";
          categoryFilter = null;
          syncSelects();
          render();
          syncUrl();
        });
      }
      return;
    }

    grid.innerHTML = list
      .map(
        (p) => `
      <article class="product-card">
        <a href="product.html?id=${encodeURIComponent(p.id)}#${encodeURIComponent(p.id)}" class="product-card-image" style="text-decoration:none;color:inherit" aria-hidden="true">
          <img src="${escapeAttr(TanvitStore.productImageUrl(p))}" alt="${escapeAttr(p.name)}" width="900" height="675" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${imgPh}'">
        </a>
        <div class="product-card-body">
          ${TanvitStore.productBrand(p) ? `<div class="product-card-brand">${escapeHtml(TanvitStore.productBrand(p))}</div>` : ""}
          <div class="cat">${escapeHtml(TanvitStore.productCategoryLabel(p))}</div>
          <h3><a href="product.html?id=${encodeURIComponent(p.id)}#${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></h3>
          <p class="excerpt">${escapeHtml(excerpt(p.description, 95))}</p>
          <p class="product-min-order">Min. order qty: ${escapeHtml(TanvitStore.productMinOrder(p))}</p>
          ${
            (() => {
              const sk = TanvitStore.productSpecsRequired(p);
              const phrase = sk && TanvitStore.productSpecsDependPhrase(sk);
              return phrase
                ? `<p class="product-card-spec-hint">Enter ${escapeHtml(phrase)} in the quotation form on the product page.</p>`
                : "";
            })()
          }
          <div class="price">${
            TanvitStore.productHidePrice(p)
              ? '<span style="font-size:0.95rem;font-weight:600;color:var(--color-text-muted)">Price on quotation</span>'
              : `${TanvitStore.money(p.price)} <span style="font-size:0.7rem;font-weight:500;color:var(--color-text-muted)">incl. taxes</span>`
          }</div>
          <p class="product-card-footer">
            <a class="btn btn-primary" style="width:100%" href="product.html?id=${encodeURIComponent(p.id)}#${encodeURIComponent(p.id)}">View details</a>
          </p>
        </div>
      </article>`
      )
      .join("");
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function syncSelects() {
    if (selType) selType.value = mainFilter;
    if (selCategory) {
      selCategory.value = categoryFilter === null ? "" : categoryFilter;
    }
  }

  function ensureDynamicCategoryOptions() {
    if (!selCategory) return;
    const baseOptions = `
      <option value="">All</option>
      <option value="any">All categorized products</option>
    `;
    const seen = new Set();
    const dynamicOptions = TanvitStore.PRODUCTS.map((p) => {
      const key = TanvitStore.productCategoryKey(p);
      if (!key || seen.has(key)) return "";
      seen.add(key);
      const label = TanvitStore.productCategoryLabel(p);
      return `<option value="${escapeAttr(key)}">${escapeHtml(label)}</option>`;
    })
      .filter(Boolean)
      .join("");
    selCategory.innerHTML = baseOptions + dynamicOptions;
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    if (mainFilter === "all") url.searchParams.delete("type");
    else url.searchParams.set("type", mainFilter);

    if (categoryFilter === "any") url.searchParams.set("welding", "any");
    else if (categoryFilter) url.searchParams.set("welding", categoryFilter);
    else url.searchParams.delete("welding");

    window.history.replaceState({}, "", url.pathname + url.search);
  }

  if (selType) {
    selType.addEventListener("change", () => {
      mainFilter = selType.value || "all";
      syncSelects();
      render();
      syncUrl();
    });
  }

  if (selCategory) {
    selCategory.addEventListener("change", () => {
      const v = selCategory.value;
      categoryFilter = v === "" ? null : v;
      syncSelects();
      render();
      syncUrl();
    });
  }

  const params = new URLSearchParams(window.location.search);
  const t = params.get("type");
  if (t === "consumables" || t === "machinery") mainFilter = t;

  const w = params.get("welding");
  if (w === "any") categoryFilter = "any";
  else if (w && w.trim()) categoryFilter = w.trim();

  function bootShop() {
    ensureDynamicCategoryOptions();
    syncSelects();
    render();
  }

  if (TanvitStore.PRODUCTS.length) bootShop();
  else window.addEventListener("tanvit-catalog-ready", bootShop, { once: true });
})();
