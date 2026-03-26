import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  description: string;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-500",
  updated: "bg-blue-500",
  stage_changed: "bg-purple-500",
  note_added: "bg-yellow-500",
  email_linked: "bg-cyan-500",
  enriched: "bg-indigo-500",
  scored: "bg-orange-500",
  document_uploaded: "bg-pink-500",
  outreach_logged: "bg-teal-500",
  voted: "bg-rose-500",
};

const ACTION_ICONS: Record<string, string> = {
  created: "✦",
  updated: "✎",
  stage_changed: "→",
  note_added: "✍",
  email_linked: "✉",
  enriched: "◎",
  scored: "★",
  document_uploaded: "⬆",
  outreach_logged: "☎",
  voted: "♥",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function groupByDate(items: ActivityItem[]) {
  const groups: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const date = new Date(item.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (date.toDateString() === today.toDateString()) label = "Today";
    else if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

export default function ActivityFeedPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: () => api.get("/activity/feed?limit=100").then((r) => r.data),
    refetchInterval: 60_000, // poll every 60s
  });

  const items: ActivityItem[] = data?.items ?? [];
  const groups = groupByDate(items);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">Last 100 actions across the workspace</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          Auto-refreshes every 60s
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No activity yet</p>
          <p className="text-sm mt-1">Actions will appear here as you work</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([dateLabel, groupItems]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {dateLabel}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="space-y-3">
                {groupItems.map((item) => {
                  const color = ACTION_COLORS[item.action_type] ?? "bg-gray-400";
                  const icon = ACTION_ICONS[item.action_type] ?? "•";

                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                        {item.avatar_url ? (
                          <img src={item.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          getInitials(item.display_name)
                        )}
                      </div>

                      {/* Action dot */}
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-xs mt-0.5`}>
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">{item.display_name}</span>{" "}
                          <span className="text-gray-600">{item.description}</span>
                          {item.entity_name && (
                            <>
                              {" "}
                              <button
                                onClick={() => {
                                  if (item.entity_type === "company" && item.entity_id) {
                                    navigate(`/companies/${item.entity_id}`);
                                  }
                                }}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {item.entity_name}
                              </button>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
