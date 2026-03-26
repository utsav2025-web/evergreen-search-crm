import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";
import { Mail, Phone, Activity, MessageSquare, Calendar } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutreachEntry {
  id: number;
  company_id: number;
  company_name: string;
  contact_method: string;
  direction: string;
  notes: string | null;
  outcome: string;
  follow_up_date: string | null;
  sent_by: string | null;
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  sequence_step: number;
  created_at: string;
}

interface OutreachStats {
  total: number;
  pending: number;
  replied: number;
  no_response: number;
  follow_ups_due: number;
  reply_rate_pct: number;
}

interface EmailThread {
  id: number;
  company_id: number | null;
  company_name: string | null;
  subject: string;
  from_email: string;
  to_email: string;
  snippet: string | null;
  body: string | null;
  is_read: boolean;
  direction: string;
  received_at: string;
}

interface Call {
  id: number;
  company_id: number;
  company_name?: string;
  contact_name: string | null;
  call_type: string;
  scheduled_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  outcome: string | null;
  notes: string | null;
  next_steps: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  replied: "bg-green-100 text-green-700",
  no_response: "bg-gray-100 text-gray-600",
  not_interested: "bg-red-100 text-red-700",
  interested: "bg-blue-100 text-blue-700",
  meeting_scheduled: "bg-purple-100 text-purple-700",
  bounced: "bg-orange-100 text-orange-700",
};

const CALL_OUTCOME_COLORS: Record<string, string> = {
  positive: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-600",
  negative: "bg-red-100 text-red-700",
  no_answer: "bg-yellow-100 text-yellow-700",
  voicemail: "bg-blue-100 text-blue-700",
  scheduled: "bg-purple-100 text-purple-700",
};

const METHOD_ICONS: Record<string, string> = {
  email: "📧",
  phone: "📞",
  linkedin: "💼",
  letter: "✉️",
  in_person: "🤝",
  other: "💬",
};

const CALL_TYPE_ICONS: Record<string, string> = {
  intro: "👋",
  follow_up: "🔄",
  discovery: "🔍",
  loi_discussion: "📝",
  due_diligence: "🔬",
  closing: "🤝",
};

const EMPTY_OUTREACH_FORM = {
  company_id: "",
  contact_method: "email",
  direction: "outbound",
  notes: "",
  outcome: "pending",
  subject: "",
  body: "",
  follow_up_date: "",
};

const EMPTY_CALL_FORM = {
  company_id: "",
  contact_name: "",
  call_type: "intro",
  scheduled_at: "",
  duration_minutes: "",
  outcome: "neutral",
  notes: "",
  next_steps: "",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return format(new Date(s), "MMM d, yyyy");
}

// ─── Sub-tab: Activity Log ────────────────────────────────────────────────────

function ActivityLogTab() {
  const [subTab, setSubTab] = useState<"log" | "followups">("log");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_OUTREACH_FORM);
  const [selectedEntry, setSelectedEntry] = useState<OutreachEntry | null>(null);
  const qc = useQueryClient();

  const { data: statsData } = useQuery({
    queryKey: ["outreach-stats"],
    queryFn: () => api.get("/outreach/stats").then(r => r.data),
  });
  const { data: outreachData } = useQuery({
    queryKey: ["outreach-list", outcomeFilter, methodFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (outcomeFilter) params.set("outcome", outcomeFilter);
      if (methodFilter) params.set("contact_method", methodFilter);
      return api.get(`/outreach/?${params}`).then(r => r.data);
    },
  });
  const { data: followUpsData } = useQuery({
    queryKey: ["outreach-followups"],
    queryFn: () => api.get("/outreach/follow-ups").then(r => r.data),
    enabled: subTab === "followups",
  });
  const { data: companiesData } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => api.get("/companies/?limit=200").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/outreach/", {
      ...data,
      company_id: Number(data.company_id),
      follow_up_date: data.follow_up_date || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach-list"] });
      qc.invalidateQueries({ queryKey: ["outreach-stats"] });
      setShowAdd(false);
      setForm(EMPTY_OUTREACH_FORM);
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: string }) =>
      api.post(`/outreach/${id}/complete`, { outcome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach-list"] });
      qc.invalidateQueries({ queryKey: ["outreach-stats"] });
      setSelectedEntry(null);
    },
  });

  const stats: OutreachStats = statsData ?? { total: 0, pending: 0, replied: 0, no_response: 0, follow_ups_due: 0, reply_rate_pct: 0 };
  const entries: OutreachEntry[] = outreachData?.items ?? [];
  const followUps: OutreachEntry[] = followUpsData?.items ?? [];
  const companies: any[] = companiesData?.items ?? [];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Pending", value: stats.pending },
          { label: "Replied", value: stats.replied },
          { label: "No Response", value: stats.no_response },
          { label: "Follow-ups Due", value: stats.follow_ups_due },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Reply Rate */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Reply Rate</span>
            <span className="text-sm font-bold text-gray-900">{stats.reply_rate_pct?.toFixed(1) ?? 0}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, stats.reply_rate_pct ?? 0)}%` }} />
          </div>
        </div>
      )}

      {/* Sub-tabs + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(["log", "followups"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                subTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "log" ? "All Outreach" : `Follow-ups${stats.follow_ups_due > 0 ? ` (${stats.follow_ups_due})` : ""}`}
            </button>
          ))}
        </div>
        <WriteGuard>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            + Log Outreach
          </button>
        </WriteGuard>
      </div>

      {/* Filters */}
      {subTab === "log" && (
        <div className="flex items-center gap-3">
          <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
            <option value="">All Outcomes</option>
            {["pending", "replied", "no_response", "not_interested", "interested", "meeting_scheduled"].map(o => (
              <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
            <option value="">All Methods</option>
            {["email", "phone", "linkedin", "letter", "in_person"].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(subTab === "log" ? entries : followUps).length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {subTab === "log" ? "No outreach logged yet." : "No follow-ups due."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(subTab === "log" ? entries : followUps).map(entry => (
              <div
                key={entry.id}
                className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{METHOD_ICONS[entry.contact_method] ?? "💬"}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.company_name}</p>
                      <p className="text-xs text-gray-400">
                        {entry.direction} · Step {entry.sequence_step} · {fmtDate(entry.sent_at || entry.created_at)}
                      </p>
                      {entry.subject && <p className="text-xs text-gray-500 mt-0.5">{entry.subject}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${OUTCOME_COLORS[entry.outcome] ?? "bg-gray-100 text-gray-700"}`}>
                      {entry.outcome.replace(/_/g, " ")}
                    </span>
                    {entry.follow_up_date && (
                      <span className="text-xs text-orange-500">Follow-up: {fmtDate(entry.follow_up_date)}</span>
                    )}
                  </div>
                </div>
                {selectedEntry?.id === entry.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {entry.notes && <p className="text-sm text-gray-600 mb-2">{entry.notes}</p>}
                    {entry.body && (
                      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 mb-3 max-h-32 overflow-y-auto">{entry.body}</div>
                    )}
                    <WriteGuard>
                      <div className="flex items-center gap-2 flex-wrap">
                        {["replied", "interested", "meeting_scheduled", "not_interested", "no_response"].map(outcome => (
                          <button
                            key={outcome}
                            onClick={e => { e.stopPropagation(); completeMutation.mutate({ id: entry.id, outcome }); }}
                            className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            Mark: {outcome.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    </WriteGuard>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Log Outreach</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                  <option value="">Select company…</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contact_method} onChange={e => setForm(f => ({ ...f, contact_method: e.target.value }))}>
                  {["email", "phone", "linkedin", "letter", "in_person", "other"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Outcome</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>
                  {["pending", "replied", "interested", "meeting_scheduled", "not_interested", "no_response", "bounced"].map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject or call topic" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Body</label>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes or email body…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Follow-up Date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowAdd(false); setForm(EMPTY_OUTREACH_FORM); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.company_id || createMutation.isPending}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving…" : "Log Outreach"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Email Threads ───────────────────────────────────────────────────

function EmailTab() {
  const [selected, setSelected] = useState<EmailThread | null>(null);
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const qc = useQueryClient();

  const { data: emailsData, isLoading } = useQuery({
    queryKey: ["emails", filterCompanyId],
    queryFn: () => api.get(`/emails/?${filterCompanyId ? `company_id=${filterCompanyId}&` : ""}limit=100`).then(r => r.data),
  });
  const { data: companiesData } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => api.get("/companies/?limit=200").then(r => r.data),
  });
  const emails: EmailThread[] = emailsData?.items || [];
  const companies: any[] = companiesData?.items || [];

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/emails/${id}/`, { is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={filterCompanyId} onChange={e => setFilterCompanyId(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-sm text-gray-500">{emails.length} thread{emails.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading emails…</div>
        ) : emails.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No email threads yet. Sync Gmail in Settings or use Email Ingestion to forward broker emails.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {emails.map(email => (
              <div key={email.id}>
                <div
                  className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${!email.is_read ? "bg-blue-50/30" : ""}`}
                  onClick={() => {
                    setSelected(selected?.id === email.id ? null : email);
                    if (!email.is_read) markReadMutation.mutate(email.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!email.is_read && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                        <p className={`text-sm truncate ${!email.is_read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>{email.subject}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{email.from_email} → {email.to_email}</p>
                      {email.snippet && <p className="text-xs text-gray-500 mt-1 truncate">{email.snippet}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{fmtDate(email.received_at)}</p>
                      {email.company_name && <p className="text-xs text-brand-600 mt-0.5">{email.company_name}</p>}
                    </div>
                  </div>
                </div>
                {selected?.id === email.id && email.body && (
                  <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto mt-3">{email.body}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-tab: Calls ───────────────────────────────────────────────────────────

function CallsTab() {
  const [showModal, setShowModal] = useState(false);
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [form, setForm] = useState(EMPTY_CALL_FORM);
  const [selected, setSelected] = useState<Call | null>(null);
  const qc = useQueryClient();

  const { data: callsData, isLoading } = useQuery({
    queryKey: ["calls", filterCompanyId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (filterCompanyId) params.set("company_id", filterCompanyId);
      return api.get(`/calls/?${params}`).then(r => r.data);
    },
  });
  const { data: companiesData } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => api.get("/companies/?limit=200").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/calls/", {
      ...data,
      company_id: Number(data.company_id),
      duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : null,
      scheduled_at: data.scheduled_at || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calls"] });
      setShowModal(false);
      setForm(EMPTY_CALL_FORM);
    },
  });

  const calls: Call[] = callsData?.items ?? [];
  const companies: any[] = companiesData?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={filterCompanyId} onChange={e => setFilterCompanyId(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <WriteGuard>
          <button onClick={() => setShowModal(true)} className="text-sm px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
            + Log Call
          </button>
        </WriteGuard>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading calls…</div>
        ) : calls.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No calls logged yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {calls.map(call => (
              <div
                key={call.id}
                className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelected(selected?.id === call.id ? null : call)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CALL_TYPE_ICONS[call.call_type] ?? "📞"}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{call.company_name ?? `Company #${call.company_id}`}</p>
                      <p className="text-xs text-gray-400">
                        {call.call_type.replace(/_/g, " ")}
                        {call.contact_name ? ` · ${call.contact_name}` : ""}
                        {call.duration_minutes ? ` · ${call.duration_minutes} min` : ""}
                        {" · "}{fmtDate(call.completed_at || call.scheduled_at || call.created_at)}
                      </p>
                    </div>
                  </div>
                  {call.outcome && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CALL_OUTCOME_COLORS[call.outcome] ?? "bg-gray-100 text-gray-700"}`}>
                      {call.outcome.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {selected?.id === call.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    {call.notes && <p className="text-sm text-gray-600">{call.notes}</p>}
                    {call.next_steps && <p className="text-xs text-brand-600 font-medium">Next: {call.next_steps}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Log Call</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                  <option value="">Select company…</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Call Type</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.call_type} onChange={e => setForm(f => ({ ...f, call_type: e.target.value }))}>
                  {["intro", "follow_up", "discovery", "loi_discussion", "due_diligence", "closing"].map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contact Name</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Owner name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duration (min)</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Outcome</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>
                  {["positive", "neutral", "negative", "no_answer", "voicemail", "scheduled"].map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Scheduled At</label>
                <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Call notes…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Next Steps</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.next_steps} onChange={e => setForm(f => ({ ...f, next_steps: e.target.value }))} placeholder="Follow-up action…" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setForm(EMPTY_CALL_FORM); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.company_id || createMutation.isPending}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving…" : "Log Call"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Outreach Page ───────────────────────────────────────────────────────

type MainTab = "activity" | "email" | "calls";

const TABS: { id: MainTab; label: string; icon: React.ElementType }[] = [
  { id: "activity", label: "Activity Log", icon: Activity },
  { id: "email",    label: "Email Threads", icon: Mail },
  { id: "calls",    label: "Calls",         icon: Phone },
];

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("activity");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outreach</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track all outreach activity — emails, calls, and follow-ups</p>
      </div>

      {/* Top-level tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit border border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "activity" && <ActivityLogTab />}
      {activeTab === "email"    && <EmailTab />}
      {activeTab === "calls"    && <CallsTab />}
    </div>
  );
}
