# Operations — Tanvit Industrial Solution (static site + optional catalog server)

This repository is a **self-hosted** marketing site and **product catalog** (no shopping cart). The public catalog is loaded from **`data/catalog.json`** in the browser (see [`js/catalog-loader.js`](../js/catalog-loader.js)). An optional **Node server** ([`server/index.js`](../server/index.js)) serves the same files, exposes **`GET /api/catalog`**, and provides a **password-protected admin UI** at **`/admin/`** to add products and change prices.

## How customers use the site today

1. **Browse** Home, Shop, product pages, and Highlight — HTML + JavaScript; the shop reads **`/data/catalog.json`** or **`/api/catalog`** (whichever responds first).
2. **Request a quotation** — on a product page, **Get quotation** opens a **popup**; on [`quotation.html`](../quotation.html) the full form is on the page. Submissions go to [Web3Forms](https://web3forms.com) (see below).
3. **Contact** — phone and email on [`contact.html`](../contact.html).

### Enquiry forms (Web3Forms)

1. Create an **Access Key** at [web3forms.com](https://web3forms.com) for your inbox.
2. Set `web3formsAccessKey` in [`js/site-config.js`](../js/site-config.js).
3. Serve the site over **HTTPS** in production.

If the key is missing, the forms show an error; phone on the contact page still works.

## Catalog (`data/catalog.json`) and admin

- **Source of truth:** [`data/catalog.json`](../data/catalog.json) — JSON array of product objects (same shape as before in `js/store.js`).
- **Public load order:** optional `TanvitSiteConfig.catalogUrl` → `/api/catalog` → `/data/catalog.json` ([`js/catalog-loader.js`](../js/catalog-loader.js)).
- **Editing products / prices:**
  1. Install deps: `npm install`
  2. Set **`ADMIN_PASSWORD`** and **`SESSION_SECRET`** (see [`.env.example`](../.env.example)).
  3. Run **`npm run server`** and open **`http://localhost:8787/admin/`** (port from `PORT` if set).
  4. Log in, use the table (**Save row**), **bulk price** on selected rows, or **Add product** for a minimal new line. Advanced fields (e.g. `weldingCategory`, `requiresClientSpecs`) can be added by editing `data/catalog.json` on disk or extending the admin UI later.
- **Static-only hosting:** deploy `data/catalog.json` with the site; `GET /api/catalog` will 404 and the loader falls back to `/data/catalog.json`. You can edit the JSON offline and re-upload.

### One-time: regenerate `catalog.json` from an old `store.js` backup

If you still have a `js/store.js` with a literal `const PRODUCTS = [ ... ]` array:

```bash
node tools/extract-products.cjs
node tools/strip-products-array.cjs
```

Today’s repo already uses an empty `PRODUCTS` array in `store.js` plus `data/catalog.json`.

## HTML shells

After changing [`build-pages.cjs`](../build-pages.cjs):

```bash
node build-pages.cjs
```

## Deploying

- **With admin API:** run **`npm run server`** behind a process manager (or your host’s Node runner), set env vars, put **HTTPS** in front (reverse proxy).
- **Static only:** build/serve the folder; ensure **`data/catalog.json`** is included and reachable at `/data/catalog.json`.

Keep this doc updated when your operational process changes.
