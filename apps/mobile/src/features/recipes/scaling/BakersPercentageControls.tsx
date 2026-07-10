import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip, Typography } from '@/components/ui';
import { CostSummary } from '@/features/cost/CostSummary';
import { ApiClientError } from '@/lib/api/errors';
import { useScaleRecipe } from '@/lib/api/hooks/useScaleRecipe';
import type { RecipeDetail } from '@/lib/api/types';

import { buildBakersPercentageRequest } from './buildScaleRequest';
import { RatioRuler } from './RatioRuler';
import { ScaledIngredientList } from './ScaledIngredientList';

type Mode = 'anchor' | 'total';

export function BakersPercentageControls({ recipe }: { recipe: RecipeDetail }) {
  const anchor = recipe.ingredients.find((i) => i.scalingRole === 'anchor');
  const mutation = useScaleRecipe();
  const [mode, setMode] = useState<Mode>('anchor');

  if (!anchor) {
    return (
      <Typography variant="bodyMd" className="text-error">
        This recipe is missing its baker&apos;s-percentage anchor ingredient — scaling is
        unavailable.
      </Typography>
    );
  }

  const totalAmount = recipe.ingredients.reduce((s, i) => s + Number(i.amount), 0);
  const initialValue = mode === 'anchor' ? Number(anchor.amount) : totalAmount;

  const fire = (value: number) => {
    mutation.mutate({ id: recipe.id, body: buildBakersPercentageRequest(mode, value) });
  };

  const scaledById = mutation.data
    ? new Map(mutation.data.ingredients.map((i) => [i.id, i.scaledAmount]))
    : null;
  const badgeById = new Map([[anchor.id, { label: 'ANCHOR', tone: 'tertiarySoft' as const }]]);

  return (
    <View className="gap-6">
      <View className="flex-row gap-2">
        <Pressable onPress={() => setMode('anchor')}>
          <Chip
            label="Anchor weight"
            tone={mode === 'anchor' ? 'tertiarySoft' : 'surfaceContainer'}
          />
        </Pressable>
        <Pressable onPress={() => setMode('total')}>
          <Chip
            label="Total dough weight"
            tone={mode === 'total' ? 'tertiarySoft' : 'surfaceContainer'}
          />
        </Pressable>
      </View>
      <RatioRuler
        key={mode}
        initialValue={initialValue}
        min={initialValue * 0.25}
        max={initialValue * 4}
        label={mode === 'anchor' ? (anchor.name ?? 'Anchor') : 'Total dough weight'}
        unit={anchor.unit}
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
