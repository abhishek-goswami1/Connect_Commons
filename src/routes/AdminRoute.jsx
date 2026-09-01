import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import InactiveAccountPage from "@/pages/auth/InactiveAccountPage";

/**
 * AdminRoute — allows access only to active admins.
 *
 * Guards:
 *  1. Not authenticated → /login
 *  2. No profile yet    → loading screen
 *  3. Inactive account  → InactiveAccountPage
 *  4. role !== 'admin'  → /user  (regular users get redirected to their area)
 *  5. Active admin      → render children
 */
export default function AdminRoute({ children }) {
  const { user, profile, loading, role } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile === null) {
    return <LoadingScreen message="Loading your profile…" />;
  }

  if (!profile.is_active) {
    return <InactiveAccountPage />;
  }

  if (role !== "admin") {
    // A regular user trying to access /admin — send to their dashboard
    return <Navigate to="/user" replace />;
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
