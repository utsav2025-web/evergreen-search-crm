import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryScore {
  score: number;
  max: number;
  justification: string;
}

export interface DealScore {
  id: number;
  company_id: number;
  cim_extract_id: number | null;
  scored_at: string | null;
  model_used: string;
  composite_score: number;
  financial_quality: CategoryScore;
  business_quality: CategoryScore;
  operator_fit: CategoryScore;
  deal_structure: CategoryScore;
  growth_potential: CategoryScore;
  recommendation: "pursue" | "watch" | "pass";
  deal_memo: string | null;
}

export interface CIMExtract {
  id: number;
  company_id: number;
  document_id: number | null;
  extracted_at: string | null;
  model_used: string;
  business_summary: string | null;
  key_products: string[];
  customer_concentration: number | null;
  revenue_recurring_pct: number | null;
  employee_count: number | null;
  key_risks: string[];
  growth_opportunities: string[];
  financials_summary: Record<string, number | null>;
  deal_score: number | null;
  score_rationale: string | null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDealScore(companyId: number) {
  return useQuery<{ company_id: number; deal_score: DealScore | null }>({
    queryKey: ["deal-score", companyId],
    queryFn: () =>
      api.get(`/companies/${companyId}/score`).then((r) => r.data),
    enabled: !!companyId,
  });
}

export function useDealScoreHistory(companyId: number) {
  return useQuery<{ company_id: number; scores: DealScore[] }>({
    queryKey: ["deal-scores", companyId],
    queryFn: () =>
      api.get(`/companies/${companyId}/scores`).then((r) => r.data),
    enabled: !!companyId,
  });
}

export function useDealMemo(companyId: number) {
  return useQuery<{
    company_id: number;
    deal_memo: string | null;
    deal_score: DealScore | null;
  }>({
    queryKey: ["deal-memo", companyId],
    queryFn: () =>
      api.get(`/companies/${companyId}/deal-memo`).then((r) => r.data),
    enabled: !!companyId,
  });
}

export function useCIMExtracts(companyId: number) {
  return useQuery<{ company_id: number; cim_extracts: CIMExtract[] }>({
    queryKey: ["cim-extracts", companyId],
    queryFn: () =>
      api.get(`/companies/${companyId}/cim`).then((r) => r.data),
    enabled: !!companyId,
  });
}

export function useTriggerScoring(companyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cimExtractId?: number) =>
      api
        .post(`/companies/${companyId}/score`, null, {
          params: cimExtractId ? { cim_extract_id: cimExtractId } : {},
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-score", companyId] });
      qc.invalidateQueries({ queryKey: ["deal-scores", companyId] });
      qc.invalidateQueries({ queryKey: ["deal-memo", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useRegenerateScore(companyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api
        .post(`/companies/${companyId}/score/regenerate`)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-score", companyId] });
      qc.invalidateQueries({ queryKey: ["deal-memo", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUploadCIM(companyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api
        .post(`/companies/${companyId}/cim`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cim-extracts", companyId] });
    },
  });
}

export function useDownloadMemo(companyId: number) {
  return () => {
    window.open(
      `${(import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL || "http://localhost:8000/api"}/companies/${companyId}/deal-memo/pdf`,
      "_blank"
    );
  };
}
