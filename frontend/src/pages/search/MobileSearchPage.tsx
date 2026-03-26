import React, { useState } from "react";
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
                <button key={l.id} onClick={() => navigate(`/broker-listings`)}
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
