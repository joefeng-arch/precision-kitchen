import {
  RECIPES,
  validateSeedRecipeDef,
  type SeedRecipe,
} from './overseas-official-recipes.seed';

const GOOD_BAKERS: SeedRecipe = {
  title: 'Test Loaf',
  description: 'test',
  category: 'Baking',
  scalingProfile: 'bakers_percentage',
  baseServings: 1,
  difficulty: 'medium',
  totalMinutes: 60,
  tags: [],
  ingredients: [
    { customName: 'Flour', amount: '500', unit: 'g', scalingRole: 'anchor', percentageValue: '100' },
    { customName: 'Water', amount: '325', unit: 'g', scalingRole: 'percentage', percentageValue: '65' },
  ],
  steps: [{ description: 'Mix and bake.' }],
};

describe('validateSeedRecipeDef', () => {
  it('结构良好的 bakers def → []', () => {
    expect(validateSeedRecipeDef(GOOD_BAKERS)).toEqual([]);
  });

  it('bakers 缺锚 → 非空 errors', () => {
    const bad: SeedRecipe = {
      ...GOOD_BAKERS,
      ingredients: GOOD_BAKERS.ingredients.map((i) => ({ ...i, scalingRole: 'percentage' as const })),
    };
    expect(validateSeedRecipeDef(bad)).not.toEqual([]);
  });

  it('percentBaseAnchor 指向不存在的原料 → 报名字', () => {
    const bad: SeedRecipe = {
      ...GOOD_BAKERS,
      scalingProfile: 'multi_ratio',
      percentBaseAnchor: 'Nonexistent thing',
      ingredients: [
        {
          customName: 'Tea',
          amount: '10',
          unit: 'g',
          scalingRole: 'ratio_linked',
          ratioGroup: 'tea_base',
          ratioValue: '1',
        },
        { customName: 'Sugar', amount: '5', unit: 'g', scalingRole: 'percentage', percentageValue: '8' },
      ],
    };
    const errors = validateSeedRecipeDef(bad);
    expect(errors.join(' ')).toContain('Nonexistent thing');
  });

  it('multi_ratio 有 percentage 料但无 percentBaseAnchor → 报错', () => {
    const bad: SeedRecipe = {
      ...GOOD_BAKERS,
      scalingProfile: 'multi_ratio',
      percentBaseAnchor: undefined,
      ingredients: [
        {
          customName: 'Tea',
          amount: '10',
          unit: 'g',
          scalingRole: 'ratio_linked',
          ratioGroup: 'tea_base',
          ratioValue: '1',
        },
        { customName: 'Sugar', amount: '5', unit: 'g', scalingRole: 'percentage', percentageValue: '8' },
      ],
    };
    expect(validateSeedRecipeDef(bad)).not.toEqual([]);
  });

  it('内容门禁：RECIPES 全体自检通过（贴新内容时此测试即质量闸）', () => {
    expect(RECIPES.length).toBeGreaterThan(0);
    for (const def of RECIPES) {
      const errors = validateSeedRecipeDef(def);
      expect({ title: def.title, errors }).toEqual({ title: def.title, errors: [] });
    }
  });

  it('内容抽查：四个 profile 都有代表；奶茶 percentBaseAnchor 指向水成员', () => {
    const profiles = new Set(RECIPES.map((r) => r.scalingProfile));
    expect(profiles.has('bakers_percentage')).toBe(true);
    expect(profiles.has('ratio_based')).toBe(true);
    expect(profiles.has('multi_ratio')).toBe(true);

    const milkTea = RECIPES.find((r) => r.title === 'Classic Milk Tea');
    expect(milkTea?.percentBaseAnchor).toBe('Hot water (95°C)');
  });
});
