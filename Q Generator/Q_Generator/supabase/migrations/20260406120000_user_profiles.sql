-- App user profile (account-level: name, phone) — distinct from companies.profile (company profiles).
-- Run after prior QG migrations.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  phone text,
  phone_verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON public.user_profiles (updated_at);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qg_user_profiles_own" ON public.user_profiles;

CREATE POLICY "qg_user_profiles_own"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create row from auth.users metadata on first call; does not overwrite existing row.
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, phone, updated_at)
  SELECT u.id,
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'phone', '')), ''),
    now()
  FROM auth.users u
  WHERE u.id = auth.uid()
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

COMMENT ON TABLE public.user_profiles IS 'QG account profile: name and phone; RLS per user.';
