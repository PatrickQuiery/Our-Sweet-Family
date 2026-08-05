import { TextInput, type TextInputProps } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

export function Input({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 13,
          fontFamily: fonts.regular,
          fontSize: 16,
          color: colors.text,
        },
        style,
      ]}
    />
  );
}
