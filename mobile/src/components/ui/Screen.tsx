import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

interface ScreenProps extends ViewProps {
  /** Add horizontal + vertical padding (theme.spacing.lg). */
  padded?: boolean;
  /** Apply the top safe-area inset (for screens without a native header). */
  safeTop?: boolean;
}

export function Screen({ style, padded, safeTop, ...rest }: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: colors.bg },
        safeTop && { paddingTop: insets.top },
        padded && { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
        style,
      ]}
    />
  );
}
