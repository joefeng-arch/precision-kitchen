import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) categories 增加 ownerId（用户自建分类的归属人）
 * 2) categories 唯一索引由 (type, name) 改为 (type, ownerId, name)
 *    —— 同一用户下不能重名；用户分类与系统分类不冲突
 * 3) 新建 recipe_categories 关联表，支持菜谱归多个分类
 *    将已有 recipes.categoryId 数据回填进 recipe_categories（不删旧列，保留向后兼容）
 */
export class RecipeMultiCategoryAndUserCategory1779800000003
  implements MigrationInterface
{
  name = 'RecipeMultiCategoryAndUserCategory1779800000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // categories.ownerId
    await queryRunner.query(`ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "ownerId" uuid`);

    // 旧唯一索引 → 新唯一索引
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_categories_type_name"`,
    );
    // TypeORM 自动生成名是 hash 的，找不到就忽略，按表内全部 unique 索引一一清理
    const oldIdx = await queryRunner.query(
      `SELECT indexname FROM pg_indexes
         WHERE tablename = 'categories'
           AND indexdef ILIKE '%UNIQUE%'
           AND indexdef ILIKE '%type%'
           AND indexdef ILIKE '%name%'
           AND indexdef NOT ILIKE '%ownerId%'`,
    );
    for (const row of oldIdx ?? []) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${row.indexname}"`);
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_categories_type_owner_name" ON "categories" ("type", "ownerId", "name")`,
    );

    // recipe_categories 关联表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_categories" (
        "id" SERIAL PRIMARY KEY,
        "recipeId" uuid NOT NULL,
        "categoryId" integer NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recipe_categories_recipe_category" ON "recipe_categories" ("recipeId", "categoryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_categories_categoryId" ON "recipe_categories" ("categoryId")`,
    );

    // 回填：把现有 recipes.categoryId 数据复制到关联表
    await queryRunner.query(`
      INSERT INTO "recipe_categories" ("recipeId", "categoryId")
      SELECT "id", "categoryId" FROM "recipes" WHERE "categoryId" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_categories"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_categories_type_owner_name"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_categories_type_name" ON "categories" ("type", "name")`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "ownerId"`);
  }
}
