import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface Deal {
  id: number;
  company_id: number;
  company_name?: string;
  deal_stage: string;
  asking_price: number | null;
  offer_price: number | null;
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  sde_ttm: number | null;
  ev_ebitda_multiple: number | null;
  ev_sde_multiple: number | null;
  deal_score: number | null;
  sba_eligible: boolean;
  down_payment_pct: number | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  nda: "bg-yellow-100 text-yellow-700",
  loi: "bg-orange-100 text-orange-700",
  due_diligence: "bg-purple-100 text-purple-700",
  closed: "bg-green-100 text-green-700",
  passed: "bg-red-100 text-red-700",
};

const STAGES = ["prospect", "contacted", "nda", "loi", "due_diligence", "closed", "passed"];

const fmt = (n: number | null, prefix = "$") => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toFixed(0)}`;
};

const fmtX = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}x`);

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Deal>>({});

  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: () => api.get(`/deals/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Partial<Deal>) => api.patch(`/deals/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", id] });
      setEditMode(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/deals/${id}`),
    onSuccess: () => navigate("/deals"),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        Loading deal…
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-3">❌</div>
        <h3 className="text-lg font-semibold text-gray-700">Deal not found</h3>
        <button onClick={() => navigate("/deals")} className="mt-3 text-sm text-blue-600 hover:underline">
          ← Back to Deals
        </button>
      </div>
    );
  }

  const handleEdit = () => {
    setForm({
      deal_stage: deal.deal_stage,
      asking_price: deal.asking_price,
      offer_price: deal.offer_price,
      revenue_ttm: deal.revenue_ttm,
      ebitda_ttm: deal.ebitda_ttm,
      sde_ttm: deal.sde_ttm,
      down_payment_pct: deal.down_payment_pct,
      assigned_to: deal.assigned_to,
      notes: deal.notes,
      sba_eligible: deal.sba_eligible,
    });
    setEditMode(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {deal.company_name || `Deal #${deal.id}`}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STAGE_COLORS[deal.deal_stage] || "bg-gray-100 text-gray-700"}`}>
                {deal.deal_stage?.replace("_", " ")}
              </span>
              {deal.deal_score != null && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${deal.deal_score >= 80 ? "bg-green-100 text-green-700" : deal.deal_score >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                  Score: {deal.deal_score}/100
                </span>
              )}
              {deal.sba_eligible && (
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  SBA Eligible
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WriteGuard>
            {!editMode ? (
              <>
                <button onClick={handleEdit} className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm("Delete this deal?")) deleteMutation.mutate(); }}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditMode(false)} className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </>
            )}
          </WriteGuard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Financials */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Deal Financials</h2>
          {editMode ? (
            <div className="space-y-3">
              {[
                { key: "asking_price", label: "Asking Price" },
                { key: "offer_price", label: "Offer Price" },
                { key: "revenue_ttm", label: "Revenue (TTM)" },
                { key: "ebitda_ttm", label: "EBITDA (TTM)" },
                { key: "sde_ttm", label: "SDE (TTM)" },
                { key: "down_payment_pct", label: "Down Payment %" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs text-gray-500 w-32 shrink-0">{label}</label>
                  <input
                    type="number"
                    value={String(form[key as keyof typeof form] ?? "")}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value ? Number(e.target.value) : null })}
                    className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Asking Price", value: fmt(deal.asking_price) },
                { label: "Offer Price", value: fmt(deal.offer_price) },
                { label: "Revenue (TTM)", value: fmt(deal.revenue_ttm) },
                { label: "EBITDA (TTM)", value: fmt(deal.ebitda_ttm) },
                { label: "SDE (TTM)", value: fmt(deal.sde_ttm) },
                { label: "EV/EBITDA", value: fmtX(deal.ev_ebitda_multiple) },
                { label: "EV/SDE", value: fmtX(deal.ev_sde_multiple) },
                { label: "Down Payment", value: deal.down_payment_pct != null ? `${deal.down_payment_pct}%` : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-gray-400">{label}</div>
                  <div className="text-sm font-semibold text-gray-900">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deal Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Deal Info</h2>
          {editMode ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Stage</label>
                <select
                  value={form.deal_stage || ""}
                  onChange={(e) => setForm({ ...form, deal_stage: e.target.value })}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Assigned To</label>
                <select
                  value={form.assigned_to || ""}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  <option value="matt">Matt</option>
                  <option value="utsav">Utsav</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">SBA Eligible</label>
                <select
                  value={form.sba_eligible ? "yes" : "no"}
                  onChange={(e) => setForm({ ...form, sba_eligible: e.target.value === "yes" })}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                <textarea
                  rows={4}
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Stage</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STAGE_COLORS[deal.deal_stage] || "bg-gray-100 text-gray-700"}`}>
                  {deal.deal_stage?.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Assigned To</span>
                <span className="text-sm font-medium text-gray-900 capitalize">{deal.assigned_to || "Unassigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">SBA Eligible</span>
                <span className={`text-sm font-medium ${deal.sba_eligible ? "text-green-700" : "text-gray-500"}`}>
                  {deal.sba_eligible ? "Yes ✓" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Created</span>
                <span className="text-sm text-gray-600">
                  {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true })}
                </span>
              </div>
              {deal.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-1">Notes</div>
                  <p className="text-sm text-gray-700">{deal.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/companies/${deal.company_id}`)}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"
          >
            🏢 View Company
          </button>
          <button
            onClick={() => navigate(`/financials?company=${deal.company_id}`)}
            className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100"
          >
            📊 View Financials
          </button>
          <button
            onClick={() => navigate(`/documents?company=${deal.company_id}`)}
            className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100"
          >
            📄 Documents & NDAs
          </button>
          <button
            onClick={() => navigate(`/knowledge/loi?company=${deal.company_id}&price=${deal.offer_price || deal.asking_price || ""}`)}
            className="px-4 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100"
          >
            📝 Draft LOI
          </button>
        </div>
      </div>
    </div>
  );
}
