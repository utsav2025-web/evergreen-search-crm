import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailThread {
  id: number;
  gmail_thread_id: string;
  subject: string | null;
  sender_email: string | null;
  snippet: string | null;
  full_body: string | null;
  received_at: string | null;
  is_broker: boolean;
  is_processed: boolean;
  is_unread: boolean;
  matched_company_id: number | null;
  matched_company_name: string | null;
  message_count: number;
  raw_messages?: string[];
  labels?: string[];
  linked_by?: string | null;
}

export interface EmailStats {
  total: number;
  unread: number;
  broker_threads: number;
  unprocessed: number;
  unmatched_broker: number;
  pending_suggestions: number;
}

export interface SyncStatus {
  is_connected: boolean;
  email_address: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  initial_sync_done: boolean;
  history_id: string | null;
}

export interface SuggestedCompany {
  id: number;
  name: string;
  industry: string | null;
  location: string | null;
  asking_price: number | null;
  revenue: number | null;
  ebitda: number | null;
  broker_name: string | null;
  broker_email: string | null;
  status: string;
  source_thread_id: number | null;
  created_at: string | null;
}

export interface ThreadListFilters {
  is_broker?: boolean;
  is_processed?: boolean;
  is_unread?: boolean;
  matched?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useEmailStats() {
  return useQuery<EmailStats>({
    queryKey: ["email", "stats"],
    queryFn: async () => {
      const res = await api.get("/email/threads/stats");
      return res.data;
    },
    refetchInterval: 30000,
  });
}

export function useEmailThreads(filters: ThreadListFilters = {}) {
  return useQuery<{ items: EmailThread[]; total: number }>({
    queryKey: ["email", "threads", filters],
    queryFn: async () => {
      const params: Record<string, string | boolean | number> = {};
      if (filters.is_broker !== undefined) params.is_broker = filters.is_broker;
      if (filters.is_processed !== undefined) params.is_processed = filters.is_processed;
      if (filters.is_unread !== undefined) params.is_unread = filters.is_unread;
      if (filters.matched !== undefined) params.matched = filters.matched;
      if (filters.search) params.search = filters.search;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;

      const res = await api.get("/email/threads/", { params });
      return res.data;
    },
  });
}

export function useEmailThread(id: number | null) {
  return useQuery<EmailThread>({
    queryKey: ["email", "thread", id],
    queryFn: async () => {
      const res = await api.get(`/email/threads/${id}`);
      return res.data;
    },
    enabled: id !== null,
  });
}

export function useSyncStatus() {
  return useQuery<SyncStatus>({
    queryKey: ["email", "sync-status"],
    queryFn: async () => {
      const res = await api.get("/email/sync/status");
      return res.data;
    },
    refetchInterval: 15000,
  });
}

export function useSuggestedCompanies() {
  return useQuery<{ items: SuggestedCompany[]; total: number }>({
    queryKey: ["email", "suggested"],
    queryFn: async () => {
      const res = await api.get("/email/suggested/");
      return res.data;
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useLinkThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, companyId }: { threadId: number; companyId: number }) => {
      const res = await api.post(`/email/threads/${threadId}/link`, { company_id: companyId });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email"] });
    },
  });
}

export function useMarkProcessed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: number) => {
      const res = await api.post(`/email/threads/${threadId}/process`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email"] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: number) => {
      const res = await api.post(`/email/threads/${threadId}/mark-read`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email"] });
    },
  });
}

export function useExtractCompanyFromEmail() {
  return useMutation({
    mutationFn: async ({ threadId, useAi = true }: { threadId: number; useAi?: boolean }) => {
      const res = await api.post(`/email/threads/${threadId}/create-company`, { use_ai: useAi });
      return res.data as { prefill: Record<string, unknown>; raw_extract: Record<string, unknown>; thread_id: number; source_email: string };
    },
  });
}

export function useConfirmCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, companyData }: { threadId: number; companyData: Record<string, unknown> }) => {
      const res = await api.post(`/email/threads/${threadId}/confirm-company`, companyData);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, boolean>({
    mutationFn: async (forceFull: boolean) => {
      const res = await api.post("/email/sync", null, { params: { force_full: forceFull } });
      return res.data;
    },
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ["email"] }), 2000);
    },
  });
}

export function usePromoteSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suggestionId: number) => {
      const res = await api.post(`/email/suggested/${suggestionId}/promote`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suggestionId: number) => {
      const res = await api.post(`/email/suggested/${suggestionId}/dismiss`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email", "suggested"] });
    },
  });
}
