import { View, type ViewProps } from 'react-native';
import { colors, radius, shadow } from '../../theme';

export function Card({ style, ...rest }: ViewProps) {
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
