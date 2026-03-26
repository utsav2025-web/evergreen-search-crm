import { useState, useEffect } from "react";
import { X, Sparkles, Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  useExtractCompanyFromEmail,
  useConfirmCreateCompany,
  EmailThread,
} from "@/hooks/useEmail";

interface Props {
  thread: EmailThread;
  onClose: () => void;
}

interface CompanyFormData {
  name: string;
  industry: string;
  sub_industry: string;
  city: string;
  state: string;
  asking_price: string;
  annual_revenue: string;
  ebitda: string;
  employees: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  description: string;
  deal_stage: string;
}

const EMPTY_FORM: CompanyFormData = {
  name: "", industry: "", sub_industry: "", city: "", state: "",
  asking_price: "", annual_revenue: "", ebitda: "", employees: "",
  owner_name: "", owner_email: "", owner_phone: "",
  description: "", deal_stage: "prospect",
};

function formatMoney(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  return String(val);
}

export function CreateCompanyModal({ thread, onClose }: Props) {
  const [form, setForm] = useState<CompanyFormData>(EMPTY_FORM);
  const [aiExtracted, setAiExtracted] = useState(false);
  const [created, setCreated] = useState<{ company_id: number; company_name: string } | null>(null);

  const extract = useExtractCompanyFromEmail();
  const confirm = useConfirmCreateCompany();

  // Auto-trigger AI extraction on mount
  useEffect(() => {
    extract.mutate(
      { threadId: thread.id, useAi: true },
      {
        onSuccess: (data) => {
          const p = data.prefill as Record<string, unknown>;
          setForm({
            name: String(p.name || ""),
            industry: String(p.industry || ""),
            sub_industry: String(p.sub_industry || ""),
            city: String(p.city || ""),
            state: String(p.state || ""),
            asking_price: formatMoney(p.asking_price),
            annual_revenue: formatMoney(p.annual_revenue),
            ebitda: formatMoney(p.ebitda),
            employees: formatMoney(p.employees),
            owner_name: String(p.owner_name || ""),
            owner_email: String(p.owner_email || ""),
            owner_phone: String(p.owner_phone || ""),
            description: String(p.description || ""),
            deal_stage: String(p.deal_stage || "prospect"),
          });
          setAiExtracted(true);
        },
      }
    );
  }, [thread.id]);

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      deal_stage: form.deal_stage,
      source: "email",
    };
    if (form.industry) payload.industry = form.industry;
    if (form.sub_industry) payload.sub_industry = form.sub_industry;
    if (form.city) payload.city = form.city;
    if (form.state) payload.state = form.state;
    if (form.asking_price) payload.asking_price = parseFloat(form.asking_price);
    if (form.annual_revenue) payload.annual_revenue = parseFloat(form.annual_revenue);
    if (form.ebitda) payload.ebitda = parseFloat(form.ebitda);
    if (form.employees) payload.employees = parseInt(form.employees);
    if (form.owner_name) payload.owner_name = form.owner_name;
    if (form.owner_email) payload.owner_email = form.owner_email;
    if (form.owner_phone) payload.owner_phone = form.owner_phone;
    if (form.description) payload.description = form.description;

    confirm.mutate(
      { threadId: thread.id, companyData: payload },
      {
        onSuccess: (data) => {
          setCreated({ company_id: data.company_id, company_name: data.company_name });
        },
      }
    );
  };

  const field = (key: keyof CompanyFormData, label: string, type = "text", placeholder = "") => (
    <div>
      <Label className="text-xs font-medium text-gray-600 mb-1 block">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder || label}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="h-8 text-sm"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Create Company from Email</h2>
            {aiExtracted && (
              <Badge className="gap-1 bg-purple-100 text-purple-700 border-0 text-xs">
                <Sparkles className="w-3 h-3" />
                AI Pre-filled
              </Badge>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source email info */}
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            From: <strong>{thread.sender_email}</strong> · {thread.subject}
          </span>
        </div>

        {/* Loading state */}
        {extract.isPending && (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm">Extracting company data with AI...</span>
          </div>
        )}

        {/* Success state */}
        {created ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <h3 className="font-semibold text-gray-900 text-lg">{created.company_name}</h3>
            <p className="text-sm text-gray-500">Company created and linked to this email thread</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button
                onClick={() => window.open(`/companies/${created.company_id}`, "_blank")}
                className="gap-1.5"
              >
                <Building2 className="w-4 h-4" />
                View Company
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Form */}
            {!extract.isPending && (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Business Info */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Business Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">{field("name", "Business Name *")}</div>
                    {field("industry", "Industry")}
                    {field("sub_industry", "Sub-Industry")}
                    {field("city", "City")}
                    {field("state", "State")}
                  </div>
                </div>

                <Separator />

                {/* Financials */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Financials
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {field("asking_price", "Asking Price ($)", "number", "e.g. 3500000")}
                    {field("annual_revenue", "Annual Revenue ($)", "number")}
                    {field("ebitda", "EBITDA ($)", "number")}
                    {field("employees", "Employees", "number")}
                  </div>
                </div>

                <Separator />

                {/* Owner / Broker */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Owner / Broker Contact
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {field("owner_name", "Owner / Broker Name")}
                    {field("owner_email", "Email", "email")}
                    {field("owner_phone", "Phone", "tel")}
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1 block">Description</Label>
                  <textarea
                    className="w-full h-20 text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Business description..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            {!extract.isPending && (
              <div className="px-5 py-4 border-t flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={onClose} className="text-gray-500">
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => extract.mutate({ threadId: thread.id, useAi: true })}
                    className="gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Re-extract
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!form.name || confirm.isPending}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                  >
                    {confirm.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                    Create Company
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
