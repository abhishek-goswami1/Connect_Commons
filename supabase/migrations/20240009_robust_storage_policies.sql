-- ============================================================
-- Connect Commons — Migration 009
-- Robust Storage Policies Fix
-- ============================================================

-- 1. Fix Submission Upload and Read
DROP POLICY IF EXISTS "storage: user upload submissions" ON storage.objects;
DROP POLICY IF EXISTS "storage: user read own submissions" ON storage.objects;

CREATE POLICY "storage: user upload submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignment-submissions'
    AND auth.uid() IS NOT NULL
    -- Format: assignments/<assignment_id>/submissions/<user_id>/...
    AND name LIKE 'assignments/%/submissions/' || auth.uid()::text || '/%'
  );

CREATE POLICY "storage: user read own submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-submissions'
    AND auth.uid() IS NOT NULL
    AND name LIKE 'assignments/%/submissions/' || auth.uid()::text || '/%'
  );

CREATE POLICY "storage: admin read submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-submissions'
    AND public.is_active_admin()
  );

CREATE POLICY "storage: admin delete submissions"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assignment-submissions'
    AND public.is_active_admin()
  );

-- 2. Fix Reference Files Upload and Read
DROP POLICY IF EXISTS "storage: admin upload" ON storage.objects;
DROP POLICY IF EXISTS "storage: admin read" ON storage.objects;
DROP POLICY IF EXISTS "storage: admin delete" ON storage.objects;
DROP POLICY IF EXISTS "storage: user read assigned" ON storage.objects;

-- Admin can do anything in reference files
CREATE POLICY "storage: admin upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignment-reference-files'
    AND public.is_active_admin()
  );

CREATE POLICY "storage: admin read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-reference-files'
    AND public.is_active_admin()
  );

CREATE POLICY "storage: admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assignment-reference-files'
    AND public.is_active_admin()
  );

-- Users can read reference files if they are assigned to the assignment.
-- For this, we'll extract the assignment_id from the path using substring and check is_assigned_to.
CREATE POLICY "storage: user read assigned"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-reference-files'
    AND auth.uid() IS NOT NULL
    AND public.is_assigned_to(
      (regexp_match(name, '^assignments/([^/]+)/reference/'))[1]::uuid
    )
  );
