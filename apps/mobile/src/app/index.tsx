// 临时 smoke-test 屏幕：验证 Step 1-3（NativeWind token + API client + TanStack Query）。
// Step 5（正式配方列表）会替换掉这个屏幕。
import { FlatList, Pressable } from 'react-native';

import { useRecipes } from '@/lib/api/hooks/useRecipes';
import { ApiClientError } from '@/lib/api/errors';
import { Screen, Typography } from '@/components/ui';

export default function HomeScreen() {
  const { data, isLoading, error } = useRecipes({ page: 1, pageSize: 20 });

  return (
    <Screen>
      {isLoading && <Typography variant="body">Loading...</Typography>}
      {error && (
        <Typography variant="body" className="text-heat">
          {error instanceof ApiClientError ? error.message : String(error)}
        </Typography>
      )}
      {data && (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable className="flex-row items-center justify-between border-b border-line px-4 py-3">
              <Typography variant="display">{item.title}</Typography>
              <Typography variant="mono">{item.baseServings}</Typography>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
