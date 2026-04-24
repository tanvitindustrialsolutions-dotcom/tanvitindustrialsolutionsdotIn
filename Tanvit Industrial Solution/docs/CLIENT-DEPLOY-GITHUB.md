# Client setup: GitHub + live site + secured admin

## Default we ship (locked-in)

| Decision | Detail |
|----------|--------|
| **Admin URL** | Same domain as the website: **`https://<client-domain>/admin/`** — not a separate domain or subdomain. |
| **How it runs** | One **Node** process: **`npm start`** → [`server/index.js`](../server/index.js) serves HTML + static files + `/api/admin/*` + writes `data/` and `assets/`. |
| **Secrets** | `ADMIN_PASSWORD`, `SESSION_SECRET`, and on HTTPS hosts `NODE_ENV=production` — in `.env` on the server (gitignored) or host env UI. See [`.env.example`](../.env.example). |
| **GitHub** | Push code + `data/*.json` + `assets/` as needed; **never** push `.env`. |

PaaS hosts that run `npm start` (Render, Railway, Heroku-style) pick this up automatically; see **Start command** below. A [`Procfile`](../Procfile) is included for compatibility.

---

This guide is for **you (agency)** and **your client**: how the repo on GitHub becomes a **public website** where visitors only see pages, while the **client edits content** through `/admin/` with a password.

---

## What you are shipping

| Piece | Role |
|--------|------|
| **Public site** | HTML/CSS/JS pages (Home, Shop, Contact, etc.). No admin link required on the site. |
| **Admin** | `https://<client-domain>/admin/` — password login; edits products, clients, site JSON, category list, uploads. |
| **Node server** | [`server/index.js`](../server/index.js) serves the site **and** saves changes to `data/*.json` and `assets/` on disk. |

Admin only works in production if you run **`npm start`** (or `npm run server`) on the host — not with plain static-only hosting unless you add another backend.

---

## Part 1 — GitHub (your workflow)

1. **Repo**  
   Keep the project in a **private** GitHub repo if the client prefers (recommended for commercial work).

2. **Never commit secrets**  
   - `.env` is **gitignored** — put real `ADMIN_PASSWORD` and `SESSION_SECRET` only on the server (or in the host’s “Environment variables” UI).  
   - Commit [`.env.example`](../.env.example) only as a template.

3. **Do commit content the site needs**  
   - `data/catalog.json`, `data/site.json`, `data/clients.json`, `data/category-taxonomy.json`  
   - `assets/` (products, clients, slider) as appropriate  
   So a fresh `git clone` + deploy can reproduce the site.

4. **When to push**  
   - After you have **tested locally** with `npm start` or `npm run server`.  
   - Prefer **meaningful commits** (e.g. “Add client logos”, “Update catalog prices”) instead of half-broken work on `main`.  
   - **Push does not update the live server by itself** unless you configured GitHub Actions (or similar) to deploy on push.

---

## Part 2 — Live server (client-facing)

### Minimum requirements

- **Node.js 18+** (LTS recommended) on the VPS / PaaS.  
- **Persistent disk** for the app folder (so `data/` and uploaded `assets/` survive restarts).  
- **HTTPS** in front (Let’s Encrypt, Cloudflare, or your host’s certificate).

### Environment variables (set on the host, not in Git)

Copy [`.env.example`](../.env.example) values into the host’s env config (or a server-only `.env` file):

| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD` | Strong password only the client (and you) know. |
| `SESSION_SECRET` | Long random string; signs admin login sessions. |
| `NODE_ENV` | Set to `production` on HTTPS so the admin cookie is sent only over secure connections. |
| `PORT` | Optional; default `8787`. Many hosts set `PORT` automatically. |
| `CORS_ORIGIN` | Only if the **browser** loads the API from a **different** origin than the site. Same domain (typical) → leave empty. |

### Start command

From the project root (same folder as `package.json`):

```bash
npm install
npm start
```

(`npm start` and `npm run server` both run `node server/index.js`.)

Use a **process manager** in production so the app restarts if it crashes:

- **Linux:** systemd, PM2  
- **Windows Server:** NSSM, Windows Service, PM2  

Bind to the port your reverse proxy expects (often `PORT` from the host).

### Reverse proxy (recommended)

Put **nginx**, Caddy, or your host’s “Web service” in front:

- Terminate **HTTPS** here.  
- Proxy `/` to `http://127.0.0.1:<PORT>` (your Node app).  
- Optionally restrict `/admin/` by IP (extra layer) if the client has a fixed office IP.

---

## Part 3 — Handover checklist (email / PDF for client)

Copy and adapt:

1. **Public website:** `https://<their-domain>/`  
2. **Admin (keep private):** `https://<their-domain>/admin/`  
3. **Admin password:** (share via password manager or separate channel — not in the same email as the URL if possible.)  
4. **What they can edit:** Products, valued clients, optional site JSON (hero / About / Contact), optional category list; product/client images via upload buttons.  
5. **Support:** Your contact for “site down” or “forgot password” (password reset = you or hosting SSH change `ADMIN_PASSWORD` and restart).  
6. **Backups:** Encourage periodic download of `data/` and `assets/` from the server or rely on host snapshots.

---

## Part 4 — Optional: deploy from GitHub (automation)

**Render (step-by-step):** [ONLINE_ADMIN_DEPLOY.md](./ONLINE_ADMIN_DEPLOY.md) — blueprint `render.yaml`, custom domain, optional deploy hook.

**GitHub Actions + VPS:** On push to `main`, SSH into the VPS and `git pull && npm install && pm2 restart <name>`. Store **SSH key** and **host** in GitHub **Secrets** — not in the repo.

**This repo includes:** [`.github/workflows/render-deploy.yml`](../.github/workflows/render-deploy.yml) — set secret `RENDER_DEPLOY_HOOK` to enable auto-redeploy on push to `main`.

Hosts like **Railway** / **Fly.io** follow the same idea: **`npm start`**, env vars, HTTPS, persistent disk for `data/` and `assets/`.

---

## Part 5 — Security summary

- Strong `ADMIN_PASSWORD`; never commit it.  
- Random `SESSION_SECRET`; never commit it.  
- `NODE_ENV=production` **only** when the site is served over **HTTPS** (otherwise the secure session cookie can block login).  
- Do not advertise `/admin/` on marketing pages.  
- Keep Node and dependencies updated (`npm audit` periodically).

---

## Quick reference

| Task | Command / location |
|------|---------------------|
| Local / prod process | `npm start` or `npm run server` → site + **`/admin/`** on same port |
| Env template | [`.env.example`](../.env.example) |
| Server entry | [`server/index.js`](../server/index.js) |
| Ops overview | [`OPERATIONS.md`](./OPERATIONS.md) |

If anything in this doc does not match your host’s UI, keep the **same env vars and start command** — only the clicks to set them change.
