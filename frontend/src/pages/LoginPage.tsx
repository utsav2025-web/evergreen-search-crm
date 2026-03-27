import { useEffect, useRef, useState } from "react";
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

  // Step 1 — profile selection
  const [selected, setSelected] = useState<Profile | null>(null);

  // Step 2 — password entry
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    api.get("/auth/profiles")
      .then((r) => setProfiles(r.data))
      .catch(() => setProfiles(FALLBACK_PROFILES));
  }, []);

  // Focus password input when step 2 opens
  useEffect(() => {
    if (selected) {
      setTimeout(() => passwordRef.current?.focus(), 50);
    }
  }, [selected]);

  const handleSelectProfile = (profile: Profile) => {
    setSelected(profile);
    setPassword("");
    setError(null);
  };

  const handleBack = () => {
    setSelected(null);
    setPassword("");
    setError(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/login", {
        username: selected.username,
        password,
      });
      setUser({
        id: res.data.id,
        username: res.data.username,
        display_name: res.data.display_name,
        email: res.data.email ?? null,
        avatar_url: res.data.avatar_url ?? null,
        role: res.data.role ?? "partner",
        initials: res.data.initials ?? selected.initials,
        avatar_color: res.data.avatar_color ?? selected.avatar_color,
      });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 401) {
        setError("Incorrect password. Please try again.");
      } else {
        setError(detail ?? "Could not sign in. Please try again.");
      }
    } finally {
      setLoading(false);
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

        {/* ── Step 1: Profile selector ── */}
        {!selected && (
          <>
            <h2 className="text-white text-lg font-semibold text-center mb-1">Who's signing in?</h2>
            <p className="text-slate-400 text-sm text-center mb-6">Select your profile to continue</p>
            <div className="space-y-3">
              {profiles.map((profile) => (
                <button
                  key={profile.username}
                  onClick={() => handleSelectProfile(profile)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-slate-800 transition-all group"
                >
                  <div className={`w-11 h-11 rounded-full ${profile.avatar_color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {profile.initials}
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
          </>
        )}

        {/* ── Step 2: Password entry ── */}
        {selected && (
          <>
            {/* Selected profile header */}
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-800">
              <div className={`w-11 h-11 rounded-full ${selected.avatar_color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {selected.initials}
              </div>
              <div>
                <p className="text-white font-medium">{selected.display_name}</p>
                <p className="text-slate-400 text-xs">Partner</p>
              </div>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </>
                ) : "Sign In"}
              </button>
            </form>

            <button
              onClick={handleBack}
              className="mt-4 w-full text-slate-500 hover:text-slate-300 text-sm text-center transition-colors"
            >
              ← Back to profiles
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-slate-600 text-xs">© {new Date().getFullYear()} Evergreen Search. Private.</p>
    </div>
  );
}
