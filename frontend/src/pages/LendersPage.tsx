import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface Lender {
  id: number;
  name: string;
  bank_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  loan_type: string | null;
  max_loan_amount: number | null;
  min_loan_amount: number | null;
  typical_rate_low: number | null;
  typical_rate_high: number | null;
  typical_term_years: number | null;
  states_active: string[];
  preferred_industries: string[];
  pre_qual_status: string | null;
  pre_qual_amount: number | null;
  pre_qual_date: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-yellow-100 text-yellow-700",
  pre_qualified: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  approved: "bg-blue-100 text-blue-700",
};

const fmt = (n: number | null, prefix = "$") => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
};

export default function LendersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState({
    name: "",
    bank_name: "",
    contact_name: "",
    email: "",
    phone: "",
    loan_type: "sba_7a",
    max_loan_amount: "",
    min_loan_amount: "",
    typical_rate_low: "",
    typical_rate_high: "",
    typical_term_years: "10",
    states_active: "",
    preferred_industries: "",
    pre_qual_status: "not_started",
    pre_qual_amount: "",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["lenders", filterStatus],
    queryFn: () =>
      api.get(`/lenders/?${filterStatus ? `pre_qual_status=${filterStatus}&` : ""}limit=200`).then((r) => r.data),
  });
  const lenders: Lender[] = data?.items || [];

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post("/lenders/", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lenders"] });
      setShowModal(false);
      setForm({ name: "", bank_name: "", contact_name: "", email: "", phone: "", loan_type: "sba_7a", max_loan_amount: "", min_loan_amount: "", typical_rate_low: "", typical_rate_high: "", typical_term_years: "10", states_active: "", preferred_industries: "", pre_qual_status: "not_started", pre_qual_amount: "", notes: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch(`/lenders/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lenders"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/lenders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lenders"] }),
  });

  const parseNum = (s: string) => {
    if (!s.trim()) return null;
    const n = parseFloat(s.replace(/[$,]/g, ""));
    return isNaN(n) ? null : n;
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: form.name,
      bank_name: form.bank_name || null,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      loan_type: form.loan_type || null,
      max_loan_amount: parseNum(form.max_loan_amount),
      min_loan_amount: parseNum(form.min_loan_amount),
      typical_rate_low: parseNum(form.typical_rate_low),
      typical_rate_high: parseNum(form.typical_rate_high),
      typical_term_years: form.typical_term_years ? Number(form.typical_term_years) : null,
      states_active: form.states_active ? form.states_active.split(",").map((s) => s.trim()).filter(Boolean) : [],
      preferred_industries: form.preferred_industries ? form.preferred_industries.split(",").map((s) => s.trim()).filter(Boolean) : [],
      pre_qual_status: form.pre_qual_status || "not_started",
      pre_qual_amount: parseNum(form.pre_qual_amount),
      notes: form.notes || null,
    });
  };

  const filtered = filterStatus ? lenders.filter((l) => l.pre_qual_status === filterStatus) : lenders;

  const preQualCount = lenders.filter((l) => l.pre_qual_status === "pre_qualified" || l.pre_qual_status === "approved").length;
  const totalCapacity = lenders.reduce((s, l) => s + (l.pre_qual_amount || l.max_loan_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SBA & Lender Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">SBA 7(a) lenders, pre-qualification status, and loan terms</p>
        </div>
        <WriteGuard>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Add Lender
          </button>
        </WriteGuard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{lenders.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Lenders</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{preQualCount}</div>
          <div className="text-xs text-gray-500 mt-1">Pre-Qualified</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{fmt(totalCapacity > 0 ? totalCapacity : null)}</div>
          <div className="text-xs text-gray-500 mt-1">Total Capacity</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {lenders.filter((l) => l.loan_type === "sba_7a").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">SBA 7(a) Lenders</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {["", "not_started", "in_progress", "pre_qualified", "approved", "declined"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Lender Cards */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Loading lenders…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🏦</div>
          <h3 className="text-lg font-semibold text-gray-700">No lenders yet</h3>
          <p className="text-sm text-gray-500 mt-1">Add SBA lenders to track pre-qualification and loan terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((lender) => (
            <div key={lender.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{lender.name}</h3>
                    {lender.pre_qual_status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lender.pre_qual_status] || "bg-gray-100 text-gray-600"}`}>
                        {lender.pre_qual_status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {lender.bank_name && <div className="text-sm text-gray-600 mb-2">{lender.bank_name}</div>}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                    {lender.loan_type && (
                      <div><span className="font-medium">Type:</span> {lender.loan_type.replace("_", " ").toUpperCase()}</div>
                    )}
                    {(lender.min_loan_amount || lender.max_loan_amount) && (
                      <div><span className="font-medium">Range:</span> {fmt(lender.min_loan_amount)} – {fmt(lender.max_loan_amount)}</div>
                    )}
                    {(lender.typical_rate_low || lender.typical_rate_high) && (
                      <div><span className="font-medium">Rate:</span> {lender.typical_rate_low != null ? `${lender.typical_rate_low}%` : "—"} – {lender.typical_rate_high != null ? `${lender.typical_rate_high}%` : "—"}</div>
                    )}
                    {lender.typical_term_years && (
                      <div><span className="font-medium">Term:</span> {lender.typical_term_years} years</div>
                    )}
                    {lender.contact_name && (
                      <div><span className="font-medium">Contact:</span> {lender.contact_name}</div>
                    )}
                    {lender.email && (
                      <div><a href={`mailto:${lender.email}`} className="text-blue-600 hover:underline">{lender.email}</a></div>
                    )}
                  </div>

                  {lender.pre_qual_amount && (
                    <div className="text-sm font-semibold text-green-700 mb-2">
                      Pre-qualified: {fmt(lender.pre_qual_amount)}
                    </div>
                  )}

                  {lender.preferred_industries && lender.preferred_industries.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {lender.preferred_industries.map((ind) => (
                        <span key={ind} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{ind}</span>
                      ))}
                    </div>
                  )}

                  {lender.notes && <p className="text-xs text-gray-500 italic">{lender.notes}</p>}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <WriteGuard>
                    <div className="flex flex-col gap-1">
                    {lender.pre_qual_status === "not_started" && (
                      <button
                        onClick={() => updateMutation.mutate({ id: lender.id, body: { pre_qual_status: "in_progress" } })}
                        className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium hover:bg-yellow-200"
                      >
                        Start Pre-Qual
                      </button>
                    )}
                    {lender.pre_qual_status === "in_progress" && (
                      <button
                        onClick={() => updateMutation.mutate({ id: lender.id, body: { pre_qual_status: "pre_qualified", pre_qual_date: new Date().toISOString() } })}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200"
                      >
                        Mark Pre-Qual'd
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm("Delete this lender?")) deleteMutation.mutate(lender.id); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                    </div>
                  </WriteGuard>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Lender</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Name *</label>
                  <input type="text" placeholder="Sarah Johnson" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Bank / Institution</label>
                  <input type="text" placeholder="First National Bank" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Loan Type</label>
                  <select value={form.loan_type} onChange={(e) => setForm({ ...form, loan_type: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm">
                    <option value="sba_7a">SBA 7(a)</option>
                    <option value="sba_504">SBA 504</option>
                    <option value="conventional">Conventional</option>
                    <option value="seller_financing">Seller Financing</option>
                    <option value="mezzanine">Mezzanine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Term (years)</label>
                  <input type="number" value={form.typical_term_years} onChange={(e) => setForm({ ...form, typical_term_years: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Min Loan</label>
                  <input type="text" placeholder="500000" value={form.min_loan_amount} onChange={(e) => setForm({ ...form, min_loan_amount: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Max Loan</label>
                  <input type="text" placeholder="5000000" value={form.max_loan_amount} onChange={(e) => setForm({ ...form, max_loan_amount: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Rate Low (%)</label>
                  <input type="text" placeholder="7.5" value={form.typical_rate_low} onChange={(e) => setForm({ ...form, typical_rate_low: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Rate High (%)</label>
                  <input type="text" placeholder="9.5" value={form.typical_rate_high} onChange={(e) => setForm({ ...form, typical_rate_high: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Pre-Qual Status</label>
                  <select value={form.pre_qual_status} onChange={(e) => setForm({ ...form, pre_qual_status: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm">
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pre_qualified">Pre-Qualified</option>
                    <option value="approved">Approved</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Pre-Qual Amount</label>
                  <input type="text" placeholder="3000000" value={form.pre_qual_amount} onChange={(e) => setForm({ ...form, pre_qual_amount: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Preferred Industries (comma-separated)</label>
                  <input type="text" placeholder="HVAC, Manufacturing, Services" value={form.preferred_industries} onChange={(e) => setForm({ ...form, preferred_industries: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">States Active (comma-separated)</label>
                  <input type="text" placeholder="TX, OK, KS" value={form.states_active} onChange={(e) => setForm({ ...form, states_active: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={!form.name || createMutation.isPending} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {createMutation.isPending ? "Saving…" : "Add Lender"}
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
