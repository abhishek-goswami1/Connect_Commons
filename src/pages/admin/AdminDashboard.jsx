import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/layouts/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { 
  Users, ClipboardList, LayoutDashboard, AlertCircle, 
  Clock, FileText, CheckCircle, ChevronRight, Loader2
} from "lucide-react";
import { formatDate } from "@/lib/assignmentHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeUsers: 0,
    activeAssignments: 0,
    totalSubmissions: 0,
    pendingReview: 0,
  });
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [activeAssignmentsList, setActiveAssignmentsList] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      
      const [
        { count: usersCount },
        { count: assignmentsCount },
        { count: submissionsCount },
        { count: pendingCount }
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("assignments").select("*", { count: "exact", head: true }).is("archived_at", null),
        supabase.from("submissions").select("*", { count: "exact", head: true }),
        supabase.from("submissions").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review"])
      ]);

      setStats({
        activeUsers: usersCount || 0,
        activeAssignments: assignmentsCount || 0,
        totalSubmissions: submissionsCount || 0,
        pendingReview: pendingCount || 0,
      });

      const { data: recentSubs } = await supabase
        .from("submissions")
        .select(`
          id, version_number, status, submitted_at, assignment_id,
          assignments ( title ),
          profiles!submissions_user_id_fkey ( full_name )
        `)
        .order("submitted_at", { ascending: false })
        .limit(5);
        
      setRecentSubmissions(recentSubs || []);

      const { data: activeAsgns } = await supabase
        .from("assignments")
        .select(`
          id, title, status, deadline, priority,
          assignment_users ( user_id ),
          submissions ( id )
        `)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      setActiveAssignmentsList(activeAsgns || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const STATUS_BADGE = {
    submitted: <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">New</Badge>,
    under_review: <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">Review</Badge>,
    revision_required: <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">Revision</Badge>,
    approved: <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Approved</Badge>,
  };

  return (
    <AdminLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening in Connect Commons today.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label="Active Users" value={stats.activeUsers} color="blue" />
              <StatCard icon={ClipboardList} label="Active Assignments" value={stats.activeAssignments} color="purple" />
              <StatCard icon={FileText} label="Total Submissions" value={stats.totalSubmissions} color="green" />
              <StatCard icon={AlertCircle} label="Pending Review" value={stats.pendingReview} color="orange" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Submissions */}
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" /> Recent Submissions
                  </h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {recentSubmissions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No recent submissions</div>
                  ) : (
                    recentSubmissions.map(sub => (
                      <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-medium text-sm text-gray-900 line-clamp-1">{sub.assignments?.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{sub.profiles?.full_name}</span>
                            <span>•</span>
                            <span>V{sub.version_number}</span>
                            <span>•</span>
                            <span>{formatDate(sub.submitted_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {STATUS_BADGE[sub.status]}
                          <Link to={`/admin/assignments/${sub.assignment_id}`}>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Active Assignments Overview */}
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-purple-500" /> Active Assignments
                  </h2>
                  <Link to="/admin/assignments" className="text-sm text-blue-600 hover:underline">View All</Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {activeAssignmentsList.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No active assignments</div>
                  ) : (
                    activeAssignmentsList.map(a => {
                      const assignedCount = a.assignment_users?.length || 0;
                      // Submissions might have multiple versions per user, but we can just show total submission records
                      const subCount = a.submissions?.length || 0;
                      return (
                        <div key={a.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <div>
                            <p className="font-medium text-sm text-gray-900 line-clamp-1">{a.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {assignedCount} Users</span>
                              <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> {subCount} Subs</span>
                            </div>
                          </div>
                          <Link to={`/admin/assignments/${a.id}`}>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-purple-600">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    blue:   "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    green:  "bg-green-50 text-green-600 border-green-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
