import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface CompTransaction {
  id: number;
  company_name: string;
  industry: string | null;
  close_year: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  purchase_price: number | null;
  ev_revenue_multiple: number | null;
  ev_ebitda_multiple: number | null;
  ev_sde_multiple: number | null;
  deal_type: string | null;
  buyer_type: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
}

const fmt = (n: number | null, prefix = "$") => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toFixed(0)}`;
};

const fmtX = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}x`);

const INDUSTRIES = [
  "HVAC Services", "Plumbing", "Electrical", "Pest Control", "Landscaping",
  "IT Managed Services", "Auto Repair", "Dental Practice", "Veterinary",
  "Physical Therapy", "Staffing", "Manufacturing", "Distribution",
  "Waste Management", "Janitorial", "Roofing", "Pool Services", "Other"
];

export default function CompTransactionsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState("");
  const [sortBy, setSortBy] = useState("close_year");
  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    close_year: String(new Date().getFullYear()),
    revenue: "",
    ebitda: "",
    sde: "",
    purchase_price: "",
    deal_type: "acquisition",
    buyer_type: "search_fund",
    source: "",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["comp-transactions", filterIndustry],
    queryFn: () =>
      api.get(`/comp-transactions/?${filterIndustry ? `industry=${encodeURIComponent(filterIndustry)}&` : ""}limit=200`).then((r) => r.data),
  });
  const transactions: CompTransaction[] = data?.items || [];

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post("/comp-transactions/", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comp-transactions"] });
      setShowModal(false);
      setForm({ company_name: "", industry: "", close_year: String(new Date().getFullYear()), revenue: "", ebitda: "", sde: "", purchase_price: "", deal_type: "acquisition", buyer_type: "search_fund", source: "", notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/comp-transactions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-transactions"] }),
  });

  const parseNum = (s: string) => {
    if (!s.trim()) return null;
    const clean = s.replace(/[$,]/g, "");
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  };

  const handleCreate = () => {
    const revenue = parseNum(form.revenue);
    const ebitda = parseNum(form.ebitda);
    const sde = parseNum(form.sde);
    const purchase_price = parseNum(form.purchase_price);
    createMutation.mutate({
      company_name: form.company_name,
      industry: form.industry || null,
      close_year: form.close_year ? Number(form.close_year) : null,
      revenue,
      ebitda,
      sde,
      purchase_price,
      ev_ebitda_multiple: ebitda && purchase_price ? Number((purchase_price / ebitda).toFixed(2)) : null,
      ev_sde_multiple: sde && purchase_price ? Number((purchase_price / sde).toFixed(2)) : null,
      ev_revenue_multiple: revenue && purchase_price ? Number((purchase_price / revenue).toFixed(2)) : null,
      deal_type: form.deal_type || null,
      buyer_type: form.buyer_type || null,
      source: form.source || null,
      notes: form.notes || null,
    });
  };

  // Sort transactions
  const sorted = [...transactions].sort((a, b) => {
    if (sortBy === "close_year") return (b.close_year || 0) - (a.close_year || 0);
    if (sortBy === "ev_ebitda") return (b.ev_ebitda_multiple || 0) - (a.ev_ebitda_multiple || 0);
    if (sortBy === "purchase_price") return (b.purchase_price || 0) - (a.purchase_price || 0);
    return 0;
  });

  // Stats
  const withEbitda = transactions.filter((t) => t.ev_ebitda_multiple != null);
  const avgEbitda = withEbitda.length
    ? withEbitda.reduce((s, t) => s + (t.ev_ebitda_multiple || 0), 0) / withEbitda.length
    : null;
  const withSde = transactions.filter((t) => t.ev_sde_multiple != null);
  const avgSde = withSde.length
    ? withSde.reduce((s, t) => s + (t.ev_sde_multiple || 0), 0) / withSde.length
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comparable Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Deal comps database for valuation benchmarking</p>
        </div>
        <WriteGuard>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Add Comp
          </button>
        </WriteGuard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{transactions.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Comps</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{avgEbitda != null ? `${avgEbitda.toFixed(1)}x` : "—"}</div>
          <div className="text-xs text-gray-500 mt-1">Avg EV/EBITDA</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{avgSde != null ? `${avgSde.toFixed(1)}x` : "—"}</div>
          <div className="text-xs text-gray-500 mt-1">Avg EV/SDE</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{new Set(transactions.map((t) => t.industry).filter(Boolean)).size}</div>
          <div className="text-xs text-gray-500 mt-1">Industries</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Industries</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="close_year">Sort: Newest</option>
          <option value="ev_ebitda">Sort: EV/EBITDA</option>
          <option value="purchase_price">Sort: Price</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading comps…</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-gray-700">No comparable transactions yet</h3>
            <p className="text-sm text-gray-500 mt-1">Add deal comps to benchmark your valuations</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Company", "Industry", "Year", "Revenue", "EBITDA", "SDE", "Price", "EV/EBITDA", "EV/SDE", "Buyer", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{t.company_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.industry || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{t.close_year || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(t.revenue)}</td>
                    <td className="px-4 py-3 text-green-700">{fmt(t.ebitda)}</td>
                    <td className="px-4 py-3 text-purple-700">{fmt(t.sde)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmt(t.purchase_price)}</td>
                    <td className="px-4 py-3">
                      {t.ev_ebitda_multiple != null ? (
                        <span className={`font-semibold ${t.ev_ebitda_multiple >= 6 ? "text-orange-600" : "text-blue-700"}`}>
                          {fmtX(t.ev_ebitda_multiple)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.ev_sde_multiple != null ? (
                        <span className="font-semibold text-purple-700">{fmtX(t.ev_sde_multiple)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{(t.buyer_type || "").replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <WriteGuard>
                        <button
                          onClick={() => { if (confirm("Delete this comp?")) deleteMutation.mutate(t.id); }}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Delete
                        </button>
                      </WriteGuard>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Comparable Transaction</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Company Name *</label>
                  <input
                    type="text"
                    placeholder="Acme HVAC Services"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Industry</label>
                  <select
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  >
                    <option value="">— Select —</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Close Year</label>
                  <input
                    type="number"
                    value={form.close_year}
                    onChange={(e) => setForm({ ...form, close_year: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  />
                </div>
                {[
                  { key: "revenue", label: "Revenue" },
                  { key: "ebitda", label: "EBITDA" },
                  { key: "sde", label: "SDE" },
                  { key: "purchase_price", label: "Purchase Price" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                    <input
                      type="text"
                      placeholder="e.g. 2500000"
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Deal Type</label>
                  <select
                    value={form.deal_type}
                    onChange={(e) => setForm({ ...form, deal_type: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  >
                    <option value="acquisition">Acquisition</option>
                    <option value="merger">Merger</option>
                    <option value="recapitalization">Recapitalization</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Buyer Type</label>
                  <select
                    value={form.buyer_type}
                    onChange={(e) => setForm({ ...form, buyer_type: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  >
                    <option value="search_fund">Search Fund</option>
                    <option value="pe">Private Equity</option>
                    <option value="strategic">Strategic</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Source</label>
                  <input
                    type="text"
                    placeholder="IESE, Axial, broker, etc."
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreate}
                disabled={!form.company_name || createMutation.isPending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving…" : "Add Comp"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
