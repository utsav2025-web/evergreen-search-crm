import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";

// ── Page imports ──────────────────────────────────────────────────────────────
import DashboardPage from "@/pages/DashboardPage";
import PipelinePage from "@/pages/pipeline/PipelinePage";
import CompaniesPage from "@/pages/companies/CompaniesPage";
import CompanyDetailPage from "@/pages/companies/CompanyDetailPage";
import DealsPage from "@/pages/deals/DealsPage";
import DealDetailPage from "@/pages/deals/DealDetailPage";
import OutreachPage from "@/pages/outreach/OutreachPage";
import EmailPage from "@/pages/outreach/EmailPage";
import CallsPage from "@/pages/outreach/CallsPage";
import DocumentsPage from "@/pages/documents/DocumentsPage";
import NDAPage from "@/pages/documents/NDAPage";
import FinancialsPage from "@/pages/financials/FinancialsPage";
import CIMPage from "@/pages/financials/CIMPage";
import BrokerListingsPage from "@/pages/BrokerListingsPage";
import BrokersPage from "@/pages/BrokersPage";
import LendersPage from "@/pages/LendersPage";
import IndustryKBPage from "@/pages/knowledge/IndustryKBPage";
import CompTransactionsPage from "@/pages/knowledge/CompTransactionsPage";
import ActivityFeedPage from "@/pages/activity/ActivityFeedPage";
import DealReviewPage from "@/pages/activity/DealReviewPage";
import EmailInboxPage from "@/pages/email/EmailInboxPage";
import EmailIngestPage from "@/pages/email/EmailIngestPage";
import MobileSearchPage from "@/pages/search/MobileSearchPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ThesisPage from "@/pages/ThesisPage";
import ImportPage from "@/pages/ImportPage";

// ── Protected route wrapper ───────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — all inside AppLayout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Pipeline */}
          <Route path="pipeline" element={<PipelinePage />} />

          {/* Companies */}
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="companies/:id" element={<CompanyDetailPage />} />
          <Route path="companies/new" element={<CompaniesPage />} />

          {/* Deals */}
          <Route path="deals" element={<DealsPage />} />
          <Route path="deals/:id" element={<DealDetailPage />} />

          {/* Outreach */}
          <Route path="outreach" element={<OutreachPage />} />
          <Route path="outreach/email" element={<EmailPage />} />
          <Route path="outreach/calls" element={<CallsPage />} />

          {/* Gmail Inbox */}
          <Route path="inbox" element={<EmailInboxPage />} />

          {/* Email Ingestion */}
          <Route path="email-ingest" element={<EmailIngestPage />} />

          {/* Documents */}
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/nda" element={<NDAPage />} />

          {/* Financials */}
          <Route path="financials" element={<FinancialsPage />} />
          <Route path="financials/cim" element={<CIMPage />} />

          {/* Deal Sourcing */}
          <Route path="broker-listings" element={<BrokerListingsPage />} />
          <Route path="brokers" element={<BrokersPage />} />
          <Route path="lenders" element={<LendersPage />} />

          {/* Knowledge */}
          <Route path="knowledge" element={<IndustryKBPage />} />
          <Route path="knowledge/comps" element={<CompTransactionsPage />} />

          {/* Team */}
          <Route path="activity" element={<ActivityFeedPage />} />
          <Route path="activity/review" element={<DealReviewPage />} />

          {/* Search */}
          <Route path="search" element={<MobileSearchPage />} />

          {/* Settings */}
          <Route path="settings" element={<SettingsPage />} />

          {/* Thesis & Import */}
          <Route path="thesis" element={<ThesisPage />} />
          <Route path="import" element={<ImportPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
