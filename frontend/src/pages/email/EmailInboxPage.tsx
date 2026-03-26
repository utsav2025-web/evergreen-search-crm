import { useState, useCallback } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Mail, MailOpen, RefreshCw, Link2, Building2, CheckCircle2,
  ChevronDown, ChevronUp, Search, Filter, Sparkles, X,
  AlertCircle, ExternalLink, Tag, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  useEmailStats, useEmailThreads, useMarkProcessed, useMarkRead,
  useTriggerSync, useExtractCompanyFromEmail, useConfirmCreateCompany,
  useSyncStatus, EmailThread, ThreadListFilters,
} from "@/hooks/useEmail";
import { CreateCompanyModal } from "./CreateCompanyModal";
import { SuggestedCompaniesPanel } from "./SuggestedCompaniesPanel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function senderInitials(email: string | null): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

function senderDomain(email: string | null): string {
  if (!email) return "";
  return email.split("@")[1] || "";
}

// ─── Thread Card ──────────────────────────────────────────────────────────────

interface ThreadCardProps {
  thread: EmailThread;
  isExpanded: boolean;
  onToggle: () => void;
  onCreateCompany: (thread: EmailThread) => void;
  onMarkProcessed: (id: number) => void;
}

function ThreadCard({ thread, isExpanded, onToggle, onCreateCompany, onMarkProcessed }: ThreadCardProps) {
  const markRead = useMarkRead();

  const handleExpand = () => {
    if (thread.is_unread) markRead.mutate(thread.id);
    onToggle();
  };

  return (
    <div
      className={`
        border rounded-lg transition-all duration-200 overflow-hidden
        ${thread.is_unread ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-white"}
        ${isExpanded ? "shadow-md" : "hover:shadow-sm hover:border-gray-300"}
      `}
    >
      {/* ── Card Header ── */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={handleExpand}
      >
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
          ${thread.is_broker ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}
        `}>
          {senderInitials(thread.sender_email)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm ${thread.is_unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
              {thread.sender_email || "Unknown sender"}
            </span>
            {thread.is_broker && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 gap-1">
                <Tag className="w-3 h-3" />
                Broker
              </Badge>
            )}
            {thread.matched_company_name && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
                <Building2 className="w-3 h-3" />
                {thread.matched_company_name}
              </Badge>
            )}
            {thread.is_processed && (
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Processed
              </Badge>
            )}
          </div>
          <p className={`text-sm mt-0.5 truncate ${thread.is_unread ? "font-medium text-gray-900" : "text-gray-700"}`}>
            {thread.subject || "(no subject)"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {thread.snippet}
          </p>
        </div>

        {/* Meta */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs text-gray-400">{formatDate(thread.received_at)}</span>
          {thread.message_count > 1 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {thread.message_count}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* ── Expanded Body ── */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Email body */}
          <div className="px-4 py-3 bg-white">
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
              <span>From: <span className="font-medium text-gray-700">{thread.sender_email}</span></span>
              <span>·</span>
              <span>{thread.received_at ? new Date(thread.received_at).toLocaleString() : ""}</span>
              <span>·</span>
              <span>{thread.message_count} message{thread.message_count !== 1 ? "s" : ""}</span>
            </div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-80 overflow-y-auto font-mono bg-gray-50 rounded p-3 leading-relaxed">
              {thread.full_body || thread.snippet || "(no content)"}
            </div>
          </div>

          {/* Action bar */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            {thread.is_broker && !thread.matched_company_id && (
              <Button
                size="sm"
                onClick={() => onCreateCompany(thread)}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Create Company from Email
              </Button>
            )}
            {thread.is_broker && thread.matched_company_id && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                disabled
              >
                <Building2 className="w-3.5 h-3.5" />
                Linked: {thread.matched_company_name}
              </Button>
            )}
            {!thread.is_processed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarkProcessed(thread.id)}
                className="gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Processed
              </Button>
            )}
            <Button size="sm" variant="ghost" className="gap-1.5 text-gray-500">
              <Link2 className="w-3.5 h-3.5" />
              Link to Company
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters: ThreadListFilters;
  onChange: (f: ThreadListFilters) => void;
}

function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search subject, sender..."
          className="pl-9 h-9 text-sm"
          value={filters.search || ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="broker-only"
          checked={filters.is_broker === true}
          onCheckedChange={(v) => onChange({ ...filters, is_broker: v ? true : undefined })}
        />
        <Label htmlFor="broker-only" className="text-sm cursor-pointer">Broker only</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="unread-only"
          checked={filters.is_unread === true}
          onCheckedChange={(v) => onChange({ ...filters, is_unread: v ? true : undefined })}
        />
        <Label htmlFor="unread-only" className="text-sm cursor-pointer">Unread</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="unprocessed-only"
          checked={filters.is_processed === false}
          onCheckedChange={(v) => onChange({ ...filters, is_processed: v ? false : undefined })}
        />
        <Label htmlFor="unprocessed-only" className="text-sm cursor-pointer">Unprocessed</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="unmatched-only"
          checked={filters.matched === false}
          onCheckedChange={(v) => onChange({ ...filters, matched: v ? false : undefined })}
        />
        <Label htmlFor="unmatched-only" className="text-sm cursor-pointer">Unmatched</Label>
      </div>

      {Object.keys(filters).length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange({})}
          className="gap-1 text-gray-500 h-9"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const { data: stats } = useEmailStats();
  const { data: syncStatus } = useSyncStatus();
  const triggerSync = useTriggerSync();

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.unread}</div>
          <div className="text-xs text-gray-500">Unread</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.broker_threads}</div>
          <div className="text-xs text-gray-500">Broker</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">{stats.unprocessed}</div>
          <div className="text-xs text-gray-500">Unprocessed</div>
        </div>
        {stats.pending_suggestions > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.pending_suggestions}</div>
            <div className="text-xs text-gray-500">Suggestions</div>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {syncStatus && (
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus.is_connected
                ? syncStatus.last_sync_status === "error" ? "bg-red-400" : "bg-green-400"
                : "bg-gray-300"
            }`} />
            {syncStatus.is_connected
              ? syncStatus.email_address || "Connected"
              : "Not connected"}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerSync.mutate(false)}
          disabled={triggerSync.isPending}
          className="gap-1.5 h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${triggerSync.isPending ? "animate-spin" : ""}`} />
          Sync
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailInboxPage() {
  const [filters, setFilters] = useState<ThreadListFilters>({ is_broker: true });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [createCompanyThread, setCreateCompanyThread] = useState<EmailThread | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data, isLoading } = useEmailThreads({ ...filters, limit: 100 });
  const markProcessed = useMarkProcessed();
  const { data: stats } = useEmailStats();

  const handleToggle = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const threads = data?.items || [];

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-600" />
            <h1 className="text-xl font-semibold text-gray-900">Email Inbox</h1>
            {stats?.pending_suggestions ? (
              <button
                onClick={() => setShowSuggestions(true)}
                className="ml-2 flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full hover:bg-purple-200 transition-colors"
              >
                <AlertCircle className="w-3 h-3" />
                {stats.pending_suggestions} suggested companies
              </button>
            ) : null}
          </div>
        </div>
        <StatsBar />
        <div className="mt-3">
          <FilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* ── Thread List ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading emails...
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Mail className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No emails found</p>
            <p className="text-sm mt-1">
              {filters.is_broker ? "No broker emails yet — try syncing your inbox" : "Adjust filters to see more emails"}
            </p>
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-2">{data?.total || 0} threads</div>
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                isExpanded={expandedId === thread.id}
                onToggle={() => handleToggle(thread.id)}
                onCreateCompany={setCreateCompanyThread}
                onMarkProcessed={(id) => markProcessed.mutate(id)}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Create Company Modal ── */}
      {createCompanyThread && (
        <CreateCompanyModal
          thread={createCompanyThread}
          onClose={() => setCreateCompanyThread(null)}
        />
      )}

      {/* ── Suggested Companies Panel ── */}
      {showSuggestions && (
        <SuggestedCompaniesPanel onClose={() => setShowSuggestions(false)} />
      )}
    </div>
  );
}
