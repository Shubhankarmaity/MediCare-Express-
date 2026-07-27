import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const allowedRoles = ["patient", "driver", "admin"];

const SignupPage = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const safeRole = useMemo(() => (allowedRoles.includes(role) ? role : "patient"), [role]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: safeRole
  });
  const [message, setMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post("/auth/signup", form);
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));
      setMessage(data.message);
      navigate(`/login/${form.role}`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Account creation failed");
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 shadow-glass backdrop-blur-lg">
      <h1 className="text-2xl font-semibold capitalize text-white">Create {safeRole} Account</h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm"
          placeholder="Full name"
          required
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
        />
        <input
          className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
        />
        <input
          className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm"
          placeholder="Password"
          type="password"
          minLength={8}
          required
          value={form.password}
          onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
        />
        <input
          className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm"
          placeholder="Phone"
          required
          value={form.phone}
          onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
        />
        <select
          className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-sm"
          value={form.role}
          onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
        >
          <option value="patient">Patient</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          Create account
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-slate-200">{message}</p> : null}
    </section>
  );
};

export default SignupPage;
