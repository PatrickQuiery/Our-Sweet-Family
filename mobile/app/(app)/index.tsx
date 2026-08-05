import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemories } from '../../src/hooks/useMemories';
import { MemoryCard } from '../../src/components/MemoryCard';
import { EmptyState, Loading, Text } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

export default function Timeline() {
  const { family, memories, refreshing, loading, error, refresh, loadMore } = useMemories();
  const insets = useSafeAreaInsets();

  if (refreshing && memories.length === 0 && !error) {
    return <Loading />;
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.xxl,
        flexGrow: 1,
      }}
      data={memories}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <MemoryCard memory={item} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        memories.length > 0 ? (
          <View style={{ marginBottom: spacing.lg }}>
            <Text variant="title">{family?.name ?? 'Your family'}</Text>
            <Text variant="body" color="textSecondary" style={{ marginTop: 2 }}>
              {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
            </Text>
          </View>
        ) : null
      }
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
              subtitle="Tap Capture to add your first photo or video."
            />
          )
        ) : null
      }
    />
  );
}
