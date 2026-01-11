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
          DEFAULT: '#61D09C',
          dark: '#4DB584',
          light: '#7EDCB0',
        }
      }
    },
  },
  plugins: [],
}
