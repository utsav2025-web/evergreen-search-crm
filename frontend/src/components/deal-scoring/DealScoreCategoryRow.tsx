import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CategoryRowProps {
  label: string;
  score: number;
  max: number;
  justification: string;
  color: string;
}

export function DealScoreCategoryRow({
  label,
  score,
  max,
  justification,
  color,
}: CategoryRowProps) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((score / max) * 100);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        {/* expand icon */}
        <span className="text-slate-400 flex-shrink-0">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        {/* label */}
        <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>

        {/* progress bar */}
        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>

        {/* score */}
        <span className="text-sm font-semibold text-slate-800 w-16 text-right flex-shrink-0">
          {score} / {max}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-200">
          <p className="text-sm text-slate-600 leading-relaxed">{justification}</p>
        </div>
      )}
    </div>
  );
}
