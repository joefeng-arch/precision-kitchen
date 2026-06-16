# 数据库迁移

TypeORM 迁移文件，**请勿手动编辑已执行过的迁移**。

## 常用命令

```bash
# 根据实体变更自动生成迁移
pnpm migration:generate src/database/migrations/<迁移名>

# 创建空迁移文件（手动写 SQL）
pnpm migration:create src/database/migrations/<迁移名>

# 执行所有未运行的迁移
pnpm migration:run

# 回滚最后一次迁移
pnpm migration:revert
```

## 已执行迁移（按顺序）

| # | 文件名 | 说明 |
|---|--------|------|
| 1 | `InitialSchema` | 基础表结构 |
| 2 | `AddUserIngredientShelfLife` | 食材保质期字段 |
| 3 | `AddUserAutoDeductStock` | 自动扣库存开关 |
| 4 | `WidenUserIngredientUnitPrice` | 单价字段精度扩展 |
| 5 | `RecipeMultiCategoryAndUserCategory` | 多分类 + 用户自定义分类 |
| 6 | `AddUserIngredientCategoryId` | 食材关联分类 |
| 7 | `AddRecipePublicAndFeatured` | 公开/精选字段 |
| 8 | `CreateShareCodes` | 分享码表 |
| 9 | `CreateMealPlans` | 餐计划表 |
| 10 | `CreateAdminUsers` | 管理员表 |
| 11 | `AddUserStatusAndVip` | 用户状态/VIP 字段 |
| 12 | `AdminEnhancements` | viewCount、lastLoginAt、aliases、calories、enabled |
| 13 | `FixSnakeCaseColumns` | 修复 TypeORM 列名驼峰/蛇形不一致 |

## 注意事项

- 新字段推荐显式加 `@Column({ name: 'snake_case_name' })`，避免 TypeORM 默认推导行为在不同版本间不一致
- 生产环境通过 Docker 启动后自动执行 migration，见 `deploy/deploy.sh`
