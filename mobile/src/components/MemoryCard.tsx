import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthedImage } from './AuthedImage';
import type { Memory } from '../lib/types';

export function MemoryCard({ memory }: { memory: Memory }) {
  const router = useRouter();
  const thumb = memory.thumbnailUrl ?? memory.fileUrl;
  return (
    <Pressable onPress={() => router.push(`/memory/${memory.id}`)} style={{ marginBottom: 16 }}>
      <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' }}>
        <AuthedImage path={thumb} style={{ width: '100%', aspectRatio: 1 }} />
        {memory.processing ? (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.6)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>Optimizing…</Text>
          </View>
        ) : null}
      </View>
      {memory.caption ? <Text style={{ marginTop: 6 }}>{memory.caption}</Text> : null}
      {memory.ageLabels?.length ? (
        <Text style={{ color: '#888', fontSize: 12 }}>{memory.ageLabels.join(' · ')}</Text>
      ) : null}
    </Pressable>
  );
}
