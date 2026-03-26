import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EnrichmentSettingsSection } from "./EnrichmentSettingsSection";

const API = "/api";

interface GmailStatus {
  is_connected: boolean;
  email_address: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  initial_sync_done: boolean;
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchGmailStatus = async () => {
    try {
      const res = await fetch(`${API}/email/sync/status`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setGmailStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setGmailLoading(false);
    }
  };

  useEffect(() => {
    fetchGmailStatus();
    // If redirected back from Google OAuth with ?gmail=connected
    if (searchParams.get("gmail") === "connected") {
      showToast("Gmail connected successfully! Starting initial sync...", "success");
      // Trigger initial sync
      setTimeout(() => {
        fetch(`${API}/email/sync`, { method: "POST", credentials: "include" })
          .then(() => fetchGmailStatus())
          .catch(() => {});
      }, 1500);
    }
  }, []);

  const handleConnectGmail = () => {
    // Navigate to the OAuth authorize endpoint — it will redirect to Google
    window.location.href = `${API}/email/oauth/authorize`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Gmail? This will stop email syncing and remove stored credentials.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API}/email/oauth/disconnect`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        showToast("Gmail disconnected.", "success");
        setGmailStatus(null);
        await fetchGmailStatus();
      } else {
        showToast("Failed to disconnect Gmail.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/email/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        showToast("Sync started! New emails will appear in your inbox shortly.", "success");
        setTimeout(() => fetchGmailStatus(), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Sync failed.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure integrations and API keys for Evergreen Search.
        </p>
      </div>

      {/* Gmail Integration */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Gmail icon */}
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" stroke="#EA4335" strokeWidth="1.5" fill="none"/>
                <path d="M2 6L12 13L22 6" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Gmail Integration</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Sync broker emails and deal teasers directly into your pipeline.
              </p>
            </div>
          </div>
          {/* Status badge */}
          {!gmailLoading && (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                gmailStatus?.is_connected
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {gmailStatus?.is_connected ? "Connected" : "Not connected"}
            </span>
          )}
        </div>

        {gmailLoading ? (
          <div className="mt-4 text-sm text-gray-400 animate-pulse">Checking connection status...</div>
        ) : gmailStatus?.is_connected ? (
          <div className="mt-4 space-y-3">
            {/* Connected account info */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-emerald-800">
                  {gmailStatus.email_address || "Gmail account connected"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-emerald-700">
                <div>
                  <span className="font-medium">Last sync:</span>{" "}
                  {formatDate(gmailStatus.last_sync_at)}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  {gmailStatus.last_sync_status || "—"}
                </div>
                <div>
                  <span className="font-medium">Initial sync:</span>{" "}
                  {gmailStatus.initial_sync_done ? "Complete" : "Pending"}
                </div>
              </div>
              {gmailStatus.last_sync_error && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                  Last error: {gmailStatus.last_sync_error}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Now
                  </>
                )}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Syncing reads your Gmail inbox for broker emails and deal teasers. No emails are sent from this app.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600">
              Connect your Gmail account to automatically pull broker emails and deal teasers into your inbox. 
              The app only reads emails — outbound sending is disabled.
            </p>
            <button
              onClick={handleConnectGmail}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Gmail with Google
            </button>
            <p className="text-xs text-gray-400">
              You'll be redirected to Google to authorize read-only access to your inbox.
            </p>
          </div>
        )}
      </div>

      {/* Enrichment API Keys */}
      <EnrichmentSettingsSection />

      {/* Outbound Communications */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Outbound Communications</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Email sending, SMS, and call automation.
            </p>
          </div>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            Disabled
          </span>
        </div>
        <p className="text-sm text-gray-600">
          All outbound communications are currently disabled. The system is in read-only / intake mode only. 
          No emails, SMS messages, or automated calls will be sent from this platform.
        </p>
      </div>

      {/* Account */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">User Accounts</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Matt and Utsav — full access. Guest — read-only.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {[
            { name: "matt", label: "Matt", role: "Admin" },
            { name: "utsav", label: "Utsav", role: "Admin" },
            { name: "guest", label: "Guest", role: "Read-only" },
          ].map((u) => (
            <div key={u.name} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="font-medium text-gray-900">{u.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{u.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
