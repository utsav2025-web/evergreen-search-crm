import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

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

interface Company {
  id: number;
  name: string;
}

const OUTCOME_COLORS: Record<string, string> = {
  positive: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-600",
  negative: "bg-red-100 text-red-700",
  no_answer: "bg-yellow-100 text-yellow-700",
  voicemail: "bg-blue-100 text-blue-700",
  scheduled: "bg-purple-100 text-purple-700",
};

const CALL_TYPE_ICONS: Record<string, string> = {
  intro: "👋",
  follow_up: "🔄",
  discovery: "🔍",
  loi_discussion: "📝",
  due_diligence: "🔬",
  closing: "🤝",
};

export default function CallsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [form, setForm] = useState({
    company_id: "",
    contact_name: "",
    call_type: "intro",
    scheduled_at: "",
    duration_minutes: "",
    outcome: "positive",
    notes: "",
    next_steps: "",
  });

  const { data: callsData, isLoading } = useQuery({
    queryKey: ["calls", filterCompanyId],
    queryFn: () =>
      api.get(`/calls/?${filterCompanyId ? `company_id=${filterCompanyId}&` : ""}limit=100`).then((r) => r.data),
  });
  const calls: Call[] = callsData?.items || [];

  const { data: companiesData } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => api.get("/companies/?limit=200").then((r) => r.data),
  });
  const companies: Company[] = companiesData?.items || [];

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post("/calls/", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calls"] });
      setShowModal(false);
      setForm({ company_id: "", contact_name: "", call_type: "intro", scheduled_at: "", duration_minutes: "", outcome: "positive", notes: "", next_steps: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/calls/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calls"] }),
  });

  const handleCreate = () => {
    if (!form.company_id) return;
    createMutation.mutate({
      company_id: Number(form.company_id),
      contact_name: form.contact_name || null,
      call_type: form.call_type,
      scheduled_at: form.scheduled_at || null,
      completed_at: form.outcome !== "scheduled" ? new Date().toISOString() : null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      outcome: form.outcome,
      notes: form.notes || null,
      next_steps: form.next_steps || null,
    });
  };

  const stats = {
    total: calls.length,
    completed: calls.filter((c) => c.completed_at).length,
    scheduled: calls.filter((c) => c.scheduled_at && !c.completed_at).length,
    positive: calls.filter((c) => c.outcome === "positive").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call Log</h1>
          <p className="text-sm text-gray-500 mt-1">Owner calls, discovery sessions, and follow-up scheduling</p>
        </div>
        <WriteGuard>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Log Call
          </button>
        </WriteGuard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Calls", value: stats.total, color: "text-gray-900" },
          { label: "Completed", value: stats.completed, color: "text-blue-700" },
          { label: "Scheduled", value: stats.scheduled, color: "text-purple-700" },
          { label: "Positive", value: stats.positive, color: "text-green-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
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

      {/* Call List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading calls…</div>
        ) : calls.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📞</div>
            <h3 className="text-lg font-semibold text-gray-700">No calls logged yet</h3>
            <p className="text-sm text-gray-500 mt-1">Log owner calls to track your conversations and next steps</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {calls.map((call) => (
              <div key={call.id} className="p-5 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{CALL_TYPE_ICONS[call.call_type] || "📞"}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {call.company_name || `Company #${call.company_id}`}
                        </span>
                        {call.contact_name && (
                          <span className="text-sm text-gray-500">— {call.contact_name}</span>
                        )}
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs capitalize">
                          {call.call_type.replace("_", " ")}
                        </span>
                        {call.outcome && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${OUTCOME_COLORS[call.outcome] || "bg-gray-100 text-gray-600"}`}>
                            {call.outcome.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 space-y-0.5 mb-2">
                        {call.scheduled_at && (
                          <div>📅 {format(new Date(call.scheduled_at), "MMM d, yyyy 'at' h:mm a")}</div>
                        )}
                        {call.completed_at && (
                          <div>✓ Completed {formatDistanceToNow(new Date(call.completed_at), { addSuffix: true })}</div>
                        )}
                        {call.duration_minutes && (
                          <div>⏱ {call.duration_minutes} minutes</div>
                        )}
                      </div>

                      {call.notes && (
                        <p className="text-sm text-gray-600 mb-1">{call.notes}</p>
                      )}
                      {call.next_steps && (
                        <div className="text-xs text-blue-700 font-medium">
                          → Next: {call.next_steps}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                    </span>
                    <WriteGuard>
                      <button
                        onClick={() => { if (confirm("Delete this call log?")) deleteMutation.mutate(call.id); }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </WriteGuard>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Log Call</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Company *</label>
                <select
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                >
                  <option value="">— Select company —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Name</label>
                <input type="text" placeholder="John Smith (owner)" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Call Type</label>
                  <select value={form.call_type} onChange={(e) => setForm({ ...form, call_type: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm">
                    <option value="intro">Intro Call</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="discovery">Discovery</option>
                    <option value="loi_discussion">LOI Discussion</option>
                    <option value="due_diligence">Due Diligence</option>
                    <option value="closing">Closing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Outcome</label>
                  <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm">
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                    <option value="no_answer">No Answer</option>
                    <option value="voicemail">Voicemail</option>
                    <option value="scheduled">Scheduled (future)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date/Time</label>
                  <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Duration (min)</label>
                  <input type="number" placeholder="30" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                <textarea rows={3} placeholder="Key discussion points, owner's motivations, concerns…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Next Steps</label>
                <input type="text" placeholder="Send NDA, schedule site visit, etc." value={form.next_steps} onChange={(e) => setForm({ ...form, next_steps: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={!form.company_id || createMutation.isPending} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {createMutation.isPending ? "Saving…" : "Log Call"}
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
