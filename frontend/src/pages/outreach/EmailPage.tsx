import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface EmailThread {
  id: number;
  company_id: number | null;
  company_name: string | null;
  gmail_thread_id: string | null;
  subject: string;
  from_email: string;
  to_email: string;
  snippet: string | null;
  body: string | null;
  is_read: boolean;
  is_starred: boolean;
  direction: string;
  received_at: string;
  created_at: string;
}

interface Company {
  id: number;
  name: string;
}

export default function EmailPage() {
  const qc = useQueryClient();
  const [selectedEmail, setSelectedEmail] = useState<EmailThread | null>(null);
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "", company_id: "" });
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const { data: emailsData, isLoading } = useQuery({
    queryKey: ["emails", filterCompanyId],
    queryFn: () =>
      api.get(`/emails/?${filterCompanyId ? `company_id=${filterCompanyId}&` : ""}limit=100`).then((r) => r.data),
  });
  const emails: EmailThread[] = emailsData?.items || [];

  const { data: companiesData } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => api.get("/companies/?limit=200").then((r) => r.data),
  });
  const companies: Company[] = companiesData?.items || [];

  const { data: gmailStatus } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => api.get("/gmail/status").then((r) => r.data).catch(() => ({ connected: false })),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/emails/${id}`, { is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });

  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) =>
      api.patch(`/emails/${id}`, { is_starred: starred }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });

  const sendMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/emails/send", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      setShowCompose(false);
      setCompose({ to: "", subject: "", body: "", company_id: "" });
    },
  });

  const handleSync = async () => {
    setSyncStatus("Syncing…");
    try {
      await api.post("/gmail/sync");
      qc.invalidateQueries({ queryKey: ["emails"] });
      setSyncStatus("✓ Synced");
      setTimeout(() => setSyncStatus(null), 3000);
    } catch {
      setSyncStatus("✗ Sync failed — check Gmail connection in Settings");
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const unreadCount = emails.filter((e) => !e.is_read).length;
  const starredCount = emails.filter((e) => e.is_starred).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gmail Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">Deal-related emails synced from Gmail</p>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus && (
            <span className={`text-xs font-medium ${syncStatus.startsWith("✓") ? "text-green-600" : syncStatus.startsWith("✗") ? "text-red-600" : "text-gray-500"}`}>
              {syncStatus}
            </span>
          )}
          <button
            onClick={handleSync}
            className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            🔄 Sync Gmail
          </button>
          <WriteGuard>
            <button
              onClick={() => setShowCompose(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              ✉ Compose
            </button>
          </WriteGuard>
        </div>
      </div>

      {/* Gmail Connection Banner */}
      {gmailStatus && !gmailStatus.connected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-semibold text-yellow-800 text-sm">Gmail not connected</div>
            <div className="text-xs text-yellow-700">
              Go to <a href="/settings" className="underline font-medium">Settings → Gmail</a> to connect your Gmail account and start syncing deal emails.
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{emails.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Emails</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{unreadCount}</div>
          <div className="text-xs text-gray-500 mt-1">Unread</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{starredCount}</div>
          <div className="text-xs text-gray-500 mt-1">Starred</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">
            {emails.filter((e) => e.direction === "outbound").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Sent</div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <select
          value={filterCompanyId}
          onChange={(e) => setFilterCompanyId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full md:w-80"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Email List + Detail */}
      <div className="flex gap-4">
        {/* Email List */}
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${selectedEmail ? "w-1/2" : "w-full"}`}>
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Loading emails…</div>
          ) : emails.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📧</div>
              <h3 className="text-lg font-semibold text-gray-700">No emails yet</h3>
              <p className="text-sm text-gray-500 mt-1">
                {gmailStatus?.connected
                  ? "Click \"Sync Gmail\" to pull your deal-related emails"
                  : "Connect Gmail in Settings to start syncing emails"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => {
                    setSelectedEmail(email);
                    if (!email.is_read) markReadMutation.mutate(email.id);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedEmail?.id === email.id ? "bg-blue-50" : ""} ${!email.is_read ? "border-l-4 border-blue-400" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm font-medium truncate ${!email.is_read ? "text-gray-900" : "text-gray-600"}`}>
                          {email.direction === "outbound" ? `To: ${email.to_email}` : email.from_email}
                        </span>
                        {email.direction === "outbound" && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs shrink-0">Sent</span>
                        )}
                        {email.is_starred && <span className="text-yellow-500 shrink-0">★</span>}
                      </div>
                      <div className={`text-sm truncate ${!email.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {email.subject}
                      </div>
                      {email.snippet && (
                        <div className="text-xs text-gray-400 truncate mt-0.5">{email.snippet}</div>
                      )}
                      {email.company_name && (
                        <div className="text-xs text-green-700 mt-0.5">🏢 {email.company_name}</div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Detail */}
        {selectedEmail && (
          <div className="w-1/2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">{selectedEmail.subject}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => starMutation.mutate({ id: selectedEmail.id, starred: !selectedEmail.is_starred })}
                  className={`text-lg ${selectedEmail.is_starred ? "text-yellow-500" : "text-gray-300 hover:text-yellow-500"}`}
                >
                  ★
                </button>
                <button onClick={() => setSelectedEmail(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1 mb-4 p-3 bg-gray-50 rounded">
              <div><strong>From:</strong> {selectedEmail.from_email}</div>
              <div><strong>To:</strong> {selectedEmail.to_email}</div>
              {selectedEmail.company_name && <div><strong>Company:</strong> {selectedEmail.company_name}</div>}
              <div><strong>Date:</strong> {new Date(selectedEmail.received_at).toLocaleString()}</div>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {selectedEmail.body || selectedEmail.snippet || "(No body)"}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <WriteGuard>
                <button
                  onClick={() => {
                    setCompose({ to: selectedEmail.from_email, subject: `Re: ${selectedEmail.subject}`, body: "", company_id: String(selectedEmail.company_id || "") });
                    setShowCompose(true);
                  }}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                >
                  Reply
                </button>
              </WriteGuard>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Compose Email</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">To *</label>
                <input type="email" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Subject *</label>
                <input type="text" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Link to Company</label>
                <select value={compose.company_id} onChange={(e) => setCompose({ ...compose, company_id: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm">
                  <option value="">— Optional —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Body *</label>
                <textarea rows={8} value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none font-mono" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => sendMutation.mutate({ to_email: compose.to, subject: compose.subject, body: compose.body, company_id: compose.company_id ? Number(compose.company_id) : null })}
                disabled={!compose.to || !compose.subject || !compose.body || sendMutation.isPending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {sendMutation.isPending ? "Sending…" : "Send Email"}
              </button>
              <button onClick={() => setShowCompose(false)} className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
