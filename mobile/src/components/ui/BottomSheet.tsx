import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

/**
 * The one bottom-sheet primitive (M46). Every "add / edit" sheet renders through
 * this so keyboard avoidance + safe-area handling live in exactly one place —
 * the root cause of M10 / M22 / M36 (keyboard covering inputs/buttons) is fixed
 * once, here.
 *
 * - Scrim tap (or hardware back) closes.
 * - KeyboardAvoidingView lifts the sheet above the keyboard on iOS; Android
 *   relies on adjustResize.
 * - Content scrolls inside a capped-height sheet; an optional `footer` stays
 *   pinned below the scroll area, above the home-indicator inset.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Pinned action row (e.g. the primary button) — stays reachable with the keyboard up. */
  footer?: ReactNode;
}) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: spacing.sm,
              maxHeight: height * 0.88,
              // Deep shadow so the sheet reads as lifted in both themes.
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -6 },
              elevation: 16,
            }}
          >
            {/* Grabber */}
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                marginBottom: title ? spacing.sm : spacing.xs,
              }}
            />
            {title ? (
              <Text variant="heading" center style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xs }}>
                {title}
              </Text>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: spacing.lg,
                paddingTop: spacing.sm,
                gap: spacing.md,
                // If there's no pinned footer, add the safe-area inset here.
                paddingBottom: footer ? spacing.md : spacing.lg + insets.bottom,
              }}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.sm,
                  paddingBottom: spacing.md + insets.bottom,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.borderSubtle,
                  gap: spacing.sm,
                }}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
