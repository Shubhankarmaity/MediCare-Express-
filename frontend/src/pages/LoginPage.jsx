import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const allowedRoles = ["patient", "driver", "admin"];

const LoginPage = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const safeRole = useMemo(() => (allowedRoles.includes(role) ? role : "patient"), [role]);

  const [email, setEmail] = useState(safeRole === "driver" ? "driver@ambulance.com" : "patient@ambulance.com");
  const [password, setPassword] = useState(safeRole === "driver" ? "driver123" : "patient123");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const fillDemoCredentials = (targetRole) => {
    if (targetRole === "driver") {
      setEmail("driver@ambulance.com");
      setPassword("driver123");
    } else {
      setEmail("patient@ambulance.com");
      setPassword("patient123");
    }
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
      setMessage(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
      <h1 className="text-2xl font-bold capitalize text-white">{safeRole} Login</h1>

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

      {message && <p className="mt-4 text-center text-sm font-medium text-red-400">{message}</p>}
    </section>
  );
};

export default LoginPage;
