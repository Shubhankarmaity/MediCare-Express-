import { useEffect, useState } from "react";
import AppRouter from "./routes/AppRouter";

const App = () => {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("theme");
    return stored ? stored === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return <AppRouter darkMode={darkMode} onToggleTheme={() => setDarkMode((v) => !v)} />;
};

export default App;
