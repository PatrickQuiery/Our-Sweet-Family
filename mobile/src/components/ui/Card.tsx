import { View, type ViewProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export function Card({ style, ...rest }: ViewProps) {
  const { colors, shadow, radius } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          overflow: 'hidden',
        },
        shadow.card,
        style,
      ]}
    />
  );
}
