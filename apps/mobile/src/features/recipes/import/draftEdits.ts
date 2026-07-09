/**
 * 导入确认页的草稿编辑纯函数。
 *
 * 删除食材会移动数组下标，而 baseAnchor.percentBase 可能以 {ingredientIndex} 指向
 * 某行；删到承重原料（bakers/ratio 的 anchor、percentBase 目标、multi_ratio 最后一个
 * ratio_linked）会让保存时的服务端校验 400——此时整体降级 linear_legacy（与服务端
 * 解析降级哲学一致），保证"保存必成功"。规则矩阵镜像服务端 collectScalingErrors。
 */
import type {
  CreateRecipeIngredient,
  CreateRecipeRequest,
  ParsedIngredient,
  ParsedRecipe,
} from '@/lib/api/types';

export interface DeleteIngredientResult {
  recipe: ParsedRecipe;
  /** 本次调用是否触发降级（屏幕 OR 进 sticky 状态） */
  downgraded: boolean;
}

function stripScaling(i: ParsedIngredient): ParsedIngredient {
  // scaleType 保留：legacy 缩放仍要用
  return { ...i, scalingRole: null, percentageValue: null, ratioGroup: null, ratioValue: null };
}

function downgrade(recipe: ParsedRecipe, remaining: ParsedIngredient[]): DeleteIngredientResult {
  return {
    recipe: {
      ...recipe,
      scalingProfile: 'linear_legacy',
      baseAnchor: null,
      ingredients: remaining.map(stripScaling),
    },
    downgraded: true,
  };
}

export function deleteIngredient(recipe: ParsedRecipe, index: number): DeleteIngredientResult {
  const deleted = recipe.ingredients[index];
  const remaining = recipe.ingredients.filter((_, i) => i !== index);
  const keep = (baseAnchor: ParsedRecipe['baseAnchor']): DeleteIngredientResult => ({
    recipe: { ...recipe, baseAnchor, ingredients: remaining },
    downgraded: false,
  });

  switch (recipe.scalingProfile) {
    case 'linear_legacy':
      return keep(recipe.baseAnchor);

    case 'bakers_percentage':
    case 'ratio_based':
      // 服务端两者都要求恰好一个 anchor —— 删掉它必 400
      if (deleted.scalingRole === 'anchor') return downgrade(recipe, remaining);
      return keep(recipe.baseAnchor);

    case 'multi_ratio': {
      const remainingLinked = remaining.filter((i) => i.scalingRole === 'ratio_linked');
      if (remainingLinked.length === 0) return downgrade(recipe, remaining);

      const percentLeft = remaining.some((i) => i.scalingRole === 'percentage');
      if (!percentLeft) {
        // percentage 全没了 → 基准不再需要（镜像服务端语义），悬空引用清掉
        return keep(null);
      }

      const pb = recipe.baseAnchor?.percentBase;
      if (!pb) return downgrade(recipe, remaining); // 防御：合法解析输出不可达

      if ('ingredientIndex' in pb) {
        if (index === pb.ingredientIndex) return downgrade(recipe, remaining); // 基准目标没了
        // 任何角色的行被删都会移动下标
        const shifted = index < pb.ingredientIndex ? pb.ingredientIndex - 1 : pb.ingredientIndex;
        return keep({ percentBase: { ingredientIndex: shifted } });
      }
      // {group} 形：组内还有成员就仍可解析
      if (!remainingLinked.some((i) => i.ratioGroup === pb.group)) {
        return downgrade(recipe, remaining);
      }
      return keep(recipe.baseAnchor);
    }
  }
}

/** 确认后的草稿 → POST /recipes 请求体（status 固定 draft、isPublic false） */
export function toCreateRecipeRequest(recipe: ParsedRecipe): CreateRecipeRequest {
  return {
    title: recipe.title.trim(),
    description: recipe.description || undefined,
    baseServings: recipe.baseServings ?? undefined,
    difficulty: recipe.difficulty ?? undefined,
    totalMinutes: recipe.totalMinutes ?? undefined,
    status: 'draft',
    isPublic: false,
    scalingProfile: recipe.scalingProfile,
    baseAnchor: recipe.baseAnchor ?? undefined, // {ingredientIndex} 由服务端插入后重映射
    // cookTime 不在 CreateRecipeDto，丢弃
    ingredients: recipe.ingredients.map(
      (ing, idx): CreateRecipeIngredient => ({
        customName: ing.name, // load-bearing 改名：解析用 name，创建用 customName
        // CreateRecipeDto 只收 2 位小数；解析 amount 未钳制，不舍入会 400
        amount: Math.round(ing.amount * 100) / 100,
        unit: ing.unit,
        scaleType: ing.scaleType ?? undefined,
        groupName: ing.groupName || undefined,
        sort: idx, // 删除后的数组顺序即正典
        scalingRole: ing.scalingRole ?? undefined,
        percentageValue: ing.percentageValue ?? undefined,
        ratioGroup: ing.ratioGroup ?? undefined,
        ratioValue: ing.ratioValue ?? undefined,
      }),
    ),
    steps: recipe.steps.map((s) => ({
      stepNumber: s.stepNumber,
      description: s.description,
      durationSeconds: s.durationSeconds ?? undefined,
      warning: s.warning ?? undefined,
    })),
  };
}
