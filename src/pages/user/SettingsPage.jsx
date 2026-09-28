import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, CheckCircle2, XCircle, LogOut } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import logo from "@/assets/logo.jpg";

export default function SettingsPage() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (password.length < 6) {
      setFeedback({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ type: "error", message: "Passwords do not match." });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({ type: "success", message: "Password updated successfully!" });
      setPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-blue-600" /> Account Settings
          </h1>
          <Link to="/user">
            <Button variant="outline" size="sm">Back to Dashboard</Button>
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
          
          {feedback && (
            <div className={`mb-4 flex items-center gap-3 rounded-lg p-3 text-sm ${feedback.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm">
            <div>
              <Label htmlFor="new-pwd">New Password</Label>
              <Input 
                id="new-pwd" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm-pwd">Confirm New Password</Label>
              <Input 
                id="confirm-pwd" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" 
                className="mt-1"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Updating...</> : "Update Password"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
