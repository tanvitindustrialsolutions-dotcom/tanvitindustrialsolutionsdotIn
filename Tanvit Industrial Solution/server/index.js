/**
 * Tanvit catalog API + static file server.
 * Serves the site, GET /data/catalog.json, and authenticated admin routes to edit data/catalog.json.
 *
 * Usage (from repo root):
 *   ADMIN_PASSWORD=your-secret SESSION_SECRET=random-string node server/index.js
 *
 * Default ADMIN_PASSWORD is "changeme" (override in production).
 *
 * Optional: create a `.env` file in the project root (see `.env.example`). It is gitignored.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const CLIENTS_PATH = path.join(DATA_DIR, "clients.json");
const SITE_PATH = path.join(DATA_DIR, "site.json");
const CATEGORY_TAXONOMY_PATH = path.join(DATA_DIR, "category-taxonomy.json");

const DEFAULT_CATEGORY_TAXONOMY = {
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

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const SLIDE_IMAGE_RE = /^assets\/slider\/[a-zA-Z0-9._-]+$/;
const CLIENT_LOGO_RE = /^assets\/clients\/[a-zA-Z0-9._-]+$/;
const PRODUCT_IMAGE_RE = /^assets\/products\/[a-zA-Z0-9._-]+$/;
/** Relative href only; no protocol or scheme */
const HREF_RE = /^(?:[a-z0-9][a-z0-9./?#=&_%@-]*)?$/i;

function readCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error("Missing data/catalog.json — run: node tools/extract-products.cjs");
  }
  const raw = fs.readFileSync(CATALOG_PATH, "utf8");
  return JSON.parse(raw);
}

function writeCatalog(products) {
  if (!Array.isArray(products)) throw new Error("Catalog must be an array");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = CATALOG_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(products, null, 2), "utf8");
  fs.renameSync(tmp, CATALOG_PATH);
}

function writeJsonFile(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function readClientsDoc() {
  if (!fs.existsSync(CLIENTS_PATH)) return { version: 1, clients: [] };
  return JSON.parse(fs.readFileSync(CLIENTS_PATH, "utf8"));
}

function readSiteDoc() {
  if (!fs.existsSync(SITE_PATH)) return { version: 1, slides: [], copy: {} };
  return JSON.parse(fs.readFileSync(SITE_PATH, "utf8"));
}

function readCategoryTaxonomyDoc() {
  if (!fs.existsSync(CATEGORY_TAXONOMY_PATH)) {
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORY_TAXONOMY));
  }
  return JSON.parse(fs.readFileSync(CATEGORY_TAXONOMY_PATH, "utf8"));
}

function validateCategoryTaxonomy(body) {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const mainsIn = body.mainCategories;
  if (!Array.isArray(mainsIn) || mainsIn.length === 0) throw new Error("mainCategories must be a non-empty array");
  const mainValues = new Set();
  const mainCategories = [];
  for (let i = 0; i < mainsIn.length; i++) {
    const m = mainsIn[i];
    if (!m || typeof m !== "object") throw new Error(`mainCategories[${i}] invalid`);
    const value = String(m.value || "").trim();
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(value)) {
      throw new Error(`mainCategories[${i}].value must be a slug (lowercase, hyphens allowed)`);
    }
    if (mainValues.has(value)) throw new Error(`Duplicate main category value: ${value}`);
    mainValues.add(value);
    mainCategories.push({
      value,
      label: strMax(m.label != null ? m.label : value, 120, `mainCategories[${i}].label`) || value
    });
  }

  const rawSubs = body.subcategoriesByMain;
  if (!rawSubs || typeof rawSubs !== "object" || Array.isArray(rawSubs)) {
    throw new Error("subcategoriesByMain must be an object");
  }
  const subcategoriesByMain = {};
  for (const key of Object.keys(rawSubs)) {
    if (!mainValues.has(key)) throw new Error(`subcategoriesByMain key "${key}" is not a main category`);
    const arr = rawSubs[key];
    if (!Array.isArray(arr)) throw new Error(`subcategoriesByMain.${key} must be an array`);
    const out = [];
    for (let j = 0; j < arr.length; j++) {
      const row = arr[j];
      if (!row || typeof row !== "object") throw new Error(`subcategoriesByMain.${key}[${j}] invalid`);
      const composite = String(row.composite || "").trim();
      const colon = composite.indexOf(":");
      if (colon < 1 || colon === composite.length - 1) {
        throw new Error(`subcategoriesByMain.${key}[${j}].composite must be like "w:key" or "parts:key"`);
      }
      const prefix = composite.slice(0, colon);
      const subKey = composite.slice(colon + 1);
      if (!/^[a-z0-9-]{1,40}$/.test(subKey)) throw new Error(`Invalid sub key in composite "${composite}"`);
      if (prefix.length === 1 && "wcm".includes(prefix)) {
        if (!/^[wcm]:[a-z0-9-]+$/.test(composite)) throw new Error(`Invalid standard composite "${composite}"`);
      } else if (!/^[a-z][a-z0-9]{0,24}$/.test(prefix)) {
        throw new Error(`Invalid composite prefix in "${composite}" (use w:, c:, m:, or a lowercase name like parts:)`);
      }
      strMax(composite, 120, `subcategoriesByMain.${key}[${j}].composite`);
      out.push({
        composite,
        label: strMax(row.label != null ? row.label : composite, 200, `subcategoriesByMain.${key}[${j}].label`)
      });
    }
    subcategoriesByMain[key] = out;
  }

  return {
    version: typeof body.version === "number" ? body.version : 1,
    mainCategories,
    subcategoriesByMain
  };
}

function validateHref(h, label) {
  const s = String(h || "").trim();
  if (!s) throw new Error(`${label} is required`);
  if (s.includes("://") || s.toLowerCase().startsWith("javascript:") || s.includes("\n") || s.includes("\r")) {
    throw new Error(`Invalid ${label}`);
  }
  if (!HREF_RE.test(s)) throw new Error(`Invalid ${label}`);
}

function strMax(s, max, label) {
  const t = String(s ?? "");
  if (t.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return t;
}

/** Strip risky patterns from trusted-admin HTML (about cards). */
function sanitizeAdminHtml(html) {
  let s = String(html ?? "");
  if (s.length > 12000) s = s.slice(0, 12000);
  s = s.replace(/<\s*script[\s\S]*?>/gi, "").replace(/<\s*\/\s*script\s*>/gi, "");
  s = s.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return s;
}

function validatePages(pagesRaw) {
  if (pagesRaw === undefined || pagesRaw === null) return undefined;
  if (typeof pagesRaw !== "object" || Array.isArray(pagesRaw)) throw new Error("pages must be an object");
  const out = {};

  if (pagesRaw.about !== undefined) {
    const a = pagesRaw.about;
    if (typeof a !== "object" || a === null) throw new Error("pages.about invalid");
    if (!Array.isArray(a.cards) || a.cards.length !== 4) throw new Error("pages.about.cards must be an array of exactly 4 items");
    const cards = [];
    for (let i = 0; i < 4; i++) {
      const c = a.cards[i];
      if (!c || typeof c !== "object") throw new Error(`pages.about.cards[${i}] invalid`);
      cards.push({
        title: strMax(c.title, 300, `about.cards[${i}].title`),
        bodyHtml: sanitizeAdminHtml(c.bodyHtml != null ? String(c.bodyHtml) : "")
      });
    }
    if (!String(a.heroTitle || "").trim()) throw new Error("about.heroTitle is required");
    out.about = {
      metaDescription: strMax(a.metaDescription != null ? a.metaDescription : "", 600, "about.metaDescription"),
      heroTitle: strMax(a.heroTitle, 300, "about.heroTitle"),
      heroLead: strMax(a.heroLead, 2000, "about.heroLead"),
      sectionTitle: strMax(a.sectionTitle, 400, "about.sectionTitle"),
      sectionSub: strMax(a.sectionSub, 3000, "about.sectionSub"),
      cards
    };
  }

  if (pagesRaw.contact !== undefined) {
    const c = pagesRaw.contact;
    if (typeof c !== "object" || c === null) throw new Error("pages.contact invalid");
    const tel = String(c.phoneTel || "").replace(/\s/g, "");
    if (!tel) throw new Error("contact.phoneTel is required");
    if (!/^\+?[0-9]{8,18}$/.test(tel)) throw new Error("contact.phoneTel must be digits with optional + prefix");
    const em = String(c.email || "").trim();
    if (!em) throw new Error("contact.email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error("contact.email invalid");
    const bullets = Array.isArray(c.messageBullets) ? c.messageBullets.slice(0, 12) : [];
    for (let i = 0; i < bullets.length; i++) {
      bullets[i] = strMax(bullets[i], 500, `contact.messageBullets[${i}]`);
    }
    out.contact = {
      metaDescription: strMax(c.metaDescription != null ? c.metaDescription : "", 600, "contact.metaDescription"),
      heroTitle: strMax(c.heroTitle, 300, "contact.heroTitle"),
      heroLead: strMax(c.heroLead, 2000, "contact.heroLead"),
      phone: strMax(c.phone, 80, "contact.phone"),
      phoneTel: tel,
      email: strMax(em, 120, "contact.email"),
      address: strMax(c.address, 500, "contact.address"),
      hours: strMax(c.hours, 400, "contact.hours"),
      messageBoxTitle: strMax(c.messageBoxTitle, 200, "contact.messageBoxTitle"),
      messageIntro: strMax(c.messageIntro, 2000, "contact.messageIntro"),
      messageBullets: bullets,
      emailButtonLabel: strMax(c.emailButtonLabel != null ? c.emailButtonLabel : "", 120, "contact.emailButtonLabel"),
      emailButtonSubject: strMax(c.emailButtonSubject != null ? c.emailButtonSubject : "", 200, "contact.emailButtonSubject")
    };
  }

  return Object.keys(out).length ? out : undefined;
}

function validateSiteDoc(body) {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const slidesIn = body.slides;
  if (!Array.isArray(slidesIn)) throw new Error("slides must be an array");
  if (slidesIn.length > 6) throw new Error("Maximum 6 slides");
  const slides = [];
  for (let i = 0; i < slidesIn.length; i++) {
    const s = slidesIn[i];
    if (!s || typeof s !== "object") throw new Error(`Slide ${i + 1} invalid`);
    const img = String(s.image || "").trim();
    if (!SLIDE_IMAGE_RE.test(img)) throw new Error(`Slide ${i + 1}: image must match assets/slider/filename`);
    validateHref(s.primaryHref, `Slide ${i + 1} primaryHref`);
    validateHref(s.secondaryHref, `Slide ${i + 1} secondaryHref`);
    const strs = ["alt", "eyebrow", "title", "tagline", "primaryLabel", "secondaryLabel"];
    for (const k of strs) {
      if (s[k] != null && typeof s[k] !== "string") throw new Error(`Slide ${i + 1}: ${k} must be string`);
      if (String(s[k] || "").length > 2000) throw new Error(`Slide ${i + 1}: ${k} too long`);
    }
    slides.push({
      image: img,
      alt: String(s.alt || ""),
      photoCenter: !!s.photoCenter,
      eyebrow: String(s.eyebrow || ""),
      title: String(s.title || ""),
      tagline: String(s.tagline || ""),
      primaryLabel: String(s.primaryLabel || ""),
      primaryHref: String(s.primaryHref || "").trim(),
      secondaryLabel: String(s.secondaryLabel || ""),
      secondaryHref: String(s.secondaryHref || "").trim()
    });
  }
  const copyRaw = body.copy && typeof body.copy === "object" ? body.copy : {};
  const copy = {};
  for (const k of Object.keys(copyRaw)) {
    if (typeof copyRaw[k] !== "string") throw new Error(`copy.${k} must be string`);
    if (copyRaw[k].length > 4000) throw new Error(`copy.${k} too long`);
    copy[k] = copyRaw[k];
  }
  const pages = validatePages(body.pages);
  const out = {
    version: typeof body.version === "number" ? body.version : 1,
    copy,
    slides
  };
  if (pages !== undefined) out.pages = pages;
  return out;
}

function validateClientsDoc(body) {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const clientsIn = body.clients;
  if (!Array.isArray(clientsIn)) throw new Error("clients must be an array");
  const clients = [];
  for (let i = 0; i < clientsIn.length; i++) {
    const c = clientsIn[i];
    if (!c || typeof c !== "object") throw new Error(`Client ${i + 1} invalid`);
    const id = String(c.id || "").trim();
    if (!/^[a-z0-9-]{1,64}$/.test(id)) throw new Error(`Client ${i + 1}: id must be slug (lowercase, hyphens)`);
    const logo = String(c.logo || "").trim();
    if (!CLIENT_LOGO_RE.test(logo)) throw new Error(`Client ${i + 1}: logo must match assets/clients/filename`);
    if (!String(c.name || "").trim()) throw new Error(`Client ${i + 1}: name required`);
    if (!String(c.alt || "").trim()) throw new Error(`Client ${i + 1}: alt required`);
    const w = Number(c.width) || 280;
    const h = Number(c.height) || 88;
    if (w < 16 || w > 2000 || h < 16 || h > 2000) throw new Error(`Client ${i + 1}: width/height out of range`);
    clients.push({
      id,
      name: String(c.name || "").trim(),
      logo,
      alt: String(c.alt || "").trim(),
      width: Math.round(w),
      height: Math.round(h)
    });
  }
  return { version: typeof body.version === "number" ? body.version : 1, clients };
}

const uploadStorage = multer.diskStorage({
  destination(req, file, cb) {
    const t = String(req.query.type || "").toLowerCase();
    let dir = path.join(ROOT, "assets", "slider");
    if (t === "clients") dir = path.join(ROOT, "assets", "clients");
    else if (t === "products") dir = path.join(ROOT, "assets", "products");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
    if (!allowed.has(ext)) {
      cb(new Error("Only image uploads allowed"));
      return;
    }
    cb(null, `upload-${crypto.randomBytes(10).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 }
});

function timingSafeEqualStr(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(Buffer.from(x, "utf8"), Buffer.from(y, "utf8"));
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));
app.set("trust proxy", 1);

function getAllowedOrigins() {
  const raw = String(process.env.CORS_ORIGIN || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(
  session({
    name: "tanvit_admin",
    secret: process.env.SESSION_SECRET || "change-session-secret-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.get("/api/catalog", (req, res) => {
  try {
    const products = readCatalog();
    res.json({ products });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not read catalog" });
  }
});

app.get("/api/admin/session", (req, res) => {
  res.json({ ok: !!(req.session && req.session.admin) });
});

app.post("/api/admin/login", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD || "changeme";
  const pwd = req.body && req.body.password != null ? String(req.body.password) : "";
  if (timingSafeEqualStr(pwd, expected)) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: "Invalid password" });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/admin/products", requireAdmin, (req, res) => {
  try {
    res.json({ products: readCatalog() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const body = req.body;
    if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid body" });
    if (String(body.id || "").trim() !== id) return res.status(400).json({ error: "Body id must match URL" });
    const list = readCatalog();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return res.status(404).json({ error: "Product not found" });
    list[idx] = body;
    writeCatalog(list);
    res.json({ ok: true, product: body });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || !body.id) return res.status(400).json({ error: "Product must include id" });
    const id = String(body.id).trim();
    const list = readCatalog();
    if (list.some((p) => p.id === id)) return res.status(409).json({ error: "Product id already exists" });
    list.push(body);
    writeCatalog(list);
    res.status(201).json({ ok: true, product: body });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const list = readCatalog();
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) return res.status(404).json({ error: "Not found" });
    writeCatalog(next);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

/**
 * Bulk price update. Body either:
 *   { "ids": ["a","b"], "price": 1234 }
 *   { "updates": [{ "id": "a", "price": 100 }, { "id": "b", "price": 200 }] }
 */
app.patch("/api/admin/products/bulk-prices", requireAdmin, (req, res) => {
  try {
    const list = readCatalog();
    const { ids, price, updates } = req.body || {};

    if (Array.isArray(updates) && updates.length) {
      for (const u of updates) {
        if (!u || !u.id) continue;
        const p = list.find((x) => x.id === String(u.id));
        if (!p) continue;
        const n = Number(u.price);
        if (!Number.isFinite(n) || n < 0) continue;
        p.price = Math.round(n);
      }
    } else if (Array.isArray(ids) && ids.length && price != null) {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: "price must be a non-negative number" });
      const set = new Set(ids.map((x) => String(x)));
      for (const p of list) {
        if (set.has(p.id)) p.price = Math.round(n);
      }
    } else {
      return res.status(400).json({
        error: 'Use { "ids": ["id1"], "price": 999 } or { "updates": [{ "id": "a", "price": 1 }] }'
      });
    }

    writeCatalog(list);
    res.json({ ok: true, count: list.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.get("/api/admin/clients", requireAdmin, (req, res) => {
  try {
    res.json(readClientsDoc());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.put("/api/admin/clients", requireAdmin, (req, res) => {
  try {
    const doc = validateClientsDoc(req.body);
    writeJsonFile(CLIENTS_PATH, doc);
    res.json({ ok: true, clients: doc.clients });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: String(e.message) });
  }
});

app.get("/api/admin/site", requireAdmin, (req, res) => {
  try {
    res.json(readSiteDoc());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.put("/api/admin/site", requireAdmin, (req, res) => {
  try {
    const doc = validateSiteDoc(req.body);
    writeJsonFile(SITE_PATH, doc);
    res.json({ ok: true, site: doc });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: String(e.message) });
  }
});

app.get("/api/admin/category-taxonomy", requireAdmin, (req, res) => {
  try {
    res.json(readCategoryTaxonomyDoc());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.put("/api/admin/category-taxonomy", requireAdmin, (req, res) => {
  try {
    const doc = validateCategoryTaxonomy(req.body);
    writeJsonFile(CATEGORY_TAXONOMY_PATH, doc);
    res.json({ ok: true, categoryTaxonomy: doc });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: String(e.message) });
  }
});

app.post("/api/admin/upload", requireAdmin, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file) return res.status(400).json({ error: "No file" });
    const rel = path.relative(ROOT, req.file.path).split(path.sep).join("/");
    if (!rel.startsWith("assets/")) return res.status(500).json({ error: "Bad upload path" });
    res.json({ ok: true, path: rel });
  });
});

app.use(express.static(ROOT));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const PORT = parseInt(process.env.PORT || "8787", 10);
app.listen(PORT, () => {
  console.log(`Tanvit server http://localhost:${PORT}/`);
  console.log(`Admin UI: http://localhost:${PORT}/admin/`);
  console.log(`Catalog:  http://localhost:${PORT}/data/catalog.json`);
  console.log(`Site:     http://localhost:${PORT}/data/site.json`);
  console.log(`Clients:  http://localhost:${PORT}/data/clients.json`);
  console.log(`Category taxonomy: http://localhost:${PORT}/data/category-taxonomy.json`);
});
