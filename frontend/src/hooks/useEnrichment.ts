import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface EnrichmentSourceResult {
  source: string;
  success: boolean;
  fields_found: string[];
  fields_actually_updated: string[];
  fields_missing: string[];
  error_message: string | null;
  duration_ms: number;
}

export interface EnrichmentRunResult {
  company_id: number;
  company_name: string;
  sources: EnrichmentSourceResult[];
  total_fields_filled: number;
  enrichment_score: number;
}

export interface EnrichmentLogEntry {
  id: number;
  source: string;
  run_at: string;
  success: boolean;
  fields_found: string[];
  fields_missing: string[];
  error_message: string | null;
  duration_ms: number;
}

export interface EnrichmentScore {
  company_id: number;
  enrichment_score: number;
  field_coverage: Record<string, boolean>;
}

export interface EnrichmentSettings {
  google_places_configured: boolean;
  clearbit_configured: boolean;
  google_places_key_preview: string | null;
  clearbit_key_preview: string | null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useEnrichCompany(companyId: number) {
  const queryClient = useQueryClient();
  return useMutation<EnrichmentRunResult, Error>({
    mutationFn: () =>
      api.post(`/enrichment/${companyId}/enrich`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["enrichment-log", companyId] });
      queryClient.invalidateQueries({ queryKey: ["enrichment-score", companyId] });
    },
  });
}

export function useEnrichmentLog(companyId: number) {
  return useQuery<{ company_id: number; logs: EnrichmentLogEntry[] }>({
    queryKey: ["enrichment-log", companyId],
    queryFn: () =>
      api.get(`/enrichment/${companyId}/log`).then((r) => r.data),
    enabled: !!companyId,
  });
}

export function useEnrichmentScore(companyId: number) {
  return useQuery<EnrichmentScore>({
    queryKey: ["enrichment-score", companyId],
    queryFn: () =>
      api.get(`/enrichment/${companyId}/score`).then((r) => r.data),
    enabled: !!companyId,
  });
}

export function useEnrichmentSettings() {
  return useQuery<EnrichmentSettings>({
    queryKey: ["enrichment-settings"],
    queryFn: () => api.get("/enrichment/settings").then((r) => r.data),
  });
}

export function useUpdateEnrichmentSettings() {
  const queryClient = useQueryClient();
  return useMutation<
    EnrichmentSettings,
    Error,
    { google_places_api_key?: string; clearbit_api_key?: string }
  >({
    mutationFn: (data) =>
      api.put("/enrichment/settings", data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrichment-settings"] });
    },
  });
}
