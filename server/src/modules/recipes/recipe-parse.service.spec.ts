import { BadRequestException, HttpException } from '@nestjs/common';
import { RecipeParseService } from './recipe-parse.service';

/** 覆写网络调用隔离点：返回 canned JSON（照 auth 模块 TestableGoogleAuthProvider 模式） */
class TestableRecipeParseService extends RecipeParseService {
  public canned: unknown;
  protected async callAI(): Promise<unknown> {
    return this.canned;
  }
}

class ThrowingRecipeParseService extends RecipeParseService {
  protected async callAI(): Promise<unknown> {
    throw new Error('upstream 500');
  }
}

/** 手写 cache 假件：内存 map，支持限流计数断言 */
function fakeCache() {
  const store = new Map<string, number>();
  return {
    store,
    cache: {
      get: async (k: string) => store.get(k),
      set: async (k: string, v: number) => {
        store.set(k, v);
      },
    } as any,
  };
}

function makeService(canned: unknown) {
  const { store, cache } = fakeCache();
  const svc = new TestableRecipeParseService(cache);
  svc.canned = canned;
  return { svc, store };
}

const STEPS = [{ stepNumber: 1, description: '混合所有原料并揉至光滑' }];

beforeAll(() => {
  process.env.AI_API_KEY = 'test-key-for-spec';
});
afterAll(() => {
  delete process.env.AI_API_KEY;
});

describe('RecipeParseService — 缩放字段解析', () => {
  it('面包：AI 给了错误百分比也没用，服务端从 amount 重算（65 而非 AI 的 50）', async () => {
    const { svc } = makeService({
      title: '乡村面包',
      description: '经典直接法',
      totalMinutes: 180,
      baseServings: 2,
      difficulty: 'medium',
      scalingProfile: 'bakers_percentage',
      percentBase: null,
      ingredients: [
        { name: '高筋面粉', amount: 500, unit: 'g', scalingRole: 'anchor', percentageValue: 90 },
        { name: '水', amount: 325, unit: 'g', scalingRole: 'percentage', percentageValue: 50 },
        { name: '盐', amount: 10, unit: 'g', scalingRole: 'percentage' },
      ],
      steps: STEPS,
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.scalingProfile).toBe('bakers_percentage');
    expect(res.recipe.ingredients[0].scalingRole).toBe('anchor');
    expect(res.recipe.ingredients[0].percentageValue).toBe(100);
    expect(res.recipe.ingredients[1].percentageValue).toBe(65); // 325/500，不是 AI 的 50
    expect(res.recipe.ingredients[2].percentageValue).toBe(2);
    expect(res.warnings).toEqual([]);
    expect(res.confidence).toBe('high');
  });

  it('奶茶：baseAnchor 透出 percentBase 下标；比例重算为 1:4', async () => {
    const { svc } = makeService({
      title: '珍珠奶茶',
      description: '基础配方',
      totalMinutes: 20,
      scalingProfile: 'multi_ratio',
      percentBase: { ingredientIndex: 1 },
      ingredients: [
        {
          name: '茶叶',
          amount: 100,
          unit: 'g',
          scalingRole: 'ratio_linked',
          ratioGroup: 'tea_base',
        },
        {
          name: '热水',
          amount: 400,
          unit: 'g',
          scalingRole: 'ratio_linked',
          ratioGroup: 'tea_base',
        },
        { name: '糖', amount: 40, unit: 'g', scalingRole: 'percentage' },
      ],
      steps: STEPS,
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.baseAnchor).toEqual({ percentBase: { ingredientIndex: 1 } });
    expect(res.recipe.ingredients.map((i) => i.ratioValue)).toEqual([1, 4, null]);
    expect(res.recipe.ingredients[2].percentageValue).toBe(10);
  });

  it('分类残破（bakers 无锚点）→ 降级 linear_legacy + warnings + confidence low + 字段全 null', async () => {
    const { svc } = makeService({
      title: '假面包',
      description: 'x',
      totalMinutes: 60,
      scalingProfile: 'bakers_percentage',
      ingredients: [
        { name: '面粉', amount: 500, unit: 'g', scalingRole: 'percentage' },
        { name: '水', amount: 325, unit: 'g', scalingRole: 'percentage' },
      ],
      steps: STEPS,
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.scalingProfile).toBe('linear_legacy');
    expect(res.recipe.baseAnchor).toBeNull();
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.confidence).toBe('low');
    for (const i of res.recipe.ingredients) {
      expect(i.scalingRole).toBeNull();
      expect(i.percentageValue).toBeNull();
      expect(i.ratioGroup).toBeNull();
      expect(i.ratioValue).toBeNull();
    }
  });

  it('有纠偏（adjusted）→ confidence 封顶 medium', async () => {
    const { svc } = makeService({
      title: '乡村面包',
      description: '本应 high 的完整解析',
      totalMinutes: 180,
      scalingProfile: 'bakers_percentage',
      ingredients: [
        { name: '面粉', amount: 500, unit: 'g', scalingRole: 'anchor' },
        { name: '水', amount: 325, unit: 'g' }, // 角色缺失 → 纠偏 percentage
      ],
      steps: STEPS,
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.scalingProfile).toBe('bakers_percentage');
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.confidence).toBe('medium');
  });

  it('家常菜（AI 未给任何缩放字段）→ legacy 形状不变 + linear_legacy + 空 warnings', async () => {
    const { svc } = makeService({
      title: '炒肉沫',
      description: '家常快手',
      totalMinutes: 15,
      baseServings: 2,
      difficulty: 'easy',
      ingredients: [
        { name: '猪肉沫', amount: 300, unit: 'g', groupName: '主料', scaleType: 'linear' },
        { name: '盐', amount: 3, unit: 'g', groupName: '调料', scaleType: 'sub_linear' },
      ],
      steps: STEPS,
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.parsed).toBe(true);
    expect(res.confidence).toBe('high');
    expect(res.warnings).toEqual([]);
    expect(res.recipe.scalingProfile).toBe('linear_legacy');
    expect(res.recipe.baseAnchor).toBeNull();
    // legacy 字段原样保留
    expect(res.recipe.ingredients[0].scaleType).toBe('linear');
    expect(res.recipe.ingredients[1].scaleType).toBe('sub_linear');
    expect(res.recipe.ingredients[0].groupName).toBe('主料');
  });

  it('既有纠偏不回归：amount 非法 → 0 + 单位改适量', async () => {
    const { svc } = makeService({
      title: '测试',
      ingredients: [{ name: '葱', amount: 'abc', unit: 'g' }],
      steps: STEPS,
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.ingredients[0].amount).toBe(0);
    expect(res.recipe.ingredients[0].unit).toBe('适量');
  });

  it('callAI 抛错 → 400 文案不变', async () => {
    const { cache } = fakeCache();
    const svc = new ThrowingRecipeParseService(cache);
    await expect(svc.parseText('u1', 'x'.repeat(30))).rejects.toThrow(
      'AI 解析服务暂时不可用，请稍后再试',
    );
  });

  it('缺 title → 400 解析结果不完整', async () => {
    const { svc } = makeService({ ingredients: [{ name: 'x', amount: 1 }], steps: STEPS });
    await expect(svc.parseText('u1', 'x'.repeat(30))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('限流：达到 5 次 → 429；skipRateLimit 跳过', async () => {
    const { svc, store } = makeService({
      title: 't',
      ingredients: [{ name: 'x', amount: 1, unit: 'g' }],
      steps: STEPS,
    });
    store.set('recipe_parse_rate:u1', 5);
    await expect(svc.parseText('u1', 'x'.repeat(30))).rejects.toBeInstanceOf(HttpException);
    await expect(
      svc.parseText('u1', 'x'.repeat(30), { skipRateLimit: true }),
    ).resolves.toMatchObject({ parsed: true });
  });
});

describe('RecipeParseService — 步骤 warning 提取', () => {
  const BASE = {
    title: '乡村面包',
    description: '直接法',
    totalMinutes: 180,
    ingredients: [{ name: '面粉', amount: 500, unit: 'g' }],
  };

  it('canned 带 warning → 原样透出，不影响 confidence', async () => {
    const { svc } = makeService({
      ...BASE,
      steps: [
        { stepNumber: 1, description: '烤箱 200 度烘烤 35 分钟', warning: '前 25 分钟别开烤箱门' },
        { stepNumber: 2, description: '出炉放凉一小时再切片', warning: null },
      ],
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.steps[0].warning).toBe('前 25 分钟别开烤箱门');
    expect(res.recipe.steps[1].warning).toBeNull();
    expect(res.confidence).toBe('high');
  });

  it('旧 canned 形状（无 warning 键）→ null（向后兼容）', async () => {
    const { svc } = makeService({ ...BASE, steps: STEPS });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.steps[0].warning).toBeNull();
  });

  it('warning 空串/全空白 → null', async () => {
    const { svc } = makeService({
      ...BASE,
      steps: [{ stepNumber: 1, description: '烘烤', warning: '   ' }],
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.steps[0].warning).toBeNull();
  });

  it('超长 warning → 截断 256 字符', async () => {
    const { svc } = makeService({
      ...BASE,
      steps: [{ stepNumber: 1, description: '烘烤', warning: 'x'.repeat(300) }],
    });
    const res = await svc.parseText('u1', 'x'.repeat(30));
    expect(res.recipe.steps[0].warning).toHaveLength(256);
  });
});
