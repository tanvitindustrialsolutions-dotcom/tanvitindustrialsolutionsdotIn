# Local admin + website Hostinger par (bina live Node / bina upgrade)

## Ye model kab use karo

- Hostinger **Single** plan par rehna hai **aur** Render / upgrade **nahi** karna.  
- **Admin hamesha local** (apne PC) par chalega.  
- Jo files badlen (`data/*.json`, `assets/`, kabhi HTML/JS), unko **Git push** se GitHub bhejo, phir **Hostinger par files update** ho jayein (manual FTP **ya** auto deploy — neeche).

**Important:** Internet par **`https://domain/admin/`** is setup mein **save nahi** chalayega (server Node nahi). Client ko **local steps** sikhane padenge, ya tum khud edit karke push karte ho.

---

## Roz ka flow (simple)

1. PC par project folder kholo.  
2. **`.env`** banao (ek baar) — `ADMIN_PASSWORD`, `SESSION_SECRET` ([`.env.example`](../.env.example)).  
3. Terminal: `npm run server`  
4. Browser: `http://localhost:8787/admin/` — yahan se jo edit karo **disk par** `data/` aur `assets/` mein save hota hai.  
5. **Git:** badli hui files commit + push:  
   `git add` → `git commit -m "..."` → `git push`  
6. **Hostinger:**  
   - **Option A — Auto:** GitHub Action jo FTP se `public_html` par daale (template: [`.github/workflows/hostinger-ftps-deploy.example.yml`](../.github/workflows/hostinger-ftps-deploy.example.yml)).  
   - **Option B — Manual:** Hostinger **File Manager** se sirf badli files upload karo (ya poora folder zip — dhyan se).

---

## Live site par kya chalega

- HTML / CSS / JS / `data/catalog.json` / images — **static** — Hostinger par **theek chalega**.  
- Shop `catalog-loader` pehle `/api/catalog` try karta hai — static par **404** hoga, phir **`/data/catalog.json`** use hoga — isliye **`data/catalog.json` deploy hona zaroori** hai.

---

## Client ko dena kya

- Project copy **ya** Git clone + Node install + `.env` + `npm run server` + `/admin/` link.  
- Ya sirf tum push karte ho — client sirf site dekhta hai.

---

## FTP auto-deploy setup (short)

1. Hostinger → **FTP Accounts** — user/password + server hostname note karo.  
2. GitHub repo → **Settings → Secrets** — `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` (aur agar path alag ho to workflow mein `server-dir` badlo).  
3. Repo mein example workflow copy karke naam `.yml` rakho aur paths check karo (`Tanvit Industrial Solution/` vs root repo).

Example file: [hostinger-ftps-deploy.example.yml](../.github/workflows/hostinger-ftps-deploy.example.yml) — copy → rename (`.example` hatao) tab activate jab secrets ready hon.
