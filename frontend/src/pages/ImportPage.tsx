import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, CheckCircle2, XCircle, AlertTriangle,
  Download, RefreshCw, ChevronRight, Clock,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

interface ImportJob {
  id: number;
  filename: string;
  status: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  failed_rows: number;
  source_channel: string;
  auto_score: boolean;
  imported_by: string;
  created_at: string;
  completed_at: string | null;
}

interface ImportResult {
  job_id: number;
  status: string;
  total_rows: number;
  imported: number;
  skipped: number;
  failed: number;
  company_ids: number[];
  errors: { row: number; error: string }[];
}

const STAGE_OPTIONS = [
  { value: "lead", label: "Lead (default)" },
  { value: "prospect", label: "Prospect" },
  { value: "contacted", label: "Contacted" },
];

const SOURCE_OPTIONS = [
  { value: "csv_import", label: "CSV / Excel Import" },
  { value: "proprietary", label: "Proprietary / Off-Market" },
  { value: "broker", label: "Broker" },
  { value: "referral", label: "Referral" },
  { value: "conference", label: "Conference / Event" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "bg-emerald-100 text-emerald-700",
    processing: "bg-blue-100 text-blue-700",
    pending: "bg-slate-100 text-slate-600",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default function ImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState("lead");
  const [source, setSource] = useState("csv_import");
  const [autoScore, setAutoScore] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [preview, setPreview] = useState<string[][] | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      const r = await api.get("/import/jobs");
      setJobs(r.data.items || []);
    } catch {
      // ignore
    } finally {
      setLoadingJobs(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);

    // Preview first 5 rows
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").slice(0, 6).filter(Boolean);
      setPreview(lines.map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim())));
    };
    reader.readAsText(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("source_channel", source);
    form.append("default_stage", stage);
    form.append("auto_score", String(autoScore));

    try {
      const r = await api.post("/import/csv", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
      loadJobs();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function downloadTemplate() {
    const r = await api.get("/import/template", { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evergreen_import_template.csv";
    a.click();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Upload className="h-6 w-6 text-blue-600" />
            Bulk Import
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload a CSV or Excel file of companies. The system will auto-create records and score them against your thesis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-3.5 w-3.5 mr-1.5" />CSV Template
        </Button>
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="font-semibold text-slate-900">Upload CSV or Excel File</h2>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${file ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-blue-500" />
              <p className="font-semibold text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Upload className="h-10 w-10" />
              <p className="font-medium text-slate-600">Click to select a CSV or Excel file</p>
              <p className="text-sm">Supports .csv, .xlsx, .xls — or drag and drop</p>
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="text-xs w-full">
              <thead className="bg-slate-50">
                <tr>
                  {preview[0]?.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-slate-600 max-w-[120px] truncate">{cell || <span className="text-slate-300">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 px-3 py-1.5 bg-slate-50 border-t border-slate-200">
              Showing first {preview.length - 1} data rows
            </p>
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Stage</label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Source Channel</label>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScore}
                onChange={e => setAutoScore(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-sm text-slate-700">Auto-score against thesis</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            <XCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
          {uploading ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importing…</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" />Import {file ? `"${file.name}"` : "File"}</>
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.failed > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className="flex items-center gap-2 mb-3">
            {result.failed > 0
              ? <AlertTriangle className="h-5 w-5 text-amber-600" />
              : <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            }
            <h3 className="font-semibold text-slate-900">Import Complete</h3>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              ["Total Rows", result.total_rows, "text-slate-700"],
              ["Imported", result.imported, "text-emerald-700"],
              ["Skipped", result.skipped, "text-amber-700"],
              ["Failed", result.failed, "text-red-700"],
            ].map(([label, val, color]) => (
              <div key={label as string} className="text-center">
                <p className={`text-2xl font-bold ${color}`}>{val}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div className="bg-white rounded-lg border border-amber-200 p-3 mb-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Errors (first 5):</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-slate-600">Row {e.row}: {e.error}</p>
              ))}
            </div>
          )}
          <Button size="sm" onClick={() => navigate("/pipeline")}>
            View in Pipeline <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}

      {/* Column mapping guide */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Supported CSV Columns</h2>
        <p className="text-xs text-slate-500 mb-3">
          Column headers are matched flexibly — use any of these variants. Only <strong>name</strong> is required.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            ["name / company name", "Company name (required)"],
            ["website / url", "Company website"],
            ["industry / sector", "Industry"],
            ["revenue / annual_revenue", "Annual revenue ($)"],
            ["ebitda", "EBITDA ($)"],
            ["asking_price / ask", "Asking price ($)"],
            ["employees / headcount", "Employee count"],
            ["founded_year / established", "Year founded"],
            ["city / location", "City"],
            ["state", "US state (2-letter)"],
            ["owner_name / owner", "Owner name"],
            ["owner_email", "Owner email"],
            ["owner_phone / phone", "Owner phone"],
            ["source / channel", "Lead source"],
            ["description / notes", "Description"],
            ["linkedin_url / linkedin", "LinkedIn URL"],
            ["tags", "Comma-separated tags"],
          ].map(([col, desc]) => (
            <div key={col} className="flex flex-col gap-0.5 bg-slate-50 rounded-lg px-2.5 py-2">
              <code className="font-mono text-blue-700 text-[11px]">{col}</code>
              <span className="text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Revenue and financial values can use <code>$</code>, commas, or <code>M</code>/<code>K</code> suffixes (e.g. <code>$1.5M</code>, <code>1500000</code>, <code>1,500,000</code>).
        </p>
      </div>

      {/* Job History */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Import History</h2>
          <button onClick={loadJobs} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />Refresh
          </button>
        </div>
        {loadingJobs ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-400">No import jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{job.filename || "Unnamed file"}</p>
                  <p className="text-xs text-slate-500">
                    {job.imported_rows} imported · {job.skipped_rows} skipped · {job.failed_rows} failed
                    {" · "}{job.source_channel}
                  </p>
                </div>
                <StatusBadge status={job.status} />
                <div className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
