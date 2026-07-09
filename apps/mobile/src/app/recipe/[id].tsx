import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, DoodleDivider, Screen, Typography } from '@/components/ui';
import { StatBlock } from '@/features/recipes/components/StatBlock';
import { groupIngredients } from '@/features/recipes/groupIngredients';
import { ApiClientError } from '@/lib/api/errors';
import { useRecipe } from '@/lib/api/hooks/useRecipe';
import { resolveImageUrl } from '@/lib/api/resolveImageUrl';
import { colors, shadows } from '@/lib/theme/tokens';

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: recipe, isLoading, error } = useRecipe(id);
  // Local-only decorative toggle — no favorites endpoint exists on the backend yet.
  const [favorited, setFavorited] = useState(false);

  return (
    <Screen>
      <View
        className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between bg-surface/90 px-5"
        style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
      >
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-2">
          <MaterialIcons name="arrow-back" size={20} color={colors['on-surface-variant']} />
          <Typography variant="labelCaps" className="text-on-surface-variant">
            BACK
          </Typography>
        </Pressable>
        <Pressable onPress={() => setFavorited((f) => !f)}>
          <MaterialIcons
            name={favorited ? 'favorite' : 'favorite-border'}
            size={22}
            color={colors['on-surface-variant']}
          />
        </Pressable>
      </View>

      {isLoading && (
        <Typography variant="bodyMd" className="p-6" style={{ marginTop: insets.top + 48 }}>
          Loading...
        </Typography>
      )}

      {error && (
        <Typography variant="bodyMd" className="p-6 text-error" style={{ marginTop: insets.top + 48 }}>
          {error instanceof ApiClientError ? error.message : String(error)}
        </Typography>
      )}

      {recipe && (
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: 32 }}>
          <View className="px-5">
            <View
              className="aspect-[4/5] overflow-hidden rounded-xl bg-surface-container-low"
              style={shadows.card}
            >
              {resolveImageUrl(recipe.coverImage) && (
                <Image
                  source={{ uri: resolveImageUrl(recipe.coverImage) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              )}
              <View
                style={{ pointerEvents: 'none' }}
                className="absolute inset-0 rounded-xl border border-outline-variant/30"
              />
              <View className="absolute left-4 top-4 flex-row flex-wrap gap-2">
                {recipe.categories[0]?.name && (
                  <Chip label={recipe.categories[0].name} tone="tertiarySoft" />
                )}
                <Chip label={titleCase(recipe.difficulty)} tone="tertiarySoft" />
              </View>
            </View>

            <View className="mt-4 gap-2">
              <Typography variant="displayLg">{recipe.title}</Typography>
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="person" size={18} color={colors['on-surface-variant']} />
                <Typography variant="bodyMd" className="text-on-surface-variant">
                  {recipe.author?.nickname ?? 'Unknown'}
                </Typography>
                <Typography variant="bodyMd" className="text-on-surface-variant">
                  •
                </Typography>
                <Typography variant="bodyMd" className="text-on-surface-variant">
                  {recipe.categories[0]?.name ?? ''}
                </Typography>
              </View>
            </View>

            <View className="mt-6">
              <StatBlock
                stats={[
                  { label: 'TOTAL TIME', value: recipe.totalMinutes != null ? `${recipe.totalMinutes}m` : '—' },
                  { label: 'SERVINGS', value: String(recipe.baseServings) },
                  { label: 'DIFFICULTY', value: titleCase(recipe.difficulty) },
                ]}
              />
            </View>

            <DoodleDivider className="my-8" />

            <Typography variant="headlineMd" className="mb-4">
              Ingredients
            </Typography>
            <View className="rounded-lg border border-surface-variant/60 bg-surface-container-lowest p-4">
              {groupIngredients(recipe.ingredients).map(([groupName, items]) => (
                <View key={groupName ?? '_ungrouped'}>
                  {groupName && (
                    <Typography variant="labelCaps" className="mb-2 mt-3 text-on-surface-variant first:mt-0">
                      {groupName}
                    </Typography>
                  )}
                  {items.map((ing, i) => (
                    <View
                      key={ing.id}
                      className={`flex-row items-center gap-4 py-2 ${
                        i < items.length - 1 ? 'border-b border-surface-variant/40' : ''
                      }`}
                    >
                      <View className="flex-row items-baseline" style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <Typography variant="measurementLg">{Number(ing.amount)}</Typography>
                        <Typography variant="measurementSm" className="ml-1 text-on-surface-variant">
                          {ing.unit}
                        </Typography>
                      </View>
                      <View style={{ flex: 2 }}>
                        <Typography variant="bodyLg">{ing.name}</Typography>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <DoodleDivider className="my-8" />

            <Typography variant="headlineMd" className="mb-4">
              Instructions
            </Typography>
            <View className="gap-6">
              {recipe.steps.map((step) => (
                <View key={step.id} className="flex-row gap-4">
                  <View className="h-8 w-8 items-center justify-center rounded-pill bg-secondary-container">
                    <Typography variant="measurementSm" className="text-on-secondary-container">
                      {step.stepNumber}
                    </Typography>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyLg">{step.description}</Typography>
                    {step.warning && (
                      <View className="mt-2 flex-row items-start gap-2 rounded-md border border-primary-container px-3 py-2">
                        <MaterialIcons
                          name="warning"
                          size={16}
                          color={colors['primary-container']}
                          style={{ marginTop: 4 }}
                        />
                        <Typography variant="bodyMd" style={{ flex: 1 }}>
                          {step.warning}
                        </Typography>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <Button
              label="Start Cooking"
              variant="cta"
              icon={<MaterialIcons name="play-arrow" size={20} color={colors['on-primary-container']} />}
              onPress={() => router.push({ pathname: '/brew/[id]/session', params: { id: recipe.id } })}
              className="mt-8"
            />

            <Button
              label="Scale this recipe"
              variant="cta"
              icon={<MaterialIcons name="straighten" size={20} color={colors['on-primary-container']} />}
              onPress={() => router.push({ pathname: '/recipe/scale', params: { id: recipe.id } })}
              className="mt-3"
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
