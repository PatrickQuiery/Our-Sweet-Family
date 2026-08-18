import { useEffect, useRef } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

// A colorful Sunrise wash behind a large brand logo, shown while fonts/auth load.
const LIGHT = ['#ffe7b8', '#ffc2dd', '#c3dbff'] as const;
const DARK = ['#33263f', '#2b2142', '#1b2540'] as const;

export function AnimatedSplash() {
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const { width } = useWindowDimensions();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 42, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  // The colored emblem reads on the light wash; on dark we use the white version.
  const logo = isDark
    ? require('../../assets/splash-emblem-white.png')
    : require('../../assets/splash-emblem.png');
  const logoW = Math.min(320, width * 0.66);

  return (
    <LinearGradient
      colors={isDark ? DARK : LIGHT}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.Image
        source={logo}
        resizeMode="contain"
        style={{ width: logoW, height: logoW * 0.785, opacity, transform: [{ scale }] }}
      />
    </LinearGradient>
  );
}
