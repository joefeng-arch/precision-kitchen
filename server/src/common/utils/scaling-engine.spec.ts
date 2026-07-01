import {
  EngineIngredient,
  ScaledIngredient,
  applyCorrection,
  scaleBakersPercentage,
  scaleLinearLegacy,
  scaleMultiRatio,
  scaleRatio,
  scaleRecipe,
} from './scaling-engine';

/** 从结果里按 id 取缩放后用量，便于断言 */
function amt(results: ScaledIngredient[], id: number | string): number {
  const found = results.find((r) => r.id === id);
  if (!found) throw new Error(`no result for id=${id}`);
  return found.scaledAmount;
}

describe('applyCorrection (§4.1.5 非线性修正)', () => {
  const single = { type: 'step' as const, rules: [{ above_factor: 3, multiply: 0.75 }] };
  const ladder = {
    type: 'step' as const,
    rules: [
      { above_factor: 3, multiply: 0.75 },
      { above_factor: 5, multiply: 0.5 },
    ],
  };

  it('无 correction 时原样返回', () => {
    expect(applyCorrection(40, 4)).toBe(40);
    expect(applyCorrection(40, 4, null)).toBe(40);
  });

  it('因子未超阈值不触发', () => {
    expect(applyCorrection(40, 2, single)).toBe(40);
  });

  it('边界：因子恰等于阈值不触发（严格 >）', () => {
    expect(applyCorrection(40, 3, single)).toBe(40);
  });

  it('因子略超阈值触发', () => {
    expect(applyCorrection(40, 3.0001, single)).toBeCloseTo(30, 5);
    expect(applyCorrection(40, 4, single)).toBe(30);
  });

  it('多规则取被超过的最大阈值（阶梯，非累乘）', () => {
    expect(applyCorrection(40, 4, ladder)).toBe(30); // 超过 3 未超 5 → 0.75
    expect(applyCorrection(40, 6, ladder)).toBe(20); // 超过 5 → 0.5（非 0.75*0.5）
    expect(applyCorrection(40, 3, ladder)).toBe(40); // 均未超过
  });
});

describe('scaleLinearLegacy (收纳国内版三种 scaleType)', () => {
  const ings: EngineIngredient[] = [
    { id: 1, name: '主料', amount: 100, unit: 'g', role: 'anchor', scaleType: 'linear' },
    {
      id: 2,
      name: '调料',
      amount: 100,
      unit: 'g',
      role: 'percentage',
      scaleType: 'sub_linear',
      scaleFactor: 0.7,
    },
    { id: 3, name: '蒜', amount: 3, unit: 'count', role: 'fixed', scaleType: 'fixed' },
  ];

  it('linear 等比、sub_linear 幂函数、fixed 不变（行为与现状一致）', () => {
    const r = scaleLinearLegacy(ings, 2);
    expect(amt(r, 1)).toBe(200); // 100*2
    expect(amt(r, 2)).toBe(162); // roundAmount(100*2^0.7=162.45)=162 (>=10 取整)
    expect(amt(r, 3)).toBe(3); // fixed
  });

  it('multiplier=1 恒等', () => {
    const r = scaleLinearLegacy(ings, 1);
    expect(amt(r, 1)).toBe(100);
    expect(amt(r, 2)).toBe(100);
    expect(amt(r, 3)).toBe(3);
  });
});

describe('scaleBakersPercentage', () => {
  // flour 100% (基准 500) / water 65% / salt 2% (非线性修正) / yeast 1% / vanilla 固定
  const ings: EngineIngredient[] = [
    { id: 'flour', amount: 500, unit: 'g', role: 'anchor', percentageValue: 100 },
    { id: 'water', amount: 325, unit: 'g', role: 'percentage', percentageValue: 65 },
    {
      id: 'salt',
      amount: 10,
      unit: 'g',
      role: 'percentage',
      percentageValue: 2,
      correction: { type: 'step', rules: [{ above_factor: 3, multiply: 0.75 }] },
    },
    { id: 'yeast', amount: 5, unit: 'g', role: 'percentage', percentageValue: 1 },
    { id: 'vanilla', amount: 4, unit: 'g', role: 'fixed' },
  ];

  it('锁基准量 F=500（原样）', () => {
    const r = scaleBakersPercentage(ings, { mode: 'anchor', value: 500 });
    expect(amt(r, 'flour')).toBe(500);
    expect(amt(r, 'water')).toBe(325);
    expect(amt(r, 'salt')).toBe(10);
    expect(amt(r, 'yeast')).toBe(5);
    expect(amt(r, 'vanilla')).toBe(4); // fixed 不缩放
  });

  it('锁基准量 F=1000（2x，未触发修正）', () => {
    const r = scaleBakersPercentage(ings, { mode: 'anchor', value: 1000 });
    expect(amt(r, 'flour')).toBe(1000);
    expect(amt(r, 'water')).toBe(650);
    expect(amt(r, 'salt')).toBe(20); // factor 2 不 >3
    expect(amt(r, 'yeast')).toBe(10);
    expect(amt(r, 'vanilla')).toBe(4);
  });

  it('锁基准量 F=2000（4x，触发盐非线性修正 -25%）', () => {
    const r = scaleBakersPercentage(ings, { mode: 'anchor', value: 2000 });
    expect(amt(r, 'water')).toBe(1300);
    expect(amt(r, 'salt')).toBe(30); // 40 * 0.75
    expect(amt(r, 'yeast')).toBe(20);
  });

  it('边界：F=1500（factor 恰 3，不触发修正）', () => {
    const r = scaleBakersPercentage(ings, { mode: 'anchor', value: 1500 });
    expect(amt(r, 'salt')).toBe(30); // 1500*2/100=30，factor 3 不 >3
  });

  it('锁总重 T=1680（S=168 → F=1000，等价 2x）', () => {
    const r = scaleBakersPercentage(ings, { mode: 'total', value: 1680 });
    expect(amt(r, 'flour')).toBe(1000);
    expect(amt(r, 'water')).toBe(650);
    expect(amt(r, 'salt')).toBe(20);
    expect(amt(r, 'yeast')).toBe(10);
  });
});

describe('scaleRatio (两端联动 + 除零防御)', () => {
  const ings: EngineIngredient[] = [
    { id: 'coffee', amount: 20, unit: 'g', role: 'anchor', ratioValue: 1 },
    { id: 'water', amount: 300, unit: 'g', role: 'ratio_linked', ratioValue: 15 },
  ];

  it('锁 coffee=20 → water=300', () => {
    const r = scaleRatio(ings, { id: 'coffee', value: 20 });
    expect(amt(r, 'coffee')).toBe(20);
    expect(amt(r, 'water')).toBe(300);
  });

  it('锁 water=300 → coffee=20（反向联动）', () => {
    const r = scaleRatio(ings, { id: 'water', value: 300 });
    expect(amt(r, 'coffee')).toBe(20);
    expect(amt(r, 'water')).toBe(300);
  });

  it('锁 coffee=30 → water=450（1.5x）', () => {
    const r = scaleRatio(ings, { id: 'coffee', value: 30 });
    expect(amt(r, 'coffee')).toBe(30);
    expect(amt(r, 'water')).toBe(450);
  });

  it('防御：锁定成员 ratioValue 缺失/为 0 抛错，不产生 NaN', () => {
    const bad: EngineIngredient[] = [
      { id: 'a', amount: 10, unit: 'g', role: 'anchor', ratioValue: 0 },
      { id: 'b', amount: 20, unit: 'g', role: 'ratio_linked', ratioValue: 2 },
    ];
    expect(() => scaleRatio(bad, { id: 'a', value: 10 })).toThrow();
  });

  it('防御：某成员 ratioValue 缺失抛错，不静默传 NaN', () => {
    const bad: EngineIngredient[] = [
      { id: 'coffee', amount: 20, unit: 'g', role: 'anchor', ratioValue: 1 },
      { id: 'water', amount: 300, unit: 'g', role: 'ratio_linked' }, // 无 ratioValue
    ];
    expect(() => scaleRatio(bad, { id: 'coffee', value: 20 })).toThrow();
  });
});

describe('scaleMultiRatio (奶茶 / 鸡尾酒)', () => {
  // 奶茶：tea:water = 1:12（parts 组）+ sugar 8% + milk 30%
  const milkTea: EngineIngredient[] = [
    {
      id: 'tea',
      amount: 5,
      unit: 'g',
      role: 'ratio_linked',
      ratioGroup: 'tea_base',
      ratioValue: 1,
    },
    {
      id: 'water',
      amount: 60,
      unit: 'g',
      role: 'ratio_linked',
      ratioGroup: 'tea_base',
      ratioValue: 12,
    },
    { id: 'sugar', amount: 4.8, unit: 'g', role: 'percentage', percentageValue: 8 },
    { id: 'milk', amount: 18, unit: 'g', role: 'percentage', percentageValue: 30 },
  ];

  it('锁 tea=5 + 基准=水量（假设 A）→ water=60, sugar=4.8, milk=18', () => {
    const r = scaleMultiRatio(milkTea, {
      groups: [{ group: 'tea_base', lockedId: 'tea', lockedValue: 5 }],
      percentBase: { id: 'water' },
    });
    expect(amt(r, 'tea')).toBe(5);
    expect(amt(r, 'water')).toBe(60);
    expect(amt(r, 'sugar')).toBe(4.8); // 60 * 8%
    expect(amt(r, 'milk')).toBe(18); // 60 * 30%
  });

  it('锁 tea=10（2x）+ 基准=水量 → water=120, sugar=9.6, milk=36', () => {
    const r = scaleMultiRatio(milkTea, {
      groups: [{ group: 'tea_base', lockedId: 'tea', lockedValue: 10 }],
      percentBase: { id: 'water' },
    });
    expect(amt(r, 'water')).toBe(120);
    expect(amt(r, 'sugar')).toBe(9.6);
    expect(amt(r, 'milk')).toBe(36);
  });

  it('基准=整组（tea+water=65）→ sugar=5.2, milk=19.5（证明基准不写死）', () => {
    const r = scaleMultiRatio(milkTea, {
      groups: [{ group: 'tea_base', lockedId: 'tea', lockedValue: 5 }],
      percentBase: { group: 'tea_base' },
    });
    expect(amt(r, 'sugar')).toBe(5.2); // 65 * 8% = 5.2（<10 保留 1 位）
    expect(amt(r, 'milk')).toBe(20); // 65 * 30% = 19.5 → roundAmount(≥10 取整) = 20
  });

  it('锁组总量 total=65 → tea=5, water=60（与锁单项等价）', () => {
    const r = scaleMultiRatio(milkTea, {
      groups: [{ group: 'tea_base', total: 65 }],
      percentBase: { id: 'water' },
    });
    expect(amt(r, 'tea')).toBe(5);
    expect(amt(r, 'water')).toBe(60);
  });

  // 鸡尾酒：spirit:liqueur:juice = 3:2:1（单 parts 组，无 percentage）
  const cocktail: EngineIngredient[] = [
    {
      id: 'spirit',
      amount: 60,
      unit: 'ml',
      role: 'ratio_linked',
      ratioGroup: 'mix',
      ratioValue: 3,
    },
    {
      id: 'liqueur',
      amount: 40,
      unit: 'ml',
      role: 'ratio_linked',
      ratioGroup: 'mix',
      ratioValue: 2,
    },
    { id: 'juice', amount: 20, unit: 'ml', role: 'ratio_linked', ratioGroup: 'mix', ratioValue: 1 },
  ];

  it('锁总量 total=120 → 60/40/20', () => {
    const r = scaleMultiRatio(cocktail, { groups: [{ group: 'mix', total: 120 }] });
    expect(amt(r, 'spirit')).toBe(60);
    expect(amt(r, 'liqueur')).toBe(40);
    expect(amt(r, 'juice')).toBe(20);
  });

  it('锁单项 spirit=60 → 同解 60/40/20', () => {
    const r = scaleMultiRatio(cocktail, {
      groups: [{ group: 'mix', lockedId: 'spirit', lockedValue: 60 }],
    });
    expect(amt(r, 'spirit')).toBe(60);
    expect(amt(r, 'liqueur')).toBe(40);
    expect(amt(r, 'juice')).toBe(20);
  });

  it('锁总量 total=240（2x）→ 120/80/40', () => {
    const r = scaleMultiRatio(cocktail, { groups: [{ group: 'mix', total: 240 }] });
    expect(amt(r, 'spirit')).toBe(120);
    expect(amt(r, 'liqueur')).toBe(80);
    expect(amt(r, 'juice')).toBe(40);
  });

  it('防御：parts 组 total 但成员 parts 之和为 0 → 抛错', () => {
    const bad: EngineIngredient[] = [
      { id: 'x', amount: 1, unit: 'g', role: 'ratio_linked', ratioGroup: 'g', ratioValue: 0 },
    ];
    expect(() => scaleMultiRatio(bad, { groups: [{ group: 'g', total: 10 }] })).toThrow();
  });
});

describe('scaleRecipe (分发器)', () => {
  it('linear_legacy 分发', () => {
    const ings: EngineIngredient[] = [
      { id: 1, amount: 100, unit: 'g', role: 'anchor', scaleType: 'linear' },
    ];
    expect(amt(scaleRecipe(ings, { profile: 'linear_legacy', multiplier: 2 }), 1)).toBe(200);
  });

  it('bakers_percentage 分发', () => {
    const ings: EngineIngredient[] = [
      { id: 'flour', amount: 500, unit: 'g', role: 'anchor', percentageValue: 100 },
      { id: 'water', amount: 325, unit: 'g', role: 'percentage', percentageValue: 65 },
    ];
    expect(
      amt(
        scaleRecipe(ings, { profile: 'bakers_percentage', lock: { mode: 'anchor', value: 1000 } }),
        'water',
      ),
    ).toBe(650);
  });

  it('ratio_based 分发', () => {
    const ings: EngineIngredient[] = [
      { id: 'coffee', amount: 20, unit: 'g', role: 'anchor', ratioValue: 1 },
      { id: 'water', amount: 300, unit: 'g', role: 'ratio_linked', ratioValue: 15 },
    ];
    expect(
      amt(
        scaleRecipe(ings, { profile: 'ratio_based', lock: { id: 'coffee', value: 20 } }),
        'water',
      ),
    ).toBe(300);
  });

  it('multi_ratio 分发', () => {
    const ings: EngineIngredient[] = [
      {
        id: 'spirit',
        amount: 60,
        unit: 'ml',
        role: 'ratio_linked',
        ratioGroup: 'mix',
        ratioValue: 3,
      },
      {
        id: 'juice',
        amount: 20,
        unit: 'ml',
        role: 'ratio_linked',
        ratioGroup: 'mix',
        ratioValue: 1,
      },
    ];
    expect(
      amt(
        scaleRecipe(ings, {
          profile: 'multi_ratio',
          spec: { groups: [{ group: 'mix', total: 80 }] },
        }),
        'spirit',
      ),
    ).toBe(60);
  });
});
