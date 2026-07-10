import { collectScalingErrors, validateAndRecomputeScaling } from './parse-scaling-validator';

/** 快速构造分类输入原料 */
function ing(
  name: string,
  amount: number,
  extra: {
    scalingRole?: unknown;
    ratioGroup?: unknown;
    ratioHint?: unknown;
    percentHint?: unknown;
  } = {},
) {
  return { name, amount, ...extra };
}

// ─── 种子 fixture 对应的 AI 分类输入 ─────────────────────────────

const BREAD = {
  scalingProfile: 'bakers_percentage',
  ingredients: [
    ing('高筋面粉', 500, { scalingRole: 'anchor' }),
    ing('水', 325, { scalingRole: 'percentage' }),
    ing('盐', 10, { scalingRole: 'percentage' }),
    ing('酵母', 5, { scalingRole: 'percentage' }),
  ],
};

const COFFEE = {
  scalingProfile: 'ratio_based',
  ingredients: [
    ing('咖啡粉', 20, { scalingRole: 'anchor' }),
    ing('水', 300, { scalingRole: 'ratio_linked' }),
  ],
};

const MILK_TEA = {
  scalingProfile: 'multi_ratio',
  percentBase: { ingredientIndex: 1 },
  ingredients: [
    ing('茶叶', 100, { scalingRole: 'ratio_linked', ratioGroup: 'tea_base' }),
    ing('热水', 400, { scalingRole: 'ratio_linked', ratioGroup: 'tea_base' }),
    ing('糖', 40, { scalingRole: 'percentage' }),
  ],
};

const COCKTAIL = {
  scalingProfile: 'multi_ratio',
  ingredients: [
    ing('烈酒', 45, { scalingRole: 'ratio_linked', ratioGroup: 'mix' }),
    ing('利口酒', 30, { scalingRole: 'ratio_linked', ratioGroup: 'mix' }),
    ing('果汁', 15, { scalingRole: 'ratio_linked', ratioGroup: 'mix' }),
  ],
};

// ─── linear_legacy / 未知 profile ────────────────────────────────

describe('validateAndRecomputeScaling — 基础路由', () => {
  it('linear_legacy：四字段全 null、无警告、severity ok', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'linear_legacy',
      ingredients: [ing('猪肉', 300), ing('盐', 5)],
    });
    expect(r.scalingProfile).toBe('linear_legacy');
    expect(r.baseAnchor).toBeNull();
    expect(r.warnings).toEqual([]);
    expect(r.severity).toBe('ok');
    for (const i of r.ingredients) {
      expect(i.scalingRole).toBeNull();
      expect(i.percentageValue).toBeNull();
      expect(i.ratioGroup).toBeNull();
      expect(i.ratioValue).toBeNull();
    }
  });

  it('profile 缺失（AI 没给）→ 按 linear_legacy 处理，不警告', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: undefined,
      ingredients: [ing('猪肉', 300)],
    });
    expect(r.scalingProfile).toBe('linear_legacy');
    expect(r.severity).toBe('ok');
    expect(r.warnings).toEqual([]);
  });

  it('未知 profile 字符串 → fallback + 警告', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'super_scaling',
      ingredients: [ing('猪肉', 300)],
    });
    expect(r.scalingProfile).toBe('linear_legacy');
    expect(r.severity).toBe('fallback');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

// ─── bakers_percentage ──────────────────────────────────────────

describe('validateAndRecomputeScaling — bakers_percentage', () => {
  it('面包 fixture → 锚点 100，其余 65/2/1，severity ok', () => {
    const r = validateAndRecomputeScaling(BREAD);
    expect(r.scalingProfile).toBe('bakers_percentage');
    expect(r.severity).toBe('ok');
    expect(r.warnings).toEqual([]);
    expect(r.baseAnchor).toBeNull();
    expect(r.ingredients[0]).toEqual({
      scalingRole: 'anchor',
      percentageValue: 100,
      ratioGroup: null,
      ratioValue: null,
    });
    expect(r.ingredients[1].percentageValue).toBe(65);
    expect(r.ingredients[2].percentageValue).toBe(2);
    expect(r.ingredients[3].percentageValue).toBe(1);
  });

  it('百分比重算到 3 位小数（222/333 → 66.667）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('面粉', 333, { scalingRole: 'anchor' }),
        ing('水', 222, { scalingRole: 'percentage' }),
      ],
    });
    expect(r.ingredients[1].percentageValue).toBe(66.667);
  });

  it('无锚点 → fallback + 警告', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [ing('面粉', 500, { scalingRole: 'percentage' }), ing('水', 325)],
    });
    expect(r.scalingProfile).toBe('linear_legacy');
    expect(r.severity).toBe('fallback');
    expect(r.ingredients.every((i) => i.scalingRole === null)).toBe(true);
    expect(r.warnings.some((w) => w.includes('anchor') || w.includes('基准'))).toBe(true);
  });

  it('双锚点 → fallback', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('面粉A', 300, { scalingRole: 'anchor' }),
        ing('面粉B', 200, { scalingRole: 'anchor' }),
      ],
    });
    expect(r.severity).toBe('fallback');
  });

  it('锚点 amount=0 → fallback（无从重算）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('面粉', 0, { scalingRole: 'anchor' }),
        ing('水', 325, { scalingRole: 'percentage' }),
      ],
    });
    expect(r.severity).toBe('fallback');
  });

  it('percentage 成员 amount=0 无提示 → 纠偏为 fixed（adjusted）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('面粉', 500, { scalingRole: 'anchor' }),
        ing('黄油（适量）', 0, { scalingRole: 'percentage' }),
      ],
    });
    expect(r.severity).toBe('adjusted');
    expect(r.ingredients[1].scalingRole).toBe('fixed');
    expect(r.ingredients[1].percentageValue).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('percentage 成员 amount=0 但有 percentHint → 采用提示值（adjusted）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('面粉', 500, { scalingRole: 'anchor' }),
        ing('水', 0, { scalingRole: 'percentage', percentHint: 65 }),
      ],
    });
    expect(r.severity).toBe('adjusted');
    expect(r.ingredients[1].scalingRole).toBe('percentage');
    expect(r.ingredients[1].percentageValue).toBe(65);
  });

  it('角色缺失按 amount 纠偏：>0 → percentage、=0 → fixed（adjusted）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [ing('面粉', 500, { scalingRole: 'anchor' }), ing('水', 325), ing('香草精', 0)],
    });
    expect(r.severity).toBe('adjusted');
    expect(r.ingredients[1].scalingRole).toBe('percentage');
    expect(r.ingredients[1].percentageValue).toBe(65);
    expect(r.ingredients[2].scalingRole).toBe('fixed');
  });

  it('重算百分比超出 decimal(7,3) 上限 → fallback（离谱分类）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('酵母', 0.01, { scalingRole: 'anchor' }),
        ing('面粉', 5000, { scalingRole: 'percentage' }),
      ],
    });
    expect(r.severity).toBe('fallback');
  });
});

// ─── ratio_based ────────────────────────────────────────────────

describe('validateAndRecomputeScaling — ratio_based', () => {
  it('咖啡 fixture → 锚点 1、水 15，severity ok', () => {
    const r = validateAndRecomputeScaling(COFFEE);
    expect(r.severity).toBe('ok');
    expect(r.ingredients[0]).toEqual({
      scalingRole: 'anchor',
      percentageValue: null,
      ratioGroup: null,
      ratioValue: 1,
    });
    expect(r.ingredients[1].ratioValue).toBe(15);
    expect(r.baseAnchor).toBeNull();
  });

  it('全员无用量但有 ratioHint 1:15 → 采用提示（adjusted）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'ratio_based',
      ingredients: [
        ing('咖啡粉', 0, { scalingRole: 'anchor', ratioHint: 1 }),
        ing('水', 0, { scalingRole: 'ratio_linked', ratioHint: 15 }),
      ],
    });
    expect(r.severity).toBe('adjusted');
    expect(r.ingredients[0].ratioValue).toBe(1);
    expect(r.ingredients[1].ratioValue).toBe(15);
  });

  it('存在比例外原料（fixed/未分类）→ fallback（引擎对全员 requirePositive，无透传）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'ratio_based',
      ingredients: [
        ing('咖啡粉', 20, { scalingRole: 'anchor' }),
        ing('水', 300, { scalingRole: 'ratio_linked' }),
        ing('肉桂粉', 0, { scalingRole: 'fixed' }),
      ],
    });
    expect(r.severity).toBe('fallback');
  });

  it('成员 amount=0 且无提示 → fallback', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'ratio_based',
      ingredients: [
        ing('咖啡粉', 20, { scalingRole: 'anchor' }),
        ing('水', 0, { scalingRole: 'ratio_linked' }),
      ],
    });
    expect(r.severity).toBe('fallback');
  });

  it('无锚点 → fallback', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'ratio_based',
      ingredients: [
        ing('咖啡粉', 20, { scalingRole: 'ratio_linked' }),
        ing('水', 300, { scalingRole: 'ratio_linked' }),
      ],
    });
    expect(r.severity).toBe('fallback');
  });
});

// ─── multi_ratio ────────────────────────────────────────────────

describe('validateAndRecomputeScaling — multi_ratio', () => {
  it('奶茶 fixture → tea_base 1:4、糖 10%、baseAnchor 指向热水下标', () => {
    const r = validateAndRecomputeScaling(MILK_TEA);
    expect(r.severity).toBe('ok');
    expect(r.ingredients[0]).toEqual({
      scalingRole: 'ratio_linked',
      percentageValue: null,
      ratioGroup: 'tea_base',
      ratioValue: 1,
    });
    expect(r.ingredients[1].ratioValue).toBe(4);
    expect(r.ingredients[2]).toEqual({
      scalingRole: 'percentage',
      percentageValue: 10,
      ratioGroup: null,
      ratioValue: null,
    });
    expect(r.baseAnchor).toEqual({ percentBase: { ingredientIndex: 1 } });
  });

  it('鸡尾酒 fixture（无 percentage）→ 3:2:1、baseAnchor null', () => {
    const r = validateAndRecomputeScaling(COCKTAIL);
    expect(r.severity).toBe('ok');
    expect(r.ingredients.map((i) => i.ratioValue)).toEqual([3, 2, 1]);
    expect(r.baseAnchor).toBeNull();
  });

  it('percentBase 为 {group} → 基准为组用量之和（糖 40 / 500 = 8%）', () => {
    const r = validateAndRecomputeScaling({
      ...MILK_TEA,
      percentBase: { group: 'tea_base' },
    });
    expect(r.severity).toBe('ok');
    expect(r.ingredients[2].percentageValue).toBe(8);
    expect(r.baseAnchor).toEqual({ percentBase: { group: 'tea_base' } });
  });

  it('有 percentage 料但无 percentBase → fallback（镜像引擎守卫）', () => {
    const r = validateAndRecomputeScaling({ ...MILK_TEA, percentBase: undefined });
    expect(r.severity).toBe('fallback');
    expect(r.warnings.some((w) => w.includes('percentBase'))).toBe(true);
  });

  it('percentBase 下标越界 → fallback', () => {
    const r = validateAndRecomputeScaling({
      ...MILK_TEA,
      percentBase: { ingredientIndex: 99 },
    });
    expect(r.severity).toBe('fallback');
  });

  it('percentBase 指向非 ratio_linked 原料 → fallback', () => {
    const r = validateAndRecomputeScaling({
      ...MILK_TEA,
      percentBase: { ingredientIndex: 2 },
    });
    expect(r.severity).toBe('fallback');
  });

  it('ratio_linked 缺 ratioGroup → fallback（结构性）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'multi_ratio',
      ingredients: [
        ing('茶叶', 100, { scalingRole: 'ratio_linked' }),
        ing('热水', 400, { scalingRole: 'ratio_linked', ratioGroup: 'tea_base' }),
      ],
    });
    expect(r.severity).toBe('fallback');
  });

  it('单成员比例组 → 允许、不警告（ratioValue=1）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'multi_ratio',
      ingredients: [
        ing('珍珠', 50, { scalingRole: 'ratio_linked', ratioGroup: 'topping' }),
        ing('茶', 200, { scalingRole: 'ratio_linked', ratioGroup: 'tea' }),
      ],
    });
    expect(r.severity).toBe('ok');
    expect(r.warnings).toEqual([]);
    expect(r.ingredients[0].ratioValue).toBe(1);
    expect(r.ingredients[1].ratioValue).toBe(1);
  });

  it('未分类原料 → 纠偏为 fixed（引擎按原量透传，安全）', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'multi_ratio',
      ingredients: [
        ing('茶', 200, { scalingRole: 'ratio_linked', ratioGroup: 'tea' }),
        ing('冰块', 0),
      ],
    });
    expect(r.severity).toBe('adjusted');
    expect(r.ingredients[1].scalingRole).toBe('fixed');
  });

  it('percentage 成员 amount=0 无提示 → 纠偏 fixed；全部纠偏后 baseAnchor 置 null', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'multi_ratio',
      percentBase: { ingredientIndex: 0 },
      ingredients: [
        ing('热水', 400, { scalingRole: 'ratio_linked', ratioGroup: 'tea_base' }),
        ing('糖（适量）', 0, { scalingRole: 'percentage' }),
      ],
    });
    expect(r.severity).toBe('adjusted');
    expect(r.ingredients[1].scalingRole).toBe('fixed');
    expect(r.baseAnchor).toBeNull();
  });

  it('无任何 ratio_linked → fallback', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'multi_ratio',
      ingredients: [ing('糖', 40, { scalingRole: 'percentage' })],
    });
    expect(r.severity).toBe('fallback');
  });
});

// ─── collectScalingErrors（保存时严格检查）─────────────────────────

describe('collectScalingErrors — 保存时结构校验', () => {
  it('三个合法 fixture → 无错误', () => {
    expect(
      collectScalingErrors('bakers_percentage', [
        { scalingRole: 'anchor', percentageValue: 100, amount: 500 },
        { scalingRole: 'percentage', percentageValue: 65, amount: 325 },
        { scalingRole: 'fixed', amount: 0 },
      ]),
    ).toEqual([]);
    expect(
      collectScalingErrors('ratio_based', [
        { scalingRole: 'anchor', ratioValue: 1, amount: 20 },
        { scalingRole: 'ratio_linked', ratioValue: 15, amount: 300 },
      ]),
    ).toEqual([]);
    expect(
      collectScalingErrors(
        'multi_ratio',
        [
          { scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: 1, amount: 100 },
          { scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: 4, amount: 400 },
          { scalingRole: 'percentage', percentageValue: 10, amount: 40 },
        ],
        { ingredientIndex: 1 },
      ),
    ).toEqual([]);
  });

  it('linear_legacy → 永远无错误', () => {
    expect(collectScalingErrors('linear_legacy', [{ amount: 1 }])).toEqual([]);
  });

  it('bakers：无锚 / 双锚 / percentage 缺 percentageValue → 各报错', () => {
    expect(
      collectScalingErrors('bakers_percentage', [
        { scalingRole: 'percentage', percentageValue: 65, amount: 325 },
      ]),
    ).not.toEqual([]);
    expect(
      collectScalingErrors('bakers_percentage', [
        { scalingRole: 'anchor', amount: 500 },
        { scalingRole: 'anchor', amount: 300 },
      ]),
    ).not.toEqual([]);
    expect(
      collectScalingErrors('bakers_percentage', [
        { scalingRole: 'anchor', amount: 500 },
        { scalingRole: 'percentage', amount: 325 },
      ]),
    ).not.toEqual([]);
  });

  it('ratio_based：成员缺 ratioValue / 混入 fixed → 报错', () => {
    expect(
      collectScalingErrors('ratio_based', [
        { scalingRole: 'anchor', ratioValue: 1, amount: 20 },
        { scalingRole: 'ratio_linked', amount: 300 },
      ]),
    ).not.toEqual([]);
    expect(
      collectScalingErrors('ratio_based', [
        { scalingRole: 'anchor', ratioValue: 1, amount: 20 },
        { scalingRole: 'fixed', amount: 5 },
      ]),
    ).not.toEqual([]);
  });

  it('multi_ratio：percentage 无 percentBase / percentBase 指错 / ratio_linked 缺组 → 各报错', () => {
    const ok = [
      { scalingRole: 'ratio_linked' as const, ratioGroup: 'g', ratioValue: 1, amount: 100 },
      { scalingRole: 'percentage' as const, percentageValue: 10, amount: 10 },
    ];
    expect(collectScalingErrors('multi_ratio', ok)).not.toEqual([]);
    expect(collectScalingErrors('multi_ratio', ok, { ingredientIndex: 1 })).not.toEqual([]);
    expect(collectScalingErrors('multi_ratio', ok, { ingredientIndex: 0 })).toEqual([]);
    expect(collectScalingErrors('multi_ratio', ok, { group: 'nope' })).not.toEqual([]);
    expect(
      collectScalingErrors('multi_ratio', [
        { scalingRole: 'ratio_linked', ratioValue: 1, amount: 100 },
      ]),
    ).not.toEqual([]);
  });
});

// ─── warnings 英文化（海外用户可见；国内 admin 同源同收）───────────────

describe('warnings are English (overseas user-visible)', () => {
  const CJK = /[一-鿿]/;
  const assertEnglish = (warnings: string[]) => {
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) {
      expect(w).toMatch(/^Scaling: /);
      expect(w).not.toMatch(CJK);
    }
  };

  it('bakers 无锚兜底：精确英文串钉死', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [ing('Bread flour', 500), ing('Water', 325)],
    });
    expect(r.severity).toBe('fallback');
    expect(r.warnings).toEqual([
      'Scaling: could not identify the base (anchor) ingredient — treated as a plain linear recipe',
    ]);
  });

  it('bakers 歧义角色纠偏：英文 + 含原料名 + severity adjusted', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('Bread flour', 500, { scalingRole: 'anchor' }),
        ing('Water', 325, { scalingRole: 'percentage' }),
        ing('Salt', 10), // 角色缺失 → 纠偏
      ],
    });
    expect(r.severity).toBe('adjusted');
    assertEnglish(r.warnings);
    expect(r.warnings[0]).toContain('"Salt"');
  });

  it('multi_ratio 缺 percentBase → 英文兜底', () => {
    const r = validateAndRecomputeScaling({
      scalingProfile: 'multi_ratio',
      ingredients: [
        ing('Tea', 10, { scalingRole: 'ratio_linked', ratioGroup: 'tea_base' }),
        ing('Water', 120, { scalingRole: 'ratio_linked', ratioGroup: 'tea_base' }),
        ing('Sugar', 10, { scalingRole: 'percentage' }),
      ],
    });
    expect(r.scalingProfile).toBe('linear_legacy');
    assertEnglish(r.warnings);
    expect(r.warnings[0]).toContain('percentBase');
  });

  it('无 CJK 扫盲：各降级路径的 warnings 全英文', () => {
    const cases = [
      // 未知 profile
      { scalingProfile: 'super_scaling', ingredients: [ing('Pork', 300)] },
      // bakers 多锚
      {
        scalingProfile: 'bakers_percentage',
        ingredients: [
          ing('Flour A', 300, { scalingRole: 'anchor' }),
          ing('Flour B', 200, { scalingRole: 'anchor' }),
        ],
      },
      // ratio 混入非参比角色
      {
        scalingProfile: 'ratio_based',
        ingredients: [
          ing('Coffee', 20, { scalingRole: 'anchor' }),
          ing('Ice', 50, { scalingRole: 'fixed' }),
        ],
      },
      // multi_ratio ratio_linked 缺组名
      {
        scalingProfile: 'multi_ratio',
        ingredients: [ing('Gin', 30, { scalingRole: 'ratio_linked' })],
      },
      // ratio 成员缺量且无 hint
      {
        scalingProfile: 'ratio_based',
        ingredients: [
          ing('Coffee', 0, { scalingRole: 'anchor' }),
          ing('Water', 0, { scalingRole: 'ratio_linked' }),
        ],
      },
    ];
    for (const c of cases) {
      const r = validateAndRecomputeScaling(c as Parameters<typeof validateAndRecomputeScaling>[0]);
      assertEnglish(r.warnings);
    }
  });

  it('hint 采纳路径（adjusted）也是英文：ratio / 组 / 百分比 hint', () => {
    const ratioHints = validateAndRecomputeScaling({
      scalingProfile: 'ratio_based',
      ingredients: [
        ing('Coffee', 0, { scalingRole: 'anchor', ratioHint: 1 }),
        ing('Water', 0, { scalingRole: 'ratio_linked', ratioHint: 15 }),
      ],
    });
    expect(ratioHints.severity).toBe('adjusted');
    assertEnglish(ratioHints.warnings);

    const pctHint = validateAndRecomputeScaling({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        ing('Flour', 500, { scalingRole: 'anchor' }),
        ing('Salt', 0, { scalingRole: 'percentage', percentHint: 2 }),
      ],
    });
    expect(pctHint.severity).toBe('adjusted');
    assertEnglish(pctHint.warnings);
  });

  it('回归：干净 fixture warnings 仍为空', () => {
    expect(validateAndRecomputeScaling(BREAD).warnings).toEqual([]);
    expect(validateAndRecomputeScaling(COFFEE).warnings).toEqual([]);
    expect(validateAndRecomputeScaling(MILK_TEA).warnings).toEqual([]);
    expect(validateAndRecomputeScaling(COCKTAIL).warnings).toEqual([]);
  });
});
