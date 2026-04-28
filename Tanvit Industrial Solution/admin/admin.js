(function () {
  "use strict";

  const loginPanel = document.getElementById("loginPanel");
  const adminPanel = document.getElementById("adminPanel");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminStatus = document.getElementById("adminStatus");
  const productRows = document.getElementById("productRows");
  const bulkPrice = document.getElementById("bulkPrice");
  const bulkApplyBtn = document.getElementById("bulkApplyBtn");
  const bulkMsg = document.getElementById("bulkMsg");
  const addForm = document.getElementById("addForm");
  const addMsg = document.getElementById("addMsg");
  const tabProducts = document.getElementById("tabProducts");
  const tabSite = document.getElementById("tabSite");
  const panelProducts = document.getElementById("panelProducts");
  const panelSite = document.getElementById("panelSite");
  const siteJson = document.getElementById("siteJson");
  const clientsRows = document.getElementById("clientsRows");
  const clientsEmptyHint = document.getElementById("clientsEmptyHint");
  const clientsAddBtn = document.getElementById("clientsAddBtn");
  const siteReloadBtn = document.getElementById("siteReloadBtn");
  const siteSaveBtn = document.getElementById("siteSaveBtn");
  const siteMsg = document.getElementById("siteMsg");
  const clientsReloadBtn = document.getElementById("clientsReloadBtn");
  const clientsSaveBtn = document.getElementById("clientsSaveBtn");
  const clientsMsg = document.getElementById("clientsMsg");
  const categoryTaxonomyJson = document.getElementById("categoryTaxonomyJson");
  const categoryTaxonomyReloadBtn = document.getElementById("categoryTaxonomyReloadBtn");
  const categoryTaxonomySaveBtn = document.getElementById("categoryTaxonomySaveBtn");
  const categoryTaxonomyMsg = document.getElementById("categoryTaxonomyMsg");
  const gitPublishHint = document.getElementById("gitPublishHint");
  const gitPublishControls = document.getElementById("gitPublishControls");
  const gitPublishMessage = document.getElementById("gitPublishMessage");
  const gitPublishBtn = document.getElementById("gitPublishBtn");
  const gitPublishMsg = document.getElementById("gitPublishMsg");

  let catalog = [];

  const RESERVED_CATEGORY_FIELDS = ["weldingCategory", "machineryCategory", "consumablesCategory"];

  function defaultCategoryTaxonomy() {
    return {
      version: 1,
      mainCategories: [
        { value: "consumables", label: "Consumables" },
        { value: "machinery", label: "Machinery" }
      ],
      subcategoriesByMain: {
        consumables: [
          { composite: "w:electrodes", label: "Welding · Electrodes and wire" },
          { composite: "w:machine", label: "Welding · Machine" },
          { composite: "w:accessories", label: "Welding · Accessories" },
          { composite: "w:cable", label: "Welding · Cable" },
          { composite: "c:respiratory", label: "PPE · Respiratory" }
        ],
        machinery: [{ composite: "m:lifting", label: "Material handling · Lifting tools" }]
      }
    };
  }

  let categoryTaxonomy = defaultCategoryTaxonomy();

  function mainCategorySlugs() {
    const mains = categoryTaxonomy.mainCategories;
    if (!Array.isArray(mains) || !mains.length) return ["consumables", "machinery"];
    return mains.map((m) => m.value);
  }

  function getSubRowsForMain(mainVal) {
    const by = categoryTaxonomy.subcategoriesByMain;
    const list = by && typeof by === "object" ? by[mainVal] : null;
    if (Array.isArray(list) && list.length) return list;
    const fb = defaultCategoryTaxonomy().subcategoriesByMain;
    return fb[mainVal] && fb[mainVal].length ? fb[mainVal] : fb.consumables;
  }

  function fillMainCategorySelects() {
    const mains = Array.isArray(categoryTaxonomy.mainCategories) ? categoryTaxonomy.mainCategories : [];
    const addMain = document.getElementById("addMainCategory");
    const editMain = document.getElementById("editCategory");
    [addMain, editMain].forEach((sel) => {
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = "";
      const rows = mains.length ? mains : defaultCategoryTaxonomy().mainCategories;
      rows.forEach((m) => {
        const o = document.createElement("option");
        o.value = m.value;
        o.textContent = m.label || m.value;
        sel.appendChild(o);
      });
      const slugs = mainCategorySlugs();
      if (prev && slugs.indexOf(prev) >= 0) sel.value = prev;
      else if (slugs.length) sel.value = slugs[0];
    });
  }

  function compositeFromProduct(p) {
    if (!p || typeof p !== "object") return "w:electrodes";
    if (p.category === "machinery" && p.machineryCategory) return "m:" + String(p.machineryCategory);
    if (p.consumablesCategory) return "c:" + String(p.consumablesCategory);
    if (p.weldingCategory) return "w:" + String(p.weldingCategory);
    const dynKeys = Object.keys(p)
      .filter(function (k) {
        if (!k.endsWith("Category")) return false;
        if (RESERVED_CATEGORY_FIELDS.indexOf(k) >= 0) return false;
        return p[k] != null && String(p[k]).trim();
      })
      .sort();
    if (dynKeys.length) {
      const k = dynKeys[0];
      return k.replace(/Category$/, "") + ":" + String(p[k]).trim();
    }
    return p.category === "machinery" ? "m:lifting" : "w:electrodes";
  }

  function fillSubCategorySelect(selectEl, mainVal, preferredValue) {
    if (!selectEl) return;
    const list = getSubRowsForMain(mainVal);
    selectEl.innerHTML = "";
    list.forEach(function (row) {
      const o = document.createElement("option");
      o.value = row.composite;
      o.textContent = row.label || row.composite;
      selectEl.appendChild(o);
    });
    const first = list[0] && list[0].composite ? list[0].composite : "w:electrodes";
    const ok =
      preferredValue && [...selectEl.options].some(function (x) {
        return x.value === preferredValue;
      })
        ? preferredValue
        : first;
    selectEl.value = ok;
  }

  function applySubCompositeToProduct(product, composite) {
    delete product.weldingCategory;
    delete product.machineryCategory;
    delete product.consumablesCategory;
    Object.keys(product).forEach(function (k) {
      if (k.endsWith("Category") && RESERVED_CATEGORY_FIELDS.indexOf(k) < 0) delete product[k];
    });
    if (!composite || typeof composite !== "string") return;
    const idx = composite.indexOf(":");
    if (idx < 1) return;
    const prefix = composite.slice(0, idx);
    const key = composite.slice(idx + 1);
    if (!key) return;
    if (prefix === "w") product.weldingCategory = key;
    else if (prefix === "c") product.consumablesCategory = key;
    else if (prefix === "m") product.machineryCategory = key;
    else product[prefix + "Category"] = key;
  }

  function wireCategoryPickers() {
    const addMain = document.getElementById("addMainCategory");
    const addSub = document.getElementById("addSubCategory");
    if (addMain && addSub) {
      addMain.addEventListener("change", () => {
        fillSubCategorySelect(addSub, addMain.value, null);
      });
      const rows = getSubRowsForMain(addMain.value);
      const defPref = rows[0] && rows[0].composite ? rows[0].composite : "w:electrodes";
      fillSubCategorySelect(addSub, addMain.value, defPref);
    }
    const editMain = document.getElementById("editCategory");
    const editSub = document.getElementById("editSubCategory");
    if (editMain && editSub) {
      editMain.addEventListener("change", () => {
        fillSubCategorySelect(editSub, editMain.value, null);
      });
    }
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const SPEC_KEY_LABELS = { capacity: "Capacity", length: "Length" };

  function specKeyLabel(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    if (SPEC_KEY_LABELS[k]) return SPEC_KEY_LABELS[k];
    return k.charAt(0).toUpperCase() + k.slice(1);
  }

  function parseEditSpecKeysFromInput() {
    const el = document.getElementById("editSpecKeys");
    if (!el) return [];
    return el.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function snapshotEditSpecUnitsHints() {
    const container = document.getElementById("editSpecFieldsContainer");
    const units = {};
    const hints = {};
    if (!container) return { units, hints };
    container.querySelectorAll("[data-spec-unit-key]").forEach((inp) => {
      const k = inp.getAttribute("data-spec-unit-key");
      const v = inp.value.trim();
      if (k && v) units[k] = v;
    });
    container.querySelectorAll("[data-spec-hint-key]").forEach((inp) => {
      const k = inp.getAttribute("data-spec-hint-key");
      const v = inp.value.trim();
      if (k && v) hints[k] = v;
    });
    return { units, hints };
  }

  function renderEditSpecRows(keys, units, hints) {
    const container = document.getElementById("editSpecFieldsContainer");
    if (!container) return;
    keys = keys || [];
    units = units || {};
    hints = hints || {};
    container.innerHTML = "";
    if (!keys.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.style.margin = "0.25rem 0 0";
      p.textContent =
        "If buyers must enter numbers on the product page (for example lifting capacity), type field names here separated by commas.";
      container.appendChild(p);
      return;
    }
    keys.forEach((key) => {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(key)) return;
      const wrap = document.createElement("div");
      wrap.className = "admin-spec-row";
      const title = document.createElement("div");
      title.className = "admin-spec-row-title";
      title.textContent = specKeyLabel(key);
      const sub = document.createElement("div");
      sub.className = "admin-spec-row-key";
      sub.textContent = "Field name: " + key;
      const labU = document.createElement("label");
      labU.textContent = "Unit label (e.g. TON, MTR)";
      const inU = document.createElement("input");
      inU.type = "text";
      inU.maxLength = 24;
      inU.setAttribute("data-spec-unit-key", key);
      inU.value = units[key] != null ? String(units[key]) : "";
      labU.appendChild(inU);
      const labH = document.createElement("label");
      labH.textContent = "Hint on the form (optional)";
      const inH = document.createElement("input");
      inH.type = "text";
      inH.maxLength = 200;
      inH.setAttribute("data-spec-hint-key", key);
      inH.value = hints[key] != null ? String(hints[key]) : "";
      labH.appendChild(inH);
      wrap.appendChild(title);
      wrap.appendChild(sub);
      wrap.appendChild(labU);
      wrap.appendChild(labH);
      container.appendChild(wrap);
    });
  }

  let editSpecKeysInputTimer = null;
  let editSpecKeysListenerAttached = false;
  function attachEditSpecKeysListener() {
    const el = document.getElementById("editSpecKeys");
    if (!el || editSpecKeysListenerAttached) return;
    editSpecKeysListenerAttached = true;
    el.addEventListener("input", () => {
      clearTimeout(editSpecKeysInputTimer);
      editSpecKeysInputTimer = setTimeout(() => {
        const keys = parseEditSpecKeysFromInput();
        const snap = snapshotEditSpecUnitsHints();
        renderEditSpecRows(keys, snap.units, snap.hints);
      }, 120);
    });
  }

  function updateClientsEmptyHint() {
    if (!clientsEmptyHint || !clientsRows) return;
    const n = clientsRows.querySelectorAll(".admin-client-row").length;
    clientsEmptyHint.hidden = n > 0;
  }

  function updateClientRowSummary(details) {
    if (!details) return;
    const nameIn = details.querySelector(".client-name");
    const idIn = details.querySelector(".client-id");
    const nameEl = details.querySelector(".client-summary-name");
    const idEl = details.querySelector(".client-summary-id");
    if (nameEl) nameEl.textContent = (nameIn && nameIn.value.trim()) || "(unnamed)";
    if (idEl) idEl.textContent = (idIn && idIn.value.trim()) || "(no id yet)";
  }

  function appendClientRow(c) {
    if (!clientsRows) return;
    c = Object.assign({ id: "", name: "", logo: "", alt: "", width: 280, height: 88 }, c || {});
    const details = document.createElement("details");
    details.className = "admin-client-row";
    const hasId = !!(c.id && String(c.id).trim());
    const dispName = (c.name && String(c.name).trim()) || "(unnamed)";
    const dispId = (c.id && String(c.id).trim()) || "(no id yet)";
    details.open = !hasId;
    details.innerHTML =
      '<summary class="admin-client-summary">' +
      '<span class="admin-client-summary-main">' +
      '<span class="client-summary-name">' +
      esc(dispName) +
      "</span>" +
      '<span class="admin-client-summary-sep">·</span>' +
      '<span class="client-summary-id">' +
      esc(dispId) +
      "</span>" +
      "</span>" +
      '<span class="admin-client-summary-chev" aria-hidden="true"></span>' +
      "</summary>" +
      '<div class="admin-client-panel">' +
      '<div class="admin-client-row-head">' +
      '<button type="button" class="btn small danger client-row-remove">Remove client</button></div>' +
      '<div class="grid2">' +
      '<div><label>Short id (slug) <input class="client-id" type="text" maxlength="64" pattern="[a-z0-9-]*" placeholder="e.g. acme-cement"></label></div>' +
      '<div><label>Company name <input class="client-name" type="text" maxlength="200"></label></div></div>' +
      '<label>Logo file path <input class="client-logo" type="text" maxlength="200" placeholder="assets/clients/logo.png"></label>' +
      '<div class="admin-upload-inline">' +
      '<input type="file" class="client-logo-file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.jpg,.jpeg,.png,.webp,.gif,.svg">' +
      '<button type="button" class="btn secondary client-logo-upload">Upload logo</button>' +
      '<span class="client-logo-upload-msg admin-msg admin-msg--inline"></span></div>' +
      '<label>Logo description (accessibility) <input class="client-alt" type="text" maxlength="200"></label>' +
      '<div class="grid2">' +
      '<div><label>Width (pixels) <input class="client-w" type="number" min="16" max="2000" step="1"></label></div>' +
      '<div><label>Height (pixels) <input class="client-h" type="number" min="16" max="2000" step="1"></label></div></div></div>';
    details.querySelector(".client-id").value = c.id || "";
    details.querySelector(".client-name").value = c.name || "";
    details.querySelector(".client-logo").value = c.logo || "";
    details.querySelector(".client-alt").value = c.alt || "";
    details.querySelector(".client-w").value = String(c.width != null ? c.width : 280);
    details.querySelector(".client-h").value = String(c.height != null ? c.height : 88);
    updateClientRowSummary(details);
    details.querySelector(".client-row-remove").addEventListener("click", function (ev) {
      ev.preventDefault();
      details.remove();
      updateClientsEmptyHint();
    });
    const nameIn = details.querySelector(".client-name");
    const idIn = details.querySelector(".client-id");
    if (nameIn) nameIn.addEventListener("input", () => updateClientRowSummary(details));
    if (idIn) idIn.addEventListener("input", () => updateClientRowSummary(details));
    const fbtn = details.querySelector(".client-logo-upload");
    const ffile = details.querySelector(".client-logo-file");
    const logoPath = details.querySelector(".client-logo");
    const msg = details.querySelector(".client-logo-upload-msg");
    fbtn.addEventListener("click", () => postUpload("clients", ffile, logoPath, msg));
    details.addEventListener("toggle", function () {
      if (!details.open || !clientsRows) return;
      clientsRows.querySelectorAll("details.admin-client-row").forEach(function (other) {
        if (other !== details) other.open = false;
      });
    });
    clientsRows.appendChild(details);
    if (details.open && typeof details.scrollIntoView === "function") {
      details.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    updateClientsEmptyHint();
  }

  function renderClientsEditor(doc) {
    if (!clientsRows) return;
    clientsRows.innerHTML = "";
    const list = doc && Array.isArray(doc.clients) ? doc.clients : [];
    list.forEach((c) => appendClientRow(c));
    updateClientsEmptyHint();
  }

  function collectClientsDocFromForm() {
    if (!clientsRows) return { version: 1, clients: [] };
    const out = [];
    clientsRows.querySelectorAll(".admin-client-row").forEach((row) => {
      const idEl = row.querySelector(".client-id");
      const id = (idEl && idEl.value.trim()) || "";
      if (!id) return;
      const name = (row.querySelector(".client-name") && row.querySelector(".client-name").value.trim()) || id;
      const logo = (row.querySelector(".client-logo") && row.querySelector(".client-logo").value.trim()) || "";
      let alt = (row.querySelector(".client-alt") && row.querySelector(".client-alt").value.trim()) || "";
      if (!alt) alt = name;
      const w = parseInt((row.querySelector(".client-w") && row.querySelector(".client-w").value) || "280", 10);
      const h = parseInt((row.querySelector(".client-h") && row.querySelector(".client-h").value) || "88", 10);
      out.push({
        id,
        name,
        logo,
        alt,
        width: Number.isFinite(w) ? w : 280,
        height: Number.isFinite(h) ? h : 88
      });
    });
    return { version: 1, clients: out };
  }

  async function api(path, opts) {
    const o = Object.assign({ credentials: "same-origin" }, opts || {});
    o.headers = Object.assign({ Accept: "application/json" }, o.headers || {});
    if (o.body && typeof o.body === "object" && !(o.body instanceof FormData)) {
      o.headers["Content-Type"] = "application/json";
      o.body = JSON.stringify(o.body);
    }
    const r = await fetch(path, o);
    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { _raw: text };
    }
    if (!r.ok) throw new Error(data.error || data.message || r.statusText || "Request failed");
    return data;
  }

  function setInlineMsg(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
  }

  /**
   * @param {"slider"|"clients"|"products"} type
   * @param {HTMLInputElement|null} pathInput - if set, filled with returned path
   */
  async function postUpload(type, fileInput, pathInput, msgEl) {
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      setInlineMsg(msgEl, "Choose a file first.");
      return null;
    }
    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    try {
      const r = await fetch("/api/admin/upload?type=" + encodeURIComponent(type), {
        method: "POST",
        credentials: "same-origin",
        body: fd
      });
      const text = await r.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!r.ok) throw new Error(data.error || r.statusText || "Upload failed");
      const pth = data.path || "";
      if (pathInput) pathInput.value = pth;
      setInlineMsg(
        msgEl,
        pathInput ? "Saved as " + pth : "Uploaded: " + pth + " — copy the path into site JSON or a client logo field."
      );
      fileInput.value = "";
      return pth;
    } catch (e) {
      setInlineMsg(msgEl, e.message || String(e));
      return null;
    }
  }

  function setLoginError(msg) {
    if (!msg) {
      loginError.hidden = true;
      loginError.textContent = "";
    } else {
      loginError.textContent = msg;
      loginError.hidden = false;
    }
  }

  function setActiveTab(which) {
    const isProd = which === "products";
    if (tabProducts) tabProducts.classList.toggle("is-active", isProd);
    if (tabSite) tabSite.classList.toggle("is-active", !isProd);
    if (tabProducts) tabProducts.setAttribute("aria-selected", isProd ? "true" : "false");
    if (tabSite) tabSite.setAttribute("aria-selected", !isProd ? "true" : "false");
    if (panelProducts) panelProducts.hidden = !isProd;
    if (panelSite) panelSite.hidden = isProd;
  }

  if (tabProducts) tabProducts.addEventListener("click", () => setActiveTab("products"));
  if (tabSite) tabSite.addEventListener("click", () => setActiveTab("site"));

  async function loadSitePanels() {
    if (siteMsg) siteMsg.textContent = "";
    if (clientsMsg) clientsMsg.textContent = "";
    if (siteJson) {
      try {
        const site = await api("/api/admin/site");
        siteJson.value = JSON.stringify(site, null, 2);
      } catch (e) {
        siteJson.value = "";
        if (siteMsg) siteMsg.textContent = "Could not load site: " + (e.message || String(e));
      }
    }
    if (clientsRows) {
      try {
        const cl = await api("/api/admin/clients");
        renderClientsEditor(cl);
      } catch (e) {
        renderClientsEditor({ version: 1, clients: [] });
        if (clientsMsg) clientsMsg.textContent = "Could not load clients: " + (e.message || String(e));
      }
    }
  }

  function explainGitApiUnavailable(err) {
    const m = err && err.message ? String(err.message) : String(err || "");
    if (m === "Not Found" || /\b404\b/i.test(m)) {
      return (
        "Git push from admin only works when this page is served by Node on your PC (npm run server → http://localhost:8787/admin/). " +
        "On the live website (static hosting) there is no /api route, so you see Not Found. Pull the latest code, restart the server, and use localhost."
      );
    }
    return m;
  }

  function setGitPushFormEnabled(enabled, titleWhenDisabled) {
    if (gitPublishBtn) {
      gitPublishBtn.disabled = !enabled;
      gitPublishBtn.title = enabled ? "" : titleWhenDisabled || "Fix setup (see hint above), then refresh.";
    }
    /* Commit message stays editable so you can type before push is available; only the button is gated. */
  }

  async function loadGitPublishPanel() {
    if (!gitPublishHint) return;
    if (gitPublishMsg) gitPublishMsg.textContent = "";
    if (gitPublishControls) gitPublishControls.hidden = false;

    let hintText = "";
    let canPush = false;
    let disabledTitle = "";

    try {
      const r = await fetch("/api/admin/git-publish-info", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const text = await r.text();
      let info = {};
      try {
        info = text ? JSON.parse(text) : {};
      } catch {
        info = {};
      }
      if (r.status === 404) {
        hintText = explainGitApiUnavailable(new Error("Not Found"));
        disabledTitle = "No API on static hosting — open admin via npm run server on localhost.";
      } else if (!r.ok) {
        hintText = explainGitApiUnavailable(new Error(info.error || info.message || r.statusText || "Request failed"));
        disabledTitle = "Server returned an error — check npm run server in the project terminal.";
      } else if (!info.allowed) {
        hintText = info.hint || "Git push from admin is disabled.";
        disabledTitle = "Add ALLOW_ADMIN_GIT_PUSH=1 to .env and restart the server.";
      } else if (!info.hasGit) {
        hintText = info.hint || "No git repository detected.";
        disabledTitle = "Set GIT_REPO_ROOT to the folder that contains .git (e.g. C:\\BHANU).";
      } else {
        hintText = info.hint || "";
        canPush = true;
      }
    } catch (e) {
      hintText = explainGitApiUnavailable(e);
      disabledTitle = "Could not reach the API — use localhost with npm run server.";
    }

    gitPublishHint.textContent = hintText;
    setGitPushFormEnabled(canPush, disabledTitle);
  }

  async function loadCategoryTaxonomyPanel() {
    if (categoryTaxonomyMsg) categoryTaxonomyMsg.textContent = "";
    try {
      const doc = await api("/api/admin/category-taxonomy");
      categoryTaxonomy = doc;
      if (categoryTaxonomyJson) categoryTaxonomyJson.value = JSON.stringify(doc, null, 2);
      fillMainCategorySelects();
      const addMain = document.getElementById("addMainCategory");
      const addSub = document.getElementById("addSubCategory");
      if (addMain && addSub) {
        const rows = getSubRowsForMain(addMain.value);
        const pref = rows[0] && rows[0].composite ? rows[0].composite : "w:electrodes";
        fillSubCategorySelect(addSub, addMain.value, pref);
      }
    } catch (e) {
      if (categoryTaxonomyJson) categoryTaxonomyJson.value = JSON.stringify(categoryTaxonomy, null, 2);
      if (categoryTaxonomyMsg) {
        categoryTaxonomyMsg.textContent = "Could not load category taxonomy: " + (e.message || String(e));
      }
    }
  }

  async function checkSession() {
    try {
      const s = await api("/api/admin/session");
      if (s.ok) {
        loginPanel.hidden = true;
        adminPanel.hidden = false;
        await loadCatalog();
        await loadSitePanels();
        await loadCategoryTaxonomyPanel();
        await loadGitPublishPanel();
        setActiveTab("products");
        return true;
      }
    } catch (_) {
      /* ignore */
    }
    loginPanel.hidden = false;
    adminPanel.hidden = true;
    return false;
  }

  async function loadCatalog() {
    const data = await api("/api/admin/products");
    catalog = Array.isArray(data.products) ? data.products.slice() : [];
    const fs = (document.getElementById("productSearch") && document.getElementById("productSearch").value || "").trim();
    const nShow = getFilteredCatalog().length;
    adminStatus.textContent = catalog.length + " products" + (fs ? " · " + nShow + " match search" : "");
    renderTable();
  }

  function getFilteredCatalog() {
    const el = document.getElementById("productSearch");
    const q = (el && el.value ? String(el.value) : "").trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) => {
      const id = String(p.id || "").toLowerCase();
      const name = String(p.name || "").toLowerCase();
      const brand = String(p.brand || "").toLowerCase();
      return id.includes(q) || name.includes(q) || brand.includes(q);
    });
  }

  function renderTable() {
    const list = getFilteredCatalog();
    productRows.innerHTML = list
      .map((p) => {
        const id = esc(p.id);
        const price = p.price != null && Number.isFinite(Number(p.price)) ? Number(p.price) : 0;
        const hide = !!p.hidePrice;
        return `<tr data-id="${id}">
          <td><input type="checkbox" class="row-sel" aria-label="Select ${id}"></td>
          <td><code>${id}</code></td>
          <td class="name-cell" title="${esc(p.name || "")}">${esc(p.name || "")}</td>
          <td><input type="number" class="row-price" min="0" step="1" value="${price}"></td>
          <td><input type="checkbox" class="row-hide"${hide ? " checked" : ""}></td>
          <td><button type="button" class="btn small row-save">Save</button></td>
          <td><button type="button" class="btn small row-edit">Edit</button></td>
          <td><button type="button" class="btn small danger row-del">Delete</button></td>
        </tr>`;
      })
      .join("");

    productRows.querySelectorAll(".row-save").forEach((btn) => {
      btn.addEventListener("click", () => onSaveRow(btn.closest("tr")));
    });
    productRows.querySelectorAll(".row-edit").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(btn.closest("tr").getAttribute("data-id")));
    });
    productRows.querySelectorAll(".row-del").forEach((btn) => {
      btn.addEventListener("click", () => deleteProductById(btn.closest("tr").getAttribute("data-id")));
    });
  }

  async function onSaveRow(tr) {
    if (!tr) return;
    const id = tr.getAttribute("data-id");
    const p = catalog.find((x) => x.id === id);
    if (!p) return;
    const price = parseInt(tr.querySelector(".row-price").value, 10);
    const hidePrice = tr.querySelector(".row-hide").checked;
    const next = Object.assign({}, p, {
      price: Number.isFinite(price) && price >= 0 ? price : 0,
      hidePrice: hidePrice
    });
    try {
      await api("/api/admin/products/" + encodeURIComponent(id), { method: "PUT", body: next });
      const i = catalog.findIndex((x) => x.id === id);
      if (i >= 0) catalog[i] = next;
      tr.querySelector(".row-save").textContent = "Saved";
      setTimeout(() => {
        const b = tr.querySelector(".row-save");
        if (b) b.textContent = "Save";
      }, 1200);
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  const editModal = document.getElementById("editProductModal");
  const editProductMsg = document.getElementById("editProductMsg");

  function closeEditModal() {
    if (!editModal) return;
    editModal.hidden = true;
    if (editProductMsg) editProductMsg.textContent = "";
  }

  async function deleteProductById(id) {
    if (!id) return;
    const p = catalog.find((x) => x.id === id);
    const label = p && p.name ? id + " — " + p.name : id;
    if (!window.confirm('Delete product "' + label + '"? This cannot be undone.')) return;
    try {
      await api("/api/admin/products/" + encodeURIComponent(id), { method: "DELETE" });
      closeEditModal();
      await loadCatalog();
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  function openEditModal(id) {
    if (!editModal || !id) return;
    const p = catalog.find((x) => x.id === id);
    if (!p) return;
    const clone = typeof structuredClone === "function" ? structuredClone(p) : JSON.parse(JSON.stringify(p));
    editModal.dataset.productJson = JSON.stringify(clone);
    document.getElementById("editProductId").value = p.id;
    const lab = document.getElementById("editProductIdLabel");
    if (lab) lab.textContent = p.id;
    document.getElementById("editName").value = p.name || "";
    document.getElementById("editBrand").value = p.brand || "";
    const slugs = mainCategorySlugs();
    const mainCat = slugs.indexOf(p.category) >= 0 ? p.category : slugs[0];
    document.getElementById("editCategory").value = mainCat;
    document.getElementById("editMinOrder").value = p.minOrder || "1 NOS";
    fillSubCategorySelect(
      document.getElementById("editSubCategory"),
      mainCat,
      compositeFromProduct(p)
    );
    document.getElementById("editSpecKeys").value = Array.isArray(p.requiresClientSpecs)
      ? p.requiresClientSpecs.join(", ")
      : "";
    const u = p.specUnits && typeof p.specUnits === "object" && !Array.isArray(p.specUnits) ? p.specUnits : {};
    const h = p.specHints && typeof p.specHints === "object" && !Array.isArray(p.specHints) ? p.specHints : {};
    renderEditSpecRows(Array.isArray(p.requiresClientSpecs) ? p.requiresClientSpecs.slice() : [], u, h);
    attachEditSpecKeysListener();
    document.getElementById("editPrice").value =
      p.price != null && Number.isFinite(Number(p.price)) ? String(Number(p.price)) : "0";
    document.getElementById("editHidePrice").checked = !!p.hidePrice;
    document.getElementById("editImage").value = p.image || "";
    document.getElementById("editDesc").value = p.description || "";
    editModal.hidden = false;
  }

  function buildEditedProduct() {
    const raw = editModal && editModal.dataset.productJson;
    if (!raw) throw new Error("No product loaded");
    const base = JSON.parse(raw);
    const o = typeof structuredClone === "function" ? structuredClone(base) : JSON.parse(JSON.stringify(base));
    o.name = document.getElementById("editName").value.trim();
    o.brand = document.getElementById("editBrand").value.trim();
    o.category = document.getElementById("editCategory").value;
    o.minOrder = document.getElementById("editMinOrder").value.trim() || "1 NOS";
    const price = parseInt(document.getElementById("editPrice").value, 10);
    o.price = Number.isFinite(price) && price >= 0 ? price : 0;
    o.hidePrice = document.getElementById("editHidePrice").checked;
    o.image = document.getElementById("editImage").value.trim() || o.image || "assets/products/" + o.id + ".jpg";
    o.description = document.getElementById("editDesc").value.trim();
    const sub = document.getElementById("editSubCategory") && document.getElementById("editSubCategory").value;
    applySubCompositeToProduct(o, sub);
    const specKeys = parseEditSpecKeysFromInput();
    if (specKeys.length) {
      o.requiresClientSpecs = specKeys;
    } else {
      delete o.requiresClientSpecs;
    }
    const snap = snapshotEditSpecUnitsHints();
    if (Object.keys(snap.units).length) o.specUnits = snap.units;
    else delete o.specUnits;
    if (Object.keys(snap.hints).length) o.specHints = snap.hints;
    else delete o.specHints;
    return o;
  }

  if (editModal) {
    editModal.querySelectorAll("[data-edit-modal-close]").forEach((el) => {
      el.addEventListener("click", closeEditModal);
    });
    const editSaveBtn = document.getElementById("editProductSaveBtn");
    if (editSaveBtn) editSaveBtn.addEventListener("click", async () => {
      if (editProductMsg) editProductMsg.textContent = "";
      let next;
      try {
        next = buildEditedProduct();
      } catch (e) {
        if (editProductMsg) editProductMsg.textContent = e.message || String(e);
        return;
      }
      const id = next.id;
      try {
        await api("/api/admin/products/" + encodeURIComponent(id), { method: "PUT", body: next });
        const i = catalog.findIndex((x) => x.id === id);
        if (i >= 0) catalog[i] = next;
        closeEditModal();
        await loadCatalog();
      } catch (e) {
        if (editProductMsg) editProductMsg.textContent = e.message || String(e);
      }
    });
    const eif = document.getElementById("editImageFile");
    const eiu = document.getElementById("editImageUploadBtn");
    const eim = document.getElementById("editImageUploadMsg");
    if (eiu && eif) {
      eiu.addEventListener("click", () => postUpload("products", eif, document.getElementById("editImage"), eim));
    }
    const editDelBtn = document.getElementById("editProductDeleteBtn");
    if (editDelBtn) {
      editDelBtn.addEventListener("click", () => {
        const idEl = document.getElementById("editProductId");
        const id = idEl && idEl.value ? idEl.value.trim() : "";
        if (id) deleteProductById(id);
      });
    }
  }

  const productSearchEl = document.getElementById("productSearch");
  if (productSearchEl) {
    let t = null;
    productSearchEl.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const fs = productSearchEl.value.trim();
        const nShow = getFilteredCatalog().length;
        if (adminStatus) {
          adminStatus.textContent = catalog.length + " products" + (fs ? " · " + nShow + " match search" : "");
        }
        renderTable();
      }, 200);
    });
  }

  const addImageFile = document.getElementById("addImageFile");
  const addImageUploadBtn = document.getElementById("addImageUploadBtn");
  const addImageUploadMsg = document.getElementById("addImageUploadMsg");
  if (addImageUploadBtn && addImageFile) {
    addImageUploadBtn.addEventListener("click", () =>
      postUpload("products", addImageFile, document.getElementById("addImage"), addImageUploadMsg)
    );
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setLoginError("");
    const password = document.getElementById("adminPassword").value;
    try {
      await api("/api/admin/login", { method: "POST", body: { password } });
      loginPanel.hidden = true;
      adminPanel.hidden = false;
      await loadCatalog();
      await loadSitePanels();
      await loadCategoryTaxonomyPanel();
      setActiveTab("products");
    } catch (err) {
      setLoginError(err.message || "Login failed");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", { method: "POST" });
    } catch (_) {
      /* ignore */
    }
    adminPanel.hidden = true;
    loginPanel.hidden = false;
    catalog = [];
    productRows.innerHTML = "";
    if (siteJson) siteJson.value = "";
    if (clientsRows) {
      clientsRows.innerHTML = "";
      updateClientsEmptyHint();
    }
  });

  bulkApplyBtn.addEventListener("click", async () => {
    bulkMsg.textContent = "";
    const ids = [];
    productRows.querySelectorAll("tr").forEach((tr) => {
      const cb = tr.querySelector(".row-sel");
      if (cb && cb.checked) ids.push(tr.getAttribute("data-id"));
    });
    if (!ids.length) {
      bulkMsg.textContent = "Select at least one product.";
      return;
    }
    const price = parseInt(bulkPrice.value, 10);
    if (!Number.isFinite(price) || price < 0) {
      bulkMsg.textContent = "Enter a valid price.";
      return;
    }
    try {
      await api("/api/admin/products/bulk-prices", {
        method: "PATCH",
        body: { ids, price }
      });
      bulkMsg.textContent = "Updated " + ids.length + " product(s).";
      await loadCatalog();
    } catch (e) {
      bulkMsg.textContent = e.message || String(e);
    }
  });

  if (siteReloadBtn) {
    siteReloadBtn.addEventListener("click", async () => {
      if (siteMsg) siteMsg.textContent = "Loading…";
      try {
        const site = await api("/api/admin/site");
        siteJson.value = JSON.stringify(site, null, 2);
        if (siteMsg) siteMsg.textContent = "Reloaded.";
      } catch (e) {
        if (siteMsg) siteMsg.textContent = e.message || String(e);
      }
    });
  }

  if (siteSaveBtn) {
    siteSaveBtn.addEventListener("click", async () => {
      if (siteMsg) siteMsg.textContent = "";
      let parsed;
      try {
        parsed = JSON.parse(siteJson.value);
      } catch (e) {
        if (siteMsg) siteMsg.textContent = "Invalid JSON: " + (e.message || String(e));
        return;
      }
      try {
        await api("/api/admin/site", { method: "PUT", body: parsed });
        if (siteMsg) siteMsg.textContent = "Saved site.";
      } catch (e) {
        if (siteMsg) siteMsg.textContent = e.message || String(e);
      }
    });
  }

  if (clientsReloadBtn) {
    clientsReloadBtn.addEventListener("click", async () => {
      if (clientsMsg) clientsMsg.textContent = "Loading…";
      try {
        const cl = await api("/api/admin/clients");
        renderClientsEditor(cl);
        if (clientsMsg) clientsMsg.textContent = "Reloaded.";
      } catch (e) {
        if (clientsMsg) clientsMsg.textContent = e.message || String(e);
      }
    });
  }

  if (clientsSaveBtn) {
    clientsSaveBtn.addEventListener("click", async () => {
      if (clientsMsg) clientsMsg.textContent = "";
      const parsed = collectClientsDocFromForm();
      try {
        await api("/api/admin/clients", { method: "PUT", body: parsed });
        if (clientsMsg) clientsMsg.textContent = "Saved clients.";
      } catch (e) {
        if (clientsMsg) clientsMsg.textContent = e.message || String(e);
      }
    });
  }

  if (clientsAddBtn) {
    clientsAddBtn.addEventListener("click", () => {
      appendClientRow({ id: "", name: "", logo: "", alt: "", width: 280, height: 88 });
    });
  }

  if (categoryTaxonomyReloadBtn) {
    categoryTaxonomyReloadBtn.addEventListener("click", async () => {
      if (categoryTaxonomyMsg) categoryTaxonomyMsg.textContent = "Loading…";
      await loadCategoryTaxonomyPanel();
      if (categoryTaxonomyMsg && categoryTaxonomyMsg.textContent.indexOf("Could not load") !== 0) {
        categoryTaxonomyMsg.textContent = "Reloaded.";
      }
    });
  }

  if (categoryTaxonomySaveBtn) {
    categoryTaxonomySaveBtn.addEventListener("click", async () => {
      if (categoryTaxonomyMsg) categoryTaxonomyMsg.textContent = "";
      let parsed;
      try {
        parsed = JSON.parse(categoryTaxonomyJson.value);
      } catch (e) {
        if (categoryTaxonomyMsg) categoryTaxonomyMsg.textContent = "Invalid JSON: " + (e.message || String(e));
        return;
      }
      try {
        const out = await api("/api/admin/category-taxonomy", { method: "PUT", body: parsed });
        if (out && out.categoryTaxonomy) categoryTaxonomy = out.categoryTaxonomy;
        if (categoryTaxonomyJson && out.categoryTaxonomy) {
          categoryTaxonomyJson.value = JSON.stringify(out.categoryTaxonomy, null, 2);
        }
        fillMainCategorySelects();
        const addMain = document.getElementById("addMainCategory");
        const addSub = document.getElementById("addSubCategory");
        if (addMain && addSub) {
          const rows = getSubRowsForMain(addMain.value);
          const pref = rows[0] && rows[0].composite ? rows[0].composite : "w:electrodes";
          fillSubCategorySelect(addSub, addMain.value, pref);
        }
        if (categoryTaxonomyMsg) categoryTaxonomyMsg.textContent = "Saved category list.";
      } catch (e) {
        if (categoryTaxonomyMsg) categoryTaxonomyMsg.textContent = e.message || String(e);
      }
    });
  }

  if (gitPublishBtn) {
    gitPublishBtn.addEventListener("click", async () => {
      if (gitPublishMsg) gitPublishMsg.textContent = "";
      gitPublishBtn.disabled = true;
      try {
        const message =
          gitPublishMessage && gitPublishMessage.value ? String(gitPublishMessage.value).trim() : "";
        const out = await api("/api/admin/git-push", { method: "POST", body: { message } });
        if (out && out.nothingToCommit) {
          if (gitPublishMsg) gitPublishMsg.textContent = out.message || "Nothing to commit.";
        } else if (gitPublishMsg) {
          gitPublishMsg.textContent = "Committed and pushed to GitHub.";
        }
      } catch (e) {
        if (gitPublishMsg) gitPublishMsg.textContent = explainGitApiUnavailable(e);
      } finally {
        gitPublishBtn.disabled = false;
      }
    });
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    addMsg.textContent = "";
    const id = document.getElementById("addId").value.trim();
    const product = {
      id,
      name: document.getElementById("addName").value.trim(),
      brand: document.getElementById("addBrand").value.trim(),
      category: document.getElementById("addMainCategory").value,
      price: parseInt(document.getElementById("addPrice").value, 10) || 0,
      minOrder: document.getElementById("addMinOrder").value.trim() || "1 NOS",
      image: document.getElementById("addImage").value.trim() || "assets/products/" + id + ".jpg",
      description: document.getElementById("addDesc").value.trim(),
      hidePrice: document.getElementById("addHidePrice").checked
    };
    const addSub = document.getElementById("addSubCategory");
    applySubCompositeToProduct(product, addSub && addSub.value);
    if (!/^[a-z0-9-]+$/.test(id)) {
      addMsg.textContent = "Id must be lowercase letters, numbers, and hyphens only.";
      return;
    }
    try {
      await api("/api/admin/products", { method: "POST", body: product });
      addMsg.textContent = "Created " + id + ".";
      addForm.reset();
      document.getElementById("addMinOrder").value = "1 NOS";
      document.getElementById("addPrice").value = "0";
      const am = document.getElementById("addMainCategory");
      const as = document.getElementById("addSubCategory");
      const slugs = mainCategorySlugs();
      if (am && slugs.length) am.value = slugs[0];
      if (am && as) {
        const rows = getSubRowsForMain(am.value);
        const pref = rows[0] && rows[0].composite ? rows[0].composite : "w:electrodes";
        fillSubCategorySelect(as, am.value, pref);
      }
      await loadCatalog();
    } catch (e) {
      addMsg.textContent = e.message || String(e);
    }
  });

  if (categoryTaxonomyJson) {
    categoryTaxonomyJson.value = JSON.stringify(categoryTaxonomy, null, 2);
  }
  fillMainCategorySelects();
  wireCategoryPickers();
  checkSession();
})();
