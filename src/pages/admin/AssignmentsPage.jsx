import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "@/layouts/AdminLayout";
import { useAssignments } from "@/hooks/useAssignments";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription,
  AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, Eye, Pencil, Archive, Loader2,
  ClipboardList, AlertCircle, RotateCcw,
} from "lucide-react";
import {
  formatDate, formatDeadline, isOverdue,
  PRIORITY_VARIANT, PRIORITY_LABEL,
  STATUS_VARIANT, STATUS_LABEL,
} from "@/lib/assignmentHelpers";

export default function AssignmentsPage() {
  const navigate = useNavigate();

  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showArchived, setShowArchived]   = useState(false);

  const { assignments, loading, error, refetch } = useAssignments({
    showArchived,
    status: statusFilter,
    priority: priorityFilter,
  });

  // Archive confirm dialog
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving]         = useState(false);
  const [feedback, setFeedback]           = useState({ type: "", msg: "" });

  // Client-side search filter
  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    const { error: err } = await supabase
      .from("assignments")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", archiveTarget.id);
    setArchiving(false);
    setArchiveTarget(null);
    if (err) {
      setFeedback({ type: "error", msg: err.message });
    } else {
      setFeedback({ type: "success", msg: `"${archiveTarget.title}" has been archived.` });
      refetch();
    }
  }

  return (
    <AdminLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create and manage assignments for your team.
            </p>
          </div>
          <Button onClick={() => navigate("/admin/assignments/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        </div>

        {/* Feedback */}
        {feedback.msg && (
          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}>
            {feedback.type === "error"
              ? <AlertCircle className="h-4 w-4 shrink-0" />
              : <ClipboardList className="h-4 w-4 shrink-0" />}
            {feedback.msg}
            <button className="ml-auto text-xs underline" onClick={() => setFeedback({ type: "", msg: "" })}>
              Dismiss
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="revision_required">Revision Required</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
            className="gap-1.5"
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? "Showing Archived" : "Archived"}
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading assignments…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <ClipboardList className="h-8 w-8" />
              <p className="text-sm">
                {search || statusFilter !== "all" || priorityFilter !== "all"
                  ? "No assignments match your filters."
                  : showArchived
                  ? "No archived assignments."
                  : "No assignments yet. Create the first one."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {["Title", "Assigned To", "Priority", "Deadline", "Status", "Created", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((a) => {
                    const overdue = isOverdue(a);
                    const effectiveStatus = overdue && a.status === "in_progress" ? "overdue" : a.status;
                    const assignedUsers = a.assignment_users?.map((au) => au.profiles) ?? [];

                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        {/* Title */}
                        <td className="px-5 py-4 max-w-[200px]">
                          <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                          {a.description && (
                            <p className="truncate text-xs text-gray-400 mt-0.5">{a.description}</p>
                          )}
                        </td>

                        {/* Assigned users */}
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {assignedUsers.slice(0, 3).map((u) => (
                              <span key={u?.id} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                {u?.full_name || u?.email || "—"}
                              </span>
                            ))}
                            {assignedUsers.length > 3 && (
                              <span className="text-xs text-gray-400">+{assignedUsers.length - 3} more</span>
                            )}
                            {assignedUsers.length === 0 && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="px-5 py-4">
                          <Badge variant={PRIORITY_VARIANT[a.priority]}>
                            {PRIORITY_LABEL[a.priority]}
                          </Badge>
                        </td>

                        {/* Deadline */}
                        <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                          <span className={overdue ? "text-red-600 font-medium" : ""}>
                            {formatDeadline(a.deadline)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <Badge variant={STATUS_VARIANT[effectiveStatus]}>
                            {STATUS_LABEL[effectiveStatus]}
                          </Badge>
                        </td>

                        {/* Created */}
                        <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(a.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Link to={`/admin/assignments/${a.id}`}>
                              <Button variant="ghost" size="sm" title="View">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            {!a.archived_at && (
                              <>
                                <Link to={`/admin/assignments/${a.id}/edit`}>
                                  <Button variant="ghost" size="sm" title="Edit">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Archive"
                                  onClick={() => setArchiveTarget(a)}
                                  className="text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {a.archived_at && (
                              <span className="text-xs text-gray-400 px-2">Archived</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Count */}
        {!loading && !error && (
          <p className="mt-3 text-xs text-gray-400">
            Showing {filtered.length} of {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Archive confirm */}
      <AlertDialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              "{archiveTarget?.title}" will be archived. It will no longer appear in the active list
              but all data, files, and history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {archiving ? <><Loader2 className="h-4 w-4 animate-spin" /> Archiving…</> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
