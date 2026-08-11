import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Per-child accent — tints the chip (selected: solid; idle: soft dot). */
  color?: string;
}

export function Chip({ label, selected, onPress, color }: ChipProps) {
  const { colors, spacing, radius } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: selected ? accent : colors.fill,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      {color && !selected ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
      ) : null}
      <Text variant="label" color={selected ? 'onPrimary' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}
