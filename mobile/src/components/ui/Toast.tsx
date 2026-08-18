import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Text } from './Text';

export type ToastType = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<((message: string, type?: ToastType) => void) | null>(null);

/**
 * Themed toast/snackbar (M65) — the mobile counterpart to the web toasts.
 * Replaces jarring `Alert.alert` error popups with a calm, auto-dismissing
 * banner. Mount once at the root (inside ThemeProvider). Errors that need a
 * decision still use the native confirm; this is for fire-and-forget feedback.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      <View style={{ flex: 1 }}>
        {children}
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, alignItems: 'center', gap: 8 }}
        >
          {toasts.map((t) => (
            <ToastRow key={t.id} item={t} onDone={() => dismiss(t.id)} />
          ))}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (!reduced) {
      Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    const t = setTimeout(() => {
      if (reduced) return onDone();
      Animated.timing(v, { toValue: 0, duration: 180, useNativeDriver: true }).start(onDone);
    }, 3400);
    return () => clearTimeout(t);
  }, [reduced, v, onDone]);

  const palette =
    item.type === 'error'
      ? { bg: colors.danger, fg: '#fff', icon: 'alert-circle' as const }
      : item.type === 'success'
        ? { bg: colors.primary, fg: colors.onPrimary, icon: 'checkmark-circle' as const }
        : { bg: colors.surface, fg: colors.text, icon: 'information-circle' as const };

  return (
    <Animated.View
      accessibilityRole="alert"
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        maxWidth: 480,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: palette.bg,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderWidth: item.type === 'info' ? 1 : 0,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <Text variant="bodyMedium" style={{ flex: 1, color: palette.fg }}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

export function useToast(): (message: string, type?: ToastType) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
