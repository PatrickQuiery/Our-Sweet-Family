import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../src/hooks/useApi';
import { useMemories } from '../../src/hooks/useMemories';
import { getUploadedAssetIds, uploadMemory } from '../../src/lib/memories';
import { resolveChildColors } from '../../src/lib/childColor';
import { SunriseHeader } from '../../src/components/SunriseHeader';
import { MediaPicker, type PickedAsset } from '../../src/components/MediaPicker';
import { BottomSheet, Button, Chip, Screen, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

let _seq = 0;
const nextId = () => `a${_seq++}`;

interface Item {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  isVideo: boolean;
  assetId?: string; // camera-roll id, for "already uploaded" detection + dedupe
  childIds?: string[]; // per-photo override; undefined = use the batch selection
  caption?: string; // per-photo override; undefined = use the batch caption
}

export default function Capture() {
  const { getToken } = useAuth();
  const router = useRouter();
  const api = useApi();
  const { family, refresh } = useMemories();
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set());
  const [limitedAccess, setLimitedAccess] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Append picks from the in-app gallery, de-duping against what's already staged.
  const onPicked = (picked: PickedAsset[]) => {
    setPickerOpen(false);
    setItems((prev) => {
      const have = new Set(prev.map((i) => i.assetId).filter(Boolean));
      const additions = picked
        .filter((a) => !have.has(a.id))
        .map<Item>((a) => ({ id: nextId(), uri: a.uri, name: a.name, mimeType: a.mimeType, isVideo: a.isVideo, assetId: a.id }));
      return [...prev, ...additions];
    });
  };

  // Refresh the set of already-uploaded camera-roll ids whenever Capture opens,
  // and note if photo access is "Limited" (iOS won't give us asset ids then, so
  // the already-uploaded flagging can't work).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      ImagePicker.getMediaLibraryPermissionsAsync()
        .then((p) => { if (active) setLimitedAccess(p.accessPrivileges === 'limited'); })
        .catch(() => { /* best-effort */ });
      if (family) {
        getUploadedAssetIds(api, family.id)
          .then((ids) => { if (active) setUploadedIds(new Set(ids)); })
          .catch(() => { /* best-effort */ });
      }
      return () => { active = false; };
    }, [api, family?.id]),
  );
  const { colors, spacing, radius, fonts } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarH = 49 + insets.bottom; // floating tab bar clearance

  const [items, setItems] = useState<Item[]>([]);
  const [batchChildIds, setBatchChildIds] = useState<string[]>([]);
  const [batchCaption, setBatchCaption] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const children = family?.children ?? [];
  const childColors = useMemo(() => resolveChildColors(children), [children]);
  const col = width > 700 ? 6 : 3;
  const gap = spacing.sm;
  const cell = (width - spacing.lg * 2 - gap * (col - 1)) / col;

  const assetToItem = (a: ImagePicker.ImagePickerAsset): Item => {
    const isVideo = a.type === 'video';
    return {
      id: nextId(),
      uri: a.uri,
      name: a.fileName ?? (isVideo ? 'upload.mp4' : 'upload.jpg'),
      mimeType: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
      assetId: a.assetId ?? undefined,
      isVideo,
    };
  };

  const isUploaded = (it: Item) => !!it.assetId && uploadedIds.has(it.assetId);

  const pickLibrary = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Enable photo access in Settings to add memories.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    setItems((prev) => [...prev, ...result.assets.map(assetToItem)]);
  };

  const pickCamera = async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError('Enable camera access in Settings to take a photo.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
    if (result.canceled || !result.assets?.length) return;
    setItems((prev) => [...prev, ...result.assets.map(assetToItem)]);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  // Batch tagging: toggle a child across every selected item.
  const allTagged = (childId: string) =>
    items.length > 0 && items.every((i) => (i.childIds ?? batchChildIds).includes(childId));
  const toggleBatchChild = (childId: string) => {
    const add = !batchChildIds.includes(childId);
    setBatchChildIds((prev) => (add ? [...prev, childId] : prev.filter((c) => c !== childId)));
    // Fold the change into any per-photo overrides so "apply to all" really does.
    setItems((prev) =>
      prev.map((i) =>
        i.childIds === undefined
          ? i
          : { ...i, childIds: add ? [...new Set([...i.childIds, childId])] : i.childIds.filter((c) => c !== childId) },
      ),
    );
  };

  const reset = () => {
    setItems([]);
    setDone([]);
    setProgress({});
    setBatchChildIds([]);
    setBatchCaption('');
    setError(null);
  };

  const upload = async () => {
    if (!family || items.length === 0) return;
    const pending = items.filter((i) => !done.includes(i.id) && !isUploaded(i));
    if (pending.length === 0) { setError('These are already in your timeline.'); return; }
    setUploading(true);
    setError(null);
    const succeeded: string[] = [];
    for (const it of pending) {
      try {
        setProgress((p) => ({ ...p, [it.id]: 0 }));
        await uploadMemory(
          getToken,
          {
            familyId: family.id,
            childIds: it.childIds ?? batchChildIds,
            caption: (it.caption ?? batchCaption) || undefined,
            asset: { uri: it.uri, name: it.name, mimeType: it.mimeType, assetId: it.assetId },
          },
          (pct) => setProgress((p) => ({ ...p, [it.id]: pct })),
        );
        setDone((d) => [...d, it.id]);
        succeeded.push(it.id);
      } catch (e: any) {
        setError(e?.message ?? 'Some uploads failed — tap Share to retry.');
      }
    }
    setUploading(false);
    if (succeeded.length === 0) return; // all failed — keep the batch for retry

    await refresh();
    if (succeeded.length === pending.length) {
      // Everything uploaded — clear the batch so returning to Capture starts fresh.
      reset();
      router.replace('/(app)');
    } else {
      // Partial — drop the ones that uploaded, keep failures on screen to retry.
      setItems((prev) => prev.filter((i) => !succeeded.includes(i.id)));
      setDone([]);
      setProgress({});
    }
  };

  const total = items.length;
  const newCount = items.filter((i) => !isUploaded(i)).length;
  const overall = total ? Math.round(items.reduce((s, i) => s + (done.includes(i.id) ? 100 : progress[i.id] ?? 0), 0) / total) : 0;
  const doneCount = done.length;

  const editing = items.find((i) => i.id === editingId) || null;

  return (
    <Screen style={{ backgroundColor: 'transparent' }}>
      <SunriseHeader title="Add memories" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: tabBarH + 96, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          {limitedAccess ? (
            <Pressable
              onPress={() => Linking.openSettings()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
            >
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text variant="caption" style={{ flex: 1, color: colors.primary }}>
                Limited photo access. Tap to allow Full access so we can flag photos you've already added.
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          ) : null}
          {items.length === 0 ? (
            <>
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={{
                  height: 220, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
                  backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                }}
              >
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="images-outline" size={30} color={colors.primary} />
                </View>
                <Text variant="heading">Add photos &amp; videos</Text>
                <Text variant="caption" color="textSecondary">Already-added ones are marked as you browse</Text>
              </Pressable>
              <Button variant="secondary" title="Take a photo or video" icon={<Ionicons name="camera-outline" size={18} color={colors.text} />} onPress={pickCamera} />
              <Pressable onPress={pickLibrary} style={{ alignSelf: 'center', paddingVertical: spacing.xs }}>
                <Text variant="caption" color="textMuted">Use the system picker instead</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Selected grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
                {items.map((it) => {
                  const tagged = (it.childIds ?? batchChildIds).length;
                  const isDone = done.includes(it.id);
                  const pct = progress[it.id];
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => !uploading && setEditingId(it.id)}
                      style={{ width: cell, height: cell, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}
                    >
                      <Image source={{ uri: it.uri }} style={{ width: '100%', height: '100%' }} />
                      {it.isVideo ? (
                        <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="videocam" size={11} color="#fff" />
                        </View>
                      ) : null}
                      {tagged > 0 ? (
                        <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 10 }}>{tagged} tagged</Text>
                        </View>
                      ) : null}
                      {isUploaded(it) && !isDone ? (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Ionicons name="checkmark-circle" size={13} color="#fff" />
                            <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 10 }}>Added</Text>
                          </View>
                        </View>
                      ) : null}
                      {!uploading && !isDone ? (
                        <Pressable onPress={() => removeItem(it.id)} hitSlop={8} style={{ position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="close" size={14} color="#fff" />
                        </Pressable>
                      ) : null}
                      {/* upload overlay */}
                      {(pct !== undefined && !isDone) || isDone ? (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                          {isDone ? (
                            <Ionicons name="checkmark-circle" size={26} color="#fff" />
                          ) : (
                            <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 13 }}>{pct}%</Text>
                          )}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
                {!uploading ? (
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    style={{ width: cell, height: cell, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Ionicons name="add" size={26} color={colors.textMuted} />
                    <Text variant="caption" color="textMuted">Add more</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Batch details */}
              {!uploading ? (
                <View style={{ gap: spacing.md }}>
                  {children.length > 0 ? (
                    <View style={{ gap: spacing.sm }}>
                      <Text variant="label" color="textMuted">WHO'S IN THESE?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        {children.map((c) => (
                          <Chip key={c.id} label={c.name} color={childColors[c.id]} selected={allTagged(c.id)} onPress={() => toggleBatchChild(c.id)} />
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <View style={{ gap: spacing.sm }}>
                    <Text variant="label" color="textMuted">CAPTION (OPTIONAL)</Text>
                    <TextInput
                      value={batchCaption}
                      onChangeText={setBatchCaption}
                      placeholder="Add a caption for these memories…"
                      placeholderTextColor={colors.textMuted}
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text }}
                    />
                    <Text variant="caption" color="textMuted">Tap a photo to tag it or caption it individually.</Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="caption" color="textSecondary">Uploading {doneCount + 1 > total ? total : doneCount + 1} of {total}…</Text>
                    <Text variant="caption" color="textSecondary">{overall}%</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.fill, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${overall}%`, borderRadius: 4, backgroundColor: colors.primary }} />
                  </View>
                </View>
              )}

              {error ? <Text variant="caption" color="danger">{error}</Text> : null}
            </>
          )}
        </ScrollView>

        {/* Sticky upload bar */}
        {items.length > 0 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: tabBarH, padding: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
            <Button
              title={uploading ? 'Uploading…' : newCount === 0 ? 'Already in your timeline' : `Share ${newCount} ${newCount === 1 ? 'memory' : 'memories'}`}
              onPress={upload}
              loading={uploading}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* In-app camera-roll picker (badges already-added items as you browse) */}
      <MediaPicker visible={pickerOpen} uploadedIds={uploadedIds} onClose={() => setPickerOpen(false)} onDone={onPicked} />

      {/* Per-photo override sheet */}
      <BottomSheet
        visible={!!editing}
        onClose={() => setEditingId(null)}
        footer={editing ? <Button title="Done" onPress={() => setEditingId(null)} /> : undefined}
      >
        {editing ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Image source={{ uri: editing.uri }} style={{ width: 56, height: 56, borderRadius: radius.md }} />
              <Text variant="heading" style={{ flex: 1 }}>Just this photo</Text>
              <Pressable onPress={() => setEditingId(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>
            {children.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" color="textMuted">WHO'S IN THIS ONE?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {children.map((c) => {
                    const cur = editing.childIds ?? batchChildIds;
                    const on = cur.includes(c.id);
                    return (
                      <Chip
                        key={c.id}
                        label={c.name}
                        color={childColors[c.id]}
                        selected={on}
                        onPress={() =>
                          setItems((prev) => prev.map((i) => {
                            if (i.id !== editing.id) return i;
                            const base = i.childIds ?? batchChildIds;
                            const nextIds = on ? base.filter((x) => x !== c.id) : [...new Set([...base, c.id])];
                            return { ...i, childIds: nextIds };
                          }))
                        }
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color="textMuted">CAPTION</Text>
              <TextInput
                value={editing.caption ?? batchCaption}
                onChangeText={(t) => setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, caption: t } : i)))}
                placeholder="Caption for this photo…"
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text }}
              />
            </View>
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
