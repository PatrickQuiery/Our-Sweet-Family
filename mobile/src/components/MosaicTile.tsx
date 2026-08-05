import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthedImage } from './AuthedImage';
import { Touchable } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import type { MosaicTileLayout } from '../lib/mosaic';

/**
 * A single mosaic cell — a cover-cropped memory thumbnail sized by the layout,
 * with a compact video badge and a processing indicator. Tapping opens the detail.
 */
export function MosaicTile({ tile }: { tile: MosaicTileLayout }) {
  const { memory, width, height } = tile;
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const thumb = memory.thumbnailUrl ?? memory.fileUrl;
  const badge = Math.min(44, Math.max(30, Math.round(Math.min(width, height) * 0.28)));

  return (
    <Touchable
      onPress={() => router.push(`/memory/${memory.id}`)}
      pressedScale={0.96}
      style={{
        width,
        height,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <AuthedImage path={thumb} style={{ width, height }} />

      {memory.fileType === 'video' ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              backgroundColor: colors.overlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="play" size={badge * 0.5} color="#fff" style={{ marginLeft: badge * 0.06 }} />
          </View>
        </View>
      ) : null}

      {memory.processing ? (
        <View
          style={{
            position: 'absolute',
            top: spacing.sm,
            right: spacing.sm,
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="time-outline" size={15} color="#fff" />
        </View>
      ) : null}
    </Touchable>
  );
}
