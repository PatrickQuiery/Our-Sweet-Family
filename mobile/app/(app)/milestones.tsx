import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../src/hooks/useApi';
import { useFamily } from '../../src/context/FamilyProvider';
import { createMilestone, deleteMilestone, getMilestones, MILESTONE_TYPES } from '../../src/lib/milestones';
import { Button, Card, Chip, EmptyState, Input, Loading, Screen, Text, Touchable } from '../../src/components/ui';
import { SunriseHeader } from '../../src/components/SunriseHeader';
import { DatePickerField } from '../../src/components/DatePickerField';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ApiError } from '../../src/lib/api';
import type { Child, Milestone } from '../../src/lib/types';

const CHILD_COLORS = ['#f43f74', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9'];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function Milestones() {
  const api = useApi();
  const { activeFamily, canManage } = useFamily();
  const { colors, spacing } = useTheme();
  const children = activeFamily?.children ?? [];
  const manage = canManage();

  const [childId, setChildId] = useState<string | null>(children[0]?.id ?? null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Keep the selected child valid as the family loads/changes.
  useEffect(() => {
    if (!childId && children[0]) setChildId(children[0].id);
  }, [children, childId]);

  const load = useCallback(async () => {
    if (!childId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setGate(null);
    try {
      setMilestones(await getMilestones(api, childId));
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 403) setGate(e.message);
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [api, childId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh on refocus (e.g. after adding a child elsewhere), skipping the mount.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      load();
    }, [load]),
  );

  const onDelete = (m: Milestone) => {
    Alert.alert('Delete milestone', 'Remove this milestone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMilestone(api, m.id);
            await load();
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  if (children.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1 }}>
          <EmptyState icon="happy-outline" title="No children yet" subtitle="Add a child in Settings to track milestones." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <SunriseHeader title="Milestones" />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {children.map((c: Child, i: number) => (
            <Chip key={c.id} label={c.name} color={CHILD_COLORS[i % CHILD_COLORS.length]} selected={c.id === childId} onPress={() => setChildId(c.id)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <Loading />
      ) : gate ? (
        <EmptyState icon="lock-closed-outline" title="Included in a plan" subtitle={gate} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 110, flexGrow: 1 }}>
          {milestones.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxl }}>
              <EmptyState icon="ribbon-outline" title="No milestones yet" subtitle={manage ? 'Record a first, a height, a special moment.' : 'A parent can add milestones here.'} />
            </View>
          ) : (
            milestones.map((m) => (
              <Card key={m.id} style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="ribbon" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">
                    {m.type}
                    {m.value ? ` — ${m.value}${m.unit ? ` ${m.unit}` : ''}` : ''}
                  </Text>
                  {m.note ? (
                    <Text variant="caption" color="textSecondary">
                      {m.note}
                    </Text>
                  ) : null}
                  <Text variant="caption" color="textMuted">
                    {formatDate(m.date)}
                  </Text>
                </View>
                {manage ? (
                  <Touchable onPress={() => onDelete(m)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Touchable>
                ) : null}
              </Card>
            ))
          )}

          {manage ? (
            <Button
              title="Add a milestone"
              variant="secondary"
              icon={<Ionicons name="add" size={20} color={colors.text} />}
              onPress={() => setAdding(true)}
            />
          ) : null}
        </ScrollView>
      )}

      {childId ? (
        <AddMilestoneModal
          visible={adding}
          onClose={() => setAdding(false)}
          onSave={async (input) => {
            try {
              await createMilestone(api, { childId, ...input });
              setAdding(false);
              await load();
            } catch (e: any) {
              Alert.alert('Could not save', e?.message ?? 'Please try again.');
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

interface MilestoneInput {
  type: string;
  value: string;
  unit?: string;
  note?: string;
  date: string;
}

function AddMilestoneModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (input: MilestoneInput) => void }) {
  const { colors, spacing, radius } = useTheme();
  const [type, setType] = useState('First');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!value.trim()) return setErr('Please enter a value (e.g. "Crawled" or "30").');
    setErr(null);
    setBusy(true);
    await onSave({ type, value: value.trim(), unit: unit.trim() || undefined, note: note.trim() || undefined, date: date.toISOString() });
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
        <Text variant="heading" center>
          Add a milestone
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {MILESTONE_TYPES.map((t) => (
            <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
          ))}
        </ScrollView>
        <Input placeholder="Value (e.g. Crawled, 30)" value={value} onChangeText={setValue} />
        <Input placeholder="Unit (optional, e.g. in, lb)" value={unit} onChangeText={setUnit} autoCapitalize="none" />
        <Input placeholder="Note (optional)" value={note} onChangeText={setNote} multiline style={{ minHeight: 48, textAlignVertical: 'top' }} />
        <DatePickerField value={date} onChange={setDate} placeholder="Date" />
        {err ? (
          <Text variant="caption" color="danger">
            {err}
          </Text>
        ) : null}
        <Button title="Add milestone" onPress={submit} loading={busy} />
      </View>
    </Modal>
  );
}
