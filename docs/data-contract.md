# Precision Kitchen — 前端数据契约

> 依据 `main` 全量后端代码（缩放引擎五片已并）反推，供前端对接。
> 配套类型：[`data-contract.ts`](./data-contract.ts)（可直接 import）。
> **所有路径带全局前缀 `/api`。**

## 0. 全局响应包裹（重要）

所有成功响应经 `TransformInterceptor` 包裹；错误经 `HttpExceptionFilter`。
**下文各接口的"返回结构"均指 `data` 字段内部。**

| 场景 | 结构 |
|---|---|
| 成功 | `{ "code": 200, "message": "success", "data": <T>, "timestamp": "ISO" }` |
| 错误 | `{ "code": <httpStatus>, "message": "...", "errors"?: string[], "path": "/api/...", "timestamp": "ISO" }` |

> ⚠️ **Decimal 字段以字符串返回**（TypeORM）：`amount`、`scaleFactor`、`percentageValue`、`ratioValue` 均为 `string`（如 `"100.00"`），前端需 `parseFloat`。
> 例外：**缩放结果**里的 `originalAmount` / `scaledAmount` 已是 `number`。

---

## 1. Recipe 实体全字段

| 字段 | 类型 | 说明 |
|---|---|---|
| id | `string` (uuid) | |
| authorId | `string` (uuid) | |
| title | `string` | |
| description | `string \| null` | |
| coverImage | `string \| null` | |
| categoryId | `number \| null` | 旧单分类（兼容） |
| mealSceneId | `number \| null` | |
| baseServings | `number` | 默认 2 |
| **scalingProfile** | `'linear_legacy' \| 'bakers_percentage' \| 'ratio_based' \| 'multi_ratio'` | 默认 `linear_legacy` |
| **baseAnchor** | `BaseAnchor \| null` (jsonb) | 见下 |
| **recipeType** | `'simple' \| 'composite'` | 默认 `simple`（composite 预留） |
| difficulty | `'easy' \| 'medium' \| 'hard'` | 默认 medium |
| totalMinutes | `number \| null` | 分钟 |
| status | `'draft' \| 'published' \| 'archived'` | 默认 draft |
| tags | `string[]` (jsonb) | |
| isPublic | `boolean` | |
| isFeatured | `boolean` | 官方推荐 |
| viewCount | `number` | |
| versionCount | `number` | |
| createdAt | `string` (ISO) | |
| updatedAt | `string` (ISO) | |
| ingredients | `RecipeIngredient[]` | **仅详情**（列表不含） |
| steps | `RecipeStep[]` | **仅详情**（列表不含） |

**BaseAnchor**（jsonb，随 profile 而变，字段均可选）：
`{ anchorIngredientId?: string|number, anchorIs?: string, ratio?: Record<string,number>, ratios?: Record<string,string|number>, locked?: string, percentBase?: PercentBase }`

`percentBase`（multi_ratio 专用）：作者指定 percentage 原料的基准，与下文 §3 scale 请求体的 `PercentBase` 同构（`{ group }` 组内成员用量之和 / `{ id }` 单个 ingredient 用量，如奶茶糖按热水）。前端读取此字段构造 scale 请求，不再自行猜测/硬编码基准。

**写入（AI 导入切片起）**：`scalingProfile` / `baseAnchor` 现可经 `POST /recipes`、`PATCH /recipes/:id` 提交。
提交时 `baseAnchor.percentBase` 用 **`{ ingredientIndex }`**（ingredients 数组下标，0 起）或 `{ group }`——
保存前没有 DB id，服务端在插入 ingredients 后把下标重映射为真实 `{ id }` 落库。规则：
- 缩放结构不自洽（如 bakers 无 anchor、multi_ratio 有 percentage 料但 percentBase 解析不了）→ **400**。
- **update 时缩放配置必须与 `ingredients` 一并提交**（children 重插会换 id，否则 id 形 percentBase 必悬垂）→ 违反 400；单独把 `scalingProfile` 降级为 `linear_legacy` 允许。
- 重发 ingredients 而未重发 baseAnchor 且校验通过（无 percentage 料）→ 已存 baseAnchor 被置 null。
- steps-only 更新：服务端自动按位置把已存 id 形 percentBase 重映射到重插后的新 id，调用方无感。

---

## 2. RecipeIngredient 实体全字段

| 字段 | 类型 | 说明 |
|---|---|---|
| id | `number` | |
| recipeId | `string` (uuid) | |
| ingredientId | `number \| null` | 关联公共食材库 |
| customName | `string \| null` | 自定义名 |
| amount | `string` (decimal) | 原始用量，需 parseFloat |
| unit | `string` | |
| scaleType | `'linear' \| 'sub_linear' \| 'fixed'` | 默认 linear（仅 legacy 用） |
| scaleFactor | `string` (decimal) | 默认 `"0.70"`（仅 sub_linear 用） |
| groupName | `string \| null` | 展示分组：主料/腌料/调味 |
| **scalingRole** | `'anchor' \| 'percentage' \| 'ratio_linked' \| 'fixed' \| null` | 新 profile 用；legacy 行为 null |
| **percentageValue** | `string \| null` (decimal) | bakers %/multi_ratio % |
| **ratioGroup** | `string \| null` | 比例组标记（tea_base/mix…） |
| **ratioValue** | `string \| null` (decimal) | 组内 parts |
| **correction** | `ScalingCorrection \| null` (jsonb) | `{ type:'step', rules:[{ above_factor:number, multiply:number }] }` |
| **roundDp** | `number \| null` | 取整小数位（0/1/2；null 走默认） |
| notes | `string \| null` | |
| sort | `number` | |
| name | `string \| null` | **仅详情注入**（customName 或公共食材名） |

**RecipeStep**（详情内）：`{ id:number, recipeId:string, stepNumber:number, description:string, imageUrl:string|null, durationSeconds:number|null, tips:string|null }`

**写入（AI 导入切片起）**：`scalingRole` / `percentageValue` / `ratioGroup` / `ratioValue` / `roundDp` 现可经
create/update 的 ingredient 项提交（数值按 number 传，服务端存 decimal 字符串）。`scalingProfile`
为 `linear_legacy` 时上述字段保存时被强制剥离为 null（DB 卫生）。
已知缺口：`correction`（非线性修正 jsonb）不在 DTO 内，且 steps-only 更新的 children 往返会将其清空——
当前无任何数据使用该字段，留待 correction 创作入口切片一并处理。

---

## 3. `POST /recipes/:id/scale` — 锁定式缩放（新）

公开；`:id` 必须 uuid。**Request body 按 `profile` 判别**（四选一）：

```jsonc
// linear_legacy —— 按倍数
{ "profile": "linear_legacy", "multiplier": 2 }              // multiplier > 0

// bakers_percentage —— 锁基准量或锁总重
{ "profile": "bakers_percentage",
  "bakersLock": { "mode": "anchor" | "total", "value": 1000 } }   // value > 0

// ratio_based —— 锁某成员目标量（id = recipe_ingredient.id）
{ "profile": "ratio_based",
  "ratioLock": { "id": 22, "value": 300 } }                        // value > 0

// multi_ratio —— 多组各自锁 + percentage 基准
{ "profile": "multi_ratio",
  "multiRatio": {
    "groups": [                                                    // 至少 1 组
      { "group": "tea_base", "lockedId": 31, "lockedValue": 5 },   // 锁成员：lockedId+lockedValue
      { "group": "mix", "total": 120 }                             // 或锁组总量：total
    ],
    "percentBase": { "id": 32 }        // 或 { "group": "tea_base" }；有 percentage 料时必给
  } }
```

**校验规则（非法则 400）**：`profile` 必填合法；对应锁定对象必填；`value`/`lockedValue`/`total` 必须 > 0；
`bakersLock.mode` ∈ {anchor,total}；`groups` 非空；每组须有 `total` **或** `lockedId`+`lockedValue`；未知字段拒绝。
引擎守卫失败（缺 anchor / 除零 / 缺 percentBase）→ 400；配方不存在 → 404。

**Response（`data`）— `SpecScaleResult`**：
```jsonc
{
  "recipeId": "uuid",
  "title": "面包",
  "scalingProfile": "bakers_percentage",
  "ingredients": [
    { "id": 11, "ingredientId": 5, "customName": "flour", "groupName": "主料",
      "unit": "g", "scalingRole": "anchor",
      "originalAmount": 500, "scaledAmount": 1000 }   // 均为 number
  ]
}
```

---

## 4. `GET /recipes/:id/scale?servings=N` — 份数缩放（legacy 兼容，保留）

公开；`servings` ≥ 0.01。仅 `linear_legacy` 配方可用；非 legacy → **400**（提示改用 POST）；不存在 → 404。

**Response（`data`）— `ScaleResult`**：
```jsonc
{
  "recipeId": "uuid", "title": "回锅肉",
  "baseServings": 2, "targetServings": 4, "multiplier": 2,
  "ingredients": [
    { "id": 1, "ingredientId": 10, "customName": "主料", "groupName": "主料",
      "unit": "g", "originalAmount": 100, "scaledAmount": 200,     // number
      "scaleType": "linear", "scaleFactor": 0.7,                    // number
      "notes": null, "sort": 0 }
  ]
}
```

---

## 5. `GET /recipes` — 列表（分页）

Query：`page`(默1) / `pageSize`(默20,≤200) / `keyword` / `categoryId` / `mealSceneId` / `status` / `authorId` / `isPublic` / `isFeatured`。公开。

**Response（`data`）— 分页包裹**：
```jsonc
{
  "items": [ /* Recipe 列 + author + categories + categoryIds；无 ingredients/steps */ ],
  "total": 42, "page": 1, "pageSize": 20, "totalPages": 3
}
```
列表 item 额外字段：`author: { id, nickname, avatar } | null`、`categories: {id,name}[]`、`categoryIds: number[]`。

---

## 6. `GET /recipes/:id` — 详情

公开；`:id` uuid，不存在 → 404。

**Response（`data`）** = 完整 Recipe（全字段）+：
- `ingredients: RecipeIngredient[]`（按 sort,id 排序，**每项含注入的 `name`**）
- `steps: RecipeStep[]`（按 stepNumber 排序）
- `author: { id, nickname, avatar } | null`
- `categories: { id, name }[]`
- `categoryIds: number[]`

---

## 7. Auth

### `POST /auth/mock-login`（dev 专用，受 `ALLOW_MOCK_LOGIN` 控制；生产禁用 → 401）
Body：`{ code?: string, nickname?: string, avatar?: string }`
（`code` 默 `"dev"`，同 code → 同用户，externalId=`mock-<code>`，默认昵称 `Dev User <code>`）

### `POST /auth/login`（通用）
Body：`{ provider: string, code: string, nickname?: string, avatar?: string }`

**两者 Response（`data`）相同**：
```jsonc
{
  "token": "<JWT>",
  "user": { "id": "uuid", "nickname": "Dev User alice", "avatar": null, "role": "user" }  // role: 'user'|'vip'
}
```

### `GET /auth/whoami`（需 `Authorization: Bearer <token>`）
**Response（`data`）— JWT payload**：
```jsonc
{ "sub": "uuid", "openid": "string | 省略", "role": "user" | "vip" }
```

---

## 8. AI 智能导入：`POST /recipes/parse-text`

需 `Authorization: Bearer <token>`；限流 **5 次/分钟**/用户（管理端 `POST /admin/recipes/parse-text` 不限流）。
Body：`{ text: string }`（20–5000 字）。

**Response（`data`）**：解析**草稿**，不入库——用户确认后另行 `POST /recipes` 保存。

```jsonc
{
  "parsed": true,
  "confidence": "high" | "medium" | "low",
  "warnings": ["缩放：原料「水」角色不明确，已按百分比联动处理"],  // 恒在；干净时 []
  "originalText": "…",
  "recipe": {
    "title": "乡村面包", "description": "…", "totalMinutes": 180,
    "baseServings": 2, "difficulty": "medium",
    "scalingProfile": "bakers_percentage",          // 恒在；四值之一
    "baseAnchor": { "percentBase": { "ingredientIndex": 1 } } | null,  // 仅 multi_ratio 有 percentage 料时非 null
    "ingredients": [
      { "name": "高筋面粉", "amount": 500, "unit": "g", "groupName": "主料", "scaleType": "linear",
        "scalingRole": "anchor", "percentageValue": 100, "ratioGroup": null, "ratioValue": null }
    ],
    "steps": [ { "stepNumber": 1, "description": "…", "durationSeconds": null } ]
  }
}
```

**缩放字段语义**：
- AI 只做**分类**（profile / 角色 / 分组 / percentBase 指向）；`percentageValue`/`ratioValue` 由服务端从
  amount **确定性重算**（3 位小数），AI 的算术不进入结果。仅当原料无用量而文本给了比例/百分比表述时
  采用 AI 提示值，并附 warning、confidence 降档。
- 缩放分类不自洽（bakers 无 anchor、multi_ratio percentage 料缺 percentBase 等）→ **不报错**：
  整体降级 `scalingProfile:"linear_legacy"`、缩放字段全 null、warnings 说明原因、confidence 强制 low。
  基础解析结果仍可用。
- confidence 联动：缩放有纠偏 → 封顶 medium；整体降级 → 强制 low。
- `baseAnchor.percentBase.ingredientIndex` 是 ingredients 数组下标——确认后把整个 recipe 原样提交
  `POST /recipes` 即可，服务端负责下标→id 重映射（见 §1）。

失败场景：文本不完整（缺标题/食材/步骤）→ 400；AI 服务不可用 → 400；超限流 → 429。
