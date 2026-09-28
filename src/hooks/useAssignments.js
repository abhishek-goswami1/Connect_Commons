import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/**
 * useAssignments — fetches assignments for the Admin view.
 * Includes assigned user profiles and file metadata.
 *
 * @param {object} filters — { showArchived, status, priority, search }
 */
export function useAssignments(filters = {}) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("assignments")
      .select(`
        id, title, description, instructions, deadline,
        priority, status, created_by, created_at, updated_at, archived_at,
        assignment_users (
          user_id,
          profiles ( id, full_name, email )
        ),
        assignment_files (
          id, file_name, file_path, file_size, file_type, created_at
        )
      `)
      .order("created_at", { ascending: false });

    // Archive filter
    if (filters.showArchived) {
      query = query.not("archived_at", "is", null);
    } else {
      query = query.is("archived_at", null);
    }

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters.priority && filters.priority !== "all") {
      query = query.eq("priority", filters.priority);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setAssignments([]);
    } else {
      setAssignments(data ?? []);
    }
    setLoading(false);
  }, [filters.showArchived, filters.status, filters.priority]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  return { assignments, loading, error, refetch: fetchAssignments };
}

/**
 * useUserAssignments — fetches assignments for the logged-in User.
 * RLS ensures only their own assignments are returned.
 */
export function useUserAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("assignments")
      .select(`
        id, title, description, deadline, priority, status,
        created_at, archived_at,
        assignment_files (
          id, file_name, file_path, file_size, file_type
        )
      `)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setAssignments([]);
    } else {
      setAssignments(data ?? []);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  return { assignments, loading, error, refetch: fetchAssignments };
}
