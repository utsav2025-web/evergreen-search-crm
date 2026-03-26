import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  useEnrichCompany,
  useEnrichmentLog,
  useEnrichmentScore,
  EnrichmentLogEntry,
} from "@/hooks/useEnrichment";
import { EnrichmentScoreBadge } from "./EnrichmentScoreBadge";

const SOURCE_ICONS: Record<string, string> = {
  edgar: "🏛️",
  opencorporates: "🏢",
  google_places: "📍",
  web_search: "🔍",
  linkedin_snippet: "💼",
  clearbit: "⚡",
};

const SOURCE_LABELS: Record<string, string> = {
  edgar: "SEC EDGAR",
  opencorporates: "OpenCorporates",
  google_places: "Google Places",
  web_search: "Web Search + AI",
  linkedin_snippet: "LinkedIn",
  clearbit: "Clearbit",
};

interface MobileEnrichmentSheetProps {
  companyId: number;
  companyName: string;
  currentScore?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileEnrichmentSheet({
  companyId,
  companyName,
  currentScore = 0,
  isOpen,
  onClose,
}: MobileEnrichmentSheetProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [runComplete, setRunComplete] = useState(false);

  const enrichMutation = useEnrichCompany(companyId);
  const { data: logData } = useEnrichmentLog(companyId);
  const { data: scoreData } = useEnrichmentScore(companyId);

  const displayScore = scoreData?.enrichment_score ?? currentScore;

  // Latest log per source
  const latestBySource: Record<string, EnrichmentLogEntry> = {};
  if (logData?.logs) {
    for (const log of logData.logs) {
      if (!latestBySource[log.source]) {
        latestBySource[log.source] = log;
      }
    }
  }

  const handleEnrich = async () => {
    setIsEnriching(true);
    setRunComplete(false);
    try {
      await enrichMutation.mutateAsync();
      setRunComplete(true);
    } finally {
      setIsEnriching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <EnrichmentScoreBadge score={displayScore} size="md" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Data Enrichment
              </h3>
              <p className="text-xs text-gray-500 truncate max-w-[180px]">
                {companyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {/* Score ring + field coverage mini-grid */}
          {scoreData?.field_coverage && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Field Coverage
              </p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(scoreData.field_coverage)
                  .slice(0, 12)
                  .map(([field, hasValue]) => (
                    <div
                      key={field}
                      className={cn(
                        "text-xs px-2 py-1 rounded flex items-center gap-1",
                        hasValue
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-white text-gray-400 border border-gray-100"
                      )}
                    >
                      <span>{hasValue ? "✓" : "○"}</span>
                      <span className="truncate">
                        {field.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Source breakdown */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Sources
          </p>
          {Object.keys(SOURCE_LABELS).map((source) => {
            const log = latestBySource[source];
            return (
              <div
                key={source}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  log?.success
                    ? "bg-emerald-50 border-emerald-200"
                    : log && !log.success
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-50 border-gray-200"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {SOURCE_ICONS[source] || "🔧"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {SOURCE_LABELS[source]}
                    </p>
                    {log && (
                      <p className="text-xs text-gray-500">
                        {log.success
                          ? `${log.fields_found.length} fields found`
                          : log.error_message || "No data found"}
                      </p>
                    )}
                    {!log && (
                      <p className="text-xs text-gray-400">Not yet run</p>
                    )}
                  </div>
                </div>

                {log && (
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        log.success
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      )}
                    >
                      {log.success ? `+${log.fields_found.length}` : "✗"}
                    </span>
                    {log.duration_ms && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {log.duration_ms}ms
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Last run info */}
          {logData?.logs?.[0] && (
            <p className="text-xs text-gray-400 text-center pt-1">
              Last enriched:{" "}
              {new Date(logData.logs[0].run_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Pinned Enrich button */}
        <div className="px-4 py-4 border-t border-gray-100 bg-white">
          {runComplete && (
            <div className="text-xs text-emerald-600 text-center mb-2 font-medium">
              ✓ Enrichment complete — score updated to {displayScore}
            </div>
          )}
          <button
            onClick={handleEnrich}
            disabled={isEnriching}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-semibold transition-all",
              isEnriching
                ? "bg-gray-100 text-gray-400"
                : "bg-blue-600 text-white active:bg-blue-700"
            )}
          >
            {isEnriching ? (
              <span className="flex items-center justify-center gap-2">
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
                Enriching from all sources…
              </span>
            ) : (
              "Enrich Company Data"
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Mobile company card with score ring ──────────────────────────────────────

interface MobileCompanyCardEnrichmentBadgeProps {
  companyId: number;
  companyName: string;
  score: number;
}

export function MobileCompanyCardEnrichmentBadge({
  companyId,
  companyName,
  score,
}: MobileCompanyCardEnrichmentBadgeProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSheetOpen(true);
        }}
        className="flex flex-col items-center"
        title="View enrichment details"
      >
        <EnrichmentScoreBadge score={score} size="sm" />
      </button>

      <MobileEnrichmentSheet
        companyId={companyId}
        companyName={companyName}
        currentScore={score}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

export default MobileEnrichmentSheet;
