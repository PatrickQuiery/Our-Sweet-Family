import { View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { AuthedImage } from './AuthedImage';
import { Touchable } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { API_ROOT } from '../lib/config';
import type { MosaicTileLayout } from '../lib/mosaic';

function absolute(path: string): string {
  return path.startsWith('http') ? path : `${API_ROOT}${path}`;
}

/** Muted, looping video that autoplays while its tile is on screen. */
function FeedVideo({ fileUrl, width, height }: { fileUrl: string; width: number; height: number }) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  const source = token ? { uri: absolute(fileUrl), headers: { Authorization: `Bearer ${token}` } } : null;
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (player) player.play();
  }, [player, source]);

  if (!token) return null;
  return <VideoView player={player} style={{ width, height }} contentFit="cover" nativeControls={false} />;
}

/**
 * A single mosaic cell — a cover-cropped memory thumbnail sized by the layout.
 * Video cells show their poster + play badge, and autoplay (muted, looping) while
 * the tile is scrolled into view (`active`). We never load a video's file URL as
 * an image (that errors); with no poster thumbnail we fall back to a dark tile.
 */
export function MosaicTile({ tile, active = false }: { tile: MosaicTileLayout; active?: boolean }) {
  const { memory, width, height } = tile;
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const isVideo = memory.fileType === 'video';
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
      {isVideo ? (
        <>
          {/* Poster: the video's own thumbnail, or a neutral dark tile if it has none. */}
          {memory.thumbnailUrl ? (
            <AuthedImage path={memory.thumbnailUrl} style={{ width, height }} />
          ) : (
            <View style={{ width, height, backgroundColor: '#1b1626' }} />
          )}
          {active ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <FeedVideo fileUrl={memory.fileUrl} width={width} height={height} />
            </View>
          ) : null}
        </>
      ) : (
        <AuthedImage path={memory.thumbnailUrl ?? memory.fileUrl} style={{ width, height }} />
      )}

      {/* Play badge — shown until the video is actually playing. */}
      {isVideo && !active ? (
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
