import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add fields required by admin dashboard enhancements:
 * - recipes.viewCount (int, default 0)
 * - users.lastLoginAt (timestamptz, nullable)
 * - ingredients.aliases (jsonb, default '[]')
 * - ingredients.calories (decimal(8,2), nullable)
 * - categories.enabled (boolean, default true)
 */
export class AdminEnhancements1779800000010 implements MigrationInterface {
  name = 'AdminEnhancements1779800000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Recipe: viewCount
    await queryRunner.query(`
      ALTER TABLE recipes
        ADD COLUMN IF NOT EXISTS "viewCount" INT NOT NULL DEFAULT 0;
    `);

    // User: lastLoginAt
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ;
    `);

    // Ingredient: aliases, calories
    await queryRunner.query(`
      ALTER TABLE ingredients
        ADD COLUMN IF NOT EXISTS "aliases" JSONB NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "calories" DECIMAL(8,2);
    `);

    // Category: enabled
    await queryRunner.query(`
      ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT TRUE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE categories DROP COLUMN IF EXISTS "enabled";`);
    await queryRunner.query(`ALTER TABLE ingredients DROP COLUMN IF EXISTS "calories";`);
    await queryRunner.query(`ALTER TABLE ingredients DROP COLUMN IF EXISTS "aliases";`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "lastLoginAt";`);
    await queryRunner.query(`ALTER TABLE recipes DROP COLUMN IF EXISTS "viewCount";`);
  }
}
