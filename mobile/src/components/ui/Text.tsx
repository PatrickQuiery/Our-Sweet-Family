import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, typography, type TypographyVariant } from '../../theme';

type ColorRole =
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'primary'
  | 'onPrimary'
  | 'danger'
  | 'accent';

const colorMap: Record<ColorRole, string> = {
  text: colors.text,
  textSecondary: colors.textSecondary,
  textMuted: colors.textMuted,
  primary: colors.primary,
  onPrimary: colors.onPrimary,
  danger: colors.danger,
  accent: colors.warm[500],
};

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorRole;
  center?: boolean;
}

export function Text({ variant = 'body', color = 'text', center, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[typography[variant], { color: colorMap[color] }, center && { textAlign: 'center' }, style]}
    />
  );
}
