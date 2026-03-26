import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";

export default function GuestBanner() {
  const { isGuest } = useAuthStore();
  const navigate = useNavigate();

  if (!isGuest) return null;

  return (
    <div className="w-full bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-amber-300">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>
          <strong>Guest mode</strong> — you can view all data but cannot create, edit, or delete anything.
        </span>
      </div>
      <button
        onClick={() => navigate("/login")}
        className="ml-4 text-amber-300 hover:text-amber-100 underline text-xs whitespace-nowrap"
      >
        Sign in as partner
      </button>
    </div>
  );
}
