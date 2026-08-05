import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useMemories } from '../../src/hooks/useMemories';
import { uploadMemory, type UploadAsset } from '../../src/lib/memories';
import { Button, Chip, Input, Screen, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Capture() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { family, refresh } = useMemories();
  const { colors, spacing, radius } = useTheme();
  const [asset, setAsset] = useState<UploadAsset | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideoPreview, setIsVideoPreview] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (fromCamera: boolean) => {
    setError(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Permission denied — enable access in Settings to add a memory.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    const isVideo = a.type === 'video';
    const name = a.fileName ?? (isVideo ? 'upload.mp4' : 'upload.jpg');
    const mimeType = a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    setAsset({ uri: a.uri, name, mimeType });
    setPreview(a.uri);
    setIsVideoPreview(isVideo);
  };

  const toggleChild = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const upload = async () => {
    if (!asset || !family) return;
    setBusy(true);
    setError(null);
    try {
      await uploadMemory(getToken, { familyId: family.id, childIds: selected, caption, asset });
      setAsset(null);
      setPreview(null);
      setSelected([]);
      setCaption('');
      await refresh();
      router.replace('/(app)');
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          {preview ? (
            <Pressable onPress={() => pick(false)} style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
              <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 1 }} />
              <View
                style={{
                  position: 'absolute',
                  bottom: spacing.sm,
                  right: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.overlay,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                }}
              >
                <Ionicons name={isVideoPreview ? 'videocam' : 'swap-horizontal'} size={14} color="#fff" />
                <Text variant="label" color="onPrimary">
                  {isVideoPreview ? 'Video' : 'Change'}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => pick(false)}
              style={{
                height: 240,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderStyle: 'dashed',
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="images-outline" size={30} color={colors.primary} />
              </View>
              <Text variant="heading">Add a memory</Text>
              <Text variant="caption" color="textSecondary">
                Tap to choose a photo or video
              </Text>
            </Pressable>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                title="Camera"
                icon={<Ionicons name="camera-outline" size={18} color={colors.text} />}
                onPress={() => pick(true)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                title="Library"
                icon={<Ionicons name="images-outline" size={18} color={colors.text} />}
                onPress={() => pick(false)}
              />
            </View>
          </View>

          {family?.children?.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color="textMuted">
                WHO'S IN THIS?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {family.children.map((c) => (
                  <Chip key={c.id} label={c.name} selected={selected.includes(c.id)} onPress={() => toggleChild(c.id)} />
                ))}
              </View>
            </View>
          ) : null}

          <Input
            placeholder="Add a caption…"
            value={caption}
            onChangeText={setCaption}
            multiline
            style={{ minHeight: 52, textAlignVertical: 'top' }}
          />

          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}

          <Button title="Share memory" onPress={upload} loading={busy} disabled={!asset} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
