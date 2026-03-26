import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Target, Save, RefreshCw, TrendingUp, DollarSign,
  MapPin, Building2, Clock, ChevronRight, CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

interface ThesisConfig {
  id?: number;
  ebitda_min: number;
  ebitda_max: number;
  revenue_min: number;
  revenue_max: number;
  ebitda_margin_min: number;
  gross_margin_min: number;
  max_ev_ebitda_multiple: number;
  min_ev_ebitda_multiple: number;
  target_industries: string[];
  excluded_industries: string[];
  target_states: string[];
  min_years_in_business: number;
  max_employees: number;
  stall_lead_days: number;
  stall_prospect_days: number;
  stall_contacted_days: number;
  stall_nda_days: number;
  stall_cim_days: number;
  stall_model_days: number;
  stall_ioi_days: number;
  stall_loi_days: number;
  stall_dd_days: number;
  updated_at?: string;
  updated_by?: string;
}

interface Leaderboard {
  total: number;
  items: {
    id: number; name: string; industry: string; state: string;
    deal_stage: string; thesis_score: number; thesis_flags: string[];
    ebitda: number | null; annual_revenue: number | null; asking_price: number | null;
  }[];
}

function fmt(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function scoreColor(s: number) {
  if (s >= 70) return "text-emerald-700 bg-emerald-50";
  if (s >= 40) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

function TagInput({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px]">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="text-blue-400 hover:text-blue-700 leading-none">&times;</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Type and press Enter"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={add} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg">Add</button>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, prefix = "", suffix = "", step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
        {prefix && <span className="px-2 py-1.5 bg-slate-50 text-slate-500 text-sm border-r border-slate-200">{prefix}</span>}
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 px-3 py-1.5 text-sm focus:outline-none"
        />
        {suffix && <span className="px-2 py-1.5 bg-slate-50 text-slate-500 text-sm border-l border-slate-200">{suffix}</span>}
      </div>
    </div>
  );
}

export default function ThesisPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ThesisConfig | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/thesis/config").then(r => setConfig(r.data)).catch(() => setError("Failed to load thesis config"));
    api.get("/thesis/leaderboard?limit=10").then(r => setLeaderboard(r.data)).catch(() => {});
  }, []);

  function update<K extends keyof ThesisConfig>(key: K, value: ThesisConfig[K]) {
    setConfig(prev => prev ? { ...prev, [key]: value } : prev);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.put("/thesis/config", config);
      setConfig(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function rescore() {
    setRescoring(true);
    try {
      const r = await api.post("/thesis/score/bulk");
      const lb = await api.get("/thesis/leaderboard?limit=10");
      setLeaderboard(lb.data);
      alert(`Re-scored ${r.data.scored} companies against current thesis.`);
    } catch {
      setError("Re-score failed");
    } finally {
      setRescoring(false);
    }
  }

  if (!config) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Loading thesis configuration…</div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            Investment Thesis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Define your acquisition criteria. Every lead is automatically scored against these parameters.
          </p>
          {config.updated_at && (
            <p className="text-xs text-slate-400 mt-0.5">
              Last updated {new Date(config.updated_at).toLocaleDateString()} by {config.updated_by || "system"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={rescore} disabled={rescoring}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${rescoring ? "animate-spin" : ""}`} />
            Re-score All
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saved ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save Thesis"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Parameters */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />Financial Parameters
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="EBITDA Min" value={config.ebitda_min / 1e6} onChange={v => update("ebitda_min", v * 1e6)} prefix="$" suffix="M" step={0.1} />
            <NumberInput label="EBITDA Max" value={config.ebitda_max / 1e6} onChange={v => update("ebitda_max", v * 1e6)} prefix="$" suffix="M" step={0.1} />
            <NumberInput label="Revenue Min" value={config.revenue_min / 1e6} onChange={v => update("revenue_min", v * 1e6)} prefix="$" suffix="M" step={0.5} />
            <NumberInput label="Revenue Max" value={config.revenue_max / 1e6} onChange={v => update("revenue_max", v * 1e6)} prefix="$" suffix="M" step={0.5} />
            <NumberInput label="Min EBITDA Margin" value={Math.round(config.ebitda_margin_min * 100)} onChange={v => update("ebitda_margin_min", v / 100)} suffix="%" step={1} />
            <NumberInput label="Min Gross Margin" value={Math.round(config.gross_margin_min * 100)} onChange={v => update("gross_margin_min", v / 100)} suffix="%" step={1} />
            <NumberInput label="Min EV/EBITDA" value={config.min_ev_ebitda_multiple} onChange={v => update("min_ev_ebitda_multiple", v)} suffix="x" step={0.5} />
            <NumberInput label="Max EV/EBITDA" value={config.max_ev_ebitda_multiple} onChange={v => update("max_ev_ebitda_multiple", v)} suffix="x" step={0.5} />
          </div>
        </div>

        {/* Business Profile */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />Business Profile
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Min Years in Business" value={config.min_years_in_business} onChange={v => update("min_years_in_business", v)} step={1} />
            <NumberInput label="Max Employees" value={config.max_employees} onChange={v => update("max_employees", v)} step={10} />
          </div>
          <TagInput label="Target Industries" values={config.target_industries} onChange={v => update("target_industries", v)} />
          <TagInput label="Excluded Industries" values={config.excluded_industries} onChange={v => update("excluded_industries", v)} />
        </div>

        {/* Geography */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />Geography
          </h2>
          <TagInput
            label="Target States (2-letter codes, e.g. TX, FL)"
            values={config.target_states}
            onChange={v => update("target_states", v.map(s => s.toUpperCase().slice(0, 2)))}
          />
          <p className="text-xs text-slate-400">Leave empty to accept all US states.</p>
        </div>

        {/* Stall Thresholds */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />Stall Alerts (days)
          </h2>
          <p className="text-xs text-slate-500">Deals past these thresholds show a red alert on the Kanban board.</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Lead", "stall_lead_days"],
              ["Prospect", "stall_prospect_days"],
              ["Contacted", "stall_contacted_days"],
              ["NDA", "stall_nda_days"],
              ["CIM", "stall_cim_days"],
              ["Model", "stall_model_days"],
              ["IOI", "stall_ioi_days"],
              ["LOI", "stall_loi_days"],
              ["Diligence", "stall_dd_days"],
            ].map(([label, key]) => (
              <NumberInput
                key={key}
                label={label}
                value={(config as any)[key]}
                onChange={v => update(key as keyof ThesisConfig, v as any)}
                suffix="d"
                step={1}
                min={1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard && leaderboard.total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />Top Thesis Matches
            </h2>
            <button onClick={() => navigate("/companies")} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {leaderboard.items.map((item, i) => (
              <div
                key={item.id}
                onClick={() => navigate(`/companies/${item.id}`)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
              >
                <span className="text-sm font-bold text-slate-400 w-5 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500">{[item.industry, item.state, item.deal_stage].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">{fmt(item.ebitda)} EBITDA</p>
                  <p className="text-xs text-slate-400">{fmt(item.asking_price)} ask</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${scoreColor(item.thesis_score)}`}>
                  {Math.round(item.thesis_score)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
