import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ShieldOff, LogOut } from "lucide-react";

/**
 * Shown when a user's account has is_active = false.
 * They are authenticated but blocked from accessing the application.
 */
export default function InactiveAccountPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="mx-auto max-w-md text-center">

        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
          <ShieldOff className="h-8 w-8 text-red-500" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-gray-900">Account Deactivated</h1>
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">
          Your account has been deactivated. You cannot access Connect Commons at this time.
          <br />
          Please contact your administrator to restore access.
        </p>

        {/* Email */}
        {user?.email && (
          <p className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-xs text-gray-500 font-mono">
            {user.email}
          </p>
        )}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/30"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>

      </div>
    </div>
  );
}
