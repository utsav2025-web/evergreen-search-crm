import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface BrokerListing {
  id: number;
  business_name: string | null;
  broker_site: string | null;
  listing_url: string | null;
  asking_price: number | null;
  revenue: number | null;
  ebitda: number | null;
  cash_flow: number | null;
  industry: string | null;
  industry_priority: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  description: string | null;
  employees: number | null;
  years_in_business: number | null;
  broker_name: string | null;
  broker_email: string | null;
  broker_phone: string | null;
  sba_eligible: boolean | null;
  acquisition_tag: string | null;
  is_new: boolean;
  date_listed: string | null;
  date_scraped: string | null;
  matched_company_id: number | null;
  matched_company_name: string | null;
  status: string;
  created_at: string;
  raw_data?: { inbound_email_id?: number; source?: string; [key: string]: unknown } | null;
}

interface Company {
  id: number;
  name: string;
}

const ACQUISITION_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  platform:       { label: "Platform",       color: "bg-purple-100 text-purple-800 border border-purple-300", desc: "EBITDA > $1.5M" },
  bolt_on:        { label: "Bolt-On",        color: "bg-blue-100 text-blue-800 border border-blue-300",   desc: "EBITDA $500K–$1.5M" },
  owner_operator: { label: "Owner-Operator", color: "bg-gray-100 text-gray-600 border border-gray-300",   desc: "EBITDA < $500K" },
  unknown:        { label: "Unclassified",   color: "bg-yellow-50 text-yellow-700 border border-yellow-200", desc: "Profit not listed" },
};

const STATUS_COLORS: Record<string, string> = {
  new:        "bg-blue-100 text-blue-700",
  reviewed:   "bg-gray-100 text-gray-600",
  interested: "bg-green-100 text-green-700",
  passed:     "bg-red-100 text-red-700",
  matched:    "bg-purple-100 text-purple-700",
};

const SOURCE_ICONS: Record<string, string> = {
  bizbuysell: "🏪",
  dealstream:  "📊",
  "acquire.com": "🎯",
  axial:       "⚡",
  manual:      "✍️",
};

const fmt = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

const fmtMultiple = (asking: number | null | undefined, ebitda: number | null | undefined, cashFlow: number | null | undefined) => {
  const profit = ebitda || cashFlow;
  if (!asking || !profit) return null;
  return `${(asking / profit).toFixed(1)}x`;
};

export default function BrokerListingsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [matchingId, setMatchingId] = useState<number | null>(null);
  const [matchCompanyId, setMatchCompanyId] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const { data, isLoading } = useQuery({
    queryKey: ["broker-listings", filterStatus, filterTag, filterPriority],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterTag) params.set("acquisition_tag", filterTag);
      if (filterPriority) params.set("industry_priority", filterPriority);
      return api.get(`/broker-listings?${params}`).then(r => r.data);
    },
  });

  const { data: companiesData } = useQuery({
    queryKey: ["companies-simple"],
    queryFn: () => api.get("/companies?limit=200").then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      api.patch(`/broker-listings/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broker-listings"] }),
  });

  const matchMutation = useMutation({
    mutationFn: ({ id, companyId }: { id: number; companyId: number }) =>
      api.post(`/broker-listings/${id}/match`, { company_id: companyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-listings"] });
      setMatchingId(null);
      setMatchCompanyId("");
    },
  });

  const listings: BrokerListing[] = data?.items || data || [];
  const companies: Company[] = companiesData?.items || companiesData || [];

  // Summary stats
  const platformCount  = listings.filter(l => l.acquisition_tag === "platform").length;
  const boltOnCount    = listings.filter(l => l.acquisition_tag === "bolt_on").length;
  const priorityCount  = listings.filter(l => l.industry_priority === "priority").length;
  const newCount       = listings.filter(l => l.is_new).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broker Listings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Business-for-sale listings scraped from broker marketplaces
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-600"
          >
            {viewMode === "cards" ? "📋 Table View" : "🃏 Card View"}
          </button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Listings", value: listings.length, color: "text-gray-900" },
          { label: "New / Unreviewed", value: newCount, color: "text-blue-600" },
          { label: "Platform Candidates", value: platformCount, color: "text-purple-600" },
          { label: "Priority Industries", value: priorityCount, color: "text-green-600" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl border p-4">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="interested">Interested</option>
          <option value="passed">Passed</option>
          <option value="matched">Matched</option>
        </select>

        <select
          value={filterTag}
          onChange={e => setFilterTag(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">All Acquisition Types</option>
          <option value="platform">Platform (EBITDA &gt; $1.5M)</option>
          <option value="bolt_on">Bolt-On ($500K–$1.5M)</option>
          <option value="owner_operator">Owner-Operator (&lt; $500K)</option>
          <option value="unknown">Unclassified</option>
        </select>

        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">All Industries</option>
          <option value="priority">Priority Industries</option>
          <option value="non_priority">Non-Priority</option>
        </select>

        {(filterStatus || filterTag || filterPriority) && (
          <button
            onClick={() => { setFilterStatus(""); setFilterTag(""); setFilterPriority(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading listings…</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-medium">No listings found</div>
          <div className="text-sm mt-1">Run the scraper from Settings to populate this list</div>
        </div>
      ) : viewMode === "table" ? (
        /* ── Table View ── */
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Business</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Industry</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">EBITDA / CF</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Asking</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Multiple</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Employees</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Yrs Est.</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {listings.map(l => {
                const tag = ACQUISITION_CONFIG[l.acquisition_tag || "unknown"];
                const multiple = fmtMultiple(l.asking_price, l.ebitda, l.cash_flow);
                const geo = [l.city, l.state].filter(Boolean).join(", ") || l.location || "—";
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {l.is_new && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        <div>
                          <div className="font-medium text-gray-900 truncate max-w-[200px]">
                            {l.business_name || "Unnamed Listing"}
                          </div>
                          {l.listing_url && (
                            <a href={l.listing_url} target="_blank" rel="noopener noreferrer"
                               className="text-xs text-blue-500 hover:underline">
                              View listing ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 truncate max-w-[120px]">{l.industry || "—"}</div>
                      {l.industry_priority === "priority" && (
                        <span className="text-xs text-green-600 font-medium">★ Priority</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{geo}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(l.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {fmt(l.ebitda || l.cash_flow)}
                      {l.cash_flow && !l.ebitda && <span className="text-xs text-gray-400 ml-1">SDE</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{fmt(l.asking_price)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{multiple || "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{l.employees ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{l.years_in_business ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tag.color}`}>
                        {tag.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || STATUS_COLORS.new}`}>
                        {l.status || "new"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-lg">
                      {SOURCE_ICONS[l.broker_site || ""] || "🔗"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Card View ── */
        <div className="space-y-3">
          {listings.map(l => {
            const tag = ACQUISITION_CONFIG[l.acquisition_tag || "unknown"];
            const multiple = fmtMultiple(l.asking_price, l.ebitda, l.cash_flow);
            const geo = [l.city, l.state, l.country !== "United States" ? l.country : null]
              .filter(Boolean).join(", ") || l.location || null;
            const isExpanded = expandedId === l.id;

            return (
              <div key={l.id} className="bg-white rounded-xl border hover:shadow-sm transition-shadow">
                {/* Card header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {l.is_new && (
                        <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {l.business_name || "Unnamed Listing"}
                          </h3>
                          {/* Acquisition tag */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tag.color}`}
                                title={tag.desc}>
                            {tag.label}
                          </span>
                          {/* Industry priority */}
                          {l.industry_priority === "priority" && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-200">
                              ★ Priority Industry
                            </span>
                          )}
                          {/* Status */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || STATUS_COLORS.new}`}>
                            {l.status || "new"}
                          </span>
                        </div>

                        {/* Industry + Location */}
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                          {l.industry && <span>🏭 {l.industry}</span>}
                          {geo && <span>📍 {geo}</span>}
                          {l.sba_eligible && <span className="text-green-600 font-medium">✓ SBA Eligible</span>}
                          <span className="text-gray-400">
                            {SOURCE_ICONS[l.broker_site || ""] || "🔗"} {l.broker_site || "unknown"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div className="flex gap-4 text-right flex-shrink-0">
                      <div>
                        <div className="text-xs text-gray-400">Revenue</div>
                        <div className="font-mono font-medium text-gray-700">{fmt(l.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">{l.ebitda ? "EBITDA" : "Cash Flow"}</div>
                        <div className="font-mono font-medium text-gray-700">{fmt(l.ebitda || l.cash_flow)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Asking</div>
                        <div className="font-mono font-bold text-gray-900">{fmt(l.asking_price)}</div>
                        {multiple && (
                          <div className="text-xs text-gray-400">{multiple} multiple</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Business details row */}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    {l.employees != null && <span>👥 {l.employees} employees</span>}
                    {l.years_in_business != null && <span>📅 {l.years_in_business} yrs in business</span>}
                    {l.broker_name && <span>🤝 {l.broker_name}</span>}
                    {l.date_listed && (
                      <span>Listed {formatDistanceToNow(new Date(l.date_listed), { addSuffix: true })}</span>
                    )}
                  </div>

                  {/* Description preview */}
                  {l.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{l.description}</p>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    {l.listing_url && (
                      <a href={l.listing_url} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-blue-600 hover:underline">
                        View listing ↗
                      </a>
                    )}
                    {l.raw_data?.inbound_email_id && (
                      <a href={`/email-ingest?highlight=${l.raw_data.inbound_email_id}`}
                         className="text-xs text-indigo-600 hover:underline">
                        ✉ View original email
                      </a>
                    )}

                    <WriteGuard>
                      <div className="flex gap-2 ml-auto">
                        {/* Status quick-change */}
                        <select
                          value={l.status || "new"}
                          onChange={e => updateMutation.mutate({ id: l.id, updates: { status: e.target.value } })}
                          className="text-xs border rounded px-2 py-1 bg-white"
                        >
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="interested">Interested</option>
                          <option value="passed">Passed</option>
                          <option value="matched">Matched</option>
                        </select>

                        {/* Expand / collapse */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : l.id)}
                          className="text-xs px-3 py-1 border rounded hover:bg-gray-50"
                        >
                          {isExpanded ? "▲ Less" : "▼ More"}
                        </button>

                        {/* Match to pipeline */}
                        {matchingId === l.id ? (
                          <div className="flex gap-1">
                            <select
                              value={matchCompanyId}
                              onChange={e => setMatchCompanyId(e.target.value)}
                              className="text-xs border rounded px-2 py-1 bg-white"
                            >
                              <option value="">Select company…</option>
                              {companies.map((c: Company) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => matchCompanyId && matchMutation.mutate({
                                id: l.id, companyId: parseInt(matchCompanyId)
                              })}
                              disabled={!matchCompanyId}
                              className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                            >
                              Link
                            </button>
                            <button
                              onClick={() => setMatchingId(null)}
                              className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setMatchingId(l.id)}
                            className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            + Add to Pipeline
                          </button>
                        )}
                      </div>
                    </WriteGuard>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t bg-gray-50 rounded-b-xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Full Location</div>
                        <div className="text-gray-700">
                          {[l.city, l.state, l.country].filter(Boolean).join(", ") || l.location || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Employees</div>
                        <div className="text-gray-700">{l.employees ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Years in Business</div>
                        <div className="text-gray-700">{l.years_in_business ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">SBA Eligible</div>
                        <div className="text-gray-700">
                          {l.sba_eligible == null ? "—" : l.sba_eligible ? "Yes ✓" : "No"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Broker</div>
                        <div className="text-gray-700">{l.broker_name || "—"}</div>
                        {l.broker_email && (
                          <div className="text-xs text-blue-500">{l.broker_email}</div>
                        )}
                        {l.broker_phone && (
                          <div className="text-xs text-gray-500">{l.broker_phone}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Acquisition Type</div>
                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACQUISITION_CONFIG[l.acquisition_tag || "unknown"].color}`}>
                            {ACQUISITION_CONFIG[l.acquisition_tag || "unknown"].label}
                          </span>
                          <div className="text-xs text-gray-400 mt-1">
                            {ACQUISITION_CONFIG[l.acquisition_tag || "unknown"].desc}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Date Listed</div>
                        <div className="text-gray-700">
                          {l.date_listed ? new Date(l.date_listed).toLocaleDateString() : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Date Scraped</div>
                        <div className="text-gray-700">
                          {l.date_scraped ? new Date(l.date_scraped).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    </div>
                    {l.description && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Full Description</div>
                        <p className="text-sm text-gray-700 leading-relaxed">{l.description}</p>
                      </div>
                    )}
                    {l.matched_company_name && (
                      <div className="mt-3 p-2 bg-purple-50 rounded-lg text-sm text-purple-700">
                        ✓ Matched to pipeline: <strong>{l.matched_company_name}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
