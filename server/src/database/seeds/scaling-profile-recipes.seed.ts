import { DataSource, Repository } from 'typeorm';
import { Recipe } from '../../modules/recipes/entities/recipe.entity';
import { RecipeIngredient } from '../../modules/recipes/entities/recipe-ingredient.entity';
import { RecipeStep } from '../../modules/recipes/entities/recipe-step.entity';
import { User } from '../../modules/users/entities/user.entity';
import type { ScalingProfile, ScalingRole } from '../../common/utils/scaling-engine';

/**
 * 三条最小测试配方，一个 profile 一条，用于前端"缩放工作台"（Step 6）的真实联调，
 * 因为 recipes.seed.ts 里的六条都是 linear_legacy。与 recipes.seed.ts 完全独立，
 * 不影响已有种子数据；可随时按 title 前缀清理。
 */
interface SeedIngredient {
  customName: string;
  amount: string;
  unit: string;
  scalingRole?: ScalingRole | null;
  percentageValue?: string | null;
  ratioGroup?: string | null;
  ratioValue?: string | null;
  groupName?: string | null;
}

interface SeedRecipe {
  title: string;
  description: string;
  scalingProfile: ScalingProfile;
  baseServings: number;
  ingredients: SeedIngredient[];
  steps: string[];
  /** multi_ratio：作者指定 percentBase 基准的原料 customName，落库为 baseAnchor.percentBase.id */
  percentBaseAnchor?: string;
}

const RECIPES: SeedRecipe[] = [
  {
    title: '[测试] 面包师百分比吐司',
    description: 'bakers_percentage 测试配方：面粉为锚点，水/盐/酵母按百分比联动。',
    scalingProfile: 'bakers_percentage',
    baseServings: 1,
    ingredients: [
      { customName: '面粉', amount: '500', unit: 'g', scalingRole: 'anchor', percentageValue: '100', groupName: '主料' },
      { customName: '水', amount: '325', unit: 'g', scalingRole: 'percentage', percentageValue: '65', groupName: '主料' },
      { customName: '盐', amount: '10', unit: 'g', scalingRole: 'percentage', percentageValue: '2', groupName: '调味' },
      { customName: '酵母', amount: '5', unit: 'g', scalingRole: 'percentage', percentageValue: '1', groupName: '调味' },
    ],
    steps: ['混合面粉与水，静置 30 分钟（autolyse）。', '加入盐和酵母，揉至扩展阶段。', '基础发酵 1 小时，整形后二次发酵 40 分钟。', '烤箱 220°C 烤 25 分钟。'],
  },
  {
    title: '[测试] 手冲咖啡 1:15',
    description: 'ratio_based 测试配方：咖啡为锚点，水按 1:15 联动。',
    scalingProfile: 'ratio_based',
    baseServings: 1,
    ingredients: [
      { customName: '咖啡粉', amount: '20', unit: 'g', scalingRole: 'anchor', ratioValue: '1', groupName: '主料' },
      { customName: '水', amount: '300', unit: 'g', scalingRole: 'ratio_linked', ratioValue: '15', groupName: '主料' },
    ],
    steps: ['研磨咖啡豆至中细粉。', '注入两倍粉重的水闷蒸 30 秒。', '分段注水至总量，总时长控制在 2 分 30 秒左右。'],
  },
  {
    title: '[测试] 珍珠奶茶',
    description: 'multi_ratio 测试配方：tea_base 组（茶:水 1:4）联动，糖按热水量的百分比联动（非组总量）。',
    scalingProfile: 'multi_ratio',
    baseServings: 1,
    ingredients: [
      { customName: '茶叶', amount: '100', unit: 'g', scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: '1', groupName: '主料' },
      { customName: '热水', amount: '400', unit: 'g', scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: '4', groupName: '主料' },
      { customName: '糖', amount: '40', unit: 'g', scalingRole: 'percentage', percentageValue: '10', groupName: '调味' },
    ],
    percentBaseAnchor: '热水',
    steps: ['热水冲泡茶叶，浸泡 5 分钟后滤出茶汤。', '按比例加入糖，趁热搅拌至溶解。', '加入珍珠和冰块即可。'],
  },
];

/** 按 customName 找到已落库的原料，把其真实 id 写入 recipe.baseAnchor.percentBase */
async function applyPercentBaseAnchor(
  recipeRepo: Repository<Recipe>,
  recipeId: string,
  anchorName: string,
  ingredients: RecipeIngredient[],
): Promise<void> {
  const anchor = ingredients.find((i) => i.customName === anchorName);
  if (!anchor) {
    console.warn(
      `[seed:scaling-profile-recipes] percentBaseAnchor "${anchorName}" not found for recipe ${recipeId}, skipping`,
    );
    return;
  }
  await recipeRepo.update(recipeId, { baseAnchor: { percentBase: { id: anchor.id } } });
}

async function ensureSeedAuthor(ds: DataSource): Promise<string> {
  const userRepo = ds.getRepository(User);
  const user = await userRepo
    .createQueryBuilder('u')
    .where('u.openid IS NULL')
    .andWhere('u.nickname = :name', { name: '老舅官方' })
    .getOne();
  if (user) return user.id;
  const created = await userRepo.save(
    userRepo.create({ openid: null, nickname: '老舅官方', role: 'user' }),
  );
  return created.id;
}

export async function seedScalingProfileRecipes(ds: DataSource): Promise<void> {
  const recipeRepo = ds.getRepository(Recipe);
  const riRepo = ds.getRepository(RecipeIngredient);
  const stepRepo = ds.getRepository(RecipeStep);

  const authorId = await ensureSeedAuthor(ds);

  let inserted = 0;
  let skipped = 0;

  for (const data of RECIPES) {
    const exists = await recipeRepo.findOne({ where: { title: data.title, authorId } });
    if (exists) {
      skipped++;
      if (data.percentBaseAnchor) {
        const existingIngredients = await riRepo.find({ where: { recipeId: exists.id } });
        await applyPercentBaseAnchor(recipeRepo, exists.id, data.percentBaseAnchor, existingIngredients);
      }
      continue;
    }

    const recipe = await recipeRepo.save(
      recipeRepo.create({
        authorId,
        title: data.title,
        description: data.description,
        baseServings: data.baseServings,
        scalingProfile: data.scalingProfile,
        difficulty: 'medium',
        status: 'published',
        isPublic: true,
        isFeatured: false,
        tags: [data.scalingProfile],
        versionCount: 1,
      }),
    );

    const savedIngredients: RecipeIngredient[] = [];
    for (let i = 0; i < data.ingredients.length; i++) {
      const item = data.ingredients[i];
      savedIngredients.push(
        await riRepo.save(
          riRepo.create({
            recipeId: recipe.id,
            ingredientId: null,
            customName: item.customName,
            amount: item.amount,
            unit: item.unit,
            scaleType: 'linear',
            scaleFactor: '0.70',
            groupName: item.groupName ?? null,
            scalingRole: item.scalingRole ?? null,
            percentageValue: item.percentageValue ?? null,
            ratioGroup: item.ratioGroup ?? null,
            ratioValue: item.ratioValue ?? null,
            sort: i * 10,
          }),
        ),
      );
    }

    if (data.percentBaseAnchor) {
      await applyPercentBaseAnchor(recipeRepo, recipe.id, data.percentBaseAnchor, savedIngredients);
    }

    for (let i = 0; i < data.steps.length; i++) {
      await stepRepo.save(
        stepRepo.create({
          recipeId: recipe.id,
          stepNumber: i + 1,
          description: data.steps[i],
        }),
      );
    }

    inserted++;
  }

  console.log(`[seed:scaling-profile-recipes] inserted=${inserted} skipped=${skipped}`);
}
