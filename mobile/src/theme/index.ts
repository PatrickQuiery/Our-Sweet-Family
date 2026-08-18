/**
 * Mobile design tokens — extends the web brand (rose/warm/Inter/rounded), elevated
 * for a native, photo-forward feel. Single source of truth for color, type, spacing,
 * radius, and shadow.
 *
 * Colors + shadow are theme-aware (light/dark). Consume them through `useTheme()`
 * (see ThemeProvider). Spacing/radius/fonts/typography are scheme-independent and
 * may be imported directly — though `useTheme()` returns them too for convenience.
 */
import { Platform, type TextStyle } from 'react-native';

// Luminous "Sunrise" brand ramp — pink leads (matches the web tailwind config).
const brand = {
  50: '#fff1f6',
  100: '#ffe3ee',
  200: '#ffc9dd',
  300: '#ffa0c1',
  400: '#ff6f9c',
  500: '#ff5c8a',
  600: '#ef3f74',
  700: '#d0295c',
  800: '#a81f49',
  900: '#8a1c40',
  950: '#4c051e',
} as const;

// Sunrise yellow — the sunshine accent.
const warm = {
  50: '#fff9e6',
  100: '#fff0c0',
  200: '#ffe58f',
  300: '#f9d65e',
  400: '#f6c945',
  500: '#eeb81f',
} as const;

// Sunrise blue — the support color.
const blue = {
  50: '#eaf3ff',
  100: '#d6e8ff',
  200: '#b3d2ff',
  300: '#85b6ff',
  400: '#5fa0ff',
  500: '#4d94ff',
  600: '#2f78e6',
  700: '#245fb8',
} as const;

const gray = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
} as const;

/** Shared shape for both palettes. Raw ramps + semantic roles. */
export interface AppColors {
  brand: typeof brand;
  warm: typeof warm;
  blue: typeof blue;
  gray: typeof gray;
  bg: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primaryPressed: string;
  /** Soft brand tint for icon circles / ghost-pressed backgrounds. */
  primarySoft: string;
  onPrimary: string;
  /** Blue support color + its soft tint. */
  support: string;
  supportSoft: string;
  accent: string;
  /** Neutral fill for unselected chips / secondary surfaces. */
  fill: string;
  fillPressed: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  danger: string;
  overlay: string;
}

export const lightColors: AppColors = {
  brand,
  warm,
  blue,
  gray,
  bg: '#f5eef4', // soft lilac-blush wash (less stark than white; complements the Sunrise gradient)
  surface: '#ffffff',
  surfaceAlt: '#fbf7fb',
  primary: brand[500],
  primaryPressed: brand[600],
  primarySoft: brand[50],
  onPrimary: '#ffffff',
  support: blue[500],
  supportSoft: blue[50],
  accent: warm[400],
  fill: gray[100],
  fillPressed: gray[200],
  text: '#232a45', // ink
  textSecondary: '#5a627e',
  textMuted: '#757d99', // darkened from #8890a8 for AA on light (mirrors /design-tokens.mjs)
  border: gray[200],
  borderSubtle: gray[100],
  danger: '#dc2626',
  overlay: 'rgba(35,42,69,0.55)',
};

export const darkColors: AppColors = {
  brand,
  warm,
  blue,
  gray,
  bg: '#151726', // deep ink-navy
  surface: '#1e2136',
  surfaceAlt: '#262a42',
  primary: brand[400], // brighter pink reads better on dark
  primaryPressed: brand[500],
  primarySoft: 'rgba(255,92,138,0.18)',
  onPrimary: '#ffffff',
  support: blue[400],
  supportSoft: 'rgba(77,148,255,0.18)',
  accent: warm[300],
  fill: '#2a2e48',
  fillPressed: '#343a58',
  text: '#f3f2f8',
  textSecondary: '#bfc3d8',
  textMuted: '#9aa1bd', // lifted from #8890a8 for AA on dark (mirrors /design-tokens.mjs)
  border: '#343a58',
  borderSubtle: '#252a42',
  danger: '#f87171',
  overlay: 'rgba(0,0,0,0.6)',
};

/** Back-compat default (light). Prefer `useTheme().colors`. */
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
  script: 'DancingScript_700Bold',
} as const;

// Type scale — each entry is a ready-to-spread TextStyle (minus color, which the
// Text component applies from a semantic role).
export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export interface AppShadow {
  card: object;
  soft: object;
}

// Soft, warm shadow for light mode — subtle on iOS, elevation on Android.
export const lightShadow: AppShadow = {
  card: Platform.select({
    ios: { shadowColor: '#232a45', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 3 },
    default: {},
  })!,
  soft: Platform.select({
    ios: { shadowColor: '#232a45', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 2 },
    default: {},
  })!,
};

// On dark, warm shadows disappear — lean on deeper black + elevation for separation.
export const darkShadow: AppShadow = {
  card: Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 4 },
    default: {},
  })!,
  soft: Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 3 },
    default: {},
  })!,
};

/** Back-compat default (light). Prefer `useTheme().shadow`. */
export const shadow = lightShadow;
