import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext, DragEndEvent, DragOverlay,
  DragStartEvent, PointerSensor, useSensor, useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays, parseISO } from "date-fns";
import {
  TrendingUp, DollarSign, Clock, Plus, LayoutList,
  GripVertical, AlertTriangle, Target, Upload, Settings, ExternalLink, Mail,
} from "lucide-react";
import { useCompanies, useMoveStage, type Company, type DealStage } from "@/hooks/useCRM";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Stage definitions (full Lead → Acquisition funnel) ──────────────────────
const STAGES: {
  key: DealStage; label: string; color: string; bg: string; border: string;
  stallDays: number; description: string;
}[] = [
  { key: "lead",      label: "Lead",          color: "text-slate-700",   bg: "bg-slate-50",    border: "border-slate-200",  stallDays: 7,  description: "Raw inbound / imported" },
  { key: "prospect",  label: "Prospect",      color: "text-indigo-700",  bg: "bg-indigo-50",   border: "border-indigo-200", stallDays: 14, description: "Qualified, not contacted" },
  { key: "contacted", label: "Contacted",     color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",   stallDays: 21, description: "Outreach sent" },
  { key: "nda",       label: "NDA",           color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",  stallDays: 30, description: "NDA executed" },
  { key: "cim",       label: "CIM",           color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200", stallDays: 21, description: "CIM received & reviewing" },
  { key: "model",     label: "Model",         color: "text-violet-700",  bg: "bg-violet-50",   border: "border-violet-200", stallDays: 14, description: "Financial model in progress" },
  { key: "ioi",       label: "IOI",           color: "text-pink-700",    bg: "bg-pink-50",     border: "border-pink-200",   stallDays: 14, description: "Indication of Interest sent" },
  { key: "loi",       label: "LOI",           color: "text-purple-700",  bg: "bg-purple-50",   border: "border-purple-200", stallDays: 30, description: "LOI submitted" },
  { key: "dd",        label: "Diligence",     color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200",   stallDays: 60, description: "Due Diligence" },
  { key: "closed",    label: "Closed ✓",      color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200",stallDays: 999,"description": "Acquisition closed" },
  { key: "passed",    label: "Passed",        color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",    stallDays: 999, description: "Passed / dead" },
];

const ACTIVE_STAGES = STAGES.filter(s => !["closed", "passed"].includes(s.key));

const PARTNER_COLORS: Record<string, string> = { matt: "bg-blue-600", utsav: "bg-emerald-600" };

function fmt(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function daysInStage(company: Company): number | null {
  const ref = (company as any).stage_entered_at || company.updated_at;
  if (!ref) return null;
  try { return differenceInDays(new Date(), parseISO(ref)); }
  catch { return null; }
}

function thesisScoreColor(score?: number | null): string {
  if (score == null) return "bg-slate-100 text-slate-500";
  if (score >= 70) return "bg-emerald-100 text-emerald-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function thesisLabel(score?: number | null): string {
  if (score == null) return "?";
  if (score >= 70) return "Pursue";
  if (score >= 40) return "Watch";
  return "Pass";
}

// ── Deal Card ────────────────────────────────────────────────────────────────
interface DealCardProps { company: Company; isDragging?: boolean; onClick?: () => void; }
function DealCard({ company, isDragging, onClick }: DealCardProps) {
  const multiple = (company as any).implied_multiple
    ? `${(company as any).implied_multiple.toFixed(1)}x`
    : company.asking_price && company.ebitda
      ? `${(company.asking_price / company.ebitda).toFixed(1)}x`
      : null;

  const days = daysInStage(company);
  const stageConfig = STAGES.find(s => s.key === company.deal_stage);
  const isStalled = days != null && stageConfig && days >= stageConfig.stallDays;
  const thesisScore = (company as any).thesis_score as number | null | undefined;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border p-3 cursor-pointer hover:shadow-md transition-all select-none
        ${isStalled ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"}
        ${isDragging ? "opacity-50 shadow-xl rotate-1" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{company.name}</p>
        {thesisScore != null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${thesisScoreColor(thesisScore)}`}>
            {Math.round(thesisScore)} · {thesisLabel(thesisScore)}
          </span>
        )}
      </div>

      {/* Industry + location */}
      {(company.industry || company.state) && (
        <p className="text-xs text-slate-500 mb-2 truncate">
          {[company.industry, company.state].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* Financials */}
      <div className="grid grid-cols-2 gap-1 mb-2">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-slate-400" />
          <span className="text-xs text-slate-600">{fmt(company.annual_revenue)}</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-slate-400" />
          <span className="text-xs text-slate-600">
            {fmt(company.ebitda)}{multiple ? ` · ${multiple}` : ""}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {company.lead_partner && (
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${PARTNER_COLORS[company.lead_partner] || "bg-slate-400"}`}>
              {company.lead_partner.charAt(0).toUpperCase()}
            </div>
          )}
          {company.is_proprietary && (
            <Badge variant="info" className="text-[9px] px-1 py-0">Prop</Badge>
          )}
          {company.source === "csv_import" && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0">CSV</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Source URL link */}
          {(company as any).source_url && (
            <a
              href={(company as any).source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title={`Source: ${(company as any).source_url}`}
              className="text-slate-400 hover:text-blue-500 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {/* Email ingest reference */}
          {(company as any).inbound_email_id && (
            <a
              href={`/email-ingest?highlight=${(company as any).inbound_email_id}`}
              onClick={e => e.stopPropagation()}
              title="View original email"
              className="text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <Mail className="h-3 w-3" />
            </a>
          )}
          <div className={`flex items-center gap-1 text-[10px] ${isStalled ? "text-red-500 font-semibold" : "text-slate-400"}`}>
            {isStalled && <AlertTriangle className="h-3 w-3" />}
            <Clock className="h-3 w-3" />
            {days != null ? `${days}d` : "—"}
          </div>
        </div>
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
        <div {...listeners} className="mt-2 cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-slate-500">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <DealCard company={company} isDragging={isDragging} onClick={onClick} />
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ────────────────────────────────────────────────────────────
interface KanbanColumnProps {
  stage: typeof STAGES[0];
  companies: Company[];
  onCardClick: (id: number) => void;
}
function KanbanColumn({ stage, companies, onCardClick }: KanbanColumnProps) {
  const totalValue = companies.reduce((sum, c) => sum + (c.asking_price || 0), 0);
  const stalledCount = companies.filter(c => {
    const d = daysInStage(c);
    return d != null && d >= stage.stallDays;
  }).length;

  return (
    <div className={`flex flex-col rounded-xl border ${stage.border} ${stage.bg} min-w-[260px] w-[260px] shrink-0`}>
      <div className="px-3 py-2.5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.color} border ${stage.border}`}>
              {companies.length}
            </span>
            {stalledCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
                <AlertTriangle className="h-3 w-3" />{stalledCount}
              </span>
            )}
          </div>
          {totalValue > 0 && <span className="text-xs text-slate-500">{fmt(totalValue)}</span>}
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">{stage.description}</p>
      </div>
      <SortableContext items={companies.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 min-h-[100px] overflow-y-auto max-h-[calc(100vh-220px)]">
          {companies.map((company) => (
            <SortableDealCard key={company.id} company={company} onClick={() => onCardClick(company.id)} />
          ))}
          {companies.length === 0 && (
            <div className="flex items-center justify-center h-16 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
              Drop here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const navigate = useNavigate();
  const [filterPartner, setFilterPartner] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const { data, isLoading } = useCompanies({ limit: 500 });
  const moveStage = useMoveStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const companies = data?.items || [];

  const displayStages = showAll ? STAGES : ACTIVE_STAGES;

  const byStage = useMemo(() => {
    const filtered = filterPartner ? companies.filter(c => c.lead_partner === filterPartner) : companies;
    const map: Record<string, Company[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const c of filtered) {
      const s = c.deal_stage as string;
      if (map[s]) map[s].push(c);
    }
    return map;
  }, [companies, filterPartner]);

  const stalledTotal = useMemo(() => {
    let count = 0;
    for (const stage of STAGES) {
      for (const c of (byStage[stage.key] || [])) {
        const d = daysInStage(c);
        if (d != null && d >= stage.stallDays) count++;
      }
    }
    return count;
  }, [byStage]);

  const highPriorityNew = useMemo(() =>
    (byStage["lead"] || []).filter(c => (c as any).thesis_score >= 70).length,
    [byStage]
  );

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

  const activeDeals = companies.filter(c => !["closed", "passed", "lead"].includes(c.deal_stage)).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Acquisition Pipeline</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-slate-500">{activeDeals} active · {companies.length} total</p>
            {stalledTotal > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />{stalledTotal} stalled
              </span>
            )}
            {highPriorityNew > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                <Target className="h-3 w-3" />{highPriorityNew} high-priority leads
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Partner filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {["", "matt", "utsav"].map(p => (
              <button key={p} onClick={() => setFilterPartner(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterPartner === p ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                {p === "" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {/* Show all stages toggle */}
          <button
            onClick={() => setShowAll(v => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${showAll ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {showAll ? "Active Only" : "All Stages"}
          </button>
          <Button variant="outline" size="sm" onClick={() => navigate("/import")}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/companies")}>
            <LayoutList className="h-3.5 w-3.5 mr-1.5" />List
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/thesis")}>
            <Settings className="h-3.5 w-3.5 mr-1.5" />Thesis
          </Button>
          <Button size="sm" onClick={() => navigate("/companies/new")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 shrink-0">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />Pursue (≥70)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />Watch (40–69)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" />Pass (&lt;40)</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" />Stalled (past threshold)</span>
        <span className="ml-auto text-slate-400">Drag cards to move stages · Score badge = Thesis fit</span>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Loading pipeline…</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-4 h-full items-start">
              {displayStages.map(stage => (
                <KanbanColumn
                  key={stage.key}
                  stage={stage}
                  companies={byStage[stage.key] || []}
                  onCardClick={(id) => navigate(`/companies/${id}`)}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeCompany && (
              <div className="w-[260px] shadow-2xl rotate-2">
                <DealCard company={activeCompany} isDragging={false} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
