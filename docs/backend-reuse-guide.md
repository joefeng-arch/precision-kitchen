# 后端复用指南（海外版）
## 如何沿用老舅厨房现有 NestJS 后端

> **配套文档**：`PRD-overseas-v1.md`
> **核心原则**：海外版与国内版**共用同一套 server**，通过增量 migration 和 feature flag 适配，**不重构既有表、不分叉后端**。

---

## ⚠️ 重要前提

本文档基于 `session-summary-v2.md` 确认的技术栈（NestJS + TypeScript + PostgreSQL 16 + Redis 7）和 14 个功能模块编写。**所有具体的表名、字段名、模块名为基于总结的合理推断，必须由 Claude Code 对照 `E:\老舅厨房app\laojiu-kitchen\server\src` 的实际代码核对后再落地。** 标注 `【待核对】` 的部分尤其需要先看真实代码。

执行前第一步：
```bash
# 让 Claude Code 先盘点真实后端结构
cd E:\老舅厨房app\laojiu-kitchen\server
# 查看模块结构
ls src/
# 查看实体/迁移
ls src/**/*.entity.ts 2>$null
ls src/migrations/ 2>$null
```
拿到真实结构后，再把本文档的推断字段名替换为实际字段名。

---

## 一、可直接复用的模块（无需改动或仅加字段）

以下模块在国内版已完成，海外版直接复用。**【待核对】具体模块/服务名以实际代码为准。**

| 模块 | 复用方式 | 海外版改动 |
|------|---------|-----------|
| 配方 CRUD + 版本管理 | 直接复用 | 加 §三 的缩放字段 |
| 食材库管理 | 直接复用 | 仅前端文案改"原料库/酒柜/豆仓"，后端不动 |
| 成本计算 + 库存扣减 | 直接复用 | 价格单位逻辑已存最小单位，符合海外需求 |
| 多线程计时器（若后端有状态存储） | 复用 | 加计时序列结构（见 §四） |
| AI 智能导入 | 复用 + 扩展 | provider 抽象化（见 §五） |
| 收藏系统 | 直接复用 | 无 |
| i18n 框架 | 直接复用 | 增加目标语言资源 |
| 管理后台（admin_users 独立体系） | 直接复用 | 已扩展（海外内容就绪片）：`POST/PATCH /admin/recipes*` 支持 scalingProfile/baseAnchor/五缩放字段/step.warning，官方缩放配方可灌入。**行为变化**：编辑缩放配方时裸发 ingredients（无缩放字段）由静默抹除改为 400（逃生口：显式 `scalingProfile:"linear_legacy"` 降级）。parse-text 的 warnings 已改英文（海外确认页用户可见；admin 同源同收）。 |

---

## 二、需要改造的模块

### 2.1 认证模块：微信登录 → OAuth

**现状【待核对】**：国内版有微信登录 + Mock 登录，JWT 用户端独立、admin 端独立（`JWT_SECRET` / `ADMIN_JWT_SECRET`）。

**改造方案**（最小侵入）：
- 保留现有 JWT 签发 / 校验逻辑（这部分平台无关，直接复用）。
- 新增 OAuth provider 适配层，**与微信登录平行**，不替换：
  ```
  auth/
  ├── strategies/
  │   ├── wechat.strategy.ts      # 保留，feature flag 控制
  │   ├── mock.strategy.ts        # 保留（dev）
  │   ├── apple.strategy.ts       # 新增
  │   └── google.strategy.ts      # 新增
  └── auth.service.ts             # 统一签发 JWT，登录方式无关
  ```
- 关键：**JWT 签发后的所有下游逻辑（用户识别、鉴权）不变**，只是入口多了两种。这正是国内版"微信登录单独 endpoint、不混进通用 auth 流程"的设计红利——现在加 OAuth 几乎零成本。

**feature flag**：
```
# .env
ENABLE_WECHAT_LOGIN=false   # 海外版关
ENABLE_OAUTH_LOGIN=true     # 海外版开
ALLOW_MOCK_LOGIN=false      # 生产必须 false
```

### 2.2 缩放引擎：扩展而非替换

**现状【待核对】**：国内版缩放为 `linear / sub_linear / fixed`，很可能在配方服务或独立 scaling 逻辑里。

**改造方案**：见 §三的数据模型 migration。核心是**把现有三种逻辑收纳为 `linear_legacy`，新增三种 profile**。国内版配方默认 `linear_legacy`，行为不变。

---

## 三、数据库 Migration（增量，不动旧表结构）

> **【待核对】**：以下字段名为推断，需对照实际 entity。用 NestJS migration 增量添加，**全部 nullable 或带默认值**，保证旧数据不破。

### 3.1 Recipe 表新增字段

```sql
ALTER TABLE recipes
  ADD COLUMN scaling_profile VARCHAR(32) NOT NULL DEFAULT 'linear_legacy',
  ADD COLUMN base_anchor JSONB,
  ADD COLUMN recipe_type VARCHAR(16) NOT NULL DEFAULT 'simple';
  -- recipe_type: simple | composite（MVP 只用 simple，composite 预留）
```

### 3.2 RecipeIngredient 表新增字段

```sql
ALTER TABLE recipe_ingredients
  ADD COLUMN scaling_role VARCHAR(16),         -- anchor|percentage|ratio_linked|fixed
  ADD COLUMN percentage_value NUMERIC(8,3),    -- baker's % 模式
  ADD COLUMN ratio_group VARCHAR(32),          -- multi_ratio 分组
  ADD COLUMN scaling_correction JSONB;         -- 非线性修正规则
```

### 3.3 AI 复盘相关新表（V1.1 才建，MVP 不需要）

```sql
-- 失败现象
CREATE TABLE failure_symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(32) NOT NULL,      -- baking|coffee|drinks
  name VARCHAR(128) NOT NULL,
  description TEXT,
  photo_features JSONB
);

-- 失败成因
CREATE TABLE failure_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  mechanism TEXT,                     -- 机理说明
  detection_rule JSONB                -- 规则层可检测的触发条件
);

-- 修正动作
CREATE TABLE fix_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  param_change_template JSONB         -- 对应引擎参数变更模板
);

-- 多对多映射（带权重）
CREATE TABLE symptom_cause_map (
  symptom_id UUID REFERENCES failure_symptoms(id),
  cause_id UUID REFERENCES failure_causes(id),
  weight NUMERIC(4,3) DEFAULT 0.5,
  PRIMARY KEY (symptom_id, cause_id)
);
CREATE TABLE cause_fix_map (
  cause_id UUID REFERENCES failure_causes(id),
  fix_id UUID REFERENCES fix_actions(id),
  PRIMARY KEY (cause_id, fix_id)
);

-- 用户复盘记录（数据飞轮）
CREATE TABLE diagnosis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recipe_version_id UUID,             -- 关联配方版本
  symptoms JSONB,                     -- 用户选的现象
  environment JSONB,                  -- 环境变量
  ai_diagnosis JSONB,                 -- AI 输出
  adopted_fix_id UUID,                -- 用户采纳的修正
  outcome VARCHAR(16),                -- 下次是否成功（飞轮回流）
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 替代知识库（AI 配料替代，V1.1）

```sql
CREATE TABLE ingredient_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_ingredient VARCHAR(128) NOT NULL,
  substitute_ingredient VARCHAR(128) NOT NULL,
  reason_tags JSONB,                  -- [out_of_stock, allergy, gluten_free, vegan]
  conversion_factor NUMERIC(8,3),     -- 换算系数
  flavor_impact TEXT,                 -- 风味/质地影响
  texture_warning TEXT
);
```

---

## 四、计时序列（计时器改造）

**【待核对】**：国内版计时器是否在后端持久化。若仅前端状态，则序列定义可放在配方数据里，后端只存模板。

建议：把"计时序列"作为配方的一部分存储（jsonb 或子表），与缩放引擎联动重算：

```sql
ALTER TABLE recipes
  ADD COLUMN timer_sequence JSONB;
  -- [{ name, duration_sec, target_type, target_value }, ...]
  -- target_value 随缩放比例由前端/core 重算，后端只存基准
```

---

## 五、AI 服务层抽象（关键复用点）

**现状【待核对】**：国内版 AI 导入用阿里百炼（`AI_PROVIDER=alibaba`，模型如 `qwen-plus` / `deepseek`）。

**改造方案**：把 AI provider 抽象成接口，**国内用阿里、海外可切 OpenAI/Anthropic**，业务逻辑不变：

```typescript
// ai/ai-provider.interface.ts
export interface AiProvider {
  parseRecipe(rawText: string): Promise<StructuredRecipe>;
  diagnose(input: DiagnosisInput): Promise<DiagnosisResult>;   // V1.1
  adjustFlavor(input: FlavorInput): Promise<FlavorResult>;     // V1.1
  // ...
}

// 通过 .env 切换
// AI_PROVIDER=alibaba | openai | anthropic
```

**所有 AI 调用必须经过"三层漏斗"的中间层**（见 PRD §4.3.2）：规则预筛（确定性）→ AI 排序（受约束 prompt）→ 回写引擎（确定性）。AI provider 只负责第二层，且强制结构化 JSON 输出。

**成本控制**：在 AI 服务层加调用计数 + 配额中间件（按订阅层限流，见 PRD §5.3）。Redis 适合存每用户每月调用计数。

---

## 六、feature flag 总表

```
# 登录
ENABLE_WECHAT_LOGIN=false
ENABLE_OAUTH_LOGIN=true
ALLOW_MOCK_LOGIN=false

# 功能模块
ENABLE_MEAL_PLANNING=false       # 餐单规划（正餐），海外关
ENABLE_SHARE_POSTER_QR=false     # 小程序码海报，海外关
ENABLE_OVERSEAS_SCALING=true     # 新缩放 profile

# AI
AI_PROVIDER=openai               # 海外切换
ENABLE_AI_DIAGNOSIS=false        # MVP 关，V1.1 开
ENABLE_AI_PRICING=false          # V1.1 + STUDIO 层

# 商业化
SUBSCRIPTION_TIER_STUDIO=false   # MVP 关，V1.1 开
```

---

## 七、复用决策树（给 Claude Code）

```
对每个后端能力，问：
1. 国内版已有且平台无关？ → 直接复用，不动
2. 国内版已有但含平台特性（微信）？ → 加 OAuth 平行实现 + flag
3. 需要新数据维度（缩放/复盘）？ → 增量 migration，nullable，默认值兼容旧数据
4. 是海外独有功能（AI 复盘/定价）？ → 新建模块，flag 默认关，V1.1 再开
绝不：重构既有表、删除国内版逻辑、分叉成两套后端
```

---

## 八、落地顺序建议

```
Step 1  核对真实代码，替换本文档所有【待核对】字段名
Step 2  加 OAuth 登录 + feature flag（不动微信登录）
Step 3  缩放引擎 migration + 新 profile 逻辑（旧配方默认 legacy）
Step 4  计时序列字段 + 前端联动
Step 5  AI provider 抽象化（导入功能先切通）
Step 6  ——MVP 后端就绪——
Step 7  （V1.1）AI 复盘表 + 三层漏斗中间层 + 知识库录入
Step 8  （V1.1）成本/定价 + STUDIO 层限流
```
