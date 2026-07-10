import { useState } from 'react';
import { View } from 'react-native';

import { Typography } from '@/components/ui';
import { CostSummary } from '@/features/cost/CostSummary';
import { ApiClientError } from '@/lib/api/errors';
import { useScaleRecipe } from '@/lib/api/hooks/useScaleRecipe';
import type { RecipeDetail } from '@/lib/api/types';

import { buildMultiRatioRequest, percentBaseLabel, resolvePercentBase } from './buildScaleRequest';
import { RatioRuler } from './RatioRuler';
import { ScaledIngredientList } from './ScaledIngredientList';

export function MultiRatioControls({ recipe }: { recipe: RecipeDetail }) {
  const linkedIngredients = recipe.ingredients.filter(
    (i) => i.scalingRole === 'ratio_linked' && i.ratioGroup,
  );
  const groups = Array.from(new Set(linkedIngredients.map((i) => i.ratioGroup as string)));
  const percentageIngredients = recipe.ingredients.filter((i) => i.scalingRole === 'percentage');
  const mutation = useScaleRecipe();

  const percentBase = percentageIngredients.length > 0 ? resolvePercentBase(recipe, groups) : undefined;
  const percentBaseLabelText = percentBaseLabel(percentBase, recipe.ingredients);

  const firstMemberByGroup = new Map(
    groups.map((g) => [g, linkedIngredients.find((i) => i.ratioGroup === g)!]),
  );

  const [groupValues, setGroupValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map((g) => [g, Number(firstMemberByGroup.get(g)!.amount)])),
  );

  if (groups.length === 0) {
    return (
      <Typography variant="bodyMd" className="text-error">
        This recipe has no multi-ratio groups configured — scaling is unavailable.
      </Typography>
    );
  }

  const fire = (group: string, value: number) => {
    const nextValues = { ...groupValues, [group]: value };
    setGroupValues(nextValues);
    const groupLocks = Object.fromEntries(
      groups.map((g) => [
        g,
        { lockedId: firstMemberByGroup.get(g)!.id, lockedValue: nextValues[g] },
      ]),
    );
    mutation.mutate({ id: recipe.id, body: buildMultiRatioRequest(groupLocks, percentBase) });
  };

  const scaledById = mutation.data
    ? new Map(mutation.data.ingredients.map((i) => [i.id, i.scaledAmount]))
    : null;

  const badgeById = new Map<number, { label: string; tone: 'tertiarySoft' | 'surfaceContainer' }>();
  for (const g of groups) {
    const member = firstMemberByGroup.get(g)!;
    badgeById.set(member.id, { label: `LOCKED · ${g}`, tone: 'tertiarySoft' });
  }
  for (const p of percentageIngredients) {
    badgeById.set(p.id, { label: `PCT OF ${percentBaseLabelText}`, tone: 'surfaceContainer' });
  }

  return (
    <View className="gap-6">
      {percentageIngredients.length > 0 && (
        <Typography variant="bodyMd" className="text-on-surface-variant">
          Percentages calculated against: {percentBaseLabelText}
        </Typography>
      )}
      {groups.map((g) => {
        const member = firstMemberByGroup.get(g)!;
        const base = Number(member.amount);
        return (
          <RatioRuler
            key={g}
            initialValue={base}
            min={base * 0.25}
            max={base * 4}
            label={`${g} · ${member.name}`}
            unit={member.unit}
            onChange={(v) => fire(g, v)}
            onSettle={(v) => fire(g, v)}
          />
        );
      })}
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
