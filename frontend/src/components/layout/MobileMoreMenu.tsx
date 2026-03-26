import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import {
  FileText, BarChart3, Users,
  Landmark, BookOpen, Activity, Settings, TrendingUp,
  Building2, PhoneCall, Shield, Layers,
} from "lucide-react";

interface Props {
  onClose: () => void;
}

const MORE_SECTIONS = [
  {
    title: "Deal Flow",
    items: [
      { label: "Companies",       to: "/companies",         icon: Building2 },
      { label: "Brokers",         to: "/brokers",           icon: Users },
    ],
  },
  {
    title: "Diligence",
    items: [
      { label: "Documents",       to: "/documents",         icon: FileText },
      { label: "NDA",             to: "/documents/nda",     icon: Shield },
      { label: "Financials",      to: "/financials",        icon: BarChart3 },
      { label: "CIM Analysis",    to: "/financials/cim",    icon: TrendingUp },
    ],
  },
  {
    title: "Outreach",
    items: [
      { label: "Outreach",        to: "/outreach",          icon: Activity },
      { label: "Calls",           to: "/outreach/calls",    icon: PhoneCall },
      { label: "Lenders",         to: "/lenders",           icon: Landmark },
    ],
  },
  {
    title: "Knowledge",
    items: [
      { label: "Industry KB",     to: "/knowledge",         icon: BookOpen },
      { label: "Comps",           to: "/knowledge/comps",   icon: Layers },
      { label: "LOI Drafting",    to: "/knowledge/loi",     icon: FileText },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Activity",        to: "/activity",          icon: Activity },
      { label: "Settings",        to: "/settings",          icon: Settings },
    ],
  },
];

export default function MobileMoreMenu({ onClose }: Props) {
  return (
    <div className="md:hidden fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white rounded-t-2xl">
          <h2 className="font-semibold text-slate-900">All Sections</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 pb-10 space-y-5">
          {MORE_SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{section.title}</p>
              <div className="grid grid-cols-4 gap-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
