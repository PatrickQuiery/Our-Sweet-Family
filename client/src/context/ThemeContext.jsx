import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Theme control for the web app. Mirrors the mobile Light/Dark/System selector
 * (DM-1). Persists the user's *preference* ('light' | 'dark' | 'system') in
 * localStorage; 'system' follows prefers-color-scheme live.
 *
 * The resolved theme is applied as an explicit `.dark` / `.light` class on
 * <html> so it always wins over the OS (see the token layer in index.css). An
 * inline script in index.html applies the same class pre-paint to avoid a flash.
 */
const STORAGE_KEY = 'osf-theme';
const ThemeContext = createContext(null);

function systemTheme() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [system, setSystem] = useState(systemTheme);

  // Track OS changes so 'system' stays live without a reload.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolved = theme === 'system' ? system : theme;

  // Apply BOTH classes explicitly — never rely on bare markup — so an explicit
  // choice beats the OS in either direction.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.classList.toggle('light', resolved === 'light');
    // Keep the mobile-style status bar / browser chrome hint in sync.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#151726' : '#ef3f74');
  }, [resolved]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — in-memory only */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
