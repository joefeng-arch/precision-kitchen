import { DataSource } from 'typeorm';
import { Category } from '../../modules/categories/entities/category.entity';
import { Recipe } from '../../modules/recipes/entities/recipe.entity';
import { RecipeCategory } from '../../modules/recipes/entities/recipe-category.entity';
import { RecipeIngredient } from '../../modules/recipes/entities/recipe-ingredient.entity';
import { RecipeStep } from '../../modules/recipes/entities/recipe-step.entity';
import { User } from '../../modules/users/entities/user.entity';
import { collectScalingErrors } from '../../modules/recipes/parse-scaling-validator';
import { OFFICIAL_AUTHOR_NICKNAME } from '../../common/constants/official-author';
import type {
  ScalingCorrection,
  ScalingProfile,
  ScalingRole,
} from '../../common/utils/scaling-engine';

/**
 * 海外官方配方 seed（内容源：docs/official-seed-recipes-batch1.md）。
 * 结构 = scaling-profile seed 的缩放形状 ∪ recipes.seed 的富元数据；
 * 每条 def 插入前过 validateSeedRecipeDef（collectScalingErrors 复用）——
 * 内容有误时 seed 响亮失败，脏数据进不了库。
 */

export interface SeedIngredient {
  customName: string;
  amount: string;
  unit: string;
  scaleType?: 'linear' | 'sub_linear' | 'fixed';
  groupName?: string;
  notes?: string;
  scalingRole?: ScalingRole;
  percentageValue?: string;
  ratioGroup?: string;
  ratioValue?: string;
  roundDp?: number;
  /** 非线性修正（盐/酵母/泡打粉大倍数缩放时打折），jsonb 原样落库 */
  correction?: ScalingCorrection;
}

export interface SeedStep {
  description: string;
  durationSeconds?: number;
  tips?: string;
  warning?: string;
}

export interface SeedRecipe {
  title: string;
  description: string;
  scalingProfile: ScalingProfile;
  baseServings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  totalMinutes: number;
  tags: string[];
  coverImage?: string;
  /** 英文 recipe 分类名（本 seed 会 add-only 预置 Baking/Coffee/Drinks） */
  category?: string;
  /** multi_ratio：percentBase 指向的原料 customName，插入后解析为 baseAnchor.percentBase.id */
  percentBaseAnchor?: string;
  ingredients: SeedIngredient[];
  steps: SeedStep[];
}

/** 本 seed 预置的英文 recipe 分类（add-only，幂等，负 sort 排最前） */
export const OVERSEAS_RECIPE_CATEGORIES = ['Baking', 'Coffee', 'Drinks'] as const;

const SALT_CORRECTION: ScalingCorrection = {
  type: 'step',
  rules: [{ above_factor: 4, multiply: 0.75 }],
};
const YEAST_CORRECTION: ScalingCorrection = {
  type: 'step',
  rules: [{ above_factor: 3, multiply: 0.75 }],
};

export const RECIPES: SeedRecipe[] = [
  // ─── BAKING (bakers_percentage) ────────────────────────────────
  {
    title: 'Basic White Sandwich Loaf',
    description: 'The everyday loaf: soft crumb, golden crust, forgiving for beginners.',
    scalingProfile: 'bakers_percentage',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 220,
    tags: ['bread', 'loaf'],
    category: 'Baking',
    ingredients: [
      { customName: 'Bread flour', amount: '500', unit: 'g', scalingRole: 'anchor', percentageValue: '100' },
      { customName: 'Water (lukewarm)', amount: '325', unit: 'g', scalingRole: 'percentage', percentageValue: '65' },
      { customName: 'Sugar', amount: '30', unit: 'g', scalingRole: 'percentage', percentageValue: '6' },
      { customName: 'Unsalted butter (softened)', amount: '30', unit: 'g', scalingRole: 'percentage', percentageValue: '6' },
      { customName: 'Salt', amount: '10', unit: 'g', scalingRole: 'percentage', percentageValue: '2', correction: SALT_CORRECTION },
      { customName: 'Instant yeast', amount: '5', unit: 'g', scalingRole: 'percentage', percentageValue: '1', correction: YEAST_CORRECTION },
    ],
    steps: [
      {
        description: 'Mix flour, sugar, yeast; add water and knead 8 min until shaggy.',
        tips: 'hold back 20g water, add if dry',
        warning: 'Water must be below 40°C / 104°F — hotter water kills the yeast',
      },
      {
        description: 'Add salt and butter; knead 10 min to windowpane stage.',
        durationSeconds: 600,
        tips: 'dough should stretch thin without tearing',
      },
      {
        description: 'Bulk ferment covered until doubled.',
        durationSeconds: 3600,
        tips: '~1h at 26°C; longer if cooler',
      },
      {
        description: 'Punch down, shape into loaf, place in greased tin; proof until 1cm above rim.',
        durationSeconds: 2700,
      },
      {
        description: 'Bake at 180°C / 356°F for 30–35 min.',
        durationSeconds: 2100,
        warning: 'Do not open the oven during the first 20 minutes — the loaf will collapse',
      },
      {
        description: 'Turn out and cool on a rack ≥1h before slicing.',
        durationSeconds: 3600,
        tips: 'slicing warm ruins the crumb',
      },
    ],
  },
  {
    title: 'Rustic Baguette',
    description: 'Lean dough, cold retard, open crumb — the weekend project baguette.',
    scalingProfile: 'bakers_percentage',
    baseServings: 1,
    difficulty: 'hard',
    totalMinutes: 930,
    tags: ['bread', 'baguette', 'advanced'],
    category: 'Baking',
    ingredients: [
      { customName: 'Bread flour', amount: '500', unit: 'g', scalingRole: 'anchor', percentageValue: '100' },
      { customName: 'Water', amount: '360', unit: 'g', scalingRole: 'percentage', percentageValue: '72' },
      { customName: 'Salt', amount: '10', unit: 'g', scalingRole: 'percentage', percentageValue: '2', correction: SALT_CORRECTION },
      { customName: 'Instant yeast', amount: '3', unit: 'g', scalingRole: 'percentage', percentageValue: '0.6', correction: YEAST_CORRECTION },
    ],
    steps: [
      { description: 'Mix all to a rough dough; rest 30 min (autolyse+).', durationSeconds: 1800 },
      {
        description: '3 sets of stretch-and-folds, 30 min apart.',
        durationSeconds: 5400,
        tips: 'wet hands prevent sticking',
      },
      {
        description: 'Cold retard in fridge 12–16h.',
        durationSeconds: 43200,
        tips: 'flavor develops overnight',
      },
      {
        description: 'Divide, pre-shape, rest 20 min, shape into baguettes.',
        durationSeconds: 1200,
        warning: 'Handle gently — degassing now destroys the open crumb',
      },
      { description: 'Proof 45 min; score 3–4 cuts.', durationSeconds: 2700 },
      {
        description: 'Bake at 240°C / 464°F with steam, 22–25 min.',
        durationSeconds: 1500,
        tips: 'a tray of boiling water on the oven floor works as steam',
      },
    ],
  },
  {
    title: 'Classic Cream Scones',
    description: 'Flaky, buttery scones in under an hour — cold butter is the whole game.',
    scalingProfile: 'bakers_percentage',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 45,
    tags: ['scones', 'quick'],
    category: 'Baking',
    ingredients: [
      { customName: 'All-purpose flour', amount: '250', unit: 'g', scalingRole: 'anchor', percentageValue: '100' },
      { customName: 'Cold unsalted butter (cubed)', amount: '62', unit: 'g', scalingRole: 'percentage', percentageValue: '25' },
      { customName: 'Sugar', amount: '38', unit: 'g', scalingRole: 'percentage', percentageValue: '15' },
      { customName: 'Baking powder', amount: '12', unit: 'g', scalingRole: 'percentage', percentageValue: '5', correction: YEAST_CORRECTION },
      { customName: 'Salt', amount: '3', unit: 'g', scalingRole: 'percentage', percentageValue: '1.2' },
      { customName: 'Cold milk', amount: '125', unit: 'g', scalingRole: 'percentage', percentageValue: '50' },
    ],
    steps: [
      {
        description: 'Rub cold butter into dry mix until pea-sized bits remain.',
        warning: 'Keep the butter cold — melted butter makes dense, greasy scones',
      },
      {
        description: 'Add milk; fold just until it holds together.',
        warning: 'Do not overwork the dough — overmixing makes scones tough, not flaky',
      },
      { description: 'Pat 3cm thick, cut rounds, chill 15 min.', durationSeconds: 900 },
      { description: 'Bake at 200°C / 392°F for 14–16 min until golden.', durationSeconds: 960 },
    ],
  },
  {
    title: 'Fudgy Brownies',
    description: 'Dense, glossy-topped brownies — pull them early, always.',
    scalingProfile: 'bakers_percentage',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 45,
    tags: ['brownies', 'chocolate'],
    category: 'Baking',
    ingredients: [
      { customName: 'All-purpose flour', amount: '125', unit: 'g', scalingRole: 'anchor', percentageValue: '100' },
      { customName: 'Dark chocolate (70%)', amount: '150', unit: 'g', scalingRole: 'percentage', percentageValue: '120' },
      { customName: 'Unsalted butter', amount: '175', unit: 'g', scalingRole: 'percentage', percentageValue: '140' },
      { customName: 'Sugar', amount: '250', unit: 'g', scalingRole: 'percentage', percentageValue: '200' },
      { customName: 'Eggs', amount: '150', unit: 'g', scalingRole: 'percentage', percentageValue: '120' },
      { customName: 'Cocoa powder', amount: '30', unit: 'g', scalingRole: 'percentage', percentageValue: '24' },
      { customName: 'Salt', amount: '3', unit: 'g', scalingRole: 'percentage', percentageValue: '2.4' },
    ],
    steps: [
      {
        description: 'Melt chocolate and butter together over low heat; cool 5 min.',
        durationSeconds: 300,
        warning: 'Chocolate scorches above 50°C / 122°F — melt low and slow',
      },
      {
        description: 'Whisk eggs and sugar 2 min until pale; stream in chocolate.',
        durationSeconds: 120,
      },
      { description: 'Fold in flour, cocoa, salt just until no dry streaks.' },
      {
        description: 'Bake at 175°C / 347°F for 22–25 min.',
        durationSeconds: 1440,
        warning: 'Pull them while the center still looks slightly underdone — overbaking kills the fudgy texture',
        tips: 'a tester should come out with moist crumbs, not clean',
      },
    ],
  },

  // ─── COFFEE (ratio_based) ──────────────────────────────────────
  {
    title: 'V60 Pour Over',
    description: 'The 1:15 benchmark cup — clean, bright, repeatable.',
    scalingProfile: 'ratio_based',
    baseServings: 1,
    difficulty: 'medium',
    totalMinutes: 10,
    tags: ['pour over', 'v60'],
    category: 'Coffee',
    ingredients: [
      { customName: 'Coffee (medium-fine grind)', amount: '20', unit: 'g', scalingRole: 'anchor', ratioValue: '1' },
      { customName: 'Water (92–96°C)', amount: '300', unit: 'g', scalingRole: 'ratio_linked', ratioValue: '15' },
    ],
    steps: [
      {
        description: 'Rinse filter with hot water; discard rinse water.',
        tips: 'removes paper taste, preheats brewer',
      },
      {
        description: 'Bloom: pour 40–50g water over grounds.',
        durationSeconds: 45,
        tips: 'grounds should bubble and swell',
      },
      { description: 'First pour to 150g in slow spirals.', durationSeconds: 30 },
      {
        description: 'Second pour to 300g total.',
        durationSeconds: 30,
        warning: 'Water above 96°C / 205°F scorches the grounds and turns the cup bitter',
      },
      {
        description: 'Drawdown should finish around 2:30–3:00 total.',
        durationSeconds: 75,
        tips: 'too fast = grind finer, too slow = grind coarser',
      },
    ],
  },
  {
    title: 'French Press',
    description: 'Full-bodied immersion brew at 1:12 — four minutes, no fuss.',
    scalingProfile: 'ratio_based',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 8,
    tags: ['french press', 'immersion'],
    category: 'Coffee',
    ingredients: [
      { customName: 'Coffee (coarse grind)', amount: '30', unit: 'g', scalingRole: 'anchor', ratioValue: '1' },
      { customName: 'Water (93–96°C)', amount: '360', unit: 'g', scalingRole: 'ratio_linked', ratioValue: '12' },
    ],
    steps: [
      { description: 'Add coffee, pour all water, stir once gently.', durationSeconds: 30 },
      {
        description: 'Lid on, plunger up; steep 4 minutes.',
        durationSeconds: 240,
        warning: 'Do not press early — under-steeped coffee is sour and thin',
      },
      {
        description: 'Press slowly and evenly.',
        durationSeconds: 20,
        tips: 'hard pressing forces bitter fines through',
      },
      {
        description: 'Pour immediately into cups.',
        tips: 'coffee left on the grounds keeps extracting and turns bitter',
      },
    ],
  },
  {
    title: 'Cold Brew Concentrate',
    description: 'Overnight 1:8 concentrate — smooth, low-acid, keeps a week.',
    scalingProfile: 'ratio_based',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 960,
    tags: ['cold brew', 'concentrate'],
    category: 'Coffee',
    ingredients: [
      { customName: 'Coffee (coarse grind)', amount: '100', unit: 'g', scalingRole: 'anchor', ratioValue: '1' },
      { customName: 'Cold filtered water', amount: '800', unit: 'g', scalingRole: 'ratio_linked', ratioValue: '8' },
    ],
    steps: [
      { description: 'Combine coffee and water in a jar; stir so all grounds are wet.' },
      {
        description: 'Steep in fridge 12–18 hours.',
        durationSeconds: 57600,
        warning: 'Past 24 hours it turns woody and over-extracted',
      },
      { description: 'Strain through a fine filter twice.', tips: 'paper filter for a cleaner cup' },
      {
        description: 'Dilute 1:1 with water or milk to serve.',
        tips: 'keeps 1 week refrigerated',
      },
    ],
  },

  // ─── DRINKS (multi_ratio) ──────────────────────────────────────
  {
    title: 'Negroni',
    description: 'Equal parts, no debate: gin, Campari, sweet vermouth.',
    scalingProfile: 'multi_ratio',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 3,
    tags: ['cocktail', 'stirred'],
    category: 'Drinks',
    ingredients: [
      { customName: 'Gin', amount: '30', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'spirits', ratioValue: '1' },
      { customName: 'Campari', amount: '30', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'spirits', ratioValue: '1' },
      { customName: 'Sweet vermouth', amount: '30', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'spirits', ratioValue: '1' },
    ],
    steps: [
      {
        description: 'Add all to a mixing glass with ice; stir 20–30s.',
        durationSeconds: 25,
        warning: "Stir, don't shake — shaking clouds the drink and over-dilutes",
      },
      {
        description: 'Strain over a large ice cube; garnish with an orange peel.',
        tips: 'express the peel oils over the surface first',
      },
    ],
  },
  {
    title: 'Margarita (3-2-1)',
    description: 'Tequila, triple sec, fresh lime — 3:2:1 and nothing else.',
    scalingProfile: 'multi_ratio',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 5,
    tags: ['cocktail', 'shaken'],
    category: 'Drinks',
    ingredients: [
      { customName: 'Tequila blanco', amount: '45', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'mix', ratioValue: '3' },
      { customName: 'Triple sec', amount: '30', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'mix', ratioValue: '2' },
      { customName: 'Fresh lime juice', amount: '15', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'mix', ratioValue: '1' },
    ],
    steps: [
      {
        description: 'Shake all with ice, hard, 12–15s.',
        durationSeconds: 15,
        warning: 'Bottled lime juice ruins this drink — fresh only',
      },
      {
        description: 'Strain into a salt-rimmed glass over fresh ice.',
        tips: 'rim only half the glass so the drinker can choose',
      },
    ],
  },
  {
    title: 'Classic Milk Tea',
    description: 'Tea to water 1:12, sugar and milk dosed off the water — scales cleanly.',
    scalingProfile: 'multi_ratio',
    baseServings: 1,
    difficulty: 'easy',
    totalMinutes: 10,
    tags: ['milk tea'],
    category: 'Drinks',
    percentBaseAnchor: 'Hot water (95°C)',
    ingredients: [
      { customName: 'Black tea leaves', amount: '10', unit: 'g', scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: '1' },
      { customName: 'Hot water (95°C)', amount: '120', unit: 'g', scalingRole: 'ratio_linked', ratioGroup: 'tea_base', ratioValue: '12' },
      { customName: 'Sugar', amount: '9.6', unit: 'g', scalingRole: 'percentage', percentageValue: '8' },
      { customName: 'Whole milk', amount: '36', unit: 'g', scalingRole: 'percentage', percentageValue: '30' },
    ],
    steps: [
      {
        description: 'Steep tea in hot water 4–5 min, covered.',
        durationSeconds: 270,
        warning: 'Steeping past 6 minutes turns the base harshly bitter',
      },
      { description: 'Strain out leaves; stir sugar in while hot.' },
      {
        description: 'Add milk; serve hot or over ice.',
        tips: 'warm the milk first for a smoother hot version',
      },
    ],
  },
  {
    title: 'Espresso Martini',
    description: '5:2:3 vodka, coffee liqueur, fresh espresso — plus a fixed touch of syrup.',
    scalingProfile: 'multi_ratio',
    baseServings: 1,
    difficulty: 'medium',
    totalMinutes: 5,
    tags: ['cocktail', 'espresso'],
    category: 'Drinks',
    ingredients: [
      { customName: 'Vodka', amount: '50', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'mix', ratioValue: '5' },
      { customName: 'Coffee liqueur', amount: '20', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'mix', ratioValue: '2' },
      { customName: 'Fresh espresso (hot)', amount: '30', unit: 'ml', scalingRole: 'ratio_linked', ratioGroup: 'mix', ratioValue: '3' },
      { customName: 'Sugar syrup', amount: '10', unit: 'ml', scalingRole: 'fixed' },
    ],
    steps: [
      {
        description: 'Pull the espresso last — it must be fresh and hot when it hits the shaker.',
        warning: "Stale espresso won't foam — the signature crema layer depends on fresh crema",
      },
      {
        description: 'Shake everything with ice, very hard, 15s.',
        durationSeconds: 15,
        tips: 'hard shake builds the foam',
      },
      { description: 'Double-strain into a chilled coupe; garnish 3 coffee beans.' },
    ],
  },
];

/**
 * 内容门禁：结构 + 缩放一致性（collectScalingErrors 复用）。
 * seed 运行前对每条 def 调用，非空即 throw——贴错内容响亮失败。
 */
export function validateSeedRecipeDef(def: SeedRecipe): string[] {
  const errors: string[] = [];

  let percentBase: { ingredientIndex: number } | null = null;
  if (def.percentBaseAnchor != null) {
    const idx = def.ingredients.findIndex((i) => i.customName === def.percentBaseAnchor);
    if (idx === -1) {
      errors.push(
        `percentBaseAnchor "${def.percentBaseAnchor}" does not match any ingredient customName`,
      );
    } else {
      percentBase = { ingredientIndex: idx };
    }
  }

  errors.push(
    ...collectScalingErrors(
      def.scalingProfile,
      def.ingredients.map((i) => ({
        scalingRole: i.scalingRole ?? null,
        percentageValue: i.percentageValue != null ? Number(i.percentageValue) : null,
        ratioGroup: i.ratioGroup ?? null,
        ratioValue: i.ratioValue != null ? Number(i.ratioValue) : null,
        amount: parseFloat(i.amount),
      })),
      percentBase,
    ),
  );

  return errors;
}

async function ensureSeedAuthor(ds: DataSource): Promise<string> {
  const userRepo = ds.getRepository(User);
  const user = await userRepo
    .createQueryBuilder('u')
    .where('u.openid IS NULL')
    .andWhere('u.nickname = :name', { name: OFFICIAL_AUTHOR_NICKNAME })
    .getOne();
  if (user) return user.id;
  const created = await userRepo.save(
    userRepo.create({ openid: null, nickname: OFFICIAL_AUTHOR_NICKNAME, role: 'user' }),
  );
  return created.id;
}

async function ensureRecipeCategories(ds: DataSource): Promise<Map<string, number>> {
  const repo = ds.getRepository(Category);
  const map = new Map<string, number>();
  for (let i = 0; i < OVERSEAS_RECIPE_CATEGORIES.length; i++) {
    const name = OVERSEAS_RECIPE_CATEGORIES[i];
    let cat = await repo.findOne({ where: { type: 'recipe', name } });
    if (!cat) {
      cat = await repo.save(repo.create({ type: 'recipe', name, sort: -30 + i * 10 }));
    }
    map.set(name, cat.id);
  }
  return map;
}

export async function seedOverseasOfficialRecipes(ds: DataSource): Promise<void> {
  // 先全量校验：任何一条不自洽都不落库
  for (const def of RECIPES) {
    const errors = validateSeedRecipeDef(def);
    if (errors.length > 0) {
      throw new Error(
        `[seed:overseas-official-recipes] "${def.title}" failed validation: ${errors.join('; ')}`,
      );
    }
  }

  const recipeRepo = ds.getRepository(Recipe);
  const riRepo = ds.getRepository(RecipeIngredient);
  const stepRepo = ds.getRepository(RecipeStep);
  const rcRepo = ds.getRepository(RecipeCategory);

  const authorId = await ensureSeedAuthor(ds);
  const catByName = await ensureRecipeCategories(ds);

  let inserted = 0;
  let skipped = 0;

  for (const def of RECIPES) {
    const exists = await recipeRepo.findOne({ where: { title: def.title, authorId } });
    if (exists) {
      skipped++;
      // skip 重跑时补挂 percentBase 锚（幂等修复，同 scaling-profile seed）
      if (def.percentBaseAnchor) {
        const existingIngs = await riRepo.find({ where: { recipeId: exists.id } });
        const anchor = existingIngs.find((i) => i.customName === def.percentBaseAnchor);
        if (anchor) {
          await recipeRepo.update(exists.id, { baseAnchor: { percentBase: { id: anchor.id } } });
        }
      }
      continue;
    }

    const categoryId = def.category ? (catByName.get(def.category) ?? null) : null;

    const recipe = await recipeRepo.save(
      recipeRepo.create({
        authorId,
        title: def.title,
        description: def.description,
        coverImage: def.coverImage ?? null,
        categoryId,
        baseServings: def.baseServings,
        scalingProfile: def.scalingProfile,
        difficulty: def.difficulty,
        totalMinutes: def.totalMinutes,
        tags: def.tags,
        status: 'published',
        isPublic: true,
        isFeatured: true,
        versionCount: 1,
      }),
    );

    const savedIngs: RecipeIngredient[] = [];
    for (let i = 0; i < def.ingredients.length; i++) {
      const item = def.ingredients[i];
      savedIngs.push(
        await riRepo.save(
          riRepo.create({
            recipeId: recipe.id,
            ingredientId: null,
            customName: item.customName,
            amount: item.amount,
            unit: item.unit,
            scaleType: item.scaleType ?? 'linear',
            scaleFactor: '0.70',
            groupName: item.groupName ?? null,
            notes: item.notes ?? null,
            sort: i * 10,
            scalingRole: item.scalingRole ?? null,
            percentageValue: item.percentageValue ?? null,
            ratioGroup: item.ratioGroup ?? null,
            ratioValue: item.ratioValue ?? null,
            roundDp: item.roundDp ?? null,
            correction: item.correction ?? null,
          }),
        ),
      );
    }

    if (def.percentBaseAnchor) {
      const anchor = savedIngs.find((i) => i.customName === def.percentBaseAnchor);
      if (anchor) {
        await recipeRepo.update(recipe.id, { baseAnchor: { percentBase: { id: anchor.id } } });
      }
    }

    for (let i = 0; i < def.steps.length; i++) {
      const step = def.steps[i];
      await stepRepo.save(
        stepRepo.create({
          recipeId: recipe.id,
          stepNumber: i + 1,
          description: step.description,
          imageUrl: null,
          durationSeconds: step.durationSeconds ?? null,
          tips: step.tips ?? null,
          warning: step.warning ?? null,
        }),
      );
    }

    if (categoryId != null) {
      await rcRepo.save(rcRepo.create({ recipeId: recipe.id, categoryId }));
    }

    inserted++;
  }

  console.log(`[seed:overseas-official-recipes] inserted=${inserted} skipped=${skipped}`);
}
