import { Image, type ImageContentFit, type ImageLoadEventData } from 'expo-image';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import { API_ROOT } from '../lib/config';

/**
 * Renders a memory image from a relative (`/memories/:id/thumb`) or absolute URL,
 * attaching the Clerk bearer token. Relative paths resolve against API_ROOT
 * (the authed media endpoints live under `/api`). `contentFit` defaults to cover
 * (grid tiles); the detail view passes `contain` to show the full, uncropped image.
 */
export function AuthedImage({
  path,
  style,
  contentFit = 'cover',
  onLoad,
}: {
  path: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  /** Fires with natural dimensions once loaded — used to size media to real aspect. */
  onLoad?: (e: ImageLoadEventData) => void;
}) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  const uri = path.startsWith('http') ? path : `${API_ROOT}${path}`;
  if (!token) return null;
  return (
    <Image
      style={style}
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      contentFit={contentFit}
      transition={280}
      onLoad={onLoad}
    />
  );
}
