import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';
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
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: 14,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          opacity: disabled ? 0.5 : 1,
          backgroundColor: isPrimary
            ? pressed
              ? colors.primaryPressed
              : colors.primary
            : variant === 'secondary'
              ? pressed
                ? colors.gray[100]
                : colors.surface
              : pressed
                ? colors.brand[50]
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
  );
}
