import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthedImage } from './AuthedImage';
import { Card, Chip, Text } from './ui';
import { colors, radius, spacing } from '../theme';
import type { Memory } from '../lib/types';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function MemoryCard({ memory }: { memory: Memory }) {
  const router = useRouter();
  const thumb = memory.thumbnailUrl ?? memory.fileUrl;

  return (
    <Pressable onPress={() => router.push(`/memory/${memory.id}`)} style={{ marginBottom: spacing.lg }}>
      <Card>
        <View>
          <AuthedImage path={thumb} style={{ width: '100%', aspectRatio: 1 }} />

          {memory.fileType === 'video' ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.overlay,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
              </View>
            </View>
          ) : null}

          {memory.processing ? (
            <View
              style={{
                position: 'absolute',
                top: spacing.sm,
                right: spacing.sm,
                backgroundColor: colors.overlay,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: radius.pill,
              }}
            >
              <Text variant="label" color="onPrimary">
                Optimizing…
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          {memory.caption ? <Text variant="bodyMedium">{memory.caption}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {memory.ageLabels?.map((label, i) => <Chip key={i} label={label} />)}
            </View>
            <Text variant="caption" color="textMuted">
              {formatDate(memory.createdAt)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
