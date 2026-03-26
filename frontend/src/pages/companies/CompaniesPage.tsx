import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Search, Plus, Columns, SortAsc, SortDesc, Filter,
  Building2, ChevronRight, Download,
} from "lucide-react";
import { useCompanies, type Company, type DealStage, type CompanyFilters } from "@/hooks/useCRM";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STAGE_COLORS: Record<string, string> = {
  prospect:  "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  nda:       "bg-amber-100 text-amber-700",
  loi:       "bg-purple-100 text-purple-700",
  dd:        "bg-orange-100 text-orange-700",
  closed:    "bg-emerald-100 text-emerald-700",
  passed:    "bg-red-100 text-red-700",
};

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect", contacted: "Contacted", nda: "NDA",
  loi: "LOI", dd: "Due Diligence", closed: "Closed", passed: "Passed",
};

function fmt(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function scoreRing(score?: number | null): string {
  if (!score) return "text-slate-400";
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

type SortKey = "name" | "annual_revenue" | "asking_price" | "deal_score" | "updated_at";

export default function CompaniesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<DealStage | "">("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filters: CompanyFilters = {
    search: search || undefined,
    deal_stage: stageFilter || undefined,
    industry: industryFilter || undefined,
    lead_partner: partnerFilter || undefined,
    page,
    limit: 50,
  };

  const { data, isLoading } = useCompanies(filters);
  const companies = data?.items || [];
  const total = data?.total || 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...companies].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey];
    const bv = (b as unknown as Record<string, unknown>)[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortDir === "asc" ? <SortAsc className="h-3 w-3 inline ml-1" /> : <SortDesc className="h-3 w-3 inline ml-1" />;
  }

  function exportCSV() {
    const headers = ["Name","Industry","Revenue","EBITDA","Asking Price","Multiple","Stage","Lead Partner","Score","State","Source"];
    const rows = sorted.map(c => [
      c.name, c.industry || "", fmt(c.annual_revenue), fmt(c.ebitda),
      fmt(c.asking_price), c.implied_multiple ? `${c.implied_multiple}x` : "",
      c.deal_stage, c.lead_partner || "", c.deal_score || "", c.state || "", c.source || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "companies.csv"; a.click();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200 bg-white shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Companies</h1>
          <p className="text-xs text-slate-500">{total} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input className="pl-8 h-8 w-48 text-sm" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="h-8 text-xs border border-slate-200 rounded-md px-2 bg-white" value={stageFilter} onChange={e => setStageFilter(e.target.value as DealStage | "")}>
            <option value="">All stages</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="h-8 text-xs border border-slate-200 rounded-md px-2 bg-white" value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)}>
            <option value="">All partners</option>
            <option value="matt">Matt</option>
            <option value="utsav">Utsav</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => navigate("/pipeline")}><Columns className="h-3.5 w-3.5 mr-1.5" />Kanban</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
          <Button size="sm" onClick={() => navigate("/companies/new")}><Plus className="h-3.5 w-3.5 mr-1.5" />Add</Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => toggleSort("name")}>Company <SortIcon k="name" /></th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Industry</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => toggleSort("annual_revenue")}>Revenue <SortIcon k="annual_revenue" /></th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">EBITDA</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => toggleSort("asking_price")}>Ask Price <SortIcon k="asking_price" /></th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Multiple</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Stage</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Partner</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => toggleSort("deal_score")}>Score <SortIcon k="deal_score" /></th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">State</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={11} className="text-center py-12 text-slate-400">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-slate-400">No companies found</td></tr>
            ) : sorted.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/companies/${c.id}`)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 truncate max-w-[200px]">{c.name}</p>
                      {c.is_proprietary && <span className="text-[10px] text-blue-600 font-medium">Proprietary</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{c.industry || "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(c.annual_revenue)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmt(c.ebitda)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(c.asking_price)}</td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {c.implied_multiple ? `${c.implied_multiple.toFixed(1)}x` : c.asking_price && c.ebitda ? `${(c.asking_price / c.ebitda).toFixed(1)}x` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[c.deal_stage] || "bg-slate-100 text-slate-600"}`}>
                    {STAGE_LABELS[c.deal_stage] || c.deal_stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.lead_partner ? (
                    <span className="text-xs font-medium capitalize text-slate-700">{c.lead_partner}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {c.deal_score != null ? (
                    <span className={`text-sm font-bold ${scoreRing(c.deal_score)}`}>{c.deal_score}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{c.state || "—"}</td>
                <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white shrink-0">
          <p className="text-xs text-slate-500">Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
