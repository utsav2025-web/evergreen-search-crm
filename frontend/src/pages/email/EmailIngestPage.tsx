import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import api from "@/lib/api";
import {
  Mail,
  Inbox,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Copy,
  ChevronRight,
  Building2,
  DollarSign,
  MapPin,
  User,
  Phone,
  AtSign,
  FileText,
  Zap,
  X,
  Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InboundEmail {
  id: number;
  from_address: string | null;
  subject: string | null;
  received_at: string | null;
  parse_status: "pending" | "processing" | "done" | "failed";
  parse_error: string | null;
  extracted_name: string | null;
  extracted_ebitda: number | null;
  extracted_revenue: number | null;
  extracted_asking: number | null;
  extracted_cash_flow: number | null;
  extracted_location: string | null;
  extracted_city: string | null;
  extracted_state: string | null;
  extracted_industry: string | null;
  extracted_broker_name: string | null;
  extracted_broker_email: string | null;
  extracted_broker_phone: string | null;
  extracted_description: string | null;
  extracted_data: Record<string, unknown> | null;
  broker_listing_id: number | null;
  is_reviewed: boolean;
  raw_body: string | null;
  attachment_names: string[] | null;
  created_at: string;
}

interface InboundEmailListOut {
  total: number;
  items: InboundEmail[];
}

interface Stats {
  total: number;
  pending: number;
  done: number;
  failed: number;
  unreviewed: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:    { label: "Pending",    icon: Clock,       color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  processing: { label: "Processing", icon: RefreshCw,   color: "text-blue-600 bg-blue-50 border-blue-200" },
  done:       { label: "Parsed",     icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200" },
  failed:     { label: "Failed",     icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200" },
};

// ─── Webhook Setup Card ───────────────────────────────────────────────────────

function WebhookSetupCard({ webhookUrl }: { webhookUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Zap className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-indigo-900 text-sm mb-1">Email Ingestion Webhook</h3>
          <p className="text-xs text-indigo-700 mb-3">
            Forward any broker deal email to this webhook URL. The AI will automatically extract deal data and create a Broker Listing.
            Use Zapier, Make, or your email client's "Forward to webhook" feature.
          </p>

          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-indigo-800 mb-1">Option A — Raw .eml (recommended for Zapier):</p>
              <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                <code className="text-xs text-gray-700 flex-1 truncate font-mono">{webhookUrl}/webhook</code>
                <button
                  onClick={() => copy(`${webhookUrl}/webhook`)}
                  className="text-indigo-500 hover:text-indigo-700 flex-shrink-0"
                  title="Copy URL"
                >
                  {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-indigo-800 mb-1">Option B — JSON body (for Make / custom scripts):</p>
              <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                <code className="text-xs text-gray-700 flex-1 truncate font-mono">{webhookUrl}/webhook/raw</code>
                <button
                  onClick={() => copy(`${webhookUrl}/webhook/raw`)}
                  className="text-indigo-500 hover:text-indigo-700 flex-shrink-0"
                >
                  {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-indigo-600 mt-2">
            <strong>JSON body fields:</strong>{" "}
            <code className="bg-indigo-100 px-1 rounded">token</code>,{" "}
            <code className="bg-indigo-100 px-1 rounded">from_address</code>,{" "}
            <code className="bg-indigo-100 px-1 rounded">subject</code>,{" "}
            <code className="bg-indigo-100 px-1 rounded">body</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Email Detail Panel ───────────────────────────────────────────────────────

function EmailDetailPanel({
  email,
  onClose,
  onReprocess,
  onMarkReviewed,
}: {
  email: InboundEmail;
  onClose: () => void;
  onReprocess: (id: number) => void;
  onMarkReviewed: (id: number) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const statusCfg = STATUS_CONFIG[email.parse_status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const extracted = email.extracted_data as Record<string, unknown> | null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start gap-3 z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
              {email.broker_listing_id && (
                <a
                  href={`/broker-listings`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  <ExternalLink className="w-3 h-3" />
                  Listing #{email.broker_listing_id}
                </a>
              )}
            </div>
            <h2 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
              {email.subject || "(no subject)"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{email.from_address || "Unknown sender"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Error */}
          {email.parse_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              <strong>Parse error:</strong> {email.parse_error}
            </div>
          )}

          {/* Extracted Deal Data */}
          {email.parse_status === "done" && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                AI-Extracted Deal Data
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Business Name */}
                <div className="col-span-2 bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Business Name</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {email.extracted_name || "—"}
                    </p>
                  </div>
                </div>

                {/* Financials */}
                {[
                  { label: "Asking Price", value: email.extracted_asking },
                  { label: "Revenue",      value: email.extracted_revenue },
                  { label: "EBITDA",       value: email.extracted_ebitda },
                  { label: "Cash Flow",    value: email.extracted_cash_flow },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />{label}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{fmt$(value)}</p>
                  </div>
                ))}

                {/* Location */}
                {email.extracted_location && (
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="text-sm font-medium text-gray-900">{email.extracted_location}</p>
                    </div>
                  </div>
                )}

                {/* Industry */}
                {email.extracted_industry && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Industry</p>
                    <p className="text-sm font-medium text-gray-900">{email.extracted_industry}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {email.extracted_description && (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">Description</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{email.extracted_description}</p>
                </div>
              )}

              {/* Key Highlights */}
              {extracted && Array.isArray(extracted.key_highlights) && (extracted.key_highlights as string[]).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Key Highlights</p>
                  <ul className="space-y-1">
                    {(extracted.key_highlights as string[]).map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {String(h)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Broker Contact */}
              {(email.extracted_broker_name || email.extracted_broker_email || email.extracted_broker_phone) && (
                <div className="mt-3 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Broker Contact</p>
                  <div className="space-y-1.5">
                    {email.extracted_broker_name && (
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {email.extracted_broker_name}
                        {extracted?.broker_firm != null && (
                          <span className="text-gray-400">· {String(extracted.broker_firm as string)}</span>
                        )}
                      </div>
                    )}
                    {email.extracted_broker_email && (
                      <div className="flex items-center gap-2 text-xs">
                        <AtSign className="w-3.5 h-3.5 text-gray-400" />
                        <a href={`mailto:${email.extracted_broker_email}`} className="text-indigo-600 hover:underline">
                          {email.extracted_broker_email}
                        </a>
                      </div>
                    )}
                    {email.extracted_broker_phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {email.extracted_broker_phone}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Attachments */}
          {email.attachment_names && email.attachment_names.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Attachments
              </h3>
              <div className="space-y-1">
                {email.attachment_names.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded px-3 py-2">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    {name}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Original Email Body */}
          <section>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
            >
              <Eye className="w-3.5 h-3.5" />
              {showRaw ? "Hide" : "Show"} Original Email
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showRaw ? "rotate-90" : ""}`} />
            </button>
            {showRaw && email.raw_body && (
              <pre className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                {email.raw_body}
              </pre>
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3 flex items-center gap-2">
          {!email.is_reviewed && (
            <button
              onClick={() => onMarkReviewed(email.id)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Mark Reviewed
            </button>
          )}
          <button
            onClick={() => onReprocess(email.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-run AI
          </button>
          {email.broker_listing_id && (
            <a
              href="/broker-listings"
              className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors ml-auto"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Listing
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailIngestPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<InboundEmail | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterReviewed, setFilterReviewed] = useState<string>("all");

  // Build the webhook URL from the current window location
  const webhookBase = `${window.location.protocol}//${window.location.host}/api/email-ingest`;

  // Stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ["email-ingest-stats"],
    queryFn: () => api.get("/email-ingest/stats/summary/").then((r) => r.data),
    refetchInterval: 10_000,
  });

  // List
  const { data: listData, isLoading } = useQuery<InboundEmailListOut>({
    queryKey: ["email-ingest-list", filterStatus, filterReviewed],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("parse_status", filterStatus);
      if (filterReviewed === "unreviewed") params.set("is_reviewed", "false");
      if (filterReviewed === "reviewed") params.set("is_reviewed", "true");
      return api.get(`/email-ingest/?${params}`).then((r) => r.data);
    },
    refetchInterval: 10_000,
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: number) => api.post(`/email-ingest/${id}/reprocess/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-ingest-list"] });
      qc.invalidateQueries({ queryKey: ["email-ingest-stats"] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/email-ingest/${id}/review/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-ingest-list"] });
      qc.invalidateQueries({ queryKey: ["email-ingest-stats"] });
      if (selected) setSelected({ ...selected, is_reviewed: true });
    },
  });

  const emails = listData?.items || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-indigo-600" />
            Email Ingestion
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Forward broker deal emails to the webhook — AI extracts deal data and creates Broker Listings automatically.
          </p>
        </div>
        <button
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["email-ingest-list"] });
            qc.invalidateQueries({ queryKey: ["email-ingest-stats"] });
          }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total",      value: stats.total,      color: "text-gray-900" },
            { label: "Unreviewed", value: stats.unreviewed, color: "text-yellow-700" },
            { label: "Parsed",     value: stats.done,       color: "text-green-700" },
            { label: "Pending",    value: stats.pending,    color: "text-blue-700" },
            { label: "Failed",     value: stats.failed,     color: "text-red-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Webhook Setup */}
      <WebhookSetupCard webhookUrl={webhookBase} />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="done">Parsed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={filterReviewed}
          onChange={(e) => setFilterReviewed(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All emails</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          {listData?.total ?? 0} email{listData?.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Email List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : emails.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No emails ingested yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Forward a broker deal email to the webhook URL above to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => {
            const statusCfg = STATUS_CONFIG[email.parse_status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            return (
              <button
                key={email.id}
                onClick={() => setSelected(email)}
                className={`w-full text-left bg-white border rounded-xl px-4 py-3.5 hover:border-indigo-300 hover:shadow-sm transition-all ${
                  selected?.id === email.id ? "border-indigo-400 shadow-sm" : "border-gray-200"
                } ${!email.is_reviewed ? "border-l-4 border-l-indigo-400" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full border ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      {email.broker_listing_id && (
                        <span className="text-xs text-green-600 font-medium">
                          → Listing #{email.broker_listing_id}
                        </span>
                      )}
                      {!email.is_reviewed && (
                        <span className="text-xs text-indigo-600 font-medium">New</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {email.extracted_name || email.subject || "(no subject)"}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{email.from_address}</p>
                  </div>

                  {/* Financial summary */}
                  {email.parse_status === "done" && (
                    <div className="flex-shrink-0 text-right space-y-0.5">
                      {email.extracted_asking && (
                        <p className="text-xs font-semibold text-gray-900">{fmt$(email.extracted_asking)}</p>
                      )}
                      {email.extracted_ebitda && (
                        <p className="text-xs text-gray-500">EBITDA {fmt$(email.extracted_ebitda)}</p>
                      )}
                      {email.extracted_location && (
                        <p className="text-xs text-gray-400">{email.extracted_location}</p>
                      )}
                    </div>
                  )}

                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-400">
                      {email.received_at
                        ? formatDistanceToNow(new Date(email.received_at), { addSuffix: true })
                        : "—"}
                    </p>
                    <ChevronRight className="w-4 h-4 text-gray-300 mt-1 ml-auto" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <EmailDetailPanel
          email={selected}
          onClose={() => setSelected(null)}
          onReprocess={(id) => reprocessMutation.mutate(id)}
          onMarkReviewed={(id) => reviewMutation.mutate(id)}
        />
      )}
    </div>
  );
}
