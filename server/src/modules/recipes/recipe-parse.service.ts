import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface ParsedIngredient {
  name: string;
  amount: number;
  unit: string;
  groupName: string;
  scaleType: string;
}

export interface ParsedStep {
  stepNumber: number;
  description: string;
  durationSeconds: number | null;
}

export interface ParsedRecipe {
  title: string;
  description: string;
  cookTime?: string;
  difficulty: string;
  totalMinutes?: number;
  baseServings: number;
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
}

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;

const SYSTEM_PROMPT = `你是一个专业的厨师助手，擅长从非结构化的菜谱文本中提取结构化信息。

请将用户提供的菜谱文本解析为以下 JSON 格式（仅输出 JSON，不要有任何其他说明文字）：

{
  "title": "菜谱标题（字符串，必须非空）",
  "description": "菜谱简短描述（字符串，可选）",
  "totalMinutes": 30,
  "baseServings": 2,
  "difficulty": "easy",
  "ingredients": [
    {
      "name": "食材名称",
      "amount": 500,
      "unit": "g",
      "groupName": "主料",
      "scaleType": "linear"
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "description": "步骤描述",
      "durationSeconds": null
    }
  ]
}

规则：
1. difficulty 只能是 "easy"、"medium"、"hard" 之一，默认 "medium"
2. 对于"适量"、"少许"、"适量"等模糊用量：amount 填 0，unit 填 "适量"
3. groupName 根据食材角色分组：主料、调料、腌料、配料
4. scaleType：调味料/调料用 "sub_linear"，固定用量（如泡打粉）用 "fixed"，其余用 "linear"
5. steps 中有明确计时（如"炒3分钟"→180，"煮10分钟"→600）时填 durationSeconds，否则填 null
6. totalMinutes 为整个菜谱的估计烹饪总时间（分钟），没有时可不填`;

@Injectable()
export class RecipeParseService {
  private readonly logger = new Logger(RecipeParseService.name);

  private get apiKey(): string {
    return (
      process.env.AI_API_KEY ??
      process.env.DASHSCOPE_API_KEY ??
      process.env.ANTHROPIC_API_KEY ??
      ''
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
    options?: { skipRateLimit?: boolean },
  ): Promise<{
    parsed: boolean;
    confidence: 'high' | 'medium' | 'low';
    recipe: ParsedRecipe;
    originalText: string;
  }> {
    if (!options?.skipRateLimit) {
      await this.checkRateLimit(userId);
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

  private async callAI(userText: string): Promise<unknown> {
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

  private validateAndFormat(
    raw: unknown,
    originalText: string,
  ): {
    parsed: boolean;
    confidence: 'high' | 'medium' | 'low';
    recipe: ParsedRecipe;
    originalText: string;
  } {
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

    const ingredients: ParsedIngredient[] = (r.ingredients as any[]).map((i, idx) => {
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

    const steps: ParsedStep[] = (r.steps as any[]).map((s, idx) => ({
      stepNumber: Number(s.stepNumber ?? idx + 1),
      description: String(s.description ?? '').trim(),
      durationSeconds: s.durationSeconds != null ? Number(s.durationSeconds) : null,
    }));

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
        ingredients,
        steps,
      },
      originalText,
    };
  }
}
