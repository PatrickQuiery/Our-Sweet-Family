import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { type TypographyVariant } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

type ColorRole =
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'primary'
  | 'onPrimary'
  | 'danger'
  | 'accent';

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorRole;
  center?: boolean;
}

export function Text({ variant = 'body', color = 'text', center, style, ...rest }: TextProps) {
  const { colors, typography } = useTheme();
  const colorMap: Record<ColorRole, string> = {
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    danger: colors.danger,
    accent: colors.accent,
  };
  return (
    <RNText
      {...rest}
      style={[typography[variant], { color: colorMap[color] }, center && { textAlign: 'center' }, style]}
    />
  );
}
