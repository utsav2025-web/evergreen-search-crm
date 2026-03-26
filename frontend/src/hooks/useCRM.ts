/**
 * Core CRM hooks — companies, dashboard, pipeline, notes, outreach
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DealStage =
  | "lead"
  | "prospect"
  | "contacted"
  | "nda"
  | "cim"
  | "model"
  | "ioi"
  | "loi"
  | "dd"
  | "closed"
  | "passed";

export interface Company {
  id: number;
  name: string;
  slug?: string;
  website?: string;
  industry?: string;
  sub_industry?: string;
  annual_revenue?: number;
  ebitda?: number;
  ebitda_margin?: number;
  employees?: number;
  founded_year?: number;
  state_of_incorporation?: string;
  entity_type?: string;
  asking_price?: number;
  implied_multiple?: number;
  deal_stage: DealStage;
  source?: string;
  broker_id?: number;
  listing_url?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  lead_partner?: string;
  deal_score?: number;
  enrichment_score?: number;
  city?: string;
  state?: string;
  description?: string;
  is_proprietary?: boolean;
  created_at?: string;
  updated_at?: string;
  last_contacted_at?: string;
}

export interface CompanyListOut {
  total: number;
  items: Company[];
}

export interface CompanyFilters {
  search?: string;
  industry?: string;
  deal_stage?: DealStage;
  state?: string;
  lead_partner?: string;
  min_revenue?: number;
  max_revenue?: number;
  source?: string;
  page?: number;
  limit?: number;
}

export interface Note {
  id: number;
  company_id: number;
  content: string;
  created_by?: string;
  created_at?: string;
  tagged_stage?: string;
  is_pinned?: boolean;
  note_type?: string;
}

export interface OutreachEntry {
  id: number;
  company_id: number;
  contact_method: string;
  direction: string;
  outcome?: string;
  notes?: string;
  follow_up_date?: string;
  sent_by?: string;
  created_at?: string;
  subject?: string;
}

export interface DashboardSummary {
  kpis: {
    total_prospects: number;
    active_pipeline: number;
    prospect: number;
    contacted: number;
    nda: number;
    loi: number;
    due_diligence: number;
    closed: number;
    passed: number;
    calls_this_week: number;
  };
  new_this_week: {
    broker_listings: Array<{
      id: number;
      business_name: string;
      asking_price?: number;
      revenue?: number;
      industry?: string;
      broker_site?: string;
      date_scraped?: string;
      is_new?: boolean;
    }>;
    unreviewed_emails: Array<{
      id: number;
      subject?: string;
      sender_email?: string;
      snippet?: string;
      received_at?: string;
    }>;
  };
  follow_ups_due: Array<{
    id: number;
    company_id?: number;
    company_name?: string;
    contact_method?: string;
    notes?: string;
    follow_up_date?: string;
    sent_by?: string;
    days_overdue?: number;
  }>;
  activity_feed: Array<{
    type: string;
    id: number;
    company_id?: number;
    company_name?: string;
    description?: string;
    actor?: string;
    timestamp?: string;
  }>;
  generated_at: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/summary");
      return data;
    },
    refetchInterval: 60_000, // poll every 60s
  });
}

// ── Companies list ────────────────────────────────────────────────────────────

export function useCompanies(filters: CompanyFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.industry) params.set("industry", filters.industry);
  if (filters.deal_stage) params.set("deal_stage", filters.deal_stage);
  if (filters.state) params.set("state", filters.state);
  if (filters.lead_partner) params.set("lead_partner", filters.lead_partner);
  if (filters.min_revenue) params.set("min_revenue", String(filters.min_revenue));
  if (filters.max_revenue) params.set("max_revenue", String(filters.max_revenue));
  if (filters.source) params.set("source", filters.source);
  if (filters.page) params.set("skip", String(((filters.page - 1) * (filters.limit || 50))));
  if (filters.limit) params.set("limit", String(filters.limit));

  return useQuery<CompanyListOut>({
    queryKey: ["companies", filters],
    queryFn: async () => {
      const { data } = await api.get(`/companies/?${params.toString()}`);
      return data;
    },
  });
}

// ── Single company ────────────────────────────────────────────────────────────

export function useCompany(id: number | null) {
  return useQuery<Company>({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create company ────────────────────────────────────────────────────────────

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Company>) => {
      const { data } = await api.post("/companies/", body);
      return data as Company;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Update company ────────────────────────────────────────────────────────────

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Company> & { id: number }) => {
      const { data } = await api.patch(`/companies/${id}`, body);
      return data as Company;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", data.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Move stage ────────────────────────────────────────────────────────────────

export function useMoveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: DealStage }) => {
      const { data } = await api.post(`/companies/${id}/stage?new_stage=${stage}`);
      return data as Company;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", data.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export function useCompanyNotes(companyId: number | null) {
  return useQuery<{ total: number; items: Note[] }>({
    queryKey: ["notes", companyId],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${companyId}/notes`);
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { company_id: number; content: string; created_by?: string; tagged_stage?: string }) => {
      const { data } = await api.post("/notes/", body);
      return data as Note;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["notes", data.company_id] });
    },
  });
}

// ── Outreach ──────────────────────────────────────────────────────────────────

export function useCompanyOutreach(companyId: number | null) {
  return useQuery<{ total: number; items: OutreachEntry[] }>({
    queryKey: ["outreach", companyId],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${companyId}/outreach`);
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<OutreachEntry>) => {
      const { data } = await api.post("/outreach/", body);
      return data as OutreachEntry;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["outreach", data.company_id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Global search ─────────────────────────────────────────────────────────────

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      if (!query || query.length < 2) return { companies: [], emails: [], listings: [], notes: [] };
      const [companies, emails, listings] = await Promise.all([
        api.get(`/companies/?search=${encodeURIComponent(query)}&limit=5`).then(r => r.data.items || []),
        api.get(`/email/threads/?search=${encodeURIComponent(query)}&limit=5`).then(r => r.data.items || []).catch(() => []),
        api.get(`/broker-listings/?search=${encodeURIComponent(query)}&limit=5`).then(r => r.data.items || []).catch(() => []),
      ]);
      return { companies, emails, listings, notes: [] };
    },
    enabled: query.length >= 2,
  });
}
