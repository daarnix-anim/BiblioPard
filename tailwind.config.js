/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        adobe: {
          bg: '#181818',
          surface: '#222222',
          card: '#2a2a2a',
          cardHover: '#333333',
          border: '#3c3c3c',
          divider: '#323232',
          text: '#e6e6e6',
          muted: '#9a9a9a',
          accent: '#2680eb',
          accentHover: '#3b8df5',
          gold: '#f59e0b',
          teal: '#14b8a6',
          purple: '#a855f7'
        }
      },
      fontFamily: {
        sans: ['"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
