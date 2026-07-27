const AboutPage = () => (
  <section className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-glass backdrop-blur-lg space-y-4">
    <h1 className="text-3xl font-bold text-white">About MediCare Express</h1>
    <p className="text-slate-200 leading-relaxed">
      <strong>MediCare Express</strong> is a next-generation emergency medical dispatch platform designed to minimize ambulance response times through intelligent real-time rerouting.
    </p>
    <div className="grid gap-4 sm:grid-cols-2 pt-4">
      <div className="rounded-xl bg-white/5 p-4 border border-white/10">
        <h3 className="font-semibold text-emerald-400">🌤️ OpenWeatherMap Integration</h3>
        <p className="mt-1 text-xs text-slate-300">Live weather condition, rainfall rate, and visibility penalties.</p>
      </div>
      <div className="rounded-xl bg-white/5 p-4 border border-white/10">
        <h3 className="font-semibold text-cyan-400">🗺️ TomTom Calculate Route API</h3>
        <p className="mt-1 text-xs text-slate-300">High-precision Kolkata driving routes and polyline coordinates.</p>
      </div>
      <div className="rounded-xl bg-white/5 p-4 border border-white/10">
        <h3 className="font-semibold text-indigo-400">📷 OpenCV Computer Vision AI</h3>
        <p className="mt-1 text-xs text-slate-300">Live WebRTC camera capture for vehicle density and speed analysis.</p>
      </div>
      <div className="rounded-xl bg-white/5 p-4 border border-white/10">
        <h3 className="font-semibold text-amber-400">🧠 Python ML Prediction Service</h3>
        <p className="mt-1 text-xs text-slate-300">Machine learning delay model for dynamic route evaluation.</p>
      </div>
    </div>
  </section>
);

export default AboutPage;
