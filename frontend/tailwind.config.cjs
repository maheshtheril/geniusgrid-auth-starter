/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // manual, predictable
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aura semantic tokens
        aura: {
          bg: '#0b0b12',
          card: 'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.08)',
          muted: 'rgba(255,255,255,0.68)',
          // brand
          primary: '#6366f1', // indigo-500
          primaryDark: '#4f46e5', // indigo-600
          accent: '#22d3ee', // cyan-400
        },
      },
      boxShadow: {
        glass: '0 1px 0 rgba(255,255,255,0.06), 0 20px 40px -20px rgba(0,0,0,0.5)',
        soft: '0 6px 18px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        xl2: '1rem',
      },
      fontFamily: {
        ui: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      container: {
        center: true,
        padding: '1rem',
        screens: { lg: '1024px', xl: '1240px', '2xl': '1400px' },
      },
    },
  },
  plugins: [],
};
