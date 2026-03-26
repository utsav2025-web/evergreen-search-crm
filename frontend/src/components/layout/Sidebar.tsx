import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
      },
      {
        label: "Pipeline",
        to: "/pipeline",
        icon: <Icon d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />,
      },
    ],
  },
  {
    heading: "DEAL FLOW",
    items: [
      {
        label: "Companies",
        to: "/companies",
        icon: <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
      },
      {
        label: "Broker Listings",
        to: "/broker-listings",
        icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
      },
      {
        label: "Email Ingestion",
        to: "/email-ingest",
        icon: <Icon d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
      },
      {
        label: "Bulk Import",
        to: "/import",
        icon: <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
      },
    ],
  },
  {
    heading: "STRATEGY",
    items: [
      {
        label: "Investment Thesis",
        to: "/thesis",
        icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
      },
    ],
  },
  {
    heading: "OUTREACH",
    items: [
      {
        label: "Outreach",
        to: "/outreach",
        icon: <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
      },
    ],
  },
  {
    heading: "NETWORK",
    items: [
      {
        label: "Brokers",
        to: "/brokers",
        icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
      },
    ],
  },
  {
    heading: "DILIGENCE & CLOSING",
    items: [
      {
        label: "Documents",
        to: "/documents",
        icon: <Icon d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />,
      },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.initials ?? user?.display_name?.slice(0, 2).toUpperCase() ?? "?";
  const avatarColor = user?.avatar_color ?? "bg-blue-600";

  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Evergreen Search</p>
            <p className="text-slate-400 text-xs">Deal Flow</p>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="text-slate-500 text-[10px] font-semibold tracking-widest px-3 mb-1.5">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/dashboard"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: Settings + User */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-0.5 flex-shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`
          }
        >
          <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          Settings
        </NavLink>

        {user && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors group"
          >
            <div className={`w-7 h-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user.display_name}</p>
              <p className="text-slate-500 text-xs">Partner</p>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
