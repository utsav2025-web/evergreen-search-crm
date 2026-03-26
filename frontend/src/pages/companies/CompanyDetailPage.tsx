import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import {
  ArrowLeft, Edit3, Save, X, Mail, Phone, Globe, MapPin,
  Calendar, TrendingUp, DollarSign, Users, Building2,
  FileText, MessageSquare, BarChart3, FolderOpen, Shield, PhoneCall,
  Plus, Send, Check, Clock, ExternalLink, Link2,
} from "lucide-react";
import {
  useCompany, useUpdateCompany, useCompanyNotes, useCreateNote,
  useCompanyOutreach, useCreateOutreach, type DealStage,
} from "@/hooks/useCRM";
import { EnrichmentScoreBadge } from "@/components/enrichment/EnrichmentScoreBadge";
import { EnrichmentPanel } from "@/components/enrichment/EnrichmentPanel";
import { DealMemoPanel } from "@/components/deal-scoring/DealMemoPanel";
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
  { key: "deal-memo", label: "Deal Memo", icon: BarChart3 },
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
    <span className="text-sm text-slate-700">{(company as unknown as Record<string, unknown>)[key] as string || "—"}</span>
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
                <span className="text-sm font-medium text-slate-700">{fmt((company as unknown as Record<string, unknown>)[key] as number)}</span>
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

      {/* Source References */}
      {((company as any).source_url || (company as any).listing_url || (company as any).inbound_email_id) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />Source References
          </h3>
          <div className="space-y-2">
            {(company as any).source_url && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-28 shrink-0">Scraped From</span>
                <a
                  href={(company as any).source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 truncate"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {(company as any).source_url}
                </a>
              </div>
            )}
            {(company as any).listing_url && (company as any).listing_url !== (company as any).source_url && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-28 shrink-0">Broker Listing</span>
                <a
                  href={(company as any).listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 truncate"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {(company as any).listing_url}
                </a>
              </div>
            )}
            {(company as any).inbound_email_id && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-28 shrink-0">Original Email</span>
                <a
                  href={`/email-ingest?highlight=${(company as any).inbound_email_id}`}
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  View email #{(company as any).inbound_email_id} in Email Inbox
                </a>
              </div>
            )}
          </div>
        </div>
      )}

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
              score={company.enrichment_score ?? null}
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
        {activeTab === "enrichment" && <EnrichmentPanel companyId={company.id} companyName={company.name} />}
        {activeTab === "deal-memo" && <DealMemoPanel companyId={company.id} companyName={company.name} />}
        {activeTab === "emails" && <PlaceholderTab label="Email Threads" />}
        {activeTab === "financials" && <PlaceholderTab label="Financial Model" />}
        {activeTab === "documents" && <PlaceholderTab label="Document Vault" />}
        {activeTab === "nda" && <PlaceholderTab label="NDA Review & Signature" />}
        {activeTab === "calls" && <PlaceholderTab label="Call Log" />}
      </div>
    </div>
  );
}
