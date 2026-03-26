#!/usr/bin/env python3
"""Helper script to write large frontend TSX files that can't be written via heredoc."""
import os

BASE = "/home/ubuntu/searchfund-crm/frontend/src"

# ── PipelinePage ──────────────────────────────────────────────────────────────
PIPELINE = r"""import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext, DragEndEvent, DragOverlay,
  DragStartEvent, PointerSensor, useSensor, useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow, parseISO } from "date-fns";
import { TrendingUp, DollarSign, Clock, Plus, LayoutList, GripVertical } from "lucide-react";
import { useCompanies, useMoveStage, type Company, type DealStage } from "@/hooks/useCRM";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STAGES: { key: DealStage; label: string; color: string; bg: string; border: string }[] = [
  { key: "prospect",  label: "Prospect",      color: "text-slate-700",  bg: "bg-slate-50",   border: "border-slate-200" },
  { key: "contacted", label: "Contacted",     color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200" },
  { key: "nda",       label: "NDA",           color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200" },
  { key: "loi",       label: "LOI",           color: "text-purple-700", bg: "bg-purple-50",  border: "border-purple-200" },
  { key: "dd",        label: "Due Diligence", color: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200" },
  { key: "closed",    label: "Closed",        color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200" },
  { key: "passed",    label: "Passed",        color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200" },
];

const PARTNER_COLORS: Record<string, string> = { matt: "bg-blue-600", utsav: "bg-emerald-600" };

function fmt(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function daysAgo(ts?: string | null): string {
  if (!ts) return "";
  try { return formatDistanceToNow(parseISO(ts), { addSuffix: true }); }
  catch { return ""; }
}

function scoreColor(score?: number | null): string {
  if (!score) return "bg-slate-100 text-slate-500";
  if (score >= 70) return "bg-emerald-100 text-emerald-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

interface DealCardProps { company: Company; isDragging?: boolean; onClick?: () => void; }
function DealCard({ company, isDragging, onClick }: DealCardProps) {
  const multiple = company.implied_multiple
    ? `${company.implied_multiple.toFixed(1)}x`
    : company.asking_price && company.ebitda
      ? `${(company.asking_price / company.ebitda).toFixed(1)}x`
      : null;
  return (
    <div onClick={onClick} className={`bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md transition-all select-none ${isDragging ? "opacity-50 shadow-xl rotate-1" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{company.name}</p>
        {company.deal_score != null && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${scoreColor(company.deal_score)}`}>{company.deal_score}</span>
        )}
      </div>
      {company.industry && <p className="text-xs text-slate-500 mb-2 truncate">{company.industry}</p>}
      <div className="grid grid-cols-2 gap-1 mb-2">
        <div className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-slate-400" /><span className="text-xs text-slate-600">{fmt(company.annual_revenue)}</span></div>
        <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-slate-400" /><span className="text-xs text-slate-600">{fmt(company.asking_price)}{multiple ? ` · ${multiple}` : ""}</span></div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {company.lead_partner && (
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${PARTNER_COLORS[company.lead_partner] || "bg-slate-400"}`}>
              {company.lead_partner.charAt(0).toUpperCase()}
            </div>
          )}
          {company.is_proprietary && <Badge variant="info" className="text-[9px] px-1 py-0">Prop</Badge>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400"><Clock className="h-3 w-3" />{daysAgo(company.updated_at)}</div>
      </div>
    </div>
  );
}

function SortableDealCard({ company, onClick }: { company: Company; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: company.id, data: { company } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-start gap-1">
        <div {...listeners} className="mt-2 cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-slate-500"><GripVertical className="h-4 w-4" /></div>
        <div className="flex-1"><DealCard company={company} isDragging={isDragging} onClick={onClick} /></div>
      </div>
    </div>
  );
}

interface KanbanColumnProps { stage: typeof STAGES[0]; companies: Company[]; onCardClick: (id: number) => void; }
function KanbanColumn({ stage, companies, onCardClick }: KanbanColumnProps) {
  const totalValue = companies.reduce((sum, c) => sum + (c.asking_price || 0), 0);
  return (
    <div className={`flex flex-col rounded-xl border ${stage.border} ${stage.bg} min-w-[260px] w-[260px] shrink-0`}>
      <div className="px-3 py-2.5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.color} border ${stage.border}`}>{companies.length}</span>
          </div>
          {totalValue > 0 && <span className="text-xs text-slate-500">{fmt(totalValue)}</span>}
        </div>
      </div>
      <SortableContext items={companies.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 min-h-[100px]">
          {companies.map((company) => (
            <SortableDealCard key={company.id} company={company} onClick={() => onCardClick(company.id)} />
          ))}
          {companies.length === 0 && (
            <div className="flex items-center justify-center h-16 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">Drop here</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelinePage() {
  const navigate = useNavigate();
  const [filterPartner, setFilterPartner] = useState<string>("");
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const { data, isLoading } = useCompanies({ limit: 200 });
  const moveStage = useMoveStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const companies = data?.items || [];

  const byStage = useMemo(() => {
    const filtered = filterPartner ? companies.filter(c => c.lead_partner === filterPartner) : companies;
    const map: Record<DealStage, Company[]> = { prospect: [], contacted: [], nda: [], loi: [], dd: [], closed: [], passed: [] };
    for (const c of filtered) { const s = c.deal_stage as DealStage; if (map[s]) map[s].push(c); }
    return map;
  }, [companies, filterPartner]);

  function handleDragStart(event: DragStartEvent) {
    setActiveCompany(companies.find(c => c.id === event.active.id) || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCompany(null);
    const { active, over } = event;
    if (!over) return;
    const overId = over.id as number;
    const overCompany = companies.find(c => c.id === overId);
    const targetStage = overCompany ? overCompany.deal_stage : STAGES.find(s => s.key === String(overId))?.key;
    if (!targetStage) return;
    const draggedCompany = companies.find(c => c.id === active.id);
    if (!draggedCompany || draggedCompany.deal_stage === targetStage) return;
    moveStage.mutate({ id: draggedCompany.id, stage: targetStage as DealStage });
  }

  const totalActive = companies.filter(c => ["contacted", "nda", "loi", "dd"].includes(c.deal_stage)).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-xs text-slate-500">{totalActive} active deals · {companies.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {["", "matt", "utsav"].map(p => (
              <button key={p} onClick={() => setFilterPartner(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterPartner === p ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                {p === "" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/companies")}><LayoutList className="h-3.5 w-3.5 mr-1.5" />List</Button>
          <Button size="sm" onClick={() => navigate("/companies/new")}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Company</Button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Loading pipeline…</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-4 h-full items-start">
              {STAGES.map(stage => (
                <KanbanColumn key={stage.key} stage={stage} companies={byStage[stage.key] || []} onCardClick={(id) => navigate(`/companies/${id}`)} />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeCompany && <div className="w-[260px] shadow-2xl rotate-2"><DealCard company={activeCompany} isDragging={false} /></div>}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
"""

# ── CompaniesPage (List view) ─────────────────────────────────────────────────
COMPANIES_LIST = r"""import React, { useState } from "react";
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
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
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
"""

# ── CompanyDetailPage ─────────────────────────────────────────────────────────
COMPANY_DETAIL = r"""import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import {
  ArrowLeft, Edit3, Save, X, Mail, Phone, Globe, MapPin,
  Calendar, TrendingUp, DollarSign, Users, Building2,
  FileText, MessageSquare, BarChart3, FolderOpen, Shield, PhoneCall,
  Plus, Send, Check, Clock,
} from "lucide-react";
import {
  useCompany, useUpdateCompany, useCompanyNotes, useCreateNote,
  useCompanyOutreach, useCreateOutreach, type DealStage,
} from "@/hooks/useCRM";
import { EnrichmentScoreBadge } from "@/components/enrichment/EnrichmentScoreBadge";
import { EnrichmentPanel } from "@/components/enrichment/EnrichmentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-slate-100 text-slate-700", contacted: "bg-blue-100 text-blue-700",
  nda: "bg-amber-100 text-amber-700", loi: "bg-purple-100 text-purple-700",
  dd: "bg-orange-100 text-orange-700", closed: "bg-emerald-100 text-emerald-700",
  passed: "bg-red-100 text-red-700",
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

function timeAgo(ts?: string | null): string {
  if (!ts) return "—";
  try { return formatDistanceToNow(parseISO(ts), { addSuffix: true }); }
  catch { return ts; }
}

const TABS = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "outreach", label: "Outreach", icon: Send },
  { key: "notes", label: "Notes", icon: MessageSquare },
  { key: "financials", label: "Financials", icon: BarChart3 },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "nda", label: "NDA", icon: Shield },
  { key: "calls", label: "Call Log", icon: PhoneCall },
  { key: "enrichment", label: "Enrichment", icon: TrendingUp },
];

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ company }: { company: ReturnType<typeof useCompany>["data"] }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | null>>({});
  const updateCompany = useUpdateCompany();

  if (!company) return null;

  function startEdit() {
    setForm({
      name: company!.name, website: company!.website || "",
      industry: company!.industry || "", sub_industry: company!.sub_industry || "",
      annual_revenue: company!.annual_revenue || "", ebitda: company!.ebitda || "",
      asking_price: company!.asking_price || "", employees: company!.employees || "",
      owner_name: company!.owner_name || "", owner_email: company!.owner_email || "",
      owner_phone: company!.owner_phone || "", description: company!.description || "",
      state: company!.state || "", city: company!.city || "",
      lead_partner: company!.lead_partner || "", source: company!.source || "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    await updateCompany.mutateAsync({ id: company!.id, ...form });
    setEditing(false);
  }

  const f = (key: string) => editing ? (
    <Input className="h-7 text-sm" value={String(form[key] ?? "")} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
  ) : (
    <span className="text-sm text-slate-700">{(company as Record<string, unknown>)[key] as string || "—"}</span>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
            <Button size="sm" onClick={saveEdit} disabled={updateCompany.isPending}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startEdit}><Edit3 className="h-3.5 w-3.5 mr-1" />Edit</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Business Info</h3>
          {[
            { label: "Company Name", key: "name" },
            { label: "Website", key: "website" },
            { label: "Industry", key: "industry" },
            { label: "Sub-Industry", key: "sub_industry" },
            { label: "City", key: "city" },
            { label: "State", key: "state" },
            { label: "Employees", key: "employees" },
            { label: "Founded", key: "founded_year" },
            { label: "Entity Type", key: "entity_type" },
            { label: "Source", key: "source" },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <span className="text-sm text-slate-500 shrink-0 w-32">{label}</span>
              {f(key)}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Financials</h3>
          {[
            { label: "Annual Revenue", key: "annual_revenue" },
            { label: "EBITDA", key: "ebitda" },
            { label: "EBITDA Margin", key: "ebitda_margin" },
            { label: "Asking Price", key: "asking_price" },
            { label: "Implied Multiple", key: "implied_multiple" },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <span className="text-sm text-slate-500 shrink-0 w-32">{label}</span>
              {editing ? (
                <Input className="h-7 text-sm" value={String(form[key] ?? "")} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
              ) : (
                <span className="text-sm font-medium text-slate-700">{fmt((company as Record<string, unknown>)[key] as number)}</span>
              )}
            </div>
          ))}

          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-6">Owner / Broker</h3>
          {[
            { label: "Owner Name", key: "owner_name" },
            { label: "Owner Email", key: "owner_email" },
            { label: "Owner Phone", key: "owner_phone" },
            { label: "Lead Partner", key: "lead_partner" },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <span className="text-sm text-slate-500 shrink-0 w-32">{label}</span>
              {f(key)}
            </div>
          ))}
        </div>
      </div>

      {(company.description || editing) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Description</h3>
          {editing ? (
            <textarea className="w-full text-sm border border-slate-200 rounded-lg p-2 h-24 resize-none" value={String(form.description ?? "")} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">{company.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────
function NotesTab({ companyId }: { companyId: number }) {
  const { data } = useCompanyNotes(companyId);
  const createNote = useCreateNote();
  const [content, setContent] = useState("");
  const notes = data?.items || [];

  async function addNote() {
    if (!content.trim()) return;
    await createNote.mutateAsync({ company_id: companyId, content, created_by: "matt" });
    setContent("");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <textarea
          className="flex-1 text-sm border border-slate-200 rounded-lg p-2.5 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add a note… (supports markdown)"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <Button size="sm" onClick={addNote} disabled={!content.trim() || createNote.isPending} className="self-end">
          <Plus className="h-3.5 w-3.5 mr-1" />Add
        </Button>
      </div>
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No notes yet</p>
        ) : notes.map(note => (
          <div key={note.id} className={`bg-white rounded-lg border p-3 ${note.is_pinned ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{note.created_by || "Unknown"}</span>
                {note.tagged_stage && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STAGE_COLORS[note.tagged_stage] || "bg-slate-100 text-slate-600"}`}>
                    {STAGE_LABELS[note.tagged_stage] || note.tagged_stage}
                  </span>
                )}
                {note.is_pinned && <span className="text-[10px] text-amber-600 font-medium">📌 Pinned</span>}
              </div>
              <span className="text-[10px] text-slate-400">{timeAgo(note.created_at)}</span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Outreach Tab ──────────────────────────────────────────────────────────────
function OutreachTab({ companyId }: { companyId: number }) {
  const { data } = useCompanyOutreach(companyId);
  const createOutreach = useCreateOutreach();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contact_method: "email", direction: "outbound", notes: "", outcome: "", follow_up_date: "" });
  const entries = data?.items || [];

  const METHOD_ICONS: Record<string, React.ReactNode> = {
    email: <Mail className="h-4 w-4" />, phone: <Phone className="h-4 w-4" />,
    in_person: <Users className="h-4 w-4" />, linkedin: <Globe className="h-4 w-4" />,
  };

  const OUTCOME_COLORS: Record<string, string> = {
    positive: "text-emerald-600", negative: "text-red-600",
    neutral: "text-slate-600", no_response: "text-amber-600",
  };

  async function logActivity() {
    await createOutreach.mutateAsync({ ...form, company_id: companyId, sent_by: "matt" });
    setShowForm(false);
    setForm({ contact_method: "email", direction: "outbound", notes: "", outcome: "", follow_up_date: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700">Activity Timeline</h3>
        <Button size="sm" onClick={() => setShowForm(s => !s)}><Plus className="h-3.5 w-3.5 mr-1" />Log Activity</Button>
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Method</label>
              <select className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white" value={form.contact_method} onChange={e => setForm(p => ({ ...p, contact_method: e.target.value }))}>
                <option value="email">Email</option><option value="phone">Phone</option>
                <option value="in_person">In Person</option><option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Direction</label>
              <select className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>
                <option value="outbound">Outbound</option><option value="inbound">Inbound</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Notes</label>
            <textarea className="w-full text-sm border border-slate-200 rounded-lg p-2 h-16 resize-none" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Outcome</label>
              <select className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white" value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))}>
                <option value="">—</option><option value="positive">Positive</option>
                <option value="neutral">Neutral</option><option value="negative">Negative</option>
                <option value="no_response">No Response</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Follow-up Date</label>
              <Input type="date" className="h-8 text-sm" value={form.follow_up_date} onChange={e => setForm(p => ({ ...p, follow_up_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={logActivity} disabled={createOutreach.isPending}>Save</Button>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8 pl-10">No outreach logged yet</p>
          ) : entries.map(entry => (
            <div key={entry.id} className="flex gap-3 relative">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 z-10 ${entry.direction === "inbound" ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                {METHOD_ICONS[entry.contact_method] || <Mail className="h-4 w-4" />}
              </div>
              <div className="flex-1 bg-white rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-700 capitalize">{entry.contact_method}</span>
                    <Badge variant={entry.direction === "inbound" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{entry.direction}</Badge>
                    {entry.outcome && <span className={`text-xs font-medium capitalize ${OUTCOME_COLORS[entry.outcome] || "text-slate-600"}`}>{entry.outcome.replace("_", " ")}</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(entry.created_at)}</span>
                </div>
                {entry.notes && <p className="text-sm text-slate-600 mt-1.5">{entry.notes}</p>}
                {entry.follow_up_date && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-600">
                    <Clock className="h-3 w-3" />Follow-up: {format(parseISO(entry.follow_up_date), "MMM d, yyyy")}
                  </div>
                )}
                {entry.sent_by && <p className="text-[10px] text-slate-400 mt-1">by {entry.sent_by}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Placeholder tabs ──────────────────────────────────────────────────────────
function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <FileText className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs mt-1">Coming in a future module</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [stageDropdown, setStageDropdown] = useState(false);
  const updateCompany = useUpdateCompany();

  const { data: company, isLoading } = useCompany(id ? parseInt(id) : null);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>;
  if (!company) return <div className="flex items-center justify-center h-64 text-slate-400">Company not found</div>;

  const multiple = company.implied_multiple
    ? `${company.implied_multiple.toFixed(1)}x`
    : company.asking_price && company.ebitda
      ? `${(company.asking_price / company.ebitda).toFixed(1)}x`
      : null;

  async function changeStage(stage: DealStage) {
    await updateCompany.mutateAsync({ id: company!.id, deal_stage: stage });
    setStageDropdown(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />Back
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {company.industry && <span className="text-sm text-slate-500">{company.industry}</span>}
                {company.city && company.state && <span className="text-sm text-slate-400">· {company.city}, {company.state}</span>}
                {company.is_proprietary && <Badge variant="info" className="text-xs">Proprietary</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                <Calendar className="h-3 w-3" />
                Last contacted {company.last_contacted_at ? timeAgo(company.last_contacted_at) : "never"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Financials summary */}
            <div className="hidden md:flex items-center gap-4 bg-slate-50 rounded-lg px-4 py-2">
              <div className="text-center">
                <p className="text-xs text-slate-500">Revenue</p>
                <p className="text-sm font-semibold text-slate-800">{fmt(company.annual_revenue)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">EBITDA</p>
                <p className="text-sm font-semibold text-slate-800">{fmt(company.ebitda)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">Ask Price</p>
                <p className="text-sm font-semibold text-slate-800">{fmt(company.asking_price)}{multiple ? ` · ${multiple}` : ""}</p>
              </div>
            </div>

            {/* Stage badge + dropdown */}
            <div className="relative">
              <button
                onClick={() => setStageDropdown(s => !s)}
                className={`text-sm font-medium px-3 py-1.5 rounded-full border cursor-pointer ${STAGE_COLORS[company.deal_stage] || "bg-slate-100 text-slate-700"}`}
              >
                {STAGE_LABELS[company.deal_stage] || company.deal_stage} ▾
              </button>
              {stageDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[140px]">
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => changeStage(k as DealStage)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${k === company.deal_stage ? "font-semibold" : ""}`}>
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Score */}
            <EnrichmentScoreBadge
              companyId={company.id}
              score={company.enrichment_score}
              compact
            />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 shrink-0">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                <Icon className="h-3.5 w-3.5" />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {activeTab === "overview" && <OverviewTab company={company} />}
        {activeTab === "notes" && <NotesTab companyId={company.id} />}
        {activeTab === "outreach" && <OutreachTab companyId={company.id} />}
        {activeTab === "enrichment" && <EnrichmentPanel companyId={company.id} />}
        {activeTab === "emails" && <PlaceholderTab label="Email Threads" />}
        {activeTab === "financials" && <PlaceholderTab label="Financial Model" />}
        {activeTab === "documents" && <PlaceholderTab label="Document Vault" />}
        {activeTab === "nda" && <PlaceholderTab label="NDA Review & Signature" />}
        {activeTab === "calls" && <PlaceholderTab label="Call Log" />}
      </div>
    </div>
  );
}
"""

# ── Broker Listings Page ──────────────────────────────────────────────────────
LISTINGS_PAGE = r"""import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Search, Download, Plus, RefreshCw, ExternalLink, Check, X, Filter,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCompany } from "@/hooks/useCRM";

interface Listing {
  id: number; broker_site?: string; business_name?: string;
  asking_price?: number; revenue?: number; ebitda?: number;
  location?: string; industry?: string; description?: string;
  date_listed?: string; date_scraped?: string;
  matched_company_id?: number; is_new?: boolean;
  listing_url?: string;
}

function fmt(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const SITE_COLORS: Record<string, string> = {
  bizbuysell: "bg-blue-100 text-blue-700", axial: "bg-purple-100 text-purple-700",
  bizquest: "bg-emerald-100 text-emerald-700", dealstream: "bg-amber-100 text-amber-700",
  loopnet: "bg-orange-100 text-orange-700",
};

export default function ListingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (siteFilter) params.set("broker_site", siteFilter);
  if (newOnly) params.set("is_new", "true");
  params.set("skip", String((page - 1) * 50));
  params.set("limit", "50");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["listings", search, siteFilter, newOnly, page],
    queryFn: async () => {
      const { data } = await api.get(`/broker-listings/?${params.toString()}`);
      return data as { total: number; items: Listing[] };
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => api.patch(`/broker-listings/${id}`, { is_new: false })));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listings"] }); setSelected(new Set()); },
  });

  const createCompany = useCreateCompany();

  const listings = data?.items || [];
  const total = data?.total || 0;

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === listings.length) setSelected(new Set());
    else setSelected(new Set(listings.map(l => l.id)));
  }

  async function addToPipeline(listing: Listing) {
    await createCompany.mutateAsync({
      name: listing.business_name || "Unknown Business",
      industry: listing.industry,
      annual_revenue: listing.revenue,
      ebitda: listing.ebitda,
      asking_price: listing.asking_price,
      listing_url: listing.listing_url,
      deal_stage: "prospect",
      source: listing.broker_site,
    });
  }

  function exportCSV() {
    const headers = ["Business Name","Industry","Revenue","EBITDA","Asking Price","Location","Source","Date Listed","New","Matched"];
    const rows = listings.map(l => [
      l.business_name || "", l.industry || "", fmt(l.revenue), fmt(l.ebitda),
      fmt(l.asking_price), l.location || "", l.broker_site || "",
      l.date_listed ? format(parseISO(l.date_listed), "yyyy-MM-dd") : "",
      l.is_new ? "Yes" : "No", l.matched_company_id ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "listings.csv"; a.click();
  }

  const sites = [...new Set(listings.map(l => l.broker_site).filter(Boolean))];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200 bg-white shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Broker Listings</h1>
          <p className="text-xs text-slate-500">{total} listings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input className="pl-8 h-8 w-48 text-sm" placeholder="Search listings…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="h-8 text-xs border border-slate-200 rounded-md px-2 bg-white" value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
            <option value="">All sites</option>
            {sites.map(s => <option key={s} value={s!}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={newOnly} onChange={e => setNewOnly(e.target.checked)} className="rounded" />
            New only
          </label>
          {selected.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => dismissMutation.mutate([...selected])}>
              <X className="h-3.5 w-3.5 mr-1" />Dismiss {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
          <Button size="sm" onClick={() => navigate("/scraper")}><Filter className="h-3.5 w-3.5 mr-1.5" />Scraper</Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
            <tr>
              <th className="px-3 py-2.5 w-8">
                <input type="checkbox" checked={selected.size === listings.length && listings.length > 0} onChange={toggleAll} className="rounded" />
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Business Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Industry</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Revenue</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">EBITDA</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Ask Price</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Multiple</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Location</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Source</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Date</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Status</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={12} className="text-center py-12 text-slate-400">Loading listings…</td></tr>
            ) : listings.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-12 text-slate-400">No listings found. Run the scraper to fetch new listings.</td></tr>
            ) : listings.map(listing => {
              const multiple = listing.asking_price && listing.ebitda ? `${(listing.asking_price / listing.ebitda).toFixed(1)}x` : null;
              return (
                <tr key={listing.id} className={`hover:bg-slate-50 ${selected.has(listing.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(listing.id)} onChange={() => toggleSelect(listing.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-slate-900 truncate max-w-[200px]">{listing.business_name || "—"}</p>
                        {listing.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{listing.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{listing.industry || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(listing.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmt(listing.ebitda)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(listing.asking_price)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{multiple || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{listing.location || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {listing.broker_site && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SITE_COLORS[listing.broker_site] || "bg-slate-100 text-slate-600"}`}>
                        {listing.broker_site}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500">
                    {listing.date_listed ? format(parseISO(listing.date_listed), "MMM d") : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {listing.is_new && <Badge variant="success" className="text-[10px] px-1.5 py-0">New</Badge>}
                      {listing.matched_company_id && (
                        <button onClick={() => navigate(`/companies/${listing.matched_company_id}`)} className="text-[10px] text-blue-600 hover:underline">Matched</button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {listing.listing_url && (
                        <a href={listing.listing_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-slate-100 rounded">
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </a>
                      )}
                      {!listing.matched_company_id && (
                        <button onClick={() => addToPipeline(listing)} className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded font-medium">
                          <Plus className="h-3 w-3" />Add
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
"""

# ── Mobile Search Page ────────────────────────────────────────────────────────
MOBILE_SEARCH = r"""import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Mail, FileText, List } from "lucide-react";
import { useGlobalSearch } from "@/hooks/useCRM";
import { Input } from "@/components/ui/input";

function fmt(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function MobileSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data, isLoading } = useGlobalSearch(query);

  const hasResults = data && (
    (data.companies?.length || 0) + (data.emails?.length || 0) + (data.listings?.length || 0) > 0
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Search bar */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-900 mb-3">Search</h1>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 h-10 text-sm"
            placeholder="Search companies, emails, listings…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!query && (
          <div className="text-center py-12 text-slate-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Start typing to search</p>
          </div>
        )}

        {isLoading && query && (
          <div className="text-center py-8 text-slate-400 text-sm">Searching…</div>
        )}

        {query && !isLoading && !hasResults && (
          <div className="text-center py-8 text-slate-400 text-sm">No results for "{query}"</div>
        )}

        {/* Companies */}
        {(data?.companies?.length || 0) > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />Companies
            </h2>
            <div className="space-y-2">
              {data!.companies.map((c: { id: number; name: string; industry?: string; deal_stage?: string; asking_price?: number }) => (
                <button key={c.id} onClick={() => navigate(`/companies/${c.id}`)}
                  className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left hover:shadow-sm">
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{c.industry || "—"}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{fmt(c.asking_price)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Emails */}
        {(data?.emails?.length || 0) > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />Emails
            </h2>
            <div className="space-y-2">
              {data!.emails.map((e: { id: number; subject?: string; sender_email?: string }) => (
                <button key={e.id} onClick={() => navigate(`/inbox`)}
                  className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left hover:shadow-sm">
                  <p className="font-medium text-slate-900 truncate">{e.subject || "(no subject)"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{e.sender_email}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listings */}
        {(data?.listings?.length || 0) > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <List className="h-3.5 w-3.5" />Listings
            </h2>
            <div className="space-y-2">
              {data!.listings.map((l: { id: number; business_name?: string; industry?: string; asking_price?: number; broker_site?: string }) => (
                <button key={l.id} onClick={() => navigate(`/listings`)}
                  className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left hover:shadow-sm">
                  <p className="font-medium text-slate-900 truncate">{l.business_name || "—"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{l.industry || "—"}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{fmt(l.asking_price)}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{l.broker_site}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"""

files = {
    f"{BASE}/pages/pipeline/PipelinePage.tsx": PIPELINE,
    f"{BASE}/pages/companies/CompaniesPage.tsx": COMPANIES_LIST,
    f"{BASE}/pages/companies/CompanyDetailPage.tsx": COMPANY_DETAIL,
    f"{BASE}/pages/scraper/ListingsPage.tsx": LISTINGS_PAGE,
    f"{BASE}/pages/search/MobileSearchPage.tsx": MOBILE_SEARCH,
}

os.makedirs(f"{BASE}/pages/search", exist_ok=True)

for path, content in files.items():
    with open(path, "w") as f:
        f.write(content)
    print(f"Written: {path} ({len(content.splitlines())} lines)")

print("All frontend files written successfully.")
