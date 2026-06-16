# 老舅厨房 — 产品需求文档（基于代码反推，生成于 2026-06-08）

---

## 变更历史

| 版本 | 日期 | 主要更新 |
|------|------|---------|
| v1.0 | 2026-06-08（首版） | 从代码反推生成完整 PRD |
| v1.1 | 2026-06-08 | 新增 AI 智能导入（RecipeParseService、RecipeImportView）；新增内容安全检查（WxModule、ContentModule）；管理员首次登录强制改密（must_change_password 字段、AdminChangePasswordView）；管理后台 AI 导入端点（parse-text 不限频）；图片上传内容安全检查集成；小程序 LAN IP 改为环境变量注入；修复 createOfficialRecipe 事务隔离 bug；seed 密码改从 env 读取；生产环境 JWT 占位值启动守卫 |

---

## 一、产品概述

**产品名称**：老舅厨房（Uncle Joe's Kitchen）

**定位**：家庭厨房菜谱管理全栈应用。帮助用户管理私人菜谱、追踪食材库存、核算烹饪成本、规划每周餐单，并生成采购清单。

**访问入口**：
- 微信小程序（uni-app web-view 壳，AppID：`wxe657793473769f5a`）
- React H5 直接访问（`http://localhost:3000`）
- 管理后台（`http://localhost:3000/?admin=1`）

**核心用户流程**：微信扫码 → wx.login → 后端换取 JWT token → H5 URL query 传 token → React 渲染 → 烹饪/管理菜谱/查看食材库

---

## 二、技术架构（含实际依赖版本）

### 2.1 后端 `uncle-joes-kitchen-api/`

| 技术 | 版本 | 说明 |
|------|------|------|
| NestJS | ^10.4.0 | 框架核心 |
| TypeScript | ^5.6.2 | 语言 |
| TypeORM | ^0.3.20 | ORM |
| PostgreSQL (`pg`) | ^8.13.0 | 主数据库，数据库名 `ujk_dev` |
| Redis (`ioredis`) | ^5.4.1 | 计时器状态存储 + 缓存 |
| `cache-manager` | ^5.7.6 | NestJS 缓存抽象层 |
| `cache-manager-ioredis-yet` | ^2.1.1 | Redis 缓存驱动 |
| `@nestjs/jwt` | ^10.2.0 | JWT 签发/验证 |
| `passport-jwt` | ^4.0.1 | Passport JWT 策略 |
| `bcrypt` | ^5.1.1 | 管理员密码哈希 |
| `multer` | ^2.1.1 | 图片上传 |
| `form-data` | — | ContentCheckService 上传图片到微信 API 时使用 |
| `@nestjs/swagger` | ^7.4.0 | Swagger 文档 |
| `qrcode` | ^1.5.4 | 开发环境 QR 码生成 |
| `uuid` | ^10.0.0 | UUID 生成 |
| 版本 | 0.5.0 | package.json `version` |

- **API 全局前缀**：`/api`
- **监听**：`0.0.0.0:3001`
- **Swagger 文档**：`/api-docs`（开发环境）
- **生产安全守卫**：`main.ts` 在 `NODE_ENV=production` 时调用 `assertProductionSecrets()`，JWT_SECRET / ADMIN_JWT_SECRET 为开发占位值或长度 < 32 字符时拒绝启动

### 2.2 前端 `frontend/`

| 技术 | 版本 | 说明 |
|------|------|------|
| React | ^19.0.1 | UI 框架 |
| TypeScript | ~5.8.2 | 语言 |
| Vite | ^6.2.3 | 构建工具 |
| Tailwind CSS | ^4.1.14 | 样式 |
| `lucide-react` | ^0.546.0 | 图标 |
| `recharts` | ^3.8.1 | 图表（管理后台仪表盘） |
| `motion` | ^12.23.24 | 动画（framer-motion 继承者） |
| `i18next` | ^26.3.0 | 国际化框架 |
| `react-i18next` | ^17.0.8 | React 国际化绑定 |
| `@google/genai` | ^2.4.0 | Google AI SDK（package.json 中存在，代码中未见使用；AI 能力实际在后端实现） |
| `express` | ^4.21.2 | 服务端 SSR 服务器 |

- **API 基地址**：动态检测——localhost 使用 `.env.local`（`VITE_API_BASE_URL`），非 localhost 自动切换为 `http://{window.location.hostname}:3001/api`
- **Token 存储**：`localStorage`，key 为 `ujk_token`（用户）和 `ujk_admin_token`（管理员）

### 2.3 小程序 `frontend-miniapp/`

| 技术 | 说明 |
|------|------|
| uni-app 3 + Vue 3 + TypeScript | 框架 |
| web-view 壳模式 | 仅一个页面 `shell.vue`，通过 `<web-view>` 加载 H5 |
| 微信 AppID | `wxe657793473769f5a` |

- **模拟器检测**：`info.platform === "devtools"` → 跳过 wx.login，直接加载 H5
- **LAN IP（v1.1 变更）**：原来硬编码 `"192.168.112.27"`，现已改为从构建时环境变量注入：
  - `.env.development` 设置 `VITE_LAN_IP=192.168.112.27`（或当前电脑 IP）
  - `.env.production` 设置 `VITE_H5_BASE_URL=https://your-domain.com`
  - `shell.vue` 读取 `import.meta.env.VITE_LAN_IP` 和 `import.meta.env.VITE_H5_BASE_URL`

---

## 三、功能模块清单

### 3.1 认证模块（auth）

**描述**：微信小程序登录，基于 code 换取 JWT token；支持 dev mock 登录。

**页面**：无独立页面（通过 `shell.vue` → H5 的 token query 完成）

**API**：
- `POST /api/auth/wx-login` — 传入 wx.login code，返回 JWT token + user 信息；开发环境支持 `mock-xxx` 前缀 code
- `GET /api/auth/whoami` — 调试接口，返回当前 JWT payload（需认证）

**实现状态**：完整实现

---

### 3.2 用户模块（users）

**描述**：用户个人资料管理；支持昵称、头像、自动扣库存开关。

**页面**：`ProfileView`（个人中心）

**API**：
- `GET /api/users/me` — 获取当前登录用户（需认证）
- `PATCH /api/users/me` — 更新用户资料（`nickname`、`avatar`、`autoDeductStock`，需认证）

**实现状态**：完整实现

---

### 3.3 菜谱模块（recipes）

**描述**：菜谱 CRUD，支持多分类、版本快照、公开/推荐标记、AI 文本解析导入、份量动态换算。

**页面**：`HomeView`（菜谱列表）、`RecipeDetailView`（详情）、`CreateRecipeView`（创建/编辑）、`MyRecipesView`（我的菜谱）、`RecipeImportView`（AI 导入）

**API**：
- `GET /api/recipes` — 列表，支持 keyword/categoryId/mealSceneId/status/authorId/isPublic/isFeatured 筛选，分页
- `GET /api/recipes/:id` — 详情（含食材、步骤、作者、多分类）
- `GET /api/recipes/:id/scale` — 份量换算（?targetServings=N）
- `GET /api/recipes/:id/versions` — 历史版本列表
- `POST /api/recipes/parse-text` — AI 解析文本导入（需用户 JWT，限频每用户每分钟 5 次）
- `POST /api/recipes` — 创建菜谱（需认证）
- `PATCH /api/recipes/:id` — 更新菜谱（需认证，仅作者，每次更新生成版本快照）
- `DELETE /api/recipes/:id` — 删除菜谱（需认证，仅作者）
- `POST /api/recipes/batch-delete` — 批量删除（需认证，仅删自己的）

**AI 解析（RecipeParseService）**：
- 调用第三方 AI API（OpenAI Compatible 格式），默认阿里百炼 DashScope，模型 `qwen-plus`
- 配置变量：`AI_PROVIDER`、`AI_API_KEY`、`AI_MODEL`、`AI_API_BASE`（可覆盖 base URL）
- 限频：每用户每分钟 5 次（Redis 计数，key=`recipe_parse_rate:{userId}`，管理员调用传 `skipRateLimit=true` 跳过）
- 返回结构：`{ parsed, confidence: 'high'|'medium'|'low', recipe, originalText }`
- 置信度判断：模糊用量占比 > 50% 或存在过短步骤 → `low`；有模糊用量或缺 totalMinutes/description → `medium`；其余 → `high`
- 食材分组支持 4 种：`主料`、`调料`、`腌料`、`配料`（由 AI system prompt 定义）
- 系统提示词中明确：调味料用 `sub_linear` scaleType，固定用量用 `fixed`，其余 `linear`

**实现状态**：完整实现

---

### 3.4 分类模块（categories）

**描述**：三种分类类型：菜谱分类（recipe）、食材分类（ingredient）、用餐场景（meal_scene）；支持系统分类和用户自建分类。

**页面**：`CreateRecipeView`（选择/创建分类）、`HomeView`（按分类筛选）、`PantryView`（食材分类筛选）

**API**：
- `GET /api/categories` — 分类列表（可选 type 筛选；游客可访问，已登录用户可看自建分类）
- `GET /api/categories/:id` — 分类详情
- `POST /api/categories` — 创建系统分类（需管理员 JWT）
- `POST /api/categories/mine` — 用户创建自己的分类（需用户 JWT）
- `PATCH /api/categories/:id` — 更新分类（需用户 JWT，仅作者）
- `DELETE /api/categories/:id` — 删除分类（需用户 JWT，仅作者）

**Seed 预置分类**：
- 菜谱分类（14个）：中餐、西餐、日料、韩餐、东南亚菜、烘焙、甜点、饮品、轻食、火锅、烧烤、家常菜、下饭菜、快手菜
- 食材分类（11个）：蔬菜、水果、肉禽、海鲜水产、蛋奶、豆制品、粮油、调味品、干货、香料、烘焙原料
- 用餐场景（6个）：早餐、午餐、晚餐、下午茶、夜宵、聚餐

**食材分组（v1.1 变更）**：`recipe_ingredients.groupName` 字段已从实际使用 2 种（主料/调味）扩展为支持 4 种：`主料`、`腌料`、`配料`、`调料`。`RecipeDetailView` 按真实 `groupName` 动态分组展示，`CreateRecipeView` 食材行分组下拉选项增至 4 种。

**实现状态**：完整实现

---

### 3.5 公共食材库模块（ingredients）

**描述**：官方食材库，支持别名、热量、参考价格；仅管理员可写。

**页面**：无独立用户页面（在 `CreateRecipeView` 搜索时使用）

**API**：
- `GET /api/ingredients` — 公共食材列表（keyword/categoryId 筛选，分页）
- `GET /api/ingredients/:id` — 公共食材详情
- `POST /api/ingredients` — 创建食材（需管理员 JWT）
- `PATCH /api/ingredients/:id` — 更新食材（需管理员 JWT）
- `DELETE /api/ingredients/:id` — 删除食材（需管理员 JWT）

**Seed 预置食材**：约 60 条，覆盖蔬菜/水果/肉禽/海鲜/蛋奶/豆制品/粮油/调味品/香料等，均含参考价格（单位：元/斤 或 元/个）。

**实现状态**：完整实现

---

### 3.6 用户食材库模块（me/ingredients）

**描述**：用户私人食材库，记录采购价、库存数量、保质期、储存方式、食材分类。支持关联公共食材库（ingredientId）或自定义食材名（customName）。

**页面**：`PantryView`（食材库页面）

**API**：
- `GET /api/me/ingredients` — 我的食材库列表（可按 categoryId 筛选，分页）
- `GET /api/me/ingredients/:id` — 食材详情（enriched，含公共名称）
- `POST /api/me/ingredients` — 添加食材
- `PATCH /api/me/ingredients/:id` — 更新食材
- `DELETE /api/me/ingredients/:id` — 删除食材

**实现状态**：完整实现

---

### 3.7 烹饪模块（cooking）

**描述**：SOP 烹饪流程，包括成本预览、烹饪记录落库、库存扣减、撤销扣减；所有操作需用户认证。

**页面**：`SopView`（SOP 烹饪模式）、`ProfileView`（查看烹饪历史）

**API**：
- `POST /api/cooking/preview` — 成本预览（换算用量 + 估算成本，不落库）
- `POST /api/cooking/deduction-preview` — 库存扣减预检（返回食材匹配 + 缺口情况）
- `POST /api/cooking/undo-deduction` — 撤销最近一次自动扣减（30 秒内有效）
- `POST /api/cooking/logs` — 记录烹饪（落库，如开启自动扣库存则一并扣减）
- `GET /api/cooking/logs` — 我的烹饪历史（分页）
- `GET /api/cooking/logs/:id` — 烹饪记录详情（含成本明细）
- `DELETE /api/cooking/logs/:id` — 删除烹饪记录

**自动扣库存逻辑**：
- 用户设置 `autoDeductStock=true` 后，`POST /cooking/logs` 完成时触发
- 扣减量 = `min(菜谱需要量, 库存量)`，按 canonical 单位对齐（g/ml/count）
- 撤销快照存 Redis，key=`undo:userId:logId`，TTL=30s

**库存扣减匹配优先级**：
1. ingredientId 精确匹配
2. customName 模糊匹配（忽略空格 + 小写）
3. 反向：ingredientId 已知 → 公共名 → 匹配 pantry.customName

**实现状态**：完整实现

---

### 3.8 计时器模块（timers）

**描述**：多线程烹饪计时器，状态存 Redis（TTL 24h），每用户最多 8 个计时器并行。

**页面**：`TimerView`（计时器页面）

**API**：
- `POST /api/timers` — 启动计时器（label、durationSeconds、可选 recipeId/stepNumber）
- `GET /api/timers` — 我的活跃计时器（含实时剩余秒数）
- `GET /api/timers/:id` — 计时器详情
- `POST /api/timers/:id/pause` — 暂停
- `POST /api/timers/:id/resume` — 恢复
- `POST /api/timers/:id/reset` — 重置（重新开始）
- `DELETE /api/timers/:id` — 删除计时器

**计时器状态**：`running`、`paused`、`finished`

**实现状态**：完整实现（状态纯 Redis，不持久化到 PostgreSQL）

---

### 3.9 收藏模块（favorites）

**描述**：菜谱收藏，支持 toggle（添加/取消）、批量查询收藏状态。

**页面**：`HomeView`（收藏 Tab）、`DiscoverView`（收藏操作）

**API**：
- `GET /api/favorites` — 我的收藏列表（分页）
- `POST /api/favorites/:recipeId` — 切换收藏状态（toggle）
- `DELETE /api/favorites/:recipeId` — 取消收藏
- `POST /api/favorites/check` — 批量查询收藏状态（最多 100 个 recipeId）

**实现状态**：完整实现

---

### 3.10 分享模块（share）

**描述**：生成菜谱分享小程序码（短码 + QR 图片），解析场景码→recipeId。

**页面**：`RecipeDetailView`（分享入口）、`SharePosterModal`（分享海报）

**API**：
- `POST /api/share/qrcode` — 生成菜谱分享小程序码（需用户认证；Dev 环境用 qrcode npm 包生成普通 QR，生产环境调用微信 getUnlimitedQRCode API）
- `GET /api/share/resolve?scene=xxx` — 解析分享码 → recipeId（无需认证）

**QR 码存储**：图片保存到 `./uploads/` 目录，路径 `/uploads/qrcode-{shortCode}.png`；访问 token 缓存 24h（Redis）

**微信 Access Token 管理（v1.1 新增）**：新增 `WxModule`（全局模块）和 `WxAccessTokenService`：
- 调用微信 `/cgi-bin/token` 获取 access_token，缓存到 Redis（key=`wx:access_token`，TTL=7000s，比微信 7200s 提前 200s 刷新）
- 开发 mock 环境（`ALLOW_MOCK_LOGIN=true` 或 `NODE_ENV=development`）下直接抛友好错误，不实际调用微信
- WxModule 注解为 `@Global()`，可直接注入到任意其他模块

**实现状态**：完整实现；生产环境调用微信 API 需配置 `WX_APPID` + `WX_SECRET`

---

### 3.11 采购清单模块（shopping-list）

**描述**：根据多道菜谱（指定份数）生成采购清单，自动合并食材、换算单位、对比库存、估算成本。

**页面**：`ShoppingListView`（采购清单页面）

**API**：
- `POST /api/shopping-list/generate` — 生成采购清单（需用户认证）
  - 输入：`items: [{recipeId, servings}]`
  - 输出：按食材分类分组，含库存状态（inStock/stockAmount/deficit）、估算成本、来源菜谱

**实现状态**：完整实现

---

### 3.12 餐单规划模块（meal-plans）

**描述**：每周餐单规划，支持按日期+餐次（早/午/晚/加餐）添加菜谱，并一键生成采购清单。

**页面**：`MealPlanView`（餐单规划页面）

**API**：
- `POST /api/meal-plans` — 添加餐单项（planDate、mealType、recipeId、servings）
- `GET /api/meal-plans` — 查询餐单（?startDate=&endDate=）
- `DELETE /api/meal-plans/:id` — 删除餐单项
- `POST /api/meal-plans/to-shopping-list` — 把某周餐单转成采购清单

**实现状态**：完整实现

---

### 3.13 图片上传模块（uploads）

**描述**：图片上传到本地 `./uploads/` 目录，返回相对路径，前端拼接完整 URL。上传前进行微信内容安全检查（生产环境）。

**页面**：`CreateRecipeView`（封面/步骤图）、`ProfileView`（头像）

**API**：
- `POST /api/uploads/image` — 上传图片（需用户或管理员 JWT）
  - 接受：`multipart/form-data`，字段名 `file`
  - 支持格式：`image/jpeg`、`image/png`、`image/webp`、`image/gif`
  - 最大文件：5MB（由 `MAX_FILE_SIZE` env 控制）
  - 返回：`{ url, filename, size, mimetype }`，url 格式为 `/uploads/{uuid}.{ext}`
  - **v1.1 变更**：`AuthGuard` 改为数组形式 `['jwt', 'admin-jwt']`，用户 token 和管理员 token 均可访问；上传完成后调用 `ContentCheckService.checkImage()`，检查不通过则删除文件并返回 400

**实现状态**：完整实现

---

### 3.14 管理后台模块（admin）

**描述**：独立认证体系（admin_users 表，独立 JWT secret），访问入口 `?admin=1`；功能覆盖仪表盘、菜谱管理（含 AI 导入）、用户管理、食材管理、分类管理。

**页面**：
- `AdminLoginView`（管理员登录）
- `AdminChangePasswordView`（首次登录强制改密，v1.1 新增）
- `AdminDashboardView`（管理后台，Tab 数量：仪表盘、菜谱管理、AI 智能导入、创建菜谱、用户管理、食材管理、分类管理，v1.1 新增 AI 导入 Tab 和批量模式）

**认证流程（v1.1 变更）**：
1. `POST /api/admin/auth/login` 登录成功后，响应中包含 `mustChangePassword` 字段
2. 前端 `App.tsx` 检测：若 `adminUser.mustChangePassword === true`，拦截并渲染 `AdminChangePasswordView`，不允许进入 Dashboard
3. 管理员完成改密后，`mustChangePassword` 置为 false，自动进入 Dashboard

**认证 API**：
- `POST /api/admin/auth/login` — 管理员登录（用户名+密码）；响应含 `mustChangePassword`
- `POST /api/admin/auth/change-password` — 修改管理员密码（需管理员 JWT；验证旧密码 + 新密码 ≥ 8 位 + 不与旧密码相同；成功后 `mustChangePassword` 置 false）
- `GET /api/admin/auth/whoami` — 当前管理员信息（需管理员 JWT）

**数据统计**：
- `GET /api/admin/stats` — 总览统计（users/recipes/cooking/ingredients/categories 各项总量和今日新增）

**菜谱管理**：
- `GET /api/admin/recipes` — 菜谱列表（支持 status/authorId/categoryId/isFeatured/dateFrom/dateTo 筛选）
- `GET /api/admin/recipes/:id` — 菜谱详情
- `POST /api/admin/recipes/official` — 以"老舅官方"身份创建菜谱（v1.1 修复事务隔离 bug）
- `POST /api/admin/recipes/parse-text` — AI 解析菜谱文本（需管理员 JWT，不限频率）
- `PATCH /api/admin/recipes/:id` — 更新菜谱（全量替换食材/步骤）
- `PATCH /api/admin/recipes/:id/status` — 改菜谱状态（draft/published/archived）
- `PUT /api/admin/recipes/:id/feature` — 设置/取消官方推荐（isFeatured）
- `POST /api/admin/recipes/batch-archive` — 批量归档
- `POST /api/admin/recipes/batch-delete` — 批量删除
- `DELETE /api/admin/recipes/:id` — 删除单个菜谱

**用户管理**：
- `GET /api/admin/users` — 用户列表（role/status/dateFrom/dateTo 筛选）
- `GET /api/admin/users/:id` — 用户详情（含近期菜谱与烹饪记录）
- `PATCH /api/admin/users/:id/role` — 设置角色（user/vip）
- `PATCH /api/admin/users/:id/status` — 封禁/解封用户（active/banned）
- `POST /api/admin/users/:id/vip` — 设置/移除 VIP（传 null 移除）
- `DELETE /api/admin/users/:id` — 删除用户

**食材管理**：
- `GET /api/admin/ingredients` — 食材列表（含分类名、别名、热量）
- `GET /api/admin/ingredients/:id` — 食材详情
- `POST /api/admin/ingredients` — 创建食材
- `PATCH /api/admin/ingredients/:id` — 更新食材
- `DELETE /api/admin/ingredients/:id` — 删除食材
- `POST /api/admin/ingredients/import-csv` — CSV 批量导入（支持 name/categoryId/defaultUnit/referencePrice/referenceUnit/aliases/calories 列）

**分类管理**：
- `GET /api/admin/categories` — 分类列表
- `POST /api/admin/categories` — 创建系统分类
- `PATCH /api/admin/categories/:id` — 更新分类
- `PUT /api/admin/categories/:id/enabled` — 启用/禁用分类
- `DELETE /api/admin/categories/:id` — 删除分类
- `POST /api/admin/categories/reorder` — 批量调整排序

**Seed 预置管理员（v1.1 变更）**：
- username: `laojiu_admin`，password: **从 `ADMIN_SEED_PASSWORD` 环境变量读取**（不再硬编码；若 env 未设置或为占位值 `change-me-strong-password` 则 seed 报错拒绝执行）
- 新建账号的 `mustChangePassword` 默认为 `true`（seed 中未显式设置，依赖数据库字段默认值）
- "老舅官方"虚拟用户（openid=null，用于创建官方菜谱）

**实现状态**：完整实现

---

### 3.15 内容安全检查模块（content）—— v1.1 新增

**描述**：封装微信内容安全 API（`msg_sec_check` 文本检查、`img_sec_check` 图片检查），供上传模块和其他业务模块调用。

**核心服务**：`ContentCheckService`
- 调用 `WxAccessTokenService` 获取 access_token
- 开发 mock 环境（`ALLOW_MOCK_LOGIN=true` 或 `NODE_ENV=development`）跳过检查，直接返回 `{ safe: true }`
- token 获取失败或微信接口异常时，均返回 `{ safe: true }` 放行，避免误伤用户
- 图片检查完成后自动删除临时文件（`check-image` 接口仅做检查，不保留上传文件）

**API**：
- `POST /api/content/check-text` — 文本安全检查（需用户或管理员 JWT）
  - body: `{ content: string }` (1-2500字)
  - 调用微信 `msg_sec_check`；v2 API：`errcode=0 且 result.label=100` 为安全
- `POST /api/content/check-image` — 图片安全检查（需用户或管理员 JWT，multipart）
  - field: `file`（最大 10MB，同支持 jpeg/png/webp/gif）
  - 调用微信 `img_sec_check`；检查完毕立即删除服务器临时文件

**DTO**：
- `CheckTextDto`：`content`（string，1-2500字）
- `CheckTextWithSkipDto`：继承 `CheckTextDto`，额外可选字段 `skipCheck?: boolean`（管理员专用）

**实现状态**：完整实现（开发环境自动 mock）

---

## 四、数据库设计（所有表字段，从 entity 精确提取）

### 4.1 `users` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 主键，自动生成 |
| openid | varchar(64) nullable, unique | 微信 openid |
| unionid | varchar(64) nullable | 微信 unionid |
| nickname | varchar(64) default '吃货' | 昵称 |
| avatar | varchar(512) nullable | 头像 URL |
| role | varchar(16) default 'user' | 角色：`user` / `vip` |
| status | varchar(16) default 'active', indexed | 状态：`active` / `banned` |
| vipExpiresAt | timestamptz nullable | VIP 到期时间 |
| autoDeductStock | boolean default false | 烹饪后自动扣库存 |
| lastLoginAt | timestamptz nullable | 最后登录时间 |
| createdAt | timestamptz | 创建时间 |
| updatedAt | timestamptz | 更新时间 |

**索引**：`openid`（唯一），`status`

---

### 4.2 `recipes` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 主键，自动生成 |
| authorId | uuid, indexed | 作者 userId |
| title | varchar(128) | 菜谱标题 |
| description | text nullable | 描述 |
| coverImage | varchar(512) nullable | 封面图 URL |
| categoryId | int nullable, indexed | 主分类 id（向后兼容，推荐使用 recipe_categories 表） |
| mealSceneId | int nullable | 用餐场景 id |
| baseServings | int default 2 | 基础份数 |
| difficulty | varchar(16) default 'medium' | 难度：`easy` / `medium` / `hard` |
| totalMinutes | int nullable | 总耗时（分钟） |
| status | varchar(16) default 'draft' | 状态：`draft` / `published` / `archived` |
| tags | jsonb default '[]' | 自定义标签数组 |
| isPublic | boolean default false | 是否公开到发现页 |
| isFeatured | boolean default false | 是否官方推荐 |
| viewCount | int default 0 | 浏览量 |
| versionCount | int default 0 | 版本计数 |
| createdAt | timestamptz | 创建时间 |
| updatedAt | timestamptz | 更新时间 |

**关联**：`OneToMany → recipe_ingredients`；`OneToMany → recipe_steps`
**索引**：`authorId`、`status`、`categoryId`

---

### 4.3 `recipe_ingredients` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| recipeId | uuid, indexed, ManyToOne(CASCADE) | 关联菜谱 |
| ingredientId | int nullable | 关联公共食材库 id |
| customName | varchar(64) nullable | 自定义食材名（二选一） |
| amount | decimal(10,2) | 用量 |
| unit | varchar(16) | 单位 |
| scaleType | varchar(16) default 'linear' | 换算类型：`linear` / `sub_linear` / `fixed` |
| scaleFactor | decimal(4,2) default 0.7 | 换算因子（sub_linear 时使用） |
| groupName | varchar(32) nullable | 分组名：`主料` / `腌料` / `配料` / `调料`（v1.1：从2种扩至4种） |
| notes | varchar(128) nullable | 备注 |
| sort | int default 0 | 排序 |

**索引**：`recipeId`

---

### 4.4 `recipe_steps` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| recipeId | uuid, indexed, ManyToOne(CASCADE) | 关联菜谱 |
| stepNumber | int | 步骤编号 |
| description | text | 步骤描述 |
| imageUrl | varchar(512) nullable | 步骤图 URL |
| durationSeconds | int nullable | 此步骤计时秒数（可选） |
| tips | varchar(256) nullable | 小贴士 |

**索引**：`recipeId`

---

### 4.5 `recipe_versions` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 主键 |
| recipeId | uuid, indexed | 关联菜谱 |
| versionNumber | int | 版本号 |
| editorId | uuid | 编辑者 userId |
| snapshot | jsonb | 版本快照（完整菜谱 JSON） |
| changeNote | varchar(256) nullable | 变更备注 |
| createdAt | timestamptz | 创建时间 |

**复合索引**：`(recipeId, versionNumber)`

---

### 4.6 `recipe_categories` 表（多对多关联）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| recipeId | uuid | 关联菜谱 |
| categoryId | int | 关联分类 |

**索引**：`(recipeId, categoryId)`（唯一）、`categoryId`

---

### 4.7 `categories` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| type | varchar(16) | 类型：`recipe` / `ingredient` / `meal_scene` |
| name | varchar(32) | 分类名 |
| icon | varchar(32) nullable | 图标 |
| sort | int default 0 | 排序 |
| enabled | boolean default true | 是否启用 |
| ownerId | uuid nullable | 用户自建分类的作者 id；系统分类为 null |
| createdAt | timestamptz | 创建时间 |
| updatedAt | timestamptz | 更新时间 |

**唯一索引**：`(type, ownerId, name)`

---

### 4.8 `ingredients` 表（公共食材库）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| name | varchar(64) unique | 食材名称 |
| categoryId | int nullable | 关联食材分类 |
| defaultUnit | varchar(16) default 'g' | 默认单位 |
| referencePrice | decimal(10,2) nullable | 参考单价 |
| referenceUnit | varchar(16) nullable | 参考单价对应单位（如"斤"） |
| imageUrl | varchar(512) nullable | 食材图 URL |
| defaultScaleType | varchar(16) default 'linear' | 默认换算类型 |
| aliases | jsonb default '[]' | 别名列表，如 `["土豆","洋芋"]` |
| calories | decimal(8,2) nullable | 每100g热量 (kcal) |
| sort | int default 0 | 排序 |
| createdAt | timestamptz | 创建时间 |
| updatedAt | timestamptz | 更新时间 |

**索引**：`name`（唯一）

---

### 4.9 `user_ingredients` 表（用户食材库）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| userId | uuid | 用户 id |
| ingredientId | int nullable | 关联公共食材 id |
| customName | varchar(64) nullable | 自定义食材名（与 ingredientId 二选一） |
| unitPrice | decimal(12,4) | 单价（canonical 单位，最多4位小数） |
| priceUnit | varchar(16) | 单价对应单位（如 g / 斤 / 个） |
| stockAmount | decimal(10,2) nullable | 库存数量 |
| stockUnit | varchar(16) nullable | 库存单位 |
| notes | varchar(256) nullable | 备注（前端将供应商存入 `供应商: xxx` 格式） |
| expiryDate | date nullable | 保质期/到期日（YYYY-MM-DD） |
| storageType | varchar(16) nullable | 储存方式：`room_temp` / `refrigerated` / `frozen` |
| categoryId | int nullable | 食材分类 id（references categories where type=ingredient） |
| createdAt | timestamptz | 创建时间 |
| updatedAt | timestamptz | 更新时间 |

**索引**：`(userId, ingredientId)`、`(userId, customName)`

---

### 4.10 `cooking_logs` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 主键 |
| userId | uuid | 用户 id |
| recipeId | uuid | 关联菜谱 id |
| recipeTitle | varchar(128) | 菜谱标题（冗余存储，避免菜谱删除后丢失） |
| servings | decimal(6,2) | 实际做的份数 |
| durationMinutes | int nullable | 实际耗时（分钟） |
| rating | int nullable | 评分（1-5） |
| notes | varchar(512) nullable | 备注 |
| totalCost | decimal(10,2) default 0.00 | 总成本（CNY） |
| currency | varchar(16) default 'CNY' | 货币 |
| cookedAt | timestamptz | 烹饪时间 |
| createdAt | timestamptz | 创建时间 |

**关联**：`OneToMany → cooking_log_costs`
**索引**：`(userId, cookedAt)`、`recipeId`

---

### 4.11 `cooking_log_costs` 表（烹饪成本明细）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| logId | uuid, ManyToOne(CASCADE) | 关联烹饪记录 |
| ingredientId | int nullable | 食材 id |
| name | varchar(64) | 食材名（展示用） |
| amount | decimal(10,2) | 用量 |
| unit | varchar(16) | 单位 |
| unitPrice | decimal(10,4) nullable | 单价 |
| priceUnit | varchar(16) nullable | 单价单位 |
| totalCost | decimal(10,2) default 0.00 | 小计成本 |
| source | varchar(16) default 'unknown' | 价格来源：`user_lib` / `public_lib` / `unknown` |

**索引**：`logId`

---

### 4.12 `favorites` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| userId | uuid | 用户 id |
| recipeId | uuid | 菜谱 id |
| createdAt | timestamptz | 收藏时间 |

**索引**：`(userId, recipeId)`（唯一）、`userId`

---

### 4.13 `share_codes` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (PK, auto increment) | 主键 |
| shortCode | varchar(32) unique | 8字符短码（base64url）|
| recipeId | uuid, indexed | 关联菜谱 id |
| qrcodeUrl | varchar(512) nullable | QR 码图片 URL |
| createdAt | timestamptz | 创建时间 |

---

### 4.14 `meal_plans` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 主键 |
| userId | uuid | 用户 id |
| planDate | date | 规划日期（YYYY-MM-DD） |
| mealType | varchar(20) | 餐次：`breakfast` / `lunch` / `dinner` / `snack` |
| recipeId | uuid, ManyToOne(CASCADE) | 关联菜谱 |
| servings | decimal(6,2) default 1 | 份数 |
| createdAt | timestamptz | 创建时间 |

**唯一约束**：`(userId, planDate, mealType, recipeId)`
**索引**：`(userId, planDate)`

---

### 4.15 `admin_users` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 主键 |
| username | varchar(64) unique | 用户名 |
| password_hash | varchar(255) | bcrypt 密码哈希 |
| nickname | varchar(64) nullable | 昵称 |
| email | varchar(128) nullable | 邮箱 |
| role | varchar(20) default 'admin' | 角色：`admin` / `super_admin` |
| last_login_at | timestamptz nullable | 最后登录时间 |
| must_change_password | boolean default true | **v1.1 新增**：首次登录强制改密标志；seed 创建的新账号默认 true，迁移时存量账号设为 false |
| created_at | timestamptz | 创建时间 |

**注意**：此表字段名用 snake_case（使用了 `@Column({ name: 'password_hash' })` 等显式 name 映射）

---

## 五、API 接口完整清单

> 前缀 `/api` 已包含在所有路径中。鉴权说明：`用户JWT` = 用户端 JWT（`Authorization: Bearer {token}`）；`管理员JWT` = 管理员独立 JWT；`用户/管理员JWT` = 二者均接受（AuthGuard 数组）；`可选JWT` = 未登录也可访问，登录后可见额外内容。

### 5.1 认证（auth）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/auth/wx-login` | body: `{code, nickname?, avatar?}` | 无 | 微信登录 |
| GET | `/api/auth/whoami` | - | 用户JWT | 调试接口，返回当前 JWT payload |

### 5.2 用户（users）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| GET | `/api/users/me` | - | 用户JWT | 获取当前用户信息 |
| PATCH | `/api/users/me` | body: `{nickname?, avatar?, autoDeductStock?}` | 用户JWT | 更新用户资料 |

### 5.3 菜谱（recipes）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| GET | `/api/recipes` | query: page/pageSize/keyword/categoryId/mealSceneId/status/authorId/isPublic/isFeatured | 无 | 菜谱列表（分页） |
| GET | `/api/recipes/:id` | - | 无 | 菜谱详情（含食材、步骤、作者、分类） |
| GET | `/api/recipes/:id/scale` | query: `targetServings` | 无 | 份量换算 |
| GET | `/api/recipes/:id/versions` | - | 无 | 版本历史列表 |
| POST | `/api/recipes/parse-text` | body: `{text}` (20-5000字) | 用户JWT | AI 文本解析导入（限频 5次/min/用户） |
| POST | `/api/recipes` | body: CreateRecipeDto | 用户JWT | 创建菜谱 |
| PATCH | `/api/recipes/:id` | body: UpdateRecipeDto | 用户JWT | 更新菜谱（仅作者） |
| DELETE | `/api/recipes/:id` | - | 用户JWT | 删除菜谱（仅作者） |
| POST | `/api/recipes/batch-delete` | body: `{ids: string[]}` | 用户JWT | 批量删除（只删自己的） |

### 5.4 分类（categories）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| GET | `/api/categories` | query: page/pageSize/type | 可选JWT | 分类列表 |
| GET | `/api/categories/:id` | - | 无 | 分类详情 |
| POST | `/api/categories` | body: `{type, name, icon?, sort?}` | 管理员JWT | 创建系统分类 |
| POST | `/api/categories/mine` | body: `{type, name, icon?, sort?}` | 用户JWT | 用户创建自己的分类 |
| PATCH | `/api/categories/:id` | body: UpdateCategoryDto | 用户JWT | 更新分类（仅作者） |
| DELETE | `/api/categories/:id` | - | 用户JWT | 删除分类（仅作者） |

### 5.5 公共食材库（ingredients）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| GET | `/api/ingredients` | query: page/pageSize/keyword/categoryId | 无 | 公共食材列表 |
| GET | `/api/ingredients/:id` | - | 无 | 公共食材详情 |
| POST | `/api/ingredients` | body: CreateIngredientDto | 管理员JWT | 创建食材 |
| PATCH | `/api/ingredients/:id` | body: UpdateIngredientDto | 管理员JWT | 更新食材 |
| DELETE | `/api/ingredients/:id` | - | 管理员JWT | 删除食材 |

### 5.6 用户食材库（me/ingredients）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| GET | `/api/me/ingredients` | query: page/pageSize/categoryId | 用户JWT | 我的食材库列表 |
| GET | `/api/me/ingredients/:id` | - | 用户JWT | 食材详情 |
| POST | `/api/me/ingredients` | body: CreateUserIngredientDto | 用户JWT | 添加到食材库 |
| PATCH | `/api/me/ingredients/:id` | body: UpdateUserIngredientDto | 用户JWT | 更新食材 |
| DELETE | `/api/me/ingredients/:id` | - | 用户JWT | 从食材库移除 |

### 5.7 烹饪（cooking）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/cooking/preview` | body: `{recipeId, servings}` | 用户JWT | 成本预览（不落库） |
| POST | `/api/cooking/deduction-preview` | body: `{recipeId, servings}` | 用户JWT | 库存扣减预检 |
| POST | `/api/cooking/undo-deduction` | body: `{undoToken}` | 用户JWT | 撤销扣减（30s内） |
| POST | `/api/cooking/logs` | body: CreateCookingLogDto | 用户JWT | 记录烹饪 |
| GET | `/api/cooking/logs` | query: page/pageSize | 用户JWT | 我的烹饪历史 |
| GET | `/api/cooking/logs/:id` | - | 用户JWT | 烹饪记录详情（含成本明细） |
| DELETE | `/api/cooking/logs/:id` | - | 用户JWT | 删除烹饪记录 |

### 5.8 计时器（timers）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/timers` | body: `{label, durationSeconds, recipeId?, stepNumber?}` | 用户JWT | 启动计时器（max 6h=21600s） |
| GET | `/api/timers` | - | 用户JWT | 活跃计时器列表（含剩余秒数） |
| GET | `/api/timers/:id` | - | 用户JWT | 计时器详情 |
| POST | `/api/timers/:id/pause` | - | 用户JWT | 暂停 |
| POST | `/api/timers/:id/resume` | - | 用户JWT | 恢复 |
| POST | `/api/timers/:id/reset` | - | 用户JWT | 重置 |
| DELETE | `/api/timers/:id` | - | 用户JWT | 删除 |

### 5.9 收藏（favorites）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| GET | `/api/favorites` | query: page/pageSize | 用户JWT | 我的收藏列表 |
| POST | `/api/favorites/:recipeId` | - | 用户JWT | 切换收藏状态（toggle） |
| DELETE | `/api/favorites/:recipeId` | - | 用户JWT | 取消收藏 |
| POST | `/api/favorites/check` | body: `{recipeIds: string[]}` (max 100) | 用户JWT | 批量查询收藏状态 |

### 5.10 分享（share）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/share/qrcode` | body: `{recipeId}` | 用户JWT | 生成分享小程序码 |
| GET | `/api/share/resolve` | query: `scene` | 无 | 解析分享码 → recipeId |

### 5.11 采购清单（shopping-list）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/shopping-list/generate` | body: `{items: [{recipeId, servings}]}` | 用户JWT | 生成采购清单 |

### 5.12 餐单规划（meal-plans）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/meal-plans` | body: `{planDate, mealType, recipeId, servings?}` | 用户JWT | 添加餐单项 |
| GET | `/api/meal-plans` | query: `startDate, endDate` | 用户JWT | 查询餐单 |
| DELETE | `/api/meal-plans/:id` | - | 用户JWT | 删除餐单项 |
| POST | `/api/meal-plans/to-shopping-list` | body: `{startDate, endDate}` | 用户JWT | 餐单转采购清单 |

### 5.13 图片上传（uploads）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/uploads/image` | form: `file` (multipart) | 用户/管理员JWT | 上传图片（max 5MB，含内容安全检查） |

### 5.14 内容安全（content）—— v1.1 新增

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/content/check-text` | body: `{content}` (1-2500字) | 用户/管理员JWT | 文本内容安全检查（微信 msg_sec_check） |
| POST | `/api/content/check-image` | form: `file` (multipart, max 10MB) | 用户/管理员JWT | 图片内容安全检查（微信 img_sec_check，检查后删除临时文件） |

### 5.15 管理后台认证（admin/auth）

| 方法 | 路径 | 参数 | 鉴权 | 说明 |
|------|------|------|------|------|
| POST | `/api/admin/auth/login` | body: `{username, password}` | 无 | 管理员登录；响应含 `mustChangePassword` |
| POST | `/api/admin/auth/change-password` | body: `{currentPassword, newPassword}` | 管理员JWT | 修改管理员密码（v1.1 新增） |
| GET | `/api/admin/auth/whoami` | - | 管理员JWT | 当前管理员信息 |

### 5.16 管理后台功能（admin）

（所有接口均需 `管理员JWT`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/stats` | 总览统计 |
| GET | `/api/admin/recipes` | 菜谱列表（高级筛选） |
| GET | `/api/admin/recipes/:id` | 菜谱详情 |
| POST | `/api/admin/recipes/official` | 以"老舅官方"创建菜谱 |
| POST | `/api/admin/recipes/parse-text` | AI 解析菜谱文本（不限频率，v1.1 新增） |
| PATCH | `/api/admin/recipes/:id` | 更新菜谱 |
| PATCH | `/api/admin/recipes/:id/status` | 改状态（draft/published/archived） |
| PUT | `/api/admin/recipes/:id/feature` | 设置/取消官方推荐 |
| POST | `/api/admin/recipes/batch-archive` | 批量归档 |
| POST | `/api/admin/recipes/batch-delete` | 批量删除 |
| DELETE | `/api/admin/recipes/:id` | 删除单个菜谱 |
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/users/:id` | 用户详情 |
| PATCH | `/api/admin/users/:id/role` | 设置角色 |
| PATCH | `/api/admin/users/:id/status` | 封禁/解封 |
| POST | `/api/admin/users/:id/vip` | 设置/移除 VIP |
| DELETE | `/api/admin/users/:id` | 删除用户 |
| GET | `/api/admin/ingredients` | 食材列表 |
| GET | `/api/admin/ingredients/:id` | 食材详情 |
| POST | `/api/admin/ingredients` | 创建食材 |
| PATCH | `/api/admin/ingredients/:id` | 更新食材 |
| DELETE | `/api/admin/ingredients/:id` | 删除食材 |
| POST | `/api/admin/ingredients/import-csv` | CSV 批量导入食材 |
| GET | `/api/admin/categories` | 分类列表 |
| POST | `/api/admin/categories` | 创建系统分类 |
| PATCH | `/api/admin/categories/:id` | 更新分类 |
| PUT | `/api/admin/categories/:id/enabled` | 启用/禁用分类 |
| DELETE | `/api/admin/categories/:id` | 删除分类 |
| POST | `/api/admin/categories/reorder` | 批量调整排序 |

---

## 六、页面清单（路径/功能/关联接口/实现状态）

> 前端采用单页应用（SPA）状态机路由，不是 URL 路由。下表"路径"列为 `ViewState` 标识符。

| 视图状态 | 组件名 | 功能 | 关联 API | 底部导航 |
|---------|--------|------|---------|---------|
| `home` | `HomeView` | 菜谱列表、搜索、分类筛选、批量管理、收藏/创建的 Tab、FAB 展开菜单（手动创建/AI 智能导入，v1.1 变更） | `GET /recipes`、`GET /categories`、`POST /recipes/batch-delete` | 是（首页图标） |
| `discover` | `DiscoverView` | 公开菜谱浏览、搜索、收藏操作 | `GET /recipes?isPublic=true`、`POST /favorites/:id`、`POST /favorites/check` | 是（发现图标） |
| `timers` | `TimerView` | 计时器管理、滚轮选择器（时/分/秒）、多计时器并行 | `GET /timers`、`POST /timers`、`POST /timers/:id/pause`、`POST /timers/:id/resume`、`POST /timers/:id/reset`、`DELETE /timers/:id` | 是（计时器图标） |
| `pantry` | `PantryView` | 食材库列表（在库/已耗尽）、编辑底部弹窗、搜索、按分类筛选 | `GET /me/ingredients`、`GET /categories?type=ingredient`、`POST /me/ingredients`、`PATCH /me/ingredients/:id`、`DELETE /me/ingredients/:id`、`GET /ingredients`（搜索） | 是（食材库图标） |
| `profile` | `ProfileView` | 个人中心、统计数字、烹饪历史、自动扣库存开关、菜单入口、头像昵称编辑 | `GET /users/me`、`PATCH /users/me`、`GET /cooking/logs`、`POST /uploads/image` | 是（我的图标） |
| `detail` | `RecipeDetailView` | 菜谱详情（食材按真实 groupName 动态分组，v1.1 变更）、步骤、份量调节、成本预览、收藏、分享、加入餐单 | `GET /recipes/:id`、`GET /recipes/:id/scale`、`POST /cooking/preview`、`POST /favorites/:id`、`POST /share/qrcode`、`POST /meal-plans` | 否 |
| `create` | `CreateRecipeView` | 创建/编辑菜谱（食材搜索/自定义、步骤计时、分类多选、公开设置）；支持 `initialData` prop 接收 AI 导入数据（v1.1）；分组选项增至4种（v1.1） | `POST /recipes`、`PATCH /recipes/:id`、`GET /categories`、`GET /ingredients`、`POST /categories/mine`、`DELETE /categories/:id`、`POST /uploads/image` | 否 |
| `import` | `RecipeImportView` | AI 文本智能导入（粘贴→解析→预览→确认预填表单）；支持粘贴板读取；显示置信度徽章（v1.1 新增） | `POST /recipes/parse-text` | 否 |
| `sop` | `SopView` | SOP 烹饪模式（逐步引导、计时器、食材匹配高亮、完成扣库存） | `POST /cooking/deduction-preview`、`POST /cooking/logs`、`POST /cooking/undo-deduction`、`POST /timers` | 否 |
| `my-recipes` | `MyRecipesView` | 我的菜谱列表、批量删除 | `GET /recipes?authorId={me}`、`POST /recipes/batch-delete`、`DELETE /recipes/:id` | 否 |
| `shopping-list` | `ShoppingListView` | 采购清单生成（选菜谱 → 生成）、标记已购、分享文本 | `GET /recipes`、`POST /shopping-list/generate` | 否 |
| `meal-plan` | `MealPlanView` | 每周餐单规划（按周/按餐次）、一键生成采购清单 | `GET /meal-plans`、`POST /meal-plans`、`DELETE /meal-plans/:id`、`POST /meal-plans/to-shopping-list`、`GET /recipes` | 否 |
| `onboarding` | `OnboardingView` | 新用户引导（5步介绍） | 无 API | 否 |
| `help` | `HelpCenterView` | 帮助中心（7个手风琴章节） | 无 API | 否 |
| `admin登录` | `AdminLoginView` | 管理员登录（`?admin=1` 触发） | `POST /admin/auth/login`、`GET /admin/auth/whoami` | 否 |
| `admin改密` | `AdminChangePasswordView` | 首次登录强制改密（v1.1 新增）；拦截在 `App.tsx` 层面，不进入 Dashboard | `POST /admin/auth/change-password` | 否 |
| `admin仪表盘` | `AdminDashboardView` | 管理后台（Tab：数据看板/菜谱管理/AI 智能导入/创建菜谱/用户管理/食材管理/分类管理，v1.1 新增 AI 导入 Tab 和批量模式；coverImage 上传改进） | 所有 `/api/admin/*` 接口 | 否 |

### 前端辅助组件（无独立页面状态）

| 组件名 | 功能 |
|--------|------|
| `SharePosterModal` | 分享海报弹窗（Canvas 绘制海报、显示 QR 码） |
| `FeatureHint` | 场景化轻提示组件（contextual tips） |

### 小程序页面

| 页面文件 | 功能 |
|---------|------|
| `shell.vue` | 唯一页面，web-view 壳；先 wx.login 换 token，再用 query 传 token 加载 H5；LAN IP 改为环境变量注入（v1.1） |
| 其他 `.vue` 文件（home/sop/history/edit/discover/timers/pantry/profile/detail） | **注意**：这些文件存在于 `frontend-miniapp/src/pages/` 但代码中未见实际路由配置引用它们；小程序实际只通过 `shell.vue` 加载 H5，其他页面文件可能是初始脚手架残留，**未实际启用** |

---

## 七、已知问题与待办

### 7.1 硬编码值

| 位置 | 内容 | 风险 | 状态 |
|------|------|------|------|
| `frontend-miniapp/src/pages/shell/shell.vue` | `LAN_IP` 原硬编码 `"192.168.112.27"` | 真机调试 IP 硬编码，换网络环境需手动改 | **v1.1 已修复**：改为 `import.meta.env.VITE_LAN_IP`，通过 `.env.development` 注入 |
| `uncle-joes-kitchen-api/.env` | `WX_SECRET=254219fb58aaedc6281010fe920cea30` | 微信 AppSecret 明文在 .env，不应提交 git | 待处理 |
| `uncle-joes-kitchen-api/.env` | `AI_API_KEY=sk-d65f467c4665448d8aafaaf758c1866e` | AI API Key 明文在 .env，不应提交 git | 待处理 |
| `database/seeds/admin.seed.ts` | 超管密码硬编码 `LaoJiu@2026!` | 密码不应硬编码在种子文件 | **v1.1 已修复**：密码改从 `ADMIN_SEED_PASSWORD` 环境变量读取；未设置时报错拒绝 seed |
| `frontend/public/privacy-policy.html` & `user-agreement.html` | `[公司名称占位]` / `[公司注册地法院]` | 法律文档占位符未替换 | 待处理 |

### 7.2 已修复 Bug（v1.1）

| Bug | 修复方案 |
|-----|---------|
| `createOfficialRecipe` 事务隔离问题：在 `dataSource.transaction` 内部调用 `service` 方法时使用了外部 Repository 实例，导致食材/步骤/分类操作不在同一事务内 | 修复为统一使用 `manager.getRepository()` 在事务 manager 内操作所有相关实体 |
| `POST /api/uploads/image` 管理员 token 返回 401 | `UploadsController` 的 `AuthGuard` 改为数组形式 `['jwt', 'admin-jwt']`，两种 token 均放行 |

### 7.3 未完成/部分实现的功能

| 功能 | 状态 | 说明 |
|------|------|------|
| `admin.seed.ts:59` 官方 logo | TODO | `avatar: null, // TODO: set to official logo URL later` |
| 小程序原生页面（非 shell） | 未启用 | `frontend-miniapp/src/pages/` 下的 home/sop/history/edit/discover/timers/pantry/profile/detail 等页面文件存在但未在 pages.json 中配置（未验证），实际通过 shell.vue web-view 加载 H5 |
| `@google/genai` 依赖 | 存在但未使用 | `frontend/package.json` 中有 `@google/genai ^2.4.0` 依赖，但前端代码未见调用；AI 能力实际在后端通过 `RecipeParseService` 调用 DashScope 实现，可考虑移除此前端依赖 |
| 消息通知 | UI 入口存在，功能未实现 | `ProfileView` 菜单有"消息通知"项，`t('profile.featureComingSoon')` 提示功能开发中 |
| 推荐给好友（系统级分享） | UI 入口存在，功能受限 | 微信分享通过 `navigator.share` 或复制链接实现，非原生小程序转发 |
| 意见反馈 | UI 入口存在，功能未实现 | `ProfileView` 菜单有"意见反馈"项，提示开发中 |
| 食材换算因子（scaleFactor） | 后端实体存在，前端 UI 不完整 | 实体有 `scaleFactor`，UI 仅展示 scaleType 选择 |
| `favoriteCount`/`ratingAvg` 字段 | 前端 types.ts 定义，但后端 Recipe entity 无对应字段 | 后端只有 `viewCount`；`favoriteCount` 和 `ratingAvg` 需聚合查询，当前列表接口未返回 |
| 版本历史回滚 | 数据存储实现，无 UI 恢复操作 | `GET /recipes/:id/versions` 返回快照，但没有"恢复到某版本"的 API 和 UI |

### 7.4 代码中的注释待办

| 文件 | 内容 |
|------|------|
| `api.ts` cookingLogId | `cookingLogId: "" // 后端「开始烹饪」不落库，只有完成时记录` |
| `stock-deduction.service.ts` | 扣减后单位统一改为 canonical，可能导致用户看到"库存从斤变成g" |

### 7.5 安全注意事项（v1.1 更新）

- `.env` 文件包含生产密钥（WX_SECRET、AI_API_KEY），应通过 `.gitignore` 排除
- **v1.1 新增**：`main.ts` 新增 `assertProductionSecrets()` 守卫，生产环境 JWT secret 为占位值或长度 < 32 字符时拒绝启动，有效防止弱密钥上生产
- **v1.1 新增**：`admin.seed.ts` 密码改从 `ADMIN_SEED_PASSWORD` env 读取，不再硬编码；未设置时报错
- **v1.1 新增**：`must_change_password` 机制强制 seed 创建的管理员账号在首次使用前改密
- 管理员密码 bcrypt 哈希（10 rounds），安全

---

## 八、环境配置

### 8.1 后端 `.env` 变量

| 变量名 | 当前值（开发环境）或示例值 | 说明 |
|--------|--------------------------|------|
| `DB_HOST` | `localhost` | PostgreSQL 主机 |
| `DB_PORT` | `5432` | PostgreSQL 端口 |
| `DB_NAME` | `ujk_dev` | 数据库名 |
| `DB_USER` | `ujk_user` | 数据库用户 |
| `DB_PASSWORD` | `ujk_dev_password` | 数据库密码 |
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `JWT_SECRET` | `your-jwt-secret-change-in-production` | 用户 JWT secret（**生产必须换；占位值会被启动守卫拦截**） |
| `JWT_EXPIRES_IN` | `7d` | 用户 token 有效期 |
| `ADMIN_JWT_SECRET` | `admin-jwt-secret-change-in-production` | 管理员 JWT secret（**生产必须换；同上**） |
| `ADMIN_JWT_EXPIRES_IN` | `12h` | 管理员 token 有效期 |
| `WX_APPID` | `wxe657793473769f5a` | 微信小程序 AppID |
| `WX_SECRET` | `254219fb58aaedc6...` | 微信小程序 AppSecret（**敏感**） |
| `ALLOW_MOCK_LOGIN` | `true`（开发）/ `false`（生产） | 是否允许 mock 登录；同时控制内容安全检查是否跳过 |
| `UPLOAD_DIR` | `./uploads` | 图片上传目录 |
| `MAX_FILE_SIZE` | `5242880` | 最大文件大小（5MB） |
| `PORT` | `3001` | 后端端口 |
| `NODE_ENV` | `development` | 环境标识 |
| `AI_PROVIDER` | `alibaba` | AI 提供商（`alibaba` = 阿里百炼 DashScope；其他值走 OpenAI 兼容格式） |
| `AI_API_KEY` | `sk-d65f467...` | AI API Key（**敏感**；v1.1 新增） |
| `AI_MODEL` | `deepseek-v4-flash` | AI 模型名（`.env.example` 默认 `qwen-plus`） |
| `AI_API_BASE` | 未设置（按 provider 自动判断） | 覆盖 AI API base URL（可选） |
| `ADMIN_SEED_PASSWORD` | 需手动设置 | seed 脚本读取的超管初始密码（**v1.1 新增**；不可为 `change-me-strong-password`） |
| `FRONTEND_URL` | 未设置（默认 `http://localhost:5173`） | 开发模式 QR 分享链接前缀 |

### 8.2 前端 `.env.local` 变量

| 变量名 | 当前值 | 说明 |
|--------|--------|------|
| `VITE_API_BASE_URL` | `http://localhost:3001/api` | API 基础地址（localhost 时使用；非 localhost 自动切换） |

### 8.3 小程序环境变量（v1.1 新增）

| 文件 | 变量名 | 说明 |
|------|--------|------|
| `.env.development` | `VITE_LAN_IP` | 局域网 IP（如 `192.168.112.27`），用于真机调试；`shell.vue` 构建时注入，替代原硬编码 |
| `.env.production` | `VITE_H5_BASE_URL` | 生产 H5 HTTPS 域名（如 `https://your-domain.com`），同时需在微信公众平台「开发设置 → 业务域名」添加 |

### 8.4 启动命令

```bash
# 后端（开发）
cd uncle-joes-kitchen-api
pnpm start:dev          # NestJS watch 模式，端口 3001

# 后端（数据库）
pnpm migration:run      # 运行全部迁移（共 14 个，含 v1.1 新增的 AddAdminMustChangePassword）
pnpm seed               # 运行种子数据（需先设置 ADMIN_SEED_PASSWORD env）

# 前端
cd frontend
pnpm dev                # Vite 开发服务器，端口 3000
pnpm lint               # TypeScript 类型检查（tsc --noEmit）

# 小程序
cd frontend-miniapp
pnpm dev:mp-weixin      # 编译到 dist/dev/mp-weixin/
# 然后用微信开发者工具打开 frontend-miniapp/ 目录
```

### 8.5 数据库迁移历史（14个文件）

| 顺序 | 文件名 | 主要变更 |
|------|--------|---------|
| 1 | `1779778399026-InitialSchema` | 初始化（调整 scaleFactor/totalCost 默认值语法） |
| 2 | `1779800000000-AddUserIngredientShelfLife` | 为 user_ingredients 增加保质期字段 |
| 3 | `1779800000001-AddUserAutoDeductStock` | users 增加 autoDeductStock 字段 |
| 4 | `1779800000002-WidenUserIngredientUnitPrice` | 扩展 unitPrice 精度（decimal → 12,4） |
| 5 | `1779800000003-RecipeMultiCategoryAndUserCategory` | 创建 recipe_categories 关联表，categories 增加 ownerId |
| 6 | `1779800000004-AddUserIngredientCategoryId` | user_ingredients 增加 categoryId |
| 7 | `1779800000005-AddRecipePublicAndFeatured` | recipes 增加 isPublic / isFeatured |
| 8 | `1779800000006-CreateShareCodes` | 创建 share_codes 表 |
| 9 | `1779800000007-CreateMealPlans` | 创建 meal_plans 表 |
| 10 | `1779800000008-CreateAdminUsers` | 创建 admin_users 表 |
| 11 | `1779800000009-AddUserStatusAndVip` | users 增加 status / vipExpiresAt |
| 12 | `1779800000010-AdminEnhancements` | 增加 viewCount/lastLoginAt/aliases/calories/enabled 等字段 |
| 13 | `1779800000011-FixSnakeCaseColumns` | 修复 share_codes 和 meal_plans 的列名（蛇形→驼峰） |
| 14 | `1779800000013-AddAdminMustChangePassword` | **v1.1 新增**：admin_users 增加 `must_change_password boolean NOT NULL DEFAULT true`；存量账号 UPDATE 为 false |

---

## 九、单位体系（附录）

### 单位换算规则（前后端共同遵守）

| 类型 | 内部存储（canonical 单位） | 用户友好单位（显示） | 换算 |
|------|--------------------------|-------------------|------|
| 重量 | `g`（克） | 斤 | 1斤 = 500g |
| 体积 | `ml`（毫升） | L | 1L = 1000ml |
| 计数 | `count`（个） | 个 | 1:1 |

### 支持单位（前端 `lib/units.ts`）

- **重量**：g / gram / 克 / kg / 千克 / 公斤 / mg / 毫克 / 斤 / 市斤 / 两 / 钱 / lb / pound / oz / ounce
- **体积**：ml / 毫升 / l / 升 / cl / tsp / 茶匙 / 小勺 / tbsp / 汤匙 / 大勺 / 勺 / cup / 杯
- **计数**：个 / 只 / 颗 / 粒 / 块 / 片 / 根 / 条 / 瓣 / 朵 / 把 / 束 / pcs / piece / pieces

### 价格显示规则

内部存储：¥/g 或 ¥/ml（单价精度最多4位小数）
用户界面显示：¥/斤 或 ¥/L（需乘以换算系数后展示）
