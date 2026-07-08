/**
 * 端到端不变量：validateAndRecomputeScaling 的输出，以数组下标为 id 组装成
 * EngineIngredient[] 后，必须能被真缩放引擎直接消费并得到已知正确的克数。
 * （这正是"AI 解析 → 进入缩放引擎可直接用"的契约测试。）
 */
import {
  EngineIngredient,
  scaleRecipe,
} from '../../common/utils/scaling-engine';
import {
  ScalingClassificationInput,
  validateAndRecomputeScaling,
} from './parse-scaling-validator';

/** 把 validator 输出组装成引擎输入（id = 数组下标，正是保存前草稿的形态） */
function toEngine(
  input: ScalingClassificationInput,
): { ings: EngineIngredient[]; percentBaseId: number | null } {
  const v = validateAndRecomputeScaling(input);
  expect(v.severity).toBe('ok'); // 集成前提：干净解析
  const ings = input.ingredients.map((raw, idx) => ({
    id: idx,
    name: raw.name,
    amount: raw.amount,
    unit: 'g',
    role: v.ingredients[idx].scalingRole ?? 'fixed',
    percentageValue: v.ingredients[idx].percentageValue,
    ratioGroup: v.ingredients[idx].ratioGroup,
    ratioValue: v.ingredients[idx].ratioValue,
  }));
  const pb = v.baseAnchor?.percentBase;
  const percentBaseId = pb && 'ingredientIndex' in pb ? pb.ingredientIndex : null;
  return { ings, percentBaseId };
}

const byId = (rs: { id: number | string; scaledAmount: number }[]) =>
  Object.fromEntries(rs.map((r) => [r.id, r.scaledAmount]));

describe('解析输出 → 真引擎（种子 fixture 已知结果）', () => {
  it('面包：锁锚点 1000g → 水 650 / 盐 20 / 酵母 10', () => {
    const { ings } = toEngine({
      scalingProfile: 'bakers_percentage',
      ingredients: [
        { name: '高筋面粉', amount: 500, scalingRole: 'anchor' },
        { name: '水', amount: 325, scalingRole: 'percentage' },
        { name: '盐', amount: 10, scalingRole: 'percentage' },
        { name: '酵母', amount: 5, scalingRole: 'percentage' },
      ],
    });
    const result = byId(
      scaleRecipe(ings, {
        profile: 'bakers_percentage',
        lock: { mode: 'anchor', value: 1000 },
      }),
    );
    expect(result[0]).toBe(1000);
    expect(result[1]).toBe(650);
    expect(result[2]).toBe(20);
    expect(result[3]).toBe(10);
  });

  it('咖啡 1:15：锁咖啡粉 30g → 水 450', () => {
    const { ings } = toEngine({
      scalingProfile: 'ratio_based',
      ingredients: [
        { name: '咖啡粉', amount: 20, scalingRole: 'anchor' },
        { name: '水', amount: 300, scalingRole: 'ratio_linked' },
      ],
    });
    const result = byId(
      scaleRecipe(ings, { profile: 'ratio_based', lock: { id: 0, value: 30 } }),
    );
    expect(result[0]).toBe(30);
    expect(result[1]).toBe(450);
  });

  it('奶茶：锁热水 800g + percentBase=热水 → 茶 200 / 糖 80', () => {
    const parsed: ScalingClassificationInput = {
      scalingProfile: 'multi_ratio',
      percentBase: { ingredientIndex: 1 },
      ingredients: [
        { name: '茶叶', amount: 100, scalingRole: 'ratio_linked', ratioGroup: 'tea_base' },
        { name: '热水', amount: 400, scalingRole: 'ratio_linked', ratioGroup: 'tea_base' },
        { name: '糖', amount: 40, scalingRole: 'percentage' },
      ],
    };
    const { ings, percentBaseId } = toEngine(parsed);
    expect(percentBaseId).toBe(1);
    const result = byId(
      scaleRecipe(ings, {
        profile: 'multi_ratio',
        spec: {
          groups: [{ group: 'tea_base', lockedId: 1, lockedValue: 800 }],
          percentBase: { id: percentBaseId as number },
        },
      }),
    );
    expect(result[0]).toBe(200); // 800 / 4 * 1
    expect(result[1]).toBe(800);
    expect(result[2]).toBe(80); // 800 * 10%
  });

  it('鸡尾酒 3:2:1：锁组总量 240ml → 120/80/40', () => {
    const { ings } = toEngine({
      scalingProfile: 'multi_ratio',
      ingredients: [
        { name: '烈酒', amount: 45, scalingRole: 'ratio_linked', ratioGroup: 'mix' },
        { name: '利口酒', amount: 30, scalingRole: 'ratio_linked', ratioGroup: 'mix' },
        { name: '果汁', amount: 15, scalingRole: 'ratio_linked', ratioGroup: 'mix' },
      ],
    });
    const result = byId(
      scaleRecipe(ings, {
        profile: 'multi_ratio',
        spec: { groups: [{ group: 'mix', total: 240 }] },
      }),
    );
    expect(result[0]).toBe(120);
    expect(result[1]).toBe(80);
    expect(result[2]).toBe(40);
  });
});
