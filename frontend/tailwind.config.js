/** @type {import('tailwindcss').Config} */
import forms from "@tailwindcss/forms";
import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary:   { DEFAULT: "hsl(var(--primary))",   foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive:{ DEFAULT:"hsl(var(--destructive))", foreground:"hsl(var(--destructive-foreground))" },
        muted:     { DEFAULT: "hsl(var(--muted))",     foreground: "hsl(var(--muted-foreground))" },
        accent:    { DEFAULT: "hsl(var(--accent))",    foreground: "hsl(var(--accent-foreground))" },
        popover:   { DEFAULT: "hsl(var(--popover))",   foreground: "hsl(var(--popover-foreground))" },
        card:      { DEFAULT: "hsl(var(--card))",      foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        xl: "var(--radius)",
        "2xl": "calc(var(--radius) + 4px)",
      },
    },
  },
  // IMPORTANT: put forms FIRST, DaisyUI LAST
  plugins: [forms({ strategy: "class" }), daisyui],
  daisyui: {
    themes: [
      {
        geniusgrid: {
          primary:   "#7AA2FF",
          secondary: "#5EEAD4",
          accent:    "#F472B6",
          neutral:   "#2A2F3B",
          "base-100":"#0E1217",
          "base-200":"#141A22",
          "base-300":"#1E2530",
          // ensure readable text on dark base
          "base-content":"#E5E7EB",
          info:      "#60A5FA",
          success:   "#34D399",
          warning:   "#FBBF24",
          error:     "#F87171",
        },
      },
      "dark",
      "light",
      "night",
    ],
    logs: false,
  },
};
