-- ============================================================
-- Connect Commons — Migration 004
-- Creates storage buckets and their RLS policies for assignments and submissions
-- ============================================================

-- ── 1. Create reference files bucket ─────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('assignment-reference-files', 'assignment-reference-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for assignment-reference-files
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

CREATE POLICY "storage: user read assigned"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-reference-files'
    AND EXISTS (
      SELECT 1 FROM public.assignment_files af
      JOIN public.assignment_users au ON au.assignment_id = af.assignment_id
      WHERE af.file_path = name
        AND au.user_id = auth.uid()
    )
  );

-- ── 2. Create submissions bucket ─────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for assignment-submissions
CREATE POLICY "storage: user upload submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignment-submissions'
  );

CREATE POLICY "storage: user read own submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-submissions'
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
