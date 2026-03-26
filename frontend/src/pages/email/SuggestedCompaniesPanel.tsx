import { X, Building2, CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useSuggestedCompanies,
  usePromoteSuggestion,
  useDismissSuggestion,
  SuggestedCompany,
} from "@/hooks/useEmail";

interface Props {
  onClose: () => void;
}

function formatMoney(val: number | null): string {
  if (!val) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function SuggestionCard({ suggestion }: { suggestion: SuggestedCompany }) {
  const promote = usePromoteSuggestion();
  const dismiss = useDismissSuggestion();

  return (
    <div className="border border-purple-100 rounded-lg p-4 bg-purple-50/30">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">{suggestion.name}</h4>
          {suggestion.industry && (
            <span className="text-xs text-gray-500">{suggestion.industry}</span>
          )}
        </div>
        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 gap-1 flex-shrink-0">
          <Sparkles className="w-3 h-3" />
          AI Suggested
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div>
          <span className="text-gray-500">Ask</span>
          <div className="font-medium text-gray-800">{formatMoney(suggestion.asking_price)}</div>
        </div>
        <div>
          <span className="text-gray-500">Revenue</span>
          <div className="font-medium text-gray-800">{formatMoney(suggestion.revenue)}</div>
        </div>
        <div>
          <span className="text-gray-500">EBITDA</span>
          <div className="font-medium text-gray-800">{formatMoney(suggestion.ebitda)}</div>
        </div>
      </div>

      {suggestion.broker_name && (
        <div className="text-xs text-gray-500 mb-3">
          Broker: <span className="font-medium text-gray-700">{suggestion.broker_name}</span>
          {suggestion.broker_email && ` · ${suggestion.broker_email}`}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => promote.mutate(suggestion.id)}
          disabled={promote.isPending}
          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white flex-1"
        >
          {promote.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Add to Pipeline
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => dismiss.mutate(suggestion.id)}
          disabled={dismiss.isPending}
          className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function SuggestedCompaniesPanel({ onClose }: Props) {
  const { data, isLoading } = useSuggestedCompanies();
  const suggestions = data?.items || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-gray-900">Suggested Companies</h2>
            <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">
              {data?.total || 0}
            </Badge>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-2.5 bg-purple-50 border-b border-purple-100 text-xs text-purple-800">
          These companies were automatically detected from broker emails. Review and add to your pipeline or dismiss.
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading suggestions...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle2 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No pending suggestions</p>
            </div>
          ) : (
            suggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} />)
          )}
        </div>

        <div className="px-5 py-3 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
