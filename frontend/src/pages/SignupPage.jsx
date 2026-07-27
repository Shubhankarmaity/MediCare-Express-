import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const allowedRoles = ["patient", "driver", "admin"];

const SignupPage = () => {
  const { role } = useParams();
  const safeRole = useMemo(() => (allowedRoles.includes(role) ? role : "patient"), [role]);

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/30 p-8 text-center shadow-2xl backdrop-blur-lg">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-3xl">
        ⚠️
      </div>

      <h1 className="text-2xl font-bold text-white">Create {safeRole} Account</h1>

      {/* Required Display Message */}
      <div className="my-6 rounded-xl border border-amber-400/50 bg-amber-500/10 p-4">
        <p className="text-base font-semibold text-amber-300">
          the service is on temporaryly close
        </p>
        <p className="mt-1 text-xs text-slate-300">
          New user registration is currently paused. Please use the default demo accounts below to explore the platform.
        </p>
      </div>

      {/* Demo Credentials Guidance */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left text-xs space-y-2 text-slate-300">
        <p className="font-semibold text-white">🔑 Default Demo Credentials:</p>
        <div className="rounded bg-black/40 p-2 font-mono">
          <p>🏥 <strong className="text-emerald-400">Patient:</strong> patient@ambulance.com / patient123</p>
          <p>🚑 <strong className="text-cyan-400">Driver:</strong> driver@ambulance.com / driver123</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          to={`/login/${safeRole}`}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Go to {safeRole} Login →
        </Link>
        <Link to="/" className="text-xs text-slate-400 hover:text-white">
          ← Back to Home
        </Link>
      </div>
    </section>
  );
};

export default SignupPage;
