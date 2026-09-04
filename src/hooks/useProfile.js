import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Fetches the profile row for a given user ID.
 * Returns { profile, loading, error }.
 */
export function useProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null); // eslint-disable-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, created_at")
        .eq("id", userId)
        .single();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
      setLoading(false);
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [userId]);

  return { profile, loading, error };
}
