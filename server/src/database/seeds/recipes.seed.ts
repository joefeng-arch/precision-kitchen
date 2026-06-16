import { DataSource } from 'typeorm';
import { Category } from '../../modules/categories/entities/category.entity';
import { Ingredient } from '../../modules/ingredients/entities/ingredient.entity';
import { Recipe } from '../../modules/recipes/entities/recipe.entity';
import { RecipeCategory } from '../../modules/recipes/entities/recipe-category.entity';
import { RecipeIngredient } from '../../modules/recipes/entities/recipe-ingredient.entity';
import { RecipeStep } from '../../modules/recipes/entities/recipe-step.entity';
import { User } from '../../modules/users/entities/user.entity';

type ScaleType = 'linear' | 'sub_linear' | 'fixed';
type Difficulty = 'easy' | 'medium' | 'hard';

interface SeedIngredient {
  /** 公共库食材名（会自动 lookup ingredientId）；找不到就回退到 customName */
  name: string;
  amount: number;
  unit: string; // 推荐用 canonical 单位 g / ml / 个，方便 SOP 扣库存
  scaleType?: ScaleType;
  groupName?: string;
  notes?: string;
}

interface SeedStep {
  description: string;
  durationSeconds?: number;
  tips?: string;
}

interface SeedRecipe {
  title: string;
  description: string;
  /** 主分类（向后兼容用，写到 recipes.categoryId） */
  category: string;
  /** 可选额外分类，会一起写入 recipe_categories 关联表 */
  extraCategories?: string[];
  mealScene?: string;
  baseServings: number;
  difficulty: Difficulty;
  totalMinutes: number;
  tags: string[];
  coverImage?: string;
  ingredients: SeedIngredient[];
  steps: SeedStep[];
}

const RECIPES: SeedRecipe[] = [
  {
    title: '番茄炒蛋',
    description: '家常下饭神菜，酸甜开胃，新手也能 10 分钟搞定。',
    category: '中餐',
    extraCategories: ['家常菜', '快手菜', '下饭菜'],
    mealScene: '午餐',
    baseServings: 2,
    difficulty: 'easy',
    totalMinutes: 10,
    tags: ['家常', '快手', '下饭'],
    coverImage: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    ingredients: [
      { name: '番茄', amount: 300, unit: 'g', groupName: '主料' },
      { name: '鸡蛋', amount: 3, unit: '个', groupName: '主料' },
      { name: '葱', amount: 10, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '食用油', amount: 30, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '盐', amount: 3, unit: 'g', scaleType: 'sub_linear', groupName: '调味' },
      { name: '糖', amount: 5, unit: 'g', scaleType: 'sub_linear', groupName: '调味' },
    ],
    steps: [
      { description: '番茄切块，鸡蛋打散加少许盐搅匀，葱切葱花。' },
      { description: '热锅冷油，倒入蛋液，中火炒至蓬松凝固，盛出备用。', durationSeconds: 90 },
      { description: '锅内留底油，下番茄块翻炒出汁，加少许糖中和酸味。', durationSeconds: 180, tips: '加一勺糖可以让味道更柔和' },
      { description: '倒回炒蛋，加盐调味，翻炒均匀，撒葱花出锅。', durationSeconds: 60 },
    ],
  },
  {
    title: '红烧肉',
    description: '入口即化的家常红烧肉，肥而不腻，色泽红亮。',
    category: '中餐',
    extraCategories: ['家常菜', '下饭菜'],
    mealScene: '晚餐',
    baseServings: 4,
    difficulty: 'medium',
    totalMinutes: 75,
    tags: ['硬菜', '家宴', '下饭'],
    coverImage: 'https://images.unsplash.com/photo-1623595119708-26b1f7500ee9?w=800',
    ingredients: [
      { name: '五花肉', amount: 800, unit: 'g', groupName: '主料' },
      { name: '姜', amount: 20, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '葱', amount: 20, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '八角', amount: 3, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '香叶', amount: 2, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '冰糖', amount: 40, unit: 'g', scaleType: 'sub_linear', groupName: '调味' },
      { name: '生抽', amount: 30, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '老抽', amount: 10, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '料酒', amount: 30, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
    ],
    steps: [
      { description: '五花肉切 2cm 见方的块，冷水下锅加料酒、姜片焯水 3 分钟，捞出冲洗干净。', durationSeconds: 300 },
      { description: '锅烧热放少量油，下冰糖小火炒至焦糖色，下五花肉翻炒上色。', durationSeconds: 240, tips: '冰糖一定要小火慢炒，否则会发苦' },
      { description: '加入葱姜、八角、香叶炒香，烹入料酒、生抽、老抽炒匀。', durationSeconds: 120 },
      { description: '加开水没过肉块，大火烧开转小火炖 50 分钟。', durationSeconds: 3000 },
      { description: '开盖大火收汁至浓稠挂勺即可出锅。', durationSeconds: 300 },
    ],
  },
  {
    title: '麻婆豆腐',
    description: '麻辣鲜香的川菜经典，配米饭绝配。',
    category: '中餐',
    extraCategories: ['家常菜', '下饭菜'],
    mealScene: '晚餐',
    baseServings: 2,
    difficulty: 'easy',
    totalMinutes: 20,
    tags: ['川菜', '下饭', '微辣'],
    coverImage: 'https://images.unsplash.com/photo-1582450871972-ab5ca641643d?w=800',
    ingredients: [
      { name: '豆腐', amount: 400, unit: 'g', groupName: '主料' },
      { name: '猪肉', amount: 100, unit: 'g', notes: '肉末', groupName: '主料' },
      { name: '蒜', amount: 3, unit: '瓣', scaleType: 'fixed', groupName: '配料' },
      { name: '姜', amount: 10, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '葱', amount: 15, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '花椒', amount: 3, unit: 'g', scaleType: 'sub_linear', groupName: '调味' },
      { name: '生抽', amount: 15, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '食用油', amount: 30, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
    ],
    steps: [
      { description: '豆腐切 1.5cm 见方的块，加少许盐用温水浸泡 5 分钟去豆腥。', durationSeconds: 300 },
      { description: '热锅冷油下肉末，炒至变色焦香，盛出备用。', durationSeconds: 180 },
      { description: '锅内留油下姜蒜末、花椒爆香，加 1 勺豆瓣酱（如有）炒出红油。', durationSeconds: 60 },
      { description: '加少许水烧开，下豆腐、肉末，加生抽，小火炖 5 分钟。', durationSeconds: 300 },
      { description: '勾薄芡收汁，撒葱花、花椒粉出锅。', durationSeconds: 60 },
    ],
  },
  {
    title: '青椒土豆丝',
    description: '酸辣爽脆的国民下饭菜，几块钱搞定一餐。',
    category: '中餐',
    extraCategories: ['家常菜', '快手菜', '下饭菜'],
    mealScene: '午餐',
    baseServings: 2,
    difficulty: 'easy',
    totalMinutes: 15,
    tags: ['素菜', '家常', '快手'],
    coverImage: 'https://images.unsplash.com/photo-1601315379734-425ce21f5cee?w=800',
    ingredients: [
      { name: '土豆', amount: 400, unit: 'g', groupName: '主料' },
      { name: '辣椒', amount: 100, unit: 'g', notes: '青椒', groupName: '主料' },
      { name: '蒜', amount: 2, unit: '瓣', scaleType: 'fixed', groupName: '配料' },
      { name: '醋', amount: 15, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '盐', amount: 3, unit: 'g', scaleType: 'sub_linear', groupName: '调味' },
      { name: '食用油', amount: 20, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
    ],
    steps: [
      { description: '土豆去皮切细丝，用清水冲洗两遍去淀粉，沥干。', durationSeconds: 180, tips: '冲水后口感更脆' },
      { description: '青椒切丝，蒜切末。' },
      { description: '热锅热油下蒜末爆香，倒入土豆丝大火翻炒 1 分钟。', durationSeconds: 60 },
      { description: '加入青椒丝继续翻炒，沿锅边淋醋，加盐调味。', durationSeconds: 90 },
      { description: '炒至土豆丝断生但仍有脆感时出锅。', durationSeconds: 30 },
    ],
  },
  {
    title: '可乐鸡翅',
    description: '甜咸交织的童年味道，新手 0 失败菜。',
    category: '中餐',
    extraCategories: ['家常菜', '下饭菜'],
    mealScene: '晚餐',
    baseServings: 3,
    difficulty: 'easy',
    totalMinutes: 30,
    tags: ['家常', '新手友好', '甜口'],
    coverImage: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800',
    ingredients: [
      { name: '鸡翅', amount: 500, unit: 'g', groupName: '主料' },
      { name: '姜', amount: 15, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '葱', amount: 10, unit: 'g', scaleType: 'fixed', groupName: '配料' },
      { name: '生抽', amount: 30, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '老抽', amount: 5, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '料酒', amount: 20, unit: 'ml', scaleType: 'sub_linear', groupName: '调味' },
      { name: '可乐', amount: 330, unit: 'ml', groupName: '调味' },
    ],
    steps: [
      { description: '鸡翅两面各划两刀，冷水下锅加料酒姜片焯水 3 分钟，捞出沥干。', durationSeconds: 240 },
      { description: '锅内放少许油，下鸡翅煎至两面金黄。', durationSeconds: 240, tips: '煎到表皮起焦最香' },
      { description: '下姜片、葱段炒香，加生抽、老抽炒上色。', durationSeconds: 60 },
      { description: '倒入可乐没过鸡翅，大火烧开转中小火炖 15 分钟。', durationSeconds: 900 },
      { description: '开盖大火收汁至浓稠裹住鸡翅即可。', durationSeconds: 180 },
    ],
  },
];

/**
 * Find (or create) the "老舅官方" virtual user who owns all seed/official recipes.
 * This user has no openid and cannot login to the mini-app.
 */
async function ensureSeedAuthor(ds: DataSource): Promise<string> {
  const userRepo = ds.getRepository(User);

  // Legacy: look up by old openid '__seed_system__' and migrate
  let user = await userRepo.findOne({ where: { openid: '__seed_system__' } });
  if (user) {
    user.openid = null;
    user.nickname = '老舅官方';
    user.role = 'user';
    await userRepo.save(user);
    return user.id;
  }

  // Look up by nickname with null openid
  user = await userRepo
    .createQueryBuilder('u')
    .where('u.openid IS NULL')
    .andWhere('u.nickname = :name', { name: '老舅官方' })
    .getOne();
  if (user) return user.id;

  // Create fresh
  user = await userRepo.save(
    userRepo.create({
      openid: null,
      nickname: '老舅官方',
      role: 'user',
    }),
  );
  return user.id;
}

export async function seedRecipes(ds: DataSource): Promise<void> {
  const recipeRepo = ds.getRepository(Recipe);
  const ingRepo = ds.getRepository(Ingredient);
  const catRepo = ds.getRepository(Category);
  const riRepo = ds.getRepository(RecipeIngredient);
  const stepRepo = ds.getRepository(RecipeStep);
  const rcRepo = ds.getRepository(RecipeCategory);

  const authorId = await ensureSeedAuthor(ds);

  const allIngs = await ingRepo.find();
  const ingByName = new Map(allIngs.map((i) => [i.name, i]));

  const cats = await catRepo.find();
  const recipeCatMap = new Map(cats.filter((c) => c.type === 'recipe').map((c) => [c.name, c.id]));
  const mealCatMap = new Map(cats.filter((c) => c.type === 'meal_scene').map((c) => [c.name, c.id]));

  let inserted = 0;
  let skipped = 0;

  for (const data of RECIPES) {
    const exists = await recipeRepo.findOne({ where: { title: data.title, authorId } });
    if (exists) {
      skipped++;
      continue;
    }

    const recipe = await recipeRepo.save(
      recipeRepo.create({
        authorId,
        title: data.title,
        description: data.description,
        coverImage: data.coverImage ?? null,
        categoryId: recipeCatMap.get(data.category) ?? null,
        mealSceneId: data.mealScene ? mealCatMap.get(data.mealScene) ?? null : null,
        baseServings: data.baseServings,
        difficulty: data.difficulty,
        totalMinutes: data.totalMinutes,
        status: 'published',
        tags: data.tags,
        versionCount: 1,
      }),
    );

    for (let i = 0; i < data.ingredients.length; i++) {
      const item = data.ingredients[i];
      const ing = ingByName.get(item.name);
      await riRepo.save(
        riRepo.create({
          recipeId: recipe.id,
          ingredientId: ing?.id ?? null,
          customName: ing ? null : item.name,
          amount: item.amount.toFixed(2),
          unit: item.unit,
          scaleType: item.scaleType ?? 'linear',
          scaleFactor: '0.70',
          groupName: item.groupName ?? null,
          notes: item.notes ?? null,
          sort: i * 10,
        }),
      );
    }

    // 多分类关联表
    const allCatNames = [data.category, ...(data.extraCategories ?? [])];
    const allCatIds = allCatNames
      .map((n) => recipeCatMap.get(n))
      .filter((id): id is number => typeof id === 'number');
    for (const cid of Array.from(new Set(allCatIds))) {
      await rcRepo.save(rcRepo.create({ recipeId: recipe.id, categoryId: cid }));
    }

    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      await stepRepo.save(
        stepRepo.create({
          recipeId: recipe.id,
          stepNumber: i + 1,
          description: step.description,
          imageUrl: null,
          durationSeconds: step.durationSeconds ?? null,
          tips: step.tips ?? null,
        }),
      );
    }

    inserted++;
  }

  console.log(`[seed:recipes] inserted=${inserted} skipped=${skipped}`);
}
