/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 10px 30px -10px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        geniusgrid: {
          "color-scheme": "dark",
          // Core brand colors (tweak these five to re-skin the entire app)
          primary:   "#6E8BFF", // electric indigo
          secondary: "#7C5CFF", // violet
          accent:    "#22C55E", // gradient start (AI flair)
          neutral:   "#111317",
          "base-100":"#0B0D10", // main background
          "base-200":"#0F1318", // card background
          "base-300":"#141922", // table rows / hovered
          info:      "#60A5FA",
          success:   "#34D399",
          warning:   "#F59E0B",
          error:     "#F43F5E",

          // Content colors (text)
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "0.75rem",
          "--animation-btn": "0.2s",
          "--btn-text-case": "none",
          "--btn-focus-scale": "0.98",

          // Optional: control subtle borders/alpha
          "--tw-ring-color": "rgba(110,139,255,0.35)",
        },
      },
      "business", // fallback built-in
    ],
  },
};
