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

  let catalog = [];

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
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

  function setLoginError(msg) {
    if (!msg) {
      loginError.hidden = true;
      loginError.textContent = "";
    } else {
      loginError.textContent = msg;
      loginError.hidden = false;
    }
  }

  async function checkSession() {
    try {
      const s = await api("/api/admin/session");
      if (s.ok) {
        loginPanel.hidden = true;
        adminPanel.hidden = false;
        await loadCatalog();
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
    adminStatus.textContent = catalog.length + " products in catalog";
    renderTable();
  }

  function renderTable() {
    productRows.innerHTML = catalog
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
          <td><button type="button" class="btn small row-save">Save row</button></td>
        </tr>`;
      })
      .join("");

    productRows.querySelectorAll(".row-save").forEach((btn) => {
      btn.addEventListener("click", () => onSaveRow(btn.closest("tr")));
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
        if (b) b.textContent = "Save row";
      }, 1200);
    } catch (e) {
      alert(e.message || String(e));
    }
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

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    addMsg.textContent = "";
    const id = document.getElementById("addId").value.trim();
    const product = {
      id,
      name: document.getElementById("addName").value.trim(),
      brand: document.getElementById("addBrand").value.trim(),
      category: document.getElementById("addCategory").value,
      price: parseInt(document.getElementById("addPrice").value, 10) || 0,
      minOrder: document.getElementById("addMinOrder").value.trim() || "1 NOS",
      image: document.getElementById("addImage").value.trim() || "assets/products/" + id + ".jpg",
      description: document.getElementById("addDesc").value.trim(),
      hidePrice: document.getElementById("addHidePrice").checked
    };
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
      await loadCatalog();
    } catch (e) {
      addMsg.textContent = e.message || String(e);
    }
  });

  checkSession();
})();
