-- Quotation Generator (Q_Generator) — Row Level Security
-- Run in Supabase: SQL Editor → New query → paste → Run
-- Tables: user_data, user_images, companies, clients, saved_quotations
-- Assumes each row has user_id UUID matching auth.users(id).

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_quotations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Drop policies if you re-run this script (safe names)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "qg_user_data_own" ON public.user_data;
DROP POLICY IF EXISTS "qg_user_images_own" ON public.user_images;
DROP POLICY IF EXISTS "qg_companies_own" ON public.companies;
DROP POLICY IF EXISTS "qg_clients_own" ON public.clients;
DROP POLICY IF EXISTS "qg_saved_quotations_own" ON public.saved_quotations;

-- -----------------------------------------------------------------------------
-- Policies: signed-in users only touch rows where user_id = their JWT sub
-- -----------------------------------------------------------------------------
-- user_data: one row per user (upsert on user_id)
CREATE POLICY "qg_user_data_own"
  ON public.user_data
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_images: one row per user (upsert on user_id)
CREATE POLICY "qg_user_images_own"
  ON public.user_images
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- companies: profiles owned by user
CREATE POLICY "qg_companies_own"
  ON public.companies
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- clients: belong to a company, always scoped by user_id in app
CREATE POLICY "qg_clients_own"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- saved quotations
CREATE POLICY "qg_saved_quotations_own"
  ON public.saved_quotations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Notes
-- -----------------------------------------------------------------------------
-- • anon role: no policies above → no access (good if all reads require login).
-- • Service role key bypasses RLS — never expose it in the browser.
-- • If any table name/column differs in your project, adjust before running.
