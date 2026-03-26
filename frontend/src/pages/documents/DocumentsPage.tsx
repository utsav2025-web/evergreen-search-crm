import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface Document {
  id: number;
  company_id: number | null;
  deal_id: number | null;
  doc_type: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: number | null;
  created_at: string;
}

interface NDA {
  id: number;
  company_id: number;
  status: string;
  sent_to_email: string | null;
  signatory_name: string | null;
  sent_at: string | null;
  signed_at: string | null;
  ai_review_notes: string | null;
  redlines: string[];
  created_at: string;
}

const NDA_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  signed: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
  declined: "bg-orange-100 text-orange-700",
};

const DOC_TYPE_ICONS: Record<string, string> = {
  nda: "📋",
  cim: "📊",
  loi: "✍️",
  financial: "💰",
  legal: "⚖️",
  other: "📄",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<"vault" | "ndas">("vault");
  const [selectedNDA, setSelectedNDA] = useState<NDA | null>(null);
  const [aiReview, setAiReview] = useState<any>(null);
  const [ndaFilter, setNdaFilter] = useState("");
  const qc = useQueryClient();

  const { data: docsData } = useQuery({
    queryKey: ["documents-list"],
    queryFn: () => api.get("/documents/?limit=100").then(r => r.data),
  });

  const { data: ndasData } = useQuery({
    queryKey: ["ndas-list"],
    queryFn: () => api.get("/ndas/?limit=100").then(r => r.data),
  });

  const { data: companiesData } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => api.get("/companies/?limit=100").then(r => r.data),
  });

  const aiReviewMutation = useMutation({
    mutationFn: (ndaId: number) => api.post(`/ndas/${ndaId}/ai-review`),
    onSuccess: (r) => {
      const nda = r.data;
      setSelectedNDA(nda);
      try {
        setAiReview(JSON.parse(nda.ai_review_notes));
      } catch {
        setAiReview({ summary: nda.ai_review_notes });
      }
      qc.invalidateQueries({ queryKey: ["ndas-list"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, email, name }: { id: number; email: string; name: string }) =>
      api.post(`/ndas/${id}/send`, { sent_to_email: email, signatory_name: name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ndas-list"] }),
  });

  const signMutation = useMutation({
    mutationFn: (id: number) => api.post(`/ndas/${id}/sign`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ndas-list"] }),
  });

  const docs: Document[] = docsData?.items ?? [];
  const ndas: NDA[] = ndasData?.items ?? [];
  const companies: any[] = companiesData?.items ?? [];

  const companyMap = Object.fromEntries(companies.map((c: any) => [c.id, c.name]));

  const filteredNDAs = ndas.filter(n =>
    !ndaFilter || n.status === ndaFilter
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document Vault & NDAs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage deal documents, NDAs, and e-signature tracking</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["vault", "ndas"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab === "vault" ? "Document Vault" : "NDA Tracker"}
          </button>
        ))}
      </div>

      {/* Document Vault */}
      {activeTab === "vault" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">All Documents ({docs.length})</h3>
          </div>
          {docs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No documents uploaded yet. Upload documents from a company or deal page.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{DOC_TYPE_ICONS[doc.doc_type] ?? "📄"}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                      <p className="text-xs text-gray-400">
                        {doc.company_id ? companyMap[doc.company_id] ?? `Company #${doc.company_id}` : "No company"} &bull; {fmtDate(doc.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600`}>
                      {doc.doc_type}
                    </span>
                    <span className="text-xs text-gray-400">{fmtSize(doc.file_size)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NDA Tracker */}
      {activeTab === "ndas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* NDA List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <select
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={ndaFilter}
                onChange={e => setNdaFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {["draft", "sent", "signed", "expired", "declined"].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <span className="text-sm text-gray-400">{filteredNDAs.length} NDAs</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {filteredNDAs.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  No NDAs found. NDAs are created from the deal pipeline.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredNDAs.map(nda => (
                    <div
                      key={nda.id}
                      className={`px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedNDA?.id === nda.id ? "bg-brand-50 border-l-2 border-brand-500" : ""}`}
                      onClick={() => { setSelectedNDA(nda); setAiReview(nda.ai_review_notes ? (() => { try { return JSON.parse(nda.ai_review_notes!); } catch { return null; } })() : null); }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {companyMap[nda.company_id] ?? `Company #${nda.company_id}`}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${NDA_STATUS_COLORS[nda.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {nda.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        {nda.signatory_name && <span>{nda.signatory_name}</span>}
                        {nda.sent_to_email && <span>{nda.sent_to_email}</span>}
                        <span>Created {fmtDate(nda.created_at)}</span>
                        {nda.signed_at && <span className="text-green-600">Signed {fmtDate(nda.signed_at)}</span>}
                      </div>
                      {nda.redlines && nda.redlines.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {nda.redlines.slice(0, 2).map((r, i) => (
                            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600">
                              ⚠ {r.length > 40 ? r.slice(0, 40) + "…" : r}
                            </span>
                          ))}
                          {nda.redlines.length > 2 && (
                            <span className="text-xs text-red-400">+{nda.redlines.length - 2} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* NDA Detail Panel */}
          <div className="space-y-4">
            {selectedNDA ? (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {companyMap[selectedNDA.company_id] ?? `Company #${selectedNDA.company_id}`}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${NDA_STATUS_COLORS[selectedNDA.status]}`}>
                        {selectedNDA.status}
                      </span>
                    </div>
                    {selectedNDA.signatory_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Signatory</span>
                        <span className="text-gray-900">{selectedNDA.signatory_name}</span>
                      </div>
                    )}
                    {selectedNDA.sent_to_email && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email</span>
                        <span className="text-gray-900 text-xs">{selectedNDA.sent_to_email}</span>
                      </div>
                    )}
                    {selectedNDA.sent_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sent</span>
                        <span className="text-gray-900">{fmtDate(selectedNDA.sent_at)}</span>
                      </div>
                    )}
                    {selectedNDA.signed_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Signed</span>
                        <span className="text-green-700">{fmtDate(selectedNDA.signed_at)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <WriteGuard>
                      <button
                        onClick={() => aiReviewMutation.mutate(selectedNDA.id)}
                        disabled={aiReviewMutation.isPending}
                        className="w-full text-xs px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                      >
                        {aiReviewMutation.isPending ? "Reviewing…" : "AI Review NDA"}
                      </button>
                    </WriteGuard>
                    {selectedNDA.status === "draft" && (
                      <WriteGuard>
                        <button
                          onClick={() => {
                            const email = prompt("Send to email:");
                            const name = prompt("Signatory name:");
                            if (email && name) sendMutation.mutate({ id: selectedNDA.id, email, name });
                          }}
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Mark as Sent
                        </button>
                      </WriteGuard>
                    )}
                    {selectedNDA.status === "sent" && (
                      <WriteGuard>
                        <button
                          onClick={() => signMutation.mutate(selectedNDA.id)}
                          className="w-full text-xs px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Mark as Signed
                        </button>
                      </WriteGuard>
                    )}
                  </div>
                </div>

                {/* AI Review Results */}
                {aiReview && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">AI Review</h3>
                    {aiReview.assessment && (
                      <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mb-3 ${
                        aiReview.assessment === "favorable" ? "bg-green-100 text-green-700" :
                        aiReview.assessment === "unfavorable" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {aiReview.assessment?.toUpperCase()}
                      </div>
                    )}
                    {aiReview.summary && (
                      <p className="text-xs text-gray-600 mb-3">{aiReview.summary}</p>
                    )}
                    {aiReview.red_flags && aiReview.red_flags.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-red-600 mb-1">Red Flags</p>
                        <ul className="space-y-1">
                          {aiReview.red_flags.map((f: string, i: number) => (
                            <li key={i} className="text-xs text-gray-600 flex gap-1">
                              <span className="text-red-400">•</span> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiReview.recommendations && aiReview.recommendations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1">Recommendations</p>
                        <ul className="space-y-1">
                          {aiReview.recommendations.map((r: string, i: number) => (
                            <li key={i} className="text-xs text-gray-600 flex gap-1">
                              <span className="text-blue-400">→</span> {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                Select an NDA to view details and run AI review.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
