import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, ArrowLeft, Loader2, AlertCircle, FileText, Download, Upload, X, CheckCircle, Clock, RefreshCw, Eye } from "lucide-react";
import {
  formatDate, formatDeadline, isOverdue,
  PRIORITY_VARIANT, PRIORITY_LABEL,
  STATUS_VARIANT, STATUS_LABEL,
  formatFileSize, ALLOWED_EXTENSIONS, validateFile
} from "@/lib/assignmentHelpers";
import logo from "@/assets/logo.jpg";

export default function UserAssignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();

  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [files, setFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("");

  const fetchAssignmentData = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch assignment details
      const { data: assignmentData, error: assignError } = await supabase
        .from("assignments")
        .select(`
          id, title, description, instructions, deadline,
          priority, status, created_at,
          assignment_files ( id, file_name, file_path, file_size, file_type, created_at ),
          assignment_languages ( language )
        `)
        .eq("id", id)
        .single();

      if (assignError) throw new Error("Assignment not found or access denied.");
      setAssignment(assignmentData);

      // 2. Fetch submissions for this user
      const { data: submissionsData, error: subError } = await supabase
        .from("submissions")
        .select(`
          id, version_number, status, submitted_at,
          submission_files ( id, file_name, file_path, file_size ),
          submission_feedback ( id, feedback, created_at )
        `)
        .eq("assignment_id", id)
        .eq("user_id", user.id)
        .order("version_number", { ascending: false });

      if (subError) throw new Error("Failed to fetch submissions.");
      
      // Sort feedback descending within each submission
      submissionsData.forEach(sub => {
        if (sub.submission_feedback) {
          sub.submission_feedback.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
      });
      setSubmissions(submissionsData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignmentData();
  }, [id, user.id]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function downloadReferenceFile(file) {
    setDownloadingId(file.id);
    const { data, error: dlErr } = await supabase.storage
      .from("assignment-reference-files")
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

  function handleFileChange(e) {
    const picked = Array.from(e.target.files);
    const errs = [];
    const valid = [];
    picked.forEach((f) => {
      const err = validateFile(f);
      if (err) errs.push(err);
      else valid.push(f);
    });
    setFileErrors(errs);
    setFiles((prev) => [...prev, ...valid]);
    setSubmitError("");
    e.target.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setSubmitError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    if (files.length === 0) {
      setSubmitError("Please select at least one file to submit.");
      return;
    }

    // DOCX and PDF validation
    const hasDocx = files.some(f => f.name.toLowerCase().endsWith('.docx'));
    const hasPdf = files.some(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!hasDocx) {
      setSubmitError("Please upload the DOCX file.");
      return;
    }
    if (!hasPdf) {
      setSubmitError("Please upload the PDF file.");
      return;
    }

    if (!selectedLanguage) {
      setSubmitError("Please select the language you translated.");
      return;
    }

    setSubmitting(true);
    try {
      // Determine version number
      const nextVersion = submissions.length > 0 ? submissions[0].version_number + 1 : 1;
      
      // Create submission record
      const { data: newSubmission, error: subError } = await supabase
        .from("submissions")
        .insert({
          assignment_id: id,
          user_id: user.id,
          version_number: nextVersion,
          status: "submitted"
        })
        .select()
        .single();

      if (subError) throw new Error("Failed to create submission record.");

      const subId = newSubmission.id;
      
      // Save submission language
      const { error: langErr } = await supabase.from("submission_languages").insert({
        submission_id: subId,
        language: selectedLanguage
      });
      if (langErr) console.warn("Could not save submission language", langErr);

      const fileMetaRows = [];

      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `assignments/${id}/submissions/${user.id}/v${nextVersion}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("assignment-submissions")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload Error:", uploadError.message);
          setSubmitError(prev => prev + `\nWarning: Could not upload "${file.name}".`);
          continue;
        }

        fileMetaRows.push({
          submission_id: subId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          file_type: file.type,
        });
      }

      if (fileMetaRows.length > 0) {
        const { error: metaError } = await supabase
          .from("submission_files")
          .insert(fileMetaRows);
        
        if (metaError) setSubmitError(prev => prev + `\nWarning: File metadata could not be saved.`);
      }

      // Update assignment status
      // We only update if the assignment is still in_progress or revision_required. 
      // If it is somehow 'approved' we probably shouldn't change it, but standard flow means if a user is submitting, it goes to 'under_review'.
      await supabase.from("assignments").update({ status: "under_review" }).eq("id", id);

      setFiles([]);
      await fetchAssignmentData();

    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-red-500">
        <AlertCircle className="h-8 w-8" />
        <p>{error || "Assignment not found."}</p>
        <Button variant="outline" onClick={() => navigate("/user")}>Back to Dashboard</Button>
      </div>
    );
  }

  const overdue = isOverdue(assignment);
  const effectiveStatus = overdue && assignment.status === "in_progress" ? "overdue" : assignment.status;
  const refFiles = assignment.assignment_files || [];
  
  const currentSubmission = submissions.length > 0 ? submissions[0] : null;
  const isApproved = currentSubmission?.status === "approved";
  const isRevisionRequired = currentSubmission?.status === "revision_required";
  const canSubmit = !isApproved;
  const assignmentLanguages = assignment.assignment_languages?.map(l => l.language) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-gray-900">Connect Commons</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:block">{profile?.full_name || user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        <button onClick={() => navigate("/user")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant={STATUS_VARIANT[effectiveStatus]}>{STATUS_LABEL[effectiveStatus]}</Badge>
              <Badge variant={PRIORITY_VARIANT[assignment.priority]}>{PRIORITY_LABEL[assignment.priority]}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="text-sm text-gray-500 mt-1">Deadline: <span className={overdue ? "text-red-600 font-medium" : ""}>{formatDeadline(assignment.deadline)}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Details */}
          <div className="lg:col-span-2 space-y-6">
            {assignment.description && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Description</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.description}</p>
              </section>
            )}
            {assignment.instructions && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">Instructions</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.instructions}</p>
              </section>
            )}
            
            {/* Reference Files */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4" /> Reference Files ({refFiles.length})
              </h2>
              {refFiles.length === 0 ? (
                <p className="text-sm text-gray-400">No reference files attached.</p>
              ) : (
                <ul className="space-y-2">
                  {refFiles.map(f => (
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
          </div>

          {/* Submission and History */}
          <div className="space-y-6">
            
            {/* Submit UI */}
            {canSubmit && (
              <section className={`rounded-xl border ${isRevisionRequired ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-white'} p-6 shadow-sm`}>
                <h2 className={`mb-4 text-base font-semibold ${isRevisionRequired ? 'text-orange-900' : 'text-gray-900'} flex items-center gap-2`}>
                  {isRevisionRequired ? <RefreshCw className="h-5 w-5 text-orange-600" /> : <Upload className="h-5 w-5 text-blue-600" />}
                  {currentSubmission ? "Resubmit Work" : "New Submission"}
                </h2>
                
                {submitError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 whitespace-pre-wrap">
                    <AlertCircle className="h-4 w-4 inline mr-1 -mt-0.5" />{submitError}
                  </div>
                )}
                
                {fileErrors.length > 0 && (
                  <div className="mb-4 space-y-1">
                    {fileErrors.map((e, i) => <p key={i} className="text-xs text-red-600"><AlertCircle className="h-3 w-3 inline mr-1" />{e}</p>)}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {assignmentLanguages.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Language *</label>
                      <select 
                        value={selectedLanguage}
                        onChange={(e) => {
                          setSelectedLanguage(e.target.value);
                          setSubmitError("");
                        }}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={submitting}
                      >
                        <option value="">-- Choose Language --</option>
                        {assignmentLanguages.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors bg-white">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Upload className="h-5 w-5 mb-1" />
                      <span className="font-medium">Click to select files (Both DOCX and PDF required)</span>
                      <span className="text-xs text-gray-400">.docx, .pdf</span>
                      <p className="text-xs text-orange-600 font-medium mt-2 max-w-xs leading-relaxed">
                        Important: Name your files with the PR number and language.<br/>
                        For example: <strong>[PR57 Nepali]</strong>
                      </p>
                    </div>
                    <input type="file" multiple className="hidden" accept=".docx,.pdf" onChange={handleFileChange} disabled={submitting} />
                  </label>

                  {files.length > 0 && (
                    <ul className="space-y-2">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm">
                          <span className="truncate text-gray-700 text-xs">{f.name}</span>
                          <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 p-1" disabled={submitting}><X className="h-3 w-3" /></button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button type="submit" disabled={submitting || files.length === 0} className="w-full">
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</> : (currentSubmission ? "Resubmit" : "Submit Work")}
                  </Button>
                </form>
              </section>
            )}

            {/* Current status if under review */}
            {currentSubmission?.status === "under_review" && (
              <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 shadow-sm flex flex-col items-center text-center">
                <Clock className="h-8 w-8 text-yellow-600 mb-2" />
                <h3 className="font-bold text-yellow-800">Under Review</h3>
                <p className="text-sm text-yellow-700 mt-1">Your submission (V{currentSubmission.version_number}) is currently being reviewed by an admin.</p>
              </section>
            )}
            
            {/* Final Approved Box */}
            {isApproved && (
              <section className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm flex flex-col items-center text-center">
                <CheckCircle className="h-10 w-10 text-green-600 mb-2" />
                <h3 className="font-bold text-green-800 text-lg">FINAL APPROVED</h3>
                <p className="text-sm text-green-700 mt-1">Version {currentSubmission.version_number} was approved.</p>
              </section>
            )}

            {/* Submission History */}
            {submissions.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Submission History</h2>
                <div className="space-y-4">
                  {submissions.map((sub) => {
                    const isFinal = sub.status === "approved";
                    const isRevReq = sub.status === "revision_required";
                    
                    return (
                      <div key={sub.id} className={`p-4 rounded-lg border ${isFinal ? "border-green-200 bg-green-50/50" : isRevReq ? "border-orange-200 bg-orange-50/50" : "border-gray-100 bg-gray-50"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className={`font-bold text-sm ${isFinal ? "text-green-700" : "text-gray-900"}`}>
                            Version {sub.version_number}
                            {isFinal && " ✓ FINAL APPROVED"}
                          </h3>
                          <span className="text-xs text-gray-500">{formatDate(sub.submitted_at)}</span>
                        </div>
                        
                        {sub.status === "revision_required" && (
                          <Badge variant="outline" className="text-orange-600 border-orange-200 mb-2 bg-white">Revision Required</Badge>
                        )}
                        {sub.status === "submitted" && (
                          <Badge variant="outline" className="mb-2 bg-white">Submitted</Badge>
                        )}

                        <div className="space-y-1 mb-3">
                          {sub.submission_files?.map(f => (
                            <div key={f.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-gray-200">
                              <span className="text-xs text-gray-700 truncate mr-2" title={f.file_name}>{f.file_name}</span>
                              <div className="flex gap-2">
                                <button onClick={() => viewSubmissionFile(f)} className="text-blue-600 hover:text-blue-800 underline text-xs" title="View">
                                  View
                                </button>
                                <button onClick={() => downloadSubmissionFile(f)} className="text-blue-600 hover:text-blue-800 underline text-xs" title="Download">
                                  Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {sub.submission_feedback && sub.submission_feedback.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200/60">
                            <h4 className="text-xs font-semibold text-gray-700 mb-1">Feedback:</h4>
                            <div className="space-y-2">
                              {sub.submission_feedback.map(fb => (
                                <p key={fb.id} className="text-sm text-gray-800 italic bg-white p-2 rounded border border-gray-100">
                                  "{fb.feedback}"
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
