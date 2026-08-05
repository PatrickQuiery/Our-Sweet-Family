import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../src/hooks/useApi';
import { AuthedImage } from '../../src/components/AuthedImage';
import { Chip, EmptyState, Loading, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { API_ROOT } from '../../src/lib/config';
import type { Memory } from '../../src/lib/types';

const absolute = (path: string) => (path.startsWith('http') ? path : `${API_ROOT}${path}`);

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function MemoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { getToken } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ memory: Memory }>(`/memories/${id}`)
      .then((d) => {
        if (active) setMemory(d.memory);
      })
      .catch((e: any) => {
        if (active) setError(e?.message ?? 'Failed to load');
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  const isVideo = memory?.fileType === 'video';
  const videoSource =
    isVideo && memory && token
      ? { uri: absolute(memory.fileUrl), headers: { Authorization: `Bearer ${token}` } }
      : null;

  // useVideoPlayer creates the player once; the source is fetched async, so apply it via replace().
  const player = useVideoPlayer(videoSource);
  useEffect(() => {
    if (videoSource && player) player.replace(videoSource);
  }, [player, videoSource?.uri, token]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load" subtitle={error} />
      </View>
    );
  }
  if (!memory) {
    return <Loading />;
  }

  const location = [memory.locationCity, memory.locationState].filter(Boolean).join(', ');

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
        {isVideo ? (
          <VideoView player={player} style={{ width: '100%', aspectRatio: 1 }} nativeControls />
        ) : (
          <AuthedImage path={memory.fileUrl} style={{ width: '100%', aspectRatio: 1 }} contentFit="contain" />
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="caption" color="textMuted">
          {formatFullDate(memory.createdAt)}
        </Text>

        {memory.caption ? <Text variant="body">{memory.caption}</Text> : null}

        {memory.ageLabels?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {memory.ageLabels.map((label, i) => (
              <Chip key={i} label={label} />
            ))}
          </View>
        ) : null}

        {location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text variant="caption" color="textSecondary">
              {location}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
