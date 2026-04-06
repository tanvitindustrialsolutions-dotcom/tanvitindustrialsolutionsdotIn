-- Billing / trial: 15 days full free, then 15 days free with autopay setup, then paid (₹100/mo or ₹1000/yr).
-- Run in Supabase SQL Editor after prior QG migrations.

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscription (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  billing_setup_at timestamptz,
  plan text CHECK (plan IS NULL OR plan IN ('monthly', 'yearly')),
  provider_subscription_id text,
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  paid_through timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscription_status ON public.user_subscription (status);

ALTER TABLE public.user_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qg_user_subscription_select" ON public.user_subscription;
DROP POLICY IF EXISTS "qg_user_subscription_insert" ON public.user_subscription;
DROP POLICY IF EXISTS "qg_user_subscription_update" ON public.user_subscription;

CREATE POLICY "qg_user_subscription_select"
  ON public.user_subscription FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "qg_user_subscription_insert"
  ON public.user_subscription FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "qg_user_subscription_update"
  ON public.user_subscription FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Ensure row exists (trial clock starts on first app open after signup)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_user_subscription()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscription (user_id, trial_started_at)
  VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_subscription() TO authenticated;

COMMENT ON TABLE public.user_subscription IS 'QG monetisation: trial + Razorpay subscription fields; updated by app + webhooks.';
