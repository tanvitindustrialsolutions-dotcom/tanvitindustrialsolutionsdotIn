# Tanvit Industrial Solution — static demo site

This folder is a **self-contained** marketing site and **product catalog** for Tanvit Industrial Solution (red/gold branding, tagline: *A Trusted partner for Industry*).

## Run locally

**Static preview** (shop loads `data/catalog.json`):

```bash
npx --yes serve .
```

**Catalog + admin** (add/change products and prices, same data the shop uses):

```bash
npm install
set ADMIN_PASSWORD=your-secret&& set SESSION_SECRET=any-long-random&& npm run server
```

Then open **http://localhost:8787/** for the site and **http://localhost:8787/admin/** for the admin UI (see [`.env.example`](.env.example)).

## What is implemented

- Home (hero **slider** with full-bleed images in `assets/slider/`), About, Contact, Shop, product detail (**Get quotation** modal + Web3Forms), and [`quotation.html`](quotation.html).
- There is **no shopping cart**. Quotation requests use **Web3Forms**; set your key in [`js/site-config.js`](js/site-config.js) (see [`docs/OPERATIONS.md`](docs/OPERATIONS.md)).
- **Product catalog** lives in [`data/catalog.json`](data/catalog.json) and is loaded by [`js/catalog-loader.js`](js/catalog-loader.js). Optional **admin** in [`admin/`](admin/) backed by [`server/index.js`](server/index.js) (bulk price, row save, add product). Catalog logic and labels remain in [`js/store.js`](js/store.js).

## Production model (first-party, no SaaS storefront)

This project does **not** depend on a third-party commerce platform. See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for how the static site fits with day-to-day sales (contact-led orders, deployment, optional future API).

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
