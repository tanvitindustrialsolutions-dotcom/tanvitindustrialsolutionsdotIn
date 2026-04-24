# Deploy full site + `/admin/` on Render (recommended)

This is the **default setup**: one service, **one public URL**. Visitors use `/`, `/shop.html`, etc.; the client opens **`/admin/`** on the **same** host (no second domain, no split between Hostinger + Render unless you choose that later).

See also: [CLIENT-DEPLOY-GITHUB.md](./CLIENT-DEPLOY-GITHUB.md) (secrets, GitHub rules, handover).

---

## 1) Push the project to GitHub

- Commit `data/`, `assets/`, code — **never** commit `.env`.
- Repo can be private.

---

## 2) Create the Web Service on Render

**Option A — Blueprint (uses root `render.yaml`)**

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the GitHub repo and apply the blueprint.
3. When prompted, set **`ADMIN_PASSWORD`** (strong value). `SESSION_SECRET` can be auto-generated unless you override it in the dashboard.
4. Change **region** / **plan** in `render.yaml` if you want (e.g. closer to your users).

**Option B — Manual Web Service**

1. **New** → **Web Service** → connect repo.
2. **Runtime**: Node  
3. **Build command**: `npm install`  
4. **Start command**: `npm start`  
5. **Health check path**: `/healthz`  
6. Environment variables:
   - `NODE_ENV` = `production`
   - `ADMIN_PASSWORD` = (strong password)
   - `SESSION_SECRET` = (long random string)
7. Leave **`CORS_ORIGIN` empty** for this single-host setup.

---

## 3) After first deploy — test

Open (replace with your Render URL):

- `https://<service-name>.onrender.com/` — home  
- `https://<service-name>.onrender.com/healthz` — should return JSON `{"ok":true}`  
- `https://<service-name>.onrender.com/admin/` — log in with `ADMIN_PASSWORD`  

---

## 4) Custom domain (client’s real domain)

1. Render → your Web Service → **Settings** → **Custom Domains** → add `example.com` and `www.example.com` as instructed.
2. At your DNS provider, add the **CNAME / A records** Render shows.
3. Wait for TLS; then the client uses **`https://example.com/admin/`** on the same domain as the public site.

---

## 5) Optional: auto-deploy on every `git push` to `main`

1. Render → Web Service → **Settings** → **Deploy Hook** → create hook, copy URL.  
2. GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → New repository secret:  
   - Name: `RENDER_DEPLOY_HOOK`  
   - Value: (paste hook URL)  
3. The workflow [`.github/workflows/render-deploy.yml`](../.github/workflows/render-deploy.yml) will `curl` that hook on each push to `main`. If the secret is not set, the workflow does nothing.

---

## Disk / persistence (important)

- **Free** Render instances: disk is often **ephemeral** — catalog and uploads from admin may **disappear** after sleep or redeploy.  
- For production: use a **paid** instance type and/or Render **persistent disk** mounted at your app root, **or** run on a VPS where the whole folder is on disk.

---

## Older “split” setup (Hostinger + Render API)

If you previously pointed **only** `catalogUrl` in `js/site-config.js` at a Render API while static HTML stayed on Hostinger, that is a **different** architecture (two origins, CORS, two deploys). The **current recommended** model is: **everything** (HTML + API + admin) from **one** Node process — this document — unless you have a strong reason to split.
