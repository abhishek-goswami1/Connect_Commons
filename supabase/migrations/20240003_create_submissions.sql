-- ============================================================
-- Connect Commons — Migration 003
-- Creates submissions, submission_files, submission_feedback
-- ============================================================

-- ── 1. submissions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID         NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id        UUID         NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  version_number INT          NOT NULL DEFAULT 1,
  status         TEXT         NOT NULL DEFAULT 'submitted'
                              CHECK (status IN (
                                'submitted',
                                'under_review',
                                'revision_required',
                                'approved'
                              )),
  submitted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, user_id, version_number)
);

-- ── 2. submission_files ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submission_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID        NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,
  file_path     TEXT        NOT NULL,
  file_size     BIGINT,
  file_type     TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. submission_feedback ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submission_feedback (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID        NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_by    UUID        NOT NULL REFERENCES public.profiles(id),
  feedback      TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS submissions_assignment_id_idx ON public.submissions (assignment_id);
CREATE INDEX IF NOT EXISTS submissions_user_id_idx       ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS sub_files_submission_id_idx   ON public.submission_files (submission_id);
CREATE INDEX IF NOT EXISTS sub_feedback_sub_id_idx       ON public.submission_feedback (submission_id);

-- ── 5. Enable RLS ────────────────────────────────────────────
ALTER TABLE public.submissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_feedback ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS policies: submissions ─────────────────────────────

-- Admin: full read on all submissions
CREATE POLICY "submissions: admin select"
  ON public.submissions FOR SELECT
  USING (public.is_active_admin());

-- Admin: update submissions (status)
CREATE POLICY "submissions: admin update"
  ON public.submissions FOR UPDATE
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- User: read own submissions (for assigned assignments)
CREATE POLICY "submissions: user select own"
  ON public.submissions FOR SELECT
  USING (user_id = auth.uid());

-- User: insert own submissions
CREATE POLICY "submissions: user insert own"
  ON public.submissions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND public.is_assigned_to(assignment_id)
  );

-- ── 7. RLS policies: submission_files ────────────────────────

-- Admin: full read on all submission files
CREATE POLICY "sub_files: admin select"
  ON public.submission_files FOR SELECT
  USING (public.is_active_admin());

-- User: read own submission files
CREATE POLICY "sub_files: user select own"
  ON public.submission_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

-- User: insert own submission files
CREATE POLICY "sub_files: user insert own"
  ON public.submission_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

-- ── 8. RLS policies: submission_feedback ─────────────────────

-- Admin: full read on feedback
CREATE POLICY "sub_feedback: admin select"
  ON public.submission_feedback FOR SELECT
  USING (public.is_active_admin());

-- Admin: insert feedback
CREATE POLICY "sub_feedback: admin insert"
  ON public.submission_feedback FOR INSERT
  WITH CHECK (public.is_active_admin());

-- User: read feedback for their own submissions
CREATE POLICY "sub_feedback: user select own"
  ON public.submission_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

-- ── 9. Supabase Storage bucket + policies ────────────────────
-- Run these in the Supabase SQL editor after creating the storage bucket
-- named "assignment-submissions" (create via Dashboard → Storage).
--
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('assignment-submissions', 'assignment-submissions', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "storage: user upload submissions"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'assignment-submissions'
--     -- Optional: check if path begins with assignments/..., etc.
--   );
--
-- CREATE POLICY "storage: user read own submissions"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'assignment-submissions'
--   );
--
-- CREATE POLICY "storage: admin read submissions"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'assignment-submissions'
--     AND public.is_active_admin()
--   );
--
-- CREATE POLICY "storage: admin delete submissions"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'assignment-submissions'
--     AND public.is_active_admin()
--   );
-- ============================================================
