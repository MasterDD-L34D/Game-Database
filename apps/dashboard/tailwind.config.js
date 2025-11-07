
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['InterVariable','Inter','system-ui','ui-sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.06)' }
    },
  },
  plugins: [],
}
