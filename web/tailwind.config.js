/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Gris cálido tipo papel + un único acento azul ultramar
        ink: { 50: '#f7f7f5', 100: '#efefec', 200: '#e1e1dd', 300: '#c9c9c3', 400: '#9a9a93', 500: '#6e6e68', 600: '#4d4d49', 700: '#363633', 800: '#242422', 900: '#171716', 950: '#0e0e0d' },
        accent: { DEFAULT: '#3b5bdb', soft: '#dbe4ff', dark: '#748ffc' },
      },
    },
  },
  plugins: [],
};
