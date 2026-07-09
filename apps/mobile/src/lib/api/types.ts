/**
 * Precision Kitchen — 前端数据契约（TypeScript）
 *
 * 复制自 docs/data-contract.ts（对应 docs/data-contract.md）。
 * 在 Step 11 抽取 packages/core 之前，这里是手动同步的副本——
 * 后端契约变更时需要同步更新本文件。
 *
 * 依据 main 全量后端代码反推，供前端直接 import。
 * 所有路径带全局前缀 `/api`。
 *
 * ⚠️ Decimal 字段以 string 返回（TypeORM）：amount / scaleFactor /
 *    percentageValue / ratioValue 是 string，需 parseFloat。
 *    例外：缩放结果里的 originalAmount / scaledAmount 已是 number。
 */

// ─── 0. 全局响应包裹 ────────────────────────────────────────────

export interface ApiResponse<T> {
  code: number; // 成功恒为 200
  message: string; // 成功恒为 'success'
  data: T;
  timestamp: string; // ISO
}

export interface ApiError {
  code: number; // HTTP 状态码
  message: string;
  errors?: string[]; // 校验多条错误时
  path: string; // 如 /api/recipes/xxx/scale
  timestamp: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── 1. 枚举 / 联合类型 ─────────────────────────────────────────

export type ScalingProfile =
  | 'linear_legacy'
  | 'bakers_percentage'
  | 'ratio_based'
  | 'multi_ratio';

export type ScalingRole = 'anchor' | 'percentage' | 'ratio_linked' | 'fixed';
export type ScaleType = 'linear' | 'sub_linear' | 'fixed';
export type RecipeType = 'simple' | 'composite';
export type RecipeStatus = 'draft' | 'published' | 'archived';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type UserRole = 'user' | 'vip';

/** §4.1.5 非线性修正规则（jsonb） */
export interface ScalingCorrection {
  type: 'step';
  rules: Array<{ above_factor: number; multiply: number }>;
}

/**
 * 基准锚点定义（jsonb，随 profile 而变，字段均可选）。
 * multi_ratio 的 percentBase：作者指定 percentage 原料的基准，与 scale 请求体的
 * PercentBase 同构 —— { group } 为组内成员用量之和，{ id } 为单个 ingredient 的用量
 * （如奶茶：糖按热水）。前端读取此字段构造 scale 请求，不再自行猜测/硬编码基准。
 */
export interface BaseAnchor {
  anchorIngredientId?: string | number;
  anchorIs?: string;
  ratio?: Record<string, number>;
  ratios?: Record<string, string | number>;
  locked?: string;
  percentBase?: PercentBase;
}

// ─── 2. 实体 ───────────────────────────────────────────────────

export interface RecipeIngredient {
  id: number;
  recipeId: string;
  ingredientId: number | null;
  customName: string | null;
  amount: string; // decimal → string
  unit: string;
  scaleType: ScaleType; // 默认 'linear'（仅 legacy）
  scaleFactor: string; // decimal → string，默认 '0.70'
  groupName: string | null; // 展示分组
  scalingRole: ScalingRole | null; // 新 profile 用；legacy 行为 null
  percentageValue: string | null; // decimal → string
  ratioGroup: string | null;
  ratioValue: string | null; // decimal → string
  correction: ScalingCorrection | null;
  roundDp: number | null; // 取整小数位（0/1/2）；null 走默认
  notes: string | null;
  sort: number;
  /** 仅 GET /recipes/:id 详情注入（customName 或公共食材名） */
  name?: string | null;
}

export interface RecipeStep {
  id: number;
  recipeId: string;
  stepNumber: number;
  description: string;
  imageUrl: string | null;
  durationSeconds: number | null;
  tips: string | null;
}

export interface RecipeAuthor {
  id: string;
  nickname: string;
  avatar: string | null;
}

export interface RecipeCategoryRef {
  id: number;
  name: string;
}

/** Recipe 实体全字段。ingredients/steps 仅在详情出现。 */
export interface Recipe {
  id: string;
  authorId: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  categoryId: number | null;
  mealSceneId: number | null;
  baseServings: number;
  scalingProfile: ScalingProfile; // 默认 'linear_legacy'
  baseAnchor: BaseAnchor | null;
  recipeType: RecipeType; // 默认 'simple'
  difficulty: Difficulty;
  totalMinutes: number | null;
  status: RecipeStatus;
  tags: string[];
  isPublic: boolean;
  isFeatured: boolean;
  viewCount: number;
  versionCount: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  ingredients?: RecipeIngredient[]; // 仅详情
  steps?: RecipeStep[]; // 仅详情
}

/** 列表 item / 详情共有的 enrich 字段 */
export interface RecipeEnriched extends Recipe {
  author: RecipeAuthor | null;
  categories: RecipeCategoryRef[];
  categoryIds: number[];
}

/** GET /recipes 列表 item：无 ingredients/steps */
export type RecipeListItem = Omit<RecipeEnriched, 'ingredients' | 'steps'>;

/** GET /recipes/:id 详情：含 ingredients（带 name）+ steps */
export interface RecipeDetail extends RecipeEnriched {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

// ─── 3. POST /recipes/:id/scale — 请求体（按 profile 判别） ──────

export interface BakersLock {
  mode: 'anchor' | 'total';
  value: number; // > 0
}
export interface RatioLock {
  id: number; // recipe_ingredient.id
  value: number; // > 0
}
export interface MultiRatioGroupLock {
  group: string;
  lockedId?: number; // 与 lockedValue 配对
  lockedValue?: number; // > 0
  total?: number; // 或锁整组总量，> 0
}
export type PercentBase = { group: string } | { id: number };
export interface MultiRatioBody {
  groups: MultiRatioGroupLock[]; // 至少 1 组
  percentBase?: PercentBase; // 有 percentage 料时必给
}

export type ScaleRequest =
  | { profile: 'linear_legacy'; multiplier: number }
  | { profile: 'bakers_percentage'; bakersLock: BakersLock }
  | { profile: 'ratio_based'; ratioLock: RatioLock }
  | { profile: 'multi_ratio'; multiRatio: MultiRatioBody };

/** POST /recipes/:id/scale 响应（data） */
export interface SpecScaledIngredient {
  id: number;
  ingredientId: number | null;
  customName: string | null;
  groupName: string | null;
  unit: string;
  scalingRole: ScalingRole | null;
  originalAmount: number; // number（已解析）
  scaledAmount: number; // number
}
export interface SpecScaleResult {
  recipeId: string;
  title: string;
  scalingProfile: ScalingProfile;
  ingredients: SpecScaledIngredient[];
}

// ─── 4. GET /recipes/:id/scale?servings=N — 响应（data） ─────────

export interface ScaledIngredientItem {
  id: number;
  ingredientId: number | null;
  customName: string | null;
  groupName: string | null;
  unit: string;
  originalAmount: number; // number
  scaledAmount: number; // number
  scaleType: ScaleType;
  scaleFactor: number; // number
  notes: string | null;
  sort: number;
}
export interface ScaleResult {
  recipeId: string;
  title: string;
  baseServings: number;
  targetServings: number;
  multiplier: number;
  ingredients: ScaledIngredientItem[];
}

// ─── 5. Auth ───────────────────────────────────────────────────

/** POST /auth/mock-login（dev） */
export interface MockLoginRequest {
  code?: string; // 默 'dev'
  nickname?: string;
  avatar?: string;
}

/** POST /auth/login（通用） */
export interface LoginRequest {
  provider: 'wechat' | 'apple' | 'google' | 'mock';
  code: string;
  nickname?: string;
  avatar?: string;
}

/** login / mock-login 响应（data） */
export interface LoginResult {
  token: string;
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
    role: UserRole;
  };
}

/** GET /auth/whoami 响应（data）— JWT payload */
export interface WhoAmI {
  sub: string;
  openid?: string;
  role: UserRole;
}

// ─── 5.5 AI 智能导入（data-contract §8）────────────────────────────

export type ParseConfidence = 'high' | 'medium' | 'low';

/**
 * 解析/创建共用的 percentBase 形态：保存前没有 DB id，用 ingredients 数组下标，
 * 服务端插入后重映射为真实 id。与 §3 scale 请求体的 PercentBase（{id}|{group}）不同构。
 */
export type ParsedPercentBase = { ingredientIndex: number } | { group: string };

export interface ParsedBaseAnchor {
  percentBase: ParsedPercentBase;
}

/** 解析草稿的原料：amount 为 number（非实体的 decimal 字符串），数值已由服务端重算 */
export interface ParsedIngredient {
  name: string;
  amount: number;
  unit: string;
  groupName: string;
  scaleType: ScaleType;
  scalingRole: ScalingRole | null;
  percentageValue: number | null;
  ratioGroup: string | null;
  ratioValue: number | null;
}

export interface ParsedStep {
  stepNumber: number;
  description: string;
  durationSeconds: number | null;
}

export interface ParsedRecipe {
  title: string;
  description: string; // 恒 string（缺失时后端置 ''）
  cookTime?: string; // 如 "180min"；不在 CreateRecipeRequest，保存时丢弃
  totalMinutes?: number;
  baseServings: number;
  difficulty: Difficulty;
  scalingProfile: ScalingProfile; // 恒在；分类不自洽时后端已降级 linear_legacy
  baseAnchor: ParsedBaseAnchor | null; // 仅 multi_ratio 有 percentage 料时非 null
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
}

/** POST /recipes/parse-text 响应（data）。草稿不入库，确认后另行 POST /recipes。 */
export interface ParseTextResult {
  parsed: boolean;
  confidence: ParseConfidence;
  warnings: string[]; // 恒在；干净时 []；服务端中文文案
  originalText: string;
  recipe: ParsedRecipe;
}

// ─── 5.6 创建配方（POST /recipes，CreateRecipeDto 镜像）───────────

export interface CreateRecipeIngredient {
  ingredientId?: number;
  customName?: string; // 解析草稿的 name 映射到这里
  amount: number; // 最多 2 位小数（服务端校验）
  unit: string;
  scaleType?: ScaleType;
  scaleFactor?: number;
  groupName?: string;
  notes?: string;
  sort?: number;
  scalingRole?: ScalingRole;
  percentageValue?: number; // 最多 3 位小数
  ratioGroup?: string;
  ratioValue?: number; // 最多 3 位小数
  roundDp?: number; // 0/1/2
}

export interface CreateRecipeStep {
  stepNumber: number;
  description: string;
  imageUrl?: string;
  durationSeconds?: number;
  tips?: string;
}

export interface CreateRecipeRequest {
  title: string;
  description?: string;
  coverImage?: string;
  categoryId?: number;
  categoryIds?: number[];
  mealSceneId?: number;
  baseServings?: number;
  difficulty?: Difficulty;
  totalMinutes?: number;
  status?: RecipeStatus;
  isPublic?: boolean;
  tags?: string[];
  scalingProfile?: ScalingProfile;
  /** percentBase 用 {ingredientIndex}（服务端重映射）或 {group}；缩放结构不自洽 → 400 */
  baseAnchor?: { percentBase?: ParsedPercentBase };
  ingredients: CreateRecipeIngredient[];
  steps: CreateRecipeStep[];
}

// ─── 6. Timers（server/src/modules/timers，未见于 data-contract.md，按源码反推）──

export type TimerStatus = 'running' | 'paused' | 'finished';

/** POST /timers 请求体 */
export interface CreateTimerRequest {
  label: string; // 最长 64
  durationSeconds: number; // 1..21600（6 小时）
  recipeId?: string; // uuid，关联菜谱
  stepNumber?: number; // 关联步骤号
}

/** timers 各接口响应（data）共用形状 */
export interface TimerView {
  id: string;
  userId: string;
  label: string;
  durationSeconds: number;
  startedAt: number; // epoch ms
  pausedAt: number | null; // epoch ms
  accumulatedPauseMs: number;
  status: TimerStatus;
  recipeId: string | null;
  stepNumber: number | null;
  elapsedSeconds: number; // 服务端每次读取时现算
  remainingSeconds: number; // 服务端每次读取时现算
  serverTime: number; // epoch ms，用于客户端时钟校准
}
