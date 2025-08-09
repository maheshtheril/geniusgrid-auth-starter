/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html','./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0b12',
        border: 'rgba(255,255,255,0.08)',
        muted: 'rgba(255,255,255,0.65)',
      },
      boxShadow: {
        glass: '0 1px 0 rgba(255,255,255,0.06), 0 20px 40px -20px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
