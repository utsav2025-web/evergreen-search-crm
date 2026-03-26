import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import NotificationsPanel from "./NotificationsPanel";
import api from "@/lib/api";

const PAGE_TITLES: Record<string, string> = {
  "/":                    "Dashboard",
  "/dashboard":           "Dashboard",
  "/pipeline":            "Deal Pipeline",
  "/companies":           "Companies",
  "/deals":               "Deals",
  "/outreach":            "Outreach",
  "/outreach/email":      "Email",
  "/outreach/calls":      "Calls",
  "/documents":           "Documents",
  "/documents/nda":       "NDAs",
  "/financials":          "Financials",
  "/financials/cim":      "CIM Analysis",
  "/broker-listings":     "Broker Listings",
  "/brokers":             "Broker CRM",
  "/lenders":             "Lenders",
  "/knowledge":           "Industry Knowledge Base",
  "/knowledge/comps":     "Comp Transactions",
  "/knowledge/loi":       "LOI Drafting",
  "/activity":            "Activity Feed",
  "/activity/review":     "Deal Review",
  "/settings":            "Settings",
  "/search":              "Search",
};

export default function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuthStore();

  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    "Evergreen Search";

  const handleLogout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    logout();
    navigate("/login");
  };

  const initials = user?.display_name
    ? user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b bg-white flex-shrink-0">
      <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Notifications bell */}
        <NotificationsPanel />

        {/* User avatar + dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${isGuest ? "bg-amber-500" : "bg-blue-600"}`}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
              ) : (
                initials
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-700 leading-tight">
                {user?.display_name}
              </p>
              {isGuest && (
                <p className="text-[10px] text-amber-600 font-medium leading-tight">Guest</p>
              )}
            </div>
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-900">{user?.display_name}</p>
              <p className="text-xs text-gray-400">{user?.email ?? (isGuest ? "Guest account" : "")}</p>
            </div>
            {!isGuest && (
              <button
                onClick={() => navigate("/settings")}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Settings
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-xl"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
