import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  ArrowLeft, Loader2, AlertCircle,
  Users as UsersIcon,
} from "lucide-react";

const schema = z.object({
  title:        z.string().min(3, "Title must be at least 3 characters."),
  description:  z.string().optional(),
  instructions: z.string().optional(),
  deadline:     z.string().optional(),
  priority:     z.enum(["low", "medium", "high"]),
});

export default function EditAssignmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pageLoading, setPageLoading]   = useState(true);
  const [pageError, setPageError]       = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const [activeUsers, setActiveUsers]   = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch]     = useState("");
  const [userError, setUserError]       = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { priority: "medium" } });

  // Load assignment + users
  useEffect(() => {
    async function load() {
      setPageLoading(true);

      // Fetch assignment
      const { data: asgn, error: asgnErr } = await supabase
        .from("assignments")
        .select(`
          id, title, description, instructions, deadline, priority, status,
          assignment_users ( user_id )
        `)
        .eq("id", id)
        .single();

      if (asgnErr || !asgn) {
        setPageError("Assignment not found.");
        setPageLoading(false);
        return;
      }

      // Pre-fill form
      reset({
        title:        asgn.title,
        description:  asgn.description || "",
        instructions: asgn.instructions || "",
        deadline:     asgn.deadline ? asgn.deadline.slice(0, 16) : "",
        priority:     asgn.priority,
      });
      setValue("priority", asgn.priority);
      setSelectedUsers(asgn.assignment_users.map((au) => au.user_id));

      // Fetch active users
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "user")
        .eq("is_active", true)
        .order("full_name");

      setActiveUsers(users ?? []);
      setPageLoading(false);
    }
    load();
  }, [id, reset, setValue]);

  function toggleUser(userId) {
    setUserError("");
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId]
    );
  }

  async function onSubmit(formData) {
    setSubmitError("");
    setSubmitSuccess("");
    setUserError("");

    if (selectedUsers.length === 0) {
      setUserError("Please assign at least one user.");
      return;
    }

    setSubmitting(true);

    // 1. Update assignment fields
    const { error: updateErr } = await supabase
      .from("assignments")
      .update({
        title:        formData.title.trim(),
        description:  formData.description?.trim() || null,
        instructions: formData.instructions?.trim() || null,
        deadline:     formData.deadline || null,
        priority:     formData.priority,
      })
      .eq("id", id);

    if (updateErr) {
      setSubmitError(updateErr.message);
      setSubmitting(false);
      return;
    }

    // 2. Replace assignment_users:
    //    delete existing rows, then insert new set
    await supabase.from("assignment_users").delete().eq("assignment_id", id);
    const userRows = selectedUsers.map((uid) => ({
      assignment_id: id,
      user_id: uid,
    }));
    const { error: auErr } = await supabase.from("assignment_users").insert(userRows);

    if (auErr) {
      setSubmitError(auErr.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitSuccess("Assignment updated successfully.");
    setTimeout(() => navigate(`/admin/assignments/${id}`), 1200);
  }

  const filteredUsers = activeUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  if (pageLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (pageError) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center gap-3 py-32 text-red-500">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">{pageError}</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/assignments")}>
            Back
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto">

        <button
          onClick={() => navigate(`/admin/assignments/${id}`)}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Assignment
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Assignment</h1>
          <p className="mt-1 text-sm text-gray-500">Update details and assigned users.</p>
        </div>

        {submitError && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {submitSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* Details */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-gray-900">Assignment Details</h2>

            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
              <Input id="title" {...register("title")} disabled={submitting} />
              {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register("description")} disabled={submitting} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea id="instructions" rows={5} {...register("instructions")} disabled={submitting} />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" type="datetime-local" {...register("deadline")} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Select
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

          {/* Assign users */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Assigned Users</h2>
              <span className="ml-auto text-xs text-gray-400">{selectedUsers.length} selected</span>
            </div>

            {userError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {userError}
              </p>
            )}

            <Input
              placeholder="Search users…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="h-8 text-sm"
              disabled={submitting}
            />

            <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-gray-100 p-2">
              {filteredUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <Checkbox
                    checked={selectedUsers.includes(u.id)}
                    onCheckedChange={() => toggleUser(u.id)}
                    disabled={submitting}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || "—"}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-3 pb-8">
            <Button type="button" variant="outline" onClick={() => navigate(`/admin/assignments/${id}`)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
