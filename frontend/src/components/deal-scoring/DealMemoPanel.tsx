import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  RefreshCw,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DealScoreRadarChart } from "./DealScoreRadarChart";
import { DealScoreCategoryRow } from "./DealScoreCategoryRow";
import {
  useDealMemo,
  useTriggerScoring,
  useRegenerateScore,
  useUploadCIM,
  useDownloadMemo,
  type DealScore,
} from "@/hooks/useDealScoring";

interface Props {
  companyId: number;
  companyName: string;
}

const CATEGORY_CONFIG = [
  {
    key: "financial_quality",
    label: "Financial Quality",
    max: 30,
    color: "#3b82f6",
  },
  {
    key: "business_quality",
    label: "Business Quality",
    max: 25,
    color: "#8b5cf6",
  },
  {
    key: "operator_fit",
    label: "Operator Fit",
    max: 20,
    color: "#10b981",
  },
  {
    key: "deal_structure",
    label: "Deal Structure",
    max: 15,
    color: "#f59e0b",
  },
  {
    key: "growth_potential",
    label: "Growth Potential",
    max: 10,
    color: "#ef4444",
  },
];

function RecommendationBadge({
  rec,
}: {
  rec: DealScore["recommendation"] | undefined;
}) {
  if (!rec) return null;
  const config = {
    pursue: {
      icon: <CheckCircle2 size={14} />,
      label: "Pursue",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    watch: {
      icon: <MinusCircle size={14} />,
      label: "Watch",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
    pass: {
      icon: <AlertCircle size={14} />,
      label: "Pass",
      className: "bg-red-100 text-red-800 border-red-200",
    },
  };
  const c = config[rec] ?? config.watch;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.className}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" className="-rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-800">{score}</span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

export function DealMemoPanel({ companyId, companyName }: Props) {
  const { data, isLoading } = useDealMemo(companyId);
  const triggerScoring = useTriggerScoring(companyId);
  const regenerate = useRegenerateScore(companyId);
  const uploadCIM = useUploadCIM(companyId);
  const downloadMemo = useDownloadMemo(companyId);

  const [showMemo, setShowMemo] = useState(false);
  const [activeTab, setActiveTab] = useState<"score" | "memo">("score");

  const ds = data?.deal_score;
  const memo = data?.deal_memo;

  const isRunning =
    triggerScoring.isPending || regenerate.isPending;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadCIM.mutate(file);
    e.target.value = "";
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading deal score…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Deal Score & Memo</h3>
        <div className="flex items-center gap-2">
          {/* Upload CIM */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              asChild
            >
              <span>
                <Upload size={14} />
                {uploadCIM.isPending ? "Uploading…" : "Upload CIM"}
              </span>
            </Button>
          </label>

          {ds ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => regenerate.mutate()}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Regenerate
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => triggerScoring.mutate(undefined)}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {isRunning ? "Scoring…" : "Run AI Score"}
            </Button>
          )}

          {memo && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={downloadMemo}
            >
              <Download size={14} />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* Error display */}
      {(triggerScoring.isError || regenerate.isError) && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} />
          Scoring failed. Check that your OpenAI API key is configured.
        </div>
      )}

      {/* No score yet */}
      {!ds && !isRunning && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
          <div className="text-4xl mb-3">🎯</div>
          <p className="font-medium text-slate-700 mb-1">No deal score yet</p>
          <p className="text-sm">
            Upload a CIM or click "Run AI Score" to generate a score and deal memo.
          </p>
        </div>
      )}

      {/* Scoring in progress */}
      {isRunning && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
          <p className="font-medium text-slate-700">Analyzing deal…</p>
          <p className="text-sm text-slate-500 mt-1">
            Claude is evaluating all 5 scoring categories
          </p>
        </div>
      )}

      {/* Score content */}
      {ds && !isRunning && (
        <>
          {/* Score summary row */}
          <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <ScoreRing score={ds.composite_score} />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg font-bold text-slate-800">
                  {companyName}
                </span>
                <RecommendationBadge rec={ds.recommendation} />
              </div>
              <p className="text-sm text-slate-500">
                Scored {ds.scored_at ? new Date(ds.scored_at).toLocaleDateString() : "recently"} · {ds.model_used}
              </p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-slate-200">
            {(["score", "memo"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "score" ? "Score Breakdown" : "Deal Memo"}
              </button>
            ))}
          </div>

          {/* Score breakdown tab */}
          {activeTab === "score" && (
            <div className="flex flex-col gap-4">
              {/* Radar chart */}
              <DealScoreRadarChart score={ds} />

              {/* Category rows */}
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

          {/* Deal memo tab */}
          {activeTab === "memo" && memo && (
            <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-table:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo}</ReactMarkdown>
            </div>
          )}

          {activeTab === "memo" && !memo && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No deal memo generated yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}
