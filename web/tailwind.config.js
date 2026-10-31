/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#060a12',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
          glow: 'rgb(var(--color-accent-glow) / <alpha-value>)',
          soft: 'rgb(var(--color-accent-soft) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'spin-slow': 'spin 18s linear infinite',
        'lsd-hue': 'lsdHue 8s linear infinite',
        'glitch-1': 'glitchOne 2s infinite',
        'glitch-2': 'glitchTwo 2.5s infinite',
        'bounce-subtle': 'bounceSubtle 1.8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.85', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        lsdHue: {
          '0%': { filter: 'hue-rotate(0deg)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.3)' },
          '100%': { filter: 'hue-rotate(360deg)' },
        },
        glitchOne: {
          '0%, 100%': { transform: 'none', opacity: '1' },
          '7%': { transform: 'skew(-0.8deg, -0.9deg) translate(-2px, 1px)', filter: 'drop-shadow(2px 0 #ff007f)' },
          '10%': { transform: 'none', filter: 'none' },
          '45%': { transform: 'skew(0.7deg, 0.5deg) translate(2px, -1px)', filter: 'drop-shadow(-2px 0 #00f3ff)' },
          '48%': { transform: 'none', filter: 'none' },
        },
        glitchTwo: {
          '0%, 100%': { transform: 'none' },
          '20%': { transform: 'translate(-1.5px, 0.5px)' },
          '22%': { transform: 'none' },
          '70%': { transform: 'translate(1.5px, -0.5px)' },
          '72%': { transform: 'none' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
    },
  },
  plugins: [],
};
