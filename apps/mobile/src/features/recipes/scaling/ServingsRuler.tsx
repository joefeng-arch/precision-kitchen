import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Typography } from '@/components/ui';
import { CostSummary } from '@/features/cost/CostSummary';
import { deriveLinearScale } from '@/features/cost/deriveCostScale';
import { ApiClientError } from '@/lib/api/errors';
import { useScaleRecipeByServings } from '@/lib/api/hooks/useScaleRecipeByServings';
import type { RecipeDetail } from '@/lib/api/types';

import { getLastScale, setLastScale } from './lastScale';
import { RatioRuler } from './RatioRuler';
import { ScaledIngredientList } from './ScaledIngredientList';

export function ServingsRuler({ recipe }: { recipe: RecipeDetail }) {
  const mutation = useScaleRecipeByServings();
  // mount 时冻结，fire 更新 lastScale 不回灌滑杆
  const [restored] = useState(() => getLastScale(recipe.id)?.servings);

  const fire = (servings: number) => {
    setLastScale(recipe.id, { servings });
    mutation.mutate({ id: recipe.id, servings });
  };

  // 会话内重进：恢复上次缩放结果（手机实测：重进归零让用户来回找）
  useEffect(() => {
    if (restored != null) mutation.mutate({ id: recipe.id, servings: restored });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scaledById = mutation.data
    ? new Map(mutation.data.ingredients.map((i) => [i.id, i.scaledAmount]))
    : null;

  return (
    <View className="gap-6">
      <RatioRuler
        initialValue={restored ?? recipe.baseServings}
        min={1}
        max={Math.max(recipe.baseServings * 4, 4)}
        step={1}
        label="Servings"
        onChange={fire}
        onSettle={fire}
      />
      {mutation.error && (
        <Typography variant="bodyMd" className="text-error">
          {mutation.error instanceof ApiClientError ? mutation.error.message : String(mutation.error)}
        </Typography>
      )}
      <ScaledIngredientList
        ingredients={recipe.ingredients}
        scaledById={scaledById}
        isPending={mutation.isPending}
      />
      {/* legacy 缩放走 GET ?servings=，成本端点吃锁定式判别体——换算等价 multiplier */}
      <CostSummary
        recipeId={recipe.id}
        scale={deriveLinearScale(mutation.variables?.servings, recipe.baseServings)}
      />
    </View>
  );
}
