import { Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.fill,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Text variant="label" color={selected ? 'onPrimary' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}
