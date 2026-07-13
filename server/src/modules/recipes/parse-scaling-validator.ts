/**
 * AI 解析 → 缩放字段的服务端重算与校验（纯函数，无 NestJS / DB 依赖）
 *
 * 设计铁律：AI 只做分类（profile / 角色 / 分组 / percentBase 指向），
 * 百分比与比例一律由服务端从 amount 确定性重算——AI 算术不可信。
 * 仅当 amount 缺失（文本只给了"1:15"没给克数）时才采用 AI 的 hint 数值，且降置信度。
 *
 * 校验失败不抛错：降级 linear_legacy + warnings（用户确认页可见），
 * 脏缩放数据永远进不了库。每条规则镜像 scaling-engine 的守卫条件。
 */
import { ScalingProfile, ScalingRole, roundToDp } from '../../common/utils/scaling-engine';

const PROFILES: readonly ScalingProfile[] = [
  'linear_legacy',
  'bakers_percentage',
  'ratio_based',
  'multi_ratio',
];
const ROLES: readonly ScalingRole[] = ['anchor', 'percentage', 'ratio_linked', 'fixed'];

// 对齐实体列精度：percentageValue decimal(7,3)、ratioValue decimal(10,3)
const MAX_PERCENTAGE = 9999.999;
const MAX_RATIO = 9999999.999;

export interface ScalingClassificationIngredient {
  name: string;
  /** 已过既有纠偏的用量（>=0；0 = 适量/未知） */
  amount: number;
  scalingRole?: unknown;
  ratioGroup?: unknown;
  /** AI 仅在文本给了比例但没给用量时填 */
  ratioHint?: unknown;
  /** AI 仅在文本给了百分比但没给用量时填 */
  percentHint?: unknown;
}

export interface ScalingClassificationInput {
  scalingProfile: unknown;
  /** {ingredientIndex} | {group}，仅 multi_ratio 有 percentage 料时需要 */
  percentBase?: unknown;
  ingredients: ScalingClassificationIngredient[];
}

export interface ValidatedIngredientScaling {
  scalingRole: ScalingRole | null;
  percentageValue: number | null;
  ratioGroup: string | null;
  ratioValue: number | null;
}

export type ParsedPercentBase = { ingredientIndex: number } | { group: string };

export interface ValidatedScalingResult {
  scalingProfile: ScalingProfile;
  baseAnchor: { percentBase: ParsedPercentBase } | null;
  /** 与输入同长同序 */
  ingredients: ValidatedIngredientScaling[];
  warnings: string[];
  severity: 'ok' | 'adjusted' | 'fallback';
}

// ─── 小工具 ──────────────────────────────────────────────────────

function positiveOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function roleOf(v: unknown): ScalingRole | null {
  return ROLES.includes(v as ScalingRole) ? (v as ScalingRole) : null;
}

function groupOf(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const g = v.trim();
  return g.length > 0 && g.length <= 32 ? g : null;
}

function nullScaling(count: number): ValidatedIngredientScaling[] {
  return Array.from({ length: count }, () => ({
    scalingRole: null,
    percentageValue: null,
    ratioGroup: null,
    ratioValue: null,
  }));
}

function fallback(count: number, warnings: string[]): ValidatedScalingResult {
  return {
    scalingProfile: 'linear_legacy',
    baseAnchor: null,
    ingredients: nullScaling(count),
    warnings,
    severity: 'fallback',
  };
}

// ─── 主入口：解析时重算 + 校验 ─────────────────────────────────────

export function validateAndRecomputeScaling(
  input: ScalingClassificationInput,
): ValidatedScalingResult {
  const n = input.ingredients.length;
  const profile = input.scalingProfile;

  if (profile == null || profile === 'linear_legacy') {
    return {
      scalingProfile: 'linear_legacy',
      baseAnchor: null,
      ingredients: nullScaling(n),
      warnings: [],
      severity: 'ok',
    };
  }
  if (!PROFILES.includes(profile as ScalingProfile)) {
    return fallback(n, [
      `Scaling: unknown scaling profile "${String(profile)}" — treated as a plain linear recipe`,
    ]);
  }

  switch (profile as ScalingProfile) {
    case 'bakers_percentage':
      return validateBakers(input);
    case 'ratio_based':
      return validateRatio(input);
    case 'multi_ratio':
      return validateMultiRatio(input);
    default:
      return fallback(n, []);
  }
}

// ─── bakers_percentage ──────────────────────────────────────────
// 引擎守卫镜像：恰一 anchor（engine:199-201）；anchor.amount>0（:217-220）；
// percentage 值>0（值为 0 会静默缩放到 0，解析侧禁止）。

function validateBakers(input: ScalingClassificationInput): ValidatedScalingResult {
  const ings = input.ingredients;
  const warnings: string[] = [];
  let adjusted = false;

  const roles = ings.map((i) => roleOf(i.scalingRole));
  const anchorIdxs = roles.flatMap((r, idx) => (r === 'anchor' ? [idx] : []));
  if (anchorIdxs.length === 0) {
    return fallback(ings.length, [
      'Scaling: could not identify the base (anchor) ingredient — treated as a plain linear recipe',
    ]);
  }
  if (anchorIdxs.length > 1) {
    return fallback(ings.length, [
      'Scaling: multiple anchor ingredients found (exactly one is required) — treated as a plain linear recipe',
    ]);
  }
  const anchorIdx = anchorIdxs[0];
  const anchorAmount = ings[anchorIdx].amount;
  if (!(anchorAmount > 0)) {
    return fallback(ings.length, [
      `Scaling: anchor ingredient "${ings[anchorIdx].name}" has no amount, percentages cannot be computed — treated as a plain linear recipe`,
    ]);
  }

  const out = nullScaling(ings.length);
  out[anchorIdx] = {
    scalingRole: 'anchor',
    percentageValue: 100,
    ratioGroup: null,
    ratioValue: null,
  };

  for (let i = 0; i < ings.length; i++) {
    if (i === anchorIdx) continue;
    const ing = ings[i];
    let role = roles[i];

    // 烘焙模式下 ratio_linked / 缺失角色都不合法 → 按 amount 纠偏
    if (role !== 'percentage' && role !== 'fixed') {
      role = ing.amount > 0 ? 'percentage' : 'fixed';
      warnings.push(
        `Scaling: ingredient "${ing.name}" has an ambiguous role — treated as ${role === 'percentage' ? 'percentage-linked' : 'a fixed amount'}`,
      );
      adjusted = true;
    }

    if (role === 'fixed') {
      out[i] = { scalingRole: 'fixed', percentageValue: null, ratioGroup: null, ratioValue: null };
      continue;
    }

    // percentage：优先从 amount 重算；amount 缺失时看 percentHint；都没有 → 纠偏 fixed
    let pct: number | null = null;
    if (ing.amount > 0) {
      pct = roundToDp((ing.amount / anchorAmount) * 100, 3);
    } else {
      const hint = positiveOrNull(ing.percentHint);
      if (hint != null) {
        pct = roundToDp(hint, 3);
        warnings.push(
          `Scaling: ingredient "${ing.name}" has no amount — using the percentage from the text (${pct}%)`,
        );
        adjusted = true;
      } else {
        out[i] = {
          scalingRole: 'fixed',
          percentageValue: null,
          ratioGroup: null,
          ratioValue: null,
        };
        warnings.push(
          `Scaling: ingredient "${ing.name}" has no amount and no percentage info — treated as a fixed amount`,
        );
        adjusted = true;
        continue;
      }
    }
    if (pct == null || pct <= 0 || pct > MAX_PERCENTAGE) {
      return fallback(ings.length, [
        `Scaling: ingredient "${ing.name}" has a percentage outside the reasonable range, the classification may be wrong — treated as a plain linear recipe`,
      ]);
    }
    out[i] = {
      scalingRole: 'percentage',
      percentageValue: pct,
      ratioGroup: null,
      ratioValue: null,
    };
  }

  return {
    scalingProfile: 'bakers_percentage',
    baseAnchor: null,
    ingredients: out,
    warnings,
    severity: adjusted ? 'adjusted' : 'ok',
  };
}

// ─── ratio_based ────────────────────────────────────────────────
// 引擎对**全部**原料 requirePositive(ratioValue)（engine:249-251），没有 fixed 透传——
// 任何比例外原料都会让引擎抛错，解析侧必须整体降级。

function validateRatio(input: ScalingClassificationInput): ValidatedScalingResult {
  const ings = input.ingredients;
  const warnings: string[] = [];
  let adjusted = false;

  const roles = ings.map((i) => roleOf(i.scalingRole));
  if (roles.some((r) => r !== 'anchor' && r !== 'ratio_linked')) {
    return fallback(ings.length, [
      'Scaling: a ratio recipe contains ingredients outside the ratio (the engine requires all ingredients to participate) — treated as a plain linear recipe',
    ]);
  }
  const anchorIdxs = roles.flatMap((r, idx) => (r === 'anchor' ? [idx] : []));
  if (anchorIdxs.length !== 1) {
    return fallback(ings.length, [
      'Scaling: a ratio recipe needs exactly one base (anchor) side — treated as a plain linear recipe',
    ]);
  }
  const anchorIdx = anchorIdxs[0];

  const allHaveAmount = ings.every((i) => i.amount > 0);
  let ratios: number[];

  if (allHaveAmount) {
    const anchorAmount = ings[anchorIdx].amount;
    ratios = ings.map((i) => roundToDp(i.amount / anchorAmount, 3));
  } else {
    const hints = ings.map((i) => positiveOrNull(i.ratioHint));
    if (hints.some((h) => h == null)) {
      return fallback(ings.length, [
        'Scaling: ratio members lack amounts and ratio hints, the ratio cannot be computed — treated as a plain linear recipe',
      ]);
    }
    const anchorHint = hints[anchorIdx] as number;
    ratios = (hints as number[]).map((h) => roundToDp(h / anchorHint, 3));
    warnings.push('Scaling: some ingredients have no amount — ratio taken from the text');
    adjusted = true;
  }

  if (ratios.some((r) => !(r > 0) || r > MAX_RATIO)) {
    return fallback(ings.length, [
      'Scaling: the computed ratio is outside the reasonable range, the classification may be wrong — treated as a plain linear recipe',
    ]);
  }

  return {
    scalingProfile: 'ratio_based',
    baseAnchor: null,
    ingredients: ings.map((_, i) => ({
      scalingRole: roles[i],
      percentageValue: null,
      ratioGroup: null,
      ratioValue: ratios[i],
    })),
    warnings,
    severity: adjusted ? 'adjusted' : 'ok',
  };
}

// ─── multi_ratio ────────────────────────────────────────────────
// 引擎守卫镜像：组员 ratioValue>0（engine:303-306）；有 percentage 料必须给
// percentBase 且可解析（:313-322）；未分类/fixed 原料按原量透传（:339-346）→ 纠偏 fixed 安全。

function validateMultiRatio(input: ScalingClassificationInput): ValidatedScalingResult {
  const ings = input.ingredients;
  const warnings: string[] = [];
  let adjusted = false;

  const out = nullScaling(ings.length);
  const groupMembers = new Map<string, number[]>(); // group → indices
  const percentIdxs: number[] = [];

  for (let i = 0; i < ings.length; i++) {
    const ing = ings[i];
    let role = roleOf(ing.scalingRole);

    if (role === 'anchor' || role === null) {
      role = 'fixed';
      warnings.push(
        `Scaling: ingredient "${ing.name}" does not participate in any ratio group — treated as a fixed amount`,
      );
      adjusted = true;
    }

    if (role === 'ratio_linked') {
      const group = groupOf(ing.ratioGroup);
      if (!group) {
        return fallback(ings.length, [
          `Scaling: ratio ingredient "${ing.name}" is missing its group name (ratioGroup) — treated as a plain linear recipe`,
        ]);
      }
      out[i] = {
        scalingRole: 'ratio_linked',
        percentageValue: null,
        ratioGroup: group,
        ratioValue: null,
      };
      const list = groupMembers.get(group) ?? [];
      list.push(i);
      groupMembers.set(group, list);
    } else if (role === 'percentage') {
      percentIdxs.push(i);
      out[i] = {
        scalingRole: 'percentage',
        percentageValue: null,
        ratioGroup: null,
        ratioValue: null,
      };
    } else {
      out[i] = { scalingRole: 'fixed', percentageValue: null, ratioGroup: null, ratioValue: null };
    }
  }

  if (groupMembers.size === 0) {
    return fallback(ings.length, [
      'Scaling: no ratio-group members identified in a multi-ratio recipe — treated as a plain linear recipe',
    ]);
  }

  // 逐组重算 parts（组内最小成员 = 1）
  for (const [group, idxs] of groupMembers) {
    const amounts = idxs.map((i) => ings[i].amount);
    if (amounts.every((a) => a > 0)) {
      const min = Math.min(...amounts);
      for (const i of idxs) {
        out[i].ratioValue = roundToDp(ings[i].amount / min, 3);
      }
    } else {
      const hints = idxs.map((i) => positiveOrNull(ings[i].ratioHint));
      if (hints.some((h) => h == null)) {
        return fallback(ings.length, [
          `Scaling: ratio group "${group}" has members without amounts or ratio hints — treated as a plain linear recipe`,
        ]);
      }
      const minHint = Math.min(...(hints as number[]));
      idxs.forEach((ingIdx, k) => {
        out[ingIdx].ratioValue = roundToDp((hints[k] as number) / minHint, 3);
      });
      warnings.push(
        `Scaling: ratio group "${group}" has members without amounts — ratio taken from the text`,
      );
      adjusted = true;
    }
    if (
      idxs.some(
        (i) => !((out[i].ratioValue as number) > 0) || (out[i].ratioValue as number) > MAX_RATIO,
      )
    ) {
      return fallback(ings.length, [
        `Scaling: ratio group "${group}" computed a ratio outside the reasonable range — treated as a plain linear recipe`,
      ]);
    }
  }

  // percentage 料：先解析 percentBase 基准，再逐个重算
  let baseAnchor: { percentBase: ParsedPercentBase } | null = null;
  if (percentIdxs.length > 0) {
    const resolved = resolvePercentBase(input.percentBase, ings, out);
    if ('error' in resolved) {
      return fallback(ings.length, [resolved.error]);
    }
    const { percentBase, baseAmount } = resolved;

    let remaining = 0;
    for (const i of percentIdxs) {
      const ing = ings[i];
      let pct: number | null = null;
      if (ing.amount > 0) {
        pct = roundToDp((ing.amount / baseAmount) * 100, 3);
      } else {
        const hint = positiveOrNull(ing.percentHint);
        if (hint != null) {
          pct = roundToDp(hint, 3);
          warnings.push(
            `Scaling: ingredient "${ing.name}" has no amount — using the percentage from the text (${pct}%)`,
          );
          adjusted = true;
        } else {
          out[i] = {
            scalingRole: 'fixed',
            percentageValue: null,
            ratioGroup: null,
            ratioValue: null,
          };
          warnings.push(
            `Scaling: ingredient "${ing.name}" has no amount and no percentage info — treated as a fixed amount`,
          );
          adjusted = true;
          continue;
        }
      }
      if (pct == null || pct <= 0 || pct > MAX_PERCENTAGE) {
        return fallback(ings.length, [
          `Scaling: ingredient "${ing.name}" has a percentage outside the reasonable range — treated as a plain linear recipe`,
        ]);
      }
      out[i].percentageValue = pct;
      remaining++;
    }
    // percentage 全被纠偏成 fixed 时基准不再需要
    baseAnchor = remaining > 0 ? { percentBase } : null;
  }

  return {
    scalingProfile: 'multi_ratio',
    baseAnchor,
    ingredients: out,
    warnings,
    severity: adjusted ? 'adjusted' : 'ok',
  };
}

function resolvePercentBase(
  raw: unknown,
  ings: ScalingClassificationIngredient[],
  out: ValidatedIngredientScaling[],
): { percentBase: ParsedPercentBase; baseAmount: number } | { error: string } {
  const pb = raw as { ingredientIndex?: unknown; group?: unknown } | null | undefined;
  const NO_BASE =
    'Scaling: percentage-dosed ingredients exist but no base reference (percentBase) was given — treated as a plain linear recipe';

  if (pb == null || typeof pb !== 'object') return { error: NO_BASE };

  if (pb.ingredientIndex != null) {
    const idx = Number(pb.ingredientIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= ings.length) {
      return {
        error:
          'Scaling: the percentage base points at an invalid ingredient index — treated as a plain linear recipe',
      };
    }
    if (out[idx].scalingRole !== 'ratio_linked' || !(ings[idx].amount > 0)) {
      return {
        error: `Scaling: the percentage base must point at a ratio-group member with an amount (currently "${ings[idx].name}") — treated as a plain linear recipe`,
      };
    }
    return { percentBase: { ingredientIndex: idx }, baseAmount: ings[idx].amount };
  }

  const group = groupOf(pb.group);
  if (group) {
    const memberIdxs = out.flatMap((o, i) =>
      o.scalingRole === 'ratio_linked' && o.ratioGroup === group ? [i] : [],
    );
    if (memberIdxs.length === 0) {
      return {
        error: `Scaling: the percentage base points at a ratio group "${group}" that does not exist — treated as a plain linear recipe`,
      };
    }
    if (memberIdxs.some((i) => !(ings[i].amount > 0))) {
      return {
        error: `Scaling: members of the percentage base group "${group}" lack amounts, the base cannot be computed — treated as a plain linear recipe`,
      };
    }
    const baseAmount = memberIdxs.reduce((s, i) => s + ings[i].amount, 0);
    return { percentBase: { group }, baseAmount };
  }

  return { error: NO_BASE };
}

// ─── 保存时严格校验（不重算——作者可有意调整数值）────────────────────

export interface SavedScalingIngredient {
  scalingRole?: string | null;
  percentageValue?: number | null;
  ratioGroup?: string | null;
  ratioValue?: number | null;
  amount: number;
}

export function collectScalingErrors(
  profile: ScalingProfile,
  ingredients: SavedScalingIngredient[],
  percentBase?: { ingredientIndex?: number; group?: string } | null,
): string[] {
  if (profile === 'linear_legacy') return [];
  const errors: string[] = [];
  const role = (i: SavedScalingIngredient): string | null =>
    ROLES.includes(i.scalingRole as ScalingRole) ? (i.scalingRole as string) : null;

  if (profile === 'bakers_percentage') {
    const anchors = ingredients.filter((i) => role(i) === 'anchor');
    if (anchors.length !== 1) {
      errors.push('bakers_percentage requires exactly one anchor ingredient');
    } else if (!(anchors[0].amount > 0)) {
      errors.push('the anchor ingredient must have an amount > 0');
    }
    for (const i of ingredients) {
      const r = role(i);
      if (r === null) {
        errors.push('every ingredient needs a scalingRole under bakers_percentage (anchor/percentage/fixed)');
      } else if (r === 'ratio_linked') {
        errors.push('bakers_percentage does not support the ratio_linked role');
      } else if (r === 'percentage' && !(Number(i.percentageValue) > 0)) {
        errors.push('percentage ingredients need a percentageValue > 0');
      }
    }
  }

  if (profile === 'ratio_based') {
    const anchors = ingredients.filter((i) => role(i) === 'anchor');
    if (anchors.length !== 1) {
      errors.push('ratio_based requires exactly one anchor ingredient');
    }
    for (const i of ingredients) {
      const r = role(i);
      if (r !== 'anchor' && r !== 'ratio_linked') {
        errors.push('ratio_based requires every ingredient to join the ratio (anchor/ratio_linked)');
      } else if (!(Number(i.ratioValue) > 0)) {
        errors.push('ratio members need a ratioValue > 0');
      }
    }
  }

  if (profile === 'multi_ratio') {
    const linkedIdx: number[] = [];
    ingredients.forEach((i, idx) => {
      const r = role(i);
      if (r === 'anchor' || r === null) {
        errors.push('roles under multi_ratio must be ratio_linked/percentage/fixed');
        return;
      }
      if (r === 'ratio_linked') {
        linkedIdx.push(idx);
        if (!i.ratioGroup || String(i.ratioGroup).trim() === '') {
          errors.push('ratio_linked ingredients need a ratioGroup');
        }
        if (!(Number(i.ratioValue) > 0)) {
          errors.push('ratio_linked ingredients need a ratioValue > 0');
        }
      }
      if (r === 'percentage' && !(Number(i.percentageValue) > 0)) {
        errors.push('percentage ingredients need a percentageValue > 0');
      }
    });
    if (linkedIdx.length === 0) {
      errors.push('multi_ratio needs at least one ratio_linked ingredient');
    }

    const percentCount = ingredients.filter((i) => role(i) === 'percentage').length;
    if (percentCount > 0) {
      const pb = percentBase;
      if (!pb || (pb.ingredientIndex == null && !pb.group)) {
        errors.push('baseAnchor.percentBase is required when percentage ingredients exist');
      } else if (pb.ingredientIndex != null) {
        const idx = pb.ingredientIndex;
        if (
          !Number.isInteger(idx) ||
          idx < 0 ||
          idx >= ingredients.length ||
          role(ingredients[idx]) !== 'ratio_linked'
        ) {
          errors.push('percentBase.ingredientIndex must point at a ratio_linked ingredient');
        }
      } else if (pb.group) {
        const exists = ingredients.some(
          (i) => role(i) === 'ratio_linked' && i.ratioGroup === pb.group,
        );
        if (!exists) {
          errors.push(`percentBase.group "${pb.group}" has no matching ratio group`);
        }
      }
    }
  }

  return [...new Set(errors)];
}
