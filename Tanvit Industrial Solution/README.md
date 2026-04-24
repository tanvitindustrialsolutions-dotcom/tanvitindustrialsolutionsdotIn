# Tanvit Industrial Solution — marketing site + catalog + admin

This folder is a **self-contained** marketing site and **product catalog** for Tanvit Industrial Solution (red/gold branding, tagline: *A Trusted partner for Industry*).

## Official setup (production + client editing)

**One app, one domain — no second domain.** The public site and the password admin both run from the same Node server:

- Public: `https://<your-domain>/`
- Admin (same host, path only): `https://<your-domain>/admin/`

Deploy by running **`npm start`** (same as `node server/index.js`) on the server, with secrets in a **`.env`** file (see [`.env.example`](.env.example)) or in the host’s environment variables. Do **not** commit `.env`.

Full GitHub + handover: **[docs/CLIENT-DEPLOY-GITHUB.md](docs/CLIENT-DEPLOY-GITHUB.md)**.  
Render (blueprint + domain + hook): **[docs/ONLINE_ADMIN_DEPLOY.md](docs/ONLINE_ADMIN_DEPLOY.md)** · root [`render.yaml`](render.yaml).

**Hostinger Single + bina live Node:** local admin → push → FTP deploy — **[docs/WORKFLOW-LOCAL-ADMIN-FIR-PUSH.md](docs/WORKFLOW-LOCAL-ADMIN-FIR-PUSH.md)** · example [`.github/workflows/hostinger-ftps-deploy.example.yml`](.github/workflows/hostinger-ftps-deploy.example.yml).

## Run locally

**Catalog + admin** (recommended — shop, API, and `/admin/` work together):

```bash
npm install
copy .env.example .env
# Edit .env: set ADMIN_PASSWORD and SESSION_SECRET
npm run server
```

Then open **http://localhost:8787/** for the site and **http://localhost:8787/admin/** for the admin UI.

**Client ko remote edit ke liye kya dena:** [`CLIENT-KO-YE-DO.txt`](CLIENT-KO-YE-DO.txt) — seedha jawab (link + password; alag site file nahi).

**Local simple use:** [`admin.html`](admin.html) + Windows [`start-admin-local.bat`](start-admin-local.bat).

**Static preview only** (no admin saves, shop reads `/data/catalog.json` if present):

```bash
npm run serve:static
```

## What is implemented

- Home (hero **slider** with full-bleed images in `assets/slider/`), About, Contact, Shop, product detail (**Get quotation** modal + Web3Forms), and [`quotation.html`](quotation.html).
- There is **no shopping cart**. Quotation requests use **Web3Forms**; set your key in [`js/site-config.js`](js/site-config.js) (see [`docs/OPERATIONS.md`](docs/OPERATIONS.md)).
- **Product catalog** lives in [`data/catalog.json`](data/catalog.json) and is loaded by [`js/catalog-loader.js`](js/catalog-loader.js). **Admin** is at [`admin/`](admin/) and is served at **`/admin/`** by [`server/index.js`](server/index.js) (products, clients, site JSON, category list, uploads). Catalog logic and labels remain in [`js/store.js`](js/store.js).

## Production model (first-party, no SaaS storefront)

This project does **not** depend on a third-party commerce platform. Production is **`npm start`** behind HTTPS so **`/admin/`** and the public site share one origin. See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) and [`docs/CLIENT-DEPLOY-GITHUB.md`](docs/CLIENT-DEPLOY-GITHUB.md).

## Brand colors (reference — see `css/styles.css`)

| Token | Hex |
|-------|-----|
| Red | `#b4232a` |
| Red dark | `#8f1d23` |
| Gold | `#b8954a` |
| Gold dark | `#8f7138` |

Typography: **Outfit** (headings), **DM Sans** (body), loaded from Google Fonts in generated pages.

Regenerate HTML pages after editing `build-pages.cjs` with:

`node build-pages.cjs`
