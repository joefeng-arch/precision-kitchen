/**
 * 缩放引擎 v2 — Scaling Profiles（海外版 PRD §4.1）
 *
 * 每个配方绑定一种 Scaling Profile，决定用量如何联动：
 * - linear_legacy      : 收纳国内版 linear / sub_linear / fixed 三种 scaleType（零行为变化）
 * - bakers_percentage  : 指定基准原料 = 100%，其余按 % 联动；可锁基准量或锁总重反推
 * - ratio_based        : 核心两元比例（如咖啡 1:15），锁一端另一端联动
 * - multi_ratio        : 通用多组分比例（奶茶、鸡尾酒），多锚点各自可锁
 *
 * 外加 §4.1.5 非线性修正（step 规则）：缩放因子超阈值时该原料额外乘系数，
 * 作为所有 profile 之上的统一后处理。
 *
 * 本模块为纯函数，无 NestJS / DB 依赖。取整统一复用 scaling-calculator.roundAmount。
 */
import { ScaleType, calculateScaledAmount, roundAmount } from './scaling-calculator';

export type ScalingProfile = 'linear_legacy' | 'bakers_percentage' | 'ratio_based' | 'multi_ratio';

export type ScalingRole = 'anchor' | 'percentage' | 'ratio_linked' | 'fixed';

/** §4.1.5 非线性修正规则 */
export interface ScalingCorrection {
  type: 'step';
  rules: Array<{ above_factor: number; multiply: number }>;
}

export interface EngineIngredient {
  id: number | string;
  name?: string;
  /** 原始用量（作原始锚点 / fixed 回退 / recipeFactor 反推） */
  amount: number;
  unit: string;
  role: ScalingRole;
  /** bakers %：相对锚点的百分比；multi_ratio percentage：占参考总量的百分比 */
  percentageValue?: number | null;
  /** multi_ratio / ratio 组标记 */
  ratioGroup?: string | null;
  /** 组内 parts（tea=1, water=12；spirit=3…） */
  ratioValue?: number | null;
  correction?: ScalingCorrection | null;
  /** 仅 linear_legacy */
  scaleType?: ScaleType;
  /** 仅 linear_legacy，默认 0.7 */
  scaleFactor?: number;
  /** 可选：取整小数位（dp=0→1g, dp=1→0.1g）。缺省由 defaultRoundDp 解析；仅新 profile 生效 */
  roundDp?: number | null;
}

export interface ScaledIngredient {
  id: number | string;
  name?: string;
  unit: string;
  role: ScalingRole;
  originalAmount: number;
  scaledAmount: number;
}

export interface BakersLock {
  /** anchor: value = 锁定的基准量 F；total: value = 锁定的总重 T */
  mode: 'anchor' | 'total';
  value: number;
}

export interface RatioLock {
  /** 锁定成员的 id 及其目标量 */
  id: number | string;
  value: number;
}

export interface MultiRatioGroupLock {
  group: string;
  /** 锁定组内某成员 = lockedValue */
  lockedId?: number | string;
  lockedValue?: number;
  /** 或锁定整组总量 */
  total?: number;
}

export interface MultiRatioSpec {
  groups: MultiRatioGroupLock[];
  /**
   * percentage 原料的"总液体量"基准，由调用方显式指定，引擎不假设、不猜。
   * - { group } : 该组所有已解成员用量之和为基准
   * - { id }    : 单个已解成员用量为基准（如奶茶假设 A：茶汤 = 水量）
   * 不同饮品传不同基准，加品类无需改引擎。
   */
  percentBase?: { group: string } | { id: number | string };
}

export type ScaleSpec =
  | { profile: 'linear_legacy'; multiplier: number }
  | { profile: 'bakers_percentage'; lock: BakersLock }
  | { profile: 'ratio_based'; lock: RatioLock }
  | { profile: 'multi_ratio'; spec: MultiRatioSpec };

// ---------------------------------------------------------------------------
// 实现
// ---------------------------------------------------------------------------

/** 组装单条结果；取整函数由各 profile 传入（linear_legacy 用 roundAmount，新 profile 用 roundToDp） */
function toResult(
  ing: EngineIngredient,
  raw: number,
  round: (v: number) => number,
): ScaledIngredient {
  return {
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    role: ing.role,
    originalAmount: ing.amount,
    scaledAmount: round(raw),
  };
}

/** 按小数位取整（新 profile 用；linear_legacy 仍用国内 roundAmount 保持行为不变） */
export function roundToDp(value: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}

/**
 * 缺省取整精度：调用方未显式给 roundDp 时的 per-profile + role 默认，编码 PRD §4.1 方向。
 * 显式 EngineIngredient.roundDp 永远优先。
 * 说明：bakers 的 percentage 默认 0.1g（盐/酵母正确；水也 0.1g，比方向的 1g 更细、无害，
 * 调用方可 roundDp:0 覆盖为 1g）。ratio/multi_ratio 的角色恰好对齐方向。
 */
export function defaultRoundDp(profile: ScalingProfile, ing: EngineIngredient): number {
  switch (profile) {
    case 'bakers_percentage':
      return ing.role === 'anchor' ? 0 : 1; // 面粉 1g；盐/酵母/水 0.1g
    case 'ratio_based':
      return ing.role === 'anchor' ? 1 : 0; // 咖啡粉 0.1g；水 1g
    case 'multi_ratio':
      return ing.role === 'percentage' ? 1 : 0; // 糖/奶 0.1g；液体 1g
    case 'linear_legacy':
      return 0; // 不走此路（linear_legacy 用 roundAmount）
  }
}

/** 为某原料生成取整函数：显式 roundDp 优先，否则 defaultRoundDp 解析 */
function roundFor(profile: ScalingProfile, ing: EngineIngredient): (v: number) => number {
  const dp = ing.roundDp ?? defaultRoundDp(profile, ing);
  return (v) => roundToDp(v, dp);
}

/** 正数守卫：拒绝 0 / 负 / NaN / undefined，防止静默 NaN 传播到最终克数 */
function requirePositive(value: number | null | undefined, message: string): number {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }
  return value;
}

/**
 * §4.1.5 非线性修正：取被 recipeFactor 严格超过的最大阈值对应系数（阶梯函数，非累乘）。
 * 因子恰等于阈值不触发。无规则则原样返回。
 */
export function applyCorrection(
  rawAmount: number,
  recipeFactor: number,
  correction?: ScalingCorrection | null,
): number {
  if (!correction || correction.type !== 'step' || !correction.rules?.length) {
    return rawAmount;
  }
  let multiply = 1;
  let best = -Infinity;
  for (const rule of correction.rules) {
    if (recipeFactor > rule.above_factor && rule.above_factor > best) {
      best = rule.above_factor;
      multiply = rule.multiply;
    }
  }
  return rawAmount * multiply;
}

/** linear_legacy：逐条委托国内版 calculateScaledAmount，行为与现状一致 */
export function scaleLinearLegacy(
  ingredients: EngineIngredient[],
  multiplier: number,
): ScaledIngredient[] {
  return ingredients.map((ing) => {
    const raw = calculateScaledAmount(
      ing.amount,
      multiplier,
      ing.scaleType ?? 'linear',
      ing.scaleFactor ?? 0.7,
    );
    return toResult(ing, raw, roundAmount); // linear_legacy 行为不变
  });
}

/** baker's %：锁基准量 F 或锁总重 T 反推 F，其余按 % 联动；fixed 原料不缩放 */
export function scaleBakersPercentage(
  ingredients: EngineIngredient[],
  lock: BakersLock,
): ScaledIngredient[] {
  const anchor = ingredients.find((i) => i.role === 'anchor');
  if (!anchor) {
    throw new Error('bakers_percentage requires an ingredient with role="anchor"');
  }
  const pctOf = (i: EngineIngredient): number =>
    i.role === 'anchor' ? 100 : (i.percentageValue ?? 0);

  let F: number;
  if (lock.mode === 'anchor') {
    F = requirePositive(lock.value, 'bakers anchor lock value must be > 0');
  } else {
    const S = ingredients
      .filter((i) => i.role === 'anchor' || i.role === 'percentage')
      .reduce((sum, i) => sum + pctOf(i), 0);
    requirePositive(S, 'bakers total lock requires percentage sum > 0');
    F = (requirePositive(lock.value, 'bakers total lock value must be > 0') * 100) / S;
  }

  const originalAnchor = requirePositive(
    anchor.amount,
    'bakers anchor ingredient needs a positive original amount for correction factor',
  );
  const recipeFactor = F / originalAnchor;

  return ingredients.map((ing) => {
    const round = roundFor('bakers_percentage', ing);
    if (ing.role === 'fixed') {
      return toResult(ing, ing.amount, round);
    }
    const raw = (F * pctOf(ing)) / 100;
    return toResult(ing, applyCorrection(raw, recipeFactor, ing.correction), round);
  });
}

/** ratio_based：单一比例组，锁某成员目标量 → 各成员按 parts 联动。除零全防御 */
export function scaleRatio(ingredients: EngineIngredient[], lock: RatioLock): ScaledIngredient[] {
  const locked = ingredients.find((i) => i.id === lock.id);
  if (!locked) {
    throw new Error(`ratio lock target id=${lock.id} not found`);
  }
  const lockedRatio = requirePositive(
    locked.ratioValue,
    `ratio lock target id=${lock.id} must have ratioValue > 0`,
  );
  const unit = requirePositive(lock.value, 'ratio lock value must be > 0') / lockedRatio;

  const originalLockedUnit = locked.amount > 0 ? locked.amount / lockedRatio : unit;
  const recipeFactor = unit / originalLockedUnit;

  return ingredients.map((ing) => {
    const rv = requirePositive(
      ing.ratioValue,
      `ratio member id=${ing.id} must have ratioValue > 0`,
    );
    const raw = applyCorrection(unit * rv, recipeFactor, ing.correction);
    return toResult(ing, raw, roundFor('ratio_based', ing));
  });
}

/** multi_ratio：多 parts 组各自可锁 + percentage 原料按调用方显式指定的基准联动 */
export function scaleMultiRatio(
  ingredients: EngineIngredient[],
  spec: MultiRatioSpec,
): ScaledIngredient[] {
  const raw = new Map<number | string, number>();

  // 1. 解各 parts 组
  for (const g of spec.groups) {
    const members = ingredients.filter(
      (i) => i.role === 'ratio_linked' && i.ratioGroup === g.group,
    );
    if (members.length === 0) {
      throw new Error(`multi_ratio group "${g.group}" has no ratio_linked members`);
    }

    let unit: number;
    if (g.lockedId != null) {
      const m = members.find((i) => i.id === g.lockedId);
      if (!m) {
        throw new Error(`multi_ratio lock target id=${g.lockedId} not in group "${g.group}"`);
      }
      const mRatio = requirePositive(
        m.ratioValue,
        `multi_ratio lock target id=${g.lockedId} must have ratioValue > 0`,
      );
      unit =
        requirePositive(g.lockedValue, `multi_ratio group "${g.group}" lockedValue must be > 0`) /
        mRatio;
    } else if (g.total != null) {
      const sumParts = members.reduce((s, i) => s + (i.ratioValue ?? 0), 0);
      requirePositive(sumParts, `multi_ratio group "${g.group}" parts sum must be > 0`);
      unit =
        requirePositive(g.total, `multi_ratio group "${g.group}" total must be > 0`) / sumParts;
    } else {
      throw new Error(`multi_ratio group "${g.group}" needs lockedId+lockedValue or total`);
    }

    const originalUnitMember = members.find((i) => (i.ratioValue ?? 0) > 0 && i.amount > 0);
    const originalUnit = originalUnitMember
      ? originalUnitMember.amount / (originalUnitMember.ratioValue as number)
      : unit;
    const recipeFactor = unit / originalUnit;

    for (const m of members) {
      const rv = requirePositive(
        m.ratioValue,
        `multi_ratio member id=${m.id} in group "${g.group}" must have ratioValue > 0`,
      );
      raw.set(m.id, applyCorrection(unit * rv, recipeFactor, m.correction));
    }
  }

  // 2. percentage 基准（调用方显式指定，引擎不假设）
  const percentIngredients = ingredients.filter((i) => i.role === 'percentage');
  if (percentIngredients.length > 0) {
    if (!spec.percentBase) {
      throw new Error('multi_ratio has percentage ingredients but no percentBase specified');
    }
    let base: number;
    if ('id' in spec.percentBase) {
      const b = raw.get(spec.percentBase.id);
      if (b == null) {
        throw new Error(`multi_ratio percentBase id=${spec.percentBase.id} not resolved`);
      }
      base = b;
    } else {
      const groupName = spec.percentBase.group;
      const members = ingredients.filter(
        (i) => i.role === 'ratio_linked' && i.ratioGroup === groupName,
      );
      if (members.length === 0) {
        throw new Error(`multi_ratio percentBase group "${groupName}" has no resolved members`);
      }
      base = members.reduce((s, i) => s + (raw.get(i.id) ?? 0), 0);
    }
    for (const ing of percentIngredients) {
      raw.set(ing.id, (base * (ing.percentageValue ?? 0)) / 100);
    }
  }

  // 3. 组装；未被任何组/百分比覆盖的原料回退原量
  return ingredients.map((ing) =>
    toResult(
      ing,
      raw.has(ing.id) ? (raw.get(ing.id) as number) : ing.amount,
      roundFor('multi_ratio', ing),
    ),
  );
}

/** 分发器：按 profile 路由到对应算法 */
export function scaleRecipe(ingredients: EngineIngredient[], spec: ScaleSpec): ScaledIngredient[] {
  switch (spec.profile) {
    case 'linear_legacy':
      return scaleLinearLegacy(ingredients, spec.multiplier);
    case 'bakers_percentage':
      return scaleBakersPercentage(ingredients, spec.lock);
    case 'ratio_based':
      return scaleRatio(ingredients, spec.lock);
    case 'multi_ratio':
      return scaleMultiRatio(ingredients, spec.spec);
  }
}
