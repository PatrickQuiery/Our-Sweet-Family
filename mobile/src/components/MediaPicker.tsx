import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
// SDK 54 deprecated the top-level functions (they throw); the field-based API we
// use here lives under /legacy.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from './ui';
import { useTheme } from '../theme/ThemeProvider';

export interface PickedAsset {
  id: string;
  uri: string; // file:// localUri, ready to upload
  name: string;
  mimeType: string;
  isVideo: boolean;
}

// The field-based asset shape returned by getAssetsAsync (uri/filename/mediaType/…).
type LibAsset = Awaited<ReturnType<typeof MediaLibrary.getAssetsAsync>>['assets'][number];

const PAGE = 60;

function extMime(name: string, isVideo: boolean): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heic', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4',
  };
  return map[ext] || (isVideo ? 'video/mp4' : 'image/jpeg');
}

function fmtDur(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A themed, in-app camera-roll picker. Unlike Apple's PHPicker, we render the
 * grid ourselves — so memories already in the family timeline show an "Added"
 * badge right as you browse. Multi-select; returns upload-ready file URIs.
 */
export function MediaPicker({
  visible,
  uploadedIds,
  onClose,
  onDone,
}: {
  visible: boolean;
  uploadedIds: Set<string>;
  onClose: () => void;
  onDone: (assets: PickedAsset[]) => void;
}) {
  const { colors, spacing, radius, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cols = 4;
  const gap = 2;
  const cell = (width - gap * (cols - 1)) / cols;

  const [perm, setPerm] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [assets, setAssets] = useState<LibAsset[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [resolving, setResolving] = useState(false);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const res = await MediaLibrary.getAssetsAsync({ first: PAGE, mediaType: ['photo', 'video'] });
      setAssets(res.assets);
      setCursor(res.endCursor);
      setHasMore(res.hasNextPage);
    } catch (e) {
      console.warn('[MediaPicker] getAssetsAsync failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return;
    setLoading(true);
    try {
      const res = await MediaLibrary.getAssetsAsync({ first: PAGE, after: cursor, mediaType: ['photo', 'video'] });
      setAssets((p) => [...p, ...res.assets]);
      setCursor(res.endCursor);
      setHasMore(res.hasNextPage);
    } catch (e) {
      console.warn('[MediaPicker] getAssetsAsync (more) failed:', e);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, cursor]);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    (async () => {
      const p = await MediaLibrary.requestPermissionsAsync();
      if (!active) return;
      setPerm(p);
      setSelected([]);
      if (p.granted) loadFirst();
    })();
    return () => { active = false; };
  }, [visible, loadFirst]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const confirm = async () => {
    setResolving(true);
    try {
      const chosen = selected
        .map((id) => assets.find((a) => a.id === id))
        .filter((a): a is LibAsset => Boolean(a));
      const out: PickedAsset[] = [];
      for (const a of chosen) {
        const info = await MediaLibrary.getAssetInfoAsync(a);
        const isVideo = a.mediaType === 'video';
        out.push({ id: a.id, uri: info.localUri || a.uri, name: a.filename, mimeType: extMime(a.filename, isVideo), isVideo });
      }
      onDone(out);
      setSelected([]);
    } finally {
      setResolving(false);
    }
  };

  const limited = perm?.accessPrivileges === 'limited';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text variant="body" style={{ color: colors.primary }}>Cancel</Text>
          </Pressable>
          <Text variant="heading">Camera roll</Text>
          <Pressable onPress={confirm} hitSlop={10} disabled={selected.length === 0 || resolving}>
            <Text variant="bodyMedium" style={{ color: selected.length ? colors.primary : colors.textMuted }}>
              {resolving ? 'Adding…' : `Add${selected.length ? ` (${selected.length})` : ''}`}
            </Text>
          </Pressable>
        </View>

        {limited ? (
          <Pressable
            onPress={() => MediaLibrary.presentPermissionsPickerAsync?.()}
            style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          >
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text variant="caption" style={{ flex: 1, color: colors.primary }}>Showing only the photos you allowed. Tap to manage which are visible.</Text>
          </Pressable>
        ) : null}

        {perm && !perm.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md }}>
            <Ionicons name="images-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color="textSecondary" center>Photo access is needed to pick memories.</Text>
            <Button title="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
          </View>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(a) => a.id}
            numColumns={cols}
            columnWrapperStyle={{ gap }}
            contentContainerStyle={{ gap, paddingBottom: insets.bottom + spacing.lg }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            initialNumToRender={PAGE}
            windowSize={5}
            renderItem={({ item }) => {
              const order = selected.indexOf(item.id);
              const isSel = order >= 0;
              const already = uploadedIds.has(item.id);
              const isVideo = item.mediaType === 'video';
              return (
                <Pressable onPress={() => toggle(item.id)} style={{ width: cell, height: cell }}>
                  <Image source={{ uri: item.uri }} style={{ width: cell, height: cell }} contentFit="cover" />

                  {isVideo ? (
                    <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 10 }}>{fmtDur(item.duration)}</Text>
                    </View>
                  ) : null}

                  {already ? (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Ionicons name="checkmark-circle" size={12} color="#fff" />
                        <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 10 }}>Added</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* selection indicator */}
                  <View style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', backgroundColor: isSel ? colors.primary : 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    {isSel ? <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 11 }}>{order + 1}</Text> : null}
                  </View>
                </Pressable>
              );
            }}
            ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}
          />
        )}
      </View>
    </Modal>
  );
}
