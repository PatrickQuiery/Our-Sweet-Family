import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useActivity } from '../../src/hooks/useActivity';
import { relativeTime } from '../../src/lib/activity';
import { AuthedImage } from '../../src/components/AuthedImage';
import { SunriseHeader } from '../../src/components/SunriseHeader';
import { EmptyState, Skeleton, Text, Touchable } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useFamily } from '../../src/context/FamilyProvider';
import type { ActivityItem } from '../../src/lib/types';

const TYPE_META = {
  love: { icon: 'heart' as const, tint: 'primary' as const },
  comment: { icon: 'chatbubble' as const, tint: 'support' as const },
  memory: { icon: 'image' as const, tint: 'accent' as const },
};

function dayBucket(iso: string, now: number): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date(now)) - startOf(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
}

export default function Activity() {
  const { colors, spacing, radius, fonts } = useTheme();
  const router = useRouter();
  const { me } = useFamily();
  const { items, loading, refreshing, error, refresh, loadMore } = useActivity();

  // Refresh when returning to the tab (loves/comments may have landed elsewhere).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      refresh();
    }, [refresh]),
  );

  const sections = useMemo(() => {
    const now = Date.now();
    const out: { title: string; data: ActivityItem[] }[] = [];
    for (const it of items) {
      const title = dayBucket(it.createdAt, now);
      const last = out[out.length - 1];
      if (last && last.title === title) last.data.push(it);
      else out.push({ title, data: [it] });
    }
    return out;
  }, [items]);

  const renderRow = (item: ActivityItem) => {
    const meta = TYPE_META[item.type];
    const isYou = item.actor?.id && me?.id && item.actor.id === me.id;
    const name = isYou ? 'You' : item.actor?.name ?? 'Someone';
    const noun = item.memory.fileType === 'video' ? 'video' : 'photo';
    const action = item.type === 'love' ? ` loved a ${noun}` : item.type === 'memory' ? ` added a ${noun}` : ' commented';
    const initial = (item.actor?.name?.[0] ?? '?').toUpperCase();

    return (
      <Touchable
        onPress={() => router.push(`/memory/${item.memory.id}`)}
        pressedScale={0.98}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
      >
        {/* actor avatar + type badge */}
        <View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.primary, fontSize: 17 }}>{initial}</Text>
          </View>
          <View
            style={{
              position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10,
              backgroundColor: colors[meta.tint], alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: colors.bg,
            }}
          >
            <Ionicons name={meta.icon} size={10} color="#fff" />
          </View>
        </View>

        {/* text block */}
        <View style={{ flex: 1 }}>
          <Text variant="body" numberOfLines={2}>
            <Text variant="bodyMedium">{name}</Text>
            <Text variant="body" color="textSecondary">{action}</Text>
          </Text>
          {item.type === 'comment' && item.text ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 1 }}>
              “{item.text}”
            </Text>
          ) : null}
          <Text variant="caption" color="textMuted" style={{ marginTop: 1 }}>{relativeTime(item.createdAt)}</Text>
        </View>

        {/* memory thumbnail */}
        <View style={{ width: 46, height: 46, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
          <AuthedImage path={item.memory.thumbnailUrl ?? item.memory.fileUrl} style={{ width: 46, height: 46 }} />
          {item.memory.fileType === 'video' ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          ) : null}
        </View>
      </Touchable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SunriseHeader title="Activity" />

      {refreshing && items.length === 0 && !error ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Skeleton style={{ width: 44, height: 44, borderRadius: 22 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton style={{ width: '70%', height: 12, borderRadius: 6 }} />
                <Skeleton style={{ width: '40%', height: 10, borderRadius: 5 }} />
              </View>
              <Skeleton style={{ width: 46, height: 46, borderRadius: radius.sm }} />
            </View>
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 110, flexGrow: 1 }}
          renderItem={({ item }) => renderRow(item)}
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: colors.bg, paddingTop: spacing.md, paddingBottom: spacing.xs }}>
              <Text variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>{section.title}</Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}
          ListEmptyComponent={
            !refreshing ? (
              error ? (
                <EmptyState icon="cloud-offline-outline" title="Couldn't load" subtitle={error} />
              ) : (
                <EmptyState icon="heart-outline" title="No activity yet" subtitle="Loves, comments, and new memories from your family will show up here." />
              )
            ) : null
          }
        />
      )}
    </View>
  );
}
