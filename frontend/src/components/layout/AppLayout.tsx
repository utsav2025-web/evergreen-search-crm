import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar — dark navy, hidden on mobile */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content area — light background */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}
