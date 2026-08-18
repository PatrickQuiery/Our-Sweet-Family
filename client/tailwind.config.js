import { ramps } from '../design-tokens.mjs';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Explicit .dark / .light classes drive the toggle; bare markup follows the
  // OS via the prefers-color-scheme block in index.css (token layer).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand ramps — theme-independent (single source: /design-tokens.mjs).
        brand: ramps.brand,
        blue: ramps.blue,
        sun: ramps.sun,
        // Warm heart red — the logo's own note.
        heart: '#ef3f74',
        // Semantic, theme-aware roles → CSS vars (r g b channels) so /opacity works.
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        paper: 'rgb(var(--bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          alt: 'rgb(var(--surface-2) / <alpha-value>)',
        },
        line: 'rgb(var(--border) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          strong: 'rgb(var(--primary-strong) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
      backgroundImage: {
        sunrise: 'linear-gradient(135deg,#fff2c9 0%,#ffd3e2 52%,#cfe8ff 100%)',
        'sunrise-soft': 'linear-gradient(135deg,#fff8ea 0%,#ffeaf1 52%,#eaf3ff 100%)',
        app: 'var(--app-gradient)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        glow: 'var(--shadow-glow)',
      },
    },
  },
  plugins: [],
};
