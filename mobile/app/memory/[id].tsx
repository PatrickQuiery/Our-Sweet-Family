import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@clerk/clerk-expo';
import { useApi } from '../../src/hooks/useApi';
import { AuthedImage } from '../../src/components/AuthedImage';
import { API_ROOT } from '../../src/lib/config';
import type { Memory } from '../../src/lib/types';

const absolute = (path: string) => (path.startsWith('http') ? path : `${API_ROOT}${path}`);

export default function MemoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { getToken } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ memory: Memory }>(`/memories/${id}`).then((d) => setMemory(d.memory));
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

  if (!memory) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {isVideo ? (
        <VideoView player={player} style={{ width: '100%', aspectRatio: 1 }} nativeControls />
      ) : (
        <AuthedImage path={memory.fileUrl} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} />
      )}
      {memory.caption ? <Text style={{ fontSize: 16 }}>{memory.caption}</Text> : null}
      {memory.ageLabels?.length ? (
        <Text style={{ color: '#888' }}>{memory.ageLabels.join(' · ')}</Text>
      ) : null}
      {memory.locationCity ? (
        <Text style={{ color: '#888' }}>
          {[memory.locationCity, memory.locationState].filter(Boolean).join(', ')}
        </Text>
      ) : null}
    </ScrollView>
  );
}
