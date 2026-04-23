/**
 * Tanvit catalog API + static file server.
 * Serves the site, GET /data/catalog.json, and authenticated admin routes to edit data/catalog.json.
 *
 * Usage (from repo root):
 *   ADMIN_PASSWORD=your-secret SESSION_SECRET=random-string node server/index.js
 *
 * Default ADMIN_PASSWORD is "changeme" (override in production).
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");

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

app.use(express.static(ROOT));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const PORT = parseInt(process.env.PORT || "8787", 10);
app.listen(PORT, () => {
  console.log(`Tanvit server http://localhost:${PORT}/`);
  console.log(`Admin UI: http://localhost:${PORT}/admin/`);
  console.log(`Catalog:  http://localhost:${PORT}/data/catalog.json`);
});
