import { Image } from 'expo-image';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import { API_ROOT } from '../lib/config';

/**
 * Renders a memory image from a relative (`/memories/:id/thumb`) or absolute URL,
 * attaching the Clerk bearer token. Relative paths resolve against API_ROOT
 * (the authed media endpoints live under `/api`).
 */
export function AuthedImage({ path, style }: { path: string; style?: StyleProp<ImageStyle> }) {
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
      contentFit="cover"
      transition={150}
    />
  );
}
