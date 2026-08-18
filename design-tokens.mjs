/**
 * Our Sweet Family — canonical design tokens (single source of truth).
 *
 * This file is the ONE place brand ramps + semantic role values live. Both apps
 * mirror it:
 *   • Web  — `client/tailwind.config.js` imports `ramps` from here, and
 *            `client/src/index.css` defines the semantic roles as CSS variables
 *            (as `r g b` channels) matching `semantic.light` / `semantic.dark`.
 *   • Mobile — `mobile/src/theme/index.ts` mirrors these values (Metro doesn't
 *            watch outside `mobile/`, so it can't import this directly yet — keep
 *            the two in sync; a `watchFolders` upgrade could make it a true import).
 *
 * Semantic roles are hex here; the web CSS var layer converts to `r g b` channels
 * so Tailwind's `/opacity` modifiers work (`text-ink/70`, `bg-surface/55`, …).
 */

// Raw brand ramps — identical across web + mobile, theme-independent.
export const ramps = {
  // Luminous "Sunrise" — pink leads.
  brand: {
    50: '#fff1f6', 100: '#ffe3ee', 200: '#ffc9dd', 300: '#ffa0c1', 400: '#ff6f9c',
    500: '#ff5c8a', 600: '#ef3f74', 700: '#d0295c', 800: '#a81f49', 900: '#8a1c40', 950: '#4c051e',
  },
  // Sunrise blue — the support color.
  blue: {
    50: '#eaf3ff', 100: '#d6e8ff', 200: '#b3d2ff', 300: '#85b6ff', 400: '#5fa0ff',
    500: '#4d94ff', 600: '#2f78e6', 700: '#245fb8', 800: '#1f4f96', 900: '#1d447e',
  },
  // Sunrise yellow — the sunshine accent.
  sun: {
    50: '#fff9e6', 100: '#fff0c0', 200: '#ffe58f', 300: '#f9d65e', 400: '#f6c945', 500: '#eeb81f', 600: '#d19b12',
  },
  gray: {
    50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
    500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827',
  },
};

// Semantic roles per theme (what components actually consume).
export const semantic = {
  light: {
    bg: '#fdfcff',
    surface: '#ffffff',
    surfaceAlt: '#f7f4fa',
    ink: '#232a45',
    inkSoft: '#5a627e',
    inkMuted: '#757d99', // darkened from #8890a8 for AA on light (CC-8/DM-2)
    border: '#e5e7eb',
    borderSubtle: '#f0edf3',
    primary: '#ff5c8a', // brand-500
    primaryStrong: '#ef3f74', // brand-600
    danger: '#dc2626',
  },
  dark: {
    bg: '#151726',
    surface: '#1e2136',
    surfaceAlt: '#262a42',
    ink: '#f3f2f8',
    inkSoft: '#bfc3d8',
    inkMuted: '#9aa1bd', // lifted from #8890a8 for AA on dark (DM-2)
    border: '#343a58',
    borderSubtle: '#252a42',
    primary: '#ff6f9c', // brand-400 reads brighter on dark
    primaryStrong: '#ff5c8a',
    danger: '#f87171',
  },
};

// The full-screen "Sunrise" app-background gradients, per theme.
export const appGradient = {
  light: 'linear-gradient(135deg,#fdeede 0%,#fbe4ef 52%,#e8eefb 100%)',
  dark: 'linear-gradient(135deg,#1b1626 0%,#20182e 52%,#131a2e 100%)',
};

export default { ramps, semantic, appGradient };
