import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import WriteGuard from "@/components/layout/WriteGuard";

interface DealVote {
  id: number;
  company_id: number;
  company_name: string;
  company_industry: string;
  deal_stage: string;
  deal_score: number | null;
  votes: {
    user_id: number;
    username: string;
    display_name: string;
    conviction: number;
    comment: string | null;
    voted_at: string;
  }[];
}

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  nda: "bg-yellow-100 text-yellow-700",
  loi: "bg-orange-100 text-orange-700",
  due_diligence: "bg-purple-100 text-purple-700",
  closed: "bg-green-100 text-green-700",
  passed: "bg-red-100 text-red-700",
};

function ConvictionStars({
  value,
  onChange,
  readonly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`text-xl transition-colors ${
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          } ${star <= display ? "text-yellow-400" : "text-gray-200"}`}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-gray-500 font-medium">{value}/5</span>
      )}
    </div>
  );
}

function VoteModal({
  companyId,
  companyName,
  existingVote,
  onClose,
}: {
  companyId: number;
  companyName: string;
  existingVote?: { conviction: number; comment: string | null };
  onClose: () => void;
}) {
  const [conviction, setConviction] = useState(existingVote?.conviction ?? 0);
  const [comment, setComment] = useState(existingVote?.comment ?? "");
  const queryClient = useQueryClient();

  const submitVote = useMutation({
    mutationFn: () =>
      api.post(`/activity/deals/${companyId}/vote`, { conviction, comment: comment || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-votes"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Rate Your Conviction</h3>
        <p className="text-sm text-gray-500 mb-4">{companyName}</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Conviction Level
          </label>
          <ConvictionStars value={conviction} onChange={setConviction} />
          <p className="text-xs text-gray-400 mt-1">
            {["", "Very Low", "Low", "Medium", "High", "Very High"][conviction] || "Select a rating"}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What drives your conviction? Any concerns?"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => submitVote.mutate()}
            disabled={conviction === 0 || submitVote.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {submitVote.isPending ? "Saving…" : existingVote ? "Update Vote" : "Submit Vote"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DealReviewPage() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuthStore();
  const [voteModal, setVoteModal] = useState<{ companyId: number; companyName: string; existing?: { conviction: number; comment: string | null } } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deal-votes"],
    queryFn: () => api.get("/activity/deals/votes?min_stage=nda").then((r) => r.data),
  });

  const deals: DealVote[] = data?.deals ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Deal Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">Conviction ratings for active deals</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No active deals to review</p>
          <p className="text-sm mt-1">Deals in NDA stage or later will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deals.map((deal) => {
            const myVote = deal.votes.find((v) => v.username === user?.username);
            const avgConviction =
              deal.votes.length > 0
                ? deal.votes.reduce((s, v) => s + v.conviction, 0) / deal.votes.length
                : 0;

            return (
              <div key={deal.company_id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <button
                        onClick={() => navigate(`/companies/${deal.company_id}`)}
                        className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {deal.company_name}
                      </button>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[deal.deal_stage] ?? "bg-gray-100 text-gray-700"}`}>
                        {deal.deal_stage.replace("_", " ").toUpperCase()}
                      </span>
                      {deal.deal_score !== null && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Score: {deal.deal_score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{deal.company_industry}</p>
                  </div>

                  {/* Average conviction */}
                  {deal.votes.length > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400 mb-1">Team avg</p>
                      <ConvictionStars value={Math.round(avgConviction)} readonly />
                    </div>
                  )}
                </div>

                {/* Partner votes */}
                <div className="mt-4 space-y-3">
                  {deal.votes.map((vote) => (
                    <div key={vote.user_id} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {vote.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{vote.display_name}</span>
                          <ConvictionStars value={vote.conviction} readonly />
                        </div>
                        {vote.comment && (
                          <p className="text-xs text-gray-500 mt-0.5 italic">&ldquo;{vote.comment}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* My vote CTA */}
                  {!myVote && !isGuest && (
                    <div className="pt-2 border-t border-gray-100">
                      <WriteGuard>
                        <button
                          onClick={() =>
                            setVoteModal({ companyId: deal.company_id, companyName: deal.company_name })
                          }
                          className="text-sm text-blue-600 hover:underline font-medium"
                        >
                          + Add your conviction rating
                        </button>
                      </WriteGuard>
                    </div>
                  )}
                  {myVote && !isGuest && (
                    <div className="pt-2 border-t border-gray-100">
                      <WriteGuard>
                        <button
                          onClick={() =>
                            setVoteModal({
                              companyId: deal.company_id,
                              companyName: deal.company_name,
                              existing: { conviction: myVote.conviction, comment: myVote.comment },
                            })
                          }
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                        >
                          Edit your rating
                        </button>
                      </WriteGuard>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vote modal */}
      {voteModal && (
        <VoteModal
          companyId={voteModal.companyId}
          companyName={voteModal.companyName}
          existingVote={voteModal.existing}
          onClose={() => setVoteModal(null)}
        />
      )}
    </div>
  );
}
