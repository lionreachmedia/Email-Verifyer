/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0a0b0d', 2: '#111318', 3: '#181c22', 4: '#1e232b' },
        accent: { DEFAULT: '#4f8ef7', dark: '#3d6fd4' },
        success: '#2ecc87',
        danger: '#f05252',
        warning: '#f5a623',
        purple: '#9b6dff',
        teal: '#0fc4b8',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
