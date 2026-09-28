import { useState, useRef, useEffect } from "react";
import { Bell, Check, Circle, Loader2, Megaphone, FileText, ClipboardList } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const NOTIFICATION_ICONS = {
  assignment_created: ClipboardList,
  assignment_assigned: ClipboardList,
  submission_received: FileText,
  revision_required: FileText,
  submission_approved: Check,
  announcement: Megaphone,
};

export default function NotificationBell({ align = "right", direction = "down" }) {
  const { profile } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getNotificationLink = (notification) => {
    const rolePrefix = profile?.role === "admin" ? "/admin" : "/user";
    if (notification.type === "announcement") {
      return `${rolePrefix}/announcements`;
    }
    if (notification.assignment_id) {
      return `${rolePrefix}/assignments/${notification.assignment_id}`;
    }
    return "#";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-full focus:outline-none transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className={cn(
            "absolute w-80 sm:w-96 rounded-xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden",
            align === "right" ? "right-0" : "left-0",
            direction === "down" ? "mt-2 top-full" : "mb-2 bottom-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center px-4">
                <Bell className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">You have no notifications right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                  return (
                    <Link
                      key={notification.id}
                      to={getNotificationLink(notification)}
                      onClick={() => {
                        if (!notification.is_read) markAsRead(notification.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex items-start gap-3 p-4 transition-colors hover:bg-gray-50",
                        !notification.is_read ? "bg-blue-50/40" : ""
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          !notification.is_read ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          !notification.is_read ? "text-gray-900" : "text-gray-600"
                        )}>
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="mt-1.5 text-[11px] font-medium text-gray-400">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <Circle className="h-2 w-2 shrink-0 fill-blue-600 text-blue-600 mt-1" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-100 p-2 text-center bg-gray-50/50">
             <span className="text-xs text-gray-400">Showing up to 50 recent notifications</span>
          </div>
        </div>
      )}
    </div>
  );
}
