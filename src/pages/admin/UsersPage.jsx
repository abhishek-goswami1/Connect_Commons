import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { supabase } from "@/lib/supabase";
import AdminLayout from "@/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Search,
  Pencil,
  UserCheck,
  UserX,
  Loader2,
  Users,
  AlertCircle,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name, email) {
  const src = name || email || "?";
  return src
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser, session } = useAuth();
  const { users, loading, error, refetch } = useUsers();

  const [search, setSearch] = useState("");

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Which user is being acted on
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // 'activate' | 'deactivate'

  // Feedback
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  // ── Toggle active / inactive ─────────────────────────────────────────────
  function openConfirm(userRow, action) {
    setSelectedUser(userRow);
    setConfirmAction(action);
    setActionError("");
    setActionSuccess("");
    setConfirmOpen(true);
  }

  async function handleToggleActive() {
    setActionError("");
    const newStatus = confirmAction === "activate";

    // Self-deactivation guard
    if (!newStatus && selectedUser.id === currentUser?.id) {
      setActionError("You cannot deactivate your own account.");
      setConfirmOpen(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", selectedUser.id);

    if (updateError) {
      setActionError(updateError.message);
    } else {
      setActionSuccess(
        `${selectedUser.full_name} has been ${newStatus ? "activated" : "deactivated"}.`
      );
      refetch();
    }
    setConfirmOpen(false);
  }

  // ── Edit user ─────────────────────────────────────────────────────────────
  function openEdit(userRow) {
    setSelectedUser(userRow);
    setActionError("");
    setActionSuccess("");
    setEditOpen(true);
  }

  // ── Clear feedback on new action ─────────────────────────────────────────
  function clearFeedback() {
    setActionError("");
    setActionSuccess("");
  }

  return (
    <AdminLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">

        {/* ── Page header ── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage accounts, roles, and access for all users.
            </p>
          </div>
          <Button
            onClick={() => { clearFeedback(); setAddOpen(true); }}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* ── Global feedback ── */}
        {actionSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <UserCheck className="h-4 w-4 shrink-0" />
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        {/* ── Search ── */}
        <div className="mb-4 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* ── Table card ── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading users…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <Users className="h-8 w-8" />
              <p className="text-sm">
                {search ? "No users match your search." : "No users yet. Add the first one."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {["User", "Role", "Status", "Joined", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            {getInitials(u.full_name, u.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {u.full_name || "—"}
                              {u.id === currentUser?.id && (
                                <span className="ml-2 text-xs text-blue-500 font-normal">(you)</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <Badge variant={u.is_active ? "success" : "danger"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {formatDate(u.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                            title="Edit user"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {u.is_active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConfirm(u, "deactivate")}
                              title="Deactivate user"
                              disabled={u.id === currentUser?.id}
                              className="text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConfirm(u, "activate")}
                              title="Activate user"
                              className="text-green-600 hover:bg-green-50 hover:text-green-700"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Summary ── */}
        {!loading && !error && (
          <p className="mt-3 text-xs text-gray-400">
            Showing {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
        )}

      </div>

      {/* ── Add User Dialog ── */}
      <AddUserDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        session={session}
        onSuccess={(msg) => { setActionSuccess(msg); refetch(); }}
      />

      {/* ── Edit User Dialog ── */}
      <EditUserDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        userRow={selectedUser}
        currentUserId={currentUser?.id}
        onSuccess={(msg) => { setActionSuccess(msg); refetch(); }}
      />

      {/* ── Confirm activate/deactivate ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "deactivate" ? "Deactivate user?" : "Activate user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "deactivate"
                ? `${selectedUser?.full_name} will lose access to Connect Commons immediately. Their data is preserved.`
                : `${selectedUser?.full_name} will regain access to Connect Commons.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              className={
                confirmAction === "deactivate"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }
            >
              {confirmAction === "deactivate" ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

// ── Add User Dialog ────────────────────────────────────────────────────────

function AddUserDialog({ open, onClose, session, onSuccess }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("user");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  function reset() {
    setFullName(""); setEmail(""); setPassword("");
    setRole("user"); setLocalError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");

    // Client-side validation
    if (!fullName.trim()) { setLocalError("Full name is required."); return; }
    if (!email.trim())    { setLocalError("Email is required."); return; }
    if (!password)        { setLocalError("Password is required."); return; }
    if (password.length < 8) { setLocalError("Password must be at least 8 characters."); return; }

    setSubmitting(true);
    try {
      let resultData = null;
      let resultError = null;

      try {
        // Attempt 1: Try edge function
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            full_name: fullName.trim(),
            email: email.trim(),
            password,
            role,
          },
        });
        resultData = data;
        resultError = error;
      } catch (err) {
        resultError = err;
      }

      // If Edge Function fails (e.g. CORS/Network error because it's not deployed)
      if (
        resultError && 
        (resultError.name === 'FunctionsFetchError' || resultError.name === 'FunctionsHttpError' || resultError.message?.includes('Failed to fetch') || resultError.message?.includes('Failed to send a request'))
      ) {
        console.warn("Edge function failed (likely CORS/Not Deployed). Falling back to client-side creation...");
        
        const { createClient } = await import('@supabase/supabase-js');

        // Check if the user provided the Service Role Key for local development
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        
        if (serviceRoleKey) {
          console.warn("Using Service Role Key to create user. This is for local development only!");
          const adminClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            serviceRoleKey,
            { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
          );

          const { data: adminData, error: adminError } = await adminClient.auth.admin.createUser({
            email: email.trim(),
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName.trim(),
              role: role,
            }
          });

          if (adminError) {
            resultError = adminError;
          } else {
            resultError = null;
            resultData = { success: true, user: adminData.user };
          }
        } else {
          // Attempt 3: Workaround using an ephemeral client that won't overwrite the admin's session
          // WARNING: This is subject to GoTrue restrictions like "Allowed Domains" or disabled signups
          console.warn("No Service Role Key found. Attempting public signUp method...");
          const tempClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
          );

          const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                role: role,
              }
            }
          });

          if (signUpError) {
            resultError = signUpError;
          } else {
            resultError = null;
            resultData = { success: true, user: signUpData.user };
          }
        }
      }

      if (resultError || !resultData?.success) {
        setLocalError(resultData?.error || resultError?.message || "Failed to create user.");
      } else {
        onSuccess(`User "${fullName.trim()}" created successfully.`);
        handleClose();
      }
    } catch (err) {
      setLocalError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new account. The user can log in immediately with these credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {localError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {localError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="add-name">Full Name</Label>
            <Input
              id="add-name"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-email">Email</Label>
            <Input
              id="add-email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-password">Temporary Password</Label>
            <Input
              id="add-password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={submitting}>
              <SelectTrigger id="add-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
              ) : (
                "Create User"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit User Dialog ───────────────────────────────────────────────────────

function EditUserDialog({ open, onClose, userRow, currentUserId, onSuccess }) {  const [fullName, setFullName] = useState("");
  const [role, setRole]         = useState("user");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  // Populate form whenever the target user or dialog open state changes
  useEffect(() => {
    if (open && userRow) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFullName(userRow.full_name || "");
      setRole(userRow.role || "user");
      setLocalError("");
    }
  }, [open, userRow]);

  function handleClose() {
    setLocalError("");
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");

    if (!fullName.trim()) {
      setLocalError("Full name is required.");
      return;
    }

    // Prevent admin from removing their own admin role
    if (userRow?.id === currentUserId && role !== "admin") {
      setLocalError("You cannot change your own role.");
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), role })
      .eq("id", userRow.id);

    setSubmitting(false);

    if (updateError) {
      setLocalError(updateError.message);
    } else {
      onSuccess(`${fullName.trim()}'s profile updated.`);
      handleClose();
    }
  }

  if (!userRow) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update name and role for <strong>{userRow.full_name || userRow.email}</strong>.
            <br />
            <span className="text-xs text-gray-400">Email changes are managed by Supabase Auth directly.</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {localError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {localError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              value={userRow.email}
              disabled
              className="bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              value={role}
              onValueChange={setRole}
              disabled={submitting || userRow.id === currentUserId}
            >
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {userRow.id === currentUserId && (
              <p className="text-xs text-gray-400">You cannot change your own role.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
