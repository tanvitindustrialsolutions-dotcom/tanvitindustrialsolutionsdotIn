(function () {
  "use strict";

  const PLACEHOLDER =
    (typeof TanvitStore !== "undefined" && TanvitStore.PRODUCT_IMAGE_PLACEHOLDER) ||
    "assets/placeholder-product.svg";

  function showToast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.remove("is-visible"), 2800);
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;");
  }

  function buildModalSpecSection(p, specKeys) {
    if (!specKeys || !specKeys.length) return "";
    const lead =
      "<p class=\"product-spec-lead quote-modal__spec-lead\">Final price depends on the <strong>capacity</strong> and <strong>length</strong> you need. Use <strong>whole numbers only</strong> (no decimals). Units are fixed as shown.</p>";
    const fields = specKeys
      .map((key) => {
        const label = TanvitStore.productSpecFieldLabel(key);
        const hint = TanvitStore.productSpecHint(p, key);
        const unit = TanvitStore.productSpecUnit(p, key);
        return `<div class="form-group product-spec-field">
        <label for="mpspec_${escAttr(key)}">${esc(label)} <span class="req">*</span></label>
        ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}
        <div class="product-spec-input-row">
          <input type="text" id="mpspec_${escAttr(key)}" name="mpspec_${escAttr(key)}" inputmode="numeric" pattern="[0-9]*" maxlength="9" autocomplete="off" class="product-spec-input product-spec-input-int" aria-describedby="mpspec_${escAttr(key)}_unit">
          <span class="product-spec-unit" id="mpspec_${escAttr(key)}_unit">${esc(unit)}</span>
        </div>
      </div>`;
      })
      .join("");
    return `<div class="quote-modal__specs">${lead}${fields}</div>`;
  }

  function bindModalSpecIntInputs(container) {
    container.querySelectorAll(".product-spec-input-int").forEach((el) => {
      el.addEventListener("input", () => {
        el.value = el.value.replace(/\D/g, "");
      });
      el.addEventListener("blur", () => {
        const n = TanvitStore.normalizeSpecIntValue(el.value);
        if (n) el.value = n;
      });
    });
  }

  function bindImageFallback(root) {
    const heroImg = root.querySelector(".product-detail-image img");
    if (!heroImg) return;
    heroImg.addEventListener(
      "error",
      function onImgErr() {
        heroImg.removeEventListener("error", onImgErr);
        if (!heroImg.src.includes("placeholder-product")) {
          heroImg.src = PLACEHOLDER;
          heroImg.alt = "";
        }
      },
      { once: true }
    );
  }

  function initProductPage() {
    const root = document.getElementById("productRoot");
    if (!root) return;

    if (typeof TanvitStore === "undefined" || typeof TanvitStore.findProduct !== "function") {
      root.innerHTML =
        '<p style="padding:2rem 0;color:var(--color-text-muted)">The catalog script did not load. Check that <code>js/store.js</code> is reachable, then refresh. <a href="shop.html">Return to the shop</a>.</p>';
      return;
    }

    let rawId = "";
    try {
      const params = new URLSearchParams(window.location.search);
      rawId = params.get("id");
    } catch (_) {
      rawId = "";
    }
    if (!rawId || !String(rawId).trim()) {
      const h = window.location.hash.replace(/^#/, "").trim();
      if (h) {
        try {
          rawId = decodeURIComponent(h);
        } catch (_) {
          rawId = h;
        }
      }
    }

    const id = rawId ? String(rawId).trim() : "";

    let p = id ? TanvitStore.findProduct(id) : null;
    if (!p && id) {
      p = TanvitStore.findProduct(id.replace(/\s+/g, ""));
    }

    if (!p) {
      if (!id) {
        root.innerHTML =
          '<p style="padding:2rem 0;color:var(--color-text-muted)">No product was selected. Open an item from <a href="shop.html">the shop</a> (use <strong>View details</strong>), or use a link like <code>product.html?id=your-product-id</code> or <code>product.html#your-product-id</code>.</p>';
      } else {
        root.innerHTML =
          '<p style="padding:2rem 0;color:var(--color-text-muted)">We could not find this product (<code>' +
          esc(id) +
          '</code>). Check the id matches the catalog in <code>js/store.js</code>, or <a href="shop.html">return to the shop</a>.</p>';
      }
      return;
    }

    try {
      const specKeys = TanvitStore.productSpecsRequired(p);
      const qMin = TanvitStore.orderQtyMin(p);

      root.innerHTML = `
    <div class="product-detail">
      <div class="product-card-image product-detail-image" style="border-radius:var(--radius)">
        <img src="${escAttr(TanvitStore.productImageUrl(p))}" alt="${escAttr(p.name)}" width="900" height="675" decoding="async">
      </div>
      <div>
        ${TanvitStore.productBrand(p) ? `<p class="product-detail-brand">${esc(TanvitStore.productBrand(p))}</p>` : ""}
        <div class="cat">${esc(TanvitStore.productCategoryLabel(p))}</div>
        <h1 style="margin-top:0;font-size:clamp(1.5rem,3vw,1.85rem)">${esc(p.name)}</h1>
        ${
          TanvitStore.productHidePrice(p)
            ? `<p class="price" style="font-size:1.25rem;margin:0.5rem 0 1rem;color:var(--color-text-muted)">Price on quotation${specKeys ? " — based on your capacity &amp; length" : ""}</p>`
            : `<p class="price" style="font-size:1.5rem;margin:0.5rem 0 1rem">${TanvitStore.money(p.price)} <span style="font-size:0.85rem;font-weight:500;color:var(--color-text-muted)">indicative, incl. taxes${specKeys ? " — quotation based on your specs" : ""}; freight if applicable</span></p>`
        }
        <p class="product-min-order">Min. order qty: ${esc(TanvitStore.productMinOrder(p))}</p>
        <div class="prose" style="max-width:none;color:var(--color-text-muted);font-size:0.9375rem;line-height:1.65">
          <p>${esc(p.description)}</p>
        </div>
        <div class="product-quote-cta">
          <button type="button" class="btn btn-primary btn-get-quote" id="pquoteOpen">Get quotation</button>
        </div>
        <p style="margin-top:1.5rem"><a href="shop.html" style="font-weight:500">← Back to catalog</a></p>
      </div>
    </div>`;

      bindImageFallback(root);

      const existingModal = document.getElementById("quoteModal");
      if (existingModal) existingModal.remove();

      const modal = document.createElement("div");
      modal.id = "quoteModal";
      modal.className = "quote-modal";
      modal.setAttribute("hidden", "");
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `
        <div class="quote-modal__backdrop" data-quote-modal-close tabindex="-1"></div>
        <div class="quote-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="quoteModalTitle">
          <div class="quote-modal__header">
            <h2 id="quoteModalTitle" class="quote-modal__title">Request a quotation</h2>
            <button type="button" class="quote-modal__close" data-quote-modal-close aria-label="Close dialog">&times;</button>
          </div>
          <div id="quoteModalInner" class="quote-modal__inner"></div>
        </div>`;
      document.body.appendChild(modal);

      const modalInner = modal.querySelector("#quoteModalInner");
      let lastActiveEl = null;
      let onKeyDown = null;

      function closeQuoteModal() {
        modal.setAttribute("hidden", "");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("quote-modal-open");
        modalInner.innerHTML = "";
        if (onKeyDown) {
          document.removeEventListener("keydown", onKeyDown);
          onKeyDown = null;
        }
        if (lastActiveEl && typeof lastActiveEl.focus === "function") lastActiveEl.focus();
      }

      function openQuoteModal() {
        lastActiveEl = document.activeElement;
        const specSection = buildModalSpecSection(p, specKeys);
        modalInner.innerHTML = `
          <form id="quoteModalForm" class="quote-modal__form" novalidate>
            <p class="quote-modal__product-name">${esc(p.name)}</p>
            <div class="form-group">
              <label for="mqty">Quantity <span class="req">*</span></label>
              <input type="number" id="mqty" name="mqty" min="${qMin}" value="${qMin}" step="1" required
                style="max-width:8rem;padding:0.55rem 0.65rem;border:1px solid var(--color-border);border-radius:var(--radius-sm)">
            </div>
            ${specSection}
            <div class="quote-modal__buyer">
              <p class="quote-modal__buyer-title">Your details</p>
              <p class="quote-modal__buyer-hint">Same as the <a href="quotation.html">GET QUOTATION</a> page (no separate requirements field here).</p>
              <div class="form-group">
                <label for="mq_name">Your name <span class="req">*</span></label>
                <input type="text" id="mq_name" name="mq_name" autocomplete="name" maxlength="120" placeholder="Contact person">
              </div>
              <div class="form-group">
                <label for="mq_company">Company / organisation</label>
                <input type="text" id="mq_company" name="mq_company" autocomplete="organization" maxlength="160" placeholder="Optional">
              </div>
              <div class="form-group">
                <label for="mq_email">Email <span class="req">*</span></label>
                <input type="email" id="mq_email" name="mq_email" autocomplete="email" maxlength="120" placeholder="you@company.com">
              </div>
              <div class="form-group">
                <label for="mq_phone">Phone <span class="req">*</span></label>
                <input type="tel" id="mq_phone" name="mq_phone" autocomplete="tel" maxlength="40" placeholder="Mobile with country code">
              </div>
              <div class="form-group">
                <label for="mq_gst">GST number (GSTIN)</label>
                <input type="text" id="mq_gst" name="mq_gst" maxlength="20" placeholder="15-character GSTIN, if applicable" autocomplete="off" spellcheck="false">
              </div>
              <div class="form-group">
                <label for="mq_location">Delivery location</label>
                <input type="text" id="mq_location" name="mq_location" maxlength="200" placeholder="City, state, PIN">
              </div>
            </div>
            <div id="quoteModalErr" class="quotation-form-error quote-modal__err" role="alert" hidden></div>
            <p class="quote-modal__req-hint"><span class="req">*</span> Required fields.</p>
            <div class="quote-modal__actions">
              <button type="button" class="btn btn-secondary" data-quote-modal-close>Cancel</button>
              <button type="submit" class="btn btn-primary" id="quoteModalSubmit">Submit request</button>
            </div>
          </form>`;

        bindModalSpecIntInputs(modalInner);

        const form = modalInner.querySelector("#quoteModalForm");
        const errEl = modalInner.querySelector("#quoteModalErr");
        const submitBtn = modalInner.querySelector("#quoteModalSubmit");

        function showModalErr(msg) {
          errEl.textContent = msg;
          errEl.hidden = false;
        }
        function clearModalErr() {
          errEl.textContent = "";
          errEl.hidden = true;
        }

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          clearModalErr();

          if (typeof TanvitEnquirySubmit === "undefined" || typeof TanvitEnquirySubmit.submit !== "function") {
            showModalErr("Form could not load. Refresh the page or use the quotation page.");
            return;
          }

          const qMinLocal = TanvitStore.orderQtyMin(p);
          const qtyEl = modalInner.querySelector("#mqty");
          let q = parseInt(qtyEl && qtyEl.value, 10) || qMinLocal;
          if (q < qMinLocal) q = qMinLocal;

          let spec;
          if (specKeys) {
            spec = {};
            for (const key of specKeys) {
              const el = modalInner.querySelector("#mpspec_" + key);
              const norm = TanvitStore.normalizeSpecIntValue(el ? el.value : "");
              if (!norm) {
                const unit = TanvitStore.productSpecUnit(p, key);
                showModalErr(
                  `${TanvitStore.productSpecFieldLabel(key)} must be a whole number from 1 upward${unit ? " (" + unit + ")" : ""}`
                );
                if (el) el.focus();
                return;
              }
              spec[key] = norm;
            }
          }

          const mqName = String((modalInner.querySelector("#mq_name") && modalInner.querySelector("#mq_name").value) || "").trim();
          const mqCompany = String((modalInner.querySelector("#mq_company") && modalInner.querySelector("#mq_company").value) || "").trim();
          const mqEmail = String((modalInner.querySelector("#mq_email") && modalInner.querySelector("#mq_email").value) || "").trim();
          const mqPhone = String((modalInner.querySelector("#mq_phone") && modalInner.querySelector("#mq_phone").value) || "").trim();
          const mqGst = String((modalInner.querySelector("#mq_gst") && modalInner.querySelector("#mq_gst").value) || "").trim();
          const mqLocation = String((modalInner.querySelector("#mq_location") && modalInner.querySelector("#mq_location").value) || "").trim();

          if (!mqName) {
            showModalErr("Please enter your name.");
            modalInner.querySelector("#mq_name").focus();
            return;
          }
          if (!mqEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mqEmail)) {
            showModalErr("Please enter a valid email address.");
            modalInner.querySelector("#mq_email").focus();
            return;
          }
          if (!mqPhone) {
            showModalErr("Please enter your phone number.");
            modalInner.querySelector("#mq_phone").focus();
            return;
          }

          const { subject, body } = TanvitStore.buildProductQuotationEmail(p.id, q, spec);
          const fullMessage = [
            "Name: " + mqName,
            "Company: " + (mqCompany || "—"),
            "Email: " + mqEmail,
            "Phone: " + mqPhone,
            "GST (GSTIN): " + (mqGst || "—"),
            "Delivery location: " + (mqLocation || "—"),
            "",
            "--- Product / line item ---",
            "",
            body
          ].join("\r\n");

          submitBtn.disabled = true;
          const prevLabel = submitBtn.textContent;
          submitBtn.textContent = "Sending…";

          TanvitEnquirySubmit.submit({
            subject: subject,
            name: mqName,
            email: mqEmail,
            phone: mqPhone,
            message: fullMessage
          }).then((result) => {
            submitBtn.disabled = false;
            submitBtn.textContent = prevLabel;
            if (result.ok) {
              closeQuoteModal();
              showToast("Request sent. We will get back to you soon.");
            } else {
              showModalErr(result.error || "Could not send. Try again or call us.");
            }
          });
        });

        modal.removeAttribute("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("quote-modal-open");

        const first = modalInner.querySelector("input, button");
        if (first) first.focus();

        onKeyDown = (ev) => {
          if (ev.key === "Escape") {
            ev.preventDefault();
            closeQuoteModal();
          }
        };
        document.addEventListener("keydown", onKeyDown);
      }

      modal.addEventListener("click", (e) => {
        if (e.target.closest("[data-quote-modal-close]")) {
          e.preventDefault();
          closeQuoteModal();
        }
      });

      const pquoteOpen = root.querySelector("#pquoteOpen");
      if (!pquoteOpen) {
        console.error("product-page: Get quotation button missing after render");
        return;
      }
      pquoteOpen.addEventListener("click", openQuoteModal);
    } catch (err) {
      console.error(err);
      root.innerHTML =
        '<p style="padding:2rem 0;color:var(--color-text-muted)">Something went wrong while loading this product. Please refresh the page or <a href="shop.html">return to the shop</a>.</p>';
    }
  }

  function runInit() {
    try {
      if (typeof TanvitStore !== "undefined" && TanvitStore.PRODUCTS && TanvitStore.PRODUCTS.length === 0) {
        window.addEventListener(
          "tanvit-catalog-ready",
          function () {
            initProductPage();
          },
          { once: true }
        );
        return;
      }
      initProductPage();
    } catch (err) {
      console.error(err);
      const r = document.getElementById("productRoot");
      if (r) {
        r.innerHTML =
          '<p style="padding:2rem 0;color:var(--color-text-muted)">The product page script failed. Open the browser console (F12) for details, hard-refresh (Ctrl+F5), or <a href="shop.html">return to the shop</a>.</p>';
      }
    }
  }

  runInit();

  window.addEventListener("load", () => {
    const r = document.getElementById("productRoot");
    if (!r) return;
    const t = r.textContent || "";
    if (/Loading product/i.test(t)) {
      runInit();
    }
  });

})();
