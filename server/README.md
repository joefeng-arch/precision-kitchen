# 老舅厨房 — 后端 API

NestJS 10 + PostgreSQL 16 + Redis 7 · 端口 3001

## 快速启动（开发）

```bash
# 1. 安装依赖
cd server
pnpm install

# 2. 环境变量
cp .env.example .env
# 编辑 .env，至少填 JWT_SECRET / ADMIN_JWT_SECRET

# 3. 启动数据库
docker compose -f docker/docker-compose.yml up -d

# 4. 运行迁移 + 种子数据
pnpm migration:run
pnpm seed

# 5. 启动开发服务器
pnpm start:dev
```

- API 根路径：http://localhost:3001/api
- Swagger 文档：http://localhost:3001/api-docs
- 健康检查：http://localhost:3001/api/health

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm start:dev` | 开发模式（watch） |
| `pnpm build` | 编译 TypeScript → dist/ |
| `pnpm start:prod` | 生产模式（需先 build） |
| `pnpm migration:run` | 运行所有待执行迁移 |
| `pnpm migration:revert` | 回滚最后一次迁移 |
| `pnpm seed` | 写入初始数据（管理员账号、食材库） |
| `pnpm lint` | ESLint 检查 |

## 模块一览

| 模块 | 路径 | 说明 |
|------|------|------|
| auth | `src/modules/auth/` | 微信登录、JWT 签发 |
| admin | `src/modules/admin/` | 管理员认证 + 管理 CRUD（独立 JWT） |
| users | `src/modules/users/` | 用户实体、个人资料 |
| recipes | `src/modules/recipes/` | 菜谱 CRUD、版本管理、食材换算 |
| categories | `src/modules/categories/` | 分类管理（支持启用/禁用） |
| ingredients | `src/modules/ingredients/` | 官方食材库 + 用户食材库（库存） |
| cooking | `src/modules/cooking/` | SOP 烹饪日志、成本计算、库存扣减 |
| timers | `src/modules/timers/` | 多线程烹饪计时器（Redis） |
| favorites | `src/modules/favorites/` | 菜谱收藏 |
| share | `src/modules/share/` | 分享码生成 |
| shopping-list | `src/modules/shopping-list/` | 采购清单 |
| meal-plans | `src/modules/meal-plans/` | 每周餐计划 |
| uploads | `src/modules/uploads/` | 图片上传（本地 ./uploads/） |

## 数据库迁移

共 13 个迁移文件（`src/database/migrations/`），按顺序：

1. `InitialSchema` — 基础表结构
2. `AddUserIngredientShelfLife` — 食材保质期
3. `AddUserAutoDeductStock` — 自动扣库存设置
4. `WidenUserIngredientUnitPrice` — 单价精度
5. `RecipeMultiCategoryAndUserCategory` — 多分类 + 用户自定义分类
6. `AddUserIngredientCategoryId` — 食材关联分类
7. `AddRecipePublicAndFeatured` — 公开/精选字段
8. `CreateShareCodes` — 分享码表
9. `CreateMealPlans` — 餐计划表
10. `CreateAdminUsers` — 管理员表
11. `AddUserStatusAndVip` — 用户状态/VIP
12. `AdminEnhancements` — viewCount、aliases、calories、enabled
13. `FixSnakeCaseColumns` — 修复 TypeORM 列名驼峰/蛇形不一致

## 认证体系

- **用户端**：JWT，secret = `JWT_SECRET`，有效期 7 天，通过微信 wx.login 授权码换取
- **管理端**：独立 JWT，secret = `ADMIN_JWT_SECRET`，有效期 12 小时，账号密码登录

## 注意事项

- TypeORM 实体字段用 camelCase，数据库列用 snake_case；新字段加 `@Column({ name: 'snake_case_name' })` 或保持默认推导
- 生产部署见 `../deploy/README.md`
- 生产 `.env.production` 示例见 `../deploy/.env.production.example`
