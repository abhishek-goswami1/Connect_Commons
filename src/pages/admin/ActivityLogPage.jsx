import { useState, useEffect } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Loader2, Activity, Filter, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function ActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [filterAction, filterEntity, searchQuery]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("activity_logs")
      .select("*, profiles:actor_id(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filterAction !== "all") query = query.eq("action", filterAction);
    if (filterEntity !== "all") query = query.eq("entity_type", filterEntity);
    
    // Simplistic search (client side filtering would be better for complex JSON, but let's do a basic text search if needed)
    // For MVP, we'll fetch then filter by search query on the client side since metadata is JSONB and search might be complex.

    const { data, error } = await query;
    if (!error && data) {
      let filtered = data;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = data.filter(log => 
          log.profiles?.full_name?.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q)
        );
      }
      setLogs(filtered);
    }
    setLoading(false);
  };

  const formatAction = (action) => {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getMetadataDetails = (log) => {
    if (!log.metadata) return null;
    if (log.entity_type === 'assignment' || log.entity_type === 'announcement') {
      return log.metadata.title;
    }
    if (log.entity_type === 'submission') {
      return `V${log.metadata.version} (Assignment ID: ${log.metadata.assignment_id.slice(0,8)}...)`;
    }
    return JSON.stringify(log.metadata);
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Activity & Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">Chronological history of important system events.</p>
        </div>

        <Card className="mb-6 border-gray-200 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search actor or action..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-4">
              <div className="w-[180px]">
                <Select value={filterEntity} onValueChange={setFilterEntity}>
                  <SelectTrigger><SelectValue placeholder="All Entities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    <SelectItem value="assignment">Assignments</SelectItem>
                    <SelectItem value="submission">Submissions</SelectItem>
                    <SelectItem value="announcement">Announcements</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[200px]">
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="assignment_created">Assignment Created</SelectItem>
                    <SelectItem value="submission_created">Submission Created</SelectItem>
                    <SelectItem value="revision_requested">Revision Requested</SelectItem>
                    <SelectItem value="submission_approved">Submission Approved</SelectItem>
                    <SelectItem value="announcement_created">Announcement Created</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
             <div className="flex justify-center py-20 text-gray-400">
               <Loader2 className="h-8 w-8 animate-spin" />
             </div>
          ) : logs.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-gray-400">
               <Activity className="h-10 w-10 mb-3 opacity-20" />
               <p className="text-sm">No activity logs found for the current filters.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase text-gray-500">Date / Time</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase text-gray-500">Actor</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase text-gray-500">Entity</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase text-gray-500">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {log.profiles?.full_name || 'System / Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                        {log.entity_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                        {getMetadataDetails(log)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
