// AuthProvider (component) and useAuth (hook) are intentionally co-located.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

/**
 * AuthProvider — manages authentication + profile state.
 *
 * Provides:
 *   user       — Supabase Auth user object (or null)
 *   session    — Supabase session (or null)
 *   profile    — profiles table row (or null)
 *   role       — 'admin' | 'user' | null
 *   isActive   — boolean | null
 *   loading    — true while auth OR profile is being resolved
 *   login()    — sign in with email + password
 *   logout()   — sign out
 *   refreshProfile() — manually re-fetch profile (used after edits)
 */
export function AuthProvider({ children }) {  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);  // true until BOTH auth + profile resolve

  // ── Fetch profile from the database ──────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, created_at")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Profile fetch error:", error.message);
      setProfile(null);
    } else {
      setProfile(data);
    }
  }, []);

  // ── Bootstrap: check for existing session on mount ───────────
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      // Fetch profile for existing session (page refresh case)
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth state changes: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Don't setLoading(true) here to avoid flash on token refresh.
          // fetchProfile is fast; the short gap is acceptable.
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ── login ─────────────────────────────────────────────────────
  async function login(email, password) {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // onAuthStateChange will handle setting user + profile + loading=false
    if (error) setLoading(false);
    return { error };
  }

  // ── logout ────────────────────────────────────────────────────
  async function logout() {
    const { error } = await supabase.auth.signOut();
    // onAuthStateChange fires with null session → clears user + profile
    return { error };
  }

  // ── refreshProfile — call after an admin edits a profile ──────
  async function refreshProfile() {
    if (user?.id) await fetchProfile(user.id);
  }

  // Convenience derivations
  const role     = profile?.role     ?? null;
  const isActive = profile?.is_active ?? null;

  return (
    <AuthContext.Provider value={{
      user, session, profile, role, isActive,
      loading, login, logout, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
