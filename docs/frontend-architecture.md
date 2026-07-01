# 前端架构与示例代码（海外版）
## Expo React Native 前端设计

> **配套文档**：`PRD-overseas-v1.md`、`backend-reuse-guide.md`
> **核心判断**：国内版前端是 React H5（web-view 套小程序），海外版是 Expo React Native，**UI 层不能共用**，需重写。但 API 调用、缩放逻辑、计时、成本、i18n、类型等**无 UI 业务逻辑可 100% 复用**。

---

## 一、为什么前端重写、哪些能共享

| 层 | 国内 H5 | 海外 RN | 能否共享 |
|----|---------|---------|---------|
| UI 组件 | React DOM + Tailwind | RN 组件 | ❌ 不能 |
| 路由 | React Router | Expo Router | ❌ 不能 |
| API 调用层 | fetch 封装 | 同 | ✅ 100% |
| 缩放引擎 | 纯 TS 计算 | 同 | ✅ 100% |
| 计时序列逻辑 | 纯 TS | 同 | ✅ 100% |
| 成本核算 | 纯 TS | 同 | ✅ 100% |
| i18n 资源 | json | 同 | ✅ 100% |
| TS 类型 | interface | 同 | ✅ 100% |

**结论**：约 20–30% 的"无 UI 逻辑"抽到 `packages/core` 共享，70–80% 的 UI 层重写。

> **重要节奏**：`packages/core` 抽取**不在 MVP 第一步**。先让 mobile app 直接写逻辑跑通，验证后再抽共享层（避免过早抽象猜错边界）。本文档给出抽取后的目标结构作为方向，但 MVP 可先把 core 逻辑直接放在 mobile 项目里。

---

## 二、技术选型

| 类别 | 选型 | 理由 |
|------|------|------|
| 框架 | Expo（React Native） | 跨 iOS/Android，OTA 更新，上架流程成熟 |
| 路由 | Expo Router | 文件路由，与 Expo 一体 |
| 状态 | Zustand | 轻量，适合工具类 app；避免 Redux 重 |
| 数据请求 | TanStack Query | 缓存/重试/乐观更新，配方数据天然适合 |
| 样式 | NativeWind（Tailwind for RN） | 与国内 H5 的 Tailwind 心智一致，降低团队切换成本 |
| 表单 | React Hook Form | 配方编辑表单复杂，需高性能 |
| i18n | i18next + react-i18next | 复用国内版翻译资源 |
| 本地存储 | MMKV | 比 AsyncStorage 快，存离线配方 |
| 订阅 | RevenueCat | 跨 Apple/Google 内购，省去自建计费 |

---

## 三、目标目录结构

```
apps/mobile/
├── app/                          # Expo Router 文件路由
│   ├── (tabs)/
│   │   ├── index.tsx             # 首页：我的配方
│   │   ├── discover.tsx          # 发现（公开配方）
│   │   ├── brew.tsx              # 冲煮/计时入口
│   │   ├── pantry.tsx            # 原料库（酒柜/豆仓/料台）
│   │   └── profile.tsx           # 我的
│   ├── recipe/
│   │   ├── [id].tsx              # 配方详情
│   │   ├── edit.tsx              # 配方编辑
│   │   └── scale.tsx             # 缩放工作台
│   ├── brew/
│   │   └── [id]/session.tsx      # 冲煮/烘焙模式（暗色大屏）
│   ├── diagnose/                 # V1.1 AI 复盘
│   ├── _layout.tsx
│   └── index.tsx
├── components/
│   ├── recipe/
│   ├── scaling/                  # 缩放 UI（滑杆/锁定/比例）
│   ├── timer/                    # 计时序列 UI
│   └── ui/                       # 设计系统基础组件
├── features/                     # 业务功能（调用 core + UI）
│   ├── scaling/
│   ├── timer/
│   ├── cost/
│   └── diagnose/
├── lib/
│   ├── api/                      # API client（MVP 阶段在此，后抽到 core）
│   ├── store/                    # Zustand stores
│   └── theme/                    # 设计 token
├── locales/                      # i18n（复用国内翻译 + 新增语言）
└── app.config.ts

# 抽取后的共享层（MVP 后做）
packages/core/
├── scaling/      # 缩放引擎（见 §五示例）
├── timer/        # 计时序列
├── cost/         # 成本核算
├── api-client/   # API 封装 + 类型
└── types/
```

---

## 四、设计系统方向（区别于竞品的视觉锚点）

竞品视觉普遍是两类：要么暖奶油底 + 衬线（烘焙博客风），要么深色 + 像素插画（鸡尾酒 app 风）。为避免落入模板，海外版走**"实验室仪表盘"方向**——呼应"精准"定位：

```
品牌主张：Precision you can taste（可以尝到的精准）

色板（4 色锚点）
  --ink        #16130F   近黑墨，主文字/暗色冲煮模式底
  --paper      #FBF8F2   米白，浅色背景
  --measure    #2F6F5B   测量绿，主操作/比例锁定（仪器感）
  --heat       #D9622B   烤橙，温度/告警/计时
  --line       #C9C2B5   细线灰，分隔/刻度

字体
  display: 一款带工程刻度感的无衬线（如 Söhne / Inter Tight），用于数字与比例
  body:    可读性优先的无衬线
  mono:    等宽（计量数字、克数、比例对齐用）—— 数字用等宽是这个 app 的签名

签名元素
  "比例刻度尺"——缩放工作台用一把可拖动的刻度尺表达比例，
  数字随拖动实时跳变（等宽字体），像调校仪器。这是 app 的记忆点。

克制原则
  把大胆留给"比例刻度尺"这一个签名，其余界面安静、克制、对齐精确。
```

> 注：以上为方向建议，落地时让 frontend-design 流程再细化。不要把刻度尺做成噱头——它必须真的好用（手冲时湿手也能拖）。

---

## 五、核心示例代码

以下是**可直接复用、平台无关**的缩放引擎核心（放 `packages/core/scaling`，MVP 可先放 mobile）。这是整个产品的计算心脏，给出完整实现作为 Claude Code 的起点。

### 5.1 类型定义

```typescript
// packages/core/scaling/types.ts

export type ScalingProfile =
  | 'bakers_percentage'
  | 'ratio_based'
  | 'multi_ratio'
  | 'linear_legacy';

export type ScalingRole = 'anchor' | 'percentage' | 'ratio_linked' | 'fixed';

export interface ScalingCorrection {
  type: 'step';
  rules: { above_factor: number; multiply: number }[];
}

export interface Ingredient {
  id: string;
  name: string;
  amount: number;            // 基准配方下的量
  unit: string;
  scalingRole?: ScalingRole;
  percentageValue?: number;  // baker's % 模式
  ratioGroup?: string;       // multi_ratio 分组
  scalingCorrection?: ScalingCorrection;
}

export interface BaseAnchor {
  // bakers_percentage
  anchorIngredientId?: string;
  // ratio_based
  ratio?: { [key: string]: number };
  locked?: string;
  // multi_ratio
  ratios?: { [key: string]: string | number };
}

export interface Recipe {
  id: string;
  scalingProfile: ScalingProfile;
  baseAnchor?: BaseAnchor;
  ingredients: Ingredient[];
}

export interface ScaleRequest {
  // 不同 profile 用不同字段
  targetAnchorAmount?: number;  // bakers: 目标基准量
  targetTotalWeight?: number;   // bakers: 目标总重
  factor?: number;              // legacy: 缩放倍数
  overrides?: { [ingredientId: string]: number }; // ratio/multi: 用户调某项
}
```

### 5.2 缩放引擎主入口

```typescript
// packages/core/scaling/engine.ts
import {
  Recipe, Ingredient, ScaleRequest, ScalingCorrection,
} from './types';

/** 应用非线性修正系数 */
function applyCorrection(
  amount: number,
  factor: number,
  correction?: ScalingCorrection,
): number {
  if (!correction || correction.type !== 'step') return amount;
  let result = amount;
  for (const rule of correction.rules) {
    if (factor > rule.above_factor) result *= rule.multiply;
  }
  return result;
}

/** A. Baker's Percentage */
function scaleBakers(recipe: Recipe, req: ScaleRequest): Ingredient[] {
  const { ingredients } = recipe;
  let flourAmount: number;

  if (req.targetAnchorAmount != null) {
    flourAmount = req.targetAnchorAmount;
  } else if (req.targetTotalWeight != null) {
    const sumPct = ingredients.reduce(
      (s, ing) => s + (ing.percentageValue ?? 0), 0,
    );
    flourAmount = req.targetTotalWeight / (sumPct / 100);
  } else {
    throw new Error('bakers: need targetAnchorAmount or targetTotalWeight');
  }

  // 原始基准量（用于算缩放因子，驱动非线性修正）
  const anchor = ingredients.find(i => i.scalingRole === 'anchor');
  const baseFlour = anchor?.amount ?? flourAmount;
  const factor = flourAmount / baseFlour;

  return ingredients.map(ing => {
    const raw = flourAmount * ((ing.percentageValue ?? 0) / 100);
    return { ...ing, amount: applyCorrection(raw, factor, ing.scalingCorrection) };
  });
}

/** B. Ratio-based（咖啡） */
function scaleRatio(recipe: Recipe, req: ScaleRequest): Ingredient[] {
  const anchor = recipe.baseAnchor!;
  const keys = Object.keys(anchor.ratio ?? {});
  if (keys.length !== 2) {
    throw new Error('ratio_based expects exactly 2 components');
  }
  const [a, b] = keys;
  const R = anchor.ratio![b] / anchor.ratio![a]; // b 相对 a 的倍数

  return recipe.ingredients.map(ing => {
    const override = req.overrides?.[ing.id];
    if (override == null) return ing;
    // 简化示意：以被调整项推算另一项，实际按 ing 对应 a/b 区分
    return { ...ing, amount: override };
    // 真实实现：识别 ing 属于 a 还是 b，按 R 联动另一项
  });
}

/** C. Multi-ratio（奶茶/鸡尾酒）—— 多组分按比例联动 */
function scaleMultiRatio(recipe: Recipe, req: ScaleRequest): Ingredient[] {
  // 按 ratioGroup 分组，组内保持比例；用户 override 某项则组内联动
  const groups: Record<string, Ingredient[]> = {};
  for (const ing of recipe.ingredients) {
    const g = ing.ratioGroup ?? '_default';
    (groups[g] ??= []).push(ing);
  }

  const result: Ingredient[] = [];
  for (const list of Object.values(groups)) {
    const overrideIng = list.find(i => req.overrides?.[i.id] != null);
    if (!overrideIng) { result.push(...list); continue; }
    const newVal = req.overrides![overrideIng.id];
    const ratio = newVal / overrideIng.amount; // 组内统一缩放因子
    for (const ing of list) {
      result.push({ ...ing, amount: ing.amount * ratio });
    }
  }
  return result;
}

/** D. Legacy 线性（国内版兼容） */
function scaleLegacy(recipe: Recipe, req: ScaleRequest): Ingredient[] {
  const factor = req.factor ?? 1;
  return recipe.ingredients.map(ing => {
    if (ing.scalingRole === 'fixed') return ing;
    const raw = ing.amount * factor;
    return { ...ing, amount: applyCorrection(raw, factor, ing.scalingCorrection) };
  });
}

/** 统一入口 */
export function scaleRecipe(recipe: Recipe, req: ScaleRequest): Ingredient[] {
  switch (recipe.scalingProfile) {
    case 'bakers_percentage': return scaleBakers(recipe, req);
    case 'ratio_based':       return scaleRatio(recipe, req);
    case 'multi_ratio':       return scaleMultiRatio(recipe, req);
    case 'linear_legacy':     return scaleLegacy(recipe, req);
    default:
      throw new Error(`unknown scaling profile: ${recipe.scalingProfile}`);
  }
}
```

> **注**：`scaleRatio` 给出的是结构示意，真实实现需识别每个 ingredient 属于比例的哪一端（粉 / 水），按 R 联动。Claude Code 落地时补全这部分 + 单元测试。

### 5.3 单元测试骨架（务必先写测试再接 UI）

```typescript
// packages/core/scaling/engine.test.ts
import { scaleRecipe } from './engine';

describe('scaleRecipe - bakers_percentage', () => {
  const recipe = {
    id: 'r1', scalingProfile: 'bakers_percentage' as const,
    baseAnchor: { anchorIngredientId: 'flour' },
    ingredients: [
      { id: 'flour', name: 'Flour', amount: 500, unit: 'g',
        scalingRole: 'anchor' as const, percentageValue: 100 },
      { id: 'water', name: 'Water', amount: 350, unit: 'g',
        scalingRole: 'percentage' as const, percentageValue: 70 },
      { id: 'salt', name: 'Salt', amount: 10, unit: 'g',
        scalingRole: 'percentage' as const, percentageValue: 2,
        scalingCorrection: { type: 'step' as const,
          rules: [{ above_factor: 3, multiply: 0.75 }] } },
    ],
  };

  it('scales to target flour amount', () => {
    const out = scaleRecipe(recipe, { targetAnchorAmount: 1000 });
    expect(out.find(i => i.id === 'water')!.amount).toBe(700); // 70%
  });

  it('applies non-linear correction to salt above 3x', () => {
    const out = scaleRecipe(recipe, { targetAnchorAmount: 2000 }); // 4x
    // salt: 2000 * 2% = 40, then *0.75 = 30
    expect(out.find(i => i.id === 'salt')!.amount).toBe(30);
  });
});
```

### 5.4 计时序列组件（RN 示例）

```typescript
// apps/mobile/components/timer/BrewSequence.tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface BrewStep {
  name: string;
  durationSec: number;
  targetType?: 'pour_to' | 'pour_add';
  targetValue?: number;  // 由缩放引擎按比例重算后传入
  unit?: string;
}

export function BrewSequence({ steps }: { steps: BrewStep[] }) {
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(steps[0]?.durationSec ?? 0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          // 自动进入下一段
          if (idx < steps.length - 1) {
            setIdx(i => i + 1);
            return steps[idx + 1].durationSec;
          }
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, idx, steps]);

  const step = steps[idx];
  const next = steps[idx + 1];

  return (
    // 暗色冲煮模式：大字、目标量、下一步预告（湿手也能看清）
    <View className="flex-1 bg-[#16130F] items-center justify-center px-6">
      <Text className="text-[#C9C2B5] text-base mb-2">{step?.name}</Text>
      <Text className="text-[#FBF8F2] text-7xl font-mono tabular-nums">
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </Text>
      {step?.targetValue != null && (
        <Text className="text-[#D9622B] text-3xl font-mono mt-4">
          {step.targetType === 'pour_to' ? 'Pour to' : 'Add'} {step.targetValue}{step.unit}
        </Text>
      )}
      {next && (
        <Text className="text-[#C9C2B5] text-sm mt-8">Next · {next.name}</Text>
      )}
      <Pressable
        onPress={() => setRunning(r => !r)}
        className="mt-10 px-10 py-4 rounded-full bg-[#2F6F5B]"
      >
        <Text className="text-[#FBF8F2] text-lg">{running ? 'Pause' : 'Start'}</Text>
      </Pressable>
    </View>
  );
}
```

---

## 六、给 Claude Code 的前端落地顺序

```
Step 1  expo init + Expo Router + NativeWind + Zustand + TanStack Query 脚手架
Step 2  搭设计 token（§四色板/字体），先做 ui/ 基础组件
Step 3  接 API client（直连 server，MVP 不抽 core）
Step 4  OAuth 登录页（Apple/Google）
Step 5  配方列表 + 详情 + 编辑（复用后端 CRUD）
Step 6  缩放工作台 + 缩放引擎（§五代码 + 测试）★产品心脏
Step 7  计时序列 + 冲煮/烘焙模式（§五组件）
Step 8  原料库 + 成本（复用后端）
Step 9  RevenueCat 接入 FREE/PRO 订阅
Step 10 ——MVP 前端就绪，提审上架——
Step 11 （MVP 后）抽取 packages/core 共享层
Step 12 （V1.1）AI 复盘/微调/定价/替代 UI + STUDIO 层
```

**原则**：缩放引擎（Step 6）必须先有单元测试再接 UI——它是计算心脏，错一个系数就毁用户一炉东西，直接砸"精准"品牌。
