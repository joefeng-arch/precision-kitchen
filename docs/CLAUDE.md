# 老舅厨房 (Laojiu Kitchen)

家庭厨房菜谱管理全栈应用。微信小程序（web-view 壳）+ React H5 前端 + NestJS 后端。

## 项目结构（monorepo）

```
E:\老舅厨房app\laojiu-kitchen\
├── server/      # NestJS 后端 API（端口 3001）
├── frontend/    # React H5 前端（端口 3000，Vite + Tailwind）
├── miniapp/     # 微信小程序壳（uni-app Vue 3，web-view 加载 H5）
├── deploy/      # 生产部署：Dockerfile / docker-compose.prod.yml / nginx / deploy.sh
├── docs/        # PRD、API 契约文档
└── CLAUDE.md
```

## 技术栈

### 后端 — `server/`
- NestJS 10 + TypeScript
- PostgreSQL（TypeORM，开发 `ujk_dev`，生产 `ujk_prod`）
- Redis（缓存）
- JWT 双体系（用户 + 管理员，各自独立 secret）
- 文件上传：本地 `./uploads/`（生产挂载 `/var/lib/laojiu-kitchen/uploads`）
- API 前缀 `/api`，Swagger `/api-docs`（仅 dev）
- 监听 `0.0.0.0:3001`

### 前端 — `frontend/`
- React 19 + TypeScript + Vite + Tailwind 4
- react-i18next（zh-CN）
- lucide-react / recharts / motion
- API 基地址动态检测：localhost 用 `.env.local`，否则 `window.location.hostname`

### 小程序 — `miniapp/`
- uni-app 3（Vue 3 + TypeScript）
- web-view 壳模式：单个 `shell.vue` → `<web-view>` 加载 H5
- wx.login → 后端换 token → query 传 H5
- AppID `wxe657793473769f5a`

## 常用命令

```bash
# 后端
cd server && pnpm start:dev
pnpm migration:run
pnpm seed

# 前端
cd frontend && pnpm dev
pnpm lint

# 小程序
cd miniapp && pnpm dev:mp-weixin
# 然后微信开发者工具打开 miniapp/，miniprogramRoot 指向 dist/dev/mp-weixin/
```

## 生产部署

```bash
cd deploy && cp .env.production.example .env.production
vim .env.production && sudo ./deploy.sh
```

详见 [deploy/README.md](deploy/README.md)。

域名：
- `laojiukitchen.cn`        落地页
- `api.laojiukitchen.cn`    API
- `admin.laojiukitchen.cn`  管理后台

## 后端模块

| 模块 | 路径 | 说明 |
|------|------|------|
| auth | `modules/auth/` | 微信登录、JWT 签发（用户端） |
| admin | `modules/admin/` | 管理员认证 + 管理 CRUD（独立 JWT） |
| users | `modules/users/` | 用户实体、个人资料 |
| recipes | `modules/recipes/` | 菜谱 CRUD、版本管理、食材换算 |
| categories | `modules/categories/` | 菜谱分类 |
| ingredients | `modules/ingredients/` | 官方食材库 + 用户食材库（库存） |
| cooking | `modules/cooking/` | SOP 烹饪日志、成本计算、库存扣减 |
| timers | `modules/timers/` | 多线程烹饪计时器 |
| favorites | `modules/favorites/` | 菜谱收藏 |
| share | `modules/share/` | 分享码 |
| shopping-list | `modules/shopping-list/` | 采购清单 |
| meal-plans | `modules/meal-plans/` | 周餐计划 |
| uploads | `modules/uploads/` | 图片上传 |

## 前端页面

| 组件 | 功能 |
|------|------|
| `HomeView` | 首页 |
| `RecipeDetailView` | 菜谱详情 |
| `CreateRecipeView` | 创建/编辑菜谱 |
| `SopView` | SOP 烹饪模式 |
| `TimerView` | 计时器（滚轮选择器） |
| `PantryView` | 食材库 |
| `DiscoverView` | 发现页 |
| `ProfileView` | 个人中心 |
| `MyRecipesView` | 我的菜谱 |
| `MealPlanView` | 周餐计划 |
| `ShoppingListView` | 采购清单 |
| `OnboardingView` | 新用户引导 |
| `HelpCenterView` | 帮助中心 |
| `AdminLoginView` / `AdminDashboardView` | 管理后台（`?admin=1`） |

## 单位体系

| 内部单位 | 显示单位 | 换算 |
|---------|---------|------|
| g | 斤 | 1 斤 = 500g |
| ml | L | 1L = 1000ml |
| count | 个 | 1:1 |

内部存 ¥/g 或 ¥/ml，显示为 ¥/斤 或 ¥/L。

## 已知注意事项

- **TypeORM 列名**：字段 camelCase；migration 13 已修复历史不一致。新字段注意 `@Column({ name: 'xxx' })`。
- **小程序模拟器**：`uni.login` 报 `Failed to fetch` → 通过 `platform === "devtools"` 跳过，直接加载 H5。
- **局域网测试**：后端监听 `0.0.0.0`，前端 `api.ts` 动态检测 hostname。
- **SOP 食材匹配**：名长 < 2 跳过，防"盐""油"误匹配。
- **法律文档**：`frontend/public/privacy-policy.html` / `user-agreement.html`，占位符 `[公司名称占位]` / `[公司注册地法院]`。

## 环境配置

后端 `.env`（开发）：DB `localhost:5432/ujk_dev`、Redis `localhost:6379`、端口 3001、WX_APPID `wxe657793473769f5a`。

前端 `.env.local`：`VITE_API_BASE_URL=http://localhost:3001/api`。

生产参数见 [deploy/.env.production.example](deploy/.env.production.example)。
