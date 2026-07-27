import { Link } from "react-router-dom";

const LandingPage = () => (
  <div className="space-y-8">
    <section className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 p-10 shadow-2xl backdrop-blur-xl">
      <div className="max-w-2xl">
        <span className="inline-block rounded-full bg-emerald-500/20 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
          ⚡ Next-Gen AI Emergency Dispatch
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          MediCare Express
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">
          Real-time AI Ambulance Dispatch & Rerouting System powered by Live Weather Feeds, OpenCV Camera Vision AI, and Machine Learning Delay Predictions.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/login/patient"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 shadow-lg shadow-emerald-600/30"
          >
            🚑 Request Ambulance (Patient)
          </Link>
          <Link
            to="/login/driver"
            className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/20"
          >
            👨‍✈️ Driver Portal
          </Link>
        </div>
      </div>
    </section>

    <div className="grid gap-6 md:grid-cols-3">
      <article className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
        <div className="mb-3 text-3xl">🧠</div>
        <h3 className="text-lg font-semibold text-white">ML Rerouting Engine</h3>
        <p className="mt-2 text-sm text-slate-300">
          Continuously evaluates traffic density and rain penalties to dynamically switch ambulances to the fastest route.
        </p>
      </article>

      <article className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
        <div className="mb-3 text-3xl">📷</div>
        <h3 className="text-lg font-semibold text-white">OpenCV Camera Vision AI</h3>
        <p className="mt-2 text-sm text-slate-300">
          Drivers can scan live road traffic via device camera to analyze vehicle counts and edge density in real-time.
        </p>
      </article>

      <article className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
        <div className="mb-3 text-3xl">📍</div>
        <h3 className="text-lg font-semibold text-white">Kolkata Live GPS Tracking</h3>
        <p className="mt-2 text-sm text-slate-300">
          Real-time Socket.io driver location broadcasting with high-precision Leaflet map route overlays.
        </p>
      </article>
    </div>
  </div>
);

export default LandingPage;
