/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#3b82f6",
          600: "#2563eb"
        }
      },
      boxShadow: {
        glass: "0 8px 24px rgba(0, 0, 0, 0.25)"
      }
    }
  },
  plugins: []
};
