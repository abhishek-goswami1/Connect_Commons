import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription,
  AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Pencil, Archive, Loader2, AlertCircle, Trash2,
  FileText, Users, Download, Calendar, Flag, CheckCircle, Clock, Eye
} from "lucide-react";
import {
  formatDate, formatDeadline, isOverdue,
  PRIORITY_VARIANT, PRIORITY_LABEL,
  STATUS_VARIANT, STATUS_LABEL,
  formatFileSize,
} from "@/lib/assignmentHelpers";

export default function AdminAssignmentDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user: authUser } = useAuth();

  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving]     = useState(false);
  const [archiveError, setArchiveError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [downloadingId, setDownloadingId] = useState(null);
  
  // Feedback state
  const [feedbackMap, setFeedbackMap] = useState({}); // mapped by user_id
  const [templateMap, setTemplateMap] = useState({});
  const [submittingFeedbackId, setSubmittingFeedbackId] = useState(null);

  const FEEDBACK_TEMPLATES = [
    { label: "Urgent Revision", text: "Please redo and send us as fast as possible under 1 hour." },
    { label: "Review Corrections", text: "Please review the corrections and resubmit the updated files." },
    { label: "Make Required Changes", text: "Please make the required corrections and submit the revised version." },
    { label: "Approved", text: "Your submission has been reviewed and approved." },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: assignmentData, error: err } = await supabase
        .from("assignments")
        .select(`
          id, title, description, instructions, deadline,
          priority, status, created_at, updated_at, archived_at,
          created_by,
          assignment_users (
            user_id,
            profiles ( id, full_name, email )
          ),
          assignment_files (
            id, file_name, file_path, file_size, file_type, created_at
          )
        `)
        .eq("id", id)
        .single();

      if (err || !assignmentData) throw new Error("Assignment not found.");
      
      setAssignment(assignmentData);

      const { data: submissionsData, error: subErr } = await supabase
        .from("submissions")
        .select(`
          id, user_id, version_number, status, submitted_at,
          submission_files ( id, file_name, file_path, file_size ),
          submission_feedback ( id, feedback, created_at ),
          submission_languages ( language )
        `)
        .eq("assignment_id", id)
        .order("version_number", { ascending: false });

      if (subErr) throw new Error("Could not load submissions.");
      
      submissionsData.forEach(sub => {
        if (sub.submission_feedback) {
          sub.submission_feedback.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
      });
      setSubmissions(submissionsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleArchive() {
    setArchiving(true);
    setArchiveError("");
    const { error: err } = await supabase
      .from("assignments")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    setArchiving(false);
    if (err) {
      setArchiveError(err.message);
    } else {
      setArchiveOpen(false);
      navigate("/admin/assignments", { replace: true });
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    const { error: err } = await supabase
      .from("assignments")
      .delete()
      .eq("id", id);
    setDeleting(false);
    if (err) {
      setDeleteError(err.message);
    } else {
      setDeleteOpen(false);
      navigate("/admin/assignments", { replace: true });
    }
  }

  async function downloadReferenceFile(file) {
    setDownloadingId(file.id);
    const { data, error: dlErr } = await supabase.storage
      .from("assignment-reference-files")
      .createSignedUrl(file.file_path, 60);

    if (dlErr || !data?.signedUrl) {
      alert("Could not generate download link. Please try again.");
    } else {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = file.file_name;
      a.click();
    }
    setDownloadingId(null);
  }

  async function viewReferenceFile(file) {
    const { data, error: dlErr } = await supabase.storage
      .from("assignment-reference-files")
      .createSignedUrl(file.file_path, 60);
    if (dlErr || !data?.signedUrl) {
      alert("Could not generate view link.");
    } else {
      window.open(data.signedUrl, '_blank');
    }
  }

  async function downloadSubmissionFile(file) {
    setDownloadingId(file.id);
    const { data, error: dlErr } = await supabase.storage
      .from("assignment-submissions")
      .createSignedUrl(file.file_path, 60);

    if (dlErr || !data?.signedUrl) {
      alert("Could not generate download link.");
    } else {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = file.file_name;
      a.click();
    }
    setDownloadingId(null);
  }

  async function viewSubmissionFile(file) {
    const { data, error: dlErr } = await supabase.storage
      .from("assignment-submissions")
      .createSignedUrl(file.file_path, 60);
    if (dlErr || !data?.signedUrl) {
      alert("Could not generate view link.");
    } else {
      window.open(data.signedUrl, '_blank');
    }
  }

  async function handleFeedbackSubmit(userId, submissionId, actionType) {
    // actionType: 'revision' or 'approve'
    const fbText = feedbackMap[userId] || "";
    if (actionType === 'revision' && !fbText.trim()) {
      alert("Please provide feedback for the revision request.");
      return;
    }

    setSubmittingFeedbackId(submissionId);
    try {
      if (fbText.trim()) {
        // Insert feedback
        const { error: fbErr } = await supabase
          .from("submission_feedback")
          .insert({
            submission_id: submissionId,
            created_by: authUser.id,
            feedback: fbText.trim()
          });
        if (fbErr) throw new Error("Could not save feedback.");
      }

      // Update submission status
      const newStatus = actionType === 'revision' ? 'revision_required' : 'approved';
      const { error: statusErr } = await supabase
        .from("submissions")
        .update({ status: newStatus })
        .eq("id", submissionId);
      
      if (statusErr) throw new Error("Could not update submission status.");

      // Check if we need to update assignment status
      // If we approve, and all users are approved, maybe assignment becomes approved.
      // But for simplicity, we just set the assignment to newStatus directly if action was taken.
      const { error: assignStatusErr } = await supabase
        .from("assignments")
        .update({ status: newStatus })
        .eq("id", id);
      
      if (assignStatusErr) console.warn("Could not update assignment status");

      setFeedbackMap(prev => ({ ...prev, [userId]: "" }));
      await loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmittingFeedbackId(null);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !assignment) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center gap-3 py-32 text-red-500">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/assignments")}>Back to Assignments</Button>
        </div>
      </AdminLayout>
    );
  }

  const overdue           = isOverdue(assignment);
  const effectiveStatus   = overdue && assignment.status === "in_progress" ? "overdue" : assignment.status;
  const assignedUsers     = assignment.assignment_users?.map((au) => au.profiles) ?? [];
  const refFiles          = assignment.assignment_files ?? [];

  return (
    <AdminLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <button
          onClick={() => navigate("/admin/assignments")}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Assignments
        </button>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant={STATUS_VARIANT[effectiveStatus]}>{STATUS_LABEL[effectiveStatus]}</Badge>
              <Badge variant={PRIORITY_VARIANT[assignment.priority]}>{PRIORITY_LABEL[assignment.priority]}</Badge>
              {assignment.archived_at && <Badge variant="secondary">Archived</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Created {formatDate(assignment.created_at)} · Updated {formatDate(assignment.updated_at)}
            </p>
          </div>

          {!assignment.archived_at && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link to={`/admin/assignments/${id}/edit`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => setArchiveOpen(true)}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {assignment.description && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Description</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.description}</p>
              </section>
            )}

            {assignment.instructions && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Instructions</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.instructions}</p>
              </section>
            )}

            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4" /> Reference Files ({refFiles.length})
              </h2>
              {refFiles.length === 0 ? (
                <p className="text-sm text-gray-400">No reference files attached.</p>
              ) : (
                <ul className="space-y-2">
                  {refFiles.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-700">{f.file_name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(f.file_size)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => viewReferenceFile(f)} className="text-blue-600 hover:text-blue-700 bg-white">
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadReferenceFile(f)} disabled={downloadingId === f.id} className="text-blue-600 hover:text-blue-700 bg-white">
                          {downloadingId === f.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Download
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Submissions Section */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">Submissions / Review</h2>
              
              {assignedUsers.length === 0 && (
                <p className="text-sm text-gray-400">No users assigned.</p>
              )}

              <div className="space-y-6">
                {assignedUsers.map(u => {
                  const userSubmissions = submissions.filter(s => s.user_id === u.id);
                  const currentSubmission = userSubmissions.length > 0 ? userSubmissions[0] : null;
                  const hasSubmissions = userSubmissions.length > 0;
                  const isApproved = currentSubmission?.status === "approved";
                  const isRevReq = currentSubmission?.status === "revision_required";

                  return (
                    <div key={u.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* User Header */}
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            {(u?.full_name || u?.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u?.full_name || u?.email}</p>
                          </div>
                        </div>
                        {hasSubmissions ? (
                          isApproved ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">FINAL APPROVED</Badge>
                          ) : isRevReq ? (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200">Revision Req.</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Under Review</Badge>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded-md border border-gray-200">Not Submitted</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4 bg-white">
                        {hasSubmissions && (
                          <div className="space-y-6">
                            
                            {/* Current Actionable Submission */}
                            {!isApproved && currentSubmission && (
                              <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                                <div className="flex justify-between items-center mb-2">
                                  <h3 className="font-semibold text-gray-900">Current Version: V{currentSubmission.version_number}</h3>
                                  {currentSubmission.submission_languages?.[0] && (
                                    <span className="text-xs font-medium text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                      Language: {currentSubmission.submission_languages[0].language}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                  {currentSubmission.submission_files?.map(f => (
                                    <div key={f.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200">
                                      <span className="text-sm text-gray-700">{f.file_name}</span>
                                      <div className="flex gap-1">
                                        <Button variant="outline" size="sm" onClick={() => viewSubmissionFile(f)} className="text-blue-600 hover:text-blue-700 bg-white">
                                          View
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => downloadSubmissionFile(f)} className="text-blue-600 hover:text-blue-700 bg-white">
                                          Download
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {currentSubmission.status === "revision_required" && (
                                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-800 mb-4">
                                    A revision has been requested. Waiting for user to submit a new version.
                                  </div>
                                )}

                                {currentSubmission.status !== "revision_required" && (
                                  <div className="space-y-3 bg-white p-3 rounded-lg border border-gray-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <select 
                                        className="text-xs border-gray-300 rounded-md py-1 px-2 flex-1 max-w-[200px]"
                                        value={templateMap[u.id] || ""}
                                        onChange={(e) => {
                                          const t = e.target.value;
                                          setTemplateMap(prev => ({ ...prev, [u.id]: t }));
                                          if (t) {
                                            setFeedbackMap(prev => ({ ...prev, [u.id]: t }));
                                          }
                                        }}
                                      >
                                        <option value="">-- Choose Template --</option>
                                        {FEEDBACK_TEMPLATES.map((t, idx) => (
                                          <option key={idx} value={t.text}>{t.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <Textarea 
                                      placeholder="Leave feedback here (required for revision)..." 
                                      className="w-full text-sm resize-y" 
                                      rows={2}
                                      value={feedbackMap[u.id] || ""}
                                      onChange={(e) => setFeedbackMap(prev => ({...prev, [u.id]: e.target.value}))}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                        onClick={() => handleFeedbackSubmit(u.id, currentSubmission.id, 'revision')}
                                        disabled={submittingFeedbackId === currentSubmission.id}
                                      >
                                        Request Revision
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => handleFeedbackSubmit(u.id, currentSubmission.id, 'approve')}
                                        disabled={submittingFeedbackId === currentSubmission.id}
                                      >
                                        Approve Final
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {isApproved && (
                              <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <CheckCircle className="h-6 w-6 text-green-600" />
                                  <div>
                                    <p className="font-bold text-green-800">Final Version Approved (V{currentSubmission.version_number})</p>
                                    <p className="text-xs text-green-700">All work is complete.</p>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {currentSubmission.submission_files?.map(f => (
                                    <Button key={f.id} variant="outline" size="sm" onClick={() => downloadSubmissionFile(f)} className="bg-white text-green-700 border-green-200">
                                      <Download className="h-3.5 w-3.5 mr-1.5" /> Download Final
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* History List */}
                            {userSubmissions.length > 0 && (
                              <div className="mt-6">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Submission History</h4>
                                <div className="space-y-4">
                                  {userSubmissions.map(sub => {
                                    const isSubFinal = sub.status === "approved";
                                    return (
                                      <div key={sub.id} className="text-sm bg-gray-50 rounded-lg p-3 border border-gray-200">
                                        <div className="flex justify-between items-center mb-2">
                                          <div>
                                            <span className="font-semibold text-gray-800">Version {sub.version_number} {isSubFinal && <span className="text-green-600 ml-1">✓ Final</span>}</span>
                                            {sub.submission_languages?.[0] && (
                                              <span className="ml-2 text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded uppercase">
                                                {sub.submission_languages[0].language}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs text-gray-500">{formatDate(sub.submitted_at)}</span>
                                        </div>
                                        <div className="space-y-1 mb-2">
                                          {sub.submission_files?.map(f => (
                                            <div key={f.id} className="flex justify-between items-center text-xs text-gray-600">
                                              <span>{f.file_name}</span>
                                              <div className="flex gap-2">
                                                <button onClick={() => viewSubmissionFile(f)} className="text-blue-600 hover:text-blue-800 underline text-xs">View</button>
                                                <button onClick={() => downloadSubmissionFile(f)} className="text-blue-600 hover:text-blue-800 underline text-xs">Download</button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {sub.submission_feedback && sub.submission_feedback.length > 0 && (
                                          <div className="pt-2 border-t border-gray-200/50 mt-2">
                                            {sub.submission_feedback.map(fb => (
                                              <p key={fb.id} className="text-xs text-gray-600 italic bg-white p-2 rounded mt-1 border border-gray-100">Feedback: "{fb.feedback}"</p>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Details</h2>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Deadline</p>
                  <p className={`text-sm font-medium ${overdue ? "text-red-600" : "text-gray-800"}`}>
                    {formatDeadline(assignment.deadline)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Flag className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Priority</p>
                  <Badge variant={PRIORITY_VARIANT[assignment.priority]}>
                    {PRIORITY_LABEL[assignment.priority]}
                  </Badge>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Users className="h-4 w-4" /> Assigned To ({assignedUsers.length})
              </h2>
              {assignedUsers.length === 0 ? (
                <p className="text-xs text-gray-400">No users assigned.</p>
              ) : (
                <ul className="space-y-2">
                  {assignedUsers.map((u) => (
                    <li key={u?.id} className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {(u?.full_name || u?.email || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{u?.full_name || "—"}</p>
                        <p className="truncate text-xs text-gray-500">{u?.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the active list. All data, files, and history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError && <p className="text-xs text-red-600 px-1">{archiveError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving} className="bg-orange-600 hover:bg-orange-700 text-white">
              {archiving ? <><Loader2 className="h-4 w-4 animate-spin" /> Archiving…</> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              {submissions.length > 0 ? (
                <span className="text-red-600 font-medium">This assignment contains workflow history (submissions) and cannot be permanently deleted safely. Archive it instead.</span>
              ) : (
                "This action cannot be undone. This will permanently delete the assignment and all associated metadata."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-xs text-red-600 px-1">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting || submissions.length > 0} 
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
