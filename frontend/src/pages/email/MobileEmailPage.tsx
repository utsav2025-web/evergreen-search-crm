/**
 * MobileEmailPage — Gmail-style card list with slide-up drawer
 * Used on mobile (< md breakpoint). Desktop uses EmailInboxPage.
 */
import { useState, useRef } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Mail, MailOpen, RefreshCw, Building2, CheckCircle2,
  Sparkles, Link2, X, ChevronRight, Search, Tag,
  Inbox, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useEmailStats, useEmailThreads, useMarkProcessed, useMarkRead,
  useTriggerSync, EmailThread,
} from "@/hooks/useEmail";
import { CreateCompanyModal } from "./CreateCompanyModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function senderInitials(email: string | null): string {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

// ─── Thread Row (mobile card) ─────────────────────────────────────────────────

interface ThreadRowProps {
  thread: EmailThread;
  onTap: (t: EmailThread) => void;
}

function ThreadRow({ thread, onTap }: ThreadRowProps) {
  return (
    <div
      onClick={() => onTap(thread)}
      className={`
        flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 active:bg-gray-50 cursor-pointer
        ${thread.is_unread ? "bg-blue-50/40" : "bg-white"}
      `}
    >
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5
        ${thread.is_broker ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}
      `}>
        {senderInitials(thread.sender_email)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className={`text-sm truncate ${thread.is_unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
            {thread.sender_email?.split("@")[0] || "Unknown"}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(thread.received_at)}</span>
        </div>
        <p className={`text-sm truncate ${thread.is_unread ? "font-medium text-gray-900" : "text-gray-700"}`}>
          {thread.subject || "(no subject)"}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {thread.is_broker && (
            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
              <Tag className="w-2.5 h-2.5" />
              Broker
            </span>
          )}
          {thread.matched_company_name && (
            <span className="text-xs bg-green-50 text-green-600 border border-green-200 rounded-full px-1.5 py-0.5 flex items-center gap-0.5 truncate max-w-28">
              <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{thread.matched_company_name}</span>
            </span>
          )}
          {!thread.is_broker && !thread.matched_company_name && (
            <span className="text-xs text-gray-400 truncate">{thread.snippet?.slice(0, 60)}</span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-2" />
    </div>
  );
}

// ─── Slide-up Drawer ──────────────────────────────────────────────────────────

interface DrawerProps {
  thread: EmailThread;
  onClose: () => void;
  onCreateCompany: (t: EmailThread) => void;
}

function EmailDrawer({ thread, onClose, onCreateCompany }: DrawerProps) {
  const markProcessed = useMarkProcessed();
  const markRead = useMarkRead();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Mark as read when drawer opens
  useState(() => {
    if (thread.is_unread) markRead.mutate(thread.id);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="flex-shrink-0 flex-1 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Drawer header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
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
            <h3 className="font-semibold text-gray-900 text-base leading-tight">
              {thread.subject || "(no subject)"}
            </h3>
            <div className="text-xs text-gray-500 mt-1">
              {thread.sender_email} · {formatDate(thread.received_at)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email body — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 leading-relaxed text-xs">
            {thread.full_body || thread.snippet || "(no content)"}
          </div>

          {thread.message_count > 1 && (
            <div className="mt-3 text-xs text-gray-400 text-center">
              {thread.message_count} messages in this thread
            </div>
          )}
        </div>

        {/* Pinned action buttons */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-gray-100 bg-white safe-area-bottom">
          <div className="flex gap-2">
            {thread.is_broker && !thread.matched_company_id && (
              <Button
                className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  onClose();
                  onCreateCompany(thread);
                }}
              >
                <Sparkles className="w-4 h-4" />
                Create Company
              </Button>
            )}
            {thread.is_broker && thread.matched_company_id && (
              <Button
                className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                disabled
              >
                <Building2 className="w-4 h-4" />
                Linked
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => {
                /* Link to existing company — future modal */
              }}
            >
              <Link2 className="w-4 h-4" />
              Link to Existing
            </Button>
            {!thread.is_processed && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  markProcessed.mutate(thread.id);
                  onClose();
                }}
                className="flex-shrink-0"
                title="Mark processed"
              >
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Mobile Page ─────────────────────────────────────────────────────────

export default function MobileEmailPage() {
  const [search, setSearch] = useState("");
  const [brokerOnly, setBrokerOnly] = useState(true);
  const [openThread, setOpenThread] = useState<EmailThread | null>(null);
  const [createCompanyThread, setCreateCompanyThread] = useState<EmailThread | null>(null);

  const { data: stats } = useEmailStats();
  const { data, isLoading } = useEmailThreads({
    is_broker: brokerOnly ? true : undefined,
    search: search || undefined,
    limit: 100,
  });
  const triggerSync = useTriggerSync();

  const threads = data?.items || [];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Top bar ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-900">Inbox</span>
            {stats?.unread ? (
              <span className="text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5 font-medium">
                {stats.unread}
              </span>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => triggerSync.mutate(false)}
            disabled={triggerSync.isPending}
            className="gap-1 text-gray-500 h-8 px-2"
          >
            <RefreshCw className={`w-4 h-4 ${triggerSync.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search emails..."
            className="pl-9 h-9 text-sm bg-gray-50 border-gray-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          <button
            onClick={() => setBrokerOnly(true)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              brokerOnly
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Broker
          </button>
          <button
            onClick={() => setBrokerOnly(false)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              !brokerOnly
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* ── Thread list ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading...
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 px-6 text-center">
            <Mail className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium text-sm">No emails found</p>
            <p className="text-xs mt-1 text-gray-400">
              {brokerOnly ? "Connect Gmail to start syncing broker emails" : "No emails match your search"}
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
              {data?.total || 0} threads
            </div>
            {threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                onTap={setOpenThread}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Slide-up drawer ── */}
      {openThread && (
        <EmailDrawer
          thread={openThread}
          onClose={() => setOpenThread(null)}
          onCreateCompany={(t) => {
            setOpenThread(null);
            setCreateCompanyThread(t);
          }}
        />
      )}

      {/* ── Create Company modal ── */}
      {createCompanyThread && (
        <CreateCompanyModal
          thread={createCompanyThread}
          onClose={() => setCreateCompanyThread(null)}
        />
      )}
    </div>
  );
}
