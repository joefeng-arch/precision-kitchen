import type { PercentBase, RecipeDetail, RecipeIngredient, ScaleRequest } from '@/lib/api/types';

export function buildBakersPercentageRequest(mode: 'anchor' | 'total', value: number): ScaleRequest {
  return { profile: 'bakers_percentage', bakersLock: { mode, value } };
}

export function buildRatioBasedRequest(lockedId: number, value: number): ScaleRequest {
  return { profile: 'ratio_based', ratioLock: { id: lockedId, value } };
}

/**
 * 作者指定的 percentBase（recipe.baseAnchor.percentBase）优先；没有时才退回旧默认
 * （第一个 ratio 组），避免尚未配置 baseAnchor 的旧数据缩放报错。
 * baseAnchor.percentBase.id 类型为 number|string（与引擎内部类型对齐），但落库/回填
 * 路径只会写入真实数字 id，故此处按 PercentBase（id: number）收窄是安全的。
 */
export function resolvePercentBase(
  recipe: Pick<RecipeDetail, 'baseAnchor'>,
  groups: string[],
): PercentBase | undefined {
  return (
    (recipe.baseAnchor?.percentBase as PercentBase | undefined) ??
    (groups.length > 0 ? { group: groups[0] } : undefined)
  );
}

/** percentBase 的展示文案：{id} 显示该原料名，{group} 显示组名 */
export function percentBaseLabel(
  percentBase: PercentBase | undefined,
  ingredients: Pick<RecipeIngredient, 'id' | 'name' | 'customName'>[],
): string | undefined {
  if (!percentBase) return undefined;
  if ('id' in percentBase) {
    const ing = ingredients.find((i) => i.id === percentBase.id);
    return ing?.name ?? ing?.customName ?? String(percentBase.id);
  }
  return percentBase.group;
}

export function buildMultiRatioRequest(
  groupValues: Record<string, { lockedId: number; lockedValue: number }>,
  percentBase: PercentBase | undefined,
): ScaleRequest {
  return {
    profile: 'multi_ratio',
    multiRatio: {
      groups: Object.entries(groupValues).map(([group, { lockedId, lockedValue }]) => ({
        group,
        lockedId,
        lockedValue,
      })),
      percentBase,
    },
  };
}
