import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
/** What the user picked. 'system' follows the OS; the others pin the theme. */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'osf:themePreference';

export interface ActiveTheme {
  scheme: Scheme;
  colors: AppColors;
  shadow: AppShadow;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  typography: typeof typography;
  /** The user's saved preference ('light' | 'dark' | 'system'). */
  preference: ThemePreference;
  /** Persist a new preference; applies immediately. */
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ActiveTheme | null>(null);

/**
 * Provides the active theme. Resolves from the user's saved preference (DM-1) —
 * Light / Dark / System — falling back to the OS appearance when 'system'. Wrap
 * the app once (root layout). Everything visual reads colors/shadow through
 * `useTheme()` so the whole UI flips consistently.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Load the saved preference once on mount.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (alive && (v === 'light' || v === 'dark' || v === 'system')) {
          setPreferenceState(v);
        }
      })
      .catch(() => {
        /* first run / storage unavailable — stay on 'system' */
      });
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {
      /* best-effort; in-memory still applies */
    });
  };

  const scheme: Scheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ActiveTheme>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      shadow: scheme === 'dark' ? darkShadow : lightShadow,
      spacing,
      radius,
      fonts,
      typography,
      preference,
      setPreference,
    }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ActiveTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
