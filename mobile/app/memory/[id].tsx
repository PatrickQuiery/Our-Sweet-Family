import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../src/hooks/useApi';
import { useFamily } from '../../src/context/FamilyProvider';
import { AuthedImage } from '../../src/components/AuthedImage';
import { EmptyState, Loading, Text, Touchable } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { API_ROOT } from '../../src/lib/config';
import {
  addComment,
  addReaction,
  deleteComment,
  deleteMemory,
  getMemory,
  removeReaction,
  updateMemory,
} from '../../src/lib/memories';
import { DatePickerField } from '../../src/components/DatePickerField';
import { formatAge } from '../../src/lib/age';
import type { Child, Comment, Memory } from '../../src/lib/types';

const absolute = (path: string) => (path.startsWith('http') ? path : `${API_ROOT}${path}`);

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}
function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function ChildPill({ child }: { child: Child }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.fill, borderRadius: radius.pill, paddingRight: spacing.md, paddingLeft: 4, paddingVertical: 4 }}>
      {child.avatarUrl ? (
        <View style={{ width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
          <AuthedImage path={`/children/${child.id}/avatar`} style={{ width: 26, height: 26 }} />
        </View>
      ) : (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="label" color="primary">
            {(child.name?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
      )}
      <Text variant="label" color="textSecondary">
        {child.name}
        {formatAge(child.dateOfBirth) ? ` · ${formatAge(child.dateOfBirth)}` : ''}
      </Text>
    </View>
  );
}

export default function MemoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const router = useRouter();
  const { getToken } = useAuth();
  const { colors, spacing, radius, fonts } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width > 700; // landscape / tablet: media beside the details
  const { me, canManage, activeFamily } = useFamily();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);
  // Natural aspect of the photo (M30) + fullscreen viewer (M32).
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState(false);
  // Clamp so panoramas / very tall portraits stay reasonable in the feed.
  const photoAspect = Math.min(1.6, Math.max(0.66, imgAspect ?? 1));

  const load = useCallback(async () => {
    try {
      setMemory(await getMemory(api, id));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  const isVideo = memory?.fileType === 'video';
  const videoSource =
    isVideo && memory && token ? { uri: absolute(memory.fileUrl), headers: { Authorization: `Bearer ${token}` } } : null;
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

  const meId = me?.id;
  // The date may be corrected only when it did NOT come from EXIF (a real capture
  // date is authoritative), and only by the owner or the uploader.
  const canEditDate = !memory.dateFromExif && (canManage() || memory.uploadedBy?.id === meId);
  const onDateChange = async (d: Date) => {
    const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
    try {
      const updated = await updateMemory(api, id, { capturedAt: noon });
      setMemory((m) => (m ? { ...m, ...updated } : m));
    } catch (e: any) {
      Alert.alert('Could not update the date', e?.message ?? 'Please try again.');
    }
  };
  const location = [memory.locationCity, memory.locationState].filter(Boolean).join(', ');
  const taggedChildren = (activeFamily?.children ?? []).filter((c) => memory.childIds?.includes(c.id));
  const hearted = !!memory.reactions?.some((r) => r.userId === meId && r.type === 'love');
  const heartCount = memory.reactions?.filter((r) => r.type === 'love').length ?? 0;
  const comments = memory.comments ?? [];

  const toggleHeart = async () => {
    if (!meId) return;
    const nowHearted = !hearted;
    setMemory((m) =>
      m
        ? {
            ...m,
            reactions: nowHearted
              ? [...(m.reactions ?? []), { id: 'tmp', type: 'love', userId: meId }]
              : (m.reactions ?? []).filter((r) => !(r.userId === meId && r.type === 'love')),
          }
        : m,
    );
    try {
      await (nowHearted ? addReaction(api, id) : removeReaction(api, id));
    } catch {
      load(); // revert to server truth
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setBusy(true);
    try {
      const c = await addComment(api, id, text);
      setMemory((m) => (m ? { ...m, comments: [...(m.comments ?? []), c] } : m));
      setCommentText('');
    } catch (e: any) {
      Alert.alert('Could not comment', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeCommentLocal = (c: Comment) => {
    setMemory((m) => (m ? { ...m, comments: (m.comments ?? []).filter((x) => x.id !== c.id) } : m));
    deleteComment(api, id, c.id).catch(() => load());
  };

  const onShare = () => Share.share({ message: memory.caption || 'A memory from Our Sweet Family' });

  const onDeleteMemory = () =>
    Alert.alert('Delete memory', 'This memory will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMemory(api, id);
            router.back();
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.bg }}>
      {wide ? (
        <View style={{ flex: 1.1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt, aspectRatio: 1, maxHeight: '96%', maxWidth: '100%' }}>
            {isVideo ? (
              <VideoView player={player} style={{ flex: 1, aspectRatio: 1 }} nativeControls />
            ) : (
              <Pressable style={{ flex: 1 }} onPress={() => setLightbox(true)} accessibilityRole="imagebutton" accessibilityLabel="View photo full screen">
                <AuthedImage
                  path={memory.fileUrl}
                  style={{ flex: 1, aspectRatio: 1 }}
                  contentFit="contain"
                  onLoad={(e) => e.source && setImgAspect(e.source.width / e.source.height)}
                />
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        {wide ? null : (
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
          {isVideo ? (
            <VideoView player={player} style={{ width: '100%', aspectRatio: 1 }} nativeControls />
          ) : (
            <Pressable onPress={() => setLightbox(true)} accessibilityRole="imagebutton" accessibilityLabel="View photo full screen">
              <AuthedImage
                path={memory.fileUrl}
                style={{ width: '100%', aspectRatio: photoAspect }}
                contentFit="cover"
                onLoad={(e) => e.source && setImgAspect(e.source.width / e.source.height)}
              />
            </Pressable>
          )}
        </View>
        )}

        {/* Action bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Touchable onPress={toggleHeart} pressedScale={0.9} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={hearted ? 'heart' : 'heart-outline'} size={26} color={hearted ? colors.primary : colors.text} />
            {heartCount > 0 ? <Text variant="bodyMedium">{heartCount}</Text> : null}
          </Touchable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-outline" size={23} color={colors.text} />
            {comments.length > 0 ? <Text variant="bodyMedium">{comments.length}</Text> : null}
          </View>
          <View style={{ flex: 1 }} />
          <Touchable onPress={onShare} pressedScale={0.9} style={{ padding: 4 }}>
            <Ionicons name="share-outline" size={23} color={colors.text} />
          </Touchable>
          {canManage() ? (
            <Touchable onPress={onDeleteMemory} pressedScale={0.9} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Touchable>
          ) : null}
        </View>

        {/* Meta */}
        <View style={{ gap: spacing.md }}>
          {memory.caption ? <Text variant="body">{memory.caption}</Text> : null}

          {taggedChildren.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {taggedChildren.map((c) => (
                <ChildPill key={c.id} child={c} />
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
            {canEditDate ? (
              <DatePickerField value={new Date(memory.capturedAt ?? memory.createdAt)} onChange={onDateChange} placeholder="Photo date" title="Photo date" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                <Text variant="caption" color="textSecondary">
                  {formatFullDate(memory.capturedAt ?? memory.createdAt)}
                </Text>
              </View>
            )}
            {location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                <Text variant="caption" color="textSecondary">
                  {location}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Comments */}
        <View style={{ gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.lg }}>
          <Text variant="label" color="textMuted">
            COMMENTS
          </Text>
          {comments.length === 0 ? (
            <Text variant="caption" color="textMuted">
              No comments yet. Be the first to say something.
            </Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="label" color="primary">
                    {(c.user?.name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                    <Text variant="bodyMedium">{c.user?.name ?? 'Someone'}</Text>
                    <Text variant="caption" color="textMuted">
                      {shortDate(c.createdAt)}
                    </Text>
                  </View>
                  <Text variant="body">{c.text}</Text>
                </View>
                {c.userId === meId ? (
                  <Touchable onPress={() => removeCommentLocal(c)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Touchable>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add comment */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.surface }}>
        <TextInput
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 }}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textMuted}
          value={commentText}
          onChangeText={setCommentText}
          returnKeyType="send"
          onSubmitEditing={submitComment}
        />
        <Touchable onPress={submitComment} pressedScale={0.9} style={{ opacity: commentText.trim() && !busy ? 1 : 0.4 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
          </View>
        </Touchable>
      </View>
      </View>

      {/* Fullscreen photo viewer with pinch-zoom (M32). */}
      <Modal visible={lightbox} animationType="fade" onRequestClose={() => setLightbox(false)} statusBarTranslucent>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <AuthedImage
              path={memory.fileUrl}
              style={{ width, height: Math.min(height, width / photoAspect) }}
              contentFit="contain"
            />
          </ScrollView>
          <Pressable
            onPress={() => setLightbox(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ position: 'absolute', top: insets.top + 8, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
