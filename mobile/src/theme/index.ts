/**
 * Mobile design tokens — extends the web brand (rose/warm/Inter/rounded), elevated
 * for a native, photo-forward feel. Single source of truth for color, type, spacing,
 * radius, and shadow. Import `theme` everywhere; never hardcode raw values in screens.
 */
import { Platform, type TextStyle } from 'react-native';

// Brand rose (from the web tailwind config) — the primary family accent.
const brand = {
  50: '#fff1f5',
  100: '#ffe4ec',
  200: '#fecdd8',
  300: '#fda4bb',
  400: '#fb7097',
  500: '#f43f74',
  600: '#e11d58',
  700: '#be1249',
  800: '#9e1141',
  900: '#88133c',
  950: '#4c051e',
} as const;

// Warm gold accent.
const warm = {
  50: '#fefce8',
  100: '#fef9c3',
  200: '#fef08a',
  300: '#fde047',
  400: '#facc15',
  500: '#eab308',
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

export const colors = {
  brand,
  warm,
  gray,
  // Semantic roles
  bg: '#fbf7f8', // soft warm off-white app background
  surface: '#ffffff',
  surfaceAlt: '#faf9fb',
  primary: brand[500],
  primaryPressed: brand[600],
  onPrimary: '#ffffff',
  accent: warm[400],
  text: gray[900],
  textSecondary: gray[600],
  textMuted: gray[400],
  border: gray[200],
  borderSubtle: gray[100],
  danger: '#dc2626',
  overlay: 'rgba(17,24,39,0.55)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
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

// Soft, warm shadow — subtle on iOS, elevation on Android.
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#9e1141',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  soft: Platform.select({
    ios: {
      shadowColor: '#111827',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

export const theme = { colors, spacing, radius, fonts, typography, shadow } as const;
export type Theme = typeof theme;
