-- ============================================================
-- Connect Commons — Migration 006
-- Creates notifications, announcements, activity_logs
-- ============================================================

-- ── 1. announcements ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT         NOT NULL,
  message     TEXT         NOT NULL,
  created_by  UUID         NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN      NOT NULL DEFAULT true
);

-- ── 2. notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT         NOT NULL CHECK (type IN ('assignment_created', 'assignment_assigned', 'submission_received', 'revision_required', 'submission_approved', 'announcement')),
  title         TEXT         NOT NULL,
  message       TEXT         NOT NULL,
  assignment_id UUID         REFERENCES public.assignments(id) ON DELETE CASCADE,
  submission_id UUID         REFERENCES public.submissions(id) ON DELETE CASCADE,
  is_read       BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 3. activity_logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT         NOT NULL,
  entity_type TEXT         NOT NULL,
  entity_id   UUID         NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS announcements_active_idx ON public.announcements (is_active);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_actor_idx ON public.activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON public.activity_logs (action);
CREATE INDEX IF NOT EXISTS activity_logs_entity_type_idx ON public.activity_logs (entity_type);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);

-- ── 5. Enable RLS ─────────────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS: Announcements ─────────────────────────────────────
CREATE POLICY "announcements: admin select" ON public.announcements FOR SELECT USING (public.is_active_admin());
CREATE POLICY "announcements: admin insert" ON public.announcements FOR INSERT WITH CHECK (public.is_active_admin());
CREATE POLICY "announcements: admin update" ON public.announcements FOR UPDATE USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "announcements: active users select active" ON public.announcements FOR SELECT USING (
  is_active = true 
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
);

-- ── 7. RLS: Notifications ─────────────────────────────────────
CREATE POLICY "notifications: admin select" ON public.notifications FOR SELECT USING (public.is_active_admin());
CREATE POLICY "notifications: user select own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications: user update own" ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Only system (triggers) and admin can insert
CREATE POLICY "notifications: admin insert" ON public.notifications FOR INSERT WITH CHECK (public.is_active_admin());

-- ── 8. RLS: Activity Logs ─────────────────────────────────────
CREATE POLICY "activity_logs: admin select" ON public.activity_logs FOR SELECT USING (public.is_active_admin());
-- Activity logs are read-only and inserted via triggers/functions

-- ── 9. Trigger Functions for Notifications ─────────────────────

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

DROP TRIGGER IF EXISTS notify_assignment_assigned ON public.assignment_users;
CREATE TRIGGER notify_assignment_assigned
  AFTER INSERT ON public.assignment_users
  FOR EACH ROW EXECUTE FUNCTION notify_assignment_users();

-- B. Submission Received (Insert)
CREATE OR REPLACE FUNCTION notify_submission_received() RETURNS TRIGGER AS $$
DECLARE
  v_assignment_title TEXT;
  v_admin_id UUID;
  v_user_name TEXT;
BEGIN
  SELECT title, created_by INTO v_assignment_title, v_admin_id FROM public.assignments WHERE id = NEW.assignment_id;
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, assignment_id, submission_id)
  VALUES (
    v_admin_id,
    'submission_received',
    'New Submission',
    COALESCE(v_user_name, 'A user') || ' submitted V' || NEW.version_number || ' of ' || v_assignment_title || '.',
    NEW.assignment_id,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_submission_insert ON public.submissions;
CREATE TRIGGER trigger_notify_submission_insert
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION notify_submission_received();

-- C. Submission Status Updated (Revision/Approved)
CREATE OR REPLACE FUNCTION notify_submission_status_change() RETURNS TRIGGER AS $$
DECLARE
  v_assignment_title TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  
  SELECT title INTO v_assignment_title FROM public.assignments WHERE id = NEW.assignment_id;

  IF NEW.status = 'revision_required' THEN
    INSERT INTO public.notifications (user_id, type, title, message, assignment_id, submission_id)
    VALUES (
      NEW.user_id,
      'revision_required',
      'Revision Required',
      'Revision requested for ' || v_assignment_title || '.',
      NEW.assignment_id,
      NEW.id
    );
  ELSIF NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, message, assignment_id, submission_id)
    VALUES (
      NEW.user_id,
      'submission_approved',
      'Submission Approved',
      'Your submission V' || NEW.version_number || ' for ' || v_assignment_title || ' has been approved.',
      NEW.assignment_id,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_submission_update ON public.submissions;
CREATE TRIGGER trigger_notify_submission_update
  AFTER UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION notify_submission_status_change();

-- D. Announcement Created
CREATE OR REPLACE FUNCTION notify_announcement() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message)
  SELECT id, 'announcement', NEW.title, NEW.message
  FROM public.profiles
  WHERE is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_announcement_insert ON public.announcements;
CREATE TRIGGER trigger_notify_announcement_insert
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION notify_announcement();

-- ── 10. Trigger Functions for Activity Logs ─────────────────────

CREATE OR REPLACE FUNCTION log_activity(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
EXCEPTION WHEN OTHERS THEN
  -- Swallow exception so logging failure doesn't abort transaction
  RAISE WARNING 'Failed to insert activity log: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assignments
CREATE OR REPLACE FUNCTION log_assignment_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity('assignment_created', 'assignment', NEW.id, jsonb_build_object('title', NEW.title));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
      PERFORM log_activity('assignment_archived', 'assignment', NEW.id, jsonb_build_object('title', NEW.title));
    ELSE
      PERFORM log_activity('assignment_updated', 'assignment', NEW.id, jsonb_build_object('title', NEW.title));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_assignment ON public.assignments;
CREATE TRIGGER trigger_log_assignment
  AFTER INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION log_assignment_event();

-- Submissions
CREATE OR REPLACE FUNCTION log_submission_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version_number > 1 THEN
      PERFORM log_activity('submission_resubmitted', 'submission', NEW.id, jsonb_build_object('assignment_id', NEW.assignment_id, 'version', NEW.version_number));
    ELSE
      PERFORM log_activity('submission_created', 'submission', NEW.id, jsonb_build_object('assignment_id', NEW.assignment_id, 'version', NEW.version_number));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'revision_required' AND OLD.status != 'revision_required' THEN
      PERFORM log_activity('revision_requested', 'submission', NEW.id, jsonb_build_object('assignment_id', NEW.assignment_id, 'version', NEW.version_number));
    ELSIF NEW.status = 'approved' AND OLD.status != 'approved' THEN
      PERFORM log_activity('submission_approved', 'submission', NEW.id, jsonb_build_object('assignment_id', NEW.assignment_id, 'version', NEW.version_number));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_submission ON public.submissions;
CREATE TRIGGER trigger_log_submission
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION log_submission_event();

-- Announcements
CREATE OR REPLACE FUNCTION log_announcement_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity('announcement_created', 'announcement', NEW.id, jsonb_build_object('title', NEW.title));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_active = false AND OLD.is_active = true THEN
      PERFORM log_activity('announcement_archived', 'announcement', NEW.id, jsonb_build_object('title', NEW.title));
    ELSE
      PERFORM log_activity('announcement_updated', 'announcement', NEW.id, jsonb_build_object('title', NEW.title));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_announcement ON public.announcements;
CREATE TRIGGER trigger_log_announcement
  AFTER INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION log_announcement_event();
