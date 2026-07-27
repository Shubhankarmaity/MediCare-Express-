import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import LandingPage from "../pages/LandingPage";
import AboutPage from "../pages/AboutPage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import PatientDashboard from "../pages/PatientDashboard";
import DriverDashboard from "../pages/DriverDashboard";

const Header = ({ darkMode, onToggleTheme }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = () => {
      const stored = localStorage.getItem("authUser");
      setUser(stored ? JSON.parse(stored) : null);
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    // Also listen for custom event for same-tab updates
    window.addEventListener("authChange", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("authChange", checkAuth);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-white/15 bg-slate-950/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          🚑 <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">MediCare Express</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/about" className="text-sm text-slate-200 hover:text-white">
            About
          </Link>
          {user ? (
            <Link
              to={`/dashboard/${user.role}`}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login/patient" className="text-sm text-slate-200 hover:text-white">
                Login
              </Link>
              <Link to="/signup/patient" className="text-sm text-slate-200 hover:text-white">
                Create account
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-lg border border-white/20 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
          >
            {darkMode ? "Light" : "Dark"} Mode
          </button>
        </nav>
      </div>
    </header>
  );
};

const AppRouter = ({ darkMode, onToggleTheme }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
    <Header darkMode={darkMode} onToggleTheme={onToggleTheme} />
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login/:role" element={<LoginPage />} />
        <Route path="/signup/:role" element={<SignupPage />} />
        <Route path="/dashboard/patient" element={<PatientDashboard />} />
        <Route path="/dashboard/driver" element={<DriverDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
);

export default AppRouter;

