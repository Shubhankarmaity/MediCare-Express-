import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getBackendUrl } from "../services/api";

const allowedRoles = ["patient", "driver", "admin"];

const LoginPage = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const safeRole = useMemo(() => (allowedRoles.includes(role) ? role : "patient"), [role]);

  const [email, setEmail] = useState(safeRole === "driver" ? "driver@ambulance.com" : "patient@ambulance.com");
  const [password, setPassword] = useState(safeRole === "driver" ? "driver123" : "patient123");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Custom live backend URL modal state
  const [currentBackendUrl, setCurrentBackendUrl] = useState(getBackendUrl());
  const [showBackendConfig, setShowBackendConfig] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(getBackendUrl());

  const fillDemoCredentials = (targetRole) => {
    if (targetRole === "driver") {
      setEmail("driver@ambulance.com");
      setPassword("driver123");
    } else {
      setEmail("patient@ambulance.com");
      setPassword("patient123");
    }
  };

  const saveBackendUrl = (event) => {
    event.preventDefault();
    if (!customUrlInput.trim()) return;
    let clean = customUrlInput.trim().replace(/\/+$/, "");
    if (!clean.endsWith("/api")) clean += "/api";
    localStorage.setItem("LIVE_BACKEND_URL", clean);
    setCurrentBackendUrl(clean);
    setShowBackendConfig(false);
    setMessage("✅ Backend URL updated successfully!");
  };

  const resetBackendUrl = () => {
    localStorage.removeItem("LIVE_BACKEND_URL");
    const defaultUrl = getBackendUrl();
    setCurrentBackendUrl(defaultUrl);
    setCustomUrlInput(defaultUrl);
    setShowBackendConfig(false);
    setMessage("Reset to default Backend URL.");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));
      window.dispatchEvent(new Event("authChange"));
      navigate(`/dashboard/${data.user.role}`, { replace: true });
    } catch (error) {
      const errText = error.response?.data?.message || error.message;
      if (errText.includes("timeout") || errText.includes("10000ms") || errText.includes("60000ms")) {
        setMessage("⏳ Render backend is currently waking up from free-tier sleep mode (cold start takes ~30 seconds). Please click Login again in a few seconds!");
      } else if (errText.includes("Network Error") || errText.includes("ERR_CONNECTION_REFUSED")) {
        setMessage(`⚠️ Cannot connect to Backend at "${currentBackendUrl}". Click "⚙️ Backend URL" above to verify your live Render URL.`);
        setShowBackendConfig(true);
      } else {
        setMessage(errText || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold capitalize text-white">{safeRole} Login</h1>
        <button
          type="button"
          onClick={() => setShowBackendConfig(!showBackendConfig)}
          className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
          title="Configure Live Render Backend API URL"
        >
          ⚙️ Backend URL
        </button>
      </div>

      {/* Backend URL Config Card */}
      {showBackendConfig && (
        <form onSubmit={saveBackendUrl} className="mt-4 rounded-xl border border-cyan-400/40 bg-slate-950/80 p-4 text-xs space-y-3">
          <p className="font-semibold text-cyan-300">🔗 Set Live Render Backend URL:</p>
          <input
            className="w-full rounded border border-white/20 bg-slate-900 px-3 py-2 text-xs font-mono text-cyan-200"
            placeholder="https://your-backend.onrender.com/api"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-cyan-600 px-3 py-1.5 font-semibold text-white hover:bg-cyan-500">
              Save & Connect
            </button>
            <button type="button" onClick={resetBackendUrl} className="rounded border border-white/20 px-3 py-1.5 text-slate-300 hover:bg-white/10">
              Reset
            </button>
          </div>
        </form>
      )}

      {/* Demo helper chip */}
      <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-slate-300">
        <p className="font-semibold text-emerald-300">🔑 Auto-Fill Demo Credentials:</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => fillDemoCredentials("patient")}
            className="rounded bg-emerald-600/40 px-2.5 py-1 font-mono text-[11px] text-emerald-200 hover:bg-emerald-600/60"
          >
            Patient Demo
          </button>
          <button
            type="button"
            onClick={() => fillDemoCredentials("driver")}
            className="rounded bg-cyan-600/40 px-2.5 py-1 font-mono text-[11px] text-cyan-200 hover:bg-cyan-600/60"
          >
            Driver Demo
          </button>
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Email</label>
          <input
            className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3.5 py-2.5 text-sm text-white"
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Password</label>
          <input
            className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3.5 py-2.5 text-sm text-white"
            placeholder="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Login →"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-300">
        New user?{" "}
        <Link to={`/signup/${safeRole}`} className="font-semibold text-emerald-400 hover:underline">
          Create account
        </Link>
      </p>

      {message && <p className="mt-4 text-center text-xs font-medium text-amber-300 leading-relaxed">{message}</p>}
    </section>
  );
};

export default LoginPage;
