import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../src/hooks/useApi';
import { useFamily } from '../../src/context/FamilyProvider';
import { getReels, REEL_TYPE_LABELS } from '../../src/lib/reels';
import { AuthedImage } from '../../src/components/AuthedImage';
import { Card, Chip, EmptyState, Screen, Skeleton, Text, Touchable } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ApiError } from '../../src/lib/api';
import { API_ROOT } from '../../src/lib/config';
import type { Reel, ReelType, Memory } from '../../src/lib/types';

const absolute = (path: string) => (path.startsWith('http') ? path : `${API_ROOT}${path}`);

const TYPES: ReelType[] = ['annual', 'monthly', 'birthday', 'holiday'];

/** Reel cover: 1 image full, 2 side-by-side, 3–4 as a 2×2 grid. */
function Collage({ memories, height }: { memories: Memory[]; height: number }) {
  const { colors } = useTheme();
  const covers = memories.slice(0, 4);
  const src = (m: Memory) => m.thumbnailUrl ?? m.fileUrl;

  if (covers.length <= 1) {
    return covers[0] ? (
      <AuthedImage path={src(covers[0])} style={{ width: '100%', height }} />
    ) : (
      <View style={{ height, backgroundColor: colors.surfaceAlt }} />
    );
  }
  if (covers.length === 2) {
    return (
      <View style={{ height, flexDirection: 'row', gap: 2, backgroundColor: colors.surfaceAlt }}>
        {covers.map((m) => (
          <View key={m.id} style={{ flex: 1, height }}>
            <AuthedImage path={src(m)} style={{ width: '100%', height }} />
          </View>
        ))}
      </View>
    );
  }
  const cell = (height - 2) / 2;
  return (
    <View style={{ height, flexDirection: 'row', flexWrap: 'wrap', gap: 2, backgroundColor: colors.surfaceAlt }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: '49.5%', height: cell }}>
          {covers[i] ? <AuthedImage path={src(covers[i])} style={{ width: '100%', height: cell }} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function Reels() {
  const api = useApi();
  const { activeFamily } = useFamily();
  const { colors, spacing, radius } = useTheme();
  const familyId = activeFamily?.id ?? null;

  const [type, setType] = useState<ReelType>('annual');
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Reel | null>(null);

  const load = useCallback(async () => {
    if (!familyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setGateMessage(null);
    try {
      setReels(await getReels(api, { familyId, type }));
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 403) setGateMessage(e.message);
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [api, familyId, type]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when returning to the tab (e.g. after capturing a memory), skipping
  // the initial mount which the effect above already covers.
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

  return (
    <Screen safeTop>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Text variant="title">Reels</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}>
          {TYPES.map((t) => (
            <Chip key={t} label={REEL_TYPE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Skeleton style={{ height: 190, borderRadius: radius.lg }} />
          <Skeleton style={{ height: 190, borderRadius: radius.lg }} />
        </View>
      ) : gateMessage ? (
        <EmptyState icon="lock-closed-outline" title="Included in a plan" subtitle={gateMessage} />
      ) : reels.length === 0 ? (
        <EmptyState icon="film-outline" title="No reels yet" subtitle="As you add memories, they'll be grouped into reels here." />
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Touchable onPress={() => setViewing(item)} pressedScale={0.98}>
              <Card>
                <View style={{ height: 190, backgroundColor: colors.surfaceAlt }}>
                  <Collage memories={item.memories} height={190} />
                  <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.overlay }}>
                    <Text variant="heading" color="onPrimary">
                      {item.label}
                    </Text>
                    <Text variant="caption" color="onPrimary">
                      {item.memories.length} {item.memories.length === 1 ? 'memory' : 'memories'}
                    </Text>
                  </View>
                  <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="play" size={12} color="#fff" />
                    <Text variant="label" color="onPrimary">
                      Play
                    </Text>
                  </View>
                </View>
              </Card>
            </Touchable>
          )}
        />
      )}

      <ReelViewer reel={viewing} onClose={() => setViewing(null)} />
    </Screen>
  );
}

/**
 * Story-style reel player: segmented progress bars, tap left/right to navigate,
 * photos auto-advance and videos play inline (advancing when they finish).
 */
function ReelViewer({ reel, onClose }: { reel: Reel | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const memories = reel?.memories ?? [];
  const current: Memory | undefined = memories[index];
  const isVideo = current?.fileType === 'video';

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);
  useEffect(() => {
    setIndex(0);
  }, [reel?.key]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < memories.length) return i + 1;
      onClose();
      return i;
    });
  }, [memories.length, onClose]);
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Photos auto-advance after a few seconds; videos advance when they finish.
  useEffect(() => {
    if (!reel || !current || isVideo) return;
    const t = setTimeout(goNext, 4000);
    return () => clearTimeout(t);
  }, [reel?.key, index, current?.id, isVideo, goNext]);

  // One player, source swapped as the current item changes.
  const player = useVideoPlayer(null);
  useEffect(() => {
    if (!player) return;
    if (isVideo && current && token) {
      player.replace({ uri: absolute(current.fileUrl), headers: { Authorization: `Bearer ${token}` } });
      player.play();
    } else {
      try {
        player.pause();
      } catch {
        // player not ready yet
      }
    }
  }, [player, current?.id, isVideo, token]);
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playToEnd', goNext);
    return () => sub.remove();
  }, [player, goNext]);

  return (
    <Modal visible={reel !== null} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {current ? (
          isVideo ? (
            <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls={false} />
          ) : (
            <AuthedImage path={current.thumbnailUrl ?? current.fileUrl} style={{ width, height }} contentFit="contain" />
          )
        ) : null}

        {/* tap zones (rendered before the controls so the close button stays tappable) */}
        <Pressable onPress={goPrev} style={{ position: 'absolute', left: 0, top: 80, bottom: 0, width: width * 0.35 }} />
        <Pressable onPress={goNext} style={{ position: 'absolute', right: 0, top: 80, bottom: 0, width: width * 0.65 }} />

        {/* segmented progress */}
        <View style={{ position: 'absolute', top: 56, left: 12, right: 12, flexDirection: 'row', gap: 4 }}>
          {memories.map((m, i) => (
            <View key={m.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= index ? '#fff' : 'rgba(255,255,255,0.35)' }} />
          ))}
        </View>

        {/* label + close */}
        <View style={{ position: 'absolute', top: 70, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="label" style={{ color: '#fff' }}>
            {reel?.label}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* caption */}
        {current?.caption ? (
          <View style={{ position: 'absolute', bottom: 52, left: 20, right: 20 }}>
            <Text variant="body" style={{ color: '#fff', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 }}>
              {current.caption}
            </Text>
          </View>
        ) : null}

        {isVideo ? (
          <View style={{ position: 'absolute', bottom: 52, right: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, padding: 8 }}>
            <Ionicons name="videocam" size={16} color="#fff" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
