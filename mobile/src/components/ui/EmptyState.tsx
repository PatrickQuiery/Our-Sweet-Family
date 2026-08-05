import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'images-outline', title, subtitle }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text variant="heading" center>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="textSecondary" center>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
