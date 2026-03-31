import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  useEnrichmentSettings,
  useUpdateEnrichmentSettings,
} from "@/hooks/useEnrichment";

interface ApiKeyFieldProps {
  label: string;
  description: string;
  docUrl: string;
  isConfigured: boolean;
  keyPreview: string | null;
  onSave: (key: string) => void;
  onClear: () => void;
  isSaving: boolean;
}

function ApiKeyField({
  label,
  description,
  docUrl,
  isConfigured,
  keyPreview,
  onSave,
  onClear,
  isSaving,
}: ApiKeyFieldProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim());
      setValue("");
      setEditing(false);
    }
  };

  return (
    <div className="flex items-start justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-gray-900">{label}</span>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              isConfigured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            )}
          >
            {isConfigured ? "✓ Connected" : "Not configured"}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-1">{description}</p>
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          Get API key →
        </a>
        {isConfigured && keyPreview && (
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Key: {keyPreview}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste API key…"
              className="text-sm border border-gray-300 rounded px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!value.trim() || isSaving}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setValue("");
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50"
            >
              {isConfigured ? "Update key" : "Add key"}
            </button>
            {isConfigured && (
              <button
                onClick={onClear}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function EnrichmentSettingsSection() {
  const { data: settings, isLoading } = useEnrichmentSettings();
  const updateMutation = useUpdateEnrichmentSettings();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-16 bg-gray-100 rounded" />
        <div className="h-16 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">Enrichment API Keys</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Add your Perplexity API key to enable one-click AI enrichment for
          any company — description, industry, revenue, headcount, location,
          and owner contact details.
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        <ApiKeyField
          label="Perplexity API"
          description="Powers AI-driven company enrichment via live web search. Fills in description, industry, revenue, EBITDA, headcount, location, and owner contact info."
          docUrl="https://www.perplexity.ai/settings/api"
          isConfigured={settings?.perplexity_configured ?? false}
          keyPreview={settings?.perplexity_key_preview ?? null}
          onSave={(key) => updateMutation.mutate({ perplexity_api_key: key })}
          onClear={() => updateMutation.mutate({ perplexity_api_key: "" })}
          isSaving={updateMutation.isPending}
        />
      </div>
    </div>
  );
}

export default EnrichmentSettingsSection;
