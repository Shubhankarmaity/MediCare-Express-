import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const allowedRoles = ["patient", "driver", "admin"];

const LoginPage = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const safeRole = useMemo(() => (allowedRoles.includes(role) ? role : "patient"), [role]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));
      navigate(`/dashboard/${data.user.role}`, { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed");
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 shadow-glass backdrop-blur-lg">
      <h1 className="text-2xl font-semibold capitalize text-white">{safeRole} Login</h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm"
          placeholder="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          Login
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-200">
        Don&apos;t have an account?{' '}
        <Link to={`/signup/${safeRole}`} className="font-medium text-brand-400 hover:text-brand-300">
          Create account
        </Link>
      </p>
      {message ? <p className="mt-4 text-sm text-slate-200">{message}</p> : null}
    </section>
  );
};

export default LoginPage;
