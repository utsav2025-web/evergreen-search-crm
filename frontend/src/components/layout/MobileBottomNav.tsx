import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Kanban,
  Search,
  Mail,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useState } from "react";
import MobileMoreMenu from "./MobileMoreMenu";

const PRIMARY_NAV = [
  { label: "Home",     to: "/dashboard",  icon: LayoutDashboard },
  { label: "Pipeline", to: "/pipeline",   icon: Kanban },
  { label: "Search",   to: "/search",     icon: Search },
  { label: "Inbox",    to: "/inbox",      icon: Mail },
];

export default function MobileBottomNav() {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-bottom">
        <div className="flex items-center justify-around h-16 relative">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                  isActive ? "text-blue-600" : "text-slate-500"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 text-xs text-slate-500"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Floating action button — Add Company */}
      <button
        onClick={() => navigate("/companies/new")}
        className="md:hidden fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
        aria-label="Add Company"
      >
        <Plus className="h-5 w-5" />
      </button>

      {/* More menu overlay */}
      {showMore && <MobileMoreMenu onClose={() => setShowMore(false)} />}
    </>
  );
}
