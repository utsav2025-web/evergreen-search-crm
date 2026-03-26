import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  mention: "💬",
  stage_change: "🔄",
  new_listing: "📋",
  email: "✉️",
  follow_up: "⏰",
  vote: "⭐",
  system: "🔔",
};

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/activity/notifications?limit=20").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/activity/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/activity/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.link_url) {
      navigate(n.link_url);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      !n.is_read ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">
                        {TYPE_ICONS[n.type] ?? "🔔"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.is_read ? "font-medium text-gray-900" : "text-gray-700"}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-2">
              <button
                onClick={() => { navigate("/activity"); setOpen(false); }}
                className="text-xs text-blue-600 hover:underline"
              >
                View all activity →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
