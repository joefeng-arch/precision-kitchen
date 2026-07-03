import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Typography } from '@/components/ui';
import { ScalingWorkbench } from '@/features/recipes/scaling/ScalingWorkbench';
import { ApiClientError } from '@/lib/api/errors';
import { useRecipe } from '@/lib/api/hooks/useRecipe';
import { colors } from '@/lib/theme/tokens';

export default function ScaleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: recipe, isLoading, error } = useRecipe(id);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Screen>
        <View
          className="flex-row items-center gap-2 px-5"
          style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
        >
          <Pressable onPress={() => router.back()} className="flex-row items-center gap-2">
            <MaterialIcons name="arrow-back" size={20} color={colors['on-surface-variant']} />
            <Typography variant="labelCaps" className="text-on-surface-variant">
              BACK
            </Typography>
          </Pressable>
        </View>

        {isLoading && (
          <Typography variant="bodyMd" className="p-6">
            Loading...
          </Typography>
        )}
        {error && (
          <Typography variant="bodyMd" className="p-6 text-error">
            {error instanceof ApiClientError ? error.message : String(error)}
          </Typography>
        )}

        {recipe && (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
            <Typography variant="displayLg">{recipe.title}</Typography>
            <ScalingWorkbench recipe={recipe} />
          </ScrollView>
        )}
      </Screen>
    </GestureHandlerRootView>
  );
}
