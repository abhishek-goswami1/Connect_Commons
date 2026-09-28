import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Upload, X, Loader2, AlertCircle,
  FileText, Users as UsersIcon,
} from "lucide-react";
import {
  validateFile, formatFileSize, ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/assignmentHelpers";

// ── Zod schema ────────────────────────────────────────────────
const schema = z.object({
  title:        z.string().min(3, "Title must be at least 3 characters."),
  description:  z.string().optional(),
  instructions: z.string().optional(),
  deadline:     z.string().optional(),
  priority:     z.enum(["low", "medium", "high"]),
});

export default function CreateAssignmentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Active users list for assignment
  const [activeUsers, setActiveUsers]   = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);  // array of user IDs
  const [userSearch, setUserSearch]     = useState("");
  const [usersLoading, setUsersLoading] = useState(true);

  // Languages
  const AVAILABLE_LANGUAGES = ["Nepali", "Assamese", "Bengali", "Odia", "Manipuri"];
  const [selectedLanguages, setSelectedLanguages] = useState([]);

  // Source / Reference files
  const [files, setFiles]               = useState([]);  // File objects
  const [fileErrors, setFileErrors]     = useState([]);

  // Submission state
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState("");
  const [userError, setUserError]       = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium" },
  });

  // Fetch active users (role = 'user', is_active = true)
  useEffect(() => {
    async function fetchUsers() {
      setUsersLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "user")
        .eq("is_active", true)
        .order("full_name");
      setActiveUsers(data ?? []);
      setUsersLoading(false);
    }
    fetchUsers();
  }, []);

  function toggleUser(userId) {
    setUserError("");
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
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
    e.target.value = "";  // reset input so same file can be re-added after removal
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────
  async function onSubmit(formData) {
    setSubmitError("");
    setUserError("");

    if (selectedUsers.length === 0) {
      setUserError("Please assign at least one user.");
      return;
    }
    
    if (selectedLanguages.length === 0) {
      setSubmitError("Please select at least one language for this assignment.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create assignment
      const { data: assignment, error: assignError } = await supabase
        .from("assignments")
        .insert({
          title:        formData.title.trim(),
          description:  formData.description?.trim() || null,
          instructions: formData.instructions?.trim() || null,
          deadline:     formData.deadline || null,
          priority:     formData.priority,
          status:       "in_progress",
          created_by:   user.id,
        })
        .select("id")
        .single();

      if (assignError) throw new Error(assignError.message);
      const assignmentId = assignment.id;

      // 2. Insert assignment_users
      const userRows = selectedUsers.map((uid) => ({
        assignment_id: assignmentId,
        user_id: uid,
      }));
      const { error: auError } = await supabase
        .from("assignment_users")
        .insert(userRows);
      if (auError) {
        // Rollback: delete the assignment
        await supabase.from("assignments").delete().eq("id", assignmentId);
        throw new Error(auError.message);
      }

      // 3. Insert assignment_languages
      if (selectedLanguages.length > 0) {
        const langRows = selectedLanguages.map(l => ({
          assignment_id: assignmentId,
          language: l
        }));
        const { error: langError } = await supabase.from("assignment_languages").insert(langRows);
        if (langError) {
           await supabase.from("assignments").delete().eq("id", assignmentId);
           throw new Error("Failed to save assignment languages: " + langError.message);
        }
      }

      // 4. Upload source / reference files
      if (files.length > 0) {
        const fileMetaRows = [];
        for (const file of files) {
          const ext  = file.name.split(".").pop();
          const path = `assignments/${assignmentId}/reference/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("assignment-reference-files")
            .upload(path, file, { upsert: false });

          if (uploadError) {
            // Non-fatal: record failure but continue with other files
            console.error("File upload error:", uploadError.message);
            setSubmitError((prev) =>
              prev + `\nWarning: "${file.name}" could not be uploaded.`
            );
            continue;
          }

          fileMetaRows.push({
            assignment_id: assignmentId,
            file_name:     file.name,
            file_path:     path,
            file_size:     file.size,
            file_type:     file.type,
            uploaded_by:   user.id,
          });
        }

        if (fileMetaRows.length > 0) {
          const { error: metaError } = await supabase
            .from("assignment_files")
            .insert(fileMetaRows);
          if (metaError) {
            setSubmitError((prev) => prev + `\nWarning: File metadata could not be saved.`);
          }
        }
      }

      // Success — navigate to the assignment detail page
      navigate(`/admin/assignments/${assignmentId}`, { replace: true });

    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const filteredUsers = activeUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate("/admin/assignments")}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Assignments
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create Assignment</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fill in the details, select users, and optionally attach reference files.
          </p>
        </div>

        {/* Global error */}
        {submitError && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-line">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* ── Assignment Details ── */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-gray-900">Assignment Details</h2>

            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. Translate PR Document Q3"
                {...register("title")}
                disabled={submitting}
              />
              {errors.title && (
                <p className="text-xs text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief summary of the assignment…"
                rows={3}
                {...register("description")}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Detailed instructions for the assigned users…"
                rows={5}
                {...register("instructions")}
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  {...register("deadline")}
                  disabled={submitting}
                />
                {errors.deadline && (
                  <p className="text-xs text-red-600">{errors.deadline.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority <span className="text-red-500">*</span></Label>
                <Select
                  defaultValue="medium"
                  onValueChange={(v) => setValue("priority", v)}
                  disabled={submitting}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 High</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Assign Languages ── */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Translation Languages <span className="text-red-500">*</span></h2>
              <span className="ml-auto text-xs text-gray-400">
                {selectedLanguages.length} selected
              </span>
            </div>
            
            <div className="flex gap-3 mb-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLanguages([...AVAILABLE_LANGUAGES])}>Select All</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedLanguages([])}>Clear All</Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AVAILABLE_LANGUAGES.map(lang => (
                <label key={lang} className="flex items-center gap-3 rounded-md px-3 py-2 border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <Checkbox 
                    checked={selectedLanguages.includes(lang)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedLanguages(prev => [...prev, lang]);
                      else setSelectedLanguages(prev => prev.filter(l => l !== lang));
                    }}
                    disabled={submitting}
                  />
                  <span className="text-sm font-medium text-gray-800">{lang}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ── Assign Users ── */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Assign Users</h2>
              <span className="ml-auto text-xs text-gray-400">
                {selectedUsers.length} selected
              </span>
            </div>

            {userError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {userError}
              </p>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search users…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                disabled={submitting}
              />
            </div>

            {usersLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No active users found.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-gray-100 p-2">
                {filteredUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                      disabled={submitting}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {u.full_name || "—"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* ── Source / Reference Files ── */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Upload Source / Reference Files</h2>
              <span className="ml-auto text-xs text-gray-400">Optional</span>
            </div>

            <p className="text-xs text-gray-500">
              Provide the source files users will translate. Required formats for final submission are DOCX and PDF, so providing those formats here is highly recommended.
            </p>

            {fileErrors.length > 0 && (
              <div className="space-y-1">
                {fileErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {e}
                  </p>
                ))}
              </div>
            )}

            {/* Uploaded files list */}
            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="truncate text-gray-700">{f.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{formatFileSize(f.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="ml-3 text-gray-400 hover:text-red-500"
                      title="Remove"
                      disabled={submitting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Upload className="h-4 w-4" />
              <span>Click to add files</span>
              <input
                type="file"
                multiple
                className="hidden"
                accept={ALLOWED_EXTENSIONS.join(",")}
                onChange={handleFileChange}
                disabled={submitting}
              />
            </label>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin/assignments")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</>
              ) : (
                "Publish Assignment"
              )}
            </Button>
          </div>

        </form>
      </div>
    </AdminLayout>
  );
}

// Re-export Search icon used inline
function Search({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}
