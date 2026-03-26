import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import WriteGuard from "@/components/layout/WriteGuard";

interface Broker {
  id: number;
  name: string;
  firm: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  specialty_industries: string[];
  states_covered: string[];
  avg_deal_size_min: number | null;
  avg_deal_size_max: number | null;
  relationship_strength: string | null;
  notes: string | null;
  active_listings_count: number;
  total_deals_count: number;
  created_at: string;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  cold: "bg-gray-100 text-gray-600",
  warm: "bg-yellow-100 text-yellow-700",
  strong: "bg-green-100 text-green-700",
  top: "bg-blue-100 text-blue-700",
};

const fmt = (n: number | null) => {
  if (n == null) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

export default function BrokersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    firm: "",
    email: "",
    phone: "",
    website: "",
    specialty_industries: "",
    states_covered: "",
    relationship_strength: "cold",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["brokers"],
    queryFn: () => api.get("/brokers/?limit=200").then((r) => r.data),
  });
  const brokers: Broker[] = data?.items || [];

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post("/brokers/", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brokers"] });
      setShowModal(false);
      setForm({ name: "", firm: "", email: "", phone: "", website: "", specialty_industries: "", states_covered: "", relationship_strength: "cold", notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/brokers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brokers"] }),
  });

  const filtered = brokers.filter(
    (b) =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.firm || "").toLowerCase().includes(search.toLowerCase()) ||
      (b.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    createMutation.mutate({
      name: form.name,
      firm: form.firm || null,
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      specialty_industries: form.specialty_industries
        ? form.specialty_industries.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      states_covered: form.states_covered
        ? form.states_covered.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      relationship_strength: form.relationship_strength,
      notes: form.notes || null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broker CRM</h1>
          <p className="text-sm text-gray-500 mt-1">M&A broker directory and relationship management</p>
        </div>
        <WriteGuard>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Add Broker
          </button>
        </WriteGuard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{brokers.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Brokers</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">
            {brokers.filter((b) => b.relationship_strength === "strong" || b.relationship_strength === "top").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Strong Relationships</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {brokers.reduce((s, b) => s + (b.active_listings_count || 0), 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Active Listings</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {brokers.reduce((s, b) => s + (b.total_deals_count || 0), 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Deals</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search brokers by name, firm, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Broker Cards */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Loading brokers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-lg font-semibold text-gray-700">No brokers yet</h3>
          <p className="text-sm text-gray-500 mt-1">Add M&A brokers to track your relationships and listings</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((broker) => (
            <div key={broker.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{broker.name}</h3>
                    {broker.relationship_strength && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RELATIONSHIP_COLORS[broker.relationship_strength] || "bg-gray-100 text-gray-600"}`}>
                        {broker.relationship_strength}
                      </span>
                    )}
                  </div>
                  {broker.firm && <div className="text-sm text-gray-600 mb-2">{broker.firm}</div>}
                  <div className="space-y-1 text-xs text-gray-500">
                    {broker.email && (
                      <div className="flex items-center gap-1">
                        <span>✉</span>
                        <a href={`mailto:${broker.email}`} className="text-blue-600 hover:underline">{broker.email}</a>
                      </div>
                    )}
                    {broker.phone && (
                      <div className="flex items-center gap-1">
                        <span>📞</span>
                        <span>{broker.phone}</span>
                      </div>
                    )}
                    {broker.specialty_industries && broker.specialty_industries.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {broker.specialty_industries.map((ind) => (
                          <span key={ind} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{ind}</span>
                        ))}
                      </div>
                    )}
                    {broker.states_covered && broker.states_covered.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {broker.states_covered.map((st) => (
                          <span key={st} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{st}</span>
                        ))}
                      </div>
                    )}
                    {(broker.avg_deal_size_min || broker.avg_deal_size_max) && (
                      <div>
                        Deal size: {fmt(broker.avg_deal_size_min)} — {fmt(broker.avg_deal_size_max)}
                      </div>
                    )}
                  </div>
                  {broker.notes && (
                    <p className="text-xs text-gray-500 mt-2 italic">{broker.notes}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-700">{broker.active_listings_count}</div>
                    <div className="text-xs text-gray-400">listings</div>
                  </div>
                  <WriteGuard>
                    <button
                      onClick={() => { if (confirm("Delete this broker?")) deleteMutation.mutate(broker.id); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </WriteGuard>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Broker</h2>
            <div className="space-y-3">
              {[
                { key: "name", label: "Full Name *", placeholder: "James Whitfield" },
                { key: "firm", label: "Firm", placeholder: "Whitfield M&A Advisors" },
                { key: "email", label: "Email", placeholder: "james@whitfieldma.com" },
                { key: "phone", label: "Phone", placeholder: "555-123-4567" },
                { key: "website", label: "Website", placeholder: "https://whitfieldma.com" },
                { key: "specialty_industries", label: "Industries (comma-separated)", placeholder: "HVAC, Plumbing, Pest Control" },
                { key: "states_covered", label: "States (comma-separated)", placeholder: "TX, OK, AR" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Relationship</label>
                <select
                  value={form.relationship_strength}
                  onChange={(e) => setForm({ ...form, relationship_strength: e.target.value })}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                >
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="strong">Strong</option>
                  <option value="top">Top Relationship</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreate}
                disabled={!form.name || createMutation.isPending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving…" : "Add Broker"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
