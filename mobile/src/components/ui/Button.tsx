import { useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  fullWidth = true,
  icon,
  style,
}: ButtonProps) {
  const { colors, shadow, spacing, radius } = useTheme();
  const isPrimary = variant === 'primary';
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 5 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'auto' }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => spring(0.98)}
        onPressOut={() => spring(1)}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: 14,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.md,
            opacity: disabled ? 0.5 : 1,
            backgroundColor: isPrimary
              ? pressed
                ? colors.primaryPressed
                : colors.primary
              : variant === 'secondary'
                ? pressed
                  ? colors.fillPressed
                  : colors.surface
                : pressed
                  ? colors.primarySoft
                  : 'transparent',
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: colors.border,
          },
          isPrimary && shadow.soft,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.primary} />
        ) : (
          <>
            {icon}
            <Text variant="bodyMedium" color={isPrimary ? 'onPrimary' : variant === 'ghost' ? 'primary' : 'text'}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
