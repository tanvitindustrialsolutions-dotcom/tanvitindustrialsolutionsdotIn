# Go live: real domain + open market

This is the single checklist for **custom domain hosting**, **Supabase auth**, **Razorpay billing**, and **launch readiness**. Keep it updated as you change infrastructure.

---

## 1. Domain strategy (choose one)

| Approach | Best for | Notes |
|----------|----------|--------|
| **Subdomain** `app.yourbrand.com` | Most SaaS-style apps | Easiest DNS (one CNAME). |
| **Apex** `yourbrand.com` | Marketing site on same domain | Use ALIAS/ANAME or GitHub’s A records; slightly more DNS work. |

**Recommendation:** Point **`app.` (or `quote.`)** at the static site so your main marketing site can stay on `www.` or apex on another host later.

---

## 2. GitHub Pages + custom domain

1. Repo **Settings → Pages**: source = branch (e.g. `main`), folder `/ (root)` or `/docs` (match how you deploy).  
   **If you use `/ (root)`:** GitHub serves **`index.html` from the repository root** only. Because the app files live under `Q Generator/`, the repo includes a **tiny root `index.html`** (at `BHANU/index.html` in the clone) that redirects to `Q%20Generator/index.html`. Without it, `https://user.github.io/repo-name/` returns **404**. You can also open the app directly at `.../repo-name/Q%20Generator/index.html`.
2. **Custom domain:** enter e.g. `app.yourbrand.com`.
3. Enable **Enforce HTTPS** (after DNS propagates and certificate is issued).
4. In the repo **publishing root**, add a file named **`CNAME`** whose **only line** is your hostname, e.g.:

   ```text
   app.yourbrand.com
   ```

   See `docs/CNAME.example` in this project.  
   *If your site is a **project site** (`username.github.io/repo-name/`), GitHub still supports a custom domain; the app may load at `https://app.yourbrand.com/repo-name/...` unless you deploy only the app folder to the root of the site—plan URL structure before sharing links.*

5. **DNS at your registrar**

   - **Subdomain** `app`: **CNAME** → `YOURUSER.github.io` (or org pages hostname GitHub shows).
   - **Apex** (if you must): use GitHub’s current [IP addresses for Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain) (they can change—always verify GitHub docs).

Propagation can take minutes to 48 hours.

---

## 3. App URL shape (important for this repo)

The app source lives under **`Q Generator/`** in this repo (e.g. GitHub Pages project URL `https://user.github.io/repo-name/Q%20Generator/`). For a **clean public URL** (`https://app.yourbrand.com/` with no extra path):

- Prefer a **deploy step** that publishes **only** the app folder contents (`index.html`, `app.js`, `styles.css`, `templates/`, etc.) to the **root** of the GitHub Pages branch, **or**
- Use a **second repo** `yourbrand.github.io` / dedicated repo whose root *is* the built app.

Update bookmarks, Razorpay **redirect/callback** expectations, and marketing to match the **final** URL users will see.

---

## 4. Supabase (auth + API) — required for custom domain

In [Supabase Dashboard](https://supabase.com/dashboard) → your project:

1. **Authentication → URL configuration**
   - **Site URL:** `https://app.yourbrand.com` (your real origin, no trailing slash unless you always use one).
   - **Redirect URLs:** add at least:
     - `https://app.yourbrand.com`
     - `https://app.yourbrand.com/**` (wildcard if available in your plan/UI)
     - Keep `http://localhost:*` entries for local dev if you use them.
   - **Sign up / email confirmation:** The app sets `signUp({ options: { emailRedirectTo } })` to `origin + pathname` (same base URL as password reset — see `_authEmailRedirectTo()` in `app.js`). That pattern must be allowed here, or confirmation links may fail to return users to your app.

2. **Email templates** (password recovery, etc.): links must work on your domain; Supabase uses Site URL / redirect settings.

3. **Sign-up confirmation (email OTP vs link):** The app supports entering a **confirmation code** after sign-up (`verifyOtp` with `type: 'signup'`) when Supabase sends a **token/OTP** in the “Confirm signup” email. In **Authentication → Email** (or Templates), configure the confirm-signup flow so users receive a **code** if you want the in-app OTP field; if the project only sends a **magic link**, users can still confirm by opening the link in the same browser. Keep `emailRedirectTo` allowed (see URL configuration above).

4. **User profile table:** Run the migration that creates `public.user_profiles` and `ensure_user_profile()` (see `supabase/migrations/`). The app stores **name** and **mobile** (E.164 with `+` and country code) there and in Auth metadata. **Mobile SMS OTP** is not required for launch; when you add an **SMS provider** (e.g. Twilio) under Authentication, you can enable phone verification later.

5. **No frontend code change** is strictly required for “forgot password” if you already use `window.location.origin` + `pathname` (this project does for recovery redirect). The **allowlist** in the dashboard must include your production URL.

6. **RLS / tables:** confirm migrations (including `user_subscription` and `user_profiles`) are applied on the **production** project if you use a separate dev project later.

---

## 5. Razorpay (hosted links + production)

1. Paste **`PAYMENT_LINK_MONTHLY`** and **`PAYMENT_LINK_YEARLY`** in `app.js` → `BILLING_CONFIG` (see `billing/BILLING_HOSTED_LINKS.txt`).
2. **Webhooks (production):** configure Razorpay to POST to a **HTTPS** endpoint you control (e.g. Supabase Edge Function). That handler should **verify the signature** and `UPDATE public.user_subscription` for the right `user_id` / customer mapping.
3. **Manual testing:** until the webhook exists, you can unlock test users in the Supabase Table Editor.

---

## 6. Security checklist (minimum)

- [ ] Only **anon / publishable** Supabase key in the frontend (never **service role** in `app.js` or GitHub).
- [ ] Razorpay **secret** only on server (Edge Function / backend), not in the repo.
- [ ] **HTTPS** on the live domain (GitHub Pages does this after DNS + certificate).
- [ ] Review **Supabase RLS** policies for all public tables.

---

## 7. Legal / trust (India + subscriptions)

The app includes **in-app modals** for **Terms of Service** and **Privacy Policy** (from the sign-up checkbox and from **Account & subscription**). The text is a **general template** (trial/subscription language aligned with in-app pricing, Supabase/Razorpay mentions, India governing law placeholder). **Have it reviewed by qualified counsel** and replace placeholders (e.g. contact email) before a wide “open market” launch.

You should still provide a real **support / contact** channel and keep Terms and Privacy aligned with your actual data and billing practices.

---

## 8. Launch checklist (short)

- [ ] Custom domain resolves; **HTTPS** works; no mixed-content warnings.
- [ ] Sign-up (email + password + mobile), optional **email confirmation code**, sign-in, **forgot password** tested on **production URL**.
- [ ] **Account → profile** shows email/name/mobile; **Save profile** works after `user_profiles` migration.
- [ ] **Trial + paywall** tested: phase 1 → phase 2 → (simulated) unlock after DB update or webhook.
- [ ] **PDF export** and **save to cloud** tested on Chrome/Edge + one mobile browser.
- [ ] **Razorpay** links open correctly; webhook or manual DB path verified for at least one test payment.
- [ ] **Support path** (email) exists and is monitored.
- [ ] Error handling: at least know how you’ll see production issues (Supabase logs, Razorpay dashboard, optional analytics later).

---

## 9. Optional next steps

- **Staging:** duplicate Supabase project + separate GitHub branch/fork for `staging.app.` domain.
- **Analytics:** privacy-friendly tool once you have a privacy policy.
- **Status page:** optional for paid users later.

---

## 10. Files in this repo to keep in sync

| Topic | File |
|--------|------|
| Hosted payment URLs | `app.js` → `BILLING_CONFIG` |
| Razorpay link setup | `billing/BILLING_HOSTED_LINKS.txt` |
| CNAME example | `docs/CNAME.example` |

When the **live domain** is fixed, store it in team notes or deployment runbook so Supabase and DNS stay aligned.
