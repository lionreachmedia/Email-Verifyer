/** @type {import('tailwindcss').Config} */
// Colors come from CSS variables in src/index.css, so the whole theme
// can be changed in one place.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        surface2: v('surface2'),
        side: { DEFAULT: v('side'), 2: v('side2'), 3: v('side3') },
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        lime: { DEFAULT: '#CFFA39', dark: '#BDEB22' },
        aqua: v('aqua'),
        ok: { DEFAULT: v('ok'), soft: 'rgb(var(--ok) / 0.13)' },
        bad: { DEFAULT: v('bad'), soft: 'rgb(var(--bad) / 0.13)' },
        warn: { DEFAULT: v('warn'), soft: 'rgb(var(--warn) / 0.13)' },
        catch: { DEFAULT: v('catch'), soft: 'rgb(var(--catch) / 0.14)' },
        unk: { DEFAULT: v('unk'), soft: 'rgb(var(--unk) / 0.18)' },
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.3)',
        lift: '0 10px 30px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
