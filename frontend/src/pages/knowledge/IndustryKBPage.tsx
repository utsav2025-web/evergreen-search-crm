import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface KBEntry {
  id: number;
  industry: string;
  sub_industry: string | null;
  title: string;
  content: string;
  source_url: string | null;
  tags: string[];
  is_public: boolean;
  created_at: string;
}

interface CompTransaction {
  id: number;
  target_name: string | null;
  industry: string | null;
  sub_industry: string | null;
  transaction_date: string | null;
  enterprise_value: number | null;
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  ev_revenue_multiple: number | null;
  ev_ebitda_multiple: number | null;
  buyer_type: string | null;
  source: string | null;
  notes_text: string | null;
}

function fmt(v: number | null | undefined, prefix = "$"): string {
  if (v == null) return "\u2014";
  if (Math.abs(v) >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}K`;
  return `${prefix}${v.toFixed(0)}`;
}

function fmtDate(s: string | null) {
  if (!s) return "\u2014";
  return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const EMPTY_ENTRY = { industry: "", sub_industry: "", title: "", content: "", source_url: "", tags: "" };
const EMPTY_COMP = { target_name: "", industry: "", enterprise_value: "", revenue_ttm: "", ebitda_ttm: "", ev_ebitda_multiple: "", buyer_type: "strategic", source: "", notes_text: "" };

export default function IndustryKBPage() {
  const [activeTab, setActiveTab] = useState<"kb" | "comps">("kb");
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY);
  const [compForm, setCompForm] = useState(EMPTY_COMP);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: kbData } = useQuery({
    queryKey: ["kb-entries", search, industryFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      if (industryFilter) params.set("industry", industryFilter);
      return api.get(`/industry-kb/?${params}`).then(r => r.data);
    },
  });

  const { data: compsData } = useQuery({
    queryKey: ["comps-list", industryFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (industryFilter) params.set("industry", industryFilter);
      return api.get(`/industry-kb/comps/?${params}`).then(r => r.data);
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ["comps-stats", industryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (industryFilter) params.set("industry", industryFilter);
      return api.get(`/industry-kb/comps/stats?${params}`).then(r => r.data);
    },
  });

  const { data: industriesData } = useQuery({
    queryKey: ["kb-industries"],
    queryFn: () => api.get("/industry-kb/industries").then(r => r.data),
  });

  const addEntryMutation = useMutation({
    mutationFn: (data: any) => api.post("/industry-kb/", {
      ...data,
      tags: data.tags ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-entries"] });
      qc.invalidateQueries({ queryKey: ["kb-industries"] });
      setShowAddEntry(false);
      setEntryForm(EMPTY_ENTRY);
    },
  });

  const addCompMutation = useMutation({
    mutationFn: (data: any) => api.post("/industry-kb/comps/", {
      ...data,
      enterprise_value: data.enterprise_value ? Number(data.enterprise_value) : null,
      revenue_ttm: data.revenue_ttm ? Number(data.revenue_ttm) : null,
      ebitda_ttm: data.ebitda_ttm ? Number(data.ebitda_ttm) : null,
      ev_ebitda_multiple: data.ev_ebitda_multiple ? Number(data.ev_ebitda_multiple) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comps-list"] });
      qc.invalidateQueries({ queryKey: ["comps-stats"] });
      setShowAddComp(false);
      setCompForm(EMPTY_COMP);
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/industry-kb/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-entries"] }),
  });

  const deleteCompMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/industry-kb/comps/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comps-list"] }),
  });

  const entries: KBEntry[] = kbData?.items ?? [];
  const comps: CompTransaction[] = compsData?.items ?? [];
  const industries: string[] = industriesData ?? [];
  const stats = statsData ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Industry Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">Research, comparable transactions, and industry insights</p>
        </div>
        <WriteGuard>
          <button
            onClick={() => activeTab === "kb" ? setShowAddEntry(true) : setShowAddComp(true)}
            className="text-sm px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            + Add {activeTab === "kb" ? "Entry" : "Comp"}
          </button>
        </WriteGuard>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["kb", "comps"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab === "kb" ? "Knowledge Base" : "Comparable Transactions"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {activeTab === "kb" && (
          <input
            type="text"
            placeholder="Search entries…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
          />
        )}
        <select
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={industryFilter}
          onChange={e => setIndustryFilter(e.target.value)}
        >
          <option value="">All Industries</option>
          {industries.map(ind => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>

      {/* Comps Stats Banner */}
      {activeTab === "comps" && stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Comps</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Median EV/EBITDA</p>
            <p className="text-2xl font-bold text-gray-900">{stats.median_ev_ebitda?.toFixed(1) ?? "\u2014"}x</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Median EV/Revenue</p>
            <p className="text-2xl font-bold text-gray-900">{stats.median_ev_revenue?.toFixed(1) ?? "\u2014"}x</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">EV/EBITDA Range</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.min_ev_ebitda?.toFixed(1) ?? "\u2014"}\u2013{stats.max_ev_ebitda?.toFixed(1) ?? "\u2014"}x
            </p>
          </div>
        </div>
      )}

      {/* KB Entries */}
      {activeTab === "kb" && (
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
              No knowledge base entries yet. Add research, industry reports, or key insights.
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{entry.industry}</span>
                        {entry.sub_industry && <span className="text-xs text-gray-300">&bull; {entry.sub_industry}</span>}
                        {entry.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <WriteGuard>
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm("Delete this entry?")) deleteEntryMutation.mutate(entry.id); }}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                      >
                        Delete
                      </button>
                    </WriteGuard>
                    <span className="text-gray-400 text-sm">{expandedEntry === entry.id ? "▲" : "▼"}</span>
                  </div>
                </div>
                {expandedEntry === entry.id && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{entry.content}</p>
                    {entry.source_url && (
                      <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline mt-2 block">
                        Source: {entry.source_url}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Comparable Transactions */}
      {activeTab === "comps" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {comps.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No comparable transactions yet. Add comps to build your valuation database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Target", "Industry", "Date", "EV", "Revenue", "EBITDA", "EV/EBITDA", "EV/Rev", "Buyer", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comps.map(comp => (
                    <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{comp.target_name ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-gray-600">{comp.industry ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(comp.transaction_date)}</td>
                      <td className="px-4 py-3 text-gray-900">{fmt(comp.enterprise_value)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt(comp.revenue_ttm)}</td>
                      <td className="px-4 py-3 text-emerald-700">{fmt(comp.ebitda_ttm)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {comp.ev_ebitda_multiple ? `${comp.ev_ebitda_multiple.toFixed(1)}x` : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {comp.ev_revenue_multiple ? `${comp.ev_revenue_multiple.toFixed(1)}x` : "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        {comp.buyer_type && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            comp.buyer_type === "strategic" ? "bg-blue-100 text-blue-700" :
                            comp.buyer_type === "pe" ? "bg-purple-100 text-purple-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {comp.buyer_type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <WriteGuard>
                          <button
                            onClick={() => { if (confirm("Delete this comp?")) deleteCompMutation.mutate(comp.id); }}
                            className="text-xs text-red-400 hover:text-red-600"
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
      )}

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add KB Entry</h2>
            <div className="space-y-3">
              <input
                placeholder="Title *"
                value={entryForm.title}
                onChange={e => setEntryForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="Industry *"
                value={entryForm.industry}
                onChange={e => setEntryForm(f => ({ ...f, industry: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="Sub-industry"
                value={entryForm.sub_industry}
                onChange={e => setEntryForm(f => ({ ...f, sub_industry: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <textarea
                placeholder="Content *"
                value={entryForm.content}
                onChange={e => setEntryForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="Source URL"
                value={entryForm.source_url}
                onChange={e => setEntryForm(f => ({ ...f, source_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="Tags (comma-separated)"
                value={entryForm.tags}
                onChange={e => setEntryForm(f => ({ ...f, tags: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => addEntryMutation.mutate(entryForm)}
                disabled={addEntryMutation.isPending || !entryForm.title || !entryForm.content}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {addEntryMutation.isPending ? "Saving…" : "Save Entry"}
              </button>
              <button
                onClick={() => { setShowAddEntry(false); setEntryForm(EMPTY_ENTRY); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Comp Modal */}
      {showAddComp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Comparable Transaction</h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Target name"
                value={compForm.target_name}
                onChange={e => setCompForm(f => ({ ...f, target_name: e.target.value }))}
                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="Industry"
                value={compForm.industry}
                onChange={e => setCompForm(f => ({ ...f, industry: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <select
                value={compForm.buyer_type}
                onChange={e => setCompForm(f => ({ ...f, buyer_type: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="strategic">Strategic</option>
                <option value="pe">PE</option>
                <option value="search_fund">Search Fund</option>
                <option value="individual">Individual</option>
              </select>
              <input
                placeholder="Enterprise Value ($)"
                value={compForm.enterprise_value}
                onChange={e => setCompForm(f => ({ ...f, enterprise_value: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="Revenue TTM ($)"
                value={compForm.revenue_ttm}
                onChange={e => setCompForm(f => ({ ...f, revenue_ttm: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="EBITDA TTM ($)"
                value={compForm.ebitda_ttm}
                onChange={e => setCompForm(f => ({ ...f, ebitda_ttm: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="EV/EBITDA multiple (optional)"
                value={compForm.ev_ebitda_multiple}
                onChange={e => setCompForm(f => ({ ...f, ev_ebitda_multiple: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                placeholder="Source"
                value={compForm.source}
                onChange={e => setCompForm(f => ({ ...f, source: e.target.value }))}
                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <textarea
                placeholder="Notes"
                value={compForm.notes_text}
                onChange={e => setCompForm(f => ({ ...f, notes_text: e.target.value }))}
                rows={2}
                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => addCompMutation.mutate(compForm)}
                disabled={addCompMutation.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {addCompMutation.isPending ? "Saving…" : "Save Comp"}
              </button>
              <button
                onClick={() => { setShowAddComp(false); setCompForm(EMPTY_COMP); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
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
