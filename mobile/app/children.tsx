import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApi } from '../src/hooks/useApi';
import { useFamily } from '../src/context/FamilyProvider';
import { createChild, deleteChild, updateChild, uploadChildAvatar } from '../src/lib/children';
import { formatAge } from '../src/lib/age';
import { AuthedImage } from '../src/components/AuthedImage';
import { DatePickerField } from '../src/components/DatePickerField';
import { BottomSheet, Button, Card, Chip, EmptyState, Input, Screen, Text, Touchable } from '../src/components/ui';
import { useTheme } from '../src/theme/ThemeProvider';
import type { Child, Gender } from '../src/lib/types';

function ChildAvatar({ child, size = 52 }: { child: Child; size?: number }) {
  const { colors } = useTheme();
  if (child.avatarUrl) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
        <AuthedImage path={`/children/${child.id}/avatar`} style={{ width: size, height: size }} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="heading" color="primary">
        {(child.name?.[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export default function Children() {
  const api = useApi();
  const { getToken } = useAuth();
  const { activeFamily, canManage, refresh } = useFamily();
  const { colors, spacing } = useTheme();
  const children = activeFamily?.children ?? [];
  const manage = canManage();

  const [editing, setEditing] = useState<Child | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const onDelete = (child: Child) => {
    Alert.alert('Remove child', `Remove ${child.name}? Their tags will be cleared from memories.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChild(api, child.id);
            await refresh();
          } catch (e: any) {
            Alert.alert('Could not remove', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const onChangeAvatar = async (child: Child) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    setBusy(true);
    try {
      await uploadChildAvatar(getToken, child.id, {
        uri: a.uri,
        name: a.fileName ?? 'avatar.jpg',
        mimeType: a.mimeType ?? 'image/jpeg',
      });
      await refresh();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {children.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxl }}>
            <EmptyState icon="happy-outline" title="No children yet" subtitle={manage ? 'Add a child to start tagging memories.' : 'A parent can add children here.'} />
          </View>
        ) : (
          children.map((child) => (
            <Card key={child.id} style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Pressable onPress={() => (manage ? onChangeAvatar(child) : undefined)} disabled={!manage || busy}>
                <ChildAvatar child={child} />
                {manage ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: colors.surface,
                    }}
                  >
                    <Ionicons name="camera" size={11} color={colors.onPrimary} />
                  </View>
                ) : null}
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{child.name}</Text>
                <Text variant="caption" color="textSecondary">
                  {[formatAge(child.dateOfBirth), child.gender].filter(Boolean).join(' · ')}
                </Text>
              </View>

              {manage ? (
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Touchable onPress={() => setEditing(child)} style={{ padding: 8 }}>
                    <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                  </Touchable>
                  <Touchable onPress={() => onDelete(child)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Touchable>
                </View>
              ) : null}
            </Card>
          ))
        )}

        {manage ? (
          <Button
            title="Add a child"
            variant="secondary"
            icon={<Ionicons name="add" size={20} color={colors.text} />}
            onPress={() => setEditing('new')}
          />
        ) : null}
      </ScrollView>

      <ChildFormModal
        mode={editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          if (!activeFamily) return;
          setBusy(true);
          try {
            if (editing === 'new') {
              await createChild(api, {
                familyId: activeFamily.id,
                name: input.name,
                dateOfBirth: input.dob!.toISOString(),
                gender: input.gender,
              });
            } else if (editing) {
              await updateChild(api, editing.id, {
                name: input.name,
                dateOfBirth: input.dob ? input.dob.toISOString() : undefined,
                gender: input.gender,
              });
            }
            await refresh();
            setEditing(null);
          } catch (e: any) {
            Alert.alert('Could not save', e?.message ?? 'Please try again.');
          } finally {
            setBusy(false);
          }
        }}
        busy={busy}
      />
    </Screen>
  );
}

interface FormInput {
  name: string;
  gender: Gender | null;
  dob: Date | null;
}

function ChildFormModal({
  mode,
  onClose,
  onSave,
  busy,
}: {
  mode: Child | 'new' | null;
  onClose: () => void;
  onSave: (input: FormInput) => void;
  busy: boolean;
}) {
  const editingChild = mode && mode !== 'new' ? mode : null;
  // Remount the form each time the target changes so fields reset correctly.
  const key = mode === 'new' ? 'new' : (editingChild?.id ?? 'closed');

  return (
    <BottomSheet visible={mode !== null} onClose={onClose}>
      <FormBody key={key} editingChild={editingChild} onSave={onSave} busy={busy} isNew={mode === 'new'} />
    </BottomSheet>
  );
}

function FormBody({
  editingChild,
  onSave,
  busy,
  isNew,
}: {
  editingChild: Child | null;
  onSave: (input: FormInput) => void;
  busy: boolean;
  isNew: boolean;
}) {
  const { spacing } = useTheme();
  const [name, setName] = useState(editingChild?.name ?? '');
  const [gender, setGender] = useState<Gender | null>((editingChild?.gender as Gender | null) ?? null);
  const [dob, setDob] = useState<Date | null>(editingChild?.dateOfBirth ? new Date(editingChild.dateOfBirth) : null);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return setErr('Please enter a name.');
    if (isNew && !dob) return setErr('Please choose a date of birth.');
    setErr(null);
    onSave({ name: name.trim(), gender, dob });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="heading" center>
        {isNew ? 'Add a child' : 'Edit child'}
      </Text>
      <Input placeholder="Name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Boy" selected={gender === 'male'} onPress={() => setGender(gender === 'male' ? null : 'male')} />
        <Chip label="Girl" selected={gender === 'female'} onPress={() => setGender(gender === 'female' ? null : 'female')} />
      </View>
      <DatePickerField value={dob} onChange={setDob} placeholder="Date of birth" title="Date of birth" />
      {err ? (
        <Text variant="caption" color="danger">
          {err}
        </Text>
      ) : null}
      <Button title={isNew ? 'Add child' : 'Save'} onPress={submit} loading={busy} />
    </View>
  );
}
