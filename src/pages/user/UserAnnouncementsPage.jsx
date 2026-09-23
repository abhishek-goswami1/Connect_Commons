import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Megaphone, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.jpg";

export default function UserAnnouncementsPage() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    // User can only select active announcements due to RLS
    const { data, error } = await supabase
      .from("announcements")
      .select("*, profiles:created_by(full_name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAnnouncements(data);
    }
    setLoading(false);
  };

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/user")}>
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-gray-900">Connect Commons</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:block">
              {profile?.full_name || user?.email}
            </span>
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-blue-600" /> Announcements
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Important updates and news from the administration.
            </p>
          </div>
          <Link to="/user">
            <Button variant="outline" size="sm">Back to Dashboard</Button>
          </Link>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500 bg-white">
              <Bell className="mx-auto h-10 w-10 mb-3 text-gray-400 opacity-50" />
              <p>No active announcements right now.</p>
            </div>
          ) : (
            announcements.map((a) => (
              <Card key={a.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex">
                  <div className="w-1.5 shrink-0 bg-blue-500" />
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{a.title}</h3>
                        <p className="mt-1 text-xs font-medium text-blue-600 uppercase tracking-wider">
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {a.message}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
