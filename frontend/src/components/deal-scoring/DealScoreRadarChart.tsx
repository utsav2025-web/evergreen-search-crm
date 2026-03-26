import React from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DealScore } from "@/hooks/useDealScoring";

interface Props {
  score: DealScore;
  compact?: boolean;
}

const CATEGORY_LABELS: Record<string, { label: string; max: number }> = {
  financial_quality: { label: "Financial", max: 30 },
  business_quality: { label: "Business", max: 25 },
  operator_fit: { label: "Operator Fit", max: 20 },
  deal_structure: { label: "Deal Structure", max: 15 },
  growth_potential: { label: "Growth", max: 10 },
};

function pct(cat: { score: number; max: number } | undefined): number {
  if (!cat) return 0;
  return Math.round((cat.score / cat.max) * 100);
}

export function DealScoreRadarChart({ score, compact = false }: Props) {
  const data = Object.entries(CATEGORY_LABELS).map(([key, { label, max }]) => {
    const cat = score[key as keyof DealScore] as
      | { score: number; max: number; justification: string }
      | undefined;
    return {
      subject: label,
      value: pct(cat),
      raw: cat?.score ?? 0,
      max,
      fullMark: 100,
    };
  });

  const height = compact ? 200 : 300;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: compact ? 10 : 12, fill: "#64748b" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickCount={5}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number, _name: string, props: { payload?: { raw: number; max: number } }) => [
            `${props.payload?.raw ?? 0} / ${props.payload?.max ?? 0} pts (${value}%)`,
            "Score",
          ]}
          contentStyle={{
            background: "#1e293b",
            border: "none",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 12,
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
