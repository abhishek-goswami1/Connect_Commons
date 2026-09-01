import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import InactiveAccountPage from "@/pages/auth/InactiveAccountPage";

/**
 * UserRoute — allows access only to active users with role 'user'.
 *
 * Guards:
 *  1. loading          → loading screen
 *  2. not authenticated → /login
 *  3. no profile yet   → loading screen
 *  4. inactive account → InactiveAccountPage
 *  5. role === 'admin' → /admin  (admins belong in their own area)
 *  6. role === 'user'  → render children
 */
export default function UserRoute({ children }) {
  const { user, profile, role, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  if (profile === null) return <LoadingScreen message="Loading your profile…" />;

  if (!profile.is_active) return <InactiveAccountPage />;

  if (role === "admin") {
    // Admins should not be in the user area
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function LoadingScreen({ message = "Checking permissions…" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
