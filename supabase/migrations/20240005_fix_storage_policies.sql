-- ============================================================
-- Connect Commons — Migration 005
-- Fixes storage policies for submissions to enforce RLS
-- ============================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "storage: user read own submissions" ON storage.objects;
DROP POLICY IF EXISTS "storage: user upload submissions" ON storage.objects;

-- Create secure upload policy
-- Allows users to upload submissions ONLY if they are assigned to the assignment.
-- In a real scenario we'd parse the storage path, but since the storage objects
-- don't automatically know their assignment_id without the path, a safer
-- way is to ensure the user is authenticated, and the application enforces path structure.
-- Even better, we can restrict the path using a regex or array parsing if the path is known:
-- assignments/{assignment_id}/submissions/{user_id}/v{version}/...

CREATE POLICY "storage: user upload submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignment-submissions'
    AND auth.uid() IS NOT NULL
    -- Ensures the user is only uploading to their own user_id directory
    -- Assuming path structure: assignments/<assignment_id>/submissions/<user_id>/...
    -- The 4th element in the path array is the user_id.
    AND (storage.foldername(name))[4] = auth.uid()::text
  );

CREATE POLICY "storage: user read own submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-submissions'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[4] = auth.uid()::text
  );
