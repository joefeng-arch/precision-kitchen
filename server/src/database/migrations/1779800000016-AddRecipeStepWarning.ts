import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecipeStepWarning1779800000016 implements MigrationInterface {
  name = 'AddRecipeStepWarning1779800000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recipe_steps" ADD COLUMN IF NOT EXISTS "warning" varchar(256)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recipe_steps" DROP COLUMN IF EXISTS "warning"`);
  }
}
