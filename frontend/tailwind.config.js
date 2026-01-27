/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#38bdf8',
          dark: '#0ea5e9',
          light: '#7dd3fc',
        },
        deep: '#0a0e17',
        card: '#111827',
        'card-hover': '#1a2234',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(56, 189, 248, 0.3)',
        'glow-amber': '0 0 20px rgba(251, 191, 36, 0.3)',
      }
    },
  },
  plugins: [],
}
