-- Fix "operator does not exist: uuid = text" when legacy columns are text
-- but auth.uid() / FK columns are uuid (common after RLS + limit trigger).

-- -----------------------------------------------------------------------------
-- Trigger: compare company_ref to uuid FK explicitly
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_saved_quotation_limit_per_doc_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  max_n int;
  cnt int;
BEGIN
  SELECT COALESCE(
    (SELECT l.max_saved_per_doc_type
     FROM public.company_quotation_limits l
     WHERE l.company_id::text = NEW.company_ref::text),
    10
  ) INTO max_n;

  SELECT COUNT(*)::int INTO cnt
  FROM public.saved_quotations s
  WHERE s.company_ref::text = NEW.company_ref::text
    AND s.user_id::text = NEW.user_id::text
    AND s.doc_type IS NOT DISTINCT FROM NEW.doc_type;

  IF cnt >= max_n THEN
    RAISE EXCEPTION 'SAVED_QUOTATION_LIMIT_REACHED'
      USING DETAIL = format('Limit is %s saved documents per type for this company.', max_n);
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS: cast user_id to uuid so policies work with text or uuid columns
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "qg_user_data_own" ON public.user_data;
CREATE POLICY "qg_user_data_own"
  ON public.user_data
  FOR ALL
  TO authenticated
  USING (user_id::uuid = auth.uid())
  WITH CHECK (user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "qg_user_images_own" ON public.user_images;
CREATE POLICY "qg_user_images_own"
  ON public.user_images
  FOR ALL
  TO authenticated
  USING (user_id::uuid = auth.uid())
  WITH CHECK (user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "qg_companies_own" ON public.companies;
CREATE POLICY "qg_companies_own"
  ON public.companies
  FOR ALL
  TO authenticated
  USING (user_id::uuid = auth.uid())
  WITH CHECK (user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "qg_clients_own" ON public.clients;
CREATE POLICY "qg_clients_own"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (user_id::uuid = auth.uid())
  WITH CHECK (user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "qg_saved_quotations_own" ON public.saved_quotations;
CREATE POLICY "qg_saved_quotations_own"
  ON public.saved_quotations
  FOR ALL
  TO authenticated
  USING (user_id::uuid = auth.uid())
  WITH CHECK (user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "qg_company_quotation_limits_own" ON public.company_quotation_limits;
CREATE POLICY "qg_company_quotation_limits_own"
  ON public.company_quotation_limits
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_quotation_limits.company_id
        AND c.user_id::uuid = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_quotation_limits.company_id
        AND c.user_id::uuid = auth.uid()
    )
  );
