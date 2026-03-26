import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,   // send session cookie
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically add trailing slash to collection endpoints (prevents FastAPI 307 redirect issues)
api.interceptors.request.use((config) => {
  if (config.url) {
    // Add trailing slash if URL ends with a path segment (no slash, no query, no file extension)
    // e.g. /broker-listings?foo=bar  →  /broker-listings/?foo=bar
    config.url = config.url.replace(/^(\/[a-z][a-z0-9-]*)(?=\?|$)/, '$1/');
  }
  return config;
});

// On 401: clear auth state (let React Router handle redirect — no hard page reload)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Only clear auth if we're not already on the login page or fetching public endpoints
      const url = err.config?.url ?? "";
      const isPublicEndpoint = url.includes("/auth/profiles") || url.includes("/auth/login");
      if (!isPublicEndpoint) {
        const { logout } = useAuthStore.getState();
        logout();
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Typed API helpers ──────────────────────────────────────────────────────

export const authApi = {
  login: (username: string) =>
    api.post("/auth/login", { username }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  partners: () => api.get("/auth/partners"),
};

export const companiesApi = {
  list: (params?: Record<string, unknown>) => api.get("/companies", { params }),
  get: (id: number) => api.get(`/companies/${id}`),
  create: (data: Record<string, unknown>) => api.post("/companies", data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/companies/${id}`, data),
  delete: (id: number) => api.delete(`/companies/${id}`),
};

export const dealsApi = {
  list: (params?: Record<string, unknown>) => api.get("/deals", { params }),
  get: (id: number) => api.get(`/deals/${id}`),
  create: (data: Record<string, unknown>) => api.post("/deals", data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/deals/${id}`, data),
  updateStage: (id: number, stage: string) => api.patch(`/deals/${id}/stage`, { stage }),
  delete: (id: number) => api.delete(`/deals/${id}`),
};

export const pipelineApi = {
  board: () => api.get("/pipeline/board"),
  stats: () => api.get("/pipeline/stats"),
};

export const contactsApi = {
  list: (params?: Record<string, unknown>) => api.get("/contacts", { params }),
  get: (id: number) => api.get(`/contacts/${id}`),
  create: (data: Record<string, unknown>) => api.post("/contacts", data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/contacts/${id}`, data),
};

export const emailApi = {
  authorize: () => api.get("/email/oauth/authorize"),
  sync: () => api.post("/email/sync"),
  threads: (params?: Record<string, unknown>) => api.get("/email/threads", { params }),
  thread: (id: number) => api.get(`/email/threads/${id}`),
};

export const outreachApi = {
  list: (params?: Record<string, unknown>) => api.get("/outreach", { params }),
  create: (data: Record<string, unknown>) => api.post("/outreach", data),
  send: (id: number) => api.post(`/outreach/${id}/send`),
  templates: () => api.get("/outreach/templates"),
};

export const documentsApi = {
  list: (params?: Record<string, unknown>) => api.get("/documents", { params }),
  upload: (formData: FormData) =>
    api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  download: (id: number) => api.get(`/documents/${id}/download`),
  delete: (id: number) => api.delete(`/documents/${id}`),
};

export const financialsApi = {
  list: (params?: Record<string, unknown>) => api.get("/financials", { params }),
  create: (data: Record<string, unknown>) => api.post("/financials", data),
  import: (formData: FormData) =>
    api.post("/financials/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const cimApi = {
  parse: (documentId: number, companyId: number) =>
    api.post("/cim/parse", null, { params: { document_id: documentId, company_id: companyId } }),
  get: (companyId: number) => api.get(`/cim/${companyId}`),
  score: (companyId: number) => api.post(`/cim/score/${companyId}`),
};

export const brokersApi = {
  list: () => api.get("/brokers"),
  get: (id: number) => api.get(`/brokers/${id}`),
  create: (data: Record<string, unknown>) => api.post("/brokers", data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/brokers/${id}`, data),
};

export const lendersApi = {
  list: () => api.get("/lenders"),
  get: (id: number) => api.get(`/lenders/${id}`),
  create: (data: Record<string, unknown>) => api.post("/lenders", data),
};

export const ndasApi = {
  list: () => api.get("/ndas"),
  create: (data: Record<string, unknown>) => api.post("/ndas", data),
  send: (id: number) => api.post(`/ndas/${id}/send`),
  aiReview: (id: number) => api.post(`/ndas/${id}/ai-review`),
};

export const callLogsApi = {
  list: (params?: Record<string, unknown>) => api.get("/call-logs", { params }),
  schedule: (data: Record<string, unknown>) => api.post("/call-logs", data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/call-logs/${id}`, data),
  prep: (id: number) => api.post(`/call-logs/${id}/prep`),
  complete: (id: number, data: Record<string, unknown>) =>
    api.post(`/call-logs/${id}/complete`, data),
};

export const activityApi = {
  feed: (limit = 50) => api.get("/activity/feed", { params: { limit } }),
  company: (companyId: number) => api.get(`/activity/company/${companyId}`),
};

export const industryKbApi = {
  list: (params?: Record<string, unknown>) => api.get("/industry-kb", { params }),
  create: (data: Record<string, unknown>) => api.post("/industry-kb", data),
};

export const compTransactionsApi = {
  list: (params?: Record<string, unknown>) => api.get("/comp-transactions", { params }),
  multiples: (industry: string) =>
    api.get("/comp-transactions/multiples", { params: { industry } }),
};

export const enrichmentApi = {
  enrich: (companyId: number) => api.post(`/enrichment/company/${companyId}`),
};
