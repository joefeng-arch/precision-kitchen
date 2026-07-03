import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button, Screen, Typography } from '@/components/ui';
import { RecipeCard } from '@/features/recipes/components/RecipeCard';
import { ApiClientError } from '@/lib/api/errors';
import { useRecipes } from '@/lib/api/hooks/useRecipes';

export default function HomeScreen() {
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading, isFetching, error } = useRecipes({
    page: 1,
    pageSize,
    isPublic: true,
    status: 'published',
  });

  return (
    <Screen>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 32 }} />}
        ListHeaderComponent={
          <Typography variant="headlineMd" className="mb-4">
            Recipes
          </Typography>
        }
        ListFooterComponent={
          data && data.items.length < data.total ? (
            <Button
              label={isFetching ? 'Loading...' : 'Load more'}
              variant="secondary"
              disabled={isFetching}
              onPress={() => setPageSize((p) => p + 20)}
              className="mt-4"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Typography variant="bodyMd">Loading...</Typography>
          ) : error ? (
            <Typography variant="bodyMd" className="text-error">
              {error instanceof ApiClientError ? error.message : String(error)}
            </Typography>
          ) : (
            <Typography variant="bodyMd" className="text-on-surface-variant">
              No recipes yet.
            </Typography>
          )
        }
      />
    </Screen>
  );
}
