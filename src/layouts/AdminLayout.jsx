import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, LogOut, Menu, X, Megaphone, Activity } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.jpg";
import NotificationBell from "@/components/NotificationBell";

const NAV_ITEMS = [
  { to: "/admin",       label: "Dashboard",       icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/assignments", label: "Assignments", icon: LayoutDashboard },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/activity", label: "Activity Log", icon: Activity },
];

/**
 * Shared layout for all admin pages.
 * Provides: top bar + side navigation + main content area.
 */
export default function AdminLayout({ children }) {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <SidebarContent
          profile={profile}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:hidden",
          mobileOpen ? "flex translate-x-0" : "flex -translate-x-full"
        )}
      >
        <SidebarContent
          profile={profile}
          user={user}
          onLogout={handleLogout}
          onClose={() => setMobileOpen(false)}
        />
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar (mobile only) */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-gray-900">Connect Commons</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  );
}

function SidebarContent({ profile, user, onLogout, onClose }) {
  return (
    <div className="flex h-full flex-col">

      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-sm font-bold text-gray-900">Connect Commons</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 pb-4">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Menu
        </p>
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User card + logout */}
      <div className="border-t border-gray-100 px-3 py-4">
        <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white flex-shrink-0">
              {(profile?.full_name || user?.email || "A")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {profile?.full_name || "Admin"}
              </p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="hidden lg:block shrink-0">
            <NotificationBell align="left" direction="up" />
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-red-50 hover:text-red-600 focus:outline-none"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

    </div>
  );
}
