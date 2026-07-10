import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  PARSE_MONTHLY_LIMIT,
  PARSE_QUOTA_TTL_MS,
  parseQuotaKey,
} from '../../common/constants/tier-limits';
import type { UserRole } from '../users/entities/user.entity';
import type { ScalingProfile, ScalingRole } from '../../common/utils/scaling-engine';
import { ParsedPercentBase, validateAndRecomputeScaling } from './parse-scaling-validator';

export interface ParsedIngredient {
  name: string;
  amount: number;
  unit: string;
  groupName: string;
  scaleType: string;
  /** 缩放字段：linear_legacy 下全为 null；数值由服务端从 amount 重算，非 AI 输出 */
  scalingRole: ScalingRole | null;
  percentageValue: number | null;
  ratioGroup: string | null;
  ratioValue: number | null;
}

export interface ParsedStep {
  stepNumber: number;
  description: string;
  durationSeconds: number | null;
  /** 失败关键提醒（违反即失败），与结果级 warnings[]（缩放纠偏说明）无关 */
  warning: string | null;
}

export interface ParsedRecipe {
  title: string;
  description: string;
  cookTime?: string;
  difficulty: string;
  totalMinutes?: number;
  baseServings: number;
  scalingProfile: ScalingProfile;
  /** percentBase 以 ingredients 数组下标指代（保存前无 DB id），保存时由服务端重映射 */
  baseAnchor: { percentBase: ParsedPercentBase } | null;
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
}

export interface ParseTextResult {
  parsed: boolean;
  confidence: 'high' | 'medium' | 'low';
  recipe: ParsedRecipe;
  /** 缩放分类的纠偏/降级说明（确认页展示）；干净时为 [] */
  warnings: string[];
  originalText: string;
}

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;

const SYSTEM_PROMPT = `你是一个专业的厨师助手，擅长从非结构化的菜谱文本中提取结构化信息，并判断配方的缩放模式。
输入可能是中文、英文或中英混合；title、食材 name 保留原文语言，枚举字段一律使用下方规定值。

请将用户提供的菜谱文本解析为以下 JSON 格式（仅输出 JSON，不要有任何其他说明文字）：

{
  "title": "菜谱标题（字符串，必须非空）",
  "description": "菜谱简短描述（字符串，可选）",
  "totalMinutes": 30,
  "baseServings": 2,
  "difficulty": "easy",
  "scalingProfile": "linear_legacy",
  "percentBase": null,
  "ingredients": [
    {
      "name": "食材名称",
      "amount": 500,
      "unit": "g",
      "groupName": "主料",
      "scaleType": "linear",
      "scalingRole": null,
      "ratioGroup": null,
      "ratioHint": null,
      "percentHint": null
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "description": "步骤描述",
      "durationSeconds": null,
      "warning": null
    }
  ]
}

基础规则：
1. difficulty 只能是 "easy"、"medium"、"hard" 之一，默认 "medium"
2. 对于"适量"、"少许"等模糊用量：amount 填 0，unit 填 "适量"
3. groupName 根据食材角色分组：主料、调料、腌料、配料
4. scaleType：调味料/调料用 "sub_linear"，固定用量（如泡打粉）用 "fixed"，其余用 "linear"
5. steps 中有明确计时（如"炒3分钟"→180，"煮10分钟"→600）时填 durationSeconds，否则填 null
6. totalMinutes 为整个菜谱的估计烹饪总时间（分钟），没有时可不填
7. warning：仅当某步骤存在"违反即直接导致失败"的关键提醒时提取（如"前 25 分钟别开烤箱门"
   "炖煮中途别开盖""发酵期间别搅拌"），保留原文表述；普通经验技巧、口味建议不算。
   拿不准就填 null，宁缺勿滥。

缩放模式（scalingProfile）判定规则：
8. 按配方类型选择，拿不准时一律用 "linear_legacy"（宁可保守，不要乱标）：
   - "bakers_percentage"：烘焙面团类（面包/吐司/披萨/贝果/bread/dough/sourdough 等以面粉为主体）
   - "ratio_based"：两种核心原料按固定比例（手冲咖啡/pour-over、茶水比，常见 "1:15" 式表述），
     且配方中所有原料都参与该比例时才可用
   - "multi_ratio"：多组分比例饮品/调酒（奶茶/鸡尾酒），存在一组或多组"份数比"，
     可能另有按某液体量百分比投放的原料（糖/奶）
   - "linear_legacy"：普通家常菜或无明显比例结构
9. scalingRole 按 profile 填写（linear_legacy 时全部填 null）：
   - bakers_percentage：主体面粉唯一一个 "anchor"；随面粉量联动的原料 "percentage"；
     不随量的（装饰、模具用油、"适量"原料）"fixed"
   - ratio_based：比例的基准端（如咖啡粉）"anchor"，另一端 "ratio_linked"
   - multi_ratio：每个比例组的成员都填 "ratio_linked" 并给同一 ratioGroup（英文短名，如
     "tea_base"、"mix"）；按液体量百分比投放的原料填 "percentage"；不参与联动的（冰块、
     "适量"原料）填 "fixed"
10. 不要自行计算百分比或比例数值，服务器会根据 amount 重新计算。仅当文本给出了比例/百分比
   但没有给具体克数时才填提示值：
   - ratioHint：如"咖啡与水 1:15"但无克数 → 咖啡 ratioHint=1、水 ratioHint=15
   - percentHint：如"糖为水量的 10%"但无克数 → 糖 percentHint=10
11. percentBase：仅 multi_ratio 且存在 "percentage" 原料时必填，其余情况填 null。
    形如 {"ingredientIndex": 1}（ingredients 数组下标，从 0 开始，必须指向某个 ratio_linked
    原料）或 {"group": "组名"}（以该组全部成员用量之和为基准）。
    例如"糖按热水量的 10%"→ 指向"热水"的下标。
12. anchor 必须唯一。角色划分不清、找不到 anchor 时，scalingProfile 整体退回 "linear_legacy"。

示例（仅节选相关字段）：
示例1 输入：高筋面粉500g、水325g、盐10g、酵母5g …（面包做法，烘烤步骤注明
  "前 25 分钟不要开烤箱门，否则会塌陷"）
输出：scalingProfile="bakers_percentage"，percentBase=null，
  面粉 scalingRole="anchor"；水、盐、酵母 scalingRole="percentage"；
  烘烤步骤 warning="前 25 分钟不要开烤箱门，否则会塌陷"，其余步骤 warning=null
示例2 输入：咖啡粉20g，水300g，粉水比1:15 …（手冲做法）
输出：scalingProfile="ratio_based"，percentBase=null，
  咖啡粉 scalingRole="anchor"，水 scalingRole="ratio_linked"（有克数，ratioHint 不填）
示例3 输入：茶叶100g，热水400g冲泡，糖为热水量的10%（40g），珍珠适量 …
输出：scalingProfile="multi_ratio"，percentBase={"ingredientIndex":1}，
  茶叶/热水 scalingRole="ratio_linked"、ratioGroup="tea_base"；
  糖 scalingRole="percentage"；珍珠 amount=0、unit="适量"、scalingRole="fixed"`;

@Injectable()
export class RecipeParseService {
  private readonly logger = new Logger(RecipeParseService.name);

  private get apiKey(): string {
    return (
      process.env.AI_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''
    );
  }

  private get model(): string {
    return process.env.AI_MODEL ?? 'qwen-plus';
  }

  private get apiBase(): string {
    const provider = process.env.AI_PROVIDER ?? 'alibaba';
    if (provider === 'alibaba') {
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    }
    // default: openai-compatible
    return process.env.AI_API_BASE ?? 'https://api.openai.com/v1';
  }

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async parseText(
    userId: string,
    text: string,
    options?: { skipRateLimit?: boolean; tier?: UserRole },
  ): Promise<ParseTextResult> {
    if (!options?.skipRateLimit) {
      await this.checkRateLimit(userId);
      // 月度层级配额（FREE 5 / PRO 30，PRD §5.3 成本红线）；缺省按 user fail-closed
      await this.checkMonthlyQuota(userId, options?.tier ?? 'user');
    }

    if (!this.apiKey) {
      throw new BadRequestException('AI 服务未配置，请联系管理员设置 AI_API_KEY');
    }

    let rawResult: unknown;
    try {
      rawResult = await this.callAI(text);
    } catch (e: any) {
      this.logger.error(`AI call failed: ${e.message}`);
      throw new BadRequestException('AI 解析服务暂时不可用，请稍后再试');
    }

    return this.validateAndFormat(rawResult, text);
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const key = `recipe_parse_rate:${userId}`;
    const count = (await this.cache.get<number>(key)) ?? 0;
    if (count >= RATE_LIMIT) {
      throw new HttpException(
        '调用过于频繁，每分钟最多 5 次，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.cache.set(key, count + 1, RATE_WINDOW_MS);
  }

  /**
   * 月度层级配额。403（非 429——429 留给分钟限流，客户端按 code 分支 paywall/稍候）。
   * 先计数再调 AI：与分钟限流一致，防并发竞态烧钱；AI 失败也消耗 1 次。
   */
  private async checkMonthlyQuota(userId: string, tier: UserRole): Promise<void> {
    const key = parseQuotaKey(userId);
    const limit = PARSE_MONTHLY_LIMIT[tier];
    const count = (await this.cache.get<number>(key)) ?? 0;
    if (count >= limit) {
      throw new ForbiddenException(
        tier === 'vip'
          ? `本月 AI 解析已达合理使用上限（${limit} 次/月），下月自动恢复`
          : `本月 AI 解析次数已用完（免费版 ${limit} 次/月），升级 PRO 可享每月 ${PARSE_MONTHLY_LIMIT.vip} 次`,
      );
    }
    await this.cache.set(key, count + 1, PARSE_QUOTA_TTL_MS);
  }

  /** 网络调用隔离点：测试里子类覆写返回 canned JSON */
  protected async callAI(userText: string): Promise<unknown> {
    const resp = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `请解析以下菜谱文本：\n\n${userText}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`AI API responded ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await resp.json()) as any;
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    return JSON.parse(content);
  }

  private validateAndFormat(raw: unknown, originalText: string): ParseTextResult {
    const r = raw as any;
    const errors: string[] = [];

    if (!r?.title || String(r.title).trim() === '') {
      errors.push('标题不能为空');
    }
    if (!Array.isArray(r?.ingredients) || r.ingredients.length === 0) {
      errors.push('至少需要 1 个食材');
    }
    if (!Array.isArray(r?.steps) || r.steps.length === 0) {
      errors.push('至少需要 1 个步骤');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`解析结果不完整：${errors.join('；')}`);
    }

    const rawIngs = r.ingredients as any[];
    const coerced = rawIngs.map((i, idx) => {
      let amount = Number(i.amount);
      let unit = String(i.unit ?? 'g').trim();
      if (isNaN(amount) || amount < 0) amount = 0;
      if (amount === 0 && unit !== '适量') unit = '适量';
      const scaleType = ['linear', 'sub_linear', 'fixed'].includes(i.scaleType)
        ? i.scaleType
        : 'linear';
      return {
        name: String(i.name ?? `食材${idx + 1}`).trim(),
        amount,
        unit,
        groupName: String(i.groupName ?? '主料').trim(),
        scaleType,
      };
    });

    // 缩放字段：AI 只提供分类，数值由服务端从 amount 重算；不自洽则整体降级 linear_legacy
    const scaling = validateAndRecomputeScaling({
      scalingProfile: r.scalingProfile,
      percentBase: r.percentBase,
      ingredients: coerced.map((c, idx) => ({
        name: c.name,
        amount: c.amount,
        scalingRole: rawIngs[idx]?.scalingRole,
        ratioGroup: rawIngs[idx]?.ratioGroup,
        ratioHint: rawIngs[idx]?.ratioHint,
        percentHint: rawIngs[idx]?.percentHint,
      })),
    });

    const ingredients: ParsedIngredient[] = coerced.map((c, idx) => ({
      ...c,
      scalingRole: scaling.ingredients[idx].scalingRole,
      percentageValue: scaling.ingredients[idx].percentageValue,
      ratioGroup: scaling.ingredients[idx].ratioGroup,
      ratioValue: scaling.ingredients[idx].ratioValue,
    }));

    const steps: ParsedStep[] = (r.steps as any[]).map((s, idx) => {
      const warningRaw = s.warning != null ? String(s.warning).trim() : '';
      return {
        stepNumber: Number(s.stepNumber ?? idx + 1),
        description: String(s.description ?? '').trim(),
        durationSeconds: s.durationSeconds != null ? Number(s.durationSeconds) : null,
        // varchar(256) 兜底截断；空白 → null
        warning: warningRaw ? warningRaw.slice(0, 256) : null,
      };
    });

    const totalMinutes = r.totalMinutes ? Number(r.totalMinutes) : undefined;
    const approxCount = ingredients.filter((i) => i.amount === 0).length;
    const shortSteps = steps.filter((s) => s.description.length < 5).length;

    let confidence: 'high' | 'medium' | 'low';
    if (approxCount > ingredients.length / 2 || shortSteps > 0) {
      confidence = 'low';
    } else if (approxCount > 0 || !totalMinutes || !r.description) {
      confidence = 'medium';
    } else {
      confidence = 'high';
    }
    // 缩放分类的置信度联动：纠偏过 → 封顶 medium；整体降级 → 强制 low
    if (scaling.severity === 'adjusted' && confidence === 'high') {
      confidence = 'medium';
    } else if (scaling.severity === 'fallback') {
      confidence = 'low';
    }

    return {
      parsed: true,
      confidence,
      recipe: {
        title: String(r.title).trim(),
        description: r.description ? String(r.description).trim() : '',
        totalMinutes,
        cookTime: totalMinutes ? `${totalMinutes}min` : undefined,
        baseServings: r.baseServings ? Math.max(1, Number(r.baseServings)) : 2,
        difficulty: ['easy', 'medium', 'hard'].includes(r.difficulty) ? r.difficulty : 'medium',
        scalingProfile: scaling.scalingProfile,
        baseAnchor: scaling.baseAnchor,
        ingredients,
        steps,
      },
      warnings: scaling.warnings,
      originalText,
    };
  }
}
