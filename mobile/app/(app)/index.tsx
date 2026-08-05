import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemories } from '../../src/hooks/useMemories';
import { MosaicTile } from '../../src/components/MosaicTile';
import { EmptyState, Loading, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/ThemeProvider';
import { buildTimeline } from '../../src/lib/mosaic';

const GAP = 6;

export default function Timeline() {
  const { family, memories, refreshing, loading, error, refresh, loadMore } = useMemories();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const contentW = screenW - spacing.lg * 2;

  const sections = useMemo(() => buildTimeline(memories, { width: contentW, gap: GAP }), [memories, contentW]);

  if (refreshing && memories.length === 0 && !error) {
    return <Loading />;
  }

  return (
    <SectionList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.xxl,
        flexGrow: 1,
      }}
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
        <View style={{ backgroundColor: colors.bg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text variant="heading">{section.title}</Text>
        </View>
      )}
      ListHeaderComponent={
        memories.length > 0 ? (
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
      onEndReachedThreshold={0.5}
      onEndReached={loadMore}
      ListFooterComponent={
        loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null
      }
      ListEmptyComponent={
        !refreshing ? (
          error ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load" subtitle={error} />
          ) : (
            <EmptyState
              icon="images-outline"
              title="No memories yet"
              subtitle="Tap the camera below to add your first photo or video."
            />
          )
        ) : null
      }
    />
  );
}
