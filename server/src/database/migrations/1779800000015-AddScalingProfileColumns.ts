import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 缩放引擎字段落库（海外版 PRD §4.1，片3）。
 * 增量加列，全部 nullable 或带默认值，绝不破坏旧数据：
 * - recipes：scalingProfile（默认 linear_legacy，旧行回填后行为不变）、baseAnchor(jsonb)、recipeType（默认 simple）
 * - recipe_ingredients：scalingRole / percentageValue / ratioGroup / ratioValue / correction(jsonb) / roundDp（全 nullable）
 * 不改引擎/服务/API；下一片再接线。
 */
export class AddScalingProfileColumns1779800000015 implements MigrationInterface {
  name = 'AddScalingProfileColumns1779800000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // recipes
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "scalingProfile" varchar(24) NOT NULL DEFAULT 'linear_legacy'`,
    );
    await queryRunner.query(`ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "baseAnchor" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "recipeType" varchar(16) NOT NULL DEFAULT 'simple'`,
    );

    // recipe_ingredients（全 nullable，旧行留 NULL 走 legacy 路径）
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "scalingRole" varchar(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "percentageValue" numeric(7,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "ratioGroup" varchar(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "ratioValue" numeric(10,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "correction" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "roundDp" smallint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 逆序 DROP，可干净回滚
    await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP COLUMN IF EXISTS "roundDp"`);
    await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP COLUMN IF EXISTS "correction"`);
    await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP COLUMN IF EXISTS "ratioValue"`);
    await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP COLUMN IF EXISTS "ratioGroup"`);
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" DROP COLUMN IF EXISTS "percentageValue"`,
    );
    await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP COLUMN IF EXISTS "scalingRole"`);

    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "recipeType"`);
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "baseAnchor"`);
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "scalingProfile"`);
  }
}
