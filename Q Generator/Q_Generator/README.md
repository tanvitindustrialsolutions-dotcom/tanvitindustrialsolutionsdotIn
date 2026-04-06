# Quotation & Invoice Generator

Browser-based quotations, invoices, and related documents with PDF export and Supabase-backed profiles.

## Where this project lives

All app source for Q Generator is under **`Q Generator/Q_Generator/`** (this folder). The parent **`Q Generator/index.html`** redirects into this app. There is **no** Q Generator entry file at the workspace root (`BHANU`); keep new files for this product here or under `Q Generator/`, not outside.

## Deployment & custom domain

See **[docs/GO_LIVE.md](docs/GO_LIVE.md)** for GitHub Pages, DNS, Supabase auth URLs, Razorpay hosted links, and launch checklist.

## Billing configuration

Paste Razorpay hosted payment URLs in `app.js` (`BILLING_CONFIG`). Details: `billing/BILLING_HOSTED_LINKS.txt`.

Signed-in users see **subscription status** on the **top bar** badge (next to the company pill); click it to open the account & subscription popup.

## Database

Apply SQL migrations under `supabase/migrations/` in your Supabase project (including `user_subscription` for trials and billing).

## Sign up

The login overlay supports **Sign Up** with confirm password, optional **full name** (stored in Supabase Auth `user_metadata` as `full_name`), **Terms / Privacy** acceptance, and `emailRedirectTo` aligned with the current page URL. Allow that URL in Supabase **Authentication → Redirect URLs** (see `docs/GO_LIVE.md`).
