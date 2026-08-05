import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Button, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useMemories } from '../../src/hooks/useMemories';
import { uploadMemory, type UploadAsset } from '../../src/lib/memories';

export default function Capture() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { family, refresh } = useMemories();
  const [asset, setAsset] = useState<UploadAsset | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
      setError('Permission denied');
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
  };

  const toggleChild = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

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
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="Take photo/video" onPress={() => pick(true)} />
        <Button title="Choose from library" onPress={() => pick(false)} />
      </View>
      {preview ? (
        <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} />
      ) : null}
      {family?.children?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {family.children.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => toggleChild(c.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: selected.includes(c.id) ? '#4f46e5' : '#eee',
              }}
            >
              <Text style={{ color: selected.includes(c.id) ? '#fff' : '#333' }}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        placeholder="Add a caption…"
        value={caption}
        onChangeText={setCaption}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      {error ? <Text style={{ color: 'crimson' }}>{error}</Text> : null}
      {busy ? <ActivityIndicator /> : <Button title="Upload" onPress={upload} disabled={!asset} />}
    </View>
  );
}
