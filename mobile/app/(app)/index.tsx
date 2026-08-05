import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemories } from '../../src/hooks/useMemories';
import { MosaicTile } from '../../src/components/MosaicTile';
import { Button, Chip, EmptyState, Skeleton, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { buildTimeline } from '../../src/lib/mosaic';

const GAP = 6;

export default function Timeline() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [childFilter, setChildFilter] = useState<string | null>(null);
  const { colors, spacing, radius, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const contentW = screenW - spacing.lg * 2;

  // Debounce so the feed doesn't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { family, memories, refreshing, loading, error, refresh, loadMore } = useMemories({
    search: search || undefined,
    childId: childFilter ?? undefined,
  });
  const children = family?.children ?? [];
  const filtering = search.length > 0 || !!childFilter;

  // Refresh when returning to the tab (e.g. after capturing a memory), skipping
  // the initial mount which useMemories already loads.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  const sections = useMemo(() => buildTimeline(memories, { width: contentW, gap: GAP }), [memories, contentW]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            height: 44,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text }}
            placeholder="Search memories"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {children.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}>
            <Chip label="All" selected={!childFilter} onPress={() => setChildFilter(null)} />
            {children.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={childFilter === c.id}
                onPress={() => setChildFilter(childFilter === c.id ? null : c.id)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {refreshing && memories.length === 0 && !error && !filtering ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: GAP }}>
          <Skeleton style={{ height: 190, borderRadius: radius.lg }} />
          <View style={{ flexDirection: 'row', gap: GAP }}>
            <Skeleton style={{ flex: 1, height: 150 }} />
            <Skeleton style={{ flex: 1, height: 150 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            <Skeleton style={{ flex: 1, height: 110 }} />
            <Skeleton style={{ flex: 1, height: 110 }} />
            <Skeleton style={{ flex: 1, height: 110 }} />
          </View>
        </View>
      ) : (
        <SectionList
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxl, flexGrow: 1 }}
          sections={sections}
          keyExtractor={(row) => row.key}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
              {row.tiles.map((tile) => (
                <MosaicTile key={tile.memory.id} tile={tile} />
              ))}
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                backgroundColor: colors.bg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Text variant="heading">{section.title}</Text>
              <View style={{ backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text variant="label" color="textSecondary">
                  {section.count}
                </Text>
              </View>
            </View>
          )}
          ListHeaderComponent={
            !filtering && memories.length > 0 ? (
              <View style={{ marginBottom: spacing.xs }}>
                <Text variant="title">{family?.name ?? 'Your family'}</Text>
                <Text variant="body" color="textSecondary" style={{ marginTop: 2 }}>
                  {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
                </Text>
              </View>
            ) : null
          }
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}
          ListEmptyComponent={
            !refreshing ? (
              error ? (
                <EmptyState icon="cloud-offline-outline" title="Couldn't load" subtitle={error} />
              ) : filtering ? (
                <EmptyState icon="search-outline" title="No matches" subtitle={search ? `Nothing found for “${search}”.` : 'No memories for this filter yet.'} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md }}>
                  <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="heart" size={40} color={colors.primary} />
                  </View>
                  <Text variant="title" center>
                    Welcome to your family
                  </Text>
                  <Text variant="body" color="textSecondary" center>
                    Capture a photo or video and it'll appear here — beautifully organized by day.
                  </Text>
                  <Button
                    title="Add your first memory"
                    fullWidth={false}
                    icon={<Ionicons name="camera" size={18} color={colors.onPrimary} />}
                    onPress={() => router.navigate('/capture')}
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              )
            ) : null
          }
        />
      )}
    </View>
  );
}
