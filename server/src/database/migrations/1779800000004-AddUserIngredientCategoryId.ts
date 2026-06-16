import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIngredientCategoryId1779800000004 implements MigrationInterface {
  name = 'AddUserIngredientCategoryId1779800000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ADD COLUMN IF NOT EXISTS "categoryId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ADD CONSTRAINT "FK_user_ingredients_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" DROP CONSTRAINT IF EXISTS "FK_user_ingredients_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" DROP COLUMN IF EXISTS "categoryId"`,
    );
  }
}
