# Uncle Joe's Kitchen — 产品需求文档 (PRD)

> 版本: V0.5 | 日期: 2026-05-25 | 状态: 需求评审

---

## 1. 产品概述

### 1.1 产品定位
一款面向家庭厨房爱好者的**菜谱SOP执行系统**，核心差异化：动态食材换算 + 多线程计时器 + 成本核算。

### 1.2 Slogan
"Uncle Joe's Kitchen — 让每道菜都可以精确复刻"

### 1.3 目标用户
- 家庭烹饪爱好者（主力）
- 烘焙玩家（对精度要求高）
- 小型餐饮创业者（成本核算需求）

### 1.4 核心价值主张
| 竞品痛点 | 我们的解决方案 |
|----------|---------------|
| 菜谱固定份量，批量制作靠心算 | 动态倍数换算，调料支持非线性系数 |
| 单步计时器，无法并行 | 多线程全局悬浮计时器 |
| 只记录做法，不知道成本 | 配方与采购单价联动，自动算成本 |
| 操作界面需频繁触屏 | 厨房模式：大字体 + 语音下一步（V2） |

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  uni-app    │     │  管理后台    │     │  后端 API        │
│  小程序前端  │────▶│  Ant Design  │────▶│  Node.js         │
│  (Vue 3)    │     │  Pro (React) │     │  NestJS          │
└─────────────┘     └─────────────┘     │  PostgreSQL      │
                                         │  Redis           │
                                         │  MinIO/OSS       │
                                         └─────────────────┘
```

### 2.2 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| **小程序前端** | uni-app + Vue 3 + TypeScript | 跨平台迁移友好，生态大 |
| **管理后台** | Ant Design Pro (React) | 成熟的后台解决方案，组件丰富 |
| **后端框架** | NestJS (Node.js) | TypeScript 全栈统一，模块化好，适合 Claude Code 生成 |
| **数据库** | PostgreSQL | 支持 JSONB（灵活存储配方）、全文搜索、性能好 |
| **缓存** | Redis | 计时器状态、会话、热门菜谱缓存 |
| **对象存储** | MinIO / 阿里云 OSS | 菜谱图片、步骤图 |
| **部署** | Docker Compose → 后期 K8s | 前期简单，后期可扩展 |

### 2.3 后端推荐理由：NestJS + PostgreSQL

选择这套而非 Supabase 的原因：
1. **你需要管理后台** — Supabase 的 Row Level Security 对复杂权限管理不够灵活
2. **成本核算逻辑复杂** — 需要后端计算层，不适合纯 BaaS
3. **未来跨平台** — 自建 API 不依赖任何 BaaS 平台
4. **TypeScript 全栈** — 前后端类型共享，Claude Code 生成效率高

---

## 3. 功能模块详细需求

### 3.1 模块总览（V0.5 范围）

| 模块 | 优先级 | 描述 |
|------|--------|------|
| 🔐 用户系统 | P0 | 微信登录、个人资料 |
| 📖 菜谱管理 | P0 | CRUD、分类、搜索、版本管理 |
| ⚖️ 动态换算引擎 | P0 | 倍数输入、非线性调料系数、单位切换 |
| ⏱️ 多线程计时器 | P0 | 全局悬浮、多任务并行、提醒 |
| 🍳 SOP 执行模式 | P0 | 厨房大屏模式、步骤导航 |
| 💰 成本计算 | P0 | 食材单价录入、单菜成本、批量成本 |
| 📊 管理后台 | P1 | 用户管理、数据统计、配置项 |
| 🏪 食材库 | P1 | 公共食材库 + 个人食材库、单价管理 |
| 🔖 收藏与分类 | P2 | 个人收藏夹、自定义标签 |

### 3.2 用户系统

**注册/登录**
- 微信一键登录（小程序 `wx.login`）
- 可选绑定手机号（为后期 App 迁移做准备）
- 游客模式：可浏览公共菜谱，不可保存

**用户角色**
| 角色 | 权限 |
|------|------|
| 游客 | 浏览公共菜谱 |
| 普通用户 | 创建/编辑自己的菜谱、使用所有工具 |
| VIP 用户 | 云同步、高级分析（预留） |
| 管理员 | 后台管理全部功能 |

### 3.3 菜谱管理

**创建菜谱 — 字段定义**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 标题 | string | ✅ | 菜谱名称 |
| 封面图 | image | ❌ | 支持拍照/相册 |
| 描述/故事 | text | ❌ | 这道菜背后的故事 |
| 所属分类 | enum[] | ✅ | 支持多分类（中餐/西餐/烘焙/饮品等） |
| 用餐场景 | enum | ❌ | 早餐/午餐/晚餐/下午茶/夜宵 |
| 烹饪时长 | enum | ❌ | 15min内/15-30min/30-60min/60min+ |
| 难度 | enum | ❌ | 零厨艺/容易做/有挑战/压力大 |
| 基准份量 | number | ✅ | 默认1份，用于换算基准 |
| 基准份量单位 | string | ✅ | 份/人/盘/碗/个 等 |
| 标签 | string[] | ❌ | 自定义标签，方便搜索 |
| 是否公开 | boolean | ✅ | 默认私有 |

**用料清单**

每条用料记录：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 食材名称 | string | ✅ | 关联食材库或自定义 |
| 食材分组 | string | ❌ | "主料"/"辅料"/"调料"/"酱汁"等 |
| 用量 | number | ✅ | 基准份量下的用量 |
| 单位 | enum | ✅ | g/kg/ml/L/个/片/勺/茶匙/汤匙/杯/适量 |
| 缩放类型 | enum | ✅ | **linear**（线性等比）/ **sub_linear**（亚线性，如盐）/ **fixed**（固定，如1片姜）|
| 缩放系数 | number | ❌ | 亚线性时的指数，默认 0.7（即 5倍量时调料 = 基准 × 5^0.7 ≈ 3.1倍）|
| 采购单价 | number | ❌ | 元/基准单位，用于成本计算 |
| 备注 | string | ❌ | "切丁"、"室温软化"等 |

> **非线性缩放公式**: `实际用量 = 基准用量 × 倍数^缩放系数`
> - linear: 系数=1.0（默认，如面粉、肉）
> - sub_linear: 系数=0.7（推荐，如盐、酱油、糖）
> - fixed: 系数=0（如1片姜、1个八角）

**制作步骤**

每步记录：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 步骤序号 | number | ✅ | 自动递增，可拖拽排序 |
| 步骤描述 | text | ✅ | 支持引用用料（如 "加入{盐}{量}"） |
| 步骤图片 | image[] | ❌ | 最多9张 |
| 计时器 | object | ❌ | { duration_seconds, label, type: countdown/stopwatch } |
| 关键温度 | number | ❌ | 如 "烤箱预热至180°C" |
| 并行标记 | string | ❌ | 并行分组ID，同组步骤可同时执行 |

**菜谱版本管理**
- 每次保存生成新版本（自动）
- 可查看历史版本、对比差异、回滚
- 最多保留 20 个历史版本

**菜谱导入**
- 手动录入（详细表单）
- 快速添加（仅名称+封面）
- 链接导入（小红书/下厨房，后期支持）
- AI 识别图片生成菜谱（V2）

### 3.4 动态换算引擎

**用户操作流程**
1. 打开菜谱 → 看到默认基准份量（如 "1份"）
2. 修改目标数量（如 "5盘"）
3. 所有用料自动重新计算并展示
4. 换算结果可切换单位（g ↔ 斤 ↔ oz）

**换算规则**
```
倍数 = 目标数量 / 基准份量

对于每种食材:
  if 缩放类型 == linear:
    实际用量 = 基准用量 × 倍数
  elif 缩放类型 == sub_linear:
    实际用量 = 基准用量 × (倍数 ^ 缩放系数)
  elif 缩放类型 == fixed:
    实际用量 = 基准用量  // 不变
```

**单位换算表（内置）**

| 类别 | 换算 |
|------|------|
| 重量 | 1斤=500g, 1oz=28.35g, 1lb=453.6g, 1kg=1000g |
| 体积 | 1杯=240ml, 1汤匙=15ml, 1茶匙=5ml, 1fl oz=29.57ml |
| 中式 | 1两=50g |

**智能提示**
- 当换算结果出现不实际的量（如 0.3g 盐）→ 提示 "约一小撮"
- 当倍数超过 10 → 提示 "建议分批制作"

### 3.5 多线程智能计时器

**设计要求**
- 全局悬浮组件，不遮挡主内容（可收起/展开）
- 支持同时运行 **最多 8 个** 计时器
- 每个计时器独立：标签、时间、状态（运行/暂停/完成）
- 计时器类型：倒计时 / 正计时
- 完成提醒：振动 + 提示音 + 弹窗
- 支持从 SOP 步骤一键创建计时器
- 支持手动添加自定义计时器

**计时器状态**
```
idle → running → paused → running → completed
                    ↓
                  cancelled
```

**UI 布局**
```
┌─────────────────────────────┐
│ 🔥 面团发酵     23:45 ▶️⏸️❌ │
│ 🔥 烤箱预热      5:00 ▶️⏸️❌ │
│ 🔥 煮面倒计时    0:30 ▶️⏸️❌ │
│           ＋ 添加计时器       │
└─────────────────────────────┘
  ↑ 全局悬浮，可折叠为小气泡
```

### 3.6 SOP 执行模式（厨房模式）

**进入条件**: 在菜谱详情页点击 "开始烹饪" / "执行SOP"

**界面特征**
- 大字体、高对比度（方便厨房远距离阅读）
- 屏幕常亮（`wx.setKeepScreenOn`）
- 当前步骤高亮，上下步骤半透明
- 每步显示：步骤描述 + 用到的食材（已按倍数换算）+ 步骤图
- 底部固定：上一步 / 下一步 / 计时器快捷入口
- 滑动或点击切换步骤

**执行流程**
1. 选择目标份量 → 确认换算
2. 进入厨房模式
3. 按步骤执行，需要计时的步骤自动弹出"开始计时"
4. 完成后 → 自动计算本次成本 → 可选记录到历史

### 3.7 成本计算

**数据来源**
- 食材库中的采购单价
- 菜谱中的用料配方

**计算逻辑**
```
单菜成本 = Σ (每种食材的实际用量 × 食材单价)
批量成本 = 单菜成本 × 目标份数  // 注意：非线性食材已在换算中处理
```

**展示**
- 菜谱详情页底部：预估成本（基准份量）
- SOP 执行完成后：本次实际成本
- 成本趋势图（按月/按菜品）

**食材库**
- 公共食材库：系统预置常见食材 + 参考单价
- 个人食材库：用户自定义食材、自己的采购单价
- 支持批量导入食材（CSV）

### 3.8 管理后台

**V0.5 功能范围**

| 模块 | 功能 |
|------|------|
| 仪表盘 | 用户数、菜谱数、日活、热门菜谱 |
| 用户管理 | 查看/搜索用户、修改角色、封禁 |
| 菜谱管理 | 查看/审核公开菜谱、推荐/置顶 |
| 食材库管理 | 维护公共食材库、参考单价 |
| 分类管理 | 菜谱分类、食材分类的 CRUD |
| 系统配置 | 小程序公告、版本控制 |
| 积分配置（预留） | 积分规则、积分商城（预留字段） |

---

## 4. 数据库设计

### 4.1 ER 关系概览

```
users ──1:N──▶ recipes ──1:N──▶ recipe_ingredients
                  │                    │
                  │──1:N──▶ recipe_steps    └──▶ ingredients (食材库)
                  │
                  │──1:N──▶ recipe_versions
                  │
                  └──1:N──▶ cooking_logs ──1:N──▶ cooking_log_costs

users ──1:N──▶ user_ingredients (个人食材库/单价)

users ──1:N──▶ timers (活跃计时器，Redis 为主，PG 持久化)

users ──1:N──▶ favorites
```

### 4.2 表结构定义

#### users — 用户表

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    openid          VARCHAR(128) UNIQUE,          -- 微信 openid
    unionid         VARCHAR(128),                 -- 微信 unionid（跨平台）
    phone           VARCHAR(20),                  -- 手机号（可选绑定）
    nickname        VARCHAR(64) NOT NULL DEFAULT '厨神',
    avatar_url      VARCHAR(512),
    role            VARCHAR(20) NOT NULL DEFAULT 'user',  -- guest/user/vip/admin
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active/banned
    points          INTEGER NOT NULL DEFAULT 0,   -- 积分（预留）
    vip_expires_at  TIMESTAMPTZ,                  -- VIP 过期时间（预留）
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_users_phone ON users(phone);
```

#### categories — 分类表

```sql
CREATE TABLE categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(64) NOT NULL,
    type            VARCHAR(20) NOT NULL,         -- recipe/ingredient/meal_scene
    parent_id       INTEGER REFERENCES categories(id),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    icon            VARCHAR(64),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_type ON categories(type);
```

#### ingredients — 公共食材库

```sql
CREATE TABLE ingredients (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    category_id     INTEGER REFERENCES categories(id),
    default_unit    VARCHAR(20) NOT NULL DEFAULT 'g',  -- 默认单位
    reference_price DECIMAL(10,2),                     -- 参考单价（元/默认单位）
    calories        DECIMAL(8,2),                      -- 每100g 热量 kcal（预留）
    image_url       VARCHAR(512),
    aliases         VARCHAR(256),                      -- 别名，逗号分隔，用于搜索
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredients_name ON ingredients USING gin(to_tsvector('simple', name));
CREATE INDEX idx_ingredients_category ON ingredients(category_id);
```

#### user_ingredients — 个人食材库（单价覆盖）

```sql
CREATE TABLE user_ingredients (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ingredient_id   INTEGER REFERENCES ingredients(id), -- 可关联公共库
    custom_name     VARCHAR(128),                       -- 或自定义食材名
    unit_price      DECIMAL(10,4) NOT NULL,             -- 采购单价
    price_unit      VARCHAR(20) NOT NULL DEFAULT 'g',   -- 单价对应单位
    supplier        VARCHAR(128),                       -- 供应商（可选）
    last_purchased  DATE,                               -- 最近采购日期
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ingredient_source CHECK (
        ingredient_id IS NOT NULL OR custom_name IS NOT NULL
    )
);

CREATE INDEX idx_user_ingredients_user ON user_ingredients(user_id);
```

#### recipes — 菜谱主表

```sql
CREATE TABLE recipes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(256) NOT NULL,
    description     TEXT,                            -- 菜谱故事/简介
    cover_image_url VARCHAR(512),
    base_servings   DECIMAL(6,2) NOT NULL DEFAULT 1, -- 基准份量
    serving_unit    VARCHAR(20) NOT NULL DEFAULT '份', -- 份/人/盘/碗/个
    difficulty      VARCHAR(20),                     -- easy/medium/hard/expert
    cook_time       VARCHAR(20),                     -- 15min/15-30min/30-60min/60min+
    meal_scene      VARCHAR(20),                     -- breakfast/lunch/dinner/snack/midnight
    tags            JSONB DEFAULT '[]',              -- 自定义标签数组
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,  -- 管理员推荐
    status          VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft/published/archived
    version         INTEGER NOT NULL DEFAULT 1,
    view_count      INTEGER NOT NULL DEFAULT 0,
    favorite_count  INTEGER NOT NULL DEFAULT 0,
    rating_avg      DECIMAL(3,2) DEFAULT 0,
    rating_count    INTEGER NOT NULL DEFAULT 0,
    cooking_tips    TEXT,                             -- 烹饪经验/小贴士
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipes_user ON recipes(user_id);
CREATE INDEX idx_recipes_status ON recipes(status, is_public);
CREATE INDEX idx_recipes_tags ON recipes USING gin(tags);
CREATE INDEX idx_recipes_search ON recipes USING gin(
    to_tsvector('simple', title || ' ' || COALESCE(description, ''))
);
```

#### recipe_categories — 菜谱-分类关联（多对多）

```sql
CREATE TABLE recipe_categories (
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    PRIMARY KEY (recipe_id, category_id)
);
```

#### recipe_ingredients — 菜谱用料

```sql
CREATE TABLE recipe_ingredients (
    id              SERIAL PRIMARY KEY,
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id   INTEGER REFERENCES ingredients(id),
    custom_name     VARCHAR(128),                  -- 未入库的自定义食材
    group_name      VARCHAR(64) DEFAULT '主料',     -- 主料/辅料/调料/酱汁/其他
    amount          DECIMAL(10,3) NOT NULL,         -- 基准用量
    unit            VARCHAR(20) NOT NULL,           -- g/kg/ml/L/个/片/勺/茶匙/汤匙/杯/适量
    scale_type      VARCHAR(20) NOT NULL DEFAULT 'linear', -- linear/sub_linear/fixed
    scale_factor    DECIMAL(4,2) DEFAULT 1.0,       -- 缩放系数
    sort_order      INTEGER NOT NULL DEFAULT 0,
    note            VARCHAR(256),                   -- "切丁"、"室温软化"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ri_source CHECK (
        ingredient_id IS NOT NULL OR custom_name IS NOT NULL
    )
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
```

#### recipe_steps — 制作步骤

```sql
CREATE TABLE recipe_steps (
    id              SERIAL PRIMARY KEY,
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number     INTEGER NOT NULL,
    description     TEXT NOT NULL,                  -- 支持模板变量 {食材名}{用量}
    images          JSONB DEFAULT '[]',             -- 图片URL数组，最多9张
    timer_seconds   INTEGER,                        -- 计时器时长（秒），NULL=无计时
    timer_label     VARCHAR(64),                    -- 计时器标签
    timer_type      VARCHAR(20) DEFAULT 'countdown', -- countdown/stopwatch
    temperature     DECIMAL(5,1),                   -- 关键温度（°C）
    parallel_group  VARCHAR(32),                    -- 并行分组ID
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(recipe_id, step_number)
);

CREATE INDEX idx_recipe_steps_recipe ON recipe_steps(recipe_id);
```

#### recipe_versions — 菜谱版本历史

```sql
CREATE TABLE recipe_versions (
    id              SERIAL PRIMARY KEY,
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    snapshot        JSONB NOT NULL,                 -- 完整菜谱快照（含用料、步骤）
    change_summary  VARCHAR(256),                   -- 变更说明
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(recipe_id, version)
);

CREATE INDEX idx_recipe_versions_recipe ON recipe_versions(recipe_id);
```

#### cooking_logs — 烹饪记录

```sql
CREATE TABLE cooking_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id       UUID NOT NULL REFERENCES recipes(id),
    recipe_version  INTEGER NOT NULL,               -- 使用的菜谱版本
    target_servings DECIMAL(6,2) NOT NULL,          -- 本次目标份量
    multiplier      DECIMAL(8,4) NOT NULL,          -- 换算倍数
    total_cost      DECIMAL(10,2),                  -- 本次总成本
    rating          SMALLINT,                       -- 1-5 评分
    notes           TEXT,                           -- 本次备注
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cooking_logs_user ON cooking_logs(user_id);
CREATE INDEX idx_cooking_logs_recipe ON cooking_logs(recipe_id);
```

#### cooking_log_costs — 烹饪成本明细

```sql
CREATE TABLE cooking_log_costs (
    id              SERIAL PRIMARY KEY,
    cooking_log_id  UUID NOT NULL REFERENCES cooking_logs(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(128) NOT NULL,
    amount_used     DECIMAL(10,3) NOT NULL,         -- 实际用量（换算后）
    unit            VARCHAR(20) NOT NULL,
    unit_price      DECIMAL(10,4),                  -- 使用时的单价
    line_cost       DECIMAL(10,2),                  -- 该食材成本
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cooking_log_costs_log ON cooking_log_costs(cooking_log_id);
```

#### favorites — 收藏

```sql
CREATE TABLE favorites (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    folder          VARCHAR(64) DEFAULT '默认收藏夹',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, recipe_id)
);
```

#### unit_conversions — 单位换算表

```sql
CREATE TABLE unit_conversions (
    id              SERIAL PRIMARY KEY,
    from_unit       VARCHAR(20) NOT NULL,
    to_unit         VARCHAR(20) NOT NULL,
    factor          DECIMAL(12,6) NOT NULL,         -- from × factor = to
    category        VARCHAR(20) NOT NULL,           -- weight/volume/chinese
    UNIQUE(from_unit, to_unit)
);

-- 预置数据
INSERT INTO unit_conversions (from_unit, to_unit, factor, category) VALUES
('g', 'kg', 0.001, 'weight'),
('g', 'oz', 0.035274, 'weight'),
('g', 'lb', 0.002205, 'weight'),
('g', '斤', 0.002, 'weight'),
('g', '两', 0.02, 'weight'),
('ml', 'L', 0.001, 'volume'),
('ml', '杯', 0.004167, 'volume'),
('ml', '汤匙', 0.066667, 'volume'),
('ml', '茶匙', 0.2, 'volume'),
('ml', 'fl_oz', 0.033814, 'volume');
```

#### system_configs — 系统配置

```sql
CREATE TABLE system_configs (
    key             VARCHAR(64) PRIMARY KEY,
    value           JSONB NOT NULL,
    description     VARCHAR(256),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.3 Redis 数据结构

```
# 活跃计时器（每用户最多8个）
timer:{user_id}:{timer_id} = {
    label: "面团发酵",
    total_seconds: 1800,
    remaining_seconds: 1200,
    status: "running",        // running/paused/completed
    type: "countdown",
    recipe_id: "xxx",
    step_id: 123,
    started_at: timestamp,
    paused_at: timestamp
}
TTL: 24h

# 用户活跃计时器列表
timer_list:{user_id} = [timer_id_1, timer_id_2, ...]

# 热门菜谱缓存
hot_recipes:{category} = ZSET (recipe_id -> score)
TTL: 1h

# 用户会话
session:{token} = { user_id, role, ... }
TTL: 7d
```

---

## 5. API 接口概览（RESTful）

### 5.1 认证
| Method | Path | 说明 |
|--------|------|------|
| POST | /api/auth/wx-login | 微信登录 |
| POST | /api/auth/bind-phone | 绑定手机号 |
| GET | /api/auth/profile | 获取个人信息 |
| PUT | /api/auth/profile | 更新个人信息 |

### 5.2 菜谱
| Method | Path | 说明 |
|--------|------|------|
| POST | /api/recipes | 创建菜谱 |
| GET | /api/recipes | 列表（支持搜索/筛选/分页） |
| GET | /api/recipes/:id | 菜谱详情（含用料+步骤） |
| PUT | /api/recipes/:id | 更新菜谱（自动创建版本） |
| DELETE | /api/recipes/:id | 删除菜谱 |
| GET | /api/recipes/:id/versions | 版本历史 |
| POST | /api/recipes/:id/versions/:v/rollback | 回滚到指定版本 |
| POST | /api/recipes/:id/calculate | 动态换算（传入目标份量） |

### 5.3 SOP 执行
| Method | Path | 说明 |
|--------|------|------|
| POST | /api/cooking/start | 开始烹饪（创建 log） |
| PUT | /api/cooking/:logId/complete | 完成烹饪 |
| GET | /api/cooking/history | 烹饪历史 |

### 5.4 计时器
| Method | Path | 说明 |
|--------|------|------|
| POST | /api/timers | 创建计时器 |
| PUT | /api/timers/:id/pause | 暂停 |
| PUT | /api/timers/:id/resume | 继续 |
| DELETE | /api/timers/:id | 取消 |
| GET | /api/timers | 获取当前所有活跃计时器 |

### 5.5 食材库
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/ingredients | 搜索公共食材库 |
| POST | /api/user-ingredients | 添加个人食材/单价 |
| PUT | /api/user-ingredients/:id | 更新单价 |

### 5.6 管理后台
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/admin/dashboard | 统计数据 |
| GET | /api/admin/users | 用户列表 |
| PUT | /api/admin/users/:id/role | 修改用户角色 |
| GET | /api/admin/recipes | 菜谱审核列表 |
| PUT | /api/admin/recipes/:id/feature | 推荐菜谱 |
| CRUD | /api/admin/categories | 分类管理 |
| CRUD | /api/admin/ingredients | 食材库管理 |
| CRUD | /api/admin/configs | 系统配置 |

---

## 6. 非功能性需求

### 6.1 性能
- 菜谱列表首屏加载 < 1.5s
- 动态换算计算 < 100ms（前端本地计算）
- 计时器精度误差 < 1s

### 6.2 离线支持
- 已打开过的菜谱缓存到本地
- SOP 执行模式支持完全离线运行
- 计时器在小程序后台运行时通过系统通知提醒

### 6.3 安全
- 所有 API 需 JWT 鉴权（管理后台单独鉴权）
- 图片上传限制 5MB/张，仅 jpg/png/webp
- 用户数据隔离，无法访问他人私有菜谱

### 6.4 数据备份
- PostgreSQL 每日自动备份
- 图片存储开启版本控制

---

## 7. 里程碑计划

| 周次 | 目标 | 交付物 |
|------|------|--------|
| W1 | 环境搭建 + 数据库 + 用户系统 | 后端骨架、DB migration、微信登录 |
| W2 | 菜谱 CRUD + 食材库 | 菜谱创建/编辑/详情、公共食材库 |
| W3 | 动态换算 + 成本计算 | 前端换算引擎、成本展示 |
| W4 | 多线程计时器 + SOP模式 | 悬浮计时器组件、厨房模式页面 |
| W5 | 管理后台 + 联调优化 | 后台基础功能、性能优化 |
| W6 | 测试 + Bug修复 + 上线 | 小程序提审、灰度发布 |

---

## 附录 A: 页面清单

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页/厨房 | /pages/home | 我的菜谱列表 + 快捷操作 |
| 菜谱详情 | /pages/recipe/detail | 用料+步骤+成本+换算 |
| 创建/编辑菜谱 | /pages/recipe/edit | 多步骤表单 |
| SOP执行模式 | /pages/cooking/sop | 厨房大屏模式 |
| 发现/社区 | /pages/discover | 公共菜谱浏览 |
| 食材库 | /pages/ingredients | 个人食材+单价管理 |
| 个人中心 | /pages/profile | 设置、历史、统计 |
| 烹饪历史 | /pages/cooking/history | 烹饪记录+成本趋势 |
| 计时器(悬浮) | /components/timer-float | 全局悬浮组件 |

## 附录 B: 预置分类数据

**菜谱分类**: 中餐、西餐、日料、韩餐、东南亚菜、烘焙、甜点、饮品、轻食、火锅、烧烤

**食材分类**: 蔬菜、水果、肉禽、海鲜水产、蛋奶、豆制品、粮油、调味品、干货、香料、烘焙原料

**用餐场景**: 早餐、午餐、晚餐、下午茶、夜宵、聚餐
