import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';

interface GlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blur strength (0–100). Higher = frostier. */
  intensity?: number;
  /** Radius override; defaults to theme radius.lg. */
  radius?: number;
}

/**
 * A "liquid glass" surface: a frosted blur of whatever sits behind it, a faint
 * translucent tint for legibility, and a light specular hairline edge. Replaces
 * flat white cards so the app reads as layered glass over the Sunrise gradient
 * and photos rather than opaque panels.
 */
export function GlassView({ children, style, intensity = 55, radius }: GlassProps) {
  const { scheme, radius: r } = useTheme();
  const isDark = scheme === 'dark';
  const br = radius ?? r.lg;
  return (
    <View style={[{ borderRadius: br, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.6)' }, style]}>
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(30,33,54,0.26)' : 'rgba(255,255,255,0.24)' }]} />
      {/* top specular sheen */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)' }} />
      {children}
    </View>
  );
}
