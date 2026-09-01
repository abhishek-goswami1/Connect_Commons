import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import InactiveAccountPage from "@/pages/auth/InactiveAccountPage";

/**
 * ProtectedRoute — base guard for any authenticated route.
 * - Not authenticated → /login
 * - Authenticated but inactive → InactiveAccountPage
 * - Authenticated + active → render children
 */
export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Profile still loading (user exists but profile not yet fetched)
  // This can happen briefly on first login.
  if (profile === null) {
    return <LoadingScreen message="Loading your profile…" />;
  }

  // Account deactivated
  if (!profile.is_active) {
    return <InactiveAccountPage />;
  }

  return children;
}

function LoadingScreen({ message = "Loading…" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
