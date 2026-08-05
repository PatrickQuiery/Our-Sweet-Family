import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../src/hooks/useApi';
import { useFamily } from '../../src/context/FamilyProvider';
import { getReels, REEL_TYPE_LABELS } from '../../src/lib/reels';
import { AuthedImage } from '../../src/components/AuthedImage';
import { Card, Chip, EmptyState, Loading, Screen, Text, Touchable } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ApiError } from '../../src/lib/api';
import type { Reel, ReelType, Memory } from '../../src/lib/types';

const TYPES: ReelType[] = ['annual', 'monthly', 'birthday', 'holiday'];

export default function Reels() {
  const api = useApi();
  const router = useRouter();
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
        <Loading />
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
          renderItem={({ item }) => {
            const cover = item.memories[0];
            return (
              <Touchable onPress={() => setViewing(item)} pressedScale={0.98}>
                <Card>
                  <View style={{ height: 190, backgroundColor: colors.surfaceAlt }}>
                    {cover ? (
                      <AuthedImage path={cover.thumbnailUrl ?? cover.fileUrl} style={{ width: '100%', height: 190 }} />
                    ) : null}
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: spacing.md,
                        backgroundColor: colors.overlay,
                      }}
                    >
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
            );
          }}
        />
      )}

      <ReelViewer reel={viewing} onClose={() => setViewing(null)} onOpenMemory={(id) => { setViewing(null); router.push(`/memory/${id}`); }} />
    </Screen>
  );
}

function ReelViewer({ reel, onClose, onOpenMemory }: { reel: Reel | null; onClose: () => void; onOpenMemory: (id: string) => void }) {
  const { width, height } = useWindowDimensions();
  const insetTop = 60;

  return (
    <Modal visible={reel !== null} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {reel ? (
          <FlatList
            data={reel.memories}
            keyExtractor={(m) => m.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }: { item: Memory }) => (
              <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                <AuthedImage path={item.thumbnailUrl ?? item.fileUrl} style={{ width, height: height * 0.8 }} contentFit="contain" />
                {item.fileType === 'video' ? (
                  <Pressable
                    onPress={() => onOpenMemory(item.id)}
                    style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} />
                  </Pressable>
                ) : null}
                {item.caption ? (
                  <View style={{ position: 'absolute', bottom: 60, left: 24, right: 24 }}>
                    <Text variant="body" style={{ color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>
                      {item.caption}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          />
        ) : null}
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: insetTop, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
