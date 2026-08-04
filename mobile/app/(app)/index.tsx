import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useMemories } from '../../src/hooks/useMemories';
import { MemoryCard } from '../../src/components/MemoryCard';

export default function Timeline() {
  const { memories, refreshing, loading, error, refresh, loadMore } = useMemories();
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={memories}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <MemoryCard memory={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onEndReachedThreshold={0.5}
      onEndReached={loadMore}
      ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      ListEmptyComponent={
        !refreshing ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Text style={{ textAlign: 'center', color: '#888' }}>
              {error ? `Couldn't load: ${error}` : 'No memories yet. Tap Capture to add one.'}
            </Text>
          </View>
        ) : null
      }
    />
  );
}
