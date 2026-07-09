import type { ParsedIngredient, ParsedRecipe } from '@/lib/api/types';

import { deleteIngredient, toCreateRecipeRequest } from './draftEdits';

function ing(overrides: Partial<ParsedIngredient> = {}): ParsedIngredient {
  return {
    name: '原料',
    amount: 100,
    unit: 'g',
    groupName: '主料',
    scaleType: 'linear',
    scalingRole: null,
    percentageValue: null,
    ratioGroup: null,
    ratioValue: null,
    ...overrides,
  };
}

function recipeWith(
  scalingProfile: ParsedRecipe['scalingProfile'],
  ingredients: ParsedIngredient[],
  baseAnchor: ParsedRecipe['baseAnchor'] = null,
): ParsedRecipe {
  return {
    title: '测试配方',
    description: '',
    baseServings: 2,
    difficulty: 'medium',
    scalingProfile,
    baseAnchor,
    ingredients,
    steps: [{ stepNumber: 1, description: '做', durationSeconds: null }],
  };
}

const MILK_TEA = () =>
  recipeWith(
    'multi_ratio',
    [
      ing({ name: '茶叶', scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: 1 }),
      ing({ name: '热水', amount: 400, scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: 4 }),
      ing({ name: '糖', amount: 40, scalingRole: 'percentage', percentageValue: 10 }),
    ],
    { percentBase: { ingredientIndex: 1 } },
  );

describe('deleteIngredient — 删除矩阵', () => {
  it('linear_legacy：删任何行都保持 profile、不降级', () => {
    const r = deleteIngredient(
      recipeWith('linear_legacy', [ing(), ing({ name: '第二个' })]),
      0,
    );
    expect(r.downgraded).toBe(false);
    expect(r.recipe.scalingProfile).toBe('linear_legacy');
    expect(r.recipe.ingredients).toHaveLength(1);
    expect(r.recipe.ingredients[0].name).toBe('第二个');
  });

  it('bakers：删 percentage 行安全', () => {
    const r = deleteIngredient(
      recipeWith('bakers_percentage', [
        ing({ name: '面粉', scalingRole: 'anchor', percentageValue: 100 }),
        ing({ name: '水', scalingRole: 'percentage', percentageValue: 65 }),
        ing({ name: '盐', scalingRole: 'percentage', percentageValue: 2 }),
      ]),
      1,
    );
    expect(r.downgraded).toBe(false);
    expect(r.recipe.scalingProfile).toBe('bakers_percentage');
    expect(r.recipe.ingredients[0].scalingRole).toBe('anchor');
  });

  it('bakers：删 anchor → 降级，剩余行缩放字段全 null', () => {
    const r = deleteIngredient(
      recipeWith('bakers_percentage', [
        ing({ name: '面粉', scalingRole: 'anchor', percentageValue: 100 }),
        ing({ name: '水', scalingRole: 'percentage', percentageValue: 65 }),
      ]),
      0,
    );
    expect(r.downgraded).toBe(true);
    expect(r.recipe.scalingProfile).toBe('linear_legacy');
    expect(r.recipe.baseAnchor).toBeNull();
    for (const i of r.recipe.ingredients) {
      expect(i.scalingRole).toBeNull();
      expect(i.percentageValue).toBeNull();
      expect(i.ratioGroup).toBeNull();
      expect(i.ratioValue).toBeNull();
    }
    // scaleType 保留（legacy 缩放要用）
    expect(r.recipe.ingredients[0].scaleType).toBe('linear');
  });

  it('ratio_based：删 ratio_linked 成员安全', () => {
    const r = deleteIngredient(
      recipeWith('ratio_based', [
        ing({ name: '咖啡粉', scalingRole: 'anchor', ratioValue: 1 }),
        ing({ name: '水', scalingRole: 'ratio_linked', ratioValue: 15 }),
        ing({ name: '冰', scalingRole: 'ratio_linked', ratioValue: 5 }),
      ]),
      2,
    );
    expect(r.downgraded).toBe(false);
    expect(r.recipe.scalingProfile).toBe('ratio_based');
  });

  it('ratio_based：删 anchor → 降级（服务端要求恰一 anchor）', () => {
    const r = deleteIngredient(
      recipeWith('ratio_based', [
        ing({ name: '咖啡粉', scalingRole: 'anchor', ratioValue: 1 }),
        ing({ name: '水', scalingRole: 'ratio_linked', ratioValue: 15 }),
      ]),
      0,
    );
    expect(r.downgraded).toBe(true);
    expect(r.recipe.scalingProfile).toBe('linear_legacy');
  });

  it('multi_ratio：删最后一个 ratio_linked → 降级', () => {
    const r = deleteIngredient(
      recipeWith('multi_ratio', [
        ing({ name: '热水', scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 1 }),
        ing({ name: '冰块', scalingRole: 'fixed' }),
      ]),
      0,
    );
    expect(r.downgraded).toBe(true);
  });

  it('multi_ratio pB={index:1}：删 index 0 → pB 重映射为 {index:0}', () => {
    const r = deleteIngredient(MILK_TEA(), 0);
    expect(r.downgraded).toBe(false);
    expect(r.recipe.baseAnchor).toEqual({ percentBase: { ingredientIndex: 0 } });
    expect(r.recipe.scalingProfile).toBe('multi_ratio');
  });

  it('multi_ratio pB={index:1}：删 index 2（> N）→ pB 不变', () => {
    const r = deleteIngredient(MILK_TEA(), 2);
    // 删的是最后一个 percentage 行 → baseAnchor 置 null（见下一用例组），此例改删一个 index>N 的 fixed 行
    const withFixed = MILK_TEA();
    withFixed.ingredients.push(ing({ name: '冰块', scalingRole: 'fixed' }));
    const r2 = deleteIngredient(withFixed, 3);
    expect(r2.downgraded).toBe(false);
    expect(r2.recipe.baseAnchor).toEqual({ percentBase: { ingredientIndex: 1 } });
    // 顺带确认第一次调用没降级
    expect(r.downgraded).toBe(false);
  });

  it('multi_ratio pB={index:N}：删 index===N 且仍有 percentage → 降级', () => {
    const r = deleteIngredient(MILK_TEA(), 1);
    expect(r.downgraded).toBe(true);
    expect(r.recipe.scalingProfile).toBe('linear_legacy');
  });

  it('multi_ratio pB={index:3}：删 index 1 的 fixed 行 → 重映射 {index:2}（任何角色都移动下标）', () => {
    const recipe = recipeWith(
      'multi_ratio',
      [
        ing({ name: '茶叶', scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 1 }),
        ing({ name: '冰块', scalingRole: 'fixed' }),
        ing({ name: '糖', scalingRole: 'percentage', percentageValue: 10 }),
        ing({ name: '热水', amount: 400, scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 4 }),
      ],
      { percentBase: { ingredientIndex: 3 } },
    );
    const r = deleteIngredient(recipe, 1);
    expect(r.downgraded).toBe(false);
    expect(r.recipe.baseAnchor).toEqual({ percentBase: { ingredientIndex: 2 } });
  });

  it('multi_ratio pB={group}：组内还有别的成员 → 安全、pB 不变', () => {
    const recipe = recipeWith(
      'multi_ratio',
      [
        ing({ name: '茶叶', scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 1 }),
        ing({ name: '热水', amount: 400, scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 4 }),
        ing({ name: '糖', scalingRole: 'percentage', percentageValue: 10 }),
      ],
      { percentBase: { group: 'tea' } },
    );
    const r = deleteIngredient(recipe, 0);
    expect(r.downgraded).toBe(false);
    expect(r.recipe.baseAnchor).toEqual({ percentBase: { group: 'tea' } });
  });

  it('multi_ratio pB={group}：删组内最后成员且仍有 percentage → 降级', () => {
    const recipe = recipeWith(
      'multi_ratio',
      [
        ing({ name: '茶叶', scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 1 }),
        ing({ name: '奶', amount: 200, scalingRole: 'ratio_linked', ratioGroup: 'milk', ratioValue: 1 }),
        ing({ name: '糖', scalingRole: 'percentage', percentageValue: 10 }),
      ],
      { percentBase: { group: 'tea' } },
    );
    const r = deleteIngredient(recipe, 0);
    expect(r.downgraded).toBe(true);
  });

  it('multi_ratio：删最后一个 percentage 行 → 保持 profile、baseAnchor 置 null、不降级', () => {
    const r = deleteIngredient(MILK_TEA(), 2);
    expect(r.downgraded).toBe(false);
    expect(r.recipe.scalingProfile).toBe('multi_ratio');
    expect(r.recipe.baseAnchor).toBeNull();
  });

  it('multi_ratio 防御：仍有 percentage 但 baseAnchor null → 降级（安全网）', () => {
    const recipe = recipeWith(
      'multi_ratio',
      [
        ing({ name: '茶叶', scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 1 }),
        ing({ name: '热水', amount: 400, scalingRole: 'ratio_linked', ratioGroup: 'tea', ratioValue: 4 }),
        ing({ name: '糖', scalingRole: 'percentage', percentageValue: 10 }),
      ],
      null,
    );
    const r = deleteIngredient(recipe, 0);
    expect(r.downgraded).toBe(true);
  });

  it('纯函数：不改输入', () => {
    const recipe = MILK_TEA();
    const copy = JSON.parse(JSON.stringify(recipe));
    deleteIngredient(recipe, 0);
    expect(recipe).toEqual(copy);
  });

  it('降级后的再删除：保持 legacy、不再报降级', () => {
    const first = deleteIngredient(
      recipeWith('bakers_percentage', [
        ing({ name: '面粉', scalingRole: 'anchor', percentageValue: 100 }),
        ing({ name: '水', scalingRole: 'percentage', percentageValue: 65 }),
        ing({ name: '盐', scalingRole: 'percentage', percentageValue: 2 }),
      ]),
      0,
    );
    expect(first.downgraded).toBe(true);
    const second = deleteIngredient(first.recipe, 0);
    expect(second.downgraded).toBe(false);
    expect(second.recipe.scalingProfile).toBe('linear_legacy');
  });
});

describe('toCreateRecipeRequest — 保存 payload 映射', () => {
  it('name→customName、sort=下标、status draft、isPublic false、profile/baseAnchor 透传', () => {
    const out = toCreateRecipeRequest(MILK_TEA());
    expect(out.status).toBe('draft');
    expect(out.isPublic).toBe(false);
    expect(out.scalingProfile).toBe('multi_ratio');
    expect(out.baseAnchor).toEqual({ percentBase: { ingredientIndex: 1 } });
    expect(out.ingredients[0].customName).toBe('茶叶');
    expect(out.ingredients.map((i) => i.sort)).toEqual([0, 1, 2]);
    expect(out.ingredients[2].percentageValue).toBe(10);
  });

  it('null 清洗：null 字段在 payload 上 key 为 undefined（JSON 序列化后消失）', () => {
    const out = toCreateRecipeRequest(
      recipeWith('linear_legacy', [ing({ name: '肉', scalingRole: null })]),
    );
    const json = JSON.parse(JSON.stringify(out));
    expect(json.ingredients[0]).not.toHaveProperty('scalingRole');
    expect(json.ingredients[0]).not.toHaveProperty('percentageValue');
    expect(json.ingredients[0]).not.toHaveProperty('ratioGroup');
    expect(json.ingredients[0]).not.toHaveProperty('ratioValue');
    expect(json.steps[0]).not.toHaveProperty('durationSeconds');
    expect(json).not.toHaveProperty('baseAnchor');
  });

  it('丢弃 cookTime；title trim', () => {
    const recipe = MILK_TEA();
    recipe.cookTime = '180min';
    recipe.title = '  奶茶  ';
    const out = toCreateRecipeRequest(recipe);
    expect(JSON.parse(JSON.stringify(out))).not.toHaveProperty('cookTime');
    expect(out.title).toBe('奶茶');
  });

  it('amount 舍入 2 位小数（0.125→0.13）；percentageValue 3 位原样', () => {
    const out = toCreateRecipeRequest(
      recipeWith('bakers_percentage', [
        ing({ name: '面粉', amount: 0.125, scalingRole: 'anchor', percentageValue: 100 }),
        ing({ name: '水', amount: 66.6666, scalingRole: 'percentage', percentageValue: 66.667 }),
      ]),
    );
    expect(out.ingredients[0].amount).toBe(0.13);
    expect(out.ingredients[1].amount).toBe(66.67);
    expect(out.ingredients[1].percentageValue).toBe(66.667);
  });

  it('降级后的草稿 → payload 无任何缩放 key、profile linear_legacy', () => {
    const downgraded = deleteIngredient(
      recipeWith('bakers_percentage', [
        ing({ name: '面粉', scalingRole: 'anchor', percentageValue: 100 }),
        ing({ name: '水', scalingRole: 'percentage', percentageValue: 65 }),
      ]),
      0,
    );
    const out = toCreateRecipeRequest(downgraded.recipe);
    const json = JSON.parse(JSON.stringify(out));
    expect(json.scalingProfile).toBe('linear_legacy');
    expect(json).not.toHaveProperty('baseAnchor');
    for (const i of json.ingredients) {
      expect(i).not.toHaveProperty('scalingRole');
      expect(i).not.toHaveProperty('percentageValue');
      expect(i).not.toHaveProperty('ratioGroup');
      expect(i).not.toHaveProperty('ratioValue');
    }
  });
});
