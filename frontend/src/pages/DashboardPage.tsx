import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  total_prospects: number;
  active_pipeline: number;
  ndas_out: number;
  lois_submitted: number;
  calls_this_week: number;
}

interface StageCount {
  stage: string;
  count: number;
  label: string;
  color: string;
}

interface RecentListing {
  id: number;
  business_name: string;
  asking_price?: number;
  industry?: string;
  state?: string;
  created_at: string;
}

interface FollowUp {
  id: number;
  company_name: string;
  due_date: string;
  type: string;
}

interface ActivityItem {
  id: number;
  actor_name: string;
  action_type: string;
  description: string;
  created_at: string;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  lead:      { label: "Lead",      color: "bg-slate-400"  },
  prospect:  { label: "Prospect",  color: "bg-blue-400"   },
  contacted: { label: "Contacted", color: "bg-indigo-400" },
  nda:       { label: "NDA",       color: "bg-violet-500" },
  cim:       { label: "CIM",       color: "bg-purple-500" },
  model:     { label: "Model",     color: "bg-amber-500"  },
  ioi:       { label: "IOI",       color: "bg-orange-500" },
  loi:       { label: "LOI",       color: "bg-rose-500"   },
  diligence: { label: "Diligence", color: "bg-green-500"  },
};

const STAGE_ORDER = ["lead","prospect","contacted","nda","cim","model","ioi","loi","diligence"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n?: number): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg ${accent} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Svg({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// ─── Quick-Add Widget ─────────────────────────────────────────────────────────

function QuickAddWidget() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/quick-add/company", { name: name.trim(), url: url.trim() || undefined });
      setResult({ ok: true, msg: `Added: ${res.data.company_name}` });
      setName(""); setUrl("");
      setTimeout(() => navigate(`/companies/${res.data.company_id}`), 1200);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } };
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === "object" ? detail?.message : detail;
      setResult({ ok: false, msg: msg ?? "Failed to add company" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-slate-800 font-semibold text-sm mb-4">Quick-Add Company</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text" placeholder="Company name *" value={name}
          onChange={(e) => setName(e.target.value)} required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text" placeholder="Website URL (optional)" value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit" disabled={loading || !name.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {loading ? "Adding..." : "Add to Pipeline"}
        </button>
      </form>
      {result && (
        <p className={`mt-3 text-xs ${result.ok ? "text-green-600" : "text-red-500"}`}>{result.msg}</p>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [stages, setStages] = useState<StageCount[]>([]);
  const [listings, setListings] = useState<RecentListing[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, actRes] = await Promise.all([
          api.get("/dashboard/summary").catch(() => ({ data: {} })),
          api.get("/activity?limit=8").catch(() => ({ data: [] })),
        ]);
        const d = dashRes.data;
        setKpi({
          total_prospects: d.total_companies ?? d.total_prospects ?? 0,
          active_pipeline: d.active_pipeline ?? d.pipeline_count ?? 0,
          ndas_out: d.ndas_out ?? d.nda_count ?? 0,
          lois_submitted: d.lois_submitted ?? d.loi_count ?? 0,
          calls_this_week: d.calls_this_week ?? 0,
        });
        const rawStages: Record<string, number> = d.pipeline_by_stage ?? d.stage_counts ?? d.stages ?? {};
        setStages(STAGE_ORDER.map((s) => ({
          stage: s,
          count: rawStages[s] ?? 0,
          label: STAGE_CONFIG[s]?.label ?? s,
          color: STAGE_CONFIG[s]?.color ?? "bg-slate-400",
        })));
        setListings(d.recent_listings ?? []);
        setFollowUps(d.follow_ups_due ?? []);
        setActivity(Array.isArray(actRes.data) ? actRes.data : actRes.data?.items ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalPipeline = stages.reduce((s, c) => s + c.count, 0) || 1;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting()}, {user?.display_name ?? "there"} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Here's what's happening with your deal flow today.</p>
      </div>

      {/* ── Row 1: 5 KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Total Prospects" value={kpi?.total_prospects ?? 0}
          icon={<Svg d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
          accent="bg-blue-600" />
        <KpiCard label="Active Pipeline" value={kpi?.active_pipeline ?? 0} sub="NDA through Diligence"
          icon={<Svg d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />}
          accent="bg-indigo-600" />
        <KpiCard label="NDAs Out" value={kpi?.ndas_out ?? 0}
          icon={<Svg d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
          accent="bg-violet-600" />
        <KpiCard label="LOIs Submitted" value={kpi?.lois_submitted ?? 0}
          icon={<Svg d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />}
          accent="bg-rose-600" />
        <KpiCard label="Calls This Week" value={kpi?.calls_this_week ?? 0}
          icon={<Svg d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />}
          accent="bg-emerald-600" />
      </div>

      {/* ── Row 2: Pipeline Summary Bar ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-sm">Pipeline by Stage</h3>
          <button onClick={() => navigate("/pipeline")} className="text-blue-600 hover:text-blue-700 text-xs font-medium">
            View Kanban →
          </button>
        </div>
        <div className="flex rounded-full overflow-hidden h-3 mb-4 bg-slate-100">
          {stages.filter((s) => s.count > 0).map((s) => (
            <div key={s.stage} className={`${s.color} transition-all`}
              style={{ width: `${(s.count / totalPipeline) * 100}%` }}
              title={`${s.label}: ${s.count}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {stages.map((s) => (
            <button key={s.stage} onClick={() => navigate(`/pipeline?stage=${s.stage}`)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className={`w-2.5 h-2.5 rounded-full ${s.color} flex-shrink-0`} />
              <span className="text-slate-600 text-xs">{s.label}</span>
              <span className="text-slate-400 text-xs font-medium">{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 3: 4-Widget Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Quick-Add */}
        <QuickAddWidget />

        {/* New Listings This Week */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-800 font-semibold text-sm">New Listings This Week</h3>
            <button onClick={() => navigate("/broker-listings")} className="text-blue-600 text-xs hover:underline">All →</button>
          </div>
          {listings.length === 0 ? (
            <p className="text-slate-400 text-xs">No new listings this week.</p>
          ) : (
            <ul className="space-y-3">
              {listings.slice(0, 4).map((l) => (
                <li key={l.id} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-slate-700 text-xs font-medium truncate">{l.business_name}</p>
                    <p className="text-slate-400 text-xs">
                      {l.asking_price ? fmt(l.asking_price) : l.industry ?? "—"}
                      {l.state ? ` · ${l.state}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Follow-ups Due */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-800 font-semibold text-sm">Follow-ups Due</h3>
            <button onClick={() => navigate("/outreach")} className="text-blue-600 text-xs hover:underline">All →</button>
          </div>
          {followUps.length === 0 ? (
            <p className="text-slate-400 text-xs">No follow-ups due. You're all caught up.</p>
          ) : (
            <ul className="space-y-3">
              {followUps.slice(0, 4).map((f) => (
                <li key={f.id} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-slate-700 text-xs font-medium truncate">{f.company_name}</p>
                    <p className="text-slate-400 text-xs capitalize">{f.type} · {f.due_date}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-slate-800 font-semibold text-sm mb-3">Activity Feed</h3>
          {activity.length === 0 ? (
            <p className="text-slate-400 text-xs">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-slate-500 text-[9px] font-bold">
                      {(a.actor_name ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-700 text-xs leading-snug line-clamp-2">{a.description}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
