import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, Touchable } from './ui';
import { useTheme } from '../theme/ThemeProvider';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

interface Item {
  value: number;
  label: string;
}

interface Props {
  value: Date | null;
  onChange: (d: Date) => void;
  placeholder?: string;
}

/**
 * A JS-only date picker (no native module → no dev-client rebuild). Tapping the
 * field opens a bottom sheet with Month/Day/Year columns. Suited to birthdays.
 */
export function DatePickerField({ value, onChange, placeholder = 'Select date' }: Props) {
  const { colors, spacing, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const init = value ?? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());
  const [day, setDay] = useState(init.getDate());

  const monthItems: Item[] = MONTHS.map((m, i) => ({ value: i, label: m }));
  const dayCount = daysInMonth(year, month);
  const clampedDay = Math.min(day, dayCount);
  const dayItems: Item[] = Array.from({ length: dayCount }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const yearItems: Item[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 25; y--) yearItems.push({ value: y, label: String(y) });

  const commit = () => {
    onChange(new Date(year, month, clampedDay));
    setOpen(false);
  };

  // A plain render function (not a nested component) so the ScrollViews reconcile
  // in place and keep their scroll position when a value is picked.
  const renderColumn = (items: Item[], selected: number, onPick: (v: number) => void, width: number) => (
    <ScrollView style={{ width, height: 200 }} showsVerticalScrollIndicator={false}>
      {items.map((it) => {
        const isSel = it.value === selected;
        return (
          <Touchable
            key={it.value}
            pressedScale={0.98}
            onPress={() => onPick(it.value)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: isSel ? colors.primarySoft : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text variant={isSel ? 'bodyMedium' : 'body'} color={isSel ? 'primary' : 'textSecondary'}>
              {it.label}
            </Text>
          </Touchable>
        );
      })}
    </ScrollView>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
        }}
      >
        <Text variant="body" color={value ? 'text' : 'textMuted'}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setOpen(false)} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <Text variant="heading" center>
            Date of birth
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
            {renderColumn(monthItems, month, setMonth, 92)}
            {renderColumn(dayItems, clampedDay, setDay, 70)}
            {renderColumn(yearItems, year, setYear, 92)}
          </View>
          <Button title="Done" onPress={commit} />
        </View>
      </Modal>
    </>
  );
}
