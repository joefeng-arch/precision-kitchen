import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMealPlans1779800000007 implements MigrationInterface {
  name = 'CreateMealPlans1779800000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('meal_plans');
    if (!exists) {
      await queryRunner.query(`
        CREATE TABLE meal_plans (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan_date    DATE NOT NULL,
          meal_type    VARCHAR(20) NOT NULL,
          recipe_id    UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          servings     DECIMAL(6,2) NOT NULL DEFAULT 1,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, plan_date, meal_type, recipe_id)
        );
      `);
    }

    if (
      (await queryRunner.hasColumn('meal_plans', 'user_id')) &&
      (await queryRunner.hasColumn('meal_plans', 'plan_date'))
    ) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, plan_date);
      `);
    }
    if (
      (await queryRunner.hasColumn('meal_plans', 'userId')) &&
      (await queryRunner.hasColumn('meal_plans', 'planDate'))
    ) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_meal_plans_userId_planDate" ON meal_plans ("userId", "planDate");
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_meal_plans_user_date;`);
    await queryRunner.query(`DROP TABLE IF EXISTS meal_plans;`);
  }
}
