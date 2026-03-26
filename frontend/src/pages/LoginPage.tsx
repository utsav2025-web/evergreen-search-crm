import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

interface Profile {
  username: string;
  display_name: string;
  initials: string;
  avatar_color: string;
}

const FALLBACK_PROFILES: Profile[] = [
  { username: "matt",  display_name: "Matt",  initials: "MW", avatar_color: "bg-blue-600" },
  { username: "utsav", display_name: "Utsav", initials: "UP", avatar_color: "bg-emerald-600" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, setUser } = useAuthStore();
  const [profiles, setProfiles] = useState<Profile[]>(FALLBACK_PROFILES);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    api.get("/auth/profiles")
      .then((r) => setProfiles(r.data))
      .catch(() => setProfiles(FALLBACK_PROFILES));
  }, []);

  const handleSelect = async (profile: Profile) => {
    setLoading(profile.username);
    setError(null);
    try {
      const res = await api.post("/auth/login", { username: profile.username });
      setUser({
        id: res.data.id,
        username: res.data.username,
        display_name: res.data.display_name,
        email: res.data.email ?? null,
        avatar_url: res.data.avatar_url ?? null,
        role: res.data.role ?? "partner",
        initials: res.data.initials ?? profile.initials,
        avatar_color: res.data.avatar_color ?? profile.avatar_color,
      });
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Brand */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Evergreen Search</span>
        </div>
        <p className="text-slate-400 text-sm">Deal Flow Platform</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-white text-lg font-semibold text-center mb-1">Who's signing in?</h2>
        <p className="text-slate-400 text-sm text-center mb-6">Select your profile to continue</p>

        <div className="space-y-3">
          {profiles.map((profile) => (
            <button
              key={profile.username}
              onClick={() => handleSelect(profile)}
              disabled={!!loading}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-slate-800 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className={`w-11 h-11 rounded-full ${profile.avatar_color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {loading === profile.username ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : profile.initials}
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-medium">{profile.display_name}</p>
                <p className="text-slate-400 text-xs">Partner</p>
              </div>
              <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
      </div>

      <p className="mt-8 text-slate-600 text-xs">© {new Date().getFullYear()} Evergreen Search. Private.</p>
    </div>
  );
}
