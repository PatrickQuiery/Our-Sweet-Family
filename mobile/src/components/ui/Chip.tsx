import { Pressable } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.gray[100],
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
