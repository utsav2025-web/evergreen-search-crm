import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  useEnrichCompany,
  useEnrichmentLog,
  useEnrichmentScore,
  EnrichmentSourceResult,
  EnrichmentLogEntry,
} from "@/hooks/useEnrichment";
import { EnrichmentScoreBadge } from "./EnrichmentScoreBadge";

// ── Source metadata ────────────────────────────────────────────────────────────

const SOURCE_META: Record<
  string,
  { label: string; icon: string; description: string; color: string }
> = {
  edgar: {
    label: "SEC EDGAR",
    icon: "🏛️",
    description: "Entity type, state of incorporation, filing history",
    color: "bg-blue-50 border-blue-200",
  },
  opencorporates: {
    label: "OpenCorporates",
    icon: "🏢",
    description: "Registered address, agent, incorporation date",
    color: "bg-purple-50 border-purple-200",
  },
  google_places: {
    label: "Google Places",
    icon: "📍",
    description: "Address, phone, website, category, rating",
    color: "bg-green-50 border-green-200",
  },
  web_search: {
    label: "Web Search + AI",
    icon: "🔍",
    description: "Revenue, employees, owner, description via Claude",
    color: "bg-amber-50 border-amber-200",
  },
  linkedin_snippet: {
    label: "LinkedIn",
    icon: "💼",
    description: "Employee count and description from search snippet",
    color: "bg-sky-50 border-sky-200",
  },
  clearbit: {
    label: "Clearbit",
    icon: "⚡",
    description: "Industry, revenue range, tech stack, social profiles",
    color: "bg-rose-50 border-rose-200",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SourceCard({
  source,
  result,
  isRunning,
}: {
  source: string;
  result?: EnrichmentSourceResult | EnrichmentLogEntry;
  isRunning: boolean;
}) {
  const meta = SOURCE_META[source] || {
    label: source,
    icon: "🔧",
    description: "",
    color: "bg-gray-50 border-gray-200",
  };
  const [expanded, setExpanded] = useState(false);

  const fieldsFound =
    (result as EnrichmentSourceResult)?.fields_actually_updated ||
    result?.fields_found ||
    [];
  const fieldsMissing = result?.fields_missing || [];
  const success = result?.success;
  const errorMsg = result?.error_message;
  const durationMs = result?.duration_ms;

  return (
    <div
      className={cn(
        "border rounded-lg p-3 transition-all",
        meta.color,
        isRunning && "animate-pulse"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900">
                {meta.label}
              </span>
              {isRunning && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                  <svg
                    className="animate-spin h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Running…
                </span>
              )}
              {!isRunning && result && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-medium",
                    success
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {success ? `+${fieldsFound.length} fields` : "Failed"}
                </span>
              )}
              {!isRunning && !result && (
                <span className="text-xs text-gray-400">Pending</span>
              )}
            </div>
            <p className="text-xs text-gray-500">{meta.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {durationMs && (
            <span className="text-xs text-gray-400">{durationMs}ms</span>
          )}
          {result && (fieldsFound.length > 0 || fieldsMissing.length > 0) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </div>
      </div>

      {expanded && result && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          {errorMsg && (
            <div className="text-xs text-red-600 bg-red-50 rounded p-2">
              {errorMsg}
            </div>
          )}
          {fieldsFound.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                Fields populated:
              </p>
              <div className="flex flex-wrap gap-1">
                {fieldsFound.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {fieldsMissing.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                Not found:
              </p>
              <div className="flex flex-wrap gap-1">
                {fieldsMissing.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main EnrichmentPanel ──────────────────────────────────────────────────────

interface EnrichmentPanelProps {
  companyId: number;
  companyName: string;
  currentScore?: number;
}

export function EnrichmentPanel({
  companyId,
  companyName,
  currentScore = 0,
}: EnrichmentPanelProps) {
  const [runResults, setRunResults] = useState<EnrichmentSourceResult[] | null>(
    null
  );
  const [isEnriching, setIsEnriching] = useState(false);
  const [currentSource, setCurrentSource] = useState<string | null>(null);

  const enrichMutation = useEnrichCompany(companyId);
  const { data: logData } = useEnrichmentLog(companyId);
  const { data: scoreData } = useEnrichmentScore(companyId);

  const displayScore = scoreData?.enrichment_score ?? currentScore;
  const sources = Object.keys(SOURCE_META);

  // Get the latest log entry per source
  const latestLogBySource: Record<string, EnrichmentLogEntry> = {};
  if (logData?.logs) {
    for (const log of logData.logs) {
      if (!latestLogBySource[log.source]) {
        latestLogBySource[log.source] = log;
      }
    }
  }

  const handleEnrich = async () => {
    setIsEnriching(true);
    setRunResults(null);

    // Simulate per-source progress by cycling through source names
    // (actual pipeline runs server-side sequentially)
    let sourceIdx = 0;
    const interval = setInterval(() => {
      if (sourceIdx < sources.length) {
        setCurrentSource(sources[sourceIdx]);
        sourceIdx++;
      } else {
        clearInterval(interval);
      }
    }, 800);

    try {
      const result = await enrichMutation.mutateAsync();
      clearInterval(interval);
      setCurrentSource(null);
      setRunResults(result.sources);
    } catch (err) {
      clearInterval(interval);
      setCurrentSource(null);
    } finally {
      setIsEnriching(false);
    }
  };

  // Build display results: prefer live run results, fall back to log
  const getSourceResult = (
    source: string
  ): EnrichmentSourceResult | EnrichmentLogEntry | undefined => {
    if (runResults) {
      return runResults.find((r) => r.source === source);
    }
    return latestLogBySource[source];
  };

  const totalFieldsFilled = runResults
    ? runResults.reduce((sum, r) => sum + (r.fields_actually_updated?.length || 0), 0)
    : logData?.logs?.length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <EnrichmentScoreBadge score={displayScore} size="lg" showLabel />
          <div>
            <h3 className="font-semibold text-gray-900">Data Enrichment</h3>
            <p className="text-sm text-gray-500">
              {isEnriching
                ? "Running enrichment pipeline…"
                : runResults
                ? `${totalFieldsFilled} fields filled this run`
                : logData?.logs?.length
                ? `Last run: ${new Date(logData.logs[0]?.run_at).toLocaleDateString()}`
                : "No enrichment data yet"}
            </p>
          </div>
        </div>

        <button
          onClick={handleEnrich}
          disabled={isEnriching}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            isEnriching
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          )}
        >
          {isEnriching ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Enriching…
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Enrich Company
            </>
          )}
        </button>
      </div>

      {/* Source cards */}
      <div className="grid gap-2">
        {sources.map((source) => (
          <SourceCard
            key={source}
            source={source}
            result={getSourceResult(source)}
            isRunning={isEnriching && currentSource === source}
          />
        ))}
      </div>

      {/* Field coverage grid */}
      {scoreData?.field_coverage && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Field Coverage
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {Object.entries(scoreData.field_coverage).map(([field, hasValue]) => (
              <div
                key={field}
                className={cn(
                  "text-xs px-2 py-1 rounded flex items-center gap-1",
                  hasValue
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-50 text-gray-400"
                )}
              >
                <span>{hasValue ? "✓" : "○"}</span>
                <span className="truncate">{field.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnrichmentPanel;
