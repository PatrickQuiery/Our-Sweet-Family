import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkColors,
  darkShadow,
  fonts,
  lightColors,
  lightShadow,
  radius,
  spacing,
  typography,
  type AppColors,
  type AppShadow,
} from './index';

export type Scheme = 'light' | 'dark';

export interface ActiveTheme {
  scheme: Scheme;
  colors: AppColors;
  shadow: AppShadow;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  typography: typeof typography;
}

const ThemeContext = createContext<ActiveTheme | null>(null);

/**
 * Provides the active theme derived from the OS light/dark setting. Wrap the app
 * once (root layout). Everything visual reads colors/shadow through `useTheme()`
 * so the whole UI flips with the system appearance.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const scheme: Scheme = system === 'dark' ? 'dark' : 'light';

  const value = useMemo<ActiveTheme>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      shadow: scheme === 'dark' ? darkShadow : lightShadow,
      spacing,
      radius,
      fonts,
      typography,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ActiveTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
