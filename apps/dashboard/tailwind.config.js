/** @type {import('tailwindcss').Config} */
const primary = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
};

const emerald = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#0f766e',
  700: '#0f4f4a',
  800: '#0b3b33',
  900: '#062823',
};

const sky = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',
};

const slate = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5f5',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
};

export default {
  content: ['./index.html','./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['InterVariable','Inter','system-ui','ui-sans-serif'],
      },
      colors: {
        primary: { ...primary, DEFAULT: primary[600] },
        secondary: { ...emerald, DEFAULT: emerald[500] },
        info: { ...sky, DEFAULT: sky[500] },
        surface: { ...slate, DEFAULT: slate[50] },
        neutral: slate,
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '2.75rem', fontWeight: '600', letterSpacing: '-0.02em' }],
        'heading-2': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600', letterSpacing: '-0.015em' }],
        'heading-3': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.7rem' }],
        'body-small': ['0.875rem', { lineHeight: '1.5rem' }],
      },
      spacing: {
        page: '2rem',
        section: '1.5rem',
        card: '1.5rem',
      },
      borderRadius: {
        card: '0.75rem',
        soft: '1.125rem',
      },
      boxShadow: {
        card: '0 25px 60px -40px rgba(15, 23, 42, 0.5)',
        dialog: '0 40px 90px -50px rgba(15, 23, 42, 0.65)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(67, 56, 202, 0.95))',
        'gradient-accent': 'linear-gradient(120deg, rgba(16, 185, 129, 0.95), rgba(14, 165, 233, 0.9))',
      },
    },
  },
  plugins: [],
};
