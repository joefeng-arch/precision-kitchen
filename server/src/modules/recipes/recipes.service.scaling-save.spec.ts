import { BadRequestException } from '@nestjs/common';
import { RecipesService } from './recipes.service';

/**
 * 保存链路的缩放字段测试：手写内存版 EntityManager（save 递增分配 id），
 * ds.transaction 直接执行回调。只覆盖 create/update 的缩放行为，
 * 列表/详情等其余路径由既有测试与真实 DB 兜底。
 */

interface FakeStore {
  recipe: any | null;
  ings: any[];
  steps: any[];
  versions: any[];
  cats: any[];
}

function makeFakeMgr(store: FakeStore) {
  let nextIngId = 1;
  let nextStepId = 1;
  const mgr = {
    create: (Entity: any, data: any) => ({ ...data, __e: Entity.name }),
    save: async (x: any) => {
      const arr = Array.isArray(x) ? x : [x];
      for (const e of arr) {
        switch (e.__e) {
          case 'Recipe':
            if (!e.id) e.id = 'r-1';
            store.recipe = e;
            break;
          case 'RecipeIngredient':
            e.id = nextIngId++;
            store.ings.push(e);
            break;
          case 'RecipeStep':
            e.id = nextStepId++;
            store.steps.push(e);
            break;
          case 'RecipeVersion':
            store.versions.push(e);
            break;
          case 'RecipeCategory':
            store.cats.push(e);
            break;
        }
      }
      return x;
    },
    delete: async (Entity: any, where: any) => {
      if (Entity.name === 'RecipeIngredient') {
        store.ings = store.ings.filter((r) => r.recipeId !== where.recipeId);
      }
      if (Entity.name === 'RecipeStep') {
        store.steps = store.steps.filter((r) => r.recipeId !== where.recipeId);
      }
      if (Entity.name === 'RecipeCategory') {
        store.cats = store.cats.filter((r) => r.recipeId !== where.recipeId);
      }
    },
    update: async (Entity: any, _where: any, patch: any) => {
      if (Entity.name === 'Recipe' && store.recipe) Object.assign(store.recipe, patch);
    },
    findOne: async (Entity: any, _opts: any) => {
      if (Entity.name === 'Recipe' && store.recipe) {
        return {
          ...store.recipe,
          ingredients: [...store.ings],
          steps: [...store.steps],
        };
      }
      return null;
    },
    find: async (Entity: any, _opts: any) => {
      if (Entity.name === 'RecipeIngredient') return [...store.ings];
      if (Entity.name === 'RecipeStep') return [...store.steps];
      return [];
    },
  };
  return { mgr, seedIngId: (n: number) => (nextIngId = n) };
}

function makeService() {
  const store: FakeStore = { recipe: null, ings: [], steps: [], versions: [], cats: [] };
  const { mgr, seedIngId } = makeFakeMgr(store);
  const emptyRepo: any = { findOne: async () => null, find: async () => [] };
  const ds: any = { transaction: (fn: (m: any) => Promise<unknown>) => fn(mgr) };
  const svc = new RecipesService(
    emptyRepo, // recipes
    emptyRepo, // ris
    emptyRepo, // steps
    emptyRepo, // versions
    emptyRepo, // recipeCategories
    emptyRepo, // ingredients
    emptyRepo, // categories
    emptyRepo, // users
    ds,
  );
  return { svc, store, seedIngId };
}

const STEPS = [{ stepNumber: 1, description: '按步骤操作' }];

const MILK_TEA_INGS = [
  {
    customName: '茶叶',
    amount: 100,
    unit: 'g',
    scalingRole: 'ratio_linked' as const,
    ratioGroup: 'tea_base',
    ratioValue: 1,
  },
  {
    customName: '热水',
    amount: 400,
    unit: 'g',
    scalingRole: 'ratio_linked' as const,
    ratioGroup: 'tea_base',
    ratioValue: 4,
  },
  {
    customName: '糖',
    amount: 40,
    unit: 'g',
    scalingRole: 'percentage' as const,
    percentageValue: 10,
  },
];

describe('RecipesService.create — 缩放字段落库', () => {
  it('bakers：新字段以 3 位小数字符串落库', async () => {
    const { svc, store } = makeService();
    await svc.create('u1', {
      title: '面包',
      scalingProfile: 'bakers_percentage',
      ingredients: [
        { customName: '面粉', amount: 500, unit: 'g', scalingRole: 'anchor', percentageValue: 100 },
        {
          customName: '水',
          amount: 325,
          unit: 'g',
          scalingRole: 'percentage',
          percentageValue: 65,
        },
      ],
      steps: STEPS,
    } as any);
    expect(store.recipe.scalingProfile).toBe('bakers_percentage');
    expect(store.ings[0].scalingRole).toBe('anchor');
    expect(store.ings[0].percentageValue).toBe('100.000');
    expect(store.ings[1].percentageValue).toBe('65.000');
    expect(store.ings[1].ratioGroup).toBeNull();
  });

  it('multi_ratio：baseAnchor.percentBase 下标重映射为实际插入的 ingredient id', async () => {
    const { svc, store } = makeService();
    await svc.create('u1', {
      title: '奶茶',
      scalingProfile: 'multi_ratio',
      baseAnchor: { percentBase: { ingredientIndex: 1 } },
      ingredients: MILK_TEA_INGS,
      steps: STEPS,
    } as any);
    // 三条 ingredients 依次拿到 id 1/2/3，下标 1 → id 2
    expect(store.recipe.baseAnchor).toEqual({ percentBase: { id: 2 } });
    // 快照在重映射之后（快照里的 baseAnchor 已是最终态）
    expect(store.versions[0].snapshot.baseAnchor).toEqual({ percentBase: { id: 2 } });
  });

  it('缩放配置不一致（bakers 无锚点）→ 400，不落库', async () => {
    const { svc, store } = makeService();
    await expect(
      svc.create('u1', {
        title: '假面包',
        scalingProfile: 'bakers_percentage',
        ingredients: [
          {
            customName: '水',
            amount: 325,
            unit: 'g',
            scalingRole: 'percentage',
            percentageValue: 65,
          },
        ],
        steps: STEPS,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.recipe).toBeNull();
  });

  it('linear_legacy（默认）：提交的缩放字段被剥离为 null（DB 卫生）', async () => {
    const { svc, store } = makeService();
    await svc.create('u1', {
      title: '家常菜',
      ingredients: [
        { customName: '肉', amount: 300, unit: 'g', scalingRole: 'anchor', percentageValue: 100 },
      ],
      steps: STEPS,
    } as any);
    expect(store.recipe.scalingProfile).toBe('linear_legacy');
    expect(store.ings[0].scalingRole).toBeNull();
    expect(store.ings[0].percentageValue).toBeNull();
    expect(store.ings[0].ratioValue).toBeNull();
  });
});

describe('RecipesService.update — 缩放字段与 baseAnchor 悬垂防护', () => {
  /** 预置一个已存的 multi_ratio 奶茶（ings id 1/2/3，baseAnchor 指向 id 2） */
  async function seedMilkTea() {
    const made = makeService();
    await made.svc.create('u1', {
      title: '奶茶',
      scalingProfile: 'multi_ratio',
      baseAnchor: { percentBase: { ingredientIndex: 1 } },
      ingredients: MILK_TEA_INGS,
      steps: STEPS,
    } as any);
    return made;
  }

  it('带 baseAnchor 但不带 ingredients → 400（重插换 id 必悬垂）', async () => {
    const { svc } = await seedMilkTea();
    await expect(
      svc.update('u1', 'r-1', { baseAnchor: { percentBase: { group: 'tea_base' } } } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('带非 linear 的 scalingProfile 但不带 ingredients → 400', async () => {
    const { svc } = await seedMilkTea();
    await expect(
      svc.update('u1', 'r-1', { scalingProfile: 'multi_ratio' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('steps-only 更新：缩放列原样保留（riToDto 往返不清空）', async () => {
    const { svc, store } = await seedMilkTea();
    await svc.update('u1', 'r-1', { steps: [{ stepNumber: 1, description: '改个步骤' }] } as any);
    const water = store.ings.find((i: any) => i.customName === '热水');
    expect(water.scalingRole).toBe('ratio_linked');
    expect(water.ratioGroup).toBe('tea_base');
    expect(water.ratioValue).toBe('4.000');
    const sugar = store.ings.find((i: any) => i.customName === '糖');
    expect(sugar.percentageValue).toBe('10.000');
  });

  it('steps-only 更新：baseAnchor.percentBase.id 按位置重映射到重插后的新 id', async () => {
    const { svc, store } = await seedMilkTea();
    expect(store.recipe.baseAnchor).toEqual({ percentBase: { id: 2 } });
    await svc.update('u1', 'r-1', { steps: [{ stepNumber: 1, description: '改' }] } as any);
    // 重插后三条新 id 4/5/6；旧 id 2 在原数组中位于下标 1 → 新 id 5
    const water = store.ings.find((i: any) => i.customName === '热水');
    expect(store.recipe.baseAnchor).toEqual({ percentBase: { id: water.id } });
    expect(water.id).toBe(5);
  });

  it('重发 ingredients + baseAnchor：校验通过后重映射入库', async () => {
    const { svc, store } = await seedMilkTea();
    await svc.update('u1', 'r-1', {
      ingredients: MILK_TEA_INGS,
      baseAnchor: { percentBase: { ingredientIndex: 0 } },
    } as any);
    const tea = store.ings.find((i: any) => i.customName === '茶叶');
    expect(store.recipe.baseAnchor).toEqual({ percentBase: { id: tea.id } });
  });

  it('重发 ingredients（multi_ratio 含 percentage）但缺 baseAnchor → 400', async () => {
    const { svc } = await seedMilkTea();
    await expect(
      svc.update('u1', 'r-1', { ingredients: MILK_TEA_INGS } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('重发 ingredients（无 percentage 料）且不带 baseAnchor → 已存 baseAnchor 置 null', async () => {
    const { svc, store } = await seedMilkTea();
    await svc.update('u1', 'r-1', {
      ingredients: [
        {
          customName: '茶叶',
          amount: 100,
          unit: 'g',
          scalingRole: 'ratio_linked',
          ratioGroup: 'tea_base',
          ratioValue: 1,
        },
        {
          customName: '热水',
          amount: 400,
          unit: 'g',
          scalingRole: 'ratio_linked',
          ratioGroup: 'tea_base',
          ratioValue: 4,
        },
      ],
    } as any);
    expect(store.recipe.baseAnchor).toBeNull();
  });
});

describe('RecipesService — 步骤 warning 落库与往返', () => {
  const STEP_WITH_BOTH = {
    stepNumber: 1,
    description: '烤箱烘烤',
    tips: '上色不够可加烤 2 分钟',
    warning: '前 25 分钟别开烤箱门',
  };

  it('create：步骤 warning 与 tips 并存落库', async () => {
    const { svc, store } = makeService();
    await svc.create('u1', {
      title: '吐司',
      ingredients: [{ customName: '面粉', amount: 500, unit: 'g' }],
      steps: [STEP_WITH_BOTH],
    } as any);
    expect(store.steps[0].warning).toBe('前 25 分钟别开烤箱门');
    expect(store.steps[0].tips).toBe('上色不够可加烤 2 分钟');
  });

  it('ingredients-only 更新：steps 往返不清空 warning（回归）', async () => {
    const { svc, store } = makeService();
    await svc.create('u1', {
      title: '吐司',
      ingredients: [{ customName: '面粉', amount: 500, unit: 'g' }],
      steps: [STEP_WITH_BOTH],
    } as any);

    await svc.update('u1', 'r-1', {
      ingredients: [{ customName: '高筋面粉', amount: 450, unit: 'g' }],
    } as any);

    expect(store.steps).toHaveLength(1);
    expect(store.steps[0].warning).toBe('前 25 分钟别开烤箱门');
    expect(store.steps[0].tips).toBe('上色不够可加烤 2 分钟');
  });
});
