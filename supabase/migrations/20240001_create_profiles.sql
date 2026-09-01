-- ============================================================
-- Connect Commons — Migration 001
-- Creates the profiles table, RLS policies, trigger
-- ============================================================

-- ── 1. Create the profiles table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT         NOT NULL,
  email       TEXT         NOT NULL,
  role        TEXT         NOT NULL DEFAULT 'user'
                           CHECK (role IN ('admin', 'user')),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. Index for common lookups ──────────────────────────────
CREATE INDEX IF NOT EXISTS profiles_role_idx      ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles (is_active);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- ── 3. Keep updated_at current automatically ─────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ── 4. Auto-create a profile when a new Auth user is created ─
--  • Default role = 'user', is_active = true
--  • Does NOT override a profile that already exists (safe for
--    admin-created users where we insert the profile ourselves)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;   -- prevents duplicates if profile was pre-created
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 5. Enable Row Level Security ─────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 6. Helper: check if the requesting user is an active admin
--  Uses SECURITY DEFINER so it can bypass RLS when called from
--  within a policy expression (avoids infinite recursion).
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
  );
$$;

-- ── 7. RLS Policies ──────────────────────────────────────────

-- 7a. Users can read their OWN profile
CREATE POLICY "profiles: user reads own"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- 7b. Active admins can read ALL profiles
CREATE POLICY "profiles: admin reads all"
  ON public.profiles
  FOR SELECT
  USING (public.is_active_admin());

-- 7c. Active admins can INSERT new profiles (for user creation)
CREATE POLICY "profiles: admin inserts"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_active_admin());

-- 7d. Active admins can UPDATE profiles
--     They may NOT change their own role or own is_active
--     (prevents accidental self-lockout; handled in app too)
CREATE POLICY "profiles: admin updates"
  ON public.profiles
  FOR UPDATE
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 7e. Users may update ONLY their own full_name
--     They may NOT change role or is_active (enforced by app + DB)
CREATE POLICY "profiles: user updates own name"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Role and is_active must remain unchanged
    AND role     = (SELECT role     FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

-- 7f. No DELETE allowed via RLS (deactivate instead)
--     (No DELETE policy = nobody can delete through the API)

-- ============================================================
-- FIRST ADMIN BOOTSTRAP
-- After running this migration, create your first admin:
--
-- 1. Supabase Dashboard → Authentication → Users → Add User
--    (use email + password, confirm email)
--
-- 2. Run this SQL (replace the UUID and values):
--
--    INSERT INTO public.profiles (id, full_name, email, role, is_active)
--    VALUES (
--      '<uuid-from-auth-users>',
--      'Admin Name',
--      'admin@example.com',
--      'admin',
--      TRUE
--    )
--    ON CONFLICT (id) DO UPDATE
--      SET role = 'admin', is_active = TRUE;
--
-- ============================================================
