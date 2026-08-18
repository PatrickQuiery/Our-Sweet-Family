import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
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
const stillPath = (m?: Memory) => (m ? (m.thumbnailUrl ?? m.fileUrl) : null);

const TYPES: ReelType[] = ['annual', 'monthly', 'birthday', 'holiday'];

// How long each photo lingers before cross-fading to the next slide.
const PHOTO_MS = 5000;
const FADE_MS = 650;

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

/** A photo that slowly zooms + pans (Ken Burns) over its time on screen. */
function KenBurnsImage({ path, width, height, seed }: { path: string; width: number; height: number; seed: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: PHOTO_MS + FADE_MS, easing: Easing.linear, useNativeDriver: true }).start();
  }, [path, v]);
  const dirX = seed % 2 === 0 ? 1 : -1;
  const dirY = seed % 3 === 0 ? 1 : -1;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1.13] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [0, dirX * width * 0.05] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, dirY * height * 0.035] });
  return (
    <Animated.View style={{ width, height, transform: [{ scale }, { translateX }, { translateY }] }}>
      <AuthedImage path={path} style={{ width, height }} contentFit="cover" />
    </Animated.View>
  );
}

/**
 * "Generated video" reel player: each slide cross-fades into the next, photos
 * gently pan/zoom (Ken Burns) and videos play inline. Auto-advances; tap left/
 * right to skip, tap the center to pause/resume.
 */
function ReelViewer({ reel, onClose }: { reel: Reel | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [prevMemory, setPrevMemory] = useState<Memory | undefined>(undefined);

  const memories = reel?.memories ?? [];
  const current: Memory | undefined = memories[index];
  const isVideo = current?.fileType === 'video';

  const prevIndexRef = useRef(0);
  const fade = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  useEffect(() => {
    setIndex(0);
    setPaused(false);
    prevIndexRef.current = 0;
  }, [reel?.key]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < memories.length) return i + 1;
      onClose();
      return i;
    });
  }, [memories.length, onClose]);
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Cross-fade the new slide in over a still of the previous one.
  useEffect(() => {
    setPrevMemory(memories[prevIndexRef.current]);
    prevIndexRef.current = index;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reel?.key]);

  // Photos auto-advance on a timer; videos advance when they finish.
  useEffect(() => {
    if (!reel || !current || isVideo || paused) return undefined;
    const t = setTimeout(goNext, PHOTO_MS);
    return () => clearTimeout(t);
  }, [reel?.key, index, current?.id, isVideo, paused, goNext]);

  // Active progress-segment fill (photos animate over their dwell; videos stay full).
  useEffect(() => {
    progress.setValue(0);
    if (isVideo) {
      progress.setValue(1);
      return undefined;
    }
    if (paused) return undefined;
    const anim = Animated.timing(progress, { toValue: 1, duration: PHOTO_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [index, isVideo, paused, reel?.key, progress]);

  // One video player, source swapped as the current item changes.
  const player = useVideoPlayer(null);
  useEffect(() => {
    if (!player) return;
    if (isVideo && current && token) {
      player.replace({ uri: absolute(current.fileUrl), headers: { Authorization: `Bearer ${token}` } });
      if (!paused) player.play();
    } else {
      try { player.pause(); } catch { /* not ready */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, current?.id, isVideo, token]);

  useEffect(() => {
    if (!player || !isVideo) return;
    try { if (paused) player.pause(); else player.play(); } catch { /* not ready */ }
  }, [paused, player, isVideo]);

  useEffect(() => {
    if (!player) return undefined;
    const sub = player.addListener('playToEnd', goNext);
    return () => sub.remove();
  }, [player, goNext]);

  return (
    <Modal visible={reel !== null} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* under-layer: a still of the previous slide, so the new one cross-fades over it */}
        {prevMemory && stillPath(prevMemory) ? (
          <View style={{ position: 'absolute', width, height }}>
            <AuthedImage path={stillPath(prevMemory) as string} style={{ width, height }} contentFit="cover" />
          </View>
        ) : null}

        {/* over-layer: the current slide, fading in */}
        {current ? (
          <Animated.View style={{ position: 'absolute', width, height, opacity: fade }}>
            {isVideo ? (
              <VideoView player={player} style={{ width, height }} contentFit="cover" nativeControls={false} />
            ) : (
              <KenBurnsImage path={stillPath(current) as string} width={width} height={height} seed={index} />
            )}
          </Animated.View>
        ) : null}

        {/* top + bottom scrims for legibility */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, backgroundColor: 'rgba(0,0,0,0.35)' }} pointerEvents="none" />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140, backgroundColor: 'rgba(0,0,0,0.35)' }} pointerEvents="none" />

        {/* tap zones: left=prev, center=pause, right=next */}
        <Pressable onPress={goPrev} style={{ position: 'absolute', left: 0, top: 90, bottom: 0, width: width * 0.3 }} />
        <Pressable onPress={() => setPaused((p) => !p)} style={{ position: 'absolute', left: width * 0.3, right: width * 0.3, top: 90, bottom: 0 }} />
        <Pressable onPress={goNext} style={{ position: 'absolute', right: 0, top: 90, bottom: 0, width: width * 0.3 }} />

        {/* segmented progress */}
        <View style={{ position: 'absolute', top: 56, left: 12, right: 12, flexDirection: 'row', gap: 4 }}>
          {memories.map((m, i) => (
            <View key={m.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              {i < index ? (
                <View style={{ height: '100%', width: '100%', backgroundColor: '#fff' }} />
              ) : i === index ? (
                <Animated.View style={{ height: '100%', backgroundColor: '#fff', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              ) : null}
            </View>
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

        {/* paused affordance */}
        {paused ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
