/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",                  // keep this
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: {
    // ← make sure these exist so btn/select/etc. can render in light
    themes: ["light", "dark", "night"], 
  },
};
