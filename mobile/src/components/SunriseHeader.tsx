import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme';
import { Text } from './ui';

// The web's "Sunrise" gradient (#fff2c9 → #ffd3e2 → #cfe8ff), plus a deep,
// muted variant so the header stays legible in dark mode.
const LIGHT = ['#fff2c9', '#ffd3e2', '#cfe8ff'] as const;
const DARK = ['#33263f', '#2b2142', '#1b2540'] as const; // deep plum → indigo → navy
const LOGO_RATIO = 900 / 184; // both horizontal logos share this aspect

/**
 * Branded gradient header used across the main tabs: the Our Sweet Family logo on
 * the left, an optional actions slot on the right, and optional content below
 * (e.g. a search field). Adapts colors + logo to the active theme.
 */
export function SunriseHeader({ right, title, children }: { right?: ReactNode; title?: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const logo = isDark
    ? require('../../assets/logo-splash-white.png')
    : require('../../assets/logo-horizontal-sunrise.png');
  const logoH = 26;

  return (
    <LinearGradient
      colors={isDark ? DARK : LIGHT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: insets.top + 8, paddingHorizontal: spacing.lg, paddingBottom: title || children ? spacing.md : 14 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 34 }}>
        <Image source={logo} style={{ height: logoH, width: logoH * LOGO_RATIO }} resizeMode="contain" />
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {title ? <Text variant="title" style={{ marginTop: spacing.sm }}>{title}</Text> : null}
      {children}
    </LinearGradient>
  );
}
