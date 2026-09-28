import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, ClipboardList, Loader2, AlertCircle, Eye, Settings } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useUserAssignments } from "@/hooks/useAssignments";
import { formatDate, formatDeadline, isOverdue, PRIORITY_VARIANT, PRIORITY_LABEL, STATUS_VARIANT, STATUS_LABEL } from "@/lib/assignmentHelpers";
import logo from "@/assets/logo.jpg";

export default function UserDashboard() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const { assignments, loading, error } = useUserAssignments();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-gray-900">Connect Commons</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:block">
              {profile?.full_name || user?.email}
            </span>
            <NotificationBell />
            <Link to="/user/settings">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-gray-900">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your assignments and work submissions are listed below.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading your assignments…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm">{error}</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <ClipboardList className="h-8 w-8" />
              <p className="text-sm">You have no active assignments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Deadline</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.map((a) => {
                    const overdue = isOverdue(a);
                    const effectiveStatus = overdue && a.status === "in_progress" ? "overdue" : a.status;

                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 max-w-[200px]">
                          <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                          {a.description && (
                            <p className="truncate text-xs text-gray-400 mt-0.5">{a.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={PRIORITY_VARIANT[a.priority]}>
                            {PRIORITY_LABEL[a.priority]}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                          <span className={overdue ? "text-red-600 font-medium" : ""}>
                            {formatDeadline(a.deadline)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={STATUS_VARIANT[effectiveStatus]}>
                            {STATUS_LABEL[effectiveStatus]}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Link to={`/user/assignments/${a.id}`}>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Eye className="h-4 w-4" /> View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
