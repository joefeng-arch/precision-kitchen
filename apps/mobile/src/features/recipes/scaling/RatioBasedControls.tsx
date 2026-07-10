import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Typography } from '@/components/ui';
import { CostSummary } from '@/features/cost/CostSummary';
import { ApiClientError } from '@/lib/api/errors';
import { useScaleRecipe } from '@/lib/api/hooks/useScaleRecipe';
import type { RecipeDetail } from '@/lib/api/types';

import { buildRatioBasedRequest } from './buildScaleRequest';
import { RatioRuler } from './RatioRuler';
import { ScaledIngredientList } from './ScaledIngredientList';

export function RatioBasedControls({ recipe }: { recipe: RecipeDetail }) {
  // Per the engine (scaling-engine.ts scaleRatio): every ingredient in a
  // ratio_based recipe must carry ratioValue, no scoping/filtering — this
  // filter is data-hygiene for malformed recipes, not real subset semantics.
  const members = recipe.ingredients.filter((i) => i.ratioValue != null);
  const defaultMember = members.find((i) => i.scalingRole === 'anchor') ?? members[0];
  const [selectedId, setSelectedId] = useState<number | undefined>(defaultMember?.id);
  const mutation = useScaleRecipe();

  if (!defaultMember) {
    return (
      <Typography variant="bodyMd" className="text-error">
        This recipe has no ratio-based ingredients — scaling is unavailable.
      </Typography>
    );
  }

  const selected = members.find((m) => m.id === selectedId) ?? defaultMember;
  const anchorMember = members.find((i) => i.scalingRole === 'anchor');

  const fire = (value: number) => {
    mutation.mutate({ id: recipe.id, body: buildRatioBasedRequest(selected.id, value) });
  };

  const scaledById = mutation.data
    ? new Map(mutation.data.ingredients.map((i) => [i.id, i.scaledAmount]))
    : null;
  const badgeById = new Map<number, { label: string; tone: 'tertiarySoft' }>();
  if (anchorMember) badgeById.set(anchorMember.id, { label: 'ANCHOR', tone: 'tertiarySoft' });

  return (
    <View className="gap-6">
      {members.length !== 2 && (
        <Typography variant="bodyMd" className="text-on-surface-variant">
          Expected exactly 2 ratio ingredients, found {members.length} — scaling may not behave as
          designed.
        </Typography>
      )}
      <View className="flex-row gap-2">
        {members.map((m) => {
          const isSelected = m.id === selected.id;
          return (
            <Pressable key={m.id} onPress={() => setSelectedId(m.id)}>
              <View
                className={`rounded-pill px-4 py-2 ${isSelected ? 'bg-primary-container' : 'bg-surface-container'}`}
              >
                <Typography
                  variant="labelCaps"
                  className={isSelected ? 'text-on-primary-container' : 'text-on-surface-variant'}
                >
                  {m.name}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </View>
      <RatioRuler
        key={selected.id}
        initialValue={Number(selected.amount)}
        min={Number(selected.amount) * 0.25}
        max={Number(selected.amount) * 4}
        label={selected.name ?? 'Ingredient'}
        unit={selected.unit}
        onChange={fire}
        onSettle={fire}
      />
      {mutation.error && (
        <Typography variant="bodyMd" className="text-error">
          {mutation.error instanceof ApiClientError
            ? mutation.error.message
            : String(mutation.error)}
        </Typography>
      )}
      <ScaledIngredientList
        ingredients={recipe.ingredients}
        scaledById={scaledById}
        badgeById={badgeById}
        isPending={mutation.isPending}
      />
      <CostSummary recipeId={recipe.id} scale={mutation.variables?.body ?? null} />
    </View>
  );
}
