/**
 * File-based catalog: add a row below + put the image at image path (e.g. assets/products/{id}.jpg).
 *
 * Fields:
 * - id            unique slug, ASCII (used in URLs and image name)
 * - image         path under the site root, e.g. "assets/products/my-sku.jpg"
 * - category      "consumables" | "machinery"
 * - weldingCategory (optional) "electrodes" | "machine" | "accessories" | "cable" — only for welding SKUs
 * - consumablesCategory (optional) "respiratory" — PPE / safety lines (shop category label)
 * - machineryCategory (optional) "lifting" — for machinery that is not welding (e.g. chain blocks); shows as "Lifting Tool"
 * - name          display title
 * - brand         manufacturer / brand line (shown on cards and detail)
 * - price         number, INR (no commas), inclusive of taxes as shown in the shop
 * - hidePrice     optional boolean — if true, price is not shown (quote on request)
 * - minOrder      display string, e.g. "1 NOS" or "10 BOX" (welding rods)
 * - requiresClientSpecs (optional) string[] — e.g. ["capacity"] or ["capacity","length"]; collected on product page for quotation emails
 * - specHints     (optional) Record<string,string> — short hints per spec key (units fixed via specUnits)
 * - specUnits     (optional) Record<string,string> — fixed unit suffix per key, e.g. { capacity: "TON", length: "MTR" }
 * - description   plain text for shop + product page
 *
 * Daily marketing: DAILY_HIGHLIGHT (below) drives highlight.html.
 * - rotationMode "fixed": always shows productIds (manual list).
 * - rotationMode "daily": picks spotlightCount products from rotationPoolIds (or entire catalog), changing each local calendar day; same-day picks match for all visitors. Use bumpHighlightRotation() + page re-render for “New picks” without waiting for midnight.
 * Flyer: flyerMobile, flyerEmail (shown on highlight flyer); optional flyerContactLine (extra line); flyerBullets.
 * flyerTheme: "classic" | "minimal" | "bold" | "studio" — default look; user can override from Highlight toolbar (saved in localStorage).
 * Optional shareUrl: reserved for future use (not shown on flyers).
 *
 * Example:
 * {
 *   id: "my-sku-1",
 *   image: "assets/products/my-sku-1.jpg",
 *   category: "consumables",
 *   name: "Product title",
 *   price: 999,
 *   description: "Long description for buyers."
 * }
 */

/** Labels for shop / product cards when a product sits under Welding */
const WELDING_LABELS = {
  electrodes: "Welding · Electrodes and Wire",
  machine: "Welding · Machine",
  accessories: "Welding · Accessories",
  cable: "Welding · Cable"
};

/** Labels when category is machinery but product is not welding equipment */
const MACHINERY_LABELS = {
  lifting: "Material Handling · Lifting Tools"
};

/** Labels for consumables that are not welding (e.g. PPE) */
const CONSUMABLES_LABELS = {
  respiratory: "PPE · Respiratory"
};

const SPEC_FIELD_LABELS = {
  capacity: "Capacity",
  length: "Length"
};

/** Loaded at runtime from /data/catalog.json via js/catalog-loader.js (see server/ for admin API). */
let PRODUCTS = [];

/** composite string (e.g. w:electrodes, parts:bolts) → display label from data/category-taxonomy.json */
let TAXONOMY_COMPOSITE_LABELS = Object.create(null);

const RESERVED_CATEGORY_FIELDS = new Set(["weldingCategory", "machineryCategory", "consumablesCategory"]);

/** Build taxonomy composite key for labels (must match admin compositeFromProduct). */
function compositeKeyFromProduct(p) {
  if (!p || typeof p !== "object") return "w:electrodes";
  if (p.category === "machinery" && p.machineryCategory) return "m:" + String(p.machineryCategory);
  if (p.consumablesCategory) return "c:" + String(p.consumablesCategory);
  if (p.weldingCategory) return "w:" + String(p.weldingCategory);
  const dynKeys = Object.keys(p)
    .filter(
      (k) =>
        k.endsWith("Category") &&
        !RESERVED_CATEGORY_FIELDS.has(k) &&
        p[k] != null &&
        String(p[k]).trim()
    )
    .sort();
  if (dynKeys.length) {
    const k = dynKeys[0];
    const prefix = k.replace(/Category$/, "");
    return prefix + ":" + String(p[k]).trim();
  }
  return p.category === "machinery" ? "m:lifting" : "w:electrodes";
}

function ingestCategoryTaxonomy(doc) {
  TAXONOMY_COMPOSITE_LABELS = Object.create(null);
  if (!doc || typeof doc !== "object" || !doc.subcategoriesByMain) return;
  const byMain = doc.subcategoriesByMain;
  const keys = Object.keys(byMain);
  for (let i = 0; i < keys.length; i++) {
    const arr = byMain[keys[i]];
    if (!Array.isArray(arr)) continue;
    for (let j = 0; j < arr.length; j++) {
      const row = arr[j];
      if (row && row.composite && row.label != null) {
        TAXONOMY_COMPOSITE_LABELS[String(row.composite)] = String(row.label);
      }
    }
  }
}


/**
 * Daily marketing spotlight — see rotationMode.
 */
const DAILY_HIGHLIGHT = {
  title: "Today's highlight",
  subtitle: "Featured for your plant — wholesale pricing on enquiry.",
  footnote: "Specifications and availability confirmed on enquiry.",
  /** Optional legacy field — not shown on flyers. */
  shareUrl: "",
  /** "fixed" = use productIds only. "daily" = rotate by calendar day (+ “New picks” nudge). */
  rotationMode: "daily",
  /** How many catalog items appear on the highlight sheet when rotating */
  spotlightCount: 4,
  /** When rotating: restrict to these ids, or leave empty / omit to use the full catalog */
  rotationPoolIds: [],
  /** Used when rotationMode is "fixed" (also fallback if rotation pool is empty) */
  productIds: [
    "ador-kingbond-e6013",
    "ador-supabase-x-plus-e7018",
    "w-mma-1",
    "w-champ-400x"
  ],
  /** Mobile number as printed on the highlight flyer (e.g. +91-9414110440) */
  flyerMobile: "+91-9414110440",
  /** Email as printed on the highlight flyer */
  flyerEmail: "tanvitindustrialsolutions@gmail.com",
  /** Optional extra line under phone/email (address, GSTIN, etc.) */
  flyerContactLine: "",
  /** Optional 3 short trust bullets for the flyer CTA column; defaults used if empty */
  flyerBullets: [
    "Genuine brands & traceable specifications",
    "Technical details & MOQ on enquiry",
    "Wholesale quotes & delivery on enquiry"
  ],
  /**
   * Flyer visual preset. Toolbar "Flyer design" can override (stored in localStorage).
   * classic = current default; minimal = light brochure; bold = high contrast; studio = warm editorial.
   */
  flyerTheme: "classic"
};

const STORAGE_HIGHLIGHT_NUDGE = "tanvit_highlight_nudge_v1";

const QUOTATION_EMAIL = "tanvitindustrialsolutions@gmail.com";

function money(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n);
}

function productCategoryLabel(p) {
  const compositeKey = compositeKeyFromProduct(p);
  if (TAXONOMY_COMPOSITE_LABELS[compositeKey]) {
    return TAXONOMY_COMPOSITE_LABELS[compositeKey];
  }
  if (p.consumablesCategory && CONSUMABLES_LABELS[p.consumablesCategory]) {
    return CONSUMABLES_LABELS[p.consumablesCategory];
  }
  if (p.consumablesCategory) {
    return "Consumables · " + humanizeCategoryKey(p.consumablesCategory);
  }
  if (p.weldingCategory && WELDING_LABELS[p.weldingCategory]) {
    return WELDING_LABELS[p.weldingCategory];
  }
  if (p.weldingCategory) {
    return "Welding · " + humanizeCategoryKey(p.weldingCategory);
  }
  if (p.category === "machinery" && p.machineryCategory && MACHINERY_LABELS[p.machineryCategory]) {
    return MACHINERY_LABELS[p.machineryCategory];
  }
  if (p.category === "machinery" && p.machineryCategory) {
    return "Machinery · " + humanizeCategoryKey(p.machineryCategory);
  }
  const mc = p.category ? String(p.category) : "";
  if (mc === "consumables") return "Consumables";
  if (mc === "machinery") return "Machinery";
  return mc ? humanizeCategoryKey(mc) : "Catalog";
}

/** Turn a category key like "gas_cutting" into "Gas Cutting" */
function humanizeCategoryKey(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/** Stable category key used for shop filter options */
function productCategoryKey(p) {
  if (!p || typeof p !== "object") return "";
  if (p.machineryCategory) return String(p.machineryCategory).trim();
  if (p.consumablesCategory) return String(p.consumablesCategory).trim();
  if (p.weldingCategory) return String(p.weldingCategory).trim();
  const dynKeys = Object.keys(p)
    .filter(
      (k) =>
        k.endsWith("Category") &&
        !RESERVED_CATEGORY_FIELDS.has(k) &&
        p[k] != null &&
        String(p[k]).trim()
    )
    .sort();
  if (dynKeys.length) return String(p[dynKeys[0]]).trim();
  return "";
}

/** Display brand line for cards and tables; empty string if missing */
function productBrand(p) {
  return p && p.brand ? String(p.brand).trim() : "";
}

/** Min order label, e.g. "1 NOS" or "10 BOX" */
function productMinOrder(p) {
  return p && p.minOrder ? String(p.minOrder).trim() : "1 NOS";
}

/** When true, UI must not show rupee price */
function productHidePrice(p) {
  const forceHideAll =
    typeof window !== "undefined" &&
    window.TanvitSiteConfig &&
    window.TanvitSiteConfig.hideAllPrices === true;
  return forceHideAll || !!(p && p.hidePrice);
}

/** Minimum quantity for quotation (welding rods = 10 BOX) */
function orderQtyMin(p) {
  return p && p.weldingCategory === "electrodes" ? 10 : 1;
}

/** Shown when catalog image file is missing or fails to load */
const PRODUCT_IMAGE_PLACEHOLDER = "assets/placeholder-product.svg";

/** Hero/catalog image path; falls back to id-based file if missing */
function productImageUrl(p) {
  return p.image || `assets/products/${p.id}.jpg`;
}

/** @returns {string[]|null} spec keys to collect for quotation, or null */
function productSpecsRequired(p) {
  if (!p || !Array.isArray(p.requiresClientSpecs) || !p.requiresClientSpecs.length) return null;
  return p.requiresClientSpecs;
}

function productSpecFieldLabel(key) {
  return SPEC_FIELD_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1));
}

/** Lowercase phrase for UI, e.g. "capacity and length" or "capacity" — from `requiresClientSpecs` keys */
function productSpecsDependPhrase(keys) {
  if (!Array.isArray(keys) || !keys.length) return "";
  const parts = keys.map((k) => productSpecFieldLabel(k).toLowerCase());
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] + " and " + parts[1];
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}

function productSpecHint(p, key) {
  if (p && p.specHints && p.specHints[key]) return String(p.specHints[key]).trim();
  return "";
}

/** Fixed display unit for a spec key (e.g. "TON", "MTR") */
function productSpecUnit(p, key) {
  if (p && p.specUnits && p.specUnits[key]) return String(p.specUnits[key]).trim();
  return "";
}

/** Positive whole number only (no decimals); returns canonical string or null */
function normalizeSpecIntValue(raw) {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (n < 1) return null;
  return String(n);
}

/** One-line summary for quotation body, e.g. "Capacity: 2 TON · Length: 3 MTR" */
function productQuotationSpecSummary(p, spec) {
  if (!p || !spec || typeof spec !== "object") return "";
  const keys = productSpecsRequired(p);
  if (!keys) return "";
  return keys
    .map((k) => {
      const u = productSpecUnit(p, k);
      const n = spec[k];
      return `${productSpecFieldLabel(k)}: ${n}${u ? " " + u : ""}`;
    })
    .join(" · ");
}

/**
 * Subject and body text for a product quotation (used by Web3Forms / enquiry API).
 * @param {string} productId
 * @param {number} qty
 * @param {Record<string,string>|undefined} spec
 * @returns {{ subject: string, body: string }}
 */
function buildProductQuotationEmail(productId, qty, spec) {
  const p = findProduct(productId);
  if (!p) {
    return {
      subject: "Quotation request (unknown product)",
      body: "Catalog id: " + String(productId) + "\r\nQuantity: " + String(qty)
    };
  }
  const lines = [];
  lines.push("Please provide a quotation for the following:");
  lines.push("");
  lines.push("Product: " + p.name);
  lines.push("Catalog id: " + p.id);
  lines.push("Quantity: " + String(qty));
  const specLine = productQuotationSpecSummary(p, spec);
  if (specLine) lines.push("Specifications: " + specLine);
  if (!productHidePrice(p) && p.price != null) {
    lines.push("Indicative list price (incl. taxes where applicable): " + money(p.price));
  }
  return { subject: "Quotation request — " + p.name, body: lines.join("\r\n") };
}

/**
 * @param {string} mainFilter - "all" | "consumables" | "machinery"
 * @param {string|null} categoryFilter - null | "any" | "electrodes" | "machine" | "accessories" | "lifting" | "respiratory"
 */
function filterProducts(mainFilter, categoryFilter) {
  const main = mainFilter || "all";
  const cat = categoryFilter === undefined || categoryFilter === "" ? null : categoryFilter;

  let list = PRODUCTS.slice();
  if (main !== "all") {
    list = list.filter((p) => p.category === main);
  }
  if (cat === "any") {
    list = list.filter((p) => p.weldingCategory || p.machineryCategory || p.consumablesCategory);
  } else if (cat) {
    list = list.filter((p) => {
      if (p.weldingCategory === cat || p.machineryCategory === cat || p.consumablesCategory === cat) return true;
      for (const k of Object.keys(p)) {
        if (k.endsWith("Category") && p[k] === cat) return true;
      }
      return false;
    });
  }
  return list;
}

/** Replace catalog from JSON (e.g. /data/catalog.json or admin API). Same array reference as TanvitStore.PRODUCTS. */
function ingestProducts(list) {
  if (!Array.isArray(list)) return;
  PRODUCTS.length = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p && typeof p === "object" && p.id) PRODUCTS.push(p);
  }
}

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function getDailyHighlight() {
  return DAILY_HIGHLIGHT;
}

function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function highlightSeedHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

function getHighlightRotationNudge() {
  try {
    const v = parseInt(localStorage.getItem(STORAGE_HIGHLIGHT_NUDGE) || "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

/** Increment manual rotation (used with “New picks” on highlight page). */
function bumpHighlightRotation() {
  const n = getHighlightRotationNudge() + 1;
  try {
    localStorage.setItem(STORAGE_HIGHLIGHT_NUDGE, String(n));
  } catch {
    /* ignore quota */
  }
  return n;
}

function getHighlightProductIds() {
  const cfg = DAILY_HIGHLIGHT;
  const mode = cfg.rotationMode === "daily" ? "daily" : "fixed";
  if (mode === "fixed") {
    return (cfg.productIds || []).slice();
  }
  const rawCount = parseInt(String(cfg.spotlightCount ?? 2), 10);
  const want = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 2;
  let pool =
    Array.isArray(cfg.rotationPoolIds) && cfg.rotationPoolIds.length
      ? cfg.rotationPoolIds.filter((id) => findProduct(id))
      : PRODUCTS.map((p) => p.id);
  pool = [...new Set(pool)];
  if (!pool.length) {
    return (cfg.productIds || []).slice();
  }
  const count = Math.min(Math.max(1, want), pool.length);
  const seed = `${localDateKey()}:${getHighlightRotationNudge()}`;
  const start = highlightSeedHash(seed) % pool.length;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

function getHighlightProducts() {
  const ids = getHighlightProductIds();
  return ids.map((id) => findProduct(id)).filter(Boolean);
}

window.TanvitStore = {
  PRODUCTS,
  ingestProducts,
  ingestCategoryTaxonomy,
  DAILY_HIGHLIGHT,
  WELDING_LABELS,
  MACHINERY_LABELS,
  PRODUCT_IMAGE_PLACEHOLDER,
  productCategoryLabel,
  productCategoryKey,
  productBrand,
  productMinOrder,
  productHidePrice,
  orderQtyMin,
  productImageUrl,
  productSpecsRequired,
  productSpecFieldLabel,
  productSpecsDependPhrase,
  productSpecHint,
  productSpecUnit,
  normalizeSpecIntValue,
  productQuotationSpecSummary,
  buildProductQuotationEmail,
  QUOTATION_EMAIL,
  findProduct,
  getDailyHighlight,
  getHighlightProductIds,
  getHighlightProducts,
  bumpHighlightRotation,
  money,
  filterProducts
};
