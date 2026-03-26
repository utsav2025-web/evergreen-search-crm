import React from "react";
import { cn } from "@/lib/utils";

interface EnrichmentScoreBadgeProps {
  score?: number | null;
  companyId?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

function getScoreColor(score: number): {
  ring: string;
  text: string;
  bg: string;
  label: string;
} {
  if (score >= 70) {
    return {
      ring: "stroke-emerald-500",
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      label: "High",
    };
  } else if (score >= 40) {
    return {
      ring: "stroke-amber-400",
      text: "text-amber-600",
      bg: "bg-amber-50",
      label: "Medium",
    };
  } else {
    return {
      ring: "stroke-red-400",
      text: "text-red-600",
      bg: "bg-red-50",
      label: "Low",
    };
  }
}

const SIZES = {
  sm: { svg: 40, r: 16, stroke: 3, textClass: "text-[10px]" },
  md: { svg: 56, r: 22, stroke: 4, textClass: "text-xs" },
  lg: { svg: 80, r: 32, stroke: 5, textClass: "text-sm font-semibold" },
};

export function EnrichmentScoreBadge({
  score,
  companyId: _companyId,
  size = "md",
  showLabel = false,
  compact = false,
  className,
}: EnrichmentScoreBadgeProps) {
  const resolvedScore = score ?? 0;
  const { svg, r, stroke, textClass } = SIZES[compact ? "sm" : size];
  const colors = getScoreColor(resolvedScore);
  const circumference = 2 * Math.PI * r;
  const filled = (resolvedScore / 100) * circumference;
  const center = svg / 2;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative inline-flex items-center justify-center">
        <svg width={svg} height={svg} className="-rotate-90">
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-200"
          />
          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${circumference - filled}`}
            strokeLinecap="round"
            className={cn("transition-all duration-700", colors.ring)}
          />
        </svg>
        <span
          className={cn(
            "absolute font-bold tabular-nums",
            textClass,
            colors.text
          )}
        >
          {resolvedScore}
        </span>
      </div>
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            colors.bg,
            colors.text
          )}
        >
          {colors.label}
        </span>
      )}
    </div>
  );
}

export default EnrichmentScoreBadge;
