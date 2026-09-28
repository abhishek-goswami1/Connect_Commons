-- ============================================================
-- Connect Commons — Migration 002
-- Creates assignments, assignment_users, assignment_files
-- ============================================================

-- ── 1. assignments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT         NOT NULL,
  description  TEXT,
  instructions TEXT,
  deadline     TIMESTAMPTZ,
  priority     TEXT         NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low', 'medium', 'high')),
  status       TEXT         NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN (
                              'in_progress',
                              'submitted',
                              'under_review',
                              'revision_required',
                              'approved',
                              'overdue'
                            )),
  created_by   UUID         NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  archived_at  TIMESTAMPTZ  -- NULL = active; NOT NULL = archived
);

-- ── 2. assignment_users ───────────────────────────────────────
-- Links one assignment to one or more users
CREATE TABLE IF NOT EXISTS public.assignment_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, user_id)   -- prevent duplicate assignments
);

-- ── 3. assignment_files ───────────────────────────────────────
-- Metadata for reference files uploaded by Admin
CREATE TABLE IF NOT EXISTS public.assignment_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,   -- original filename shown to users
  file_path     TEXT        NOT NULL,   -- Supabase Storage path
  file_size     BIGINT,                 -- bytes
  file_type     TEXT,                   -- MIME type
  uploaded_by   UUID        NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. updated_at trigger for assignments ────────────────────
DROP TRIGGER IF EXISTS assignments_updated_at ON public.assignments;
CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();   -- re-uses function from migration 001

-- ── 5. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS assignments_created_by_idx   ON public.assignments (created_by);
CREATE INDEX IF NOT EXISTS assignments_status_idx        ON public.assignments (status);
CREATE INDEX IF NOT EXISTS assignments_deadline_idx      ON public.assignments (deadline);
CREATE INDEX IF NOT EXISTS assignments_archived_at_idx   ON public.assignments (archived_at);
CREATE INDEX IF NOT EXISTS asgn_users_assignment_id_idx  ON public.assignment_users (assignment_id);
CREATE INDEX IF NOT EXISTS asgn_users_user_id_idx        ON public.assignment_users (user_id);
CREATE INDEX IF NOT EXISTS asgn_files_assignment_id_idx  ON public.assignment_files (assignment_id);

-- ── 6. Enable RLS ────────────────────────────────────────────
ALTER TABLE public.assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_files ENABLE ROW LEVEL SECURITY;

-- ── 7. Helper: check if current user is assigned to an assignment
CREATE OR REPLACE FUNCTION public.is_assigned_to(p_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignment_users
    WHERE assignment_id = p_assignment_id
      AND user_id = auth.uid()
  );
$$;

-- ── 8. RLS policies: assignments ─────────────────────────────

-- Admin: full read on all assignments
CREATE POLICY "assignments: admin select"
  ON public.assignments FOR SELECT
  USING (public.is_active_admin());

-- User: can only see assignments they are assigned to
CREATE POLICY "assignments: user select own"
  ON public.assignments FOR SELECT
  USING (public.is_assigned_to(id));

-- Admin: can insert assignments
CREATE POLICY "assignments: admin insert"
  ON public.assignments FOR INSERT
  WITH CHECK (public.is_active_admin());

-- Admin: can update assignments
CREATE POLICY "assignments: admin update"
  ON public.assignments FOR UPDATE
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- No DELETE policy → no one can delete assignments (archive instead)

-- ── 9. RLS policies: assignment_users ────────────────────────

-- Admin: full read on assignment_users
CREATE POLICY "asgn_users: admin select"
  ON public.assignment_users FOR SELECT
  USING (public.is_active_admin());

-- User: can see their own assignment_users rows
CREATE POLICY "asgn_users: user select own"
  ON public.assignment_users FOR SELECT
  USING (user_id = auth.uid());

-- Admin: can insert assignment_users (assign users)
CREATE POLICY "asgn_users: admin insert"
  ON public.assignment_users FOR INSERT
  WITH CHECK (public.is_active_admin());

-- Admin: can delete assignment_users (reassign users)
CREATE POLICY "asgn_users: admin delete"
  ON public.assignment_users FOR DELETE
  USING (public.is_active_admin());

-- ── 10. RLS policies: assignment_files ───────────────────────

-- Admin: full read on files
CREATE POLICY "asgn_files: admin select"
  ON public.assignment_files FOR SELECT
  USING (public.is_active_admin());

-- User: can only see files for assignments assigned to them
CREATE POLICY "asgn_files: user select own"
  ON public.assignment_files FOR SELECT
  USING (public.is_assigned_to(assignment_id));

-- Admin: can upload (insert) files
CREATE POLICY "asgn_files: admin insert"
  ON public.assignment_files FOR INSERT
  WITH CHECK (public.is_active_admin());

-- Admin: can delete file metadata (if they remove a reference file)
CREATE POLICY "asgn_files: admin delete"
  ON public.assignment_files FOR DELETE
  USING (public.is_active_admin());

-- ── 11. Supabase Storage bucket + policies ────────────────────
-- Run these in the Supabase SQL editor after creating the storage bucket
-- named "assignment-reference-files" (create via Dashboard → Storage).
--
-- Storage bucket RLS (run after bucket exists):
--
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('assignment-reference-files', 'assignment-reference-files', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "storage: admin upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'assignment-reference-files'
--     AND public.is_active_admin()
--   );
--
-- CREATE POLICY "storage: admin read"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'assignment-reference-files'
--     AND public.is_active_admin()
--   );
--
-- CREATE POLICY "storage: admin delete"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'assignment-reference-files'
--     AND public.is_active_admin()
--   );
--
-- CREATE POLICY "storage: user read assigned"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'assignment-reference-files'
--     AND EXISTS (
--       SELECT 1 FROM public.assignment_files af
--       JOIN public.assignment_users au ON au.assignment_id = af.assignment_id
--       WHERE af.file_path = name
--         AND au.user_id = auth.uid()
--     )
--   );
-- ============================================================
