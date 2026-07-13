import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

/**
 * 官方配方保存链路的缩放字段测试（照 recipes.service.scaling-save.spec 的
 * 内存版 EntityManager 模式）。只覆盖 create/update 的缩放/step.warning 行为，
 * 列表/统计等其余路径由既有集成流程兜底。
 */

interface FakeStore {
  recipe: any | null;
  ings: any[];
  steps: any[];
  cats: any[];
}

function makeFakeMgr(store: FakeStore) {
  let nextIngId = 1;
  let nextStepId = 1;
  const mgr = {
    create: (Entity: any, data: any) => ({ ...data, __e: Entity.name }),
    save: async (_Entity: any, x: any) => {
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
  };
  return mgr;
}

const OFFICIAL_USER = { id: 'official-1', nickname: 'Precision Kitchen' };

function makeService() {
  const store: FakeStore = { recipe: null, ings: [], steps: [], cats: [] };
  const mgr = makeFakeMgr(store);
  const emptyRepo: any = { findOne: async () => null, find: async () => [], count: async () => 0 };
  const usersRepo: any = {
    ...emptyRepo,
    createQueryBuilder: () => ({
      where: () => ({ andWhere: () => ({ getOne: async () => OFFICIAL_USER }) }),
    }),
  };
  const recipesRepo: any = { ...emptyRepo, findOne: async () => store.recipe };
  const ds: any = { transaction: (fn: (m: any) => Promise<unknown>) => fn(mgr) };

  const svc = new AdminService(
    usersRepo, // users
    recipesRepo, // recipes
    emptyRepo, // recipeIngredients
    emptyRepo, // recipeSteps
    emptyRepo, // recipeCategories
    emptyRepo, // logs
    emptyRepo, // favorites
    emptyRepo, // ingredients
    emptyRepo, // categories
    ds,
    {} as any, // usersService（本 spec 不触达）
  );
  jest.spyOn(svc, 'getRecipeDetail').mockImplementation(async (id: string) => ({ id }) as any);
  return { svc, store };
}

const STEP = { stepNumber: 1, description: 'Mix and bake' };

const BAKERS_INGS = [
  {
    customName: 'Bread flour',
    amount: '500',
    unit: 'g',
    scalingRole: 'anchor' as const,
    percentageValue: 100,
  },
  {
    customName: 'Water',
    amount: '340',
    unit: 'g',
    scalingRole: 'percentage' as const,
    percentageValue: 68,
  },
];

const MILK_TEA_INGS = [
  {
    customName: 'Black tea',
    amount: '10',
    unit: 'g',
    scalingRole: 'ratio_linked' as const,
    ratioGroup: 'tea_base',
    ratioValue: 1,
  },
  {
    customName: 'Hot water',
    amount: '120',
    unit: 'g',
    scalingRole: 'ratio_linked' as const,
    ratioGroup: 'tea_base',
    ratioValue: 12,
  },
  {
    customName: 'Sugar',
    amount: '9.6',
    unit: 'g',
    scalingRole: 'percentage' as const,
    percentageValue: 8,
  },
];

function createDto(extra: object) {
  return {
    title: 'Verify Loaf',
    baseServings: 1,
    difficulty: 'medium' as const,
    ingredients: BAKERS_INGS,
    steps: [STEP],
    ...extra,
  } as any;
}

describe('AdminService.createOfficialRecipe — 缩放管线', () => {
  it('bakers：scalingProfile 落 recipe，percentageValue 以 3 位小数字符串落库，roundDp 透传', async () => {
    const { svc, store } = makeService();
    await svc.createOfficialRecipe(
      createDto({
        scalingProfile: 'bakers_percentage',
        ingredients: [
          { ...BAKERS_INGS[0], roundDp: 0 },
          { ...BAKERS_INGS[1], percentageValue: 68.1234 },
        ],
      }),
    );
    expect(store.recipe.scalingProfile).toBe('bakers_percentage');
    expect(store.ings[0].percentageValue).toBe('100.000');
    expect(store.ings[0].roundDp).toBe(0);
    expect(store.ings[1].percentageValue).toBe('68.123');
  });

  it('multi_ratio：baseAnchor.ingredientIndex 重映射为第 N 条插入 id', async () => {
    const { svc, store } = makeService();
    await svc.createOfficialRecipe(
      createDto({
        scalingProfile: 'multi_ratio',
        ingredients: MILK_TEA_INGS,
        baseAnchor: { percentBase: { ingredientIndex: 1 } },
      }),
    );
    expect(store.recipe.baseAnchor).toEqual({ percentBase: { id: store.ings[1].id } });
    expect(store.ings[1].ratioValue).toBe('12.000');
  });

  it('不自洽（bakers 无锚）→ 400，事务未执行', async () => {
    const { svc, store } = makeService();
    await expect(
      svc.createOfficialRecipe(
        createDto({
          scalingProfile: 'bakers_percentage',
          ingredients: [{ customName: 'Water', amount: '340', unit: 'g' }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.recipe).toBeNull();
    expect(store.ings).toHaveLength(0);
  });

  it('linear_legacy（默认）：混入的缩放字段被剥离为 null（DB 卫生）', async () => {
    const { svc, store } = makeService();
    await svc.createOfficialRecipe(
      createDto({
        ingredients: [{ ...BAKERS_INGS[0] }], // 没给 scalingProfile 但带了 anchor/percentageValue
      }),
    );
    expect(store.recipe.scalingProfile).toBe('linear_legacy');
    expect(store.ings[0].scalingRole).toBeNull();
    expect(store.ings[0].percentageValue).toBeNull();
    expect(store.ings[0].roundDp).toBeNull();
  });

  it('legacy 回归钉：官方用户 + published + isFeatured + amount 字符串透传', async () => {
    const { svc, store } = makeService();
    await svc.createOfficialRecipe(createDto({}));
    expect(store.recipe.authorId).toBe(OFFICIAL_USER.id);
    expect(store.recipe.status).toBe('published');
    expect(store.recipe.isFeatured).toBe(true);
    expect(store.ings[0].amount).toBe('500');
  });

  it('step.warning 落库；未给 → null', async () => {
    const { svc, store } = makeService();
    await svc.createOfficialRecipe(
      createDto({
        steps: [
          { stepNumber: 1, description: 'Bake', warning: 'Do not open the oven early' },
          { stepNumber: 2, description: 'Cool' },
        ],
      }),
    );
    expect(store.steps[0].warning).toBe('Do not open the oven early');
    expect(store.steps[1].warning).toBeNull();
  });
});

describe('AdminService.updateRecipe — 缩放管线 + wipe-fix', () => {
  async function seedScalingRecipe(svc: AdminService, store: FakeStore) {
    await svc.createOfficialRecipe(
      createDto({
        scalingProfile: 'multi_ratio',
        ingredients: MILK_TEA_INGS,
        baseAnchor: { percentBase: { ingredientIndex: 1 } },
      }),
    );
    return store.recipe.id as string;
  }

  it('wipe-fix 往返：重发同 ingredients + baseAnchor → 缩放列与重映射锚完好', async () => {
    const { svc, store } = makeService();
    const id = await seedScalingRecipe(svc, store);

    await svc.updateRecipe(id, {
      ingredients: MILK_TEA_INGS,
      baseAnchor: { percentBase: { ingredientIndex: 1 } },
    } as any);

    expect(store.ings).toHaveLength(3);
    expect(store.ings[0].ratioGroup).toBe('tea_base');
    expect(store.ings[2].percentageValue).toBe('8.000');
    expect(store.recipe.baseAnchor).toEqual({ percentBase: { id: store.ings[1].id } });
  });

  it('提交 ingredients 不带 baseAnchor 且新集合无 percentage 料 → baseAnchor 置 null', async () => {
    const { svc, store } = makeService();
    const id = await seedScalingRecipe(svc, store);

    await svc.updateRecipe(id, {
      ingredients: MILK_TEA_INGS.slice(0, 2), // 只剩比例组，无 percentage
    } as any);

    expect(store.recipe.baseAnchor).toBeNull();
    expect(store.ings).toHaveLength(2);
  });

  it('孤儿提交守卫：baseAnchor 或非 linear profile 不带 ingredients → 400；单独 linear_legacy 放行', async () => {
    const { svc, store } = makeService();
    const id = await seedScalingRecipe(svc, store);

    await expect(
      svc.updateRecipe(id, { baseAnchor: { percentBase: { ingredientIndex: 0 } } } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.updateRecipe(id, { scalingProfile: 'bakers_percentage' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    await svc.updateRecipe(id, { scalingProfile: 'linear_legacy' } as any);
    expect(store.recipe.scalingProfile).toBe('linear_legacy');
  });

  it('缩放配方裸发 ingredients（无缩放字段）→ 400（fail-loud 取代静默抹除）', async () => {
    const { svc, store } = makeService();
    const id = await seedScalingRecipe(svc, store);

    await expect(
      svc.updateRecipe(id, {
        ingredients: [{ customName: 'Black tea', amount: '10', unit: 'g' }],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    // 原有数据未被抹
    expect(store.ings).toHaveLength(3);
  });

  it('steps-only 更新：ingredients/baseAnchor 不动，step.warning 落库', async () => {
    const { svc, store } = makeService();
    const id = await seedScalingRecipe(svc, store);
    const anchorBefore = store.recipe.baseAnchor;

    await svc.updateRecipe(id, {
      steps: [{ stepNumber: 1, description: 'Steep tea', warning: 'Do not oversteep' }],
    } as any);

    expect(store.ings).toHaveLength(3);
    expect(store.recipe.baseAnchor).toEqual(anchorBefore);
    expect(store.steps[0].warning).toBe('Do not oversteep');
  });
});
