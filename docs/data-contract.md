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

**RecipeStep**（详情内）：`{ id:number, recipeId:string, stepNumber:number, description:string, imageUrl:string|null, durationSeconds:number|null, tips:string|null, warning:string|null }`

**warning（步骤注意点切片起）**：失败关键提醒（如"前 25 分钟别开烤箱门"），比 tips 高一级、**与 tips 可并存**；
≤256 字，create/update 的 step 项可选提交。已知缺口：admin `updateRecipe` 的**步骤数组编辑**会把 warning 置 null
（admin 步骤映射未含该字段，仅当显式提交 steps 时触发；标量编辑安全）——admin 路径留待后续切片。

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

已注册 provider：`'mock' | 'apple' | 'google'`（未注册值 → 401）。

**`code` 按 provider 语义不同**（字段名叫 code，但 apple/google 传的是 ID token，不是授权码）：
- `apple` → identityToken（JWT，服务端按 `APPLE_CLIENT_ID` 校验签名/aud/exp）
- `google` → idToken（JWT，服务端按 `GOOGLE_{IOS,ANDROID,WEB}_CLIENT_ID` 白名单校验）
- `mock` → 用户种子（同 code → 同用户）

**Apple 首次登录特殊约定**：Apple 仅在用户**首次授权**时返回姓名（identityToken 里永远不含
name claim）。客户端必须在首次授权响应里取到 fullName 并作为 `nickname` 随本次 login 传给
后端；后续登录不传 `nickname`（服务端不会覆盖已存昵称）。Google 无此问题（idToken 自带
name/picture，服务端自动提取，客户端可用 `nickname`/`avatar` 覆盖）。

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
    "steps": [ { "stepNumber": 1, "description": "…", "durationSeconds": null, "warning": "前 25 分钟别开烤箱门" | null } ]
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
- 步骤级 `warning`（单数，per-step）与顶层 `warnings[]`（缩放纠偏说明数组）**是两个不相干的字段**。
  步骤 warning 由 AI **保守提取**：仅"违反即直接导致失败"的操作提醒（别开烤箱门/别开盖类），
  普通技巧不算，拿不准为 null；服务端 trim + 截断 256。

失败场景：文本不完整（缺标题/食材/步骤）→ 400；AI 服务不可用 → 400；
**分钟限流（5 次/分钟）→ 429（稍候重试）；月度配额用尽 → 403（引导升级 PRO，见 §9）**。

---

## 9. 订阅（Billing，FREE/PRO）

层级存储：`users.role`（'user'=FREE / 'vip'=PRO）+ `vipExpiresAt`。**有效角色**在 JWT 校验时折算
（vip 已过期 → 按 user 处理，不写库；`vipExpiresAt=null` 的 vip = 永久 PRO，Lifetime 授予形态）。

**限额**（`common/constants/tier-limits.ts`）：

| | FREE | PRO |
|---|---|---|
| 配方总数（按作者，含草稿） | 10 | 无限 |
| AI 解析（UTC 日历月） | 5 次/月 | 30 次/月（合理使用） |

**错误语义（客户端按 status code 分支）**：`403` = 配额/上限用尽 → 展示升级 PRO CTA；
`429` = 分钟级防滥用限流 → 提示稍候。POST /recipes 与 POST /recipes/parse-text 均适用。

### `GET /billing/status`（需 JWT）
**Response（`data`）**：
```jsonc
{
  "tier": "user" | "vip",
  "vipExpiresAt": "ISO | null",       // null + vip = 永久
  "quotas": {
    "recipes": { "used": 3, "limit": 10 },      // PRO 时 limit 为 null（无限）
    "aiParse": { "used": 2, "limit": 5, "month": "2026-07" }
  }
}
```

### `POST /billing/mock-upgrade` / `POST /billing/mock-downgrade`（需 JWT，dev 专用）
受 `ALLOW_MOCK_LOGIN` 控制（生产禁用 → 403）。upgrade = PRO 30 天；downgrade = 回 FREE。
本地不依赖真实购买即可测 PRO 权益。Response = 新的 billing status。

### `POST /billing/revenuecat/webhook`（server-to-server，客户端勿调）
鉴权：`Authorization` 头全等 `REVENUECAT_WEBHOOK_SECRET`（未配置 fail-closed 401）。
授予事件（INITIAL_PURCHASE/RENEWAL/UNCANCELLATION/PRODUCT_CHANGE/NON_RENEWING_PURCHASE，
entitlement 含 'pro'）→ role=vip + 过期时间（无 expiration_at_ms = 永久，Lifetime 天然支持）；
EXPIRATION → 回 FREE；CANCELLATION/BILLING_ISSUE → no-op（到期前保留）。恒 200（RC 对非 2xx 重试数天）。
已知缺口：无事件审计表/去重（setTier 幂等，接受）。

---

## 10. 原料库（Pantry：我的食材 + 公共建议 + 分类）

### `GET /me/ingredients`（需 JWT）— 我的原料列表

Query：`page`(默1) / `pageSize`(默20,**≤200**) / `categoryId`。按 `updatedAt DESC`。

**Response（`data`）— 分页包裹**，item = UserIngredient 全字段 + enrich：
```jsonc
{
  "items": [{
    "id": 1, "userId": "uuid",
    "ingredientId": 5,            // 关联公共食材；与 customName 二选一
    "customName": null,           // 自定义名（公共库没有时用）
    "unitPrice": "0.0040",        // ⚠️ decimal → string，canonical 单位单价（4 位小数）
    "priceUnit": "g",
    "stockAmount": "500.00",      // ⚠️ decimal → string；null = 未跟踪库存（≠ 已耗尽）
    "stockUnit": "g",
    "notes": null,
    "expiryDate": null,           // "YYYY-MM-DD" | null
    "storageType": null,          // "room_temp" | "refrigerated" | "frozen" | null
    "categoryId": 12,
    "createdAt": "ISO", "updatedAt": "ISO",
    "publicName": "面粉",          // enrich：公共食材名（ingredientId 为 null 时 null）
    "categoryName": "Baking Bench" // enrich：分类名（categoryId 为 null 时 null）
  }],
  "total": 3, "page": 1, "pageSize": 20, "totalPages": 1
}
```
**已耗尽判定（客户端）**：`stockAmount != null && Number(stockAmount) === 0`。

### `GET /me/ingredients/:id`（需 JWT）— 详情（enriched，同上 item 形状）；非本人/不存在 → 404

### `POST /me/ingredients`（需 JWT）— 添加
```jsonc
{
  "ingredientId": 5,        // 或 customName，二选一必填（都缺 → 400）
  "customName": "Bread flour",
  "unitPrice": 0.004,       // number，≥0，最多 4 位小数（发 number，非 string！）
  "priceUnit": "g",
  "stockAmount": 500,       // 可选，number，≥0，最多 2 位小数
  "stockUnit": "g",         // 可选
  "notes": "...",           // 可选，≤256
  "expiryDate": "2026-08-01", // 可选
  "storageType": "room_temp", // 可选
  "categoryId": 12          // 可选；缺省且关联公共食材时继承其分类
}
```
Response = enriched item。

### `PATCH /me/ingredients/:id`（需 JWT）— 更新（同 POST 字段全可选）；`{"stockAmount": 0}` = 标记已耗尽
### `DELETE /me/ingredients/:id`（需 JWT）→ `{ id }`

### `GET /ingredients`（公开）— 公共食材库（添加时的搜索建议）
Query：`page` / `pageSize` / `keyword`（ILike 模糊）/ `categoryId`。
item = Ingredient 全字段 + `categoryName`。注意：`referencePrice` 为 CNY 计价参考（见 §11 货币守卫）。

### `GET /categories?type=ingredient`（OptionalJwt）— 食材分类（系统 + 本人自建）
海外预设（seed，type=ingredient）：`Baking Bench` / `Bean Vault` / `Bar Cabinet`（与国内中文预设并存）。

---

## 11. 成本核算：`POST /cooking/cost`（需 JWT）

按当前（或缩放后）用量估算配方成本。定价优先级：**用户原料库单价（`ingredientId` 精确匹配，
或**归一化名称全等**兜底——去全部空白+小写后全等，无子串/模糊，"糖粉"≠"糖"；覆盖 AI 导入的
customName-only 行）→ 公共库参考价（仅 CNY 部署）→ unknown（0 计入）**。
名称兜底与库存扣减（stock-deduction）同策略；多条同归一名时取 id 最小者（确定性）。

**Request**：
```jsonc
{ "recipeId": "uuid",
  "scale": { "profile": "bakers_percentage",       // 可选；形状 = §3 的 ScaleRequest 判别体
             "bakersLock": { "mode": "total", "value": 1000 } } }
```
- 无 `scale` → 按配方原始用量估算。
- 有 `scale` → 服务端先跑锁定式缩放再算成本（校验规则同 §3：非法 400、配方不存在 404）。

**Response（`data`）— CostBreakdown（⚠️ 数值均为 number，非实体 decimal string）**：
```jsonc
{
  "currency": "USD",          // 由服务端 COST_CURRENCY env 决定（默 CNY）
  "totalCost": 3.85,          // 2 位小数
  "unknownCount": 1,          // 无法定价的行数
  "lines": [{
    "ingredientId": 5, "name": "Bread flour",
    "amount": 650, "unit": "g",
    "unitPrice": 0.004, "priceUnit": "g",   // unknown 行为 null
    "totalCost": 2.6,
    "source": "user_lib"      // "user_lib" | "public_lib" | "unknown"
  }]
}
```

**货币守卫**：`COST_CURRENCY != 'CNY'` 时跳过公共库 `referencePrice` 兜底（种子价为 CNY，
不能冒充其它币种），该行记 `unknown`；用户自录单价视为本币，正常计价。

**门禁**：`COST_PRO_ONLY=true`（env，默 false）时 FREE 用户 → **403** + 升级提示
（同 §9 错误语义：403 → 展示升级 PRO CTA；勿用 401——客户端 401 强制登出）。
