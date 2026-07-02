import { ScalingService, toEngineIngredients } from './scaling.service';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';

/** 构造一条 RecipeIngredient（decimal 均为 string，模拟 TypeORM 返回） */
function ing(partial: Partial<RecipeIngredient>): RecipeIngredient {
  return {
    id: 1,
    recipeId: 'r',
    ingredientId: null,
    customName: null,
    amount: '0.00',
    unit: 'g',
    scaleType: 'linear',
    scaleFactor: '0.70',
    groupName: null,
    scalingRole: null,
    percentageValue: null,
    ratioGroup: null,
    ratioValue: null,
    correction: null,
    roundDp: null,
    notes: null,
    sort: 0,
    ...partial,
  } as RecipeIngredient;
}

function makeRecipe(partial: Partial<Recipe>, ingredients: RecipeIngredient[]): Recipe {
  return {
    id: 'r1',
    title: '配方',
    baseServings: 2,
    scalingProfile: 'linear_legacy',
    ingredients,
    ...partial,
  } as Recipe;
}

/** 假 repo：findOne 返回给定 recipe（或 null） */
function svcWith(recipe: Recipe | null): ScalingService {
  const repo = { findOne: jest.fn().mockResolvedValue(recipe) } as any;
  return new ScalingService(repo);
}

describe('toEngineIngredients (decimal → number)', () => {
  it('所有 decimal parseFloat 成 number，非 string', () => {
    const [e] = toEngineIngredients([
      ing({
        id: 1,
        amount: '500.00',
        scaleFactor: '0.70',
        percentageValue: '65.000',
        ratioValue: '12.000',
        ratioGroup: 'tea_base',
        roundDp: 1,
        scalingRole: 'percentage',
      }),
    ]);
    expect(e.amount).toBe(500);
    expect(typeof e.amount).toBe('number');
    expect(e.scaleFactor).toBe(0.7);
    expect(e.percentageValue).toBe(65);
    expect(e.ratioValue).toBe(12);
    expect(typeof e.percentageValue).toBe('number');
    expect(typeof e.ratioValue).toBe('number');
    expect(e.ratioGroup).toBe('tea_base');
    expect(e.roundDp).toBe(1);
    expect(e.role).toBe('percentage');
  });

  it('null decimal → undefined（不产生 NaN）', () => {
    const [e] = toEngineIngredients([
      ing({ percentageValue: null, ratioValue: null, scalingRole: null }),
    ]);
    expect(e.percentageValue).toBeUndefined();
    expect(e.ratioValue).toBeUndefined();
    expect(e.role).toBeUndefined();
    expect(Number.isNaN(e.percentageValue as unknown as number)).toBe(false);
  });

  it('按 (sort, id) 排序', () => {
    const out = toEngineIngredients([
      ing({ id: 3, sort: 1 }),
      ing({ id: 1, sort: 0 }),
      ing({ id: 2, sort: 0 }),
    ]);
    expect(out.map((e) => e.id)).toEqual([1, 2, 3]);
  });
});

describe('ScalingService.scale (servings, linear_legacy 逐字节不变)', () => {
  const legacy = makeRecipe(
    { id: 'r1', title: '回锅肉', baseServings: 2, scalingProfile: 'linear_legacy' },
    [
      ing({
        id: 1,
        customName: '主料',
        ingredientId: 10,
        groupName: '主料',
        amount: '100.00',
        scaleType: 'linear',
      }),
      ing({
        id: 2,
        customName: '调料',
        amount: '100.00',
        scaleType: 'sub_linear',
        scaleFactor: '0.70',
      }),
      ing({ id: 3, customName: '蒜', amount: '3.00', unit: 'count', scaleType: 'fixed' }),
    ],
  );

  it('multiplier=2：linear×2、sub_linear 幂、fixed 不变（roundAmount）', async () => {
    const r = await svcWith(legacy).scale('r1', 4);
    expect(r.multiplier).toBe(2);
    expect(r.targetServings).toBe(4);
    expect(r.baseServings).toBe(2);
    const byId = Object.fromEntries(r.ingredients.map((i) => [i.id, i]));
    expect(byId[1].scaledAmount).toBe(200); // 100*2
    expect(byId[2].scaledAmount).toBe(162); // roundAmount(100*2^0.7=162.45)
    expect(byId[3].scaledAmount).toBe(3); // fixed
    // 身份字段与 legacy 响应形状保留
    expect(byId[1].ingredientId).toBe(10);
    expect(byId[1].scaleType).toBe('linear');
    expect(byId[1].scaleFactor).toBe(0.7);
  });

  it('targetServings<=0 → BadRequest', async () => {
    await expect(svcWith(legacy).scale('r1', 0)).rejects.toThrow();
  });

  it('recipe 不存在 → NotFound', async () => {
    await expect(svcWith(null).scale('x', 4)).rejects.toThrow();
  });

  it('非 legacy profile 走 servings → BadRequest（引导锁定式）', async () => {
    const bakers = makeRecipe({ scalingProfile: 'bakers_percentage' }, [
      ing({ id: 1, scalingRole: 'anchor', percentageValue: '100.000', amount: '500.00' }),
    ]);
    await expect(svcWith(bakers).scale('r1', 4)).rejects.toThrow();
  });
});

describe('ScalingService.scaleWithSpec (锁定式，分派引擎)', () => {
  it('linear_legacy：multiplier=2 → 主料×2', async () => {
    const recipe = makeRecipe({ scalingProfile: 'linear_legacy' }, [
      ing({ id: 1, customName: '主料', amount: '100.00', scaleType: 'linear' }),
    ]);
    const r = await svcWith(recipe).scaleWithSpec('r1', {
      profile: 'linear_legacy',
      multiplier: 2,
    });
    expect(r.scalingProfile).toBe('linear_legacy');
    expect(r.ingredients[0].scaledAmount).toBe(200);
  });

  it('bakers：锁 anchor=1000 → water 650、salt 20、flour 1000', async () => {
    const recipe = makeRecipe({ scalingProfile: 'bakers_percentage' }, [
      ing({
        id: 11,
        customName: 'flour',
        ingredientId: 5,
        groupName: '主料',
        amount: '500.00',
        scalingRole: 'anchor',
        percentageValue: '100.000',
      }),
      ing({
        id: 12,
        customName: 'water',
        amount: '325.00',
        scalingRole: 'percentage',
        percentageValue: '65.000',
      }),
      ing({
        id: 13,
        customName: 'salt',
        amount: '10.00',
        scalingRole: 'percentage',
        percentageValue: '2.000',
      }),
    ]);
    const r = await svcWith(recipe).scaleWithSpec('r1', {
      profile: 'bakers_percentage',
      lock: { mode: 'anchor', value: 1000 },
    });
    const byId = Object.fromEntries(r.ingredients.map((i) => [i.id, i]));
    expect(byId[11].scaledAmount).toBe(1000);
    expect(byId[12].scaledAmount).toBe(650);
    expect(byId[13].scaledAmount).toBe(20);
    // 身份字段回挂
    expect(byId[11].customName).toBe('flour');
    expect(byId[11].ingredientId).toBe(5);
    expect(byId[11].groupName).toBe('主料');
    expect(byId[12].scalingRole).toBe('percentage');
  });

  it('ratio：锁 water=300 → coffee 20、water 300', async () => {
    const recipe = makeRecipe({ scalingProfile: 'ratio_based' }, [
      ing({
        id: 21,
        customName: 'coffee',
        amount: '20.00',
        scalingRole: 'anchor',
        ratioValue: '1.000',
      }),
      ing({
        id: 22,
        customName: 'water',
        amount: '300.00',
        scalingRole: 'ratio_linked',
        ratioValue: '15.000',
      }),
    ]);
    const r = await svcWith(recipe).scaleWithSpec('r1', {
      profile: 'ratio_based',
      lock: { id: 22, value: 300 },
    });
    const byId = Object.fromEntries(r.ingredients.map((i) => [i.id, i]));
    expect(byId[21].scaledAmount).toBe(20); // 咖啡粉 0.1g
    expect(byId[22].scaledAmount).toBe(300); // 水 1g
  });

  it('multi_ratio：奶茶锁 tea=5 + percentBase 水 → sugar 4.8、milk 18、water 60', async () => {
    const recipe = makeRecipe({ scalingProfile: 'multi_ratio' }, [
      ing({
        id: 31,
        customName: 'tea',
        amount: '5.00',
        scalingRole: 'ratio_linked',
        ratioGroup: 'tea_base',
        ratioValue: '1.000',
      }),
      ing({
        id: 32,
        customName: 'water',
        amount: '60.00',
        scalingRole: 'ratio_linked',
        ratioGroup: 'tea_base',
        ratioValue: '12.000',
      }),
      ing({
        id: 33,
        customName: 'sugar',
        amount: '4.80',
        scalingRole: 'percentage',
        percentageValue: '8.000',
      }),
      ing({
        id: 34,
        customName: 'milk',
        amount: '18.00',
        scalingRole: 'percentage',
        percentageValue: '30.000',
      }),
    ]);
    const r = await svcWith(recipe).scaleWithSpec('r1', {
      profile: 'multi_ratio',
      spec: {
        groups: [{ group: 'tea_base', lockedId: 31, lockedValue: 5 }],
        percentBase: { id: 32 },
      },
    });
    const byId = Object.fromEntries(r.ingredients.map((i) => [i.id, i]));
    expect(byId[32].scaledAmount).toBe(60); // 液体 1g
    expect(byId[33].scaledAmount).toBe(4.8); // 糖 0.1g
    expect(byId[34].scaledAmount).toBe(18); // 奶 0.1g
  });

  it('recipe 不存在 → NotFound', async () => {
    await expect(
      svcWith(null).scaleWithSpec('x', { profile: 'linear_legacy', multiplier: 1 }),
    ).rejects.toThrow();
  });
});
