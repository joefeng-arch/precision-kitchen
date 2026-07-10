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

describe('RecipeParseService — 月度配额（FREE 5 / PRO 30）', () => {
  const { parseQuotaKey } = jest.requireActual('../../common/constants/tier-limits');
  const OK_CANNED = {
    title: '面包',
    description: 'x',
    totalMinutes: 60,
    ingredients: [{ name: '面粉', amount: 500, unit: 'g' }],
    steps: STEPS,
  };

  it('FREE 已用满 5 次 → 403（ForbiddenException，非 429）并带升级提示', async () => {
    const { svc, store } = makeService(OK_CANNED);
    store.set(parseQuotaKey('u1'), 5);
    await expect(svc.parseText('u1', 'x'.repeat(30))).rejects.toMatchObject({
      status: 403,
    });
    await expect(svc.parseText('u1', 'x'.repeat(30), { tier: 'user' })).rejects.toThrow(/PRO/);
  });

  it('FREE 第 5 次成功且月度键计到 5', async () => {
    const { svc, store } = makeService(OK_CANNED);
    store.set(parseQuotaKey('u1'), 4);
    await svc.parseText('u1', 'x'.repeat(30), { tier: 'user' });
    expect(store.get(parseQuotaKey('u1'))).toBe(5);
  });

  it('VIP：29 次后放行，满 30 → 403 合理使用文案', async () => {
    const { svc, store } = makeService(OK_CANNED);
    store.set(parseQuotaKey('u1'), 29);
    await expect(svc.parseText('u1', 'x'.repeat(30), { tier: 'vip' })).resolves.toMatchObject({
      parsed: true,
    });
    expect(store.get(parseQuotaKey('u1'))).toBe(30);
    await expect(svc.parseText('u1', 'x'.repeat(30), { tier: 'vip' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('tier 缺省 → 按 user 限额（fail-closed）', async () => {
    const { svc, store } = makeService(OK_CANNED);
    store.set(parseQuotaKey('u1'), 5);
    await expect(svc.parseText('u1', 'x'.repeat(30))).rejects.toMatchObject({ status: 403 });
  });

  it('skipRateLimit（admin）→ 月度配额既不检查也不计数', async () => {
    const { svc, store } = makeService(OK_CANNED);
    store.set(parseQuotaKey('admin'), 999);
    await expect(
      svc.parseText('admin', 'x'.repeat(30), { skipRateLimit: true }),
    ).resolves.toMatchObject({ parsed: true });
    expect(store.get(parseQuotaKey('admin'))).toBe(999);
  });

  it('先计数后调 AI：AI 失败也消耗 1 次（防并发竞态烧钱）', async () => {
    const { store, cache } = fakeCache();
    const throwing = new ThrowingRecipeParseService(cache);
    await expect(throwing.parseText('u1', 'x'.repeat(30), { tier: 'user' })).rejects.toThrow(
      'AI 解析服务暂时不可用，请稍后再试',
    );
    // AI 调用失败，但月度配额已在调用前 +1
    expect(store.get(parseQuotaKey('u1'))).toBe(1);
  });

  it('分钟限流优先级不回归：分钟计数满 5 → 仍 429', async () => {
    const { svc, store } = makeService(OK_CANNED);
    store.set('recipe_parse_rate:u1', 5);
    await expect(svc.parseText('u1', 'x'.repeat(30), { tier: 'vip' })).rejects.toMatchObject({
      status: 429,
    });
  });
});

// ─── 英文输入（海外主流程）：语言感知兜底 + 三 profile 分类 ─────────────

describe('RecipeParseService — English input', () => {
  const EN_TEXT = 'Mix bread flour and water, knead, proof, bake at 450F until golden brown.';

  it('英文 bakers canned → 分类 + 服务端重算（68/2/1.4），warnings 空', async () => {
    const { svc } = makeService({
      title: 'Basic White Loaf',
      description: 'Classic sandwich bread',
      totalMinutes: 180,
      baseServings: 1,
      difficulty: 'medium',
      scalingProfile: 'bakers_percentage',
      percentBase: null,
      ingredients: [
        { name: 'Bread flour', amount: 500, unit: 'g', scalingRole: 'anchor' },
        { name: 'Water', amount: 340, unit: 'g', scalingRole: 'percentage' },
        { name: 'Salt', amount: 10, unit: 'g', scalingRole: 'percentage' },
        { name: 'Instant yeast', amount: 7, unit: 'g', scalingRole: 'percentage' },
      ],
      steps: [{ stepNumber: 1, description: 'Mix, knead, proof and bake until done.' }],
    });
    const res = await svc.parseText('u1', EN_TEXT);
    expect(res.recipe.scalingProfile).toBe('bakers_percentage');
    expect(res.recipe.ingredients.map((i) => i.percentageValue)).toEqual([100, 68, 2, 1.4]);
    expect(res.warnings).toEqual([]);
  });

  it('英文 ratio canned（V60）→ ratioValue [1, 15]', async () => {
    const { svc } = makeService({
      title: 'V60 Pour Over',
      scalingProfile: 'ratio_based',
      ingredients: [
        { name: 'Coffee', amount: 20, unit: 'g', scalingRole: 'anchor' },
        { name: 'Water', amount: 300, unit: 'g', scalingRole: 'ratio_linked' },
      ],
      steps: [{ stepNumber: 1, description: 'Bloom then pour in slow spirals to 300g.' }],
    });
    const res = await svc.parseText('u1', 'Pour over, 1:15 coffee to water ratio.');
    expect(res.recipe.scalingProfile).toBe('ratio_based');
    expect(res.recipe.ingredients.map((i) => i.ratioValue)).toEqual([1, 15]);
  });

  it('英文 multi_ratio canned（Negroni）→ parts [1,1,1]，无 percentage 料 baseAnchor null', async () => {
    const { svc } = makeService({
      title: 'Negroni',
      scalingProfile: 'multi_ratio',
      percentBase: null,
      ingredients: [
        { name: 'Gin', amount: 30, unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'spirits' },
        { name: 'Campari', amount: 30, unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'spirits' },
        { name: 'Sweet vermouth', amount: 30, unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'spirits' },
      ],
      steps: [{ stepNumber: 1, description: 'Stir with ice and strain over a big cube.' }],
    });
    const res = await svc.parseText('u1', 'Equal parts gin, campari and sweet vermouth.');
    expect(res.recipe.scalingProfile).toBe('multi_ratio');
    expect(res.recipe.ingredients.map((i) => i.ratioValue)).toEqual([1, 1, 1]);
    expect(res.recipe.baseAnchor).toBeNull();
  });

  it('"to taste" 原样保留，不被强转成 适量', async () => {
    const { svc } = makeService({
      title: 'Simple Salad',
      ingredients: [
        { name: 'Lettuce', amount: 200, unit: 'g' },
        { name: 'Salt', amount: 0, unit: 'to taste' },
      ],
      steps: [{ stepNumber: 1, description: 'Toss everything together and season.' }],
    });
    const res = await svc.parseText('u1', 'Toss lettuce, season with salt to taste.');
    expect(res.recipe.ingredients[1].amount).toBe(0);
    expect(res.recipe.ingredients[1].unit).toBe('to taste');
  });

  it('英文非法 amount → 0 + 具体单位替换为 "to taste"（镜像中文 适量 行为）', async () => {
    const { svc } = makeService({
      title: 'Spicy Pasta',
      ingredients: [{ name: 'Chili flakes', amount: 'abc', unit: 'g' }],
      steps: [{ stepNumber: 1, description: 'Boil pasta, toss with oil and chili flakes.' }],
    });
    const res = await svc.parseText('u1', 'Boil pasta and season with chili flakes.');
    expect(res.recipe.ingredients[0].amount).toBe(0);
    expect(res.recipe.ingredients[0].unit).toBe('to taste');
  });

  it('英文兜底：缺 name → "Ingredient 1"，缺 groupName → "Main"', async () => {
    const { svc } = makeService({
      title: 'Mystery Dish',
      ingredients: [{ amount: 100, unit: 'g' }],
      steps: [{ stepNumber: 1, description: 'Cook the mystery ingredient thoroughly.' }],
    });
    const res = await svc.parseText('u1', 'Cook something nice, one hundred grams of it.');
    expect(res.recipe.ingredients[0].name).toBe('Ingredient 1');
    expect(res.recipe.ingredients[0].groupName).toBe('Main');
  });

  it('中文回归钉：缺 name → 食材1，缺 groupName → 主料', async () => {
    const { svc } = makeService({
      title: '神秘料理',
      ingredients: [{ amount: 100, unit: 'g' }],
      steps: STEPS,
    });
    const res = await svc.parseText('u1', '把一百克神秘原料煮熟即可。');
    expect(res.recipe.ingredients[0].name).toBe('食材1');
    expect(res.recipe.ingredients[0].groupName).toBe('主料');
  });

  it('混合钉：英文原文中的中文原料名 → CJK 胜出（适量）', async () => {
    const { svc } = makeService({
      title: 'Fusion Stir-fry',
      ingredients: [{ name: '葱', amount: 0, unit: 'g' }],
      steps: [{ stepNumber: 1, description: 'Stir fry with scallions until fragrant.' }],
    });
    const res = await svc.parseText('u1', 'Stir fry with scallions, use 葱 as needed.');
    expect(res.recipe.ingredients[0].unit).toBe('适量');
  });
});
