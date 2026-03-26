import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface FinancialRow {
  id: number;
  company_id: number;
  period_year: number;
  period_type: string;
  period_quarter: number | null;
  revenue: number | null;
  gross_profit: number | null;
  ebitda: number | null;
  ebit: number | null;
  net_income: number | null;
  total_assets: number | null;
  total_debt: number | null;
  capex: number | null;
  owner_comp: number | null;
  sde: number | null;
  source: string | null;
}

interface KPIs {
  latest_revenue: number | null;
  latest_ebitda: number | null;
  latest_sde: number | null;
  ebitda_margin_pct: number | null;
  gross_margin_pct: number | null;
  revenue_cagr_pct: number | null;
  debt_ebitda: number | null;
  latest_period: string | null;
}

function fmt(v: number | null | undefined, prefix = "$"): string {
  if (v == null) return "\u2014";
  if (Math.abs(v) >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}K`;
  return `${prefix}${v.toFixed(0)}`;
}

function pct(v: number | null | undefined): string {
  if (v == null) return "\u2014";
  return `${v.toFixed(1)}%`;
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function FinancialsPage() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("company_id") ? Number(searchParams.get("company_id")) : null;
  const [selectedCompany, setSelectedCompany] = useState<number | null>(companyId);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: companiesData } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => api.get("/companies/?limit=100").then(r => r.data),
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["financials-summary", selectedCompany],
    queryFn: () =>
      selectedCompany
        ? api.get(`/financials/summary/${selectedCompany}`).then(r => r.data)
        : null,
    enabled: !!selectedCompany,
  });

  const kpis: KPIs = summary?.kpis ?? {};
  const rows: FinancialRow[] = summary?.rows ?? [];

  const chartData = [...rows]
    .filter(r => r.period_type === "annual")
    .sort((a, b) => a.period_year - b.period_year)
    .map(r => ({
      year: String(r.period_year),
      Revenue: r.revenue ? r.revenue / 1_000_000 : null,
      EBITDA: r.ebitda ? r.ebitda / 1_000_000 : null,
      SDE: r.sde ? r.sde / 1_000_000 : null,
    }));

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post(`/financials/import?company_id=${selectedCompany}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (r) => {
      const d = r.data;
      setImportStatus(`Imported: ${d.created} created, ${d.updated} updated`);
      qc.invalidateQueries({ queryKey: ["financials-summary", selectedCompany] });
    },
    onError: (e: any) => setImportStatus(`Error: ${e.response?.data?.detail || e.message}`),
  });

  const aiBuildMutation = useMutation({
    mutationFn: () => api.post(`/financials/ai-build?company_id=${selectedCompany}`),
    onSuccess: (r) => {
      const d = r.data;
      setAiStatus(`AI built: ${d.created} created, ${d.updated} updated from CIM`);
      qc.invalidateQueries({ queryKey: ["financials-summary", selectedCompany] });
    },
    onError: (e: any) => setAiStatus(`Error: ${e.response?.data?.detail || e.message}`),
  });

  const companies = (companiesData?.items ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Models</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historical financials, KPIs, and AI-assisted model building</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Company</label>
        <select
          className="w-full md:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={selectedCompany ?? ""}
          onChange={e => setSelectedCompany(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Choose a company —</option>
          {companies.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {!selectedCompany && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Select a company above to view its financials.</p>
        </div>
      )}

      {selectedCompany && isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Loading financials…</p>
        </div>
      )}

      {selectedCompany && !isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Revenue (Latest)" value={fmt(kpis.latest_revenue)} sub={kpis.latest_period ?? undefined} />
            <KPICard label="EBITDA (Latest)" value={fmt(kpis.latest_ebitda)} sub={kpis.ebitda_margin_pct != null ? `${kpis.ebitda_margin_pct}% margin` : undefined} />
            <KPICard label="SDE (Latest)" value={fmt(kpis.latest_sde)} />
            <KPICard label="Revenue CAGR" value={pct(kpis.revenue_cagr_pct)} sub="Historical" />
          </div>

          {chartData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue vs EBITDA ($M)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}M`} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#3b82f6" />
                    <Bar dataKey="EBITDA" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">SDE Trend ($M)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}M`} />
                    <Legend />
                    <Line type="monotone" dataKey="SDE" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="EBITDA" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Financial Data</h3>
              <div className="flex items-center gap-2">
                <WriteGuard>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={importMutation.isPending}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {importMutation.isPending ? "Importing\u2026" : "Import Excel/CSV"}
                  </button>
                </WriteGuard>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) importMutation.mutate(f);
                    e.target.value = "";
                  }}
                />
                <WriteGuard>
                  <button
                    onClick={() => aiBuildMutation.mutate()}
                    disabled={aiBuildMutation.isPending}
                    className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    {aiBuildMutation.isPending ? "Building\u2026" : "AI Build from CIM"}
                  </button>
                </WriteGuard>
              </div>
            </div>

            {(importStatus || aiStatus) && (
              <div className="px-5 py-2 bg-green-50 text-green-700 text-xs border-b border-green-100">
                {importStatus || aiStatus}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                No financial data yet. Import an Excel/CSV file or use AI Build from CIM.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Period", "Type", "Revenue", "Gross Profit", "EBITDA", "SDE", "Owner Comp", "Total Debt", "Source"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.period_year}{row.period_quarter ? ` Q${row.period_quarter}` : ""}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            row.period_type === "ttm" ? "bg-blue-100 text-blue-700" :
                            row.period_type === "quarterly" ? "bg-purple-100 text-purple-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {row.period_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900">{fmt(row.revenue)}</td>
                        <td className="px-4 py-3 text-gray-600">{fmt(row.gross_profit)}</td>
                        <td className="px-4 py-3 text-emerald-700 font-medium">{fmt(row.ebitda)}</td>
                        <td className="px-4 py-3 text-purple-700 font-medium">{fmt(row.sde)}</td>
                        <td className="px-4 py-3 text-gray-600">{fmt(row.owner_comp)}</td>
                        <td className="px-4 py-3 text-gray-600">{fmt(row.total_debt)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400">{row.source ?? "\u2014"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-sm text-blue-700">
            <strong>Import format:</strong> CSV or Excel with columns: <code className="bg-blue-100 px-1 rounded">period_year, period_type, revenue, gross_profit, ebitda, ebit, net_income, total_assets, total_debt, capex, owner_comp, sde</code>
          </div>
        </>
      )}
    </div>
  );
}
