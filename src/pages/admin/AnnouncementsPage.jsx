import { useState, useEffect } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Megaphone, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow } from "date-fns";

const announcementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(announcementSchema)
  });

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*, profiles:created_by(full_name, email)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAnnouncements(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setFeedback(null);
    
    const { error } = await supabase.from("announcements").insert([{
      title: data.title,
      message: data.message,
      created_by: user.id
    }]);

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({ type: "success", message: "Announcement created and active users notified!" });
      reset();
      setShowForm(false);
      fetchAnnouncements();
    }
    setIsSubmitting(false);
  };

  const toggleStatus = async (id, currentStatus) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !currentStatus })
      .eq("id", id);
    if (!error) fetchAnnouncements();
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (!error) {
      setFeedback({ type: "success", message: "Announcement deleted." });
      fetchAnnouncements();
    } else {
      setFeedback({ type: "error", message: error.message });
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Global Announcements</h1>
            <p className="mt-1 text-sm text-gray-500">Manage announcements broadcasted to all active users.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            {showForm ? "Cancel" : <><Plus className="h-4 w-4" /> New Announcement</>}
          </Button>
        </div>

        {feedback && (
          <div className={`mb-6 flex items-center gap-3 rounded-lg p-4 text-sm ${feedback.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {feedback.message}
          </div>
        )}

        {showForm && (
          <Card className="mb-8 border-blue-100 shadow-md">
            <CardHeader className="bg-blue-50/50 border-b border-blue-50 pb-4">
              <CardTitle className="text-blue-900 text-lg flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Create Announcement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register("title")} className="mt-1.5" placeholder="E.g. System Maintenance This Weekend" />
                  {errors.title && <p className="mt-1.5 text-sm text-red-600">{errors.title.message}</p>}
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" {...register("message")} className="mt-1.5 h-32" placeholder="Write your full announcement here..." />
                  {errors.message && <p className="mt-1.5 text-sm text-red-600">{errors.message.message}</p>}
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Now"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
              <Megaphone className="mx-auto h-10 w-10 mb-3 text-gray-400" />
              <p>No announcements found.</p>
            </div>
          ) : (
            announcements.map((a) => (
              <Card key={a.id} className={`overflow-hidden transition-all ${!a.is_active ? 'opacity-60 bg-gray-50' : 'hover:shadow-md'}`}>
                <div className="flex flex-col sm:flex-row">
                  <div className={`hidden sm:flex w-2 shrink-0 ${a.is_active ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          By {a.profiles?.full_name || a.profiles?.email || 'Admin'} • {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={a.is_active ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => toggleStatus(a.id, a.is_active)}
                          className="shrink-0"
                        >
                          {a.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAnnouncement(a.id)}
                          className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
      </div>
    </AdminLayout>
  );
}
