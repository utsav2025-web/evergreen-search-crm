import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, RefreshCw, Download, Loader2, AlertCircle, CheckCircle2, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealScoreRadarChart } from "./DealScoreRadarChart";
import { DealScoreCategoryRow } from "./DealScoreCategoryRow";
import {
  useDealMemo,
  useRegenerateScore,
  useDownloadMemo,
  type DealScore,
} from "@/hooks/useDealScoring";

interface Props {
  companyId: number;
  companyName: string;
  onClose: () => void;
}

const CATEGORY_CONFIG = [
  { key: "financial_quality", label: "Financial Quality", max: 30, color: "#3b82f6" },
  { key: "business_quality", label: "Business Quality", max: 25, color: "#8b5cf6" },
  { key: "operator_fit", label: "Operator Fit", max: 20, color: "#10b981" },
  { key: "deal_structure", label: "Deal Structure", max: 15, color: "#f59e0b" },
  { key: "growth_potential", label: "Growth Potential", max: 10, color: "#ef4444" },
];

function RecommendationBadge({ rec }: { rec: DealScore["recommendation"] | undefined }) {
  if (!rec) return null;
  const config = {
    pursue: { icon: <CheckCircle2 size={12} />, label: "Pursue", className: "bg-emerald-100 text-emerald-800" },
    watch: { icon: <MinusCircle size={12} />, label: "Watch", className: "bg-amber-100 text-amber-800" },
    pass: { icon: <AlertCircle size={12} />, label: "Pass", className: "bg-red-100 text-red-800" },
  };
  const c = config[rec] ?? config.watch;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
}

export function MobileDealMemoSheet({ companyId, companyName, onClose }: Props) {
  const { data, isLoading } = useDealMemo(companyId);
  const regenerate = useRegenerateScore(companyId);
  const downloadMemo = useDownloadMemo(companyId);
  const [activeTab, setActiveTab] = useState<"score" | "memo">("score");

  // Swipe-down to close
  const startY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 80) onClose();
    startY.current = null;
  }

  const ds = data?.deal_score;
  const memo = data?.deal_memo;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Drag handle */}
      <div
        ref={sheetRef}
        className="flex flex-col h-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{companyName}</h2>
            <p className="text-xs text-slate-500">Deal Score & Memo</p>
          </div>
          <div className="flex items-center gap-2">
            {memo && (
              <Button variant="ghost" size="sm" onClick={downloadMemo} className="p-2">
                <Download size={16} />
              </Button>
            )}
            {ds && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
                className="p-2"
              >
                {regenerate.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-48 text-slate-400">
              <Loader2 className="animate-spin mr-2" size={20} />
              Loading…
            </div>
          )}

          {!isLoading && !ds && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6 text-slate-500">
              <div className="text-5xl mb-4">🎯</div>
              <p className="font-medium text-slate-700 mb-1">No deal score yet</p>
              <p className="text-sm">Go to the desktop view to run AI scoring.</p>
            </div>
          )}

          {!isLoading && ds && (
            <>
              {/* Score ring + recommendation */}
              <div className="flex flex-col items-center py-6 bg-slate-50 border-b border-slate-200">
                {/* Compact score display */}
                <div className="relative flex items-center justify-center w-20 h-20 mb-3">
                  {(() => {
                    const radius = 32;
                    const circ = 2 * Math.PI * radius;
                    const offset = circ - (ds.composite_score / 100) * circ;
                    const color = ds.composite_score >= 70 ? "#10b981" : ds.composite_score >= 40 ? "#f59e0b" : "#ef4444";
                    return (
                      <svg width="80" height="80" className="-rotate-90">
                        <circle cx="40" cy="40" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="7" />
                        <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="7"
                          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
                      </svg>
                    );
                  })()}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-800">{ds.composite_score}</span>
                    <span className="text-xs text-slate-500">/100</span>
                  </div>
                </div>
                <RecommendationBadge rec={ds.recommendation} />
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
                {(["score", "memo"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-slate-500"
                    }`}
                  >
                    {tab === "score" ? "Score" : "Memo"}
                  </button>
                ))}
              </div>

              {/* Score tab */}
              {activeTab === "score" && (
                <div className="px-4 py-4 flex flex-col gap-3">
                  <DealScoreRadarChart score={ds} compact />
                  <div className="flex flex-col gap-2">
                    {CATEGORY_CONFIG.map(({ key, label, max, color }) => {
                      const cat = ds[key as keyof DealScore] as
                        | { score: number; max: number; justification: string }
                        | undefined;
                      if (!cat) return null;
                      return (
                        <DealScoreCategoryRow
                          key={key}
                          label={label}
                          score={cat.score}
                          max={max}
                          justification={cat.justification}
                          color={color}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Memo tab */}
              {activeTab === "memo" && (
                <div className="px-4 py-4">
                  {memo ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 text-sm py-8">No deal memo generated yet.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
