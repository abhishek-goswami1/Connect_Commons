-- ============================================================
-- Connect Commons — Migration 007
-- Core Workflow Fixes
-- ============================================================

-- ── 1. assignment_languages ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignment_languages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, language)
);

ALTER TABLE public.assignment_languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asgn_lang: admin full access"
  ON public.assignment_languages FOR ALL
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

CREATE POLICY "asgn_lang: user select assigned"
  ON public.assignment_languages FOR SELECT
  USING (public.is_assigned_to(assignment_id));

CREATE INDEX IF NOT EXISTS asgn_lang_assignment_id_idx ON public.assignment_languages (assignment_id);


-- ── 2. submission_languages ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submission_languages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, language)
);

ALTER TABLE public.submission_languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_lang: admin full access"
  ON public.submission_languages FOR ALL
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

CREATE POLICY "sub_lang: user select own"
  ON public.submission_languages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "sub_lang: user insert own"
  ON public.submission_languages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS sub_lang_submission_id_idx ON public.submission_languages (submission_id);


-- ── 3. Improved Notification Triggers ────────────────────────
-- Replace generic messages with dynamic rich messages

-- A. Assignment Assigned
CREATE OR REPLACE FUNCTION notify_assignment_users() RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
BEGIN
  SELECT title INTO v_title FROM public.assignments WHERE id = NEW.assignment_id;
  INSERT INTO public.notifications (user_id, type, title, message, assignment_id)
  VALUES (
    NEW.user_id, 
    'assignment_assigned', 
    'New Assignment', 
    'You have been assigned: ' || v_title,
    NEW.assignment_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Submission Received (Admin)
CREATE OR REPLACE FUNCTION notify_submission_received() RETURNS TRIGGER AS $$
DECLARE
  v_admin RECORD;
  v_title TEXT;
  v_user_name TEXT;
BEGIN
  -- We only notify when inserting a brand new submission or status changes to submitted.
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    SELECT title INTO v_title FROM public.assignments WHERE id = NEW.assignment_id;
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
    
    FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true LOOP
      INSERT INTO public.notifications (user_id, type, title, message, assignment_id, submission_id)
      VALUES (
        v_admin.id, 
        'submission_received', 
        'New Submission', 
        COALESCE(v_user_name, 'A user') || ' submitted V' || NEW.version_number || ' for: ' || v_title,
        NEW.assignment_id,
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Revision Required
CREATE OR REPLACE FUNCTION notify_revision_required() RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != 'revision_required' AND NEW.status = 'revision_required' THEN
    SELECT title INTO v_title FROM public.assignments WHERE id = NEW.assignment_id;
    INSERT INTO public.notifications (user_id, type, title, message, assignment_id, submission_id)
    VALUES (
      NEW.user_id, 
      'revision_required', 
      'Revision Required', 
      'A revision has been requested for V' || NEW.version_number || ' of: ' || v_title,
      NEW.assignment_id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. Submission Approved
CREATE OR REPLACE FUNCTION notify_submission_approved() RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    SELECT title INTO v_title FROM public.assignments WHERE id = NEW.assignment_id;
    INSERT INTO public.notifications (user_id, type, title, message, assignment_id, submission_id)
    VALUES (
      NEW.user_id, 
      'submission_approved', 
      'Submission Approved', 
      'Your submission V' || NEW.version_number || ' has been approved for: ' || v_title,
      NEW.assignment_id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 4. Fix Reference Files Storage Policy ─────────────────────
-- Drop the restrictive policies on reference files and recreate securely but reliably.
-- Ensures that any authenticated user assigned to the assignment can read it.
-- The path is 'assignments/<id>/reference/...'
DROP POLICY IF EXISTS "storage: user read assigned" ON storage.objects;

CREATE POLICY "storage: user read assigned"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-reference-files'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.assignment_users au
      -- Check if the second element in the path (assignments/ID/...) matches an assignment the user is part of.
      WHERE au.assignment_id::text = (storage.foldername(name))[2]
        AND au.user_id = auth.uid()
    )
  );
