-- Max saved documents per company per doc_type (default 10). Change rows in
-- public.company_quotation_limits to adjust per company when monetizing.

CREATE TABLE IF NOT EXISTS public.company_quotation_limits (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  max_saved_per_doc_type int NOT NULL DEFAULT 10 CHECK (max_saved_per_doc_type > 0)
);

ALTER TABLE public.company_quotation_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qg_company_quotation_limits_own" ON public.company_quotation_limits;

CREATE POLICY "qg_company_quotation_limits_own"
  ON public.company_quotation_limits
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_quotation_limits.company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_quotation_limits.company_id AND c.user_id = auth.uid()
    )
  );

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
     WHERE l.company_id = NEW.company_ref),
    10
  ) INTO max_n;

  SELECT COUNT(*)::int INTO cnt
  FROM public.saved_quotations s
  WHERE s.company_ref = NEW.company_ref
    AND s.user_id = NEW.user_id
    AND s.doc_type IS NOT DISTINCT FROM NEW.doc_type;

  IF cnt >= max_n THEN
    RAISE EXCEPTION 'SAVED_QUOTATION_LIMIT_REACHED'
      USING DETAIL = format('Limit is %s saved documents per type for this company.', max_n);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_saved_quotations_limit_per_doc_type ON public.saved_quotations;

CREATE TRIGGER tr_saved_quotations_limit_per_doc_type
  BEFORE INSERT ON public.saved_quotations
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_saved_quotation_limit_per_doc_type();
